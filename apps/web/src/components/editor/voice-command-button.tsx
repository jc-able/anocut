"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVoiceCommand } from "@/hooks/use-voice-command";
import { cn } from "@/lib/utils";
import { Mic, MicOff, Loader2 } from "lucide-react";

interface VoiceCommandButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceCommandButton({
  onTranscript,
  disabled = false,
  className,
}: VoiceCommandButtonProps) {
  const handleTranscript = useCallback(
    (text: string) => {
      onTranscript(text);
    },
    [onTranscript]
  );

  const { status, isRecording, error, startRecording, stopRecording } =
    useVoiceCommand({
      onTranscript: handleTranscript,
    });

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const getIcon = () => {
    switch (status) {
      case "requesting":
      case "transcribing":
        return <Loader2 className="size-4 animate-spin" />;
      case "recording":
        return <Mic className="size-4 text-red-500 animate-pulse" />;
      case "error":
        return <MicOff className="size-4 text-red-500" />;
      default:
        return <Mic className="size-4" />;
    }
  };

  const getTooltipContent = () => {
    switch (status) {
      case "requesting":
        return "Requesting microphone access...";
      case "recording":
        return "Recording... Click to stop";
      case "transcribing":
        return "Transcribing...";
      case "error":
        return error || "Error occurred";
      default:
        return "Click to speak a command";
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isRecording ? "destructive" : "outline"}
            size="icon"
            onClick={handleClick}
            disabled={disabled || status === "requesting" || status === "transcribing"}
            className={cn(
              "relative",
              isRecording && "ring-2 ring-red-500 ring-offset-2 ring-offset-background",
              className
            )}
          >
            {getIcon()}
            {isRecording && (
              <span className="absolute -top-1 -right-1 flex size-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-3 bg-red-500" />
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Inline voice indicator for showing recording status
 */
export function VoiceRecordingIndicator({
  isRecording,
  className,
}: {
  isRecording: boolean;
  className?: string;
}) {
  if (!isRecording) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs text-red-500",
        className
      )}
    >
      <span className="flex size-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full size-2 bg-red-500" />
      </span>
      <span className="animate-pulse">Listening...</span>
    </div>
  );
}
