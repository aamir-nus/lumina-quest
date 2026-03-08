# LuminaQuest

Turn-based MERN story engine where authored branches stay deterministic and LLMs map free-form player intent to valid avenues.

## Project Context

```mermaid
flowchart LR
  A["Admin Forge"] --> B["Game Template (Scenes + Avenues)"]
  B --> C["Publish Validation"]
  C --> D["Public Game Library"]
  D --> E["Player Session"]
  E --> F["LLM Intent Resolver"]
  F --> G["Server-Validated Avenue"]
  G --> H["Session State Update (Points/Turns/History)"]
```

## Iteration Status

```mermaid
flowchart TD
  I1["Iteration 1: Playable Story Engine MVP"] --> S1["Stable"]
  I2["Iteration 2: Narrative Intelligence + Observability"] --> S2["Planned"]
  I3["Iteration 3: 8-Bit Visual Presentation"] --> S3["Planned"]
```

- Iteration 1 delivered now:
  - Express + Mongo core APIs (auth, game CRUD/publish, session action engine)
  - Async OpenRouter resolver adapter with OpenAI Responses-style mock fallback
  - Minimal React UI for admin publish flow and player gameplay loop
  - Stability pass: Mongo connect retry + diagnostics, Docker Mongo workflow, ObjectId input hardening
- Iteration checklist: [`docs/ITERATION_CHECKLIST.md`](/Users/aamirsyedaltaf/Documents/lumina-quest/docs/ITERATION_CHECKLIST.md)

## Entrypoints

```mermaid
flowchart LR
  A["MongoDB (local)"] --> B["Server :4000"]
  B --> C["Web :5173"]
  C --> B
```

Data access rule:
- Web app does not connect to MongoDB directly. All persistence operations are server-side via `server/src/*` routes/services/models.

Setup:
1. Install dependencies: `npm install`
2. Configure env: copy `.env.example` to `.env`
3. Start MongoDB: `npm run mongo:up`
4. Run API: `npm run dev:server`
5. Run web app: `npm run dev:web`
6. (Optional) Inspect DB container: `npm run mongo:logs`

Mongo reliability notes:
- Server retries Mongo connection using `MONGO_CONNECT_RETRIES` and `MONGO_CONNECT_RETRY_DELAY_MS`.
- Health endpoint includes db status: `GET /health` -> `db.state` / `db.readyState`.

## OpenRouter Notes

The server uses OpenRouter via OpenAI-compatible SDK configuration:
- Base URL: `https://openrouter.ai/api/v1`
- Headers: `HTTP-Referer`, `X-Title`
- Model strategy: use free routes (`openrouter/free`) or explicit `:free` model slugs.

References:
- [OpenRouter API Overview](https://openrouter.ai/docs/api-reference/overview)
- [OpenRouter Quickstart](https://openrouter.ai/docs/quickstart)
- [OpenRouter Models (free examples)](https://openrouter.ai/models?q=free)
