/**
 * ElevenLabs Transcription API Route
 * Server-side transcription using ElevenLabs Scribe v2
 *
 * Scribe v2 provides:
 * - Word-level timestamps with high precision
 * - Speaker diarization (up to 32 speakers)
 * - Audio event detection (laughter, applause, music, etc.)
 * - 90+ language support with auto-detection
 * - Confidence scores (logprob) for each word
 */

import { NextRequest, NextResponse } from "next/server";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/speech-to-text";

export async function POST(request: NextRequest) {
  try {
    // Get the API key from environment or request header
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY ||
      request.headers.get("x-elevenlabs-key");

    if (!elevenLabsKey) {
      return NextResponse.json(
        { error: "ElevenLabs API key not configured" },
        { status: 400 }
      );
    }

    // Get the audio file and options from the request
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const languageCode = formData.get("language_code") as string | null;
    const numSpeakers = formData.get("num_speakers") as string | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Prepare request to ElevenLabs with full Scribe v2 options
    const elevenLabsForm = new FormData();
    elevenLabsForm.append("file", audioFile, audioFile.name || "audio.wav");

    // Model selection - use Scribe v2 for best quality
    elevenLabsForm.append("model_id", "scribe_v2");

    // Enable speaker diarization - identifies who is speaking
    elevenLabsForm.append("diarize", "true");

    // Enable audio event tagging - detects laughter, music, applause, etc.
    elevenLabsForm.append("tag_audio_events", "true");

    // Word-level timestamps for precise timing
    elevenLabsForm.append("timestamps_granularity", "word");

    // Optional: language hint for better accuracy
    if (languageCode) {
      elevenLabsForm.append("language_code", languageCode);
    }

    // Optional: expected number of speakers
    if (numSpeakers) {
      elevenLabsForm.append("num_speakers", numSpeakers);
    }

    // Call ElevenLabs API
    const response = await fetch(ELEVENLABS_API_URL, {
      method: "POST",
      headers: {
        "xi-api-key": elevenLabsKey,
      },
      body: elevenLabsForm,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Transcribe API] ElevenLabs error:", errorText);
      return NextResponse.json(
        { error: `ElevenLabs error: ${errorText}` },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Transform ElevenLabs response to our format
    const transformed = transformElevenLabsResponse(result);

    return NextResponse.json(transformed);
  } catch (error) {
    console.error("[Transcribe API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcription failed" },
      { status: 500 }
    );
  }
}

// ============================================================================
// Types matching ElevenLabs Scribe v2 response
// ============================================================================

interface ElevenLabsWord {
  text: string;
  start: number;
  end: number;
  type: "word" | "spacing" | "punctuation" | "audio_event";
  speaker_id?: string;
  logprob?: number; // Confidence: -∞ to 0, higher = more confident
}

interface ElevenLabsResponse {
  text: string;
  words: ElevenLabsWord[];
  language_code?: string;
  language_probability?: number;
  transcription_id?: string;
}

interface TransformedWord {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
  speakerId?: string;
}

interface TransformedSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
  isFiller?: boolean;
  words: TransformedWord[];
}

interface TransformedAudioEvent {
  type: string;
  startTime: number;
  endTime: number;
}

interface TransformedResponse {
  transcript: TransformedSegment[];
  audioEvents: TransformedAudioEvent[];
  fullText: string;
  speakers: string[];
  languageCode?: string;
  languageConfidence?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Convert logprob (-∞ to 0) to confidence score (0 to 1)
 * logprob of 0 = 100% confident, logprob of -5 ≈ 0.67% confident
 */
function logprobToConfidence(logprob: number | undefined): number {
  if (logprob === undefined) return 0.95; // Default high confidence
  // exp(logprob) converts log probability to regular probability
  return Math.exp(logprob);
}

// Common filler words to detect
const FILLER_WORDS = new Set([
  "um", "uh", "er", "ah", "like", "you know", "basically", "actually",
  "literally", "right", "so", "well", "i mean", "kind of", "sort of",
  "okay", "ok", "yeah", "hmm", "huh", "mhm"
]);

function isFillerSegment(text: string): boolean {
  const lower = text.toLowerCase().trim();
  // Check if the entire segment is primarily filler words
  const words = lower.split(/\s+/);
  const fillerCount = words.filter(w => FILLER_WORDS.has(w.replace(/[.,!?]/g, ""))).length;
  return fillerCount > 0 && fillerCount >= words.length * 0.5;
}

// ============================================================================
// Response Transformation
// ============================================================================

function transformElevenLabsResponse(response: ElevenLabsResponse): TransformedResponse {
  const audioEvents: TransformedAudioEvent[] = [];
  const speechWords: TransformedWord[] = [];

  // Process all items in the words array
  for (const item of response.words) {
    if (item.type === "audio_event") {
      // Audio events: laughter, music, applause, etc.
      audioEvents.push({
        type: item.text, // The event type is in the text field
        startTime: item.start,
        endTime: item.end,
      });
    } else if (item.type === "word") {
      // Regular speech words
      speechWords.push({
        word: item.text,
        startTime: item.start,
        endTime: item.end,
        confidence: logprobToConfidence(item.logprob),
        speakerId: item.speaker_id,
      });
    }
    // Skip "spacing" and "punctuation" types
  }

  // Group words into segments by speaker changes and pauses
  const segments: TransformedSegment[] = [];
  let currentWords: TransformedWord[] = [];

  for (const word of speechWords) {
    const prev = currentWords[currentWords.length - 1];

    // Start new segment on speaker change or pause > 1 second
    const isPause = prev && (word.startTime - prev.endTime > 1.0);
    const isNewSpeaker = prev && (prev.speakerId !== word.speakerId);

    if ((isPause || isNewSpeaker) && currentWords.length > 0) {
      segments.push(createSegment(currentWords));
      currentWords = [];
    }

    currentWords.push(word);
  }

  // Don't forget the last segment
  if (currentWords.length > 0) {
    segments.push(createSegment(currentWords));
  }

  // Get unique speakers
  const speakers = [...new Set(
    speechWords
      .map(w => w.speakerId)
      .filter((id): id is string => Boolean(id))
  )];

  return {
    transcript: segments,
    audioEvents,
    fullText: response.text,
    speakers,
    languageCode: response.language_code,
    languageConfidence: response.language_probability,
  };
}

function createSegment(words: TransformedWord[]): TransformedSegment {
  const text = words.map(w => w.word).join(" ");
  return {
    id: generateId(),
    startTime: words[0].startTime,
    endTime: words[words.length - 1].endTime,
    text,
    speaker: words[0].speakerId,
    isFiller: isFillerSegment(text),
    words: [...words],
  };
}
