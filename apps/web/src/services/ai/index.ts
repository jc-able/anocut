/**
 * AI Services Index
 * Export all AI-related services for AnoCut
 */

// Google AI Client
export {
  GoogleAIClient,
  getGoogleAIClient,
  isClientAvailable,
  hasApiKey,
  getApiKey,
  setApiKey,
  removeApiKey,
  validateApiKey,
  getSelectedModel,
  setSelectedModel,
} from "./google-ai";

// Video Analyzer
export { analyzeVideo, analyzeVideoUrl } from "./video-analyzer";
export type { ProgressCallback } from "./video-analyzer";

// Command Interpreter
export {
  interpretCommand,
  tryQuickCommand,
  QUICK_COMMANDS,
} from "./command-interpreter";
