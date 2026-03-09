# Iteration 3 Summary

## Delivered
- Scene presentation pipeline moved to layered 8-bit style components.
- Turn resolution now carries and persists visual state deltas from authored scene/avenue config.
- Added ending grading panel and richer transition overlays.
- Added configurable provider switch for LLM inference:
  - `LLM_PROVIDER=openrouter`
  - `LLM_PROVIDER=lmstudio`
- Added UI widgets for:
  - token usage (input/output/total)
  - compute/memory approximation during LLM requests

## Issues Faced and Solved
- Needed visual-state continuity between backend and frontend.
  - Solved by introducing `session.visualState` and applying deltas in session engine.
- Needed local-provider support without destabilizing existing OpenRouter behavior.
  - Solved via provider abstraction in resolver with env-driven switch.
- Needed minimal-risk presentation polish.
  - Solved via composable stage components (`GameStage`, `SceneTransitionOverlay`, `EndingPanel`).

## Issues Faced But Not Delivered
- MLX direct runtime integration not implemented.
- WebGPU direct runtime integration not implemented.
- Docker image build execution could not be fully verified in this sandbox (`docker.sock` unavailable).

## Why Not Delivered
- Added only one on-device provider (`lmstudio`) this pass to keep implementation stable and avoid broad runtime complexity across platforms.

## Recommended Next Step
- Add MLX and/or WebGPU provider adapters behind the same `LLM_PROVIDER` contract with shared eval tests.
