/**
 * Command Interpreter Service
 * Interprets natural language commands and converts them to edit decisions
 */

import { getGoogleAIClient } from "./google-ai";
import type {
  VideoAnalysis,
  EditDecision,
  CommandResult,
  Annotation,
  QuickCommand,
} from "@/types/ai";
import { nanoid } from "nanoid";

// ============================================================================
// Quick Commands (No AI needed)
// ============================================================================

export const QUICK_COMMANDS: QuickCommand[] = [
  {
    id: "remove-silence",
    label: "Remove Silence",
    command: "remove all silence",
    description: "Cut out all silent gaps in the video",
  },
  {
    id: "cut-fillers",
    label: "Cut Fillers",
    command: "cut filler words",
    description: "Remove um, uh, like, you know, etc.",
  },
  {
    id: "keep-talking",
    label: "Keep Talking Only",
    command: "keep only talking segments",
    description: "Keep only parts where someone is speaking",
  },
  {
    id: "remove-long-pauses",
    label: "Remove Long Pauses",
    command: "remove pauses longer than 2 seconds",
    description: "Cut pauses that are too long",
  },
];

/**
 * Try to handle command without AI (for common operations)
 */
export function tryQuickCommand(
  command: string,
  analysis: VideoAnalysis
): CommandResult | null {
  const normalizedCommand = command.toLowerCase().trim();

  // Remove all silence
  if (
    normalizedCommand.includes("remove") &&
    normalizedCommand.includes("silence")
  ) {
    const silenceAnnotations = analysis.annotations.filter(
      (a) => a.type === "silence"
    );

    if (silenceAnnotations.length === 0) {
      return {
        success: true,
        command,
        interpretation: "No silence segments found in the video.",
        edits: [],
        affectedTimeRanges: [],
      };
    }

    const edits: EditDecision[] = silenceAnnotations.map((a) => ({
      id: nanoid(),
      type: "cut",
      startTime: a.startTime,
      endTime: a.endTime,
      params: { reason: "silence" },
      command,
      createdAt: new Date(),
    }));

    return {
      success: true,
      command,
      interpretation: `Found ${silenceAnnotations.length} silence segments to remove.`,
      edits,
      affectedTimeRanges: silenceAnnotations.map((a) => ({
        start: a.startTime,
        end: a.endTime,
      })),
    };
  }

  // Cut filler words
  if (
    normalizedCommand.includes("filler") ||
    (normalizedCommand.includes("cut") &&
      (normalizedCommand.includes("um") || normalizedCommand.includes("uh")))
  ) {
    const fillerAnnotations = analysis.annotations.filter(
      (a) => a.type === "filler"
    );

    // Also check transcript for filler segments
    const fillerTranscript = analysis.transcript.filter((t) => t.isFiller);

    const allFillers = [
      ...fillerAnnotations.map((a) => ({
        startTime: a.startTime,
        endTime: a.endTime,
      })),
      ...fillerTranscript.map((t) => ({
        startTime: t.startTime,
        endTime: t.endTime,
      })),
    ];

    // Deduplicate and merge overlapping ranges
    const mergedFillers = mergeOverlappingRanges(allFillers);

    if (mergedFillers.length === 0) {
      return {
        success: true,
        command,
        interpretation: "No filler words found in the video.",
        edits: [],
        affectedTimeRanges: [],
      };
    }

    const edits: EditDecision[] = mergedFillers.map((range) => ({
      id: nanoid(),
      type: "cut",
      startTime: range.startTime,
      endTime: range.endTime,
      params: { reason: "filler" },
      command,
      createdAt: new Date(),
    }));

    return {
      success: true,
      command,
      interpretation: `Found ${mergedFillers.length} filler word segments to remove.`,
      edits,
      affectedTimeRanges: mergedFillers.map((r) => ({
        start: r.startTime,
        end: r.endTime,
      })),
    };
  }

  // Keep only talking
  if (
    normalizedCommand.includes("keep") &&
    (normalizedCommand.includes("talking") ||
      normalizedCommand.includes("speech") ||
      normalizedCommand.includes("speaking"))
  ) {
    const talkingAnnotations = analysis.annotations.filter(
      (a) => a.type === "talking"
    );

    if (talkingAnnotations.length === 0) {
      return {
        success: false,
        command,
        interpretation: "No talking segments found to keep.",
        edits: [],
        affectedTimeRanges: [],
        error: "No talking segments detected in the video.",
      };
    }

    // Create cuts for everything that's NOT talking
    const edits = createCutsFromKeepRanges(
      talkingAnnotations.map((a) => ({ start: a.startTime, end: a.endTime })),
      analysis.duration,
      command
    );

    return {
      success: true,
      command,
      interpretation: `Keeping ${talkingAnnotations.length} talking segments, cutting the rest.`,
      edits,
      affectedTimeRanges: edits.map((e) => ({
        start: e.startTime,
        end: e.endTime,
      })),
    };
  }

  // Remove long pauses
  const pauseMatch = normalizedCommand.match(
    /remove.*pause.*(?:longer|over|more)\s*(?:than)?\s*(\d+(?:\.\d+)?)\s*(?:second|sec|s)?/i
  );
  if (pauseMatch) {
    const threshold = parseFloat(pauseMatch[1]);
    const longPauses = analysis.annotations.filter(
      (a) => a.type === "silence" && a.endTime - a.startTime > threshold
    );

    if (longPauses.length === 0) {
      return {
        success: true,
        command,
        interpretation: `No pauses longer than ${threshold} seconds found.`,
        edits: [],
        affectedTimeRanges: [],
      };
    }

    const edits: EditDecision[] = longPauses.map((a) => ({
      id: nanoid(),
      type: "cut",
      startTime: a.startTime,
      endTime: a.endTime,
      params: { reason: "long pause" },
      command,
      createdAt: new Date(),
    }));

    return {
      success: true,
      command,
      interpretation: `Found ${longPauses.length} pauses longer than ${threshold}s to remove.`,
      edits,
      affectedTimeRanges: longPauses.map((a) => ({
        start: a.startTime,
        end: a.endTime,
      })),
    };
  }

  // No quick command matched
  return null;
}

