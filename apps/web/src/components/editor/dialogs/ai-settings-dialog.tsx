"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAIEditorStore } from "@/stores/ai-editor-store";
import { validateApiKey, getApiKey } from "@/services/ai";
import {
  hasElevenLabsKey,
  getElevenLabsKey,
  setElevenLabsKey,
} from "@/services/ai/elevenlabs";
import { AI_MODELS, type AIModel } from "@/types/ai";
import { Loader2, Key, ExternalLink, Check, X, Mic, Eye } from "lucide-react";

interface AISettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AISettingsDialog({
  isOpen,
  onOpenChange,
}: AISettingsDialogProps) {
  const { hasApiKey, selectedModel, setApiKey, setSelectedModel } =
    useAIEditorStore();

  // Google AI state
  const [googleKeyInput, setGoogleKeyInput] = useState("");
  const [isValidatingGoogle, setIsValidatingGoogle] = useState(false);
  const [googleValidationStatus, setGoogleValidationStatus] = useState<
    "idle" | "valid" | "invalid"
  >("idle");

  // ElevenLabs state
  const [elevenLabsKeyInput, setElevenLabsKeyInput] = useState("");
  const [elevenLabsStatus, setElevenLabsStatus] = useState<"idle" | "saved">(
    "idle"
  );

  // Load existing keys when dialog opens
  useEffect(() => {
    if (isOpen) {
      const existingGoogleKey = getApiKey();
      if (existingGoogleKey) {
        setGoogleKeyInput("••••••••••••••••" + existingGoogleKey.slice(-4));
        setGoogleValidationStatus("valid");
      } else {
        setGoogleKeyInput("");
        setGoogleValidationStatus("idle");
      }

      const existingElevenLabsKey = getElevenLabsKey();
      if (existingElevenLabsKey) {
        setElevenLabsKeyInput(
          "••••••••••••••••" + existingElevenLabsKey.slice(-4)
        );
        setElevenLabsStatus("saved");
      } else {
        setElevenLabsKeyInput("");
        setElevenLabsStatus("idle");
      }
    }
  }, [isOpen]);

  const handleValidateGoogleKey = async () => {
    if (!googleKeyInput || googleKeyInput.startsWith("••••")) return;

    setIsValidatingGoogle(true);
    setGoogleValidationStatus("idle");

    try {
      const isValid = await validateApiKey(googleKeyInput);
      setGoogleValidationStatus(isValid ? "valid" : "invalid");

      if (isValid) {
        setApiKey(googleKeyInput);
      }
    } catch {
      setGoogleValidationStatus("invalid");
    } finally {
      setIsValidatingGoogle(false);
    }
  };

  const handleSaveElevenLabsKey = () => {
    if (!elevenLabsKeyInput || elevenLabsKeyInput.startsWith("••••")) return;
    setElevenLabsKey(elevenLabsKeyInput);
    setElevenLabsStatus("saved");
  };

  const handleSave = () => {
    if (
      googleValidationStatus === "valid" &&
      !googleKeyInput.startsWith("••••")
    ) {
      setApiKey(googleKeyInput);
    }
    if (!elevenLabsKeyInput.startsWith("••••") && elevenLabsKeyInput) {
      setElevenLabsKey(elevenLabsKeyInput);
    }
    onOpenChange(false);
  };

  const handleGoogleKeyChange = (value: string) => {
    setGoogleKeyInput(value);
    setGoogleValidationStatus("idle");
  };

  const handleElevenLabsKeyChange = (value: string) => {
    setElevenLabsKeyInput(value);
    setElevenLabsStatus("idle");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="size-5" />
            AI Settings
          </DialogTitle>
          <DialogDescription>
            Configure API keys for AI-powered video analysis and transcription.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="google" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="google" className="text-xs">
              <Eye className="size-3 mr-1" />
              Google AI (Visual)
            </TabsTrigger>
            <TabsTrigger value="elevenlabs" className="text-xs">
              <Mic className="size-3 mr-1" />
              ElevenLabs (Audio)
            </TabsTrigger>
          </TabsList>

          {/* Google AI Tab */}
          <TabsContent value="google" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="google-api-key">Google AI API Key</Label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  Get API Key
                  <ExternalLink className="size-3" />
                </a>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="google-api-key"
                    type="password"
                    placeholder="Enter your Google AI API key"
                    value={googleKeyInput}
                    onChange={(e) => handleGoogleKeyChange(e.target.value)}
                    className="pr-10"
                  />
                  {googleValidationStatus === "valid" && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-green-500" />
                  )}
                  {googleValidationStatus === "invalid" && (
                    <X className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-red-500" />
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={handleValidateGoogleKey}
                  disabled={
                    isValidatingGoogle ||
                    !googleKeyInput ||
                    googleKeyInput.startsWith("••••")
                  }
                >
                  {isValidatingGoogle ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Validate"
                  )}
                </Button>
              </div>

              {googleValidationStatus === "invalid" && (
                <p className="text-xs text-red-500">
                  Invalid API key. Please check and try again.
                </p>
              )}

              {googleValidationStatus === "valid" && (
                <p className="text-xs text-green-500">
                  API key is valid and saved.
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Required for visual analysis, scene detection, and AI commands.
              </p>
            </div>

            {/* Model Selection */}
            <div className="space-y-3">
              <Label htmlFor="model">AI Model</Label>
              <Select
                value={selectedModel}
                onValueChange={(value) => setSelectedModel(value as AIModel)}
              >
                <SelectTrigger id="model">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AI_MODELS).map(([id, info]) => (
                    <SelectItem key={id} value={id}>
                      <div className="flex flex-col">
                        <span>{info.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {info.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* ElevenLabs Tab */}
          <TabsContent value="elevenlabs" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="elevenlabs-api-key">ElevenLabs API Key</Label>
                <a
                  href="https://elevenlabs.io/app/settings/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  Get API Key
                  <ExternalLink className="size-3" />
                </a>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="elevenlabs-api-key"
                    type="password"
                    placeholder="Enter your ElevenLabs API key"
                    value={elevenLabsKeyInput}
                    onChange={(e) => handleElevenLabsKeyChange(e.target.value)}
                    className="pr-10"
                  />
                  {elevenLabsStatus === "saved" && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-green-500" />
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={handleSaveElevenLabsKey}
                  disabled={
                    !elevenLabsKeyInput ||
                    elevenLabsKeyInput.startsWith("••••")
                  }
                >
                  Save
                </Button>
              </div>

              {elevenLabsStatus === "saved" && (
                <p className="text-xs text-green-500">API key saved.</p>
              )}

              <p className="text-xs text-muted-foreground">
                Optional. Enables high-accuracy transcription with word-level
                timestamps and speaker diarization using ElevenLabs Scribe.
              </p>

              <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                <p className="font-medium mb-1">Without ElevenLabs:</p>
                <p className="text-muted-foreground">
                  Basic transcription via Google Gemini (sentence-level only)
                </p>
                <p className="font-medium mt-2 mb-1">With ElevenLabs:</p>
                <ul className="text-muted-foreground list-disc list-inside space-y-0.5">
                  <li>Word-level timestamps</li>
                  <li>Speaker identification</li>
                  <li>Music & noise detection</li>
                  <li>Higher accuracy</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Status */}
        <div className="rounded-lg border bg-muted/30 p-3 mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Google AI</span>
            <span
              className={
                hasApiKey ? "text-green-500" : "text-muted-foreground"
              }
            >
              {hasApiKey ? "Ready" : "Key required"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-muted-foreground">ElevenLabs</span>
            <span
              className={
                hasElevenLabsKey() ? "text-green-500" : "text-muted-foreground"
              }
            >
              {hasElevenLabsKey() ? "Ready" : "Optional"}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
