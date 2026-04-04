# API Documentation (v1)

**Base URL:** `http://localhost:4000/api`

**Version:** Iteration 3 - LLM Integration Complete

---

## Table of Contents

- [Authentication](#authentication)
- [Games](#games)
- [Sessions](#sessions)
- [LLM Integration](#llm-integration)
- [Admin](#admin)
- [Error Format](#error-format)
- [Environment Configuration](#environment-configuration)

---

## Authentication

All endpoints except registration/login require authentication via:

- **Bearer token** in `Authorization` header
- **Cookie** (`auth_token`) with `httpOnly` flag

### Endpoints

| Method   | Endpoint           | Description            |
| -------- | ------------------ | ---------------------- |
| `POST` | `/auth/register` | Register new user      |
| `POST` | `/auth/login`    | Login existing user    |
| `POST` | `/auth/logout`   | Logout (clears cookie) |
| `GET`  | `/auth/me`       | Get current user info  |

### Register Request

```json
{
  "email": "user@example.com",
  "password": "password123",
  "role": "user"
}
```

### Register Response

```json
{
  "token": "jwt-token-string",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "role": "user"
  }
}
```

**Sets cookie:** `auth_token` (httpOnly, secure=false in dev)

---

## Games

### Endpoints

| Method   | Endpoint                          | Description       | Auth  |
| -------- | --------------------------------- | ----------------- | ----- |
| `GET`  | `/games/public?page=1&limit=20` | List public games | None  |
| `GET`  | `/games/mine?page=1&limit=20`   | List my games     | User  |
| `POST` | `/games`                        | Create game draft | Admin |
| `PUT`  | `/games/:id`                    | Update game draft | Admin |
| `POST` | `/games/:id/publish`            | Publish game      | Admin |

### Game Schema

```json
{
  "title": "The Crystal Cave",
  "description": "An adventure game",
  "constraints": {
    "maxTurns": 100,
    "targetPoints": 50
  },
  "wildcardConfig": {
    "enabled": false,
    "recoverySceneId": "",
    "highRewardPoints": 2,
    "lowRewardPoints": 0
  },
  "startSceneId": "entrance",
  "scenes": [
    {
      "sceneId": "entrance",
      "narrative": "You stand at the entrance...",
      "imageKey": "",
      "isTerminal": false,
      "renderConfig": {
        "theme": "pastel",
        "backgroundLayers": [],
        "foregroundLayers": [],
        "sprite": {
          "id": "hero",
          "mood": "neutral",
          "x": 0.5,
          "y": 0.82
        }
      },
      "avenues": [
        {
          "avenueId": "enter_cave",
          "label": "Enter the cave",
          "keywords": ["enter", "go", "in", "cave"],
          "points": 1,
          "nextSceneId": "chamber",
          "visualEffects": {
            "transition": "fade",
            "spriteMood": "",
            "setTheme": "",
            "enableLayers": [],
            "disableLayers": []
          }
        }
      ]
    }
  ]
}
```

### Create Game Response

```json
{
  "game": {
    "_id": "game-id",
    "title": "The Crystal Cave",
    "status": "draft",
    "adminId": "admin-id",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## Sessions

### Endpoints

| Method   | Endpoint                         | Description            | Auth |
| -------- | -------------------------------- | ---------------------- | ---- |
| `POST` | `/sessions/start`              | Start new game session | User |
| `GET`  | `/sessions/:sessionId`         | Get session state      | User |
| `GET`  | `/sessions/:sessionId/history` | Get session history    | User |
| `POST` | `/sessions/action`             | Submit player action   | User |

### Start Session Request

```json
{
  "gameId": "game-id",
  "playerId": "player-name"
}
```

### Start Session Response

```json
{
  "session": {
    "_id": "session-id",
    "gameId": "game-id",
    "userId": "user-id",
    "currentSceneId": "entrance",
    "status": "active",
    "stats": {
      "points": 0,
      "turnsUsed": 0
    },
    "visualState": {
      "theme": "pastel",
      "activeLayers": [],
      "spriteMood": "neutral",
      "transition": "fade"
    },
    "history": []
  },
  "game": {
    "_id": "game-id",
    "title": "The Crystal Cave",
    "startSceneId": "entrance"
  },
  "currentScene": {
    "sceneId": "entrance",
    "narrative": "You stand at the entrance...",
    "isTerminal": false,
    "avenues": [...]
  }
}
```

### Submit Action Request

```json
{
  "sessionId": "session-id",
  "userInput": "I want to explore the cave",
  "tone": "cinematic"
}
```

**`userInput`**: Free-form natural language text (max 500 chars)
**`tone`**: `"cinematic"` | `"plain"` | `"dramatic"` (default: `"cinematic"`)

### Submit Action Response

```json
{
  "session": {
    "_id": "session-id",
    "currentSceneId": "chamber",
    "status": "active",
    "stats": {
      "points": 3,
      "turnsUsed": 2
    },
    "visualState": {...},
    "history": [...]
  },
  "currentScene": {
    "sceneId": "chamber",
    "narrative": "The crystal chamber glows...",
    "isTerminal": false,
    "avenues": [...]
  },
  "resolution": {
    "type": "avenue",
    "selectedAvenueId": "enter_cave",
    "wildcardMode": null,
    "confidence": 0.95,
    "explanation": "The player clearly wants to explore the cave.",
    "narration": "You step into the darkness...",
    "llm": {
      "provider": "lmstudio",
      "tokens": {
        "inputTokens": 315,
        "outputTokens": 180,
        "totalTokens": 495
      },
      "computeApprox": {
        "latencyMs": 8500.5,
        "cpuUserMs": 125.3,
        "cpuSystemMs": 32.1,
        "rssMb": 95.4,
        "heapUsedMb": 31.2
      }
    },
    "traceId": "trace_1775238415912_eqimbl"
  }
}
```

---

## LLM Integration

The game uses LLMs for **intent classification only** - they map player input to authored game routes, not content generation.

### Supported Providers

#### 1. LMStudio (Local Inference)

**Recommended for development and local play**

```bash
# .env configuration
LLM_PROVIDER=lmstudio
LMSTUDIO_BASE_URL=http://127.0.0.1:1234/v1
LMSTUDIO_API_KEY=lm-studio
LMSTUDIO_MODEL=google/gemma-3-4b
```

**Setup:**

1. Install [LMStudio](https://lmstudio.ai/)
2. Load a model (e.g., `google/gemma-3-4b`)
3. Start the LMStudio server (runs on port 1234)

**Advantages:**

- Free
- Private (data stays local)
- Fast (no network latency)
- No rate limits

**Tested Models:**

- `google/gemma-3-4b` (4B parameters) - Good balance of speed and quality
- `meta-llama/llama-3.2-3b-instruct:free` (via OpenRouter)

#### 2. OpenRouter (External API)

**Good for production without local GPU**

```bash
# .env configuration
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENROUTER_MODEL=openrouter/free
OPENROUTER_SITE_URL=http://localhost:5173
OPENROUTER_SITE_NAME=LuminaQuest
```

**Advantages:**

- No local compute required
- Access to many models
- Pay-per-use pricing

### LLM Processing Pipeline

```
Player Input → classifyRoute() → generateNarration() → Response
                 (intent)           (flavor text)
```

#### Stage 1: Intent Classification

**Input:**

- Game title
- Scene narrative
- Player input
- Available avenues (labels + keywords)
- Recent turn history
- Wildcard enabled flag

**Confidence Calibration:**

| Confidence Range | When Used                                |
| ---------------- | ---------------------------------------- |
| 0.9-1.0          | Exact keyword/phrase match               |
| 0.7-0.9          | Strong semantic match                    |
| 0.5-0.7          | Moderate confidence (vague but clear)    |
| 0.3-0.5          | Low confidence (needs clarification)     |
| 0.0-0.3          | Very low confidence (completely unclear) |

**Output:**

```json
{
  "routeType": "avenue|wildcard|clarification",
  "avenueId": "avenue-id-or-null",
  "confidence": 0.95,
  "explanation": "The player wants to explore...",
  "wildcard": {
    "mode": "high-reward|low-reward",
    "destinationSceneId": "optional"
  }
}
```

#### Stage 2: Narration Generation

**Input:**

- Game title
- New scene narrative
- Player input
- Resolution type
- Selected route label
- Tone

**Output:**

```json
{
  "text": "You venture deeper into the cave...",
  "provider": "lmstudio",
  "usage": {
    "inputTokens": 180,
    "outputTokens": 45,
    "totalTokens": 225
  }
}
```

### Fallback Behavior

**When LLM is unavailable:**

- Falls back to heuristic classification (keyword matching)
- Returns simple narration without LLM
- System continues to work deterministically

**Heuristic Logic:**

```javascript
// Exact keyword or label match → 82% confidence
// No match → 56% confidence (wildcard candidate)
// Short input → request clarification
```

### Debug Logging

The server logs all LLM operations with emoji markers:

```
[GAME_ENGINE] 🎮 Processing action...
[GAME_ENGINE] 👤 User Input: "I want to explore"
[GAME_ENGINE] 🎲 Game: The Crystal Cave | Turn: 1
[GAME_ENGINE] 📍 Current Scene: entrance

[LLM_CLASSIFY] 🎯 Starting classification...
[LLM_CLASSIFY] 📖 Input: "I want to explore"
[LLM_CLASSIFY] 📍 Available avenues: Enter cave, Turn back
[LLM_RESOLVER] ✅ Using LMStudio: http://127.0.0.1:1234/v1 | Model: google/gemma-3-4b
[LLM_CLASSIFY] 🔄 Calling LLM provider...
[LLM_CLASSIFY] ✅ Got LLM response, parsing...
[LLM_CLASSIFY] 📊 Result: routeType=avenue, avenueId=enter_cave, confidence=0.95
[LLM_CLASSIFY] ⏱️  Latency: 8500.5ms | Tokens: 495

[GAME_ENGINE] ➡️  Resolution: avenue -> chamber (+1 points)

[LLM_NARRATE] ✍️  Generating narration...
[LLM_NARRATE] 📝 Resolution: avenue | Route: Enter cave | Tone: cinematic
[LLM_NARRATE] 🔄 Calling LLM provider...
[LLM_NARRATE] ✅ Got LLM response, parsing...
[LLM_NARRATE] 📖 Narration: "You step into the darkness..."
[LLM_NARRATE] ⏱️  Latency: 3200.0ms | Tokens: 225

[GAME_ENGINE] 💾 Session saved | Status: active | Points: 1
```

---

## Admin

### Endpoints

| Method   | Endpoint                          | Description        | Auth  |
| -------- | --------------------------------- | ------------------ | ----- |
| `POST` | `/admin/games/:gameId/analyze`  | Analyze game graph | Admin |
| `POST` | `/admin/games/:gameId/playtest` | Playtest game      | Admin |
| `GET`  | `/admin/observability/resolver` | Get LLM metrics    | Admin |

### Observability Response

```json
{
  "provider": "lmstudio",
  "providerOptions": ["lmstudio", "openrouter"],
  "metrics": {
    "total": 15,
    "avenue": 12,
    "wildcard": 1,
    "clarification": 2,
    "fallbacks": 0,
    "providerErrors": 0,
    "mockResponses": 0,
    "inputTokens": 4523,
    "outputTokens": 1820,
    "totalTokens": 6343,
    "llmCalls": 15,
    "rates": {},
    "computeApprox": {
      "samples": 15,
      "avgLatencyMs": 7200.3,
      "avgCpuUserMs": 98.5,
      "avgCpuSystemMs": 24.2,
      "avgRssMb": 102.1,
      "avgHeapUsedMb": 35.8,
      "latest": {
        "latencyMs": 6500.2,
        "cpuUserMs": 85.3,
        "cpuSystemMs": 20.1
      }
    }
  },
  "traces": [
    {
      "traceId": "trace_1775238415912_eqimbl",
      "timestamp": "2024-04-04T00:00:00.000Z",
      "result": "avenue",
      "provider": "lmstudio",
      "spans": [...]
    }
  ]
}
```

---

## Error Format

All errors follow this structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {},
    "requestId": "uuid"
  }
}
```

### Common Error Codes

| Code                      | Status | Description                                 |
| ------------------------- | ------ | ------------------------------------------- |
| `INVALID_INPUT`         | 400    | Request body validation failed              |
| `INVALID_GAME_PAYLOAD`  | 400    | Game schema validation failed               |
| `INVALID_GAME_ID`       | 400    | Invalid MongoDB ObjectId                    |
| `INVALID_SESSION_ID`    | 400    | Invalid MongoDB ObjectId                    |
| `EMAIL_EXISTS`          | 409    | Email already registered                    |
| `SESSION_NOT_FOUND`     | 404    | Session not found or doesn't belong to user |
| `GAME_NOT_FOUND`        | 404    | Game not found                              |
| `SESSION_FINISHED`      | 409    | Session already completed                   |
| `MISSING_TOKEN`         | 401    | No auth token provided                      |
| `INVALID_TOKEN`         | 401    | Token expired or invalid                    |
| `FORBIDDEN`             | 403    | Insufficient permissions                    |
| `CORS_ORIGIN_MISSING`   | 403    | No Origin header (for requests)             |
| `INTERNAL_SERVER_ERROR` | 500    | Server error                                |

### Tracing

All responses include:

- `x-request-id` response header
- `requestId` field in error responses

Use these for debugging and support.

---

## Environment Configuration

### Required Variables

```bash
# Server
PORT=4000
NODE_ENV=development

# Database
MONGO_URI=mongodb://127.0.0.1:27017/luminaquest

# Authentication
JWT_SECRET=your-secret-key-min-24-chars

# CORS
CLIENT_ORIGIN=http://localhost:5173
CORS_ALLOW_NO_ORIGIN=false
```

### LLM Provider Configuration

#### LMStudio (Local)

```bash
LLM_PROVIDER=lmstudio
LMSTUDIO_BASE_URL=http://127.0.0.1:1234/v1
LMSTUDIO_API_KEY=lm-studio
LMSTUDIO_MODEL=google/gemma-3-4b
```

#### OpenRouter (External)

```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENROUTER_MODEL=openrouter/free
OPENROUTER_SITE_URL=http://localhost:5173
OPENROUTER_SITE_NAME=LuminaQuest
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

### Optional Variables

```bash
# Request limits
REQUEST_JSON_LIMIT=256kb

# MongoDB connection
MONGO_CONNECT_RETRIES=5
MONGO_CONNECT_RETRY_DELAY_MS=2000

# Langfuse (optional tracing)
LANGFUSE_HOST=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
```

---

## Rate Limiting

| Endpoint             | Limit    | Window |
| -------------------- | -------- | ------ |
| `/sessions/action` | 100 req  | 15 min |
| Auth endpoints       | 1000 req | 15 min |

Rate limit headers are included in responses:

- `RateLimit-Limit`
- `RateLimit-Remaining`
- `RateLimit-Reset`

---

## WebSocket / Real-time

**Not yet implemented.** Future versions may include WebSocket support for real-time game updates.

---

## Testing

### Backend Tests

```bash
cd server
npm test
```

### Smoke Test

```bash
node server/smoke-test.js
```

### Backend Walkthrough

```bash
node server/walkthrough.js
```

### Confidence Calibration Test

```bash
node server/test-confidence.js
```

---

## Support

For issues or questions:

1. Check server logs for detailed error messages
2. Use the `/admin/observability/resolver` endpoint to inspect LLM metrics
3. Enable debug logging to trace LLM calls
4. Check `.env` configuration matches your setup
