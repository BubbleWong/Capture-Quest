# Capture Quest

<img width="1389" height="970" alt="Screenshot 2026-08-12 at 10 45 03 PM" src="https://github.com/user-attachments/assets/8b450a77-d6c6-442f-934f-efbc020fbc9a" />

Capture Quest is a realtime camera scavenger hunt PWA for homes, classrooms, parties, and small groups. One player creates a game, shares a QR code or Game ID, and up to 50 players race to photograph safe everyday objects before the clock runs out.

The app runs on a Node.js backend with Socket.IO, a modern browser frontend, optional Postgres result storage, OpenRouter-powered object generation, image verification, pronunciation TTS, and optional S3-backed pronunciation audio caching.

## Features

- One-click game creation, plus join by QR code, URL, or Crockford Base32 Game ID.
- Avatar-based lobby with random funny animal names, local name persistence, shake-to-randomize, and tap-to-ready controls.
- Owner lobby controls for challenge language, optional object or AI guide, and team-up mode before start.
- Phone/tablet camera gameplay with client-side image downscaling before upload, flashlight support where browsers allow it, and secure-context HTTPS tunnel support for mobile testing.
- Owner controls for start, pause, end, and restart with the same group.
- Players auto-ready when joining; owner start is gated until every player is ready.
- Reconnect support, local player UUIDs, and one online session per player.
- AI-generated object rounds with optional owner-provided word list or prompt guide that AI refines for safety and camera recognition.
- Language-aware challenges, language tags, and optional pronunciation audio buttons.
- Image verification accepts recognizable real objects, photos, drawings, stickers, or icons of the target.
- Sequential verification queues per game so only one photo is verified at a time in each game.
- Miss penalties only for active, unsolved challenges; stale or already-solved submissions are ignored.
- Skip voting for hard-to-find objects with strict majority thresholds; team mode requires full-team skip votes from a majority of teams.
- Optional team-up mode with red/blue team balancing, team scoreboards, and final contributor breakdowns.
- Lobby, in-game, and countdown music with per-user BGM mute stored in local storage.

Game IDs use Crockford Base32. Player-entered codes accept lowercase letters, hyphens or spaces, `O` as `0`, and `I`/`L` as `1`.

## Requirements

- Node.js 20 or newer.
- npm.
- Optional: Postgres for persisted completed-game results.
- Optional: OpenRouter API key for live object generation, image verification, and TTS.
- Optional: S3-compatible storage for cached pronunciation audio.
- Optional: `cloudflared` for HTTPS phone testing in development.

## Quick Start

```bash
npm install
cp config.sample.js config.js
npm run dev
```

Open `http://localhost:3000`.

`config.js` is ignored by git. Keep all local credentials there or in environment variables.

## Configuration

Every setting can be supplied in `config.js`; these environment variables can override local config values:

