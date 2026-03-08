# Iteration 2 Hardening Checklist

## Security
- [x] Add Helmet security headers
- [x] Add global API rate limiting and stricter auth rate limits
- [x] Remove weak JWT default and fail-fast on missing/short secret
- [x] Add request body size limits
- [x] Add request sanitization middleware for params/query/body
- [x] Move API base URL to env (`VITE_API_BASE_URL`)

## Error Handling & Stability
- [x] Replace bare catches with logged catches in services
- [x] Add centralized async route handling (`asyncHandler`)
- [x] Add standardized API error model + error middleware
- [x] Move auth token side-effect from render into `useEffect`
- [x] Wrap localStorage operations in safe helpers
- [x] Add React error boundary
- [x] Improve backend structured logging

## Maintainability
- [x] Split monolithic `web/src/App.jsx` into components
- [x] Refactor large session route handler into `sessionEngineService`
- [x] Extract auth constants (salt rounds/JWT expiry)
- [x] Add QueryClient default config
- [x] Add Mongoose email format validation
- [x] Add compound indexes for primary query paths
- [x] Enforce unique `sceneId` values per game template
- [x] Remove unused dependency (`zustand`)

## Production Readiness
- [x] Add basic backend test infrastructure (`node:test`)
- [x] Add CI workflow for test/build/syntax checks
- [x] Add Dockerfiles for server and web + `.dockerignore`
- [x] Add API docs entrypoint (`docs/API.md`)
- [x] Add API version alias (`/api/v1`)

## Verification
- [x] `npm run test:server`
- [x] `npm run build -w web`
- [x] backend syntax checks on updated modules
