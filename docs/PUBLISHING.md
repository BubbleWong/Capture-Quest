# Deployment and rollback

The maintained architecture is described in [HYBRID_ARCHITECTURE.md](HYBRID_ARCHITECTURE.md). The public website and realtime coordination run in the same Cloudflare paid account as TensorTrace. The local processor opens no listening socket. Database, OpenRouter and S3 credentials never enter the public build.

## Release gates

Run `npm ci`, `npm run ci`, `npm run test:hybrid`, `npm audit`, `npm run build` and `npx wrangler deploy --dry-run --config cloudflare/wrangler.jsonc`. Review the exact commit and keep local config, credentials and generated files out of the commit. Commit and push the reviewed code before deployment.

Deploy first to the candidate Worker URL. Install its dedicated `WORKER_TOKEN` with Wrangler secret tooling, without passing the value as a command argument. Run a real local processor against that candidate and verify private task authentication, provider requests, existing S3 audio and one archived game before attaching the production hostname. Never enable `TEST_GAME_CONFIG` or a mock consumer on production.

## Private processor

The service definition is [deploy/capture-quest-worker.service](../deploy/capture-quest-worker.service). On Rio, deploy reviewed source and production-only dependencies under `/opt/capture-quest`, owned by root. A dedicated `capturequest` account runs the service with no login shell, no capabilities, a read-only filesystem and inaccessible home directories. Only `/var/lib/capture-quest` is writable for its durable result spool.

Keep configuration in `/etc/capture-quest/runtime.json`, owned by root with mode 0640 and group capturequest. An ignored `/opt/capture-quest/config.js` may read and export that JSON. Keep its task token, database password and provider/storage credentials out of process arguments and logs. The cloud token is separate from all upstream credentials.

The current authoritative archive is Flora's `capture_quest`, reached over the existing encrypted Tailscale network from Rio. The old Elm copy is intentionally read-only and must not be made writable to work around a failure. The worker role has connection/schema usage and SELECT/INSERT/UPDATE on games and game_scores; it cannot create schema objects or delete history. TLS-enabled deployments must validate certificates and the expected hostname. Do not disable certificate validation.

Initialize an empty schema separately with a schema-owner credential using `npm run db:migrate`. Ordinary production startup does not run DDL and must fail if persistence or required provider credentials are unavailable. Preserve existing history and the private result spool across updates.

## Cutover and recovery

Save the old DNS/route and service identity in a private Working receipt. After candidate acceptance, attach only cq.bubbleh.com to the new Worker and verify its HTTP, WebSocket, asset, worker and archival paths. Stop and remove only the old capture-quest PM2 web process; preserve every unrelated service and the shared tunnel. Remove the old hostname's tunnel ingress so it cannot revive the retired application later. The processor remains an outbound client.

A cloud rollback should deploy the last accepted hybrid commit while preserving Durable Object namespaces, stored room state and the local spool. Changing or deleting DO migration tags/namespaces is not a normal rollback. If an initial cutover must be reverted, restore the saved DNS/route and old service only after considering its known insecure resume protocol and obsolete database target. Git commit d4cc8cdcecdc287a1cf4ce7ccc686b21b87c2a58 is the old public server's source recovery point; it is not an accepted secure deployment.

Verify `systemctl is-active` and `is-enabled` for capture-quest-worker, public health and actual game interaction. A running supervisor, successful build or mocked AI result does not prove complete live acceptance. Record the deployed revision and remaining physical-device limitations.
