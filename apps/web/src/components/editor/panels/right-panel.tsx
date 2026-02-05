"use client";

import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropertiesPanel } from "./properties";
import { AIEditorPanel } from "../ai-editor-panel";
import { useAIEditorStore } from "@/stores/ai-editor-store";
import { usePanelStore } from "@/stores/panel-store";
import { useEditor } from "@/hooks/use-editor";
import { Badge } from "@/components/ui/badge";
import { Settings, Sparkles } from "lucide-react";

export function RightPanel() {
  const { rightPanelTab, setRightPanelTab } = usePanelStore();
  const aiEdits = useAIEditorStore((s) => s.aiEdits);
  const editor = useEditor();

  // Get current playhead time for AI panel
  const currentTime = editor.playback.getCurrentTime();

  // Get the first video asset for AI analysis
  const videoFile = useMemo(() => {
    const assets = editor.media.getAssets();
    const videoAsset = assets.find((asset) => asset.type === "video");
    return videoAsset?.file || null;
  }, [editor.media]);

  // Handle seeking from AI panel
  const handleSeek = (time: number) => {
    editor.playback.seek({ time });
  };

  return (
    <div className="bg-panel flex h-full flex-col rounded-sm overflow-hidden">
      <Tabs
        value={rightPanelTab}
        onValueChange={(v) => setRightPanelTab(v as "properties" | "ai")}
        className="flex h-full flex-col"
      >
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-2 h-10 shrink-0">
          <TabsTrigger
            value="properties"
            className="text-xs gap-1.5 data-[state=active]:bg-muted"
          >
            <Settings className="size-3.5" />
            Properties
          </TabsTrigger>
          <TabsTrigger
            value="ai"
            className="text-xs gap-1.5 data-[state=active]:bg-muted"
          >
            <Sparkles className="size-3.5" />
            AI Editor
            {aiEdits.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-4 px-1 text-[10px] min-w-4 justify-center"
              >
                {aiEdits.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="flex-1 m-0 overflow-hidden">
          <PropertiesPanel />
        </TabsContent>

        <TabsContent value="ai" className="flex-1 m-0 overflow-hidden">
          <AIEditorPanel
            currentTime={currentTime}
            onSeek={handleSeek}
            videoFile={videoFile}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
