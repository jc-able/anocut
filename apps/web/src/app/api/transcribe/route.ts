/**
 * ElevenLabs Transcription API Route
 * Server-side transcription using ElevenLabs Scribe v2
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

    // Get the audio file from the request
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Prepare request to ElevenLabs
    const elevenLabsForm = new FormData();
    elevenLabsForm.append("file", audioFile, audioFile.name || "audio.wav");
    elevenLabsForm.append("model_id", "scribe_v2");
    elevenLabsForm.append("diarize", "true");
    elevenLabsForm.append("tag_audio_events", "true");

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

interface ElevenLabsWord {
  text: string;
  start: number;
  end: number;
  type: "word" | "spacing" | "punctuation";
  speaker_id?: string;
}

interface ElevenLabsAudioEvent {
  type: string;
  start: number;
  end: number;
}

interface ElevenLabsResponse {
  text: string;
  words: ElevenLabsWord[];
  audio_events?: ElevenLabsAudioEvent[];
}

interface TransformedResponse {
  transcript: {
    id: string;
    startTime: number;
    endTime: number;
    text: string;
    speaker?: string;
    isFiller?: boolean;
    words: {
      word: string;
      startTime: number;
      endTime: number;
      confidence: number;
      speakerId?: string;
    }[];
  }[];
  audioEvents: {
    type: string;
    startTime: number;
    endTime: number;
  }[];
  fullText: string;
  speakers: string[];
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

const FILLER_WORDS = ["um", "uh", "like", "you know", "basically", "actually", "literally", "right", "so", "well"];

function isFillerWord(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return FILLER_WORDS.some(filler => lower === filler || lower.includes(filler));
}

function transformElevenLabsResponse(response: ElevenLabsResponse): TransformedResponse {
  // Filter to only actual words
  const words = response.words
    .filter(w => w.type === "word")
    .map(w => ({
      word: w.text,
      startTime: w.start,
      endTime: w.end,
      confidence: 0.99,
      speakerId: w.speaker_id,
    }));

  // Group words into segments by speaker and pauses
  const segments: TransformedResponse["transcript"] = [];
  let currentWords: typeof words = [];

  words.forEach((word, i) => {
    const prev = currentWords[currentWords.length - 1];
    const isPause = prev && (word.startTime - prev.endTime > 1.0);
    const isNewSpeaker = prev && (prev.speakerId !== word.speakerId);

    if ((isPause || isNewSpeaker) && currentWords.length > 0) {
      const segmentText = currentWords.map(w => w.word).join(" ");
      segments.push({
        id: generateId(),
        startTime: currentWords[0].startTime,
        endTime: currentWords[currentWords.length - 1].endTime,
        text: segmentText,
        speaker: currentWords[0].speakerId,
        isFiller: isFillerWord(segmentText),
        words: [...currentWords],
      });
      currentWords = [];
    }
    currentWords.push(word);
  });

  // Don't forget the last segment
  if (currentWords.length > 0) {
    const segmentText = currentWords.map(w => w.word).join(" ");
    segments.push({
      id: generateId(),
      startTime: currentWords[0].startTime,
      endTime: currentWords[currentWords.length - 1].endTime,
      text: segmentText,
      speaker: currentWords[0].speakerId,
      isFiller: isFillerWord(segmentText),
      words: [...currentWords],
    });
  }

  // Transform audio events
  const audioEvents = (response.audio_events || []).map(e => ({
    type: e.type,
    startTime: e.start,
    endTime: e.end,
  }));

  // Get unique speakers
  const speakers = [...new Set(words.map(w => w.speakerId).filter(Boolean))] as string[];

  return {
    transcript: segments,
    audioEvents,
    fullText: response.text,
    speakers,
  };
}
