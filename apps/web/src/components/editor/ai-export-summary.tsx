"use client";

import { useAIExport, formatDuration } from "@/hooks/use-ai-export";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/utils/ui";
import { Sparkles, Scissors, Clock, TrendingDown } from "lucide-react";

interface AIExportSummaryProps {
  className?: string;
  includeAIEdits: boolean;
  onIncludeAIEditsChange: (include: boolean) => void;
}

export function AIExportSummary({
  className,
  includeAIEdits,
  onIncludeAIEditsChange,
}: AIExportSummaryProps) {
  const {
    hasEdits,
    cutCount,
    totalCutDuration,
    originalDuration,
    newDuration,
    savedPercentage,
  } = useAIExport();

  if (!hasEdits) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/30 p-3 space-y-3",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-medium">AI Edits</span>
          <Badge variant="secondary" className="text-xs">
            {cutCount} cut{cutCount !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <Clock className="size-3 text-muted-foreground" />
          <span className="text-muted-foreground">Original:</span>
          <span>{formatDuration(originalDuration)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Scissors className="size-3 text-muted-foreground" />
          <span className="text-muted-foreground">Cut:</span>
          <span className="text-red-500">-{formatDuration(totalCutDuration)}</span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingDown className="size-3 text-muted-foreground" />
          <span className="text-muted-foreground">New:</span>
          <span className="text-green-500">{formatDuration(newDuration)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Saved:</span>
          <span className="text-green-500">{savedPercentage.toFixed(1)}%</span>
        </div>
      </div>

      {/* Include toggle */}
      <div className="flex items-center space-x-2 pt-1 border-t">
        <Checkbox
          id="include-ai-edits"
          checked={includeAIEdits}
          onCheckedChange={(checked) => onIncludeAIEditsChange(!!checked)}
        />
        <Label
          htmlFor="include-ai-edits"
          className="text-xs cursor-pointer"
        >
          Apply AI edits to export
        </Label>
      </div>

      {!includeAIEdits && (
        <p className="text-[10px] text-muted-foreground">
          AI edits will be ignored. Original video will be exported.
        </p>
      )}
    </div>
  );
}

/**
 * Compact version for the export button area
 */
export function AIEditsBadge() {
  const { hasEdits, cutCount, savedPercentage } = useAIExport();

  if (!hasEdits) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Sparkles className="size-3" />
      <span>
        {cutCount} AI cut{cutCount !== 1 ? "s" : ""} ({savedPercentage.toFixed(0)}% shorter)
      </span>
    </div>
  );
}
