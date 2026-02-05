/**
 * Video Analyzer Service
 * Analyzes video content using:
 * - ElevenLabs Scribe for audio transcription (word-level timestamps, speaker diarization)
 * - Google Gemini for visual analysis (scene changes, visual content)
 */

import { getGoogleAIClient } from "./google-ai";
import {
  hasElevenLabsKey,
  extractAudioFromVideo,
  transcribeWithElevenLabs,
  convertToStandardTranscript,
  type ElevenLabsTranscriptionResult,
} from "./elevenlabs";
import type {
  VideoAnalysis,
  Annotation,
  TranscriptSegment,
  AnalysisProgress,
  AudioEvent,
} from "@/types/ai";
import { nanoid } from "nanoid";
import { isFillerWord } from "@/types/ai";

// ============================================================================
// Constants
// ============================================================================

const FRAMES_PER_SECOND = 1; // Extract 1 frame per second
const MAX_FRAMES_PER_CHUNK = 30; // Max frames to send in one request
const MAX_TOTAL_FRAMES = 120; // Max frames for very long videos
const JPEG_QUALITY = 0.7;
const MAX_FRAME_WIDTH = 720;

// ============================================================================
// Analysis Prompts
// ============================================================================

// Visual-only analysis prompt - Gemini only handles visual content
const VISUAL_ANALYSIS_PROMPT = `You are a video analysis AI. Analyze the provided video frames to identify VISUAL content only.

ANALYZE:
1. SCENE CHANGES: When the visual scene/shot changes significantly
2. VISUAL SUMMARY: Brief description of what's happening visually

DO NOT attempt to transcribe audio - that is handled by a separate audio service.

ANNOTATIONS to identify:
- "scene": Visual scene changes, shot transitions, or significant visual changes

CRITICAL RULES:
1. All timestamps must be in SECONDS (e.g., 2.5 not 2500)
2. Timestamps must be within the video duration bounds
3. Every annotation needs startTime < endTime
4. Be precise with timing - use the frame timestamps as reference
5. Focus on VISUAL information only - no audio transcription

OUTPUT FORMAT:
Return a JSON object matching the schema provided.`;

// Schema for visual-only analysis - Gemini handles visuals, ElevenLabs handles audio
const VISUAL_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Brief visual summary of the video content",
    },
    sceneChangeCount: {
      type: "number",
      description: "Number of scene changes detected",
    },
    annotations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: {
            type: "string",
            enum: ["scene"],
          },
          startTime: { type: "number" },
          endTime: { type: "number" },
          confidence: { type: "number" },
          label: { type: "string" },
        },
        required: ["id", "type", "startTime", "endTime", "confidence"],
      },
    },
  },
  required: ["summary", "annotations", "sceneChangeCount"],
};

// ============================================================================
// Frame Extraction
// ============================================================================

interface ExtractedFrames {
  frames: string[]; // base64 data URLs
  timestamps: number[]; // timestamps in seconds
}

/**
 * Create a video element from a file
 */
async function createVideoElement(videoFile: File): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;

    video.onloadedmetadata = () => {
      video.currentTime = 0;
    };

    video.onseeked = () => {
      resolve(video);
    };

    video.onerror = () => {
      reject(new Error("Failed to load video"));
    };

    video.src = URL.createObjectURL(videoFile);
  });
}

/**
 * Extract frames from video at specified interval
 */
async function extractFrames(
  video: HTMLVideoElement,
  options: {
    framesPerSecond?: number;
    maxFramesPerChunk?: number;
    maxTotalFrames?: number;
    jpegQuality?: number;
    maxWidth?: number;
  } = {}
): Promise<ExtractedFrames> {
  const {
    framesPerSecond = FRAMES_PER_SECOND,
    maxTotalFrames = MAX_TOTAL_FRAMES,
    jpegQuality = JPEG_QUALITY,
    maxWidth = MAX_FRAME_WIDTH,
  } = options;

  const duration = video.duration;
  const interval = 1 / framesPerSecond;
  let totalFrames = Math.floor(duration * framesPerSecond);

  // Limit total frames for very long videos
  if (totalFrames > maxTotalFrames) {
    totalFrames = maxTotalFrames;
  }

  const frames: string[] = [];
  const timestamps: number[] = [];

  // Calculate aspect ratio for canvas
  const aspectRatio = video.videoHeight / video.videoWidth;
  const canvasWidth = Math.min(video.videoWidth, maxWidth);
  const canvasHeight = Math.floor(canvasWidth * aspectRatio);

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  for (let i = 0; i < totalFrames; i++) {
    const time = (i / totalFrames) * duration;

    await new Promise<void>((resolve) => {
      video.currentTime = time;
      video.onseeked = () => resolve();
    });

    ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
    const dataUrl = canvas.toDataURL("image/jpeg", jpegQuality);

    frames.push(dataUrl);
    timestamps.push(time);
  }

  return { frames, timestamps };
}

