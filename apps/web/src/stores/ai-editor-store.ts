/**
 * AI Editor Store
 * Manages state for AI-powered video analysis and editing
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  VideoAnalysis,
  EditDecision,
  AnalysisProgress,
  CommandResult,
  AIModel,
} from "@/types/ai";
import {
  analyzeVideo,
  interpretCommand,
  hasApiKey,
  getSelectedModel,
  setSelectedModel as setModelInStorage,
  setApiKey as setApiKeyInStorage,
  getApiKey,
} from "@/services/ai";

// ============================================================================
// Types
// ============================================================================

interface AIEditorState {
  // Analysis state
  analysis: VideoAnalysis | null;
  isAnalyzing: boolean;
  analysisProgress: AnalysisProgress;
  analysisError: string | null;

  // Edit state
  aiEdits: EditDecision[];
  undoStack: EditDecision[][];
  redoStack: EditDecision[][];

  // Command state
  isProcessingCommand: boolean;
  lastCommandResult: CommandResult | null;
  commandHistory: string[];

  // Settings
  hasApiKey: boolean;
  selectedModel: AIModel;

  // Actions - Analysis
  startAnalysis: (videoFile: File) => Promise<void>;
  clearAnalysis: () => void;

  // Actions - Edits
  addEdits: (edits: EditDecision[]) => void;
  removeEdit: (id: string) => void;
  clearEdits: () => void;
  undo: () => void;
  redo: () => void;

  // Actions - Commands
  executeCommand: (command: string) => Promise<CommandResult>;
  clearCommandHistory: () => void;

  // Actions - Settings
  setApiKey: (key: string) => void;
  setSelectedModel: (model: AIModel) => void;
  refreshApiKeyStatus: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialProgress: AnalysisProgress = {
  stage: "idle",
  progress: 0,
  message: "",
};

// ============================================================================
// Store
// ============================================================================

export const useAIEditorStore = create<AIEditorState>()(
  persist(
    (set, get) => ({
      // Initial state
      analysis: null,
      isAnalyzing: false,
      analysisProgress: initialProgress,
      analysisError: null,

      aiEdits: [],
      undoStack: [],
      redoStack: [],

      isProcessingCommand: false,
      lastCommandResult: null,
      commandHistory: [],

      hasApiKey: typeof window !== "undefined" ? hasApiKey() : false,
      selectedModel: typeof window !== "undefined" ? getSelectedModel() : "gemini-3-flash-preview",

      // Analysis actions
      startAnalysis: async (videoFile: File) => {
        set({
          isAnalyzing: true,
          analysisError: null,
          analysisProgress: {
            stage: "extracting",
            progress: 0,
            message: "Starting analysis...",
          },
        });

        try {
          const analysis = await analyzeVideo(videoFile, (progress) => {
            set({ analysisProgress: progress });
          });

          set({
            analysis,
            isAnalyzing: false,
            analysisProgress: {
              stage: "complete",
              progress: 100,
              message: "Analysis complete",
            },
          });
        } catch (error) {
          set({
            isAnalyzing: false,
            analysisError:
              error instanceof Error ? error.message : "Analysis failed",
            analysisProgress: {
              stage: "error",
              progress: 0,
              message: error instanceof Error ? error.message : "Analysis failed",
            },
          });
          throw error;
        }
      },

      clearAnalysis: () => {
        set({
          analysis: null,
          analysisProgress: initialProgress,
          analysisError: null,
          aiEdits: [],
          undoStack: [],
          redoStack: [],
        });
      },

      // Edit actions
      addEdits: (edits: EditDecision[]) => {
        const { aiEdits, undoStack } = get();
        set({
          aiEdits: [...aiEdits, ...edits],
          undoStack: [...undoStack, aiEdits],
          redoStack: [], // Clear redo stack on new action
        });
      },

      removeEdit: (id: string) => {
        const { aiEdits, undoStack } = get();
        set({
          aiEdits: aiEdits.filter((e) => e.id !== id),
          undoStack: [...undoStack, aiEdits],
          redoStack: [],
        });
      },

      clearEdits: () => {
        const { aiEdits, undoStack } = get();
        if (aiEdits.length > 0) {
          set({
            aiEdits: [],
            undoStack: [...undoStack, aiEdits],
            redoStack: [],
          });
        }
      },

      undo: () => {
        const { aiEdits, undoStack, redoStack } = get();
        if (undoStack.length === 0) return;

        const previousState = undoStack[undoStack.length - 1];
        set({
          aiEdits: previousState,
          undoStack: undoStack.slice(0, -1),
          redoStack: [...redoStack, aiEdits],
        });
      },

      redo: () => {
        const { aiEdits, undoStack, redoStack } = get();
        if (redoStack.length === 0) return;

        const nextState = redoStack[redoStack.length - 1];
        set({
          aiEdits: nextState,
          undoStack: [...undoStack, aiEdits],
          redoStack: redoStack.slice(0, -1),
        });
      },

      // Command actions
      executeCommand: async (command: string) => {
        const { analysis, commandHistory } = get();

        if (!analysis) {
          const result: CommandResult = {
            success: false,
            command,
            interpretation: "No video analysis available",
            edits: [],
            affectedTimeRanges: [],
            error: "Please analyze the video first before running commands.",
          };
          set({ lastCommandResult: result });
          return result;
        }

        set({ isProcessingCommand: true });

        try {
          const result = await interpretCommand(command, analysis);

          // Add successful edits
          if (result.success && result.edits.length > 0) {
            get().addEdits(result.edits);
          }

          // Update command history
          set({
            isProcessingCommand: false,
            lastCommandResult: result,
            commandHistory: [command, ...commandHistory.slice(0, 49)], // Keep last 50
          });

          return result;
        } catch (error) {
          const result: CommandResult = {
            success: false,
            command,
            interpretation: "Command execution failed",
            edits: [],
            affectedTimeRanges: [],
            error: error instanceof Error ? error.message : "Unknown error",
          };

          set({
            isProcessingCommand: false,
            lastCommandResult: result,
          });

          return result;
        }
      },

      clearCommandHistory: () => {
        set({ commandHistory: [], lastCommandResult: null });
      },

      // Settings actions
      setApiKey: (key: string) => {
        setApiKeyInStorage(key);
        set({ hasApiKey: true });
      },

      setSelectedModel: (model: AIModel) => {
        setModelInStorage(model);
        set({ selectedModel: model });
      },

      refreshApiKeyStatus: () => {
        set({ hasApiKey: hasApiKey() });
      },
    }),
    {
      name: "anocut-ai-editor",
      partialize: (state) => ({
        // Only persist these fields
        commandHistory: state.commandHistory,
        selectedModel: state.selectedModel,
      }),
    }
  )
);

// ============================================================================
// Selectors (for performance optimization)
// ============================================================================

export const selectAnalysis = (state: AIEditorState) => state.analysis;
export const selectAIEdits = (state: AIEditorState) => state.aiEdits;
export const selectIsAnalyzing = (state: AIEditorState) => state.isAnalyzing;
export const selectAnalysisProgress = (state: AIEditorState) =>
  state.analysisProgress;
export const selectHasApiKey = (state: AIEditorState) => state.hasApiKey;
export const selectCanUndo = (state: AIEditorState) =>
  state.undoStack.length > 0;
export const selectCanRedo = (state: AIEditorState) =>
  state.redoStack.length > 0;
