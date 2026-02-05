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
import { useAIEditorStore } from "@/stores/ai-editor-store";
import { validateApiKey, getApiKey } from "@/services/ai";
import { AI_MODELS, type AIModel } from "@/types/ai";
import { Loader2, Key, ExternalLink, Check, X } from "lucide-react";

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

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<
    "idle" | "valid" | "invalid"
  >("idle");
  const [showKey, setShowKey] = useState(false);

  // Load existing key (masked) when dialog opens
  useEffect(() => {
    if (isOpen) {
      const existingKey = getApiKey();
      if (existingKey) {
        // Show masked version
        setApiKeyInput("••••••••••••••••" + existingKey.slice(-4));
        setValidationStatus("valid");
      } else {
        setApiKeyInput("");
        setValidationStatus("idle");
      }
    }
  }, [isOpen]);

  const handleValidateKey = async () => {
    if (!apiKeyInput || apiKeyInput.startsWith("••••")) return;

    setIsValidating(true);
    setValidationStatus("idle");

    try {
      const isValid = await validateApiKey(apiKeyInput);
      setValidationStatus(isValid ? "valid" : "invalid");

      if (isValid) {
        setApiKey(apiKeyInput);
      }
    } catch {
      setValidationStatus("invalid");
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = () => {
    if (validationStatus === "valid" && !apiKeyInput.startsWith("••••")) {
      setApiKey(apiKeyInput);
    }
    onOpenChange(false);
  };

  const handleKeyInputChange = (value: string) => {
    setApiKeyInput(value);
    setValidationStatus("idle");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="size-5" />
            AI Settings
          </DialogTitle>
          <DialogDescription>
            Configure your Google AI API key and model preferences for
            voice-driven editing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* API Key Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="api-key">Google AI API Key</Label>
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
                  id="api-key"
                  type={showKey ? "text" : "password"}
                  placeholder="Enter your API key"
                  value={apiKeyInput}
                  onChange={(e) => handleKeyInputChange(e.target.value)}
                  className="pr-10"
                />
                {validationStatus === "valid" && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-green-500" />
                )}
                {validationStatus === "invalid" && (
                  <X className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-red-500" />
                )}
              </div>
              <Button
                variant="outline"
                onClick={handleValidateKey}
                disabled={
                  isValidating ||
                  !apiKeyInput ||
                  apiKeyInput.startsWith("••••")
                }
              >
                {isValidating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Validate"
                )}
              </Button>
            </div>

            {validationStatus === "invalid" && (
              <p className="text-xs text-red-500">
                Invalid API key. Please check and try again.
              </p>
            )}

            {validationStatus === "valid" && (
              <p className="text-xs text-green-500">
                API key is valid and saved.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Your API key is stored locally in your browser and never sent to
              our servers.
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

          {/* Status */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span
                className={
                  hasApiKey ? "text-green-500" : "text-muted-foreground"
                }
              >
                {hasApiKey ? "Ready" : "API key required"}
              </span>
            </div>
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
