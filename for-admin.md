# for-admin.md

## Goal
Use LuminaQuest admin tools to author, validate, publish, and playtest deterministic story games.

## Quick Start

### 1. Login as Admin
- **Username:** `admin`
- **Password:** `admin`
- (You can also use email: `admin@luminaquest.local`)

The admin user is automatically created on first server startup.

### 2. Admin Dashboard
After logging in, use the tabs to navigate:
- **Player Forge** - Create and manage games
- **User Journey** - Playtest as a user

### 3. Create & Publish Games
1. Create a game template (or use starter game).
2. Open Graph view and inspect scene links.
3. Run Analyze to detect unreachable scenes/dead ends.
4. (Optional) Start Playtest from any scene.
5. Publish once graph and scoring are balanced.

### 4. Game Management
- **Create** - New game drafts from templates
- **Edit** - Update existing drafts (scenes, avenues, constraints)
- **Delete** - Remove games you own
- **Publish** - Make games available to all users

## Authoring Tips
- Keep 2+ avenues on non-terminal scenes.
- Define `renderConfig` per scene for visual consistency.
- Define avenue `visualEffects` to drive transitions/mood.
- Use wildcard cautiously with recovery scene configured.
- Test with playtest before publishing.

## LLM Provider Configuration
- **External:** `LLM_PROVIDER=openrouter` + `OPENROUTER_API_KEY`
- **On-device:** `LLM_PROVIDER=lmstudio` + `LMSTUDIO_BASE_URL`

See `.env.example` for full configuration options.

## Reset Admin Credentials
If needed, reset the admin user:
```bash
cd server
node reset-admin.js
```

## Do/Don't
- Do keep authored graph as source of truth.
- Do run Analyze before publishing.
- Do playtest critical paths.
- Don't rely on LLM to invent routes/scenes.
- Don't publish games with unreachable scenes.

## Troubleshooting
- **Login fails:** Check server is running and MongoDB is connected
- **Can't see admin tabs:** Verify you're logged in as admin role
- **Games not persisting:** Ensure Docker volume is configured correctly
