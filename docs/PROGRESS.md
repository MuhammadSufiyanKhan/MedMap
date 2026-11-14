# Progress

A new session can resume from this file and `docs/PLAN.md` alone.

## Milestones

| ID  | Status      | Notes                                                         |
| --- | ----------- | ------------------------------------------------------------- |
| M0  | done        | Scaffold, tooling, strict TS, layer lint, tokens, OpenAPI, CI |
| M1  | in progress | Auth, profiles, authorisation, audit log                      |
| M2  | not started |                                                               |
| M3  | not started |                                                               |
| M4  | in progress |                                                               |
| M5  | not started |                                                               |
| M6  | not started |                                                               |
| M7  | not started |                                                               |
| M8  | not started |                                                               |

## Current state

- The whole API for M1 to M3 exists and is tested (150 API tests).
- The web app is still the M0 placeholder shell. M4 builds every screen.

## Next steps

1. M4: web services layer (typed API client with refresh), application hooks, UI
   primitives, all pages, results list and graph, landing page with motion, print page,
   component tests, Playwright tests.
2. M5: label extraction endpoint and adapters, upload hardening, evaluation script.
3. M6: account export and delete endpoints; sharing and settings screens.
4. M7 and M8 as in `docs/PLAN.md`.

## Lessons for later sessions

- Before pushing, run the exact CI steps from a fresh clone
  (`git clone . /tmp/x && cd /tmp/x && npm ci && npm run lint && npm run test:coverage`).
- Do not fetch CI job logs for the quality job with full content: the MongoDB service
  container floods the tail. List the workflow jobs to see which step failed, then
  reproduce locally.
- `git stash -u` drops empty directories. Run `mkdir -p` before writing into a new folder.
- The secret scanner flags high-entropy strings next to the word "key". Use low-entropy
  dummy values in tests (for example `aaaa-aaaa-0001`). A gitleaks binary can be downloaded
  from the GitHub release page to scan locally.
- After a session restart Docker is down: start `dockerd` and the `mongo:8` container again.

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
