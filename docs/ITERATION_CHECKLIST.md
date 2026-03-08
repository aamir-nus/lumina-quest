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
- [x] Update README with mermaid architecture + iteration status
- [x] Summarize Iteration 1 learnings/context for Iteration 2

## Iteration 2 - Narrative Intelligence & Observability
- [ ] Add bounded wildcard policy service (server-authoritative)
- [ ] Add provider fallback tracking and metrics surface
- [ ] Add Langfuse/OpenTelemetry trace hooks for resolver pipeline
- [ ] Add admin graph visualization + playtest from arbitrary scene
- [ ] Add player-side route explanation and replay panel
- [ ] Update README with iteration status and flow diagram

## Iteration 3 - 8-bit Presentation Layer
- [ ] Add scene render config and visual state deltas in backend
- [ ] Build layered 8-bit stage components in frontend
- [ ] Add stateful transition effects tied to avenue resolution
- [ ] Add ending grading/cutscene views
- [ ] Update README with final architecture and entrypoints
