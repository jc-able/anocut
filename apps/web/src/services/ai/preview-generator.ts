/**
 * Preview Generator Service
 * Generates preview data for video with AI edits applied (non-destructive)
 */

import type { EditDecision } from "@/types/ai";

// ============================================================================
// Types
// ============================================================================

export interface TimeSegment {
  originalStart: number;
  originalEnd: number;
  previewStart: number;
  previewEnd: number;
  speedFactor: number;
  isCut: boolean;
}

export interface PreviewTimeline {
  segments: TimeSegment[];
  originalDuration: number;
  previewDuration: number;
  totalCutDuration: number;
  cutCount: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

interface TimeRange {
  start: number;
  end: number;
}

/**
 * Merge overlapping time ranges
 */
function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: TimeRange[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Subtract ranges from a total duration, returning the kept segments
 */
function subtractRanges(
  duration: number,
  cutRanges: TimeRange[]
): TimeRange[] {
  if (cutRanges.length === 0) {
    return [{ start: 0, end: duration }];
  }

  const merged = mergeRanges(cutRanges);
  const kept: TimeRange[] = [];
  let currentStart = 0;

  for (const cut of merged) {
    if (cut.start > currentStart) {
      kept.push({ start: currentStart, end: cut.start });
    }
    currentStart = Math.max(currentStart, cut.end);
  }

  if (currentStart < duration) {
    kept.push({ start: currentStart, end: duration });
  }

  return kept;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Generate a preview timeline from AI edit decisions
 * This creates a non-destructive preview showing what the video will look like
 * after applying the edits
 */
export function generatePreviewTimeline(
  originalDuration: number,
  edits: EditDecision[]
): PreviewTimeline {
  // Separate cuts from other edits
  const cutEdits = edits.filter((e) => e.type === "cut");
  const speedEdits = edits.filter((e) => e.type === "speed");

  // Get cut ranges
  const cutRanges: TimeRange[] = cutEdits.map((e) => ({
    start: e.startTime,
    end: e.endTime,
  }));

  // Calculate kept segments
  const keptRanges = subtractRanges(originalDuration, cutRanges);

  // Build segments with preview timing
  const segments: TimeSegment[] = [];
  let previewTime = 0;

  for (const kept of keptRanges) {
    // Find any speed edits that apply to this segment
    const applicableSpeedEdit = speedEdits.find(
      (s) => s.startTime <= kept.start && s.endTime >= kept.end
    );
    const speedFactor = (applicableSpeedEdit?.params?.speed as number) || 1;

    const segmentDuration = kept.end - kept.start;
    const previewDuration = segmentDuration / speedFactor;

    segments.push({
      originalStart: kept.start,
      originalEnd: kept.end,
      previewStart: previewTime,
      previewEnd: previewTime + previewDuration,
      speedFactor,
      isCut: false,
    });

    previewTime += previewDuration;
  }

  // Calculate totals
  const mergedCuts = mergeRanges(cutRanges);
  const totalCutDuration = mergedCuts.reduce(
    (sum, cut) => sum + (cut.end - cut.start),
    0
  );

  return {
    segments,
    originalDuration,
    previewDuration: previewTime,
    totalCutDuration,
    cutCount: mergedCuts.length,
  };
}

/**
 * Convert original time to preview time
 * Returns null if the time is within a cut segment
 */
export function originalToPreviewTime(
  originalTime: number,
  timeline: PreviewTimeline
): number | null {
  for (const segment of timeline.segments) {
    if (
      originalTime >= segment.originalStart &&
      originalTime < segment.originalEnd
    ) {
      const offsetInOriginal = originalTime - segment.originalStart;
      const offsetInPreview = offsetInOriginal / segment.speedFactor;
      return segment.previewStart + offsetInPreview;
    }
  }
  return null; // Time is within a cut
}

/**
 * Convert preview time to original time
 */
export function previewToOriginalTime(
  previewTime: number,
  timeline: PreviewTimeline
): number {
  for (const segment of timeline.segments) {
    if (
      previewTime >= segment.previewStart &&
      previewTime < segment.previewEnd
    ) {
      const offsetInPreview = previewTime - segment.previewStart;
      const offsetInOriginal = offsetInPreview * segment.speedFactor;
      return segment.originalStart + offsetInOriginal;
    }
  }
  // Return end of last segment
  const lastSegment = timeline.segments[timeline.segments.length - 1];
  return lastSegment?.originalEnd || 0;
}

/**
 * Check if an original time is within a cut region
 */
export function isTimeCut(
  originalTime: number,
  edits: EditDecision[]
): boolean {
  const cutEdits = edits.filter((e) => e.type === "cut");
  return cutEdits.some(
    (cut) => originalTime >= cut.startTime && originalTime < cut.endTime
  );
}

/**
 * Get the cut that contains a specific time (if any)
 */
export function getCutAtTime(
  originalTime: number,
  edits: EditDecision[]
): EditDecision | null {
  const cutEdits = edits.filter((e) => e.type === "cut");
  return (
    cutEdits.find(
      (cut) => originalTime >= cut.startTime && originalTime < cut.endTime
    ) || null
  );
}

/**
 * Calculate the savings from applying edits
 */
export function calculateEditSavings(timeline: PreviewTimeline): {
  savedSeconds: number;
  savedPercentage: number;
  originalDuration: number;
  newDuration: number;
} {
  return {
    savedSeconds: timeline.originalDuration - timeline.previewDuration,
    savedPercentage:
      ((timeline.originalDuration - timeline.previewDuration) /
        timeline.originalDuration) *
      100,
    originalDuration: timeline.originalDuration,
    newDuration: timeline.previewDuration,
  };
}
