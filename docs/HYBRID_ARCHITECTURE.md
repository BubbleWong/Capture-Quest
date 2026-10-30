# Cloud application and local processing

The public PWA and game coordination run on Cloudflare. A room has one authoritative game state; the local database is an archive of completed runs, not a second source of truth for an active room. The existing S3 endpoint continues serving pronunciation audio. No second object store or public local application server is required.

The local processor runs `node server/localWorker.js`. It does not listen on a network port. It makes authenticated outbound requests to the fixed cloud task endpoints, executes a bounded number of tasks concurrently (two by default, at most four), and returns a bounded result. Its credential authorizes task processing, not player or host operations. OpenRouter, PostgreSQL and S3 credentials stay on the local host. Public cloud code must never receive them.

## Local process configuration

Supply secrets in the existing private `config.js`, an owner-readable environment file, or the process supervisor's private environment. Never put them in command arguments, Git, browser settings or the public Worker configuration.

| Variable | Purpose |
| --- | --- |
| `CAPTURE_QUEST_MODE` | Use `production` on the deployed processor. |
| `CAPTURE_QUEST_CLOUD_URL` | Exact HTTPS origin of the deployed game. Loopback HTTP is accepted for development. |
| `CAPTURE_QUEST_WORKER_TOKEN` | Random task-service credential, at least 32 characters, matching the cloud secret. |
| `CAPTURE_QUEST_WORKER_ID` | Stable host identity, using letters, digits, dots, underscores or hyphens. |
| `CAPTURE_QUEST_SPOOL_DIRECTORY` | Persistent private directory for result receipts. Keep this outside a release directory. |
| `CAPTURE_QUEST_WORKER_CONCURRENCY` | Concurrent task slots, default 2, maximum 4. Each slot has a distinct lease-owner ID. |
| `CAPTURE_QUEST_POLL_INTERVAL_MS` | Idle claim interval, default 3 seconds. |
| `POSTGRES_NODES`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE` | Existing PostgreSQL connection. |
| `POSTGRES_SSL_SERVERNAME` | Certificate DNS identity when the connection uses a private IP; hostname verification remains enabled. |
| `POSTGRES_SSL`, `POSTGRES_SSL_CA` | Enable certificate and hostname validation with an optional trusted CA PEM. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_VISION_MODEL` | Existing model credentials and selection. |
| `OPENROUTER_TIMEOUT_MS` | Provider request deadline, capped at 45 seconds. |
| Existing `S3_*` / `AWS_*` variables | Existing pronunciation bucket and storage credentials. |

Run `node server/localWorker.js --migrate` once with a schema-owner credential when initializing or upgrading a database. Ordinary production startup checks the existing schema without creating or altering tables. The runtime account needs only the connection/schema privileges and SELECT, INSERT and UPDATE on the game result tables. Missing or unavailable PostgreSQL is a startup failure in production; it never becomes successful memory-only result storage.

The processor should run under a dedicated OS account or an equivalently restricted service/container. Give it its private configuration, result spool and only the required database/model/bucket permissions. Do not grant access to unrelated application directories, host administration APIs or the Docker socket.

## Task contract and recovery

The fixed task allowlist is `generateItems`, `prepareInitialItems`, `verifyPhoto`, `prepareAudio` and `saveGameResult`. A job cannot select an arbitrary URL, SQL statement or local file. The processor uses `POST /internal/worker/claim` with `{workerId,limit:1}` and `POST /internal/worker/result` with `{workerId,jobId,leaseToken,ok,result}` or a sanitized error. Both require the task-service Bearer credential. The cloud leases work for a bounded interval and rejects stale lease results.

Successful results and errors are written to a mode-0600, atomically renamed and fsynced local receipt before delivery. The result directory is mode 0700. The next iteration delivers pending receipts before claiming new work. A transient delivery failure therefore does not rerun a paid model request. A lost or reassigned lease can require repeating work, so cloud identity/epoch validation and idempotent archival remain necessary. The local spool stores results, not source photos or provider credentials. Preserve it across releases and process restarts; do not clear it as a cache.

Every completed game run supplies a stable `resultId`, distinct from its reusable room code. The PostgreSQL transaction inserts that ID once, along with all scores; retries do not alter the original completion time or duplicate scores. A restarted game in the same room uses a new result ID. Existing historical rows remain intact.

A `verifyPhoto` provider failure is an operational error, never a negative match. The cloud must not deduct points for these errors. Pronunciation failure may use the browser's existing speech fallback and must not stall a game. Jobs and callbacks include the room's current challenge/epoch so old results cannot change a later round.

## Images, audio and cost boundaries

Photo jobs contain only bounded inline JPEG or PNG data, never remote image URLs. The local processor validates the byte signature, fully decodes within a four-megapixel/2048-pixel-side ceiling, strips metadata and resizes to at most 640 pixels before the vision call. Photos must have a short cloud task retention period and must not inherit the public audio ACL. No photo library is created by this migration.

Pronunciation is generated and cached by the local processor. Provider responses, decoded images and audio responses have explicit size/time limits. S3 operations have timeouts; production never creates a missing bucket implicitly. Existing immutable audio objects remain reusable. The cloud does no image/audio conversion and runs no model inference.

When the local processor is offline, the cloud can retain and recover room coordination, but new AI work cannot finish. The UI must show that condition honestly; it must not accept fake verification or claim results have been archived before a local receipt succeeds.
