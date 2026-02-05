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
import { cn } from "@/utils/ui";
import { useEditor } from "@/hooks/use-editor";

interface AIAnnotationsTrackProps {
  zoomLevel: number;
  dynamicTimelineWidth: number;
}

const ANNOTATION_COLORS: Record<string, string> = {
  talking: "bg-blue-500",
  silence: "bg-gray-400",
  filler: "bg-yellow-500",
  scene: "bg-purple-500",
  music: "bg-green-500",
  noise: "bg-orange-500",
};

const ANNOTATION_LABELS: Record<string, string> = {
  talking: "Speech",
  silence: "Silence",
  filler: "Filler",
  scene: "Scene",
  music: "Music",
  noise: "Noise",
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * AI Annotations Track
 * Shows detected annotations (talking, silence, fillers, scene changes) in the timeline header
 */
export function AIAnnotationsTrack({
  zoomLevel,
  dynamicTimelineWidth,
}: AIAnnotationsTrackProps) {
  const analysis = useAIEditorStore((s) => s.analysis);
  const editor = useEditor();

  // Group annotations by type for stacked display
  const annotationTypes = useMemo(() => {
    if (!analysis) return [];
    const types = new Set(analysis.annotations.map((a) => a.type));
    // Order: scene, talking, filler, silence (most useful at top)
    const order = ["scene", "talking", "filler", "silence", "music", "noise"];
    return order.filter((t) => types.has(t));
  }, [analysis]);

  const handleSeek = (time: number) => {
    editor.playback.seek({ time });
  };

  if (!analysis || analysis.annotations.length === 0) {
    return null;
  }

  return (
    <div
      className="relative border-b bg-muted/10"
      style={{ width: `${dynamicTimelineWidth}px` }}
    >
      {/* Compact stacked tracks */}
      {annotationTypes.map((type) => {
        const typeAnnotations = analysis.annotations.filter(
          (a) => a.type === type
        );
        if (typeAnnotations.length === 0) return null;

        return (
          <div
            key={type}
            className="relative h-3 border-b border-border/30 last:border-b-0"
          >
            {/* Track label on left (overlaid) */}
            <div className="absolute left-1 top-0 bottom-0 flex items-center z-10 pointer-events-none">
              <span className="text-[9px] text-muted-foreground/70 font-medium uppercase tracking-wider">
                {ANNOTATION_LABELS[type] || type}
              </span>
            </div>

            {/* Annotation segments */}
            {typeAnnotations.map((annotation) => {
              const left =
                annotation.startTime *
                TIMELINE_CONSTANTS.PIXELS_PER_SECOND *
                zoomLevel;
              const width =
                (annotation.endTime - annotation.startTime) *
                TIMELINE_CONSTANTS.PIXELS_PER_SECOND *
                zoomLevel;

              return (
                <TooltipProvider key={annotation.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className={cn(
                          "absolute top-0 h-full cursor-pointer opacity-50 hover:opacity-80 transition-opacity",
                          ANNOTATION_COLORS[type] || "bg-gray-500"
                        )}
                        style={{
                          left: `${left}px`,
                          width: `${Math.max(width, 2)}px`,
                        }}
                        onClick={() => handleSeek(annotation.startTime)}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      <p className="font-medium capitalize">{type}</p>
                      {annotation.label && (
                        <p className="text-muted-foreground">
                          {annotation.label}
                        </p>
                      )}
                      <p className="text-muted-foreground">
                        {formatTime(annotation.startTime)} -{" "}
                        {formatTime(annotation.endTime)}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