// ============================================================================
// Chunk Processing
// ============================================================================

interface FrameChunk {
  frames: string[];
  timestamps: number[];
  startTime: number;
  endTime: number;
}

/**
 * Split frames into chunks for processing
 */
function createChunks(
  frames: string[],
  timestamps: number[],
  maxPerChunk: number
): FrameChunk[] {
  const chunks: FrameChunk[] = [];

  for (let i = 0; i < frames.length; i += maxPerChunk) {
    const chunkFrames = frames.slice(i, i + maxPerChunk);
    const chunkTimestamps = timestamps.slice(i, i + maxPerChunk);

    chunks.push({
      frames: chunkFrames,
      timestamps: chunkTimestamps,
      startTime: chunkTimestamps[0],
      endTime: chunkTimestamps[chunkTimestamps.length - 1],
    });
  }

  return chunks;
}

/**
 * Analyze a single chunk of frames for visual content only
 * Audio transcription is handled separately by ElevenLabs
 */
async function analyzeChunk(
  chunk: FrameChunk,
  chunkIndex: number,
  totalChunks: number,
  videoDuration: number
): Promise<Partial<VideoAnalysis>> {
  const client = getGoogleAIClient();

  const chunkPrompt = `${VISUAL_ANALYSIS_PROMPT}

VIDEO CONTEXT:
- Total video duration: ${videoDuration} seconds
- This is chunk ${chunkIndex + 1} of ${totalChunks}
- Chunk time range: ${chunk.startTime.toFixed(2)}s to ${chunk.endTime.toFixed(2)}s
- Frame timestamps: ${chunk.timestamps.map((t) => t.toFixed(2) + "s").join(", ")}

Analyze these ${chunk.frames.length} frames and provide visual annotations (scene changes) for this time range only.`;

  const result = await client.analyzeFramesJSON<Partial<VideoAnalysis>>(
    chunk.frames,
    chunkPrompt,
    VISUAL_ANALYSIS_SCHEMA
  );

  // Ensure all IDs are unique by prefixing with chunk index
  if (result.annotations) {
    result.annotations = result.annotations.map((a) => ({
      ...a,
      id: a.id || `${chunkIndex}-${nanoid(8)}`,
    }));
  }

  return result;
}

/**
 * Merge results from multiple chunks
 */
function mergeChunkResults(
  results: Partial<VideoAnalysis>[],
  duration: number
): VideoAnalysis {
  const allAnnotations: Annotation[] = [];
  const allTranscript: TranscriptSegment[] = [];

  let totalFillers = 0;
  let totalSilence = 0;
  let totalScenes = 0;
  let maxSpeakers = 0;

  for (const result of results) {
    if (result.annotations) {
      allAnnotations.push(...(result.annotations as Annotation[]));
    }
    if (result.transcript) {
      allTranscript.push(...(result.transcript as TranscriptSegment[]));
    }
    totalFillers += result.fillerWordCount || 0;
    totalSilence += result.silenceGapCount || 0;
    totalScenes += result.sceneChangeCount || 0;
    maxSpeakers = Math.max(maxSpeakers, result.detectedSpeakers || 0);
  }

  // Sort by start time
  allAnnotations.sort((a, b) => a.startTime - b.startTime);
  allTranscript.sort((a, b) => a.startTime - b.startTime);

  // Generate summary from last chunk (which has full context)
  const lastResult = results[results.length - 1];

  return {
    duration,
    summary: lastResult?.summary || "Video analysis complete",
    annotations: allAnnotations,
    transcript: allTranscript,
    detectedSpeakers: maxSpeakers,
    fillerWordCount: totalFillers,
    silenceGapCount: totalSilence,
    sceneChangeCount: totalScenes,
    analyzedAt: new Date(),
  };
}

// ============================================================================
// Main Analysis Function
// ============================================================================

export type ProgressCallback = (progress: AnalysisProgress) => void;

/**
 * Analyze a video file and return structured analysis
 * Requires ElevenLabs for audio transcription + Gemini for visual analysis
 */
