# for-admin.md

## Goal
Use LuminaQuest admin tools to author, validate, publish, and playtest deterministic story games.

## Quick Start
1. Register/login as `admin`.
2. Create a game template (or use starter game).
3. Open Graph view and inspect scene links.
4. Run Analyze to detect unreachable scenes/dead ends.
5. (Optional) Start Playtest from any scene.
6. Publish once graph and scoring are balanced.

## Authoring Tips
- Keep 2+ avenues on non-terminal scenes.
- Define `renderConfig` per scene for visual consistency.
- Define avenue `visualEffects` to drive transitions/mood.
- Use wildcard cautiously with recovery scene configured.

## LLM Provider
- External: `LLM_PROVIDER=openrouter`
- On-device: `LLM_PROVIDER=lmstudio`

## Do/Don’t
- Do keep authored graph as source of truth.
- Don’t rely on LLM to invent routes/scenes.
