/**
 * Google Generative AI (Gemini) client for AnoCut
 */

import {
  GoogleGenerativeAI,
  GenerativeModel,
  Part,
  Content,
} from "@google/generative-ai";
import type { AIModel } from "@/types/ai";

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "anocut_google_api_key";
const MODEL_STORAGE_KEY = "anocut_ai_model";
const DEFAULT_MODEL: AIModel = "gemini-3-flash-preview";

// ============================================================================
// Client Singleton
// ============================================================================

let clientInstance: GoogleAIClient | null = null;

export class GoogleAIClient {
  private genAI: GoogleGenerativeAI;
  private modelId: AIModel;
  private model: GenerativeModel;

  constructor(apiKey: string, modelId: AIModel = DEFAULT_MODEL) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelId = modelId;
    this.model = this.genAI.getGenerativeModel({ model: modelId });
  }

  /**
   * Get the current model ID
   */
  getModelId(): AIModel {
    return this.modelId;
  }

  /**
   * Switch to a different model
   */
  setModel(modelId: AIModel): void {
    this.modelId = modelId;
    this.model = this.genAI.getGenerativeModel({ model: modelId });
  }

  /**
   * Generate content with text prompt
   */
  async generateText(prompt: string): Promise<string> {
    const result = await this.model.generateContent(prompt);
    const response = result.response;
    return response.text();
  }

  /**
   * Generate content with multimodal input (text + images/video)
   */
  async generateMultimodal(parts: Part[]): Promise<string> {
    const result = await this.model.generateContent(parts);
    const response = result.response;
    return response.text();
  }

  /**
   * Generate structured JSON output
   */
  async generateJSON<T>(
    prompt: string,
    schema: object,
    parts?: Part[]
  ): Promise<T> {
    const jsonPrompt = `${prompt}

IMPORTANT: Respond ONLY with valid JSON that matches this schema:
${JSON.stringify(schema, null, 2)}

Do not include any text before or after the JSON. Do not use markdown code blocks.`;

    let result: string;
    if (parts && parts.length > 0) {
      result = await this.generateMultimodal([{ text: jsonPrompt }, ...parts]);
    } else {
      result = await this.generateText(jsonPrompt);
    }

    // Clean up the response - remove markdown code blocks if present
    let cleanedResult = result.trim();
    if (cleanedResult.startsWith("```json")) {
      cleanedResult = cleanedResult.slice(7);
    } else if (cleanedResult.startsWith("```")) {
      cleanedResult = cleanedResult.slice(3);
    }
    if (cleanedResult.endsWith("```")) {
      cleanedResult = cleanedResult.slice(0, -3);
    }
    cleanedResult = cleanedResult.trim();

    try {
      return JSON.parse(cleanedResult) as T;
    } catch (error) {
      console.error("Failed to parse JSON response:", cleanedResult);
      throw new Error(`Invalid JSON response from AI: ${error}`);
    }
  }

  /**
   * Start a chat session
   */
  startChat(history?: Content[]) {
    return this.model.startChat({
      history: history || [],
    });
  }

  /**
   * Analyze video frames with a prompt
   */
  async analyzeFrames(
    frames: string[], // base64 data URLs
    prompt: string
  ): Promise<string> {
    const parts: Part[] = [{ text: prompt }];

    for (const frame of frames) {
      // Extract base64 data and mime type from data URL
      const matches = frame.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2],
          },
        });
      }
    }

    return this.generateMultimodal(parts);
  }

  /**
   * Analyze video frames and return structured JSON
   */
  async analyzeFramesJSON<T>(
    frames: string[],
    prompt: string,
    schema: object
  ): Promise<T> {
    const parts: Part[] = [];

    for (const frame of frames) {
      const matches = frame.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2],
          },
        });
      }
    }

    return this.generateJSON<T>(prompt, schema, parts);
  }
}

// ============================================================================
// API Key Management
// ============================================================================

/**
 * Check if API key is set
 */
export function hasApiKey(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(STORAGE_KEY);
}

/**
 * Get the stored API key
 */
export function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Set and store the API key
 */
export function setApiKey(apiKey: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, apiKey);
  // Reset client instance so it gets recreated with new key
  clientInstance = null;
}

/**
 * Remove the stored API key
 */
export function removeApiKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  clientInstance = null;
}

/**
 * Validate an API key by making a test request
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const testClient = new GoogleAIClient(apiKey);
    await testClient.generateText("Say 'ok' and nothing else.");
    return true;
  } catch (error) {
    console.error("API key validation failed:", error);
    return false;
  }
}

// ============================================================================
// Model Management
// ============================================================================

/**
 * Get the stored model preference
 */
export function getSelectedModel(): AIModel {
  if (typeof window === "undefined") return DEFAULT_MODEL;
  const stored = localStorage.getItem(MODEL_STORAGE_KEY);
  const validModels: AIModel[] = [
    "gemini-3-flash-preview",
    "gemini-3-pro-preview",
    "gemini-2.5-flash",
  ];
  if (stored && validModels.includes(stored as AIModel)) {
    return stored as AIModel;
  }
  return DEFAULT_MODEL;
}

/**
 * Set the model preference
 */
export function setSelectedModel(model: AIModel): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MODEL_STORAGE_KEY, model);
  if (clientInstance) {
    clientInstance.setModel(model);
  }
}

// ============================================================================
// Client Access
// ============================================================================

/**
 * Get or create the GoogleAI client instance
 */
export function getGoogleAIClient(): GoogleAIClient {
  if (!clientInstance) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error(
        "Google API key not set. Please configure your API key in settings."
      );
    }
    const model = getSelectedModel();
    clientInstance = new GoogleAIClient(apiKey, model);
  }
  return clientInstance;
}

/**
 * Check if client is available (API key is set)
 */
export function isClientAvailable(): boolean {
  return hasApiKey();
}