| Variable | Purpose |
| --- | --- |
| `CAPTURE_QUEST_MODE` | `development` or `production`. |
| `NODE_ENV` | `production` also enables production mode when `CAPTURE_QUEST_MODE` is unset. |
| `CAPTURE_QUEST_SKIP_LOCAL_CONFIG` | Ignore `config.js`, useful for isolated smoke tests. |
| `PORT` | HTTP server port. |
| `PUBLIC_BASE_URL` | Public origin used for generated game URLs and QR codes. |
| `POSTGRES_NODES` | Comma-separated `host:port` Postgres nodes. |
| `POSTGRES_USER` | Postgres user. |
| `POSTGRES_PASSWORD` | Postgres password. |
| `POSTGRES_DATABASE` | Postgres database name. |
| `POSTGRES_SSL` | Enable Postgres SSL with `1`, `true`, `yes`, or `on`. |
| `OPENROUTER_API_KEY` | OpenRouter key. |
| `OPENROUTER_MODEL` | Object generation model. Default: `openai/gpt-5.4-mini`. |
| `OPENROUTER_VISION_MODEL` | Photo verification model. Default: `google/gemini-3.5-flash-lite`. |
| `OPENROUTER_TTS_MODEL` | Pronunciation audio model. Default: `google/gemini-3.1-flash-tts-preview`. |
| `OPENROUTER_TTS_VOICE` | TTS voice name. |
| `OPENROUTER_TTS_RESPONSE_FORMAT` | TTS response format. |
| `OPENROUTER_BASE_URL` | OpenRouter API base URL. |
| `OPENROUTER_APP_TITLE` | App title sent to OpenRouter. |
| `OPENROUTER_REFERER` | Referer sent to OpenRouter. |
| `OPENROUTER_MOCK_WHEN_MISSING_KEY` | Accept local mock AI behavior when no OpenRouter key is configured. |
| `S3_ENABLED` or `AWS_S3_ENABLED` | Enable S3-backed TTS cache. |
| `AWS_ENDPOINT_URL` or `S3_ENDPOINT_URL` | S3-compatible endpoint. |
| `AWS_DEFAULT_REGION` or `AWS_REGION` | S3 region. |
| `AWS_ACCESS_KEY_ID` | S3 access key. |
| `AWS_SECRET_ACCESS_KEY` | S3 secret key. |
| `S3_BUCKET` or `AWS_S3_BUCKET` | TTS cache bucket. |
| `S3_PUBLIC_BASE_URL` | Public URL prefix for cached TTS files. |
| `S3_FORCE_PATH_STYLE` | Enable path-style S3 URLs. |
| `CLOUDFLARE_TUNNEL_ENABLED` | Start a Cloudflare tunnel in development mode. |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare tunnel token. |
| `CLOUDFLARE_TUNNEL_DOMAIN` | Tunnel hostname. |
| `CLOUDFLARE_TUNNEL_URL` | Local origin passed to the tunnel. |
| `CLOUDFLARED_COMMAND` | Path or command name for `cloudflared`. |
| `CAPTURE_QUEST_LOG_GAME_EVENTS` | Enable compact socket event logs for debugging. |

If Postgres is unavailable, completed scores are stored in memory for the current server run. If `OPENROUTER_API_KEY` is missing and mock mode is enabled, local development uses deterministic fallback behavior so the gameplay loop can be tested without paid AI calls.

Pronunciation audio is generated before an object is announced when S3 and TTS are configured. Cache keys include the language code and object phrase, so repeated challenges can reuse existing files and send players only a public audio URL.

## Testing

```bash
npm run check
npm test
npm run ci
npm run load:50
```

- `npm run check` validates JavaScript syntax for server, client, service worker, smoke tests, and engine tests.
- `npm test` runs deterministic game-logic tests with Node's built-in test runner.
- `npm run ci` runs syntax checks and deterministic engine tests.
- `npm run smoke` runs an optional live Socket.IO smoke test against `TEST_BASE_URL` or `http://localhost:3000`.
- `npm run load:50` runs an isolated randomized 50-player Socket.IO load test with fake AI/audio/storage.

More detail is in [docs/TESTING.md](docs/TESTING.md).

## HTTPS Phone Testing

Mobile camera access requires a secure context. `localhost` is secure on the same machine, but phones and tablets need HTTPS.

For development, install `cloudflared`, enable the Cloudflare tunnel in `config.js`, and set the tunnel domain. The server starts and stops the tunnel only in development mode. Production mode never manages the development tunnel, even if Cloudflare settings exist.

Set `publicBaseUrl` to the HTTPS origin, or leave it blank to use the configured development tunnel domain for generated links and QR codes.

## Project Structure

```text
public/              Frontend assets, scripts, styles, service worker, music.
server/              Express server, Socket.IO events, game engine, AI, storage.
scripts/             Smoke tests and automated test suites.
prompts/             Prompt references and AI prompt notes.
docs/                Testing and publishing notes.
config.sample.js     Safe configuration template.
config.js            Local secrets and deployment settings, ignored by git.
```

## Publishing

Before publishing the repo, run `npm run ci`, review `git status`, and confirm `config.js` or other local secrets are not staged. See [docs/PUBLISHING.md](docs/PUBLISHING.md).

## Music Credits

Bundled BGM files are converted to MP3 for browser compatibility. Source tracks:

- Lobby: [Flowerbed Fields [Loop]](https://opengameart.org/content/flowerbed-fields-loop) by Zane Little Music, CC0.
- In-game: [BooxBep Chiptune](https://opengameart.org/content/booxbep-chiptune) by Fupi, CC0.
- Last 10 seconds: [Fast fight / battle music (looped)](https://opengameart.org/content/fast-fight-battle-music-looped) by XCVG, based on work by Ville Nousiainen, CC0.

## Icon Credits

- Flashlight icon: [Phosphor Icons](https://phosphoricons.com/), MIT License.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
