/**
 * AI-related types for AnoCut voice-driven editing
 */

// ============================================================================
// Annotation Types
// ============================================================================

export type AnnotationType =
  | "talking"
  | "silence"
  | "scene"
  | "filler"
  | "noise"
  | "music";

export interface Annotation {
  id: string;
  type: AnnotationType;
  startTime: number; // seconds
  endTime: number; // seconds
  confidence: number; // 0-1
  label?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Transcript Types
// ============================================================================

export interface TranscriptWord {
  word: string;
  startTime: number; // seconds
  endTime: number; // seconds
  confidence: number; // 0-1
  speakerId?: string;
}

export interface TranscriptSegment {
  id: string;
  startTime: number; // seconds
  endTime: number; // seconds
  text: string;
  speaker?: string;
  isFiller?: boolean;
  words?: TranscriptWord[];
}

// ============================================================================
// Audio Event Types (from ElevenLabs)
// ============================================================================

export type AudioEventType = "laughter" | "applause" | "music" | "silence";

export interface AudioEvent {
  type: AudioEventType;
  startTime: number;
  endTime: number;
}

// ============================================================================
// Video Analysis Types
// ============================================================================

export interface VideoAnalysis {
  duration: number;
  annotations: Annotation[];
  transcript: TranscriptSegment[];
  summary: string;
  detectedSpeakers: number;
  fillerWordCount: number;
  silenceGapCount: number;
  sceneChangeCount: number;
  audioEvents?: AudioEvent[];
  analyzedAt: Date;
}

export interface AnalysisProgress {
  stage:
    | "idle"
    | "extracting"
    | "uploading"
    | "transcribing"
    | "analyzing"
    | "complete"
    | "error";
  progress: number; // 0-100
  message: string;
}

// ============================================================================
// Edit Types
// ============================================================================

export type EditType = "cut" | "keep" | "speed" | "caption" | "zoom" | "audio";

export interface CutParams {
  reason?: string;
}

export interface SpeedParams {
  factor: number; // 0.5 = half speed, 2 = double speed
}

export interface CaptionParams {
  text: string;
  position?: "top" | "center" | "bottom";
  style?: "default" | "bold" | "outline";
}

export interface ZoomParams {
  scale: number; // 1.0 = no zoom, 2.0 = 2x zoom
  x?: number; // 0-1, center point
  y?: number; // 0-1, center point
}

export interface AudioParams {
  volume?: number; // 0-2, 1 = normal
  normalize?: boolean;
  mute?: boolean;
}

export type EditParams =
  | CutParams
  | SpeedParams
  | CaptionParams
  | ZoomParams
  | AudioParams;

export interface EditDecision {
  id: string;
  type: EditType;
  startTime: number;
  endTime: number;
  params?: EditParams;
  command?: string; // Original user command that created this edit
  createdAt: Date;
}

// ============================================================================
// Command Types
// ============================================================================

export interface CommandResult {
  success: boolean;
  command: string;
  interpretation: string;
  edits: EditDecision[];
  affectedTimeRanges: Array<{ start: number; end: number }>;
  error?: string;
}

export interface QuickCommand {
  id: string;
  label: string;
  command: string;
  icon?: string;
  description?: string;
}

// ============================================================================
// AI Settings Types
// ============================================================================

export type AIModel = "gemini-2.0-flash" | "gemini-2.0-pro";

export interface AISettings {
  googleApiKey: string | null;
  selectedModel: AIModel;
  autoAnalyze: boolean;
}

export const AI_MODELS: Record<AIModel, { name: string; description: string }> =
  {
    "gemini-2.0-flash": {
      name: "Gemini 2.0 Flash",
      description: "Fast and efficient for most tasks",
    },
    "gemini-2.0-pro": {
      name: "Gemini 2.0 Pro",
      description: "Higher quality, slower processing",
    },
  };

// ============================================================================
// Filler Words
// ============================================================================

export const FILLER_WORDS = new Set([
  "um",
  "uh",
  "er",
  "ah",
  "like",
  "you know",
  "basically",
  "actually",
  "literally",
  "right",
  "so",
  "well",
  "i mean",
  "kind of",
  "sort of",
  "okay",
  "ok",
  "yeah",
  "hmm",
  "huh",
]);

export function isFillerWord(word: string): boolean {
  return FILLER_WORDS.has(word.toLowerCase().replace(/[.,!?]/g, ""));
}
