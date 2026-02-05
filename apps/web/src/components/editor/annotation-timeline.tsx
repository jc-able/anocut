"use client";

import { useMemo } from "react";
import { useAIEditorStore } from "@/stores/ai-editor-store";
import type { Annotation, EditDecision } from "@/types/ai";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AnnotationTimelineProps {
  className?: string;
  currentTime?: number;
  onSeek?: (time: number) => void;
}

const ANNOTATION_COLORS: Record<string, { bg: string; border: string }> = {
  talking: { bg: "bg-blue-500/30", border: "border-blue-500" },
  silence: { bg: "bg-gray-500/30", border: "border-gray-500" },
  filler: { bg: "bg-yellow-500/30", border: "border-yellow-500" },
  scene: { bg: "bg-purple-500/30", border: "border-purple-500" },
  music: { bg: "bg-green-500/30", border: "border-green-500" },
  noise: { bg: "bg-orange-500/30", border: "border-orange-500" },
};

const EDIT_COLORS: Record<string, { bg: string; border: string }> = {
  cut: { bg: "bg-red-500/40", border: "border-red-500" },
  keep: { bg: "bg-green-500/40", border: "border-green-500" },
  speed: { bg: "bg-cyan-500/40", border: "border-cyan-500" },
  caption: { bg: "bg-pink-500/40", border: "border-pink-500" },
  zoom: { bg: "bg-indigo-500/40", border: "border-indigo-500" },
  audio: { bg: "bg-teal-500/40", border: "border-teal-500" },
};

interface TimelineSegmentProps {
  startTime: number;
  endTime: number;
  duration: number;
  colors: { bg: string; border: string };
  label: string;
  type: string;
  onClick?: () => void;
}

function TimelineSegment({
  startTime,
  endTime,
  duration,
  colors,
  label,
  type,
  onClick,
}: TimelineSegmentProps) {
  const left = (startTime / duration) * 100;
  const width = ((endTime - startTime) / duration) * 100;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              "absolute h-full border-l border-r transition-opacity hover:opacity-100",
              colors.bg,
              colors.border,
              "opacity-70"
            )}
            style={{
              left: `${left}%`,
              width: `${Math.max(width, 0.5)}%`,
            }}
            onClick={onClick}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium capitalize">{type}</p>
          {label && <p className="text-muted-foreground">{label}</p>}
          <p className="text-muted-foreground">
            {formatTime(startTime)} - {formatTime(endTime)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
}

export function AnnotationTimeline({
  className,
  currentTime = 0,
  onSeek,
}: AnnotationTimelineProps) {
  const { analysis, aiEdits } = useAIEditorStore();

  // Group annotations by type for layered display
  const groupedAnnotations = useMemo(() => {
    if (!analysis) return {};

    const groups: Record<string, Annotation[]> = {};
    for (const annotation of analysis.annotations) {
      if (!groups[annotation.type]) {
        groups[annotation.type] = [];
      }
      groups[annotation.type].push(annotation);
    }
    return groups;
  }, [analysis]);

  const annotationTypes = Object.keys(groupedAnnotations);

  if (!analysis) {
    return (
      <div className={cn("p-4 text-center text-muted-foreground", className)}>
        <p className="text-sm">No video analysis available</p>
      </div>
    );
  }

  const duration = analysis.duration;
  const playheadPosition = (currentTime / duration) * 100;

  return (
    <div className={cn("flex flex-col gap-2 p-4", className)}>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs mb-2">
        <span className="text-muted-foreground font-medium">Annotations:</span>
        {annotationTypes.map((type) => (
          <div key={type} className="flex items-center gap-1">
            <div
              className={cn(
                "size-2 rounded-sm",
                ANNOTATION_COLORS[type]?.bg || "bg-gray-500/30"
              )}
            />
            <span className="capitalize text-muted-foreground">{type}</span>
            <span className="text-muted-foreground/60">
              ({groupedAnnotations[type].length})
            </span>
          </div>
        ))}
      </div>

      {/* Annotation Tracks */}
      <div className="space-y-1">
        {annotationTypes.map((type) => (
          <div key={type} className="flex items-center gap-2">
            <span className="w-16 text-xs text-muted-foreground capitalize truncate">
              {type}
            </span>
            <div className="relative flex-1 h-4 bg-muted/30 rounded">
              {groupedAnnotations[type].map((annotation) => (
                <TimelineSegment
                  key={annotation.id}
                  startTime={annotation.startTime}
                  endTime={annotation.endTime}
                  duration={duration}
                  colors={ANNOTATION_COLORS[type] || ANNOTATION_COLORS.noise}
                  label={annotation.label || ""}
                  type={type}
                  onClick={() => onSeek?.(annotation.startTime)}
                />
              ))}
              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
                style={{ left: `${playheadPosition}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* AI Edits Track */}
      {aiEdits.length > 0 && (
        <>
          <div className="flex flex-wrap gap-3 text-xs mt-4 mb-2">
            <span className="text-muted-foreground font-medium">AI Edits:</span>
            {Array.from(new Set(aiEdits.map((e) => e.type))).map((type) => (
              <div key={type} className="flex items-center gap-1">
                <div
                  className={cn(
                    "size-2 rounded-sm",
                    EDIT_COLORS[type]?.bg || "bg-gray-500/30"
                  )}
                />
                <span className="capitalize text-muted-foreground">{type}</span>
                <span className="text-muted-foreground/60">
                  ({aiEdits.filter((e) => e.type === type).length})
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="w-16 text-xs text-muted-foreground">Edits</span>
            <div className="relative flex-1 h-6 bg-muted/30 rounded">
              {aiEdits.map((edit) => (
                <TimelineSegment
                  key={edit.id}
                  startTime={edit.startTime}
                  endTime={edit.endTime}
                  duration={duration}
                  colors={EDIT_COLORS[edit.type] || EDIT_COLORS.cut}
                  label={edit.params?.reason as string || ""}
                  type={edit.type}
                  onClick={() => onSeek?.(edit.startTime)}
                />
              ))}
              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
                style={{ left: `${playheadPosition}%` }}
              />
            </div>
          </div>
        </>
      )}

      {/* Time ruler */}
      <div className="flex items-center gap-2 mt-2">
        <span className="w-16" />
        <div className="relative flex-1 h-4">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <div
              key={ratio}
              className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
              style={{ left: `${ratio * 100}%` }}
            >
              {formatTime(ratio * duration)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
