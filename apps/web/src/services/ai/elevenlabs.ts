/**
 * ElevenLabs Service
 * Client-side service for ElevenLabs transcription via API route
 */

import type { TranscriptSegment, TranscriptWord } from "@/types/ai";

// ============================================================================
// Types
// ============================================================================

export interface ElevenLabsTranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
  isFiller?: boolean;
  words: {
    word: string;
    startTime: number;
    endTime: number;
    confidence: number;
    speakerId?: string;
  }[];
}

export interface ElevenLabsAudioEvent {
  type: string;
  startTime: number;
  endTime: number;
}

export interface ElevenLabsTranscriptionResult {
  transcript: ElevenLabsTranscriptSegment[];
  audioEvents: ElevenLabsAudioEvent[];
  fullText: string;
  speakers: string[];
}

// ============================================================================
// Storage
// ============================================================================

const ELEVENLABS_KEY_STORAGE = "anocut-elevenlabs-key";

export function hasElevenLabsKey(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(ELEVENLABS_KEY_STORAGE);
}

export function getElevenLabsKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ELEVENLABS_KEY_STORAGE);
}

export function setElevenLabsKey(key: string): void {
  localStorage.setItem(ELEVENLABS_KEY_STORAGE, key);
}

export function removeElevenLabsKey(): void {
  localStorage.removeItem(ELEVENLABS_KEY_STORAGE);
}

// ============================================================================
// Audio Extraction
// ============================================================================

/**
 * Extract audio from a video file as WAV
 */
export async function extractAudioFromVideo(videoFile: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;

    const audioContext = new AudioContext();

    video.onloadedmetadata = async () => {
      try {
        // Create audio buffer from video
        const arrayBuffer = await videoFile.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Convert to WAV
        const wavBlob = audioBufferToWav(audioBuffer);
        resolve(wavBlob);
      } catch (error) {
        reject(error);
      }
    };

    video.onerror = () => {
      reject(new Error("Failed to load video for audio extraction"));
    };

    video.src = URL.createObjectURL(videoFile);
  });
}

/**
 * Convert AudioBuffer to WAV Blob
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // Write audio data
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// ============================================================================
// Transcription
// ============================================================================

/**
 * Transcribe audio using ElevenLabs via API route
 */
export async function transcribeWithElevenLabs(
  audioBlob: Blob,
  options: {
    apiKey?: string;
    onProgress?: (message: string) => void;
  } = {}
): Promise<ElevenLabsTranscriptionResult> {
  const { apiKey, onProgress } = options;
  const key = apiKey || getElevenLabsKey();

  onProgress?.("Preparing audio for transcription...");

  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.wav");

  const headers: Record<string, string> = {};
  if (key) {
    headers["x-elevenlabs-key"] = key;
  }

  onProgress?.("Transcribing with ElevenLabs Scribe...");

  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Transcription failed");
  }

  const result = await response.json();

  onProgress?.("Transcription complete");

  return result;
}

/**
 * Transcribe video file with ElevenLabs
 */
export async function transcribeVideo(
  videoFile: File,
  options: {
    apiKey?: string;
    onProgress?: (message: string) => void;
  } = {}
): Promise<ElevenLabsTranscriptionResult> {
  const { onProgress } = options;

  onProgress?.("Extracting audio from video...");
  const audioBlob = await extractAudioFromVideo(videoFile);

  return transcribeWithElevenLabs(audioBlob, options);
}

/**
 * Convert ElevenLabs transcript to our standard format
 */
export function convertToStandardTranscript(
  elevenLabsResult: ElevenLabsTranscriptionResult
): TranscriptSegment[] {
  return elevenLabsResult.transcript.map((segment) => ({
    id: segment.id,
    startTime: segment.startTime,
    endTime: segment.endTime,
    text: segment.text,
    speaker: segment.speaker,
    isFiller: segment.isFiller,
    words: segment.words.map((w) => ({
      word: w.word,
      startTime: w.startTime,
      endTime: w.endTime,
      confidence: w.confidence,
    })),
  }));
}
