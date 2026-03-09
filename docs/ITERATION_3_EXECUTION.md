# Iteration 3 Execution Plan (Presentation Layer + Local LLM Bridge)

## Alignment Snapshot
- [x] Iteration 1 and 2 are stable/hardened
- [x] Iteration 3 focus remains visual presentation + game feel polish
- [x] Backend authority and authored graph constraints remain non-negotiable

## Backend - Visual State & Provider Switch
- [x] Extend scene model with `renderConfig` for layered presentation
- [x] Extend avenue model with `visualEffects` metadata
- [x] Extend session model with persisted `visualState`
- [x] Apply visual deltas on action resolution in session engine
- [x] Add LLM provider switch (`openrouter` + `lmstudio`) via env config
- [x] Keep OpenRouter path intact as historical external API fallback
- [x] Document provider setup and limits

## Frontend - 8-bit Stage Experience
- [x] Build `GameStage` layer renderer (background/foreground/sprite)
- [x] Build `SceneTransitionOverlay` for route-driven transitions
- [x] Build `EndingPanel` with victory/defeat grading
- [x] Integrate stage into player flow with response-driven visual state
- [x] Add pixel UI polish (typography, borders, transitions, chips)
- [x] Add token usage widget (admin + player views)
- [x] Add compute/memory approximation widget for LLM calls

## QA / Deployability
- [x] Validate server tests + syntax checks + web build
- [x] Add/update Docker build instructions for linux/amd64, linux/arm64
- [x] Keep image footprint lightweight and avoid build artifacts in git
- [ ] Validate Docker image build execution in current sandbox (blocked: Docker daemon unavailable)

## Handover Artifacts
- [x] Update iteration checklist and implementation plan status
- [x] Add Iteration 3 summary with delivered items/blockers
- [x] Update README with Iteration 3 diagrams + run/build instructions
- [x] Add Mermaid UI mockups for workflow expectations
- [x] Create `for-admin.md`
- [x] Create `for-user.md`

## Blockers / Partials
- [ ] Native MLX backend integration not shipped in this pass.
- [ ] Native WebGPU backend integration not shipped in this pass.
- [ ] Docker daemon unavailable in sandbox for full image build verification.

Reason:
- To avoid overengineering and keep release quality high, this pass ships one on-device provider (`lmstudio`) plus external OpenRouter, behind a config switch. MLX/WebGPU remain roadmap items.
