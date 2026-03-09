# API Overview (v1)

Base paths:
- `/api`
- `/api/v1`

## Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me` (cookie or bearer auth required)

## Games
- `GET /games/public`
- `GET /games/mine`
- `POST /games`
- `PUT /games/:id`
- `POST /games/:id/publish`

Game schema (core additions):
- `scenes[].renderConfig`
- `scenes[].avenues[].visualEffects`

## Sessions
- `POST /sessions/start`
- `GET /sessions/:sessionId`
- `GET /sessions/:sessionId/history`
- `POST /sessions/action`

`POST /sessions/action` request:
```json
{
  "sessionId": "mongo-id",
  "userInput": "free form player text",
  "tone": "cinematic"
}
```

`POST /sessions/action` response (important contract):
```json
{
  "session": {},
  "currentScene": {},
  "resolution": {
    "type": "avenue|wildcard|clarification",
    "selectedAvenueId": "string|null",
    "wildcardMode": "high-reward|low-reward|null",
    "confidence": 0.72,
    "explanation": "why this route happened",
    "narration": "player-facing text",
    "llm": {
      "provider": "openrouter|lmstudio",
      "tokens": {
        "inputTokens": 123,
        "outputTokens": 45,
        "totalTokens": 168
      },
      "computeApprox": {
        "latencyMs": 420.5,
        "cpuUserMs": 12.7,
        "cpuSystemMs": 3.2,
        "rssMb": 180.1,
        "heapUsedMb": 48.4
      }
    },
    "traceId": "trace_x"
  }
}
```

## Admin
- `POST /admin/games/:gameId/analyze`
- `POST /admin/games/:gameId/playtest`
- `GET /admin/observability/resolver`

`GET /admin/observability/resolver` response (important contract):
```json
{
  "provider": "openrouter|lmstudio",
  "providerOptions": ["openrouter", "lmstudio"],
  "metrics": {
    "total": 0,
    "avenue": 0,
    "wildcard": 0,
    "clarification": 0,
    "fallbacks": 0,
    "providerErrors": 0,
    "mockResponses": 0,
    "inputTokens": 0,
    "outputTokens": 0,
    "totalTokens": 0,
    "llmCalls": 0,
    "rates": {},
    "computeApprox": {
      "samples": 0,
      "avgLatencyMs": 0,
      "avgCpuUserMs": 0,
      "avgCpuSystemMs": 0,
      "avgRssMb": 0,
      "avgHeapUsedMb": 0,
      "latest": {}
    }
  },
  "traces": []
}
```

## Error Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

All API responses include `x-request-id` response header for tracing.
