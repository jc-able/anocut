# AnoCut - Product Requirements Document

## Overview

**AnoCut** (Annotate + Cut) is an AI-powered video editor that enables voice-driven editing through natural language commands. Built on top of a robust browser-based video editing foundation, AnoCut adds intelligent video analysis and command interpretation to let users edit videos by simply describing what they want.

## Vision

Transform video editing from a manual, timeline-scrubbing experience into a conversational workflow where users can say "remove all the silence" or "cut out the filler words" and have the AI execute those edits instantly.

## Core Concept

```
"Ano" (Annotate) + "Cut" (Execute) = AnoCut
```

1. **Annotate**: AI analyzes the video to identify and label segments (speech, silence, filler words, scene changes, etc.)
2. **Cut**: Users issue natural language commands that the AI interprets and executes as non-destructive edits

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AnoCut Editor                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Video       │    │  Timeline    │    │  Preview     │  │
│  │  Import      │───▶│  Editor      │───▶│  & Export    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   ▲                               │
│         ▼                   │                               │
│  ┌──────────────────────────┴───────────────────────────┐  │
│  │                   AI Layer                            │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │  │
│  │  │  Video     │  │  Command   │  │  Annotation    │  │  │
│  │  │  Analyzer  │  │  Terminal  │  │  Timeline      │  │  │
│  │  └────────────┘  └────────────┘  └────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  ┌──────────────────┐        ┌──────────────────────────┐  │
│  │  Google Gemini   │        │  ElevenLabs Scribe       │  │
│  │  - Visual        │        │  - Transcription         │  │
│  │  - Commands      │        │  - Speaker Diarization   │  │
│  │  - Interpretation│        │  - Audio Events          │  │
│  └──────────────────┘        └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Phase 1: Core AI Integration

#### 1.1 Video Analysis
- **Input**: Video file (MP4, WebM, MOV)
- **Output**: VideoAnalysis object containing:
  - Transcript with word-level timestamps
  - Annotations (talking, silence, filler, scene changes)
  - Audio events (music, laughter, applause)
  - Summary and metadata

#### 1.2 Annotation Types
| Type | Description | Color |
|------|-------------|-------|
| `talking` | Speech segments | Blue |
| `silence` | Gaps > 0.5s with no speech | Gray |
| `filler` | Um, uh, like, you know, etc. | Orange |
| `scene` | Visual scene changes | Purple |
| `music` | Background music detected | Green |
| `noise` | Non-speech audio | Red |

#### 1.3 Command Terminal
- Text input for natural language commands
- Quick action buttons for common operations
- Command history and suggestions
- Real-time feedback on command interpretation

### Phase 2: Edit Operations

#### 2.1 Supported Commands
```
"Remove all silence"
"Cut the filler words"
"Delete from 1:30 to 2:00"
"Keep only the parts where someone is talking"
"Remove the intro"
"Speed up the slow parts"
"Add captions"
```

#### 2.2 Edit Types
| Type | Description |
|------|-------------|
| `cut` | Remove a time range |
| `keep` | Keep only specified ranges |
| `speed` | Adjust playback speed |
| `caption` | Add text overlay |
| `zoom` | Digital zoom effect |
| `audio` | Volume/normalize adjustments |

#### 2.3 Non-Destructive Editing
- All edits stored as an Edit Decision List (EDL)
- Original video never modified
- Full undo/redo support
- Preview before export

### Phase 3: Export & Integration

#### 3.1 Export Options
- Apply edits and render final video
- Export EDL for external editors
- Export transcript as SRT/VTT

## Technical Specifications

### API Integrations

#### Google Gemini API
- **Model**: `gemini-2.0-flash` (default) or `gemini-2.0-pro`
- **Auth**: User-provided API key (BYOK)
- **Storage**: localStorage
- **Uses**:
  - Multimodal video analysis (frames + audio)
  - Command interpretation with tool calling
  - Structured JSON output

#### ElevenLabs API
- **Model**: Scribe v2
- **Auth**: Server-side API key (environment variable)
- **Uses**:
  - Speech-to-text transcription
  - Word-level timestamps
  - Speaker diarization
  - Audio event detection

### Data Types