export async function analyzeVideo(
  videoFile: File,
  onProgress?: ProgressCallback
): Promise<VideoAnalysis> {
  const updateProgress = (
    stage: AnalysisProgress["stage"],
    progress: number,
    message: string
  ) => {
    onProgress?.({ stage, progress, message });
  };

  // Check for ElevenLabs API key - required for transcription
  if (!hasElevenLabsKey()) {
    const error = new Error(
      "ElevenLabs API key is required for audio transcription. Please configure your ElevenLabs API key in Settings."
    );
    updateProgress("error", 0, error.message);
    throw error;
  }

  try {
    // Stage 1: Extract frames for visual analysis
    updateProgress("extracting", 0, "Loading video...");

    const video = await createVideoElement(videoFile);
    const duration = video.duration;

    updateProgress("extracting", 10, "Extracting frames for visual analysis...");

    const { frames, timestamps } = await extractFrames(video, {
      framesPerSecond: FRAMES_PER_SECOND,
      maxTotalFrames: MAX_TOTAL_FRAMES,
      jpegQuality: JPEG_QUALITY,
      maxWidth: MAX_FRAME_WIDTH,
    });

    updateProgress("extracting", 25, `Extracted ${frames.length} frames`);

    // Clean up video element
    URL.revokeObjectURL(video.src);

    // Stage 2: Transcription with ElevenLabs
    updateProgress("transcribing", 30, "Extracting audio for transcription...");

    let elevenLabsResult: ElevenLabsTranscriptionResult;

    try {
      const audioBlob = await extractAudioFromVideo(videoFile);

      updateProgress("transcribing", 40, "Transcribing with ElevenLabs Scribe...");

      elevenLabsResult = await transcribeWithElevenLabs(audioBlob, {
        onProgress: (msg) => updateProgress("transcribing", 45, msg),
      });

      updateProgress("transcribing", 55, "Transcription complete");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Transcription failed";
      updateProgress("error", 0, `ElevenLabs transcription failed: ${errorMessage}`);
      throw new Error(`ElevenLabs transcription failed: ${errorMessage}`);
    }

    // Stage 3: Visual analysis with Gemini
    updateProgress("analyzing", 60, "Analyzing video visuals with AI...");

    let visualAnalysis: VideoAnalysis;

    // For short videos (< 30 frames), analyze in one go
    if (frames.length <= MAX_FRAMES_PER_CHUNK) {
      const chunk: FrameChunk = {
        frames,
        timestamps,
        startTime: 0,
        endTime: duration,
      };

      const result = await analyzeChunk(chunk, 0, 1, duration);

      visualAnalysis = {
        duration,
        summary: result.summary || "Video analysis complete",
        annotations: (result.annotations as Annotation[]) || [],
        transcript: [],
        detectedSpeakers: 0,
        fillerWordCount: 0,
        silenceGapCount: 0,
        sceneChangeCount: result.sceneChangeCount || 0,
        analyzedAt: new Date(),
      };
    } else {
      // For longer videos, process in chunks
      const chunks = createChunks(frames, timestamps, MAX_FRAMES_PER_CHUNK);
      const results: Partial<VideoAnalysis>[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunkProgress = 60 + (i / chunks.length) * 35;
        updateProgress(
          "analyzing",
          chunkProgress,
          `Analyzing visual chunk ${i + 1} of ${chunks.length}...`
        );

        const result = await analyzeChunk(chunks[i], i, chunks.length, duration);
        results.push(result);
      }

      visualAnalysis = mergeChunkResults(results, duration);
    }

    // Stage 4: Combine results
    updateProgress("analyzing", 95, "Combining analysis results...");

    const finalAnalysis = combineAnalysisResults(visualAnalysis, elevenLabsResult, duration);

    updateProgress("complete", 100, "Analysis complete");

    return finalAnalysis;
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("ElevenLabs"))) {
      updateProgress(
        "error",
        0,
        error instanceof Error ? error.message : "Analysis failed"
      );
    }
    throw error;
  }
}

/**
 * Combine visual analysis from Gemini with transcription from ElevenLabs
 */
