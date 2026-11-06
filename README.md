# VENOM LOG Bot v2

Replace the bot repository files with `index.js`, `package.json`, and `92.gif`. Render build: `npm install`; start: `npm start`.

Required Render environment variables: existing `DISCORD_TOKEN`, `CLIENT_ID`, optional `GUILD_ID`, plus `DATABASE_URL` (same internal URL as website) and `INTERNAL_API_SECRET` (exact same value as website). Keep secrets private.

The bot now exposes authenticated internal endpoints for the website and stores per-guild event channel mappings in PostgreSQL table `guild_configs`.
