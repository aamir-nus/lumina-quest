# API Overview (v1)

Base paths:
- `/api`
- `/api/v1`

Key endpoints:
- `POST /auth/register`
- `POST /auth/login`
- `GET /games/public`
- `GET /games/mine`
- `POST /games`
- `PUT /games/:id`
- `POST /games/:id/publish`
- `POST /sessions/start`
- `GET /sessions/:sessionId`
- `GET /sessions/:sessionId/history`
- `POST /sessions/:sessionId/act`
- `POST /admin/games/:gameId/analyze`
- `POST /admin/games/:gameId/playtest`
- `GET /admin/observability/resolver`

Error format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```
