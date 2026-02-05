"use client";

import { useState, useCallback, useEffect } from "react";
import { useAIEditorStore } from "@/stores/ai-editor-store";
import { hasElevenLabsKey } from "@/services/ai/elevenlabs";
import { CommandTerminal } from "./command-terminal";
import { TranscriptPanel } from "./transcript-panel";
import { AnalysisProgress } from "./analysis-progress";
import { AISettingsDialog } from "./dialogs/ai-settings-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/ui";
import {
  Settings,
  Sparkles,
  Undo2,
  Redo2,
  Trash2,
  AlertCircle,
  CheckCircle,
  XCircle,
  MessageSquare,
  FileText,
} from "lucide-react";

interface AIEditorPanelProps {
  className?: string;
  currentTime?: number;
  onSeek?: (time: number) => void;
  videoFile?: File | null;
}

export function AIEditorPanel({
  className,
  currentTime = 0,
  onSeek,
  videoFile,
}: AIEditorPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("commands");
  const [hasElevenLabs, setHasElevenLabs] = useState(false);

  const {
    analysis,
    isAnalyzing,
    aiEdits,
    hasApiKey: hasGoogleApiKey,
    startAnalysis,
    clearEdits,
    undo,
    redo,
  } = useAIEditorStore();

  const canUndo = useAIEditorStore((s) => s.undoStack.length > 0);
  const canRedo = useAIEditorStore((s) => s.redoStack.length > 0);

  // Check for ElevenLabs API key on mount and when settings close
  useEffect(() => {
    setHasElevenLabs(hasElevenLabsKey());
  }, [settingsOpen]);

  const hasRequiredKeys = hasGoogleApiKey && hasElevenLabs;

  const handleAnalyze = useCallback(async () => {
    if (videoFile) {
      await startAnalysis(videoFile);
    }
  }, [videoFile, startAnalysis]);

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="font-medium text-sm">AI Editor</span>
          {analysis && aiEdits.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {aiEdits.length} edits
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Undo/Redo */}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={undo}
            disabled={!canUndo}
            title="Undo"
          >
            <Undo2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={redo}
            disabled={!canRedo}
            title="Redo"
          >
            <Redo2 className="size-3.5" />
          </Button>

          {/* Clear edits */}
          {aiEdits.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-red-500 hover:text-red-600"
              onClick={clearEdits}
              title="Clear all edits"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}

          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setSettingsOpen(true)}
            title="AI Settings"
          >
            <Settings className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* API Keys Required */}
      {!hasRequiredKeys && !isAnalyzing && (
        <div className="p-4 border-b">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium mb-2">API Keys Required</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  {hasGoogleApiKey ? (
                    <CheckCircle className="size-3.5 text-green-500" />
                  ) : (
                    <XCircle className="size-3.5 text-red-500" />
                  )}
                  <span className={hasGoogleApiKey ? "text-muted-foreground" : ""}>
                    Google AI (visuals)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {hasElevenLabs ? (
                    <CheckCircle className="size-3.5 text-green-500" />
                  ) : (
                    <XCircle className="size-3.5 text-red-500" />
                  )}
                  <span className={hasElevenLabs ? "text-muted-foreground" : ""}>
                    ElevenLabs (audio)
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="size-3.5 mr-2" />
                Configure Keys
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* No Video */}
      {hasRequiredKeys && !videoFile && !analysis && !isAnalyzing && (
        <div className="p-4 border-b text-center text-muted-foreground">
          <p className="text-sm">Import a video to use AI analysis</p>
        </div>
      )}

      {/* Analysis trigger */}
      {hasRequiredKeys && !analysis && !isAnalyzing && videoFile && (
        <div className="p-3 border-b">
          <Button
            onClick={handleAnalyze}
            className="w-full"
            size="sm"
          >
            <Sparkles className="size-4 mr-2" />
            Analyze Video
          </Button>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            Detects speech, fillers, silence, and scene changes
          </p>
        </div>
      )}

      {/* Analysis progress */}
      {isAnalyzing && (
        <div className="p-3 border-b">
          <AnalysisProgress />
        </div>
      )}

      {/* Main content - Commands & Transcript */}
      <div className="flex-1 overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="h-full flex flex-col"
        >
          <TabsList className="w-full justify-start rounded-none border-b px-2 h-9 bg-transparent">
            <TabsTrigger value="commands" className="text-xs gap-1.5 data-[state=active]:bg-muted">
              <MessageSquare className="size-3.5" />
              Commands
            </TabsTrigger>
            <TabsTrigger value="transcript" className="text-xs gap-1.5 data-[state=active]:bg-muted">
              <FileText className="size-3.5" />
              Transcript
              {analysis && analysis.transcript.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 text-[10px] px-1 py-0 h-4"
                >
                  {analysis.transcript.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="commands" className="flex-1 m-0 overflow-auto">
            <CommandTerminal onSettingsClick={() => setSettingsOpen(true)} />
          </TabsContent>

          <TabsContent value="transcript" className="flex-1 m-0 overflow-hidden">
            <TranscriptPanel currentTime={currentTime} onSeek={onSeek} />
          </TabsContent>
        </Tabs>
      </div>

      {/* AI Settings Dialog */}
      <AISettingsDialog isOpen={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
