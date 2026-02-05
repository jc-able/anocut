"use client";

import { useState, useCallback } from "react";
import { useAIEditorStore } from "@/stores/ai-editor-store";
import { CommandTerminal } from "./command-terminal";
import { AnnotationTimeline } from "./annotation-timeline";
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
  Play,
  Upload,
} from "lucide-react";

interface AIEditorPanelProps {
  className?: string;
  currentTime?: number;
  onSeek?: (time: number) => void;
  onAnalyzeVideo?: (file: File) => void;
  videoFile?: File | null;
}

export function AIEditorPanel({
  className,
  currentTime = 0,
  onSeek,
  onAnalyzeVideo,
  videoFile,
}: AIEditorPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("commands");

  const {
    analysis,
    isAnalyzing,
    aiEdits,
    hasApiKey,
    startAnalysis,
    clearEdits,
    undo,
    redo,
  } = useAIEditorStore();

  const canUndo = useAIEditorStore((s) => s.undoStack.length > 0);
  const canRedo = useAIEditorStore((s) => s.redoStack.length > 0);

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
          {analysis && (
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
            className="size-8"
            onClick={undo}
            disabled={!canUndo}
            title="Undo"
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={redo}
            disabled={!canRedo}
            title="Redo"
          >
            <Redo2 className="size-4" />
          </Button>

          {/* Clear edits */}
          {aiEdits.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-red-500 hover:text-red-600"
              onClick={clearEdits}
              title="Clear all edits"
            >
              <Trash2 className="size-4" />
            </Button>
          )}

          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setSettingsOpen(true)}
            title="AI Settings"
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </div>

      {/* Analysis status/trigger */}
      {hasApiKey && !analysis && !isAnalyzing && videoFile && (
        <div className="p-4 border-b">
          <Button
            onClick={handleAnalyze}
            className="w-full"
            variant="outline"
          >
            <Sparkles className="size-4 mr-2" />
            Analyze Video with AI
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            AI will detect speech, silence, filler words, and scene changes
          </p>
        </div>
      )}

      {/* Analysis progress */}
      {(isAnalyzing || analysis) && (
        <div className="p-3 border-b">
          <AnalysisProgress />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="h-full flex flex-col"
        >
          <TabsList className="w-full justify-start rounded-none border-b px-2 h-10">
            <TabsTrigger value="commands" className="text-xs">
              Commands
            </TabsTrigger>
            <TabsTrigger value="transcript" className="text-xs">
              Transcript
              {analysis && analysis.transcript.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 text-[10px] px-1 py-0"
                >
                  {analysis.transcript.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs">
              Timeline
              {analysis && analysis.annotations.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 text-[10px] px-1 py-0"
                >
                  {analysis.annotations.length}
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

          <TabsContent value="timeline" className="flex-1 m-0 overflow-auto">
            <AnnotationTimeline currentTime={currentTime} onSeek={onSeek} />
          </TabsContent>
        </Tabs>
      </div>

      {/* AI Settings Dialog */}
      <AISettingsDialog isOpen={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
