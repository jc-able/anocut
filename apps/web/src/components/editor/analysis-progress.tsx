"use client";

import { useAIEditorStore } from "@/stores/ai-editor-store";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Film,
  Sparkles,
  FileSearch,
  Mic,
  Upload,
} from "lucide-react";

interface AnalysisProgressProps {
  className?: string;
}

const STAGE_ICONS: Record<string, React.ReactNode> = {
  idle: <Film className="size-5" />,
  extracting: <FileSearch className="size-5 animate-pulse" />,
  uploading: <Upload className="size-5 animate-pulse" />,
  transcribing: <Mic className="size-5 animate-pulse" />,
  analyzing: <Sparkles className="size-5 animate-pulse" />,
  complete: <CheckCircle className="size-5 text-green-500" />,
  error: <XCircle className="size-5 text-red-500" />,
};

const STAGE_LABELS: Record<string, string> = {
  idle: "Ready to analyze",
  extracting: "Extracting frames...",
  uploading: "Uploading...",
  transcribing: "Transcribing audio with ElevenLabs...",
  analyzing: "AI analyzing visuals...",
  complete: "Analysis complete",
  error: "Analysis failed",
};

export function AnalysisProgress({ className }: AnalysisProgressProps) {
  const { isAnalyzing, analysisProgress, analysisError, clearAnalysis } =
    useAIEditorStore();

  const { stage, progress, message } = analysisProgress;

  if (stage === "idle") {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        stage === "error" && "border-red-500/50 bg-red-500/5",
        stage === "complete" && "border-green-500/50 bg-green-500/5",
        stage === "transcribing" && "border-blue-500/50 bg-blue-500/5",
        (stage === "extracting" || stage === "analyzing" || stage === "uploading") &&
          "border-primary/50 bg-primary/5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{STAGE_ICONS[stage] || <Loader2 className="size-5 animate-spin" />}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-sm">{STAGE_LABELS[stage] || stage}</p>
            {isAnalyzing && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {message && (
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          )}

          {(stage === "extracting" || stage === "analyzing" || stage === "transcribing" || stage === "uploading") && (
            <Progress value={progress} className="mt-2 h-1" />
          )}

          {stage === "error" && analysisError && (
            <p className="text-sm text-red-500 mt-1">{analysisError}</p>
          )}

          {stage === "complete" && (
            <div className="flex gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={clearAnalysis}
              >
                Clear & Re-analyze
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
