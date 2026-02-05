"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useAIEditorStore } from "@/stores/ai-editor-store";
import { useEditor } from "@/hooks/use-editor";
import { hasElevenLabsKey } from "@/services/ai/elevenlabs";
import { CommandTerminal } from "./command-terminal";
import { AnnotationTimeline } from "./annotation-timeline";
import { TranscriptPanel } from "./transcript-panel";
import { AnalysisProgress } from "./analysis-progress";
import { AISettingsDialog } from "./dialogs/ai-settings-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/utils/ui";
import {
  Settings,
  Sparkles,
  Undo2,
  Redo2,
  Trash2,
  X,
  ChevronLeft,
  Play,
  Zap,
  FileText,
  MessageSquare,
  Mic,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface AIEditorWorkspaceProps {
  onClose: () => void;
}

export function AIEditorWorkspace({ onClose }: AIEditorWorkspaceProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("commands");
  const [hasElevenLabs, setHasElevenLabs] = useState(false);
  const editor = useEditor();

  const {
    analysis,
    isAnalyzing,
    aiEdits,
    hasApiKey: hasGoogleApiKey,
    startAnalysis,
    clearAnalysis,
    clearEdits,
    undo,
    redo,
  } = useAIEditorStore();

  const canUndo = useAIEditorStore((s) => s.undoStack.length > 0);
  const canRedo = useAIEditorStore((s) => s.redoStack.length > 0);

  // Check for API keys on mount and when settings close
  useEffect(() => {
    setHasElevenLabs(hasElevenLabsKey());
  }, [settingsOpen]);

  // Get current playhead time
  const currentTime = editor.playback.getCurrentTime();

  // Get the first video asset for AI analysis
  const videoFile = useMemo(() => {
    const assets = editor.media.getAssets();
    const videoAsset = assets.find((asset) => asset.type === "video");
    return videoAsset?.file || null;
  }, [editor.media]);

  const videoAsset = useMemo(() => {
    const assets = editor.media.getAssets();
    return assets.find((asset) => asset.type === "video");
  }, [editor.media]);

  // Check if both API keys are configured
  const hasRequiredKeys = hasGoogleApiKey && hasElevenLabs;

  // Handle seeking from AI panel
  const handleSeek = useCallback(
    (time: number) => {
      editor.playback.seek({ time });
    },
    [editor.playback]
  );

  const handleAnalyze = useCallback(async () => {
    if (videoFile) {
      await startAnalysis(videoFile);
    }
  }, [videoFile, startAnalysis]);

  // Stats for the analysis
  const stats = useMemo(() => {
    if (!analysis) return null;
    return {
      duration: analysis.duration,
      speakers: analysis.detectedSpeakers,
      fillers: analysis.fillerWordCount,
      silences: analysis.silenceGapCount,
      scenes: analysis.sceneChangeCount,
      transcriptCount: analysis.transcript.length,
      annotationCount: analysis.annotations.length,
    };
  }, [analysis]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 border-b bg-panel flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="gap-2"
          >
            <ChevronLeft className="size-4" />
            Back to Editor
          </Button>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <span className="font-semibold">AI Video Editor</span>
            {analysis && (
              <Badge variant="secondary">
                {aiEdits.length} pending {aiEdits.length === 1 ? "edit" : "edits"}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <div className="flex items-center gap-1 border-r pr-2 mr-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="size-4" />
            </Button>
          </div>

          {/* Clear edits */}
          {aiEdits.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive gap-2"
              onClick={clearEdits}
            >
              <Trash2 className="size-4" />
              Clear Edits
            </Button>
          )}

          {/* Settings */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="gap-2"
          >
            <Settings className="size-4" />
            Settings
          </Button>

          {/* Close */}
          <Button variant="ghost" size="icon" onClick={onClose} title="Close">
            <X className="size-4" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left side - Video Preview + Timeline */}
        <div className="w-1/2 border-r flex flex-col bg-black/50">
          {/* Video preview area */}
          <div className="flex-1 flex items-center justify-center p-6 min-h-0">
            {videoAsset ? (
              <div className="relative w-full max-w-4xl aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
                <video
                  src={videoAsset.url}
                  className="w-full h-full object-contain"
                  controls
                />
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <p className="text-lg">No video loaded</p>
                <p className="text-sm">Import a video in the editor first</p>
              </div>
            )}
          </div>

          {/* Annotation Timeline - below video */}
          {analysis && (
            <div className="border-t bg-panel shrink-0">
              <ScrollArea className="h-[200px]">
                <div className="p-4">
                  <AnnotationTimeline currentTime={currentTime} onSeek={handleSeek} />
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Stats bar */}
          {stats && (
            <div className="border-t bg-panel/80 p-3 shrink-0">
              <div className="flex items-center justify-center gap-6 text-sm">
                <div className="text-center">
                  <div className="text-xl font-bold text-foreground">
                    {Math.floor(stats.duration / 60)}:{String(Math.floor(stats.duration % 60)).padStart(2, "0")}
                  </div>
                  <div className="text-xs text-muted-foreground">Duration</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-500">{stats.speakers}</div>
                  <div className="text-xs text-muted-foreground">Speakers</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-yellow-500">{stats.fillers}</div>
                  <div className="text-xs text-muted-foreground">Fillers</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-orange-500">{stats.silences}</div>
                  <div className="text-xs text-muted-foreground">Silences</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-500">{stats.scenes}</div>
                  <div className="text-xs text-muted-foreground">Scenes</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right side - Commands & Transcript */}
        <div className="w-1/2 flex flex-col bg-panel">
          {/* Analysis section - shown when no analysis yet */}
          {!analysis && !isAnalyzing && (
            <div className="flex-1 flex items-center justify-center p-8">
              {!hasRequiredKeys ? (
                <div className="text-center max-w-md">
                  <div className="size-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="size-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">API Keys Required</h3>
                  <p className="text-muted-foreground mb-4">
                    AI-powered editing requires two API keys to be configured:
                  </p>
                  <div className="text-left bg-muted/50 rounded-lg p-4 mb-4 space-y-2">
                    <div className="flex items-center gap-2">
                      {hasGoogleApiKey ? (
                        <CheckCircle className="size-4 text-green-500" />
                      ) : (
                        <XCircle className="size-4 text-red-500" />
                      )}
                      <span className={hasGoogleApiKey ? "text-muted-foreground" : ""}>
                        Google AI API Key <span className="text-xs text-muted-foreground">(visual analysis)</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasElevenLabs ? (
                        <CheckCircle className="size-4 text-green-500" />
                      ) : (
                        <XCircle className="size-4 text-red-500" />
                      )}
                      <span className={hasElevenLabs ? "text-muted-foreground" : ""}>
                        ElevenLabs API Key <span className="text-xs text-muted-foreground">(audio transcription)</span>
                      </span>
                    </div>
                  </div>
                  <Button onClick={() => setSettingsOpen(true)}>
                    <Settings className="size-4 mr-2" />
                    Open Settings
                  </Button>
                </div>
              ) : !videoFile ? (
                <div className="text-center max-w-md">
                  <div className="size-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <FileText className="size-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No Video Loaded</h3>
                  <p className="text-muted-foreground mb-4">
                    Import a video file in the editor to start AI analysis.
                  </p>
                  <Button variant="outline" onClick={onClose}>
                    <ChevronLeft className="size-4 mr-2" />
                    Back to Editor
                  </Button>
                </div>
              ) : (
                <div className="text-center max-w-md">
                  <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                    <Sparkles className="size-10 text-primary" />
                  </div>
                  <h3 className="text-2xl font-semibold mb-3">Ready to Analyze</h3>
                  <p className="text-muted-foreground mb-6">
                    AI will analyze your video to detect speech patterns, silence gaps,
                    filler words, and scene changes. This enables voice commands for editing.
                  </p>
                  <Button size="lg" onClick={handleAnalyze} className="gap-2">
                    <Zap className="size-5" />
                    Start AI Analysis
                  </Button>
                  <p className="text-xs text-muted-foreground mt-4">
                    Uses Gemini 3 Flash • Analysis typically takes 30-60 seconds
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Analysis in progress */}
          {isAnalyzing && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="w-full max-w-md">
                <AnalysisProgress />
              </div>
            </div>
          )}

          {/* Analysis complete - show Commands & Transcript tabs */}
          {analysis && !isAnalyzing && (
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1 flex flex-col min-h-0"
            >
              <TabsList className="w-full justify-start rounded-none border-b px-4 h-12 shrink-0 bg-transparent">
                <TabsTrigger value="commands" className="gap-2 data-[state=active]:bg-muted">
                  <MessageSquare className="size-4" />
                  Commands
                </TabsTrigger>
                <TabsTrigger value="transcript" className="gap-2 data-[state=active]:bg-muted">
                  <FileText className="size-4" />
                  Transcript
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {analysis.transcript.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="commands" className="flex-1 m-0 overflow-hidden">
                <div className="h-full flex flex-col">
                  <CommandTerminal onSettingsClick={() => setSettingsOpen(true)} />
                </div>
              </TabsContent>

              <TabsContent value="transcript" className="flex-1 m-0 overflow-hidden">
                <TranscriptPanel currentTime={currentTime} onSeek={handleSeek} />
              </TabsContent>
            </Tabs>
          )}

          {/* Bottom action bar when analysis is complete */}
          {analysis && (
            <div className="border-t p-4 bg-background shrink-0">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    clearAnalysis();
                  }}
                  className="gap-2"
                >
                  <Trash2 className="size-4" />
                  Clear & Re-analyze
                </Button>

                <div className="flex items-center gap-2">
                  {aiEdits.length > 0 && (
                    <Button onClick={onClose} className="gap-2">
                      <Play className="size-4" />
                      Apply {aiEdits.length} Edits
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Settings Dialog */}
      <AISettingsDialog isOpen={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
