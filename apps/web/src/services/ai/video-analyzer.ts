/**
 * Video Analyzer Service
 * Analyzes video content using Google Gemini to extract annotations and transcript
 */

import { getGoogleAIClient } from "./google-ai";
import type {
  VideoAnalysis,
  Annotation,
  TranscriptSegment,
  AnalysisProgress,
} from "@/types/ai";
import { nanoid } from "nanoid";

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

const ANALYSIS_SYSTEM_PROMPT = `You are a video analysis AI. Analyze the provided video frames and audio context to identify:

1. TRANSCRIPT: Transcribe any spoken words with timestamps
2. ANNOTATIONS: Identify segments of different types:
   - "talking": When someone is speaking
   - "silence": Gaps with no speech (> 0.5 seconds)
   - "filler": Filler words (um, uh, like, you know, etc.)
   - "scene": Visual scene changes
   - "music": Background music detected
   - "noise": Non-speech audio

CRITICAL RULES:
1. All timestamps must be in SECONDS (e.g., 2.5 not 2500)
2. Timestamps must be within the video duration bounds
3. Every annotation needs startTime < endTime
4. TRANSCRIPT = SPOKEN AUDIO ONLY. Transcribe what you HEAR people saying
5. Mark filler word segments with isFiller: true in transcript
6. Be precise with timing - use the frame timestamps as reference

OUTPUT FORMAT:
Return a JSON object matching the schema provided.`;

const VIDEO_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    duration: {
      type: "number",
      description: "Total video duration in seconds",
    },
    summary: {
      type: "string",
      description: "Brief summary of the video content",
    },
    detectedSpeakers: {
      type: "number",
      description: "Number of distinct speakers detected",
    },
    fillerWordCount: {
      type: "number",
      description: "Total count of filler words detected",
    },
    silenceGapCount: {
      type: "number",
      description: "Number of silence gaps detected",
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
            enum: ["talking", "silence", "scene", "filler", "noise", "music"],
          },
          startTime: { type: "number" },
          endTime: { type: "number" },
          confidence: { type: "number" },
          label: { type: "string" },
        },
        required: ["id", "type", "startTime", "endTime", "confidence"],
      },
    },
    transcript: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          startTime: { type: "number" },
          endTime: { type: "number" },
          text: { type: "string" },
          speaker: { type: "string" },
          isFiller: { type: "boolean" },
        },
        required: ["id", "startTime", "endTime", "text"],
      },
    },
  },
  required: [
    "duration",
    "summary",
    "annotations",
    "transcript",
    "detectedSpeakers",
    "fillerWordCount",
    "silenceGapCount",
    "sceneChangeCount",
  ],
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
 * Analyze a single chunk of frames
 */
async function analyzeChunk(
  chunk: FrameChunk,
  chunkIndex: number,
  totalChunks: number,
  videoDuration: number
): Promise<Partial<VideoAnalysis>> {
  const client = getGoogleAIClient();

  const chunkPrompt = `${ANALYSIS_SYSTEM_PROMPT}

VIDEO CONTEXT:
- Total video duration: ${videoDuration} seconds
- This is chunk ${chunkIndex + 1} of ${totalChunks}
- Chunk time range: ${chunk.startTime.toFixed(2)}s to ${chunk.endTime.toFixed(2)}s
- Frame timestamps: ${chunk.timestamps.map((t) => t.toFixed(2) + "s").join(", ")}

Analyze these ${chunk.frames.length} frames and provide annotations and transcript for this time range only.`;

  const result = await client.analyzeFramesJSON<Partial<VideoAnalysis>>(
    chunk.frames,
    chunkPrompt,
    VIDEO_ANALYSIS_SCHEMA
  );

  // Ensure all IDs are unique by prefixing with chunk index
  if (result.annotations) {
    result.annotations = result.annotations.map((a) => ({
      ...a,
      id: a.id || `${chunkIndex}-${nanoid(8)}`,
    }));
  }

  if (result.transcript) {
    result.transcript = result.transcript.map((t) => ({
      ...t,
      id: t.id || `${chunkIndex}-${nanoid(8)}`,
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

  try {
    // Stage 1: Extract frames
    updateProgress("extracting", 0, "Loading video...");

    const video = await createVideoElement(videoFile);
    const duration = video.duration;

    updateProgress("extracting", 20, "Extracting frames...");

    const { frames, timestamps } = await extractFrames(video, {
      framesPerSecond: FRAMES_PER_SECOND,
      maxTotalFrames: MAX_TOTAL_FRAMES,
      jpegQuality: JPEG_QUALITY,
      maxWidth: MAX_FRAME_WIDTH,
    });

    updateProgress(
      "extracting",
      40,
      `Extracted ${frames.length} frames`
    );

    // Clean up video element
    URL.revokeObjectURL(video.src);

    // Stage 2: Analyze frames
    updateProgress("analyzing", 50, "Analyzing video content...");

    // For short videos (< 30 frames), analyze in one go
    if (frames.length <= MAX_FRAMES_PER_CHUNK) {
      const chunk: FrameChunk = {
        frames,
        timestamps,
        startTime: 0,
        endTime: duration,
      };

      const result = await analyzeChunk(chunk, 0, 1, duration);

      updateProgress("complete", 100, "Analysis complete");

      return {
        duration,
        summary: result.summary || "Video analysis complete",
        annotations: (result.annotations as Annotation[]) || [],
        transcript: (result.transcript as TranscriptSegment[]) || [],
        detectedSpeakers: result.detectedSpeakers || 1,
        fillerWordCount: result.fillerWordCount || 0,
        silenceGapCount: result.silenceGapCount || 0,
        sceneChangeCount: result.sceneChangeCount || 0,
        analyzedAt: new Date(),
      };
    }

    // For longer videos, process in chunks
    const chunks = createChunks(frames, timestamps, MAX_FRAMES_PER_CHUNK);
    const results: Partial<VideoAnalysis>[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkProgress = 50 + (i / chunks.length) * 45;
      updateProgress(
        "analyzing",
        chunkProgress,
        `Analyzing chunk ${i + 1} of ${chunks.length}...`
      );

      const result = await analyzeChunk(chunks[i], i, chunks.length, duration);
      results.push(result);
    }

    updateProgress("complete", 100, "Analysis complete");

    return mergeChunkResults(results, duration);
  } catch (error) {
    updateProgress(
      "error",
      0,
      error instanceof Error ? error.message : "Analysis failed"
    );
    throw error;
  }
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
