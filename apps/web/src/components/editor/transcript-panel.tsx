"use client";

import { useRef, useEffect, useMemo } from "react";
import { useAIEditorStore } from "@/stores/ai-editor-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/ui";
import { FileText, User, AlertCircle } from "lucide-react";

interface TranscriptPanelProps {
  className?: string;
  currentTime?: number;
  onSeek?: (time: number) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function TranscriptPanel({
  className,
  currentTime = 0,
  onSeek,
}: TranscriptPanelProps) {
  const { analysis, aiEdits } = useAIEditorStore();
  const activeRef = useRef<HTMLButtonElement>(null);

  // Find segments that are marked for cutting
  const cutRanges = useMemo(() => {
    return aiEdits
      .filter((edit) => edit.type === "cut")
      .map((edit) => ({ start: edit.startTime, end: edit.endTime }));
  }, [aiEdits]);

  // Check if a segment is within a cut range
  const isSegmentCut = (startTime: number, endTime: number): boolean => {
    return cutRanges.some(
      (range) =>
        (startTime >= range.start && startTime < range.end) ||
        (endTime > range.start && endTime <= range.end) ||
        (startTime <= range.start && endTime >= range.end)
    );
  };

  // Find currently active segment
  const activeSegmentId = useMemo(() => {
    if (!analysis) return null;
    const segment = analysis.transcript.find(
      (seg) => currentTime >= seg.startTime && currentTime < seg.endTime
    );
    return segment?.id || null;
  }, [analysis, currentTime]);

  // Scroll to active segment
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeSegmentId]);

  if (!analysis) {
    return (
      <div className={cn("flex flex-col gap-4 p-4", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="size-4" />
          <span className="text-sm font-medium">Transcript</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p className="text-sm">No transcript available</p>
        </div>
      </div>
    );
  }

  if (analysis.transcript.length === 0) {
    return (
      <div className={cn("flex flex-col gap-4 p-4", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="size-4" />
          <span className="text-sm font-medium">Transcript</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
          <AlertCircle className="size-8" />
          <p className="text-sm">No speech detected in video</p>
        </div>
      </div>
    );
  }

  // Group consecutive segments by speaker
  const groupedSegments = useMemo(() => {
    const groups: Array<{
      speaker: string | undefined;
      segments: typeof analysis.transcript;
    }> = [];

    let currentGroup: (typeof groups)[0] | null = null;

    for (const segment of analysis.transcript) {
      if (!currentGroup || currentGroup.speaker !== segment.speaker) {
        currentGroup = {
          speaker: segment.speaker,
          segments: [segment],
        };
        groups.push(currentGroup);
      } else {
        currentGroup.segments.push(segment);
      }
    }

    return groups;
  }, [analysis.transcript]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="size-4" />
          <span className="text-sm font-medium">Transcript</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {analysis.transcript.length} segments
          </Badge>
          {analysis.detectedSpeakers > 1 && (
            <Badge variant="outline" className="text-xs">
              {analysis.detectedSpeakers} speakers
            </Badge>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 px-4 py-2 text-xs text-muted-foreground border-b bg-muted/20">
        {analysis.fillerWordCount > 0 && (
          <span>
            {analysis.fillerWordCount} filler word
            {analysis.fillerWordCount !== 1 ? "s" : ""}
          </span>
        )}
        {analysis.silenceGapCount > 0 && (
          <span>
            {analysis.silenceGapCount} silence gap
            {analysis.silenceGapCount !== 1 ? "s" : ""}
          </span>
        )}
        {cutRanges.length > 0 && (
          <span className="text-red-500">
            {cutRanges.length} cut{cutRanges.length !== 1 ? "s" : ""} pending
          </span>
        )}
      </div>

      {/* Transcript Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {groupedSegments.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              {/* Speaker header */}
              {group.speaker && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <User className="size-3" />
                  <span className="font-medium">{group.speaker}</span>
                </div>
              )}

              {/* Segments */}
              <div className="space-y-0.5">
                {group.segments.map((segment) => {
                  const isActive = segment.id === activeSegmentId;
                  const isCut = isSegmentCut(segment.startTime, segment.endTime);

                  return (
                    <button
                      key={segment.id}
                      ref={isActive ? activeRef : null}
                      className={cn(
                        "w-full text-left px-2 py-1 rounded text-sm transition-colors",
                        "hover:bg-muted/50",
                        isActive && "bg-primary/10 border-l-2 border-primary",
                        isCut && "line-through opacity-50",
                        segment.isFiller && "text-yellow-500"
                      )}
                      onClick={() => onSeek?.(segment.startTime)}
                    >
                      <span className="text-[10px] text-muted-foreground mr-2 font-mono">
                        {formatTime(segment.startTime)}
                      </span>
                      <span
                        className={cn(
                          segment.isFiller && "bg-yellow-500/20 px-1 rounded"
                        )}
                      >
                        {segment.text}
                      </span>
                      {segment.isFiller && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-[10px] py-0 h-4 text-yellow-500 border-yellow-500/50"
                        >
                          filler
                        </Badge>
                      )}
                      {isCut && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-[10px] py-0 h-4 text-red-500 border-red-500/50"
                        >
                          cut
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
