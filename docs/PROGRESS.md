# Progress

A new session can resume from this file and `docs/PLAN.md` alone.

## Milestones

| ID  | Status      | Notes                                                         |
| --- | ----------- | ------------------------------------------------------------- |
| M0  | done        | Scaffold, tooling, strict TS, layer lint, tokens, OpenAPI, CI |
| M1  | in progress | Auth, profiles, authorisation, audit log                      |
| M2  | not started |                                                               |
| M3  | not started |                                                               |
| M4  | not started |                                                               |
| M5  | not started |                                                               |
| M6  | not started |                                                               |
| M7  | not started |                                                               |
| M8  | not started |                                                               |

## Current state

- M1 is merged or in review: auth, profiles, sharing endpoints, audit log, idempotency.
- M2 and M3 code is being written together: normaliser adapters, medicines, dataset import,
  the interaction engine.

## Next steps

1. M2: `NormalizationService`, `MedicationService`, controllers, routes, tests with
   recorded RxNorm fixtures.
2. M3: dataset service and jobs (`seed:demo`, `import:interactions`, `migrate`), demo guard
   at boot, interaction-check endpoints, engine tests.
3. M4 onwards as in `docs/PLAN.md`.

## Lessons for later sessions

- Before pushing, run the exact CI steps from a fresh clone
  (`git clone . /tmp/x && cd /tmp/x && npm ci && npm run lint && npm run test:coverage`).
- Do not fetch CI job logs for the quality job with full content: the MongoDB service
  container floods the tail. List the workflow jobs to see which step failed, then
  reproduce locally.
- `git stash -u` drops empty directories. Run `mkdir -p` before writing into a new folder.

## Environment notes for cloud sessions

- Docker works after starting the daemon by hand: `dockerd > /tmp/dockerd.log 2>&1 &`.
  Then `docker run -d --name medmap-mongo -p 27017:27017 mongo:8`.
- Blocked hosts: RxNorm, the MongoDB binary download host (so `mongodb-memory-server`
  cannot download), the Playwright CDN, Vercel, Render and Atlas.
- A Chromium is pre-installed at `/opt/pw-browsers/chromium`. It is an older revision than
  the installed Playwright expects, so the Playwright config takes the executable path from
  `PW_CHROMIUM_PATH` when that is set.
- Feature branches can be pushed. Pull requests are opened and merged with the GitHub tools.

## Commands

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run docs:check
```

## Blockers

See [BLOCKERS.md](BLOCKERS.md).
