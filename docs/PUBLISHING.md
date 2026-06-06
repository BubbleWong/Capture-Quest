# Publishing Checklist

Use this checklist before making the repository public or pushing a release branch.

## Required Checks

```bash
npm run ci
npm audit --omit=dev
git status --short
git diff --check
```

Confirm that generated logs, local caches, and private config files are not staged.

## Secret Safety

- Keep `config.js` untracked.
- Do not commit API keys, database passwords, Cloudflare tunnel tokens, or S3 credentials.
- Use `config.sample.js` for fake/demo values only.
- Review README and docs for accidental credential exposure before publishing.

## Runtime Notes

- Production mode is enabled with `CAPTURE_QUEST_MODE=production` or `NODE_ENV=production`.
- The development Cloudflare tunnel is managed only in development mode.
- Set `PUBLIC_BASE_URL` in production so QR codes and share links use the correct HTTPS origin.
- Configure Postgres if completed-game results should survive server restarts.
- Configure S3 if TTS pronunciation audio should be cached and publicly served.

## Manual Release Smoke

After deployment, create one test game and verify:

- Create, join, ready, and start work from at least two devices.
- A phone camera starts over HTTPS.
- A wrong photo applies a penalty only while the challenge is active and unsolved.
- A correct photo ends the round and later submissions are ignored.
- End game displays the correct player or team leaderboard.
- Refreshing an in-game player reconnects with the saved local UUID.
