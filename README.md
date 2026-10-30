# Capture Quest

<img width="1389" height="970" alt="Screenshot 2026-08-12 at 10 45 03 PM" src="https://github.com/user-attachments/assets/8b450a77-d6c6-442f-934f-efbc020fbc9a" />

Capture Quest is a realtime camera scavenger hunt PWA for homes, classrooms, parties, and small groups. One player creates a game, shares a QR code or Game ID, and up to 50 players race to photograph safe everyday objects before the clock runs out.

The PWA, public API and realtime room coordination run on Cloudflare Workers and Durable Objects. A private outbound Node.js processor handles OpenRouter tasks, photo validation, pronunciation audio and the existing S3 cache. Completed runs are archived in local PostgreSQL; production never silently falls back to memory.

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

- Node.js 22 or newer and npm for development and deployment.
- The existing Cloudflare Workers Paid account; rooms use SQLite Durable Objects.
- A private local processor with PostgreSQL, an OpenRouter key and the existing S3 pronunciation bucket.

## Development

```bash
npm ci
npm run dev
```

The local cloud runtime opens on loopback. Run a separate local processor with its private configuration when testing real integrations. For a complete isolated game with fake AI, audio and persistence, run:

```bash
npm run ci
npm run test:hybrid
```

The second command starts its own loopback runtime, creates 50 players, rejects the 51st, checks host authorization and secret resume, and completes a game through real WebSockets and durable job leases. It never calls a production service.

Production processing uses `npm start` or `npm run worker`. It opens no inbound port. See [the architecture and configuration guide](docs/HYBRID_ARCHITECTURE.md), [deployment and rollback](docs/PUBLISHING.md), and [test boundaries](docs/TESTING.md).

## Deployment

`npm run deploy` builds versioned public assets and deploys the cloud application. Database/model/S3 credentials stay on the processing host; the only cloud secret is the dedicated task-service token. The ordinary local processor uses an account with result-table privileges, not database administration rights.

Use a candidate Worker URL for acceptance before switching the public domain. Changes to assets, camera code or audio still require a real HTTPS browser/device check. The old Node HTTP/Socket.IO server and managed public tunnel launcher are retired; commit `d4cc8cdcecdc287a1cf4ce7ccc686b21b87c2a58` preserves that implementation in Git.

## Project Structure

```text
cloudflare/          Public API, room state, job broker and limits.
public/              PWA, native WebSocket transport, camera, music and UI.
server/              Shared game rules and private local task processing.
scripts/             Asset build, syntax checks and bounded game gates.
prompts/             AI prompt references.
deploy/              Restricted local processor service definition.
docs/                Architecture, testing and deployment instructions.
config.sample.js     Safe local processor configuration template.
```

## Music Credits

Bundled BGM files are converted to MP3 for browser compatibility. Source tracks:

- Lobby: [Flowerbed Fields [Loop]](https://opengameart.org/content/flowerbed-fields-loop) by Zane Little Music, CC0.
- In-game: [BooxBep Chiptune](https://opengameart.org/content/booxbep-chiptune) by Fupi, CC0.
- Last 10 seconds: [Fast fight / battle music (looped)](https://opengameart.org/content/fast-fight-battle-music-looped) by XCVG, based on work by Ville Nousiainen, CC0.

## Icon Credits

- Flashlight icon: [Phosphor Icons](https://phosphoricons.com/), MIT License.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
