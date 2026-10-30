# Testing Capture Quest

Run `npm run ci` for syntax, game rules, auth, transport, local processor and actual Miniflare Durable Object tests. Run `npm run test:hybrid` for the isolated 50-player native WebSocket gate. CI uses Node 22 and 24, installs the lockfile, verifies the deploy bundle and runs both gates.

The cloud runtime suite checks identity theft rejection, malformed/prototype actions, owner permissions, bounded capture formats, FIFO verification, duplicate and stale results, durable pending jobs, actual object eviction and recovery, pause/resume with an in-flight result, deadlines, task quota and archival exemptions. The local suite fully decodes photos through Sharp, checks size/decompression limits, prevents arbitrary remote fetching, verifies operational failures cannot become incorrect-photo penalties, and checks fsynced result delivery, concurrency, production database failure and idempotent archival.

The 50-player gate uses the real local Cloudflare runtime, HTTP API, browser transport and WebSocket frames. AI, audio and archival responses are explicitly mocked. Its latency numbers describe local protocol handling, not internet latency or model performance.

For an existing owned local runtime use `TEST_BASE_URL=http://127.0.0.1:19131 npm run smoke`. Full game completion additionally requires a running processor and `HYBRID_VERIFY_CAPTURES=1`. `npm run load:50` always rejects remote targets. Remote smoke requires `HYBRID_ALLOW_REMOTE=1`, and the production hostname additionally requires `HYBRID_ALLOW_PRODUCTION=1`. Remote games must be owned test fixtures and cleaned up.

Before release verify real OpenRouter, S3 and PostgreSQL separately from mocks. Check that a completed run is saved once, repeated delivery does not change it, a worker outage is visible and pending results recover. Browser acceptance must cover create/join, secret resume, host controls, QR sharing, service-worker updates, camera and audio. Desktop browser automation does not establish physical phone camera or audio acceptance.

Local generated artifacts belong under Working/Capture-Quest. CI uses its runner's temporary directory. Private configs, tokens and generated evidence must not enter Git.