// ============================================================================
// AI-Powered Command Interpretation
// ============================================================================

const COMMAND_SYSTEM_PROMPT = `You are a video editing assistant. The user will give you a natural language command about editing a video.
Based on the video analysis data provided, interpret the command and return specific edit decisions.

AVAILABLE EDIT TYPES:
- "cut": Remove a time range from the video
- "keep": Mark a range to keep (implies cutting everything else)
- "speed": Change playback speed of a range
- "caption": Add text overlay
- "zoom": Add digital zoom effect
- "audio": Adjust audio (volume, normalize, mute)

RULES:
1. All times must be in seconds
2. startTime must be less than endTime
3. Times must be within the video duration
4. Be precise with timing based on the transcript and annotations
5. Return empty edits array if the command cannot be fulfilled

When the user says things like:
- "remove the intro" - cut from start until main content begins
- "delete from X to Y" - cut that specific time range
- "speed up the slow parts" - apply speed changes to silence/pauses
- "add captions" - create caption edits from transcript`;

const COMMAND_RESULT_SCHEMA = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    interpretation: {
      type: "string",
      description: "Human-readable explanation of what will be done",
    },
    edits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["cut", "keep", "speed", "caption", "zoom", "audio"],
          },
          startTime: { type: "number" },
          endTime: { type: "number" },
          params: { type: "object" },
        },
        required: ["type", "startTime", "endTime"],
      },
    },
    error: { type: "string" },
  },
  required: ["success", "interpretation", "edits"],
};

/**
 * Interpret a command using AI
 */
