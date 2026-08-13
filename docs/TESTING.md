# Testing Capture Quest

Capture Quest has three useful test layers. Keep the fast deterministic tests as the default gate, then use live smoke and device testing when changing browser, camera, tunnel, or audio behavior.

## Local Commands

```bash
npm run check
npm test
npm run ci
npm run load:50
```

- `npm run check` runs `node --check` over the server, client script, service worker, smoke test, and engine tests.
- `npm test` runs `scripts/tests/*.test.mjs` with Node's built-in test runner.
- `npm run ci` runs the local deterministic gate: syntax checks plus engine tests.
- `npm run load:50` starts an isolated local Socket.IO server with fake AI/audio/storage and runs one randomized 50-player game.

## Game Logic Coverage

The engine test suite uses fake Socket.IO sockets, fake AI, fake audio cache, and fake persistence so game rules can be tested without a browser, camera, Postgres, S3, or OpenRouter.

Current coverage includes:

- Crockford Base32 Game ID normalization.
- Create, join, duplicate-name blocking, rejoin, and previous-session kick behavior.
- Ready gating before owner start.
- Localized challenge metadata and generated pronunciation URLs.
- Stale challenge UUID rejection.
- Per-game verification queue ordering.
- Miss penalties, solved-challenge drops, and no penalty for late submissions after a winner.
- Non-repeating challenge history and AI refill exclusion hints.
- Strict skip-majority thresholds that do not drop during reconnects.
- Team-up balancing, team winners, and team result persistence.
- Owner pause, resume, end, player leave, and restart-with-group behavior.

When adding or changing game rules, add or update engine tests first when possible. It is usually faster and less brittle than starting with browser automation.

## Live Smoke Test

```bash
npm run dev
TEST_BASE_URL=http://localhost:3000 npm run smoke
```

The smoke test connects with Socket.IO clients and walks through a small create/join/start/submit flow against a running server. It is useful for checking that socket event names and payload shapes still match the deployed server.

Use a local mock AI configuration for routine smoke tests. A live OpenRouter key may make photo verification slower or non-deterministic.

To run an isolated local smoke server that ignores private `config.js`, use:

```bash
PORT=3099 CAPTURE_QUEST_MODE=production CAPTURE_QUEST_SKIP_LOCAL_CONFIG=1 npm start
TEST_BASE_URL=http://127.0.0.1:3099 npm run smoke
```

## 50-Player Load Test

```bash
npm run load:50
LOAD_TEST_SEED=123456 npm run load:50
```

The load test creates 50 real Socket.IO clients against a temporary in-process server, verifies the 51st player is rejected, randomizes rejoin, ready, skip, miss, and match behavior, then runs a full team-up game to completion. It uses fake AI, fake pronunciation audio, and fake persistence, so it does not require OpenRouter, S3, Postgres, Cloudflare, or camera access.

Each run prints its random seed and timing metrics. Reuse `LOAD_TEST_SEED` to reproduce a specific randomized run.

## Device Checks

Run real phone or tablet checks after changes to:

- Camera startup, capture, and stream recovery.
- Flashlight controls.
- Mobile passcode input.
- PWA cache behavior.
- Cloudflare HTTPS tunnel behavior.
- Music and TTS playback after the first user interaction.

For iOS camera testing, use an HTTPS tunnel domain. `http://localhost` on the development computer does not make camera access secure for a separate phone or tablet.

## CI Workflow

The GitHub Actions workflow in `.github/workflows/ci.yml` runs on pushes and pull requests. It installs dependencies with `npm ci`, then runs:

```bash
npm run check
npm test
npm run smoke
```

The workflow starts an isolated production-mode server with `CAPTURE_QUEST_SKIP_LOCAL_CONFIG=1` before the smoke test. It intentionally avoids live camera, Postgres, S3, Cloudflare, and OpenRouter dependencies. Those integrations should stay behind mocks or explicit manual/device checks.
