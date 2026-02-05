/**
 * AI Export Hook
 * Applies AI edit decisions to the timeline for export
 */

import { useCallback, useMemo } from "react";
import { useAIEditorStore } from "@/stores/ai-editor-store";
import {
  generatePreviewTimeline,
  calculateEditSavings,
  type PreviewTimeline,
} from "@/services/ai/preview-generator";

export interface AIExportInfo {
  hasEdits: boolean;
  cutCount: number;
  totalCutDuration: number;
  originalDuration: number;
  newDuration: number;
  savedPercentage: number;
  previewTimeline: PreviewTimeline | null;
}

/**
 * Hook to get AI export information and apply edits
 */
export function useAIExport() {
  const analysis = useAIEditorStore((s) => s.analysis);
  const aiEdits = useAIEditorStore((s) => s.aiEdits);

  const exportInfo = useMemo((): AIExportInfo => {
    if (!analysis || aiEdits.length === 0) {
      return {
        hasEdits: false,
        cutCount: 0,
        totalCutDuration: 0,
        originalDuration: analysis?.duration || 0,
        newDuration: analysis?.duration || 0,
        savedPercentage: 0,
        previewTimeline: null,
      };
    }

    const previewTimeline = generatePreviewTimeline(analysis.duration, aiEdits);
    const savings = calculateEditSavings(previewTimeline);

    return {
      hasEdits: true,
      cutCount: previewTimeline.cutCount,
      totalCutDuration: previewTimeline.totalCutDuration,
      originalDuration: savings.originalDuration,
      newDuration: savings.newDuration,
      savedPercentage: savings.savedPercentage,
      previewTimeline,
    };
  }, [analysis, aiEdits]);

  /**
   * Get export segments for FFmpeg-compatible processing
   * Returns an array of time ranges to keep from the original video
   */
  const getExportSegments = useCallback(() => {
    if (!exportInfo.previewTimeline) {
      return null;
    }

    return exportInfo.previewTimeline.segments.map((segment) => ({
      start: segment.originalStart,
      end: segment.originalEnd,
      speed: segment.speedFactor,
    }));
  }, [exportInfo.previewTimeline]);

  /**
   * Generate FFmpeg filter complex for applying edits
   * This can be used with server-side FFmpeg processing
   */
  const generateFFmpegFilter = useCallback(() => {
    if (!exportInfo.previewTimeline) {
      return null;
    }

    const segments = exportInfo.previewTimeline.segments;
    if (segments.length === 0) {
      return null;
    }

    // Generate trim and concat filter
    const filters: string[] = [];
    const videoLabels: string[] = [];
    const audioLabels: string[] = [];

    segments.forEach((segment, index) => {
      const label = `v${index}`;
      const aLabel = `a${index}`;

      // Trim filter
      filters.push(
        `[0:v]trim=start=${segment.originalStart}:end=${segment.originalEnd},setpts=PTS-STARTPTS[${label}]`
      );
      filters.push(
        `[0:a]atrim=start=${segment.originalStart}:end=${segment.originalEnd},asetpts=PTS-STARTPTS[${aLabel}]`
      );

      // Apply speed if not 1x
      if (segment.speedFactor !== 1) {
        const speedLabel = `v${index}s`;
        const aSpeedLabel = `a${index}s`;
        filters.push(
          `[${label}]setpts=${1 / segment.speedFactor}*PTS[${speedLabel}]`
        );
        filters.push(
          `[${aLabel}]atempo=${segment.speedFactor}[${aSpeedLabel}]`
        );
        videoLabels.push(`[${speedLabel}]`);
        audioLabels.push(`[${aSpeedLabel}]`);
      } else {
        videoLabels.push(`[${label}]`);
        audioLabels.push(`[${aLabel}]`);
      }
    });

    // Concat filter
    if (segments.length > 1) {
      filters.push(
        `${videoLabels.join("")}concat=n=${segments.length}:v=1:a=0[outv]`
      );
      filters.push(
        `${audioLabels.join("")}concat=n=${segments.length}:v=0:a=1[outa]`
      );
    }

    return {
      filter_complex: filters.join(";"),
      output_maps: segments.length > 1 ? ["-map", "[outv]", "-map", "[outa]"] : [],
    };
  }, [exportInfo.previewTimeline]);

  return {
    ...exportInfo,
    getExportSegments,
    generateFFmpegFilter,
  };
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}
