"use client";

import { useMemo } from "react";
import { useAIEditorStore } from "@/stores/ai-editor-store";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { EditDecision } from "@/types/ai";

interface AICutPreviewProps {
  zoomLevel: number;
  trackHeight: number;
  trackTop: number;
  className?: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
}

function CutMarker({
  edit,
  zoomLevel,
  trackHeight,
  trackTop,
}: {
  edit: EditDecision;
  zoomLevel: number;
  trackHeight: number;
  trackTop: number;
}) {
  const left =
    edit.startTime * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel;
  const width =
    (edit.endTime - edit.startTime) *
    TIMELINE_CONSTANTS.PIXELS_PER_SECOND *
    zoomLevel;

  const getEditStyle = () => {
    switch (edit.type) {
      case "cut":
        return {
          bg: "bg-red-500/30",
          border: "border-red-500",
          pattern: "bg-stripes-red",
        };
      case "speed":
        return {
          bg: "bg-cyan-500/30",
          border: "border-cyan-500",
          pattern: "",
        };
      case "audio":
        return {
          bg: "bg-teal-500/30",
          border: "border-teal-500",
          pattern: "",
        };
      default:
        return {
          bg: "bg-yellow-500/30",
          border: "border-yellow-500",
          pattern: "",
        };
    }
  };

  const style = getEditStyle();
  const reason = (edit.params?.reason as string) || edit.type;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "absolute pointer-events-auto cursor-pointer",
              "border-l-2 border-r-2 border-dashed",
              style.bg,
              style.border,
              "transition-opacity hover:opacity-100 opacity-70"
            )}
            style={{
              left: `${left}px`,
              width: `${Math.max(width, 2)}px`,
              top: `${trackTop}px`,
              height: `${trackHeight}px`,
            }}
          >
            {/* Diagonal stripes pattern for cuts */}
            {edit.type === "cut" && (
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage: `repeating-linear-gradient(
                    45deg,
                    transparent,
                    transparent 4px,
                    rgba(239, 68, 68, 0.4) 4px,
                    rgba(239, 68, 68, 0.4) 8px
                  )`,
                }}
              />
            )}
            {/* Center label for wider segments */}
            {width > 40 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-medium text-white/80 uppercase tracking-wide">
                  {edit.type}
                </span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium capitalize">{edit.type}</p>
          <p className="text-muted-foreground capitalize">{reason}</p>
          <p className="text-muted-foreground">
            {formatTime(edit.startTime)} - {formatTime(edit.endTime)}
          </p>
          <p className="text-muted-foreground">
            Duration: {(edit.endTime - edit.startTime).toFixed(1)}s
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * AI Cut Preview Overlay
 * Shows pending AI edit decisions as visual overlays on the timeline
 */
export function AICutPreview({
  zoomLevel,
  trackHeight,
  trackTop,
  className,
}: AICutPreviewProps) {
  const aiEdits = useAIEditorStore((s) => s.aiEdits);

  // Filter to only show cut-type edits for the preview
  const cutEdits = useMemo(() => {
    return aiEdits.filter(
      (edit) => edit.type === "cut" || edit.type === "speed" || edit.type === "audio"
    );
  }, [aiEdits]);

  if (cutEdits.length === 0) {
    return null;
  }

  return (
    <div className={cn("absolute inset-0 pointer-events-none z-20", className)}>
      {cutEdits.map((edit) => (
        <CutMarker
          key={edit.id}
          edit={edit}
          zoomLevel={zoomLevel}
          trackHeight={trackHeight}
          trackTop={trackTop}
        />
      ))}
    </div>
  );
}

/**
 * AI Edit Summary Bar
 * Shows a summary bar at the top of the timeline with all pending edits
 */
export function AIEditSummaryBar({
  zoomLevel,
  dynamicTimelineWidth,
}: {
  zoomLevel: number;
  dynamicTimelineWidth: number;
}) {
  const aiEdits = useAIEditorStore((s) => s.aiEdits);
  const analysis = useAIEditorStore((s) => s.analysis);

  if (aiEdits.length === 0 || !analysis) {
    return null;
  }

  const duration = analysis.duration;

  return (
    <div
      className="relative h-2 bg-muted/20 border-b"
      style={{ width: `${dynamicTimelineWidth}px` }}
    >
      {aiEdits.map((edit) => {
        const left =
          edit.startTime * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel;
        const width =
          (edit.endTime - edit.startTime) *
          TIMELINE_CONSTANTS.PIXELS_PER_SECOND *
          zoomLevel;

        const bgColor =
          edit.type === "cut"
            ? "bg-red-500"
            : edit.type === "speed"
              ? "bg-cyan-500"
              : edit.type === "audio"
                ? "bg-teal-500"
                : "bg-yellow-500";

        return (
          <TooltipProvider key={edit.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "absolute top-0 h-full cursor-pointer opacity-60 hover:opacity-100",
                    bgColor
                  )}
                  style={{
                    left: `${left}px`,
                    width: `${Math.max(width, 2)}px`,
                  }}
                />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="capitalize">{edit.type}</p>
                <p className="text-muted-foreground">
                  {formatTime(edit.startTime)} - {formatTime(edit.endTime)}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}
