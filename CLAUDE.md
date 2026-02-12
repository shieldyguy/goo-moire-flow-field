# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm run dev          # Start dev server on http://localhost:8080
npm run build        # Production build to ./dist
npm run build:dev    # Dev build with source maps
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

No test framework is configured.

## Architecture

This is a **real-time interactive Moiré pattern generator** built with React 18 + TypeScript + Vite. It renders two configurable dot/line/square grid layers onto HTML Canvas, composites them, and applies a "goo effect" (blur + threshold) for organic visual output.

### Core Data Flow

**Index.tsx** (state owner) → **Canvas.tsx** (rendering + interaction) → **WebGLCanvas.tsx** (optional WebGL post-processing)

All application state lives in `src/pages/Index.tsx` as React hooks and flows down via props. There is no external state manager.

### Key Components

- **`src/pages/Index.tsx`** — Initializes settings state, parses URL preset parameter (`?p=...`), renders Canvas
- **`src/components/Canvas.tsx`** — Main rendering loop: draws two grid layers to offscreen canvases, composites them, applies goo effect via ImageData pixel manipulation. Handles mouse/touch offset tracking throttled to ~12 FPS
- **`src/components/WebGLCanvas.tsx`** — Hybrid renderer: uses Canvas 2D for drawing with optional WebGL post-processing via `webgl-image-filter.js` (loaded from `/public`). Falls back to pure Canvas 2D if WebGL unavailable
- **`src/components/ControlPanel.tsx`** — Animated settings panel (react-spring). Three sections: Layer 1, Layer 2, Effects. Includes preset export (copies shareable URL) and reset
- **`src/components/GestureHandler.tsx`** — Wraps Hammer.js (loaded via CDN in `index.html`) for pan, pinch-zoom, two-finger rotate, and double-tap gestures

### Settings Shape

Two layer configs (spacing, size, rotation, color, type), goo settings (enabled, blur, threshold, pre/post pixelate), and touch settings (pinch zoom/rotate toggles).

### Rendering Pipeline

1. Draw Layer 1 (base position) → offscreen canvas
2. Draw Layer 2 (with mouse/touch offset) → main canvas
3. Composite both → combined canvas
4. Apply goo effect (CSS filter blur + pixel-level threshold) → final render
5. Canvas uses 0.5x scale factor for performance on high-DPI displays

### Preset System

`src/lib/encoding/presetEncoder.ts` handles URL-safe Base64 encoding/decoding of settings with versioning (v0-v2) for backward compatibility. Presets are shared via `?p=<encoded>` URL parameter.

## Key Patterns

- **useThrottle hook**: Limits drag/touch update frequency to ~12 FPS for performance
- **Hammer.js via CDN**: Loaded in `index.html`, typed via `src/types/hammer.d.ts` — not an npm dependency
- **shadcn/ui**: 50+ Radix-based components in `src/components/ui/` — configured via `components.json`, path alias `@/` maps to `./src/`
- **TypeScript strict mode is OFF** (`noImplicitAny: false` in `tsconfig.app.json`)

## Build Output

Static Vite site built to `./dist`.
