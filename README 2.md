# AnoCut

**Voice-driven video editing.** Annotate and cut your videos with natural language commands.

## What is AnoCut?

AnoCut is a revolutionary video editing platform that changes the post-production workflow. Instead of manually manipulating clips on a timeline, users edit video by speaking natural language commands to an AI agent.

The name comes from two core operations:
- **"Ano"** = Annotate: AI "watches" raw footage and generates timestamped metadata
- **"Cut"** = Execute: AI performs edits based on user intent via natural language

## Features

- **Voice-First Editing** - Edit videos by speaking commands like "Remove all silence" or "Cut the filler words"
- **AI Annotation** - Automatic detection of silence, filler words, scene changes, and more
- **Timeline-Based Editing** - Full manual control when you need it
- **Multi-Track Support** - Video, audio, text, and more
- **Real-Time Preview** - See your edits instantly
- **Non-Destructive** - Original video is never altered until export
- **Privacy-First** - All editing happens in your browser

## Supported Commands

- "Remove all silence longer than [X] seconds"
- "Cut all the filler words (umms, ahhs)"
- "Delete the segment from [Time A] to [Time B]"
- "Keep only the parts where I am talking"
- "Zoom in on my face when I say '[keyword]'"
- "Add a text caption saying '[text]' at [timestamp]"

## Project Structure

- `apps/web/` – Main Next.js web application
- `packages/env/` – Environment configuration
- `packages/ui/` – Shared UI components

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v18 or later)
- [Bun](https://bun.sh/docs/installation)

### Setup

1. Clone the repository
2. Install dependencies: `bun install`
3. Copy `.env.example` to `.env.local` in `apps/web/`
4. Start the development server: `bun run dev:web`

The application will be available at [http://localhost:3000](http://localhost:3000).

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **AI**: Google Generative AI (Gemini)
- **Video Processing**: FFmpeg.wasm

## License

[MIT LICENSE](LICENSE)
