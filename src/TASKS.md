# TASKS.md

> Backlog for the AI agent and the team. Pick the top 3 every morning.

## Now (today)
- [ ] TASK-001 — title — owner — acceptance criteria
- [ ] TASK-002 — title — owner — acceptance criteria
- [ ] TASK-003 — title — owner — acceptance criteria

## Next
- [ ] TASK-010 — title — owner — acceptance criteria

## Backlog
- [ ] TASK-020 — title — owner — acceptance criteria
- [ ] TASK-021 — title — owner — acceptance criteria

## Done
- [x] TASK-000 — AGENTS.md setup — AI Agent — Finished 2026-06-17
- [x] TASK-100 — Local TM Model Integration — AI Agent — Finished 2026-06-17
  - Added `LOCAL_MODEL` to `ControllerMode` enum in `types.ts`
  - Copied model files to `public/model/` (model.json, metadata.json, weights.bin)
  - `WebcamController.tsx`: new **🎭 Local Model** tab auto-loads `/model/` on switch
  - Prediction: `happy` → JUMP (≥0.65), `sad` → CROUCH (≥0.65), `angry` → ignored
  - Live confidence bars with emoji labels (😄/😢/😠) displayed in the new panel
