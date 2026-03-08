# Iteration 1 Summary

## What Was Built
- End-to-end MVP path for authored story playthrough:
  - admin creates/publishes game templates
  - player starts session and submits free-text turns
  - backend resolves action to authored avenue and updates points/turns/history
- Async LLM adapter for OpenRouter using OpenAI-compatible Responses API call style.
- Mock fallback output in OpenAI Responses-like shape when key/provider call is unavailable.

## Verification Notes
- `npm run build -w web` passes.
- Server runtime requires reachable MongoDB (`MONGO_URI`, default `mongodb://127.0.0.1:27017/luminaquest`).
- Stability pass added Mongo connection retries + clearer startup diagnostics.
- Local Mongo bootstrap is now standardized via `npm run mongo:up` (Docker compose).
- Health endpoint now reports DB readiness (`/health`).

## Learnings
- Clear authored avenue IDs plus strict JSON mapping keeps turn resolution deterministic.
- Async provider abstraction allows future streaming and fallback policy upgrades without route changes.
- Starter game seeding in UI accelerates manual acceptance testing for Admin + Player flows.
- Keeping database access strictly backend-only simplifies security and deployment boundaries.

## Context for Iteration 2
- Add bounded wildcard policy only as a server-approved bridge (never model-authored scene creation).
- Add observability around resolver confidence/fallback paths (Langfuse/Otel hooks).
- Improve admin authoring with graph-level balancing diagnostics and draft playtest tools.
