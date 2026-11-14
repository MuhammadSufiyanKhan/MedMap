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
| M5  | in progress |                                                               |
| M6  | not started |                                                               |
| M7  | not started |                                                               |
| M8  | not started |                                                               |

## Current state

- API for M1 to M3 and the whole web app (M4) exist and are tested: 150 API tests, 70 web
  unit and component tests, 25 Playwright tests, Lighthouse budgets met.
- Not built yet: label extraction (API and photo tab), account export and delete, Docker
  images for api and web, deployment workflows.

## Next steps

1. M5: `LabelExtractor` port with mock, Ollama and hosted adapters; upload middleware
   (memory only, 5 MB, 3 files, magic bytes, EXIF strip with sharp); per-user daily cap;
   `POST /profiles/:profileId/label-extractions`; photo tab with consent and the
   confirm-and-edit queue (reuse `MedicineForm`); synthetic label fixtures and the
   evaluation script; second Playwright flow.
2. M6: `GET /me/export`, `DELETE /me`; wire `features/AccountData.tsx`; extend the main
   Playwright flow with export and delete.
3. M7: Dockerfiles, full compose, security review, final docs pass.
4. M8: deployment workflows, `vercel.json`, `render.yaml`, secrets script, setup checklist.

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
- Local browser runs: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e` after
  `npm run build`; Lighthouse: `CHROME_PATH=/opt/pw-browsers/chromium bash scripts/run-lighthouse.sh`.
- The dev API (`.env`) has real rate limits (20 auth requests per 15 minutes); browser
  suites must use the Playwright-managed servers, which raise them.
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
