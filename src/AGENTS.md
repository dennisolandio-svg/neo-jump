# Neo-Runner 8-Bit: Agentic Coding Guidelines

Welcome, Agent! This document acts as your primary system instruction and project overview. Read this file carefully before performing code modifications, refactoring, or feature additions on **Neuro-Runner 8-Bit (Neo-Jump)**.

---

## 🎮 Project Overview & Architecture

**Neuro-Runner 8-Bit** is a retro-brutalist web runner game built with **React, TypeScript, Vite, and Tailwind CSS**. It features a canvas-based rendering engine and webcam gesture-based controllers using both custom built-in motion classification and Google Teachable Machine models.

### Directory Map

*   [`src/App.tsx`](file:///c:/Users/DTC%20USER/Desktop/dennis/neo-jump/src/App.tsx): Root layout coordinating application state (Score, GameState, Active Action, Controller Mode).
*   [`src/types.ts`](file:///c:/Users/DTC%20USER/Desktop/dennis/neo-jump/src/types.ts): Main type definitions for the game loops, obstacles, coins, particles, and models.
*   [`src/components/RetroGameCanvas.tsx`](file:///c:/Users/DTC%20USER/Desktop/dennis/neo-jump/src/components/RetroGameCanvas.tsx): Core game loop, canvas rendering, obstacle physics, collision logic, and animation.
*   [`src/components/WebcamController.tsx`](file:///c:/Users/DTC%20USER/Desktop/dennis/neo-jump/src/components/WebcamController.tsx): WebRTC Camera pipeline, pixel scaling for built-in motion sensing, and TF.js / Teachable Machine client.
*   [`src/utils/audio.ts`](file:///c:/Users/DTC%20USER/Desktop/dennis/neo-jump/src/utils/audio.ts): Synthesized sound effect generator utilizing the browser's Web Audio API.

---

## 🛠️ Tech Stack & Stylistic Guide

When creating or modifying components, maintain these strict guidelines:

### 1. Retro Brutalist Aesthetic
*   **Borders**: Always use sharp, thick borders (`border-4 border-black` or `border-2 border-black`).
*   **Shadows**: Use custom brutalist flat shadow styling (`shadow-brutal` or `shadow-brutal-sm` / custom utility).
*   **Color Palette**: Vibrant, high-contrast retro colors (`#FFD700` Yellow, `#FF4444` Red, `#3b82f6` Blue, `#9c27b0` Purple, `#2e7d32` Green). Avoid pastel or muted modern colors unless styling secondary background states.
*   **Typography**: Stick to monospace font scales (`font-mono`) to highlight the retro game theme.

### 2. State & Engine Performance
*   **Canvas Drawing**: Avoid heavy computations inside the canvas `requestAnimationFrame` loop. Keep layout-based operations outside of drawing frames.
*   **React State vs. Canvas State**: React state should only track high-level statistics, game states, and user config. Frame-by-frame physics (x/y coordinates, velocities) must be mutated directly on canvas refs or inside closure objects to avoid rendering bottleneck lags.
*   **Audio Synthesis**: Do not load large `.mp3` files. All audio must be synthesized dynamically on-the-fly using standard oscillators via `src/utils/audio.ts`.

---

## 🤖 AI Agent Workflow & Protocol

To collaborate effectively with the developer and other agents, follow this protocol:

### Step 1: Read & Sync Files
Prior to making changes, check:
1.  [`src/TASKS.md`](file:///c:/Users/DTC%20USER/Desktop/dennis/neo-jump/src/TASKS.md): Read the list of tasks to see what is currently in-progress or requested.
2.  [`src/PROMPTS.md`](file:///c:/Users/DTC%20USER/Desktop/dennis/neo-jump/src/PROMPTS.md): Check if there are specialized developer prompts or system instructions curated for specific files.

### Step 2: Track Progress
When executing a task:
*   Mark the status of items in `src/TASKS.md` (e.g. `[ ]` for pending, `[/]` for in-progress, `[x]` for completed).
*   Document major engineering choices, API integrations, and code changes in `src/TASKS.md`.

### Step 3: Verify the Changes
*   Run the TypeScript linter using `npm run lint`.
*   Ensure that there are no canvas render loops leaks, Web Audio API context blocks, or memory leaks from camera tracks.