export async function interpretCommand(
  command: string,
  analysis: VideoAnalysis
): Promise<CommandResult> {
  // First, try quick command (no AI needed)
  const quickResult = tryQuickCommand(command, analysis);
  if (quickResult) {
    return quickResult;
  }

  // Use AI for complex commands
  const client = getGoogleAIClient();

  const prompt = `${COMMAND_SYSTEM_PROMPT}

VIDEO ANALYSIS:
- Duration: ${analysis.duration} seconds
- Detected speakers: ${analysis.detectedSpeakers}
- Filler word count: ${analysis.fillerWordCount}
- Silence gaps: ${analysis.silenceGapCount}
- Scene changes: ${analysis.sceneChangeCount}

ANNOTATIONS (first 50):
${JSON.stringify(analysis.annotations.slice(0, 50), null, 2)}

TRANSCRIPT (first 20 segments):
${JSON.stringify(analysis.transcript.slice(0, 20), null, 2)}

USER COMMAND: "${command}"

Interpret this command and return edit decisions.`;

  try {
    const result = await client.generateJSON<{
      success: boolean;
      interpretation: string;
      edits: Array<{
        type: string;
        startTime: number;
        endTime: number;
        params?: Record<string, unknown>;
      }>;
      error?: string;
    }>(prompt, COMMAND_RESULT_SCHEMA);

    // Add IDs and timestamps to edits
    const edits: EditDecision[] = result.edits.map((e) => ({
      id: nanoid(),
      type: e.type as EditDecision["type"],
      startTime: e.startTime,
      endTime: e.endTime,
      params: e.params,
      command,
      createdAt: new Date(),
    }));

    return {
      success: result.success,
      command,
      interpretation: result.interpretation,
      edits,
      affectedTimeRanges: edits.map((e) => ({
        start: e.startTime,
        end: e.endTime,
      })),
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      command,
      interpretation: "Failed to interpret command",
      edits: [],
      affectedTimeRanges: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

interface TimeRange {
  startTime: number;
  endTime: number;
}

/**
 * Merge overlapping time ranges
 */
function mergeOverlappingRanges(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [];

  // Sort by start time
  const sorted = [...ranges].sort((a, b) => a.startTime - b.startTime);
  const merged: TimeRange[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.startTime <= last.endTime) {
      // Overlapping, extend the last range
      last.endTime = Math.max(last.endTime, current.endTime);
    } else {
      // Not overlapping, add new range
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Create cut edits from keep ranges (inverse logic)
 */
function createCutsFromKeepRanges(
  keepRanges: Array<{ start: number; end: number }>,
  duration: number,
  command: string
): EditDecision[] {
  if (keepRanges.length === 0) return [];

  // Sort keep ranges
  const sorted = [...keepRanges].sort((a, b) => a.start - b.start);
  const cuts: EditDecision[] = [];

  // Cut from start to first keep range
  if (sorted[0].start > 0) {
    cuts.push({
      id: nanoid(),
      type: "cut",
      startTime: 0,
      endTime: sorted[0].start,
      params: { reason: "before first keep range" },
      command,
      createdAt: new Date(),
    });
  }

  // Cut between keep ranges
  for (let i = 0; i < sorted.length - 1; i++) {
    const currentEnd = sorted[i].end;
    const nextStart = sorted[i + 1].start;

    if (nextStart > currentEnd) {
      cuts.push({
        id: nanoid(),
        type: "cut",
        startTime: currentEnd,
        endTime: nextStart,
        params: { reason: "between keep ranges" },
        command,
        createdAt: new Date(),
      });
    }
  }

  // Cut from last keep range to end
  const lastEnd = sorted[sorted.length - 1].end;
  if (lastEnd < duration) {
    cuts.push({
      id: nanoid(),
      type: "cut",
      startTime: lastEnd,
      endTime: duration,
      params: { reason: "after last keep range" },
      command,
      createdAt: new Date(),
    });
  }

  return cuts;
}
