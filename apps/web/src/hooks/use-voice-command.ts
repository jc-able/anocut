/**
 * Voice Command Hook
 * Records audio and transcribes it to text for AI commands
 */

import { useState, useRef, useCallback, useEffect } from "react";

export type VoiceCommandStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "transcribing"
  | "error";

interface UseVoiceCommandOptions {
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
  maxDuration?: number; // Max recording duration in ms
}

interface UseVoiceCommandReturn {
  status: VoiceCommandStatus;
  isRecording: boolean;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
}

/**
 * Hook for recording voice commands and transcribing them
 * Uses the Web Speech API for browser-native transcription
 */
export function useVoiceCommand(
  options: UseVoiceCommandOptions = {}
): UseVoiceCommandReturn {
  const { onTranscript, onError, maxDuration = 30000 } = options;

  const [status, setStatus] = useState<VoiceCommandStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if Web Speech API is available
  const isSpeechSupported = typeof window !== "undefined" && (
    "SpeechRecognition" in window || "webkitSpeechRecognition" in window
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleError = useCallback(
    (errorMessage: string) => {
      setError(errorMessage);
      setStatus("error");
      onError?.(errorMessage);
    },
    [onError]
  );

  const startRecording = useCallback(async () => {
    if (!isSpeechSupported) {
      handleError("Speech recognition is not supported in this browser");
      return;
    }

    setStatus("requesting");
    setError(null);

    try {
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create speech recognition instance
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setStatus("recording");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setStatus("idle");
        onTranscript?.(transcript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        let errorMessage = "Speech recognition error";
        switch (event.error) {
          case "no-speech":
            errorMessage = "No speech detected. Please try again.";
            break;
          case "audio-capture":
            errorMessage = "No microphone found. Please check your settings.";
            break;
          case "not-allowed":
            errorMessage = "Microphone access denied. Please allow microphone access.";
            break;
          case "network":
            errorMessage = "Network error. Please check your connection.";
            break;
          case "aborted":
            // User cancelled, not an error
            setStatus("idle");
            return;
          default:
            errorMessage = `Speech recognition error: ${event.error}`;
        }
        handleError(errorMessage);
      };

      recognition.onend = () => {
        if (status === "recording") {
          setStatus("idle");
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };

      recognitionRef.current = recognition;

      // Start recognition
      recognition.start();

      // Set max duration timeout
      timeoutRef.current = setTimeout(() => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      }, maxDuration);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          handleError("Microphone access denied. Please allow microphone access.");
        } else {
          handleError(err.message);
        }
      } else {
        handleError("Failed to start recording");
      }
    }
  }, [isSpeechSupported, maxDuration, onTranscript, handleError, status]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setStatus("idle");
    setError(null);
  }, []);

  return {
    status,
    isRecording: status === "recording",
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