function combineAnalysisResults(
  visualAnalysis: VideoAnalysis,
  elevenLabsResult: ElevenLabsTranscriptionResult | null,
  duration: number
): VideoAnalysis {
  if (!elevenLabsResult) {
    // No ElevenLabs result - return Gemini analysis as-is
    return visualAnalysis;
  }

  // Convert ElevenLabs transcript to standard format
  const transcript = convertToStandardTranscript(elevenLabsResult);

  // Generate annotations from transcript for talking/silence/filler
  const audioAnnotations = generateAnnotationsFromTranscript(transcript, duration);

  // Convert ElevenLabs audio events to annotations
  const audioEventAnnotations: Annotation[] = elevenLabsResult.audioEvents.map((event) => ({
    id: nanoid(8),
    type: event.type as Annotation["type"],
    startTime: event.startTime,
    endTime: event.endTime,
    confidence: 0.9,
    label: event.type,
  }));

  // Merge annotations: visual (scene changes) + audio (talking/silence/filler/music)
  const visualOnlyAnnotations = visualAnalysis.annotations.filter(
    (a) => a.type === "scene"
  );

  const allAnnotations = [
    ...visualOnlyAnnotations,
    ...audioAnnotations,
    ...audioEventAnnotations,
  ].sort((a, b) => a.startTime - b.startTime);

  // Count stats from combined data
  const fillerCount = transcript.filter((t) => t.isFiller).length;
  const silenceCount = audioAnnotations.filter((a) => a.type === "silence").length;
  const sceneCount = visualOnlyAnnotations.filter((a) => a.type === "scene").length;

  return {
    duration,
    summary: visualAnalysis.summary,
    annotations: allAnnotations,
    transcript,
    detectedSpeakers: elevenLabsResult.speakers.length || 1,
    fillerWordCount: fillerCount,
    silenceGapCount: silenceCount,
    sceneChangeCount: sceneCount,
    audioEvents: elevenLabsResult.audioEvents.map((e) => ({
      type: e.type as AudioEvent["type"],
      startTime: e.startTime,
      endTime: e.endTime,
    })),
    analyzedAt: new Date(),
  };
}

/**
 * Generate talking/silence/filler annotations from transcript segments
 */
function generateAnnotationsFromTranscript(
  transcript: TranscriptSegment[],
  duration: number
): Annotation[] {
  const annotations: Annotation[] = [];

  // Add talking annotations for each transcript segment
  for (const segment of transcript) {
    // Check if this is a filler segment
    if (segment.isFiller || (segment.words && segment.words.some((w) => isFillerWord(w.word)))) {
      annotations.push({
        id: nanoid(8),
        type: "filler",
        startTime: segment.startTime,
        endTime: segment.endTime,
        confidence: 0.9,
        label: segment.text,
      });
    }

    // Add talking annotation
    annotations.push({
      id: nanoid(8),
      type: "talking",
      startTime: segment.startTime,
      endTime: segment.endTime,
      confidence: 0.95,
      label: segment.speaker || "Speaker",
    });
  }

  // Find silence gaps (gaps > 0.5s between segments)
  const sortedSegments = [...transcript].sort((a, b) => a.startTime - b.startTime);

  // Check for silence at the beginning
  if (sortedSegments.length > 0 && sortedSegments[0].startTime > 0.5) {
    annotations.push({
      id: nanoid(8),
      type: "silence",
      startTime: 0,
      endTime: sortedSegments[0].startTime,
      confidence: 0.9,
      label: "Silence",
    });
  }

  // Check for gaps between segments
  for (let i = 0; i < sortedSegments.length - 1; i++) {
    const gap = sortedSegments[i + 1].startTime - sortedSegments[i].endTime;
    if (gap > 0.5) {
      annotations.push({
        id: nanoid(8),
        type: "silence",
        startTime: sortedSegments[i].endTime,
        endTime: sortedSegments[i + 1].startTime,
        confidence: 0.9,
        label: "Silence",
      });
    }
  }

  // Check for silence at the end
  if (sortedSegments.length > 0) {
    const lastEnd = sortedSegments[sortedSegments.length - 1].endTime;
    if (duration - lastEnd > 0.5) {
      annotations.push({
        id: nanoid(8),
        type: "silence",
        startTime: lastEnd,
        endTime: duration,
        confidence: 0.9,
        label: "Silence",
      });
    }
  }

  return annotations;
}

/**
 * Analyze video from a URL (for already uploaded videos)
 */
export async function analyzeVideoUrl(
  videoUrl: string,
  onProgress?: ProgressCallback
): Promise<VideoAnalysis> {
  const response = await fetch(videoUrl);
  const blob = await response.blob();
  const file = new File([blob], "video.mp4", { type: blob.type });
  return analyzeVideo(file, onProgress);
}
