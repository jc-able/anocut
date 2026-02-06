"use client";

import { useRef, useEffect, useMemo } from "react";
import { useAIEditorStore } from "@/stores/ai-editor-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/ui";
import { FileText, User, AlertCircle } from "lucide-react";
import type { TranscriptWord } from "@/types/ai";

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

// Check if a word is currently being spoken
function isWordActive(word: TranscriptWord, currentTime: number): boolean {
  return currentTime >= word.startTime && currentTime < word.endTime;
}

// Word component with click-to-seek and highlight
function Word({
  word,
  isActive,
  isCut,
  onSeek,
}: {
  word: TranscriptWord;
  isActive: boolean;
  isCut: boolean;
  onSeek?: (time: number) => void;
}) {
  return (
    <span
      className={cn(
        "cursor-pointer transition-all duration-100 rounded-sm px-0.5 -mx-0.5",
        "hover:bg-muted/50",
        isActive && "bg-primary/30 font-medium",
        isCut && "line-through opacity-40"
      )}
      onClick={(e) => {
        e.stopPropagation();
        onSeek?.(word.startTime);
      }}
    >
      {word.word}
    </span>
  );
}

export function TranscriptPanel({
  className,
  currentTime = 0,
  onSeek,
}: TranscriptPanelProps) {
  const { analysis, aiEdits } = useAIEditorStore();
  const activeRef = useRef<HTMLDivElement>(null);

  // Find segments that are marked for cutting
  const cutRanges = useMemo(() => {
    return aiEdits
      .filter((edit) => edit.type === "cut")
      .map((edit) => ({ start: edit.startTime, end: edit.endTime }));
  }, [aiEdits]);

  // Check if a time range is within a cut range
  const isTimeCut = (startTime: number, endTime: number): boolean => {
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
      <div className="flex items-center justify-between p-3 border-b">
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
      <div className="flex gap-3 px-3 py-1.5 text-[10px] text-muted-foreground border-b bg-muted/20">
        {analysis.fillerWordCount > 0 && (
          <span>
            {analysis.fillerWordCount} filler{analysis.fillerWordCount !== 1 ? "s" : ""}
          </span>
        )}
        {analysis.silenceGapCount > 0 && (
          <span>
            {analysis.silenceGapCount} silence{analysis.silenceGapCount !== 1 ? "s" : ""}
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
        <div className="p-3 space-y-3">
          {groupedSegments.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              {/* Speaker header */}
              {group.speaker && (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
                  <User className="size-3" />
                  <span className="font-medium">{group.speaker}</span>
                </div>
              )}

              {/* Segments */}
              <div className="space-y-0.5">
                {group.segments.map((segment) => {
                  const isActive = segment.id === activeSegmentId;
                  const isSegmentCut = isTimeCut(segment.startTime, segment.endTime);
                  const hasWords = segment.words && segment.words.length > 0;

                  return (
                    <div
                      key={segment.id}
                      ref={isActive ? activeRef : null}
                      className={cn(
                        "px-2 py-1.5 rounded text-sm transition-colors",
                        isActive && "bg-primary/5 border-l-2 border-primary",
                        isSegmentCut && "opacity-50",
                        segment.isFiller && "border-l-2 border-yellow-500"
                      )}
                    >
                      {/* Timestamp */}
                      <span
                        className="text-[10px] text-muted-foreground mr-2 font-mono cursor-pointer hover:text-foreground"
                        onClick={() => onSeek?.(segment.startTime)}
                      >
                        {formatTime(segment.startTime)}
                      </span>

                      {/* Words with individual highlighting */}
                      {hasWords ? (
                        <span className="leading-relaxed">
                          {segment.words!.map((word, wordIdx) => {
                            const wordIsActive = isWordActive(word, currentTime);
                            const wordIsCut = isTimeCut(word.startTime, word.endTime);

                            return (
                              <span key={`${segment.id}-${wordIdx}`}>
                                <Word
                                  word={word}
                                  isActive={wordIsActive}
                                  isCut={wordIsCut}
                                  onSeek={onSeek}
                                />
                                {wordIdx < segment.words!.length - 1 && " "}
                              </span>
                            );
                          })}
                        </span>
                      ) : (
                        // Fallback: show segment text without word-level highlighting
                        <span
                          className={cn(
                            "cursor-pointer hover:text-foreground",
                            isSegmentCut && "line-through",
                            segment.isFiller && "text-yellow-600"
                          )}
                          onClick={() => onSeek?.(segment.startTime)}
                        >
                          {segment.text}
                        </span>
                      )}

                      {/* Filler badge */}
                      {segment.isFiller && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-[9px] py-0 h-3.5 text-yellow-600 border-yellow-500/50"
                        >
                          filler
                        </Badge>
                      )}

                      {/* Cut badge */}
                      {isSegmentCut && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-[9px] py-0 h-3.5 text-red-500 border-red-500/50"
                        >
                          cut
                        </Badge>
                      )}
                    </div>
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
