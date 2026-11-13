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

- Models and M1 repositories exist. The auth, access, audit and idempotency services are
  being written next, then controllers, routes and integration tests.

## Next steps

1. Finish M1: composition root (`container.ts`), auth and profile controllers and routes,
   sharing endpoints, integration tests including authorisation for every profile route.
2. M2 onwards as in `docs/PLAN.md`.

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
