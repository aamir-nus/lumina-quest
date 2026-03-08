# Iteration 2 Execution Plan (Dynamic Intelligence + Observability)

## Alignment Check Against PRD
- [x] Keep authored scene graph as source of truth
- [x] Keep server-authoritative turn resolution
- [x] Add bounded wildcard behavior (no invented scenes)
- [x] Add explainable route outcomes for players
- [x] Add admin ergonomics (graph analysis + playtest)
- [x] Add resolver observability and fallback reporting

## Backend Workstream
- [x] Add wildcard configuration fields to game model
- [x] Add playtest/session metadata fields to session model
- [x] Implement `WildcardPolicyService` (destination + reward clamp)
- [x] Refactor resolver into two-stage pipeline (classify -> narrate)
- [x] Add provider fallback + route counters metrics service
- [x] Add tracing hooks service (Otel-shaped + optional Langfuse sink)
- [x] Extend session action API response with route explanation contract
- [x] Add `POST /api/admin/games/:gameId/analyze`
- [x] Add `POST /api/admin/games/:gameId/playtest`
- [x] Add replay/history endpoint enhancements

## Frontend Workstream
- [x] Add admin graph visualization panel
- [x] Add admin analysis report rendering
- [x] Add admin playtest launcher (from arbitrary scene)
- [x] Add player replay timeline panel
- [x] Add resolution badge + explanation surface
- [x] Add objective tracker and quick intent chips
- [x] Add richer transition/feedback animations

## Verification & Handover
- [x] Run server syntax checks and web production build
- [x] Verify no frontend direct DB access regressions
- [x] Update iteration checklist with completed items
- [x] Update README with Iteration 2 architecture/status
- [x] Add Iteration 2 summary/handoff context for Iteration 3