```typescript
// Core annotation type
interface Annotation {
  id: string;
  type: "talking" | "silence" | "scene" | "filler" | "noise" | "music";
  startTime: number;  // seconds
  endTime: number;    // seconds
  confidence: number; // 0-1
  label?: string;
}

// Transcript segment
interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
  isFiller?: boolean;
  words?: TranscriptWord[];
}

// Word-level detail
interface TranscriptWord {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
  speakerId?: string;
}

// Complete analysis result
interface VideoAnalysis {
  duration: number;
  annotations: Annotation[];
  transcript: TranscriptSegment[];
  summary: string;
  detectedSpeakers: number;
  fillerWordCount: number;
  silenceGapCount: number;
  sceneChangeCount: number;
}

// Edit decision
interface EditDecision {
  id: string;
  type: "cut" | "keep" | "speed" | "caption" | "zoom" | "audio";
  startTime: number;
  endTime: number;
  params?: Record<string, unknown>;
  command?: string;  // Original user command
}

// Command result
interface CommandResult {
  success: boolean;
  command: string;
  interpretation: string;
  edits: EditDecision[];
  error?: string;
}
```

### State Management

Using Zustand store with the following shape:

```typescript
interface AIEditorState {
  // Analysis
  analysis: VideoAnalysis | null;
  isAnalyzing: boolean;
  analysisProgress: string;
  analysisError: string | null;

  // Edits
  aiEdits: EditDecision[];
  undoStack: EditDecision[][];
  redoStack: EditDecision[][];

  // Settings
  googleApiKey: string | null;
  selectedModel: string;

  // Actions
  startAnalysis: () => Promise<void>;
  executeCommand: (command: string) => Promise<CommandResult>;
  addEdits: (edits: EditDecision[]) => void;
  removeEdit: (id: string) => void;
  undo: () => void;
  redo: () => void;
}
```

## UI Components

### 1. API Settings Dialog
- Google API key input
- Model selection dropdown
- Link to get API key
- Key validation

### 2. Command Terminal
- Fixed position at bottom of editor
- Text input with submit button
- Quick action chips
- Progress/status indicator
- Command history

### 3. Annotation Timeline
- Visual layer above main timeline
- Color-coded annotation blocks
- Hover for details
- Click to jump to position

### 4. Transcript Panel
- Searchable transcript
- Click word to seek
- Highlight current word during playback
- Speaker labels

### 5. Analysis Progress
- Upload progress
- Processing stages
- Estimated time remaining

## User Flow

1. **Import Video** → Existing flow
2. **Analyze** → Click "Analyze with AI" button
3. **Enter API Key** → If not set, prompt for Google API key
4. **Processing** → Show progress (extracting audio, transcribing, analyzing)
5. **View Results** → Annotations appear on timeline, transcript in panel
6. **Issue Commands** → Type or click quick actions
7. **Preview** → See edits applied in preview
8. **Adjust** → Undo/modify as needed
9. **Export** → Render final video with edits applied

## Success Metrics

- Analysis completes in < 2 minutes for 10-minute video
- Command interpretation accuracy > 90%
- User can remove silence/fillers in < 30 seconds
- Export includes all AI-driven edits

## Constraints

- Browser-based (no server for video processing)
- User provides own Google API key
- ElevenLabs requires server-side key (Supabase Edge Function)
- Video analysis limited by Gemini context window

## Dependencies

### NPM Packages
- `@google/generative-ai` - Gemini API SDK
- `zustand` - State management (already installed)

### Environment Variables
```
# Client-side (localStorage)
google_api_key - User's Google AI API key

# Server-side (if using ElevenLabs)
ELEVENLABS_API_KEY - ElevenLabs API key
```

## Implementation Tasks

### Completed
- [x] Remove OpenCut branding and rename to AnoCut
- [x] Remove marketing/landing pages
- [x] Create dark minimal theme

### Phase 1: Foundation
- [ ] Define annotation and transcript types
- [ ] Add Google Generative AI SDK
- [ ] Create AI service layer (google-ai.ts)
- [ ] Create video analyzer service
- [ ] Create annotation store

### Phase 2: UI Components
- [ ] Create annotation timeline visualization
- [ ] Create command terminal component
- [ ] Create transcript panel component
- [ ] Add AI settings dialog

### Phase 3: Command System
- [ ] Create command interpreter service
- [ ] Implement quick commands (remove silence, cut fillers)
- [ ] Add voice recording for commands

### Phase 4: Integration
- [ ] Implement non-destructive cut preview
- [ ] Integrate AI edits with export
- [ ] Add undo/redo for AI edits

## Future Enhancements

- Voice command input (speech-to-text for commands)
- Batch processing multiple videos
- Custom annotation types
- AI-suggested edits
- Export presets for social platforms
- Collaboration features
