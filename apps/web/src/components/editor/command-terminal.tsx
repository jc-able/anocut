"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAIEditorStore } from "@/stores/ai-editor-store";
import { QUICK_COMMANDS } from "@/services/ai/command-interpreter";
import {
  Send,
  Loader2,
  Sparkles,
  Terminal,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  Scissors,
  Clock,
  MessageSquare,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VoiceCommandButton, VoiceRecordingIndicator } from "./voice-command-button";
import { useVoiceCommand } from "@/hooks/use-voice-command";

interface CommandTerminalProps {
  className?: string;
  onSettingsClick?: () => void;
}

export function CommandTerminal({
  className,
  onSettingsClick,
}: CommandTerminalProps) {
  const {
    analysis,
    isProcessingCommand,
    lastCommandResult,
    commandHistory,
    hasApiKey,
    executeCommand,
  } = useAIEditorStore();

  const [inputValue, setInputValue] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!inputValue.trim() || isProcessingCommand) return;

    const command = inputValue.trim();
    setInputValue("");
    setHistoryIndex(-1);

    await executeCommand(command);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputValue("");
      }
    }
  };

  const handleQuickCommand = async (command: string) => {
    if (isProcessingCommand) return;
    await executeCommand(command);
  };

  const getEditTypeIcon = (type: string) => {
    switch (type) {
      case "cut":
        return <Scissors className="size-3" />;
      case "speed":
        return <Clock className="size-3" />;
      case "caption":
        return <MessageSquare className="size-3" />;
      case "audio":
        return <Volume2 className="size-3" />;
      default:
        return <Sparkles className="size-3" />;
    }
  };

  // No API key configured
  if (!hasApiKey) {
    return (
      <div className={cn("flex flex-col gap-4 p-4", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Terminal className="size-4" />
          <span className="text-sm font-medium">AI Command Terminal</span>
        </div>
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
          <Sparkles className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-3">
            Configure your Google AI API key to enable voice-driven editing
          </p>
          <Button variant="outline" size="sm" onClick={onSettingsClick}>
            Configure AI Settings
          </Button>
        </div>
      </div>
    );
  }

  // No video analyzed yet
  if (!analysis) {
    return (
      <div className={cn("flex flex-col gap-4 p-4", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Terminal className="size-4" />
          <span className="text-sm font-medium">AI Command Terminal</span>
        </div>
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
          <Sparkles className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Import and analyze a video to start using AI commands
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3 p-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Terminal className="size-4" />
          <span className="text-sm font-medium">AI Command Terminal</span>
        </div>
        {analysis && (
          <Badge variant="outline" className="text-xs">
            {analysis.duration.toFixed(1)}s analyzed
          </Badge>
        )}
      </div>

      {/* Quick Commands */}
      <div className="flex flex-wrap gap-2">
        {QUICK_COMMANDS.map((qc) => (
          <Button
            key={qc.id}
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={isProcessingCommand}
            onClick={() => handleQuickCommand(qc.command)}
            title={qc.description}
          >
            {qc.label}
          </Button>
        ))}
      </div>

      {/* Command Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            placeholder="Type or speak a command..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessingCommand}
            className="pr-8"
          />
          {commandHistory.length > 0 && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col">
              <ChevronUp className="size-3 text-muted-foreground" />
              <ChevronDown className="size-3 text-muted-foreground" />
            </div>
          )}
        </div>
        <VoiceCommandButton
          onTranscript={(text) => {
            setInputValue(text);
            // Auto-submit voice commands
            if (text.trim()) {
              executeCommand(text.trim());
              setInputValue("");
            }
          }}
          disabled={isProcessingCommand}
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={isProcessingCommand || !inputValue.trim()}
        >
          {isProcessingCommand ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>

      {/* Last Command Result */}
      {lastCommandResult && (
        <div
          className={cn(
            "rounded-lg border p-3 text-sm",
            lastCommandResult.success
              ? "border-green-500/30 bg-green-500/5"
              : "border-red-500/30 bg-red-500/5"
          )}
        >
          <div className="flex items-start gap-2">
            {lastCommandResult.success ? (
              <Check className="size-4 text-green-500 mt-0.5 shrink-0" />
            ) : (
              <X className="size-4 text-red-500 mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">
                {lastCommandResult.interpretation}
              </p>
              {lastCommandResult.error && (
                <p className="text-red-500 text-xs mt-1">
                  {lastCommandResult.error}
                </p>
              )}
              {lastCommandResult.edits.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {lastCommandResult.edits.slice(0, 5).map((edit) => (
                    <Badge
                      key={edit.id}
                      variant="secondary"
                      className="text-xs flex items-center gap-1"
                    >
                      {getEditTypeIcon(edit.type)}
                      {edit.type} {edit.startTime.toFixed(1)}s-
                      {edit.endTime.toFixed(1)}s
                    </Badge>
                  ))}
                  {lastCommandResult.edits.length > 5 && (
                    <Badge variant="secondary" className="text-xs">
                      +{lastCommandResult.edits.length - 5} more
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Command History */}
      {commandHistory.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-muted-foreground mb-2">Recent commands:</p>
          <ScrollArea className="h-20">
            <div className="space-y-1">
              {commandHistory.slice(0, 10).map((cmd, idx) => (
                <button
                  key={idx}
                  className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/50 truncate"
                  onClick={() => setInputValue(cmd)}
                >
                  {cmd}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
