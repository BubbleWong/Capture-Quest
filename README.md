# Capture Quest

Capture Quest is a realtime camera scavenger hunt PWA. One player creates a game, shares the QR code or game ID, and up to 20 players race to photograph kid-safe objects around a home or school.

Game IDs use Crockford Base32. Player-entered codes accept lowercase letters, hyphens or spaces, `O` as `0`, and `I`/`L` as `1`.

When creating a game, owners can leave the seed field blank for random AI-picked objects, enter a word list, or enter a guide for AI-generated objects. Seeded input is refined by AI into safe, camera-recognizable challenges before the game starts.

## Run

1. Copy `config.sample.js` to `config.js`.
2. Fill in Postgres and OpenRouter settings.
3. Install dependencies and start the server:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Configuration

`config.js` is ignored by git. Environment variables can also override the local config:

- `POSTGRES_NODES`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_VISION_MODEL`
- `PUBLIC_BASE_URL`
- `CLOUDFLARE_TUNNEL_ENABLED`
- `CLOUDFLARE_TUNNEL_TOKEN`
- `CLOUDFLARE_TUNNEL_DOMAIN`
- `CLOUDFLARE_TUNNEL_URL`
- `CLOUDFLARED_COMMAND`

If Postgres is unavailable, completed scores are kept in memory for the current server run. If `OPENROUTER_API_KEY` is missing and `mockWhenMissingKey` is enabled, local development accepts submitted photos so the gameplay loop can be tested.

The default OpenRouter model is `openai/gpt-5.4-mini`; override it with `openRouter.model` in `config.js` or `OPENROUTER_MODEL`. Photo verification uses `google/gemini-3.1-flash-lite-preview` by default; override it with `openRouter.visionModel` or `OPENROUTER_VISION_MODEL`.

## HTTPS Phone Testing

Camera access on phones requires HTTPS. To expose the local server through Cloudflare Tunnel, install `cloudflared`, then set `cloudflare.enabled`, `cloudflare.token`, and `cloudflare.domain` in `config.js`. When the Node server starts, it starts the tunnel after the HTTP listener is ready and stops the tunnel during server shutdown.

Set `publicBaseUrl` to the HTTPS domain so generated game links and QR codes use the tunnel URL.

## Music Credits

Bundled BGM files are converted to MP3 for browser compatibility. Source tracks:

- Lobby: [Flowerbed Fields [Loop]](https://opengameart.org/content/flowerbed-fields-loop) by Zane Little Music, CC0.
- In-game: [BooxBep Chiptune](https://opengameart.org/content/booxbep-chiptune) by Fupi, CC0.
- Last 10 seconds: [Fast fight / battle music (looped)](https://opengameart.org/content/fast-fight-battle-music-looped) by XCVG, based on work by Ville Nousiainen, CC0.
