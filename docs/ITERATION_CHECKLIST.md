# LuminaQuest Iteration Checklist

## Iteration 1 - Playable Story Engine MVP
- [x] Initialize workspace structure (`server`, `web`, `docs`)
- [x] Install core dependencies for server and web
- [x] Implement backend foundation (Express + Mongo models + auth)
- [x] Implement game CRUD + publish validation
- [x] Implement session start + action resolution engine
- [x] Implement async OpenRouter LLM resolver with mock fallback
- [x] Implement minimal Admin Forge UI
- [x] Implement minimal Player Journey UI
- [x] Add smoke-test/run verification and known limits
- [x] Stabilize Mongo startup (retry strategy + diagnostics)
- [x] Add local Mongo runtime workflow (`docker compose` helper scripts)
- [x] Harden API ID validation (`gameId`/`sessionId`) for safer error handling
- [x] Confirm DB operations remain backend-only (frontend uses API layer only)
- [x] Update README with mermaid architecture + iteration status
- [x] Summarize Iteration 1 learnings/context for Iteration 2

## Iteration 2 - Narrative Intelligence & Observability
- [x] Add bounded wildcard policy service (server-authoritative)
- [x] Add provider fallback tracking and metrics surface
- [x] Add Langfuse/OpenTelemetry-style trace hooks for resolver pipeline
- [x] Add admin graph visualization + playtest from arbitrary scene
- [x] Add player-side route explanation and replay panel
- [x] Add two-stage route pipeline (classify -> policy validate -> narrate)
- [x] Add graph analysis endpoint and UI output
- [x] Update README with iteration status and flow diagram
- [x] Summarize Iteration 2 learnings/context for Iteration 3

## Iteration 3 - 8-bit Presentation Layer
- [ ] Add scene render config and visual state deltas in backend
- [ ] Build layered 8-bit stage components in frontend
- [ ] Add stateful transition effects tied to avenue resolution
- [ ] Add ending grading/cutscene views
- [ ] Update README with final architecture and entrypoints
