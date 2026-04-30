# FE Review & BE Plan

## Frontend Review

The frontend is already close to a usable internal product, but it currently carries too much responsibility for critical setup state. Onboarding completion, admin-session flow, and provider settings were stored in browser-scoped client storage, which created divergence between `localhost:5173` and `localhost:8080`. That made the UI look inconsistent even when the code was otherwise aligned.

Against the project rubric, the frontend should be defended not only as functional UI, but as a deliberate experience with intuitive navigation, consistent styling, visible validation, and a few distinctive interaction patterns beyond baseline forms.

The main frontend priorities should be:

- Reduce port-scoped state where parity matters.
- Keep login, onboarding, and settings transitions fully deterministic.
- Improve setup and auth error copy so users know whether the problem is credentials, cookies, server reachability, or provider validation.
- Add lightweight visibility into active runtime config so debugging is easier without opening devtools.
- Keep the frontend feature list explicit in the README so evaluation can quickly identify the project's UI contributions.

## Backend Review

The backend contract is generally solid, especially around cookie-first auth, CORS enforcement, and environment-driven provider setup. The main issue was deployment-mode behavior leaking into local Docker usage. In practice, cookie policy depended on `NODE_ENV=production`, which caused secure-cookie behavior to break plain-HTTP Docker auth on `localhost`.

From the rubric's backend perspective, LuminaQuest already qualifies as a meaningful full-stack system because it combines browser requests, persistent storage, authentication, and third-party AI integration in a single request/response architecture.

The backend should continue owning:

- Auth cookie policy
- CORS origin policy
- Runtime environment validation
- Provider defaults and connectivity checks

## Backend Plan

1. Make runtime policy explicit instead of inferring it from broad environment labels.
2. Keep cookie security, CORS origins, and provider endpoints configurable with narrow environment flags.
3. Add a small diagnostics endpoint or admin status payload for current auth/cors/provider mode.
4. Standardize shared config between Docker and local dev, with Docker overriding only container-specific addresses.
5. Add smoke coverage for login, onboarding completion, and authenticated admin load in both Docker and local dev assumptions.
6. Keep backend architecture and feature coverage easy to audit in the README so setup automation, authentication, database use, and provider integration are obvious to reviewers.

## Suggested Next Step

The next meaningful backend improvement is a small "runtime status" surface that returns active origin policy, cookie mode, provider selection, and onboarding-relevant defaults. That would give the frontend a single source of truth, strengthen usability during setup, and make parity issues much faster to diagnose.
