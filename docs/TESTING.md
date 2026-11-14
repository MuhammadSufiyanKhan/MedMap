# Testing

## Kinds of test and how to run them

| Kind                 | Where                            | Command                          |
| -------------------- | -------------------------------- | -------------------------------- |
| Shared schemas       | `packages/shared/tests`          | `npm test -w @medmap/shared`     |
| API unit             | `apps/api/tests/unit`            | `npm test -w @medmap/api`        |
| API integration      | `apps/api/tests/integration`     | `npm test -w @medmap/api`        |
| Web unit, component  | `apps/web/tests`                 | `npm test -w @medmap/web`        |
| Browser (Playwright) | `apps/web/e2e`                   | `npm run test:e2e`               |
| Lighthouse budgets   | `apps/web/scripts/lighthouse.ts` | `bash scripts/run-lighthouse.sh` |
| Everything           |                                  | `npm test`                       |
| With coverage gates  |                                  | `npm run test:coverage`          |

Coverage gates: 90% on `apps/api/src/engine` and `apps/web/src/domain`, 80% on API services.

## MongoDB for integration tests

The API tests pick a database in this order:

1. `MONGO_TEST_URI` if set (CI uses a service container).
2. A MongoDB on `localhost:27017` (`npm run db:up`).
3. `mongodb-memory-server`, which downloads a MongoDB binary on first use.

Each test file creates a database with a random name containing `test` and drops it at the
end, so files run in parallel. The drop helper refuses any database without `test` in its
name.

## External services

Nothing in the test suite calls the network.

- **RxNorm:** `apps/api/tests/fixtures/rxnorm/responses.json` holds responses written from
  the documented RxNav shapes, served by an injected `fetch`. Integration tests inject a
  fake normaliser through `createContainer` overrides. `npm run check:rxnorm` checks the
  live service and runs nightly in CI.
- **Email:** `MemoryEmailAdapter` collects messages; tests read tokens from them.
- **Time:** the container takes a clock; `ctx.advance(ms)` moves it.

## Adding fixtures

- Demo medicines and pairs: `packages/shared/fixtures/demo-drugs.json` and
  `demo-interactions.json`. Use invented names only. Never add a real medicine name or a
  real interaction to the demo set.
- RxNorm responses: add the request path as a key in `responses.json` with the response
  body as the value.
- Never put real patient data, real prescriptions or secrets in a fixture.

## Safety tests

| Rule                                 | Test                                                                 |
| ------------------------------------ | -------------------------------------------------------------------- |
| Never "safe"                         | `packages/shared/tests/safety.test.ts`, `interaction-checks.test.ts` |
| Fixed wording                        | Snapshot in `packages/shared/tests/safety.test.ts`                   |
| Unchecked medicines reported         | `apps/api/tests/unit/engine.test.ts`                                 |
| Dataset named on every result        | `interaction-checks.test.ts`                                         |
| Production refuses demo data         | `interaction-checks.test.ts` starts the real server process          |
| Other users' profiles return no data | `authorization.test.ts`, generated from the route table              |

## Browser tests

`npm run test:e2e` builds nothing itself: run `npm run build` first. Playwright then starts
the API on port 4100 (database `medmap_e2e`, demo dataset, mock label extractor, high rate
limits) and `vite preview` on port 4173.

- `main-flow.spec.ts`: the user journeys.
- `responsive.spec.ts`: screenshots of every main screen at 360, 768, 1024 and 1440 px in
  `apps/web/e2e/screenshots/`; each fails on horizontal overflow.
- `motion.spec.ts`: reduced motion shows everything at once; with motion, scrolling,
  resizing and navigating leave no hidden content, stale pins or console errors.
- `a11y.spec.ts`: axe (WCAG 2.2 AA tags) on every main screen in light, dark and
  high-contrast themes, plus keyboard checks.

Environment variables: `PW_CHROMIUM_PATH` uses an already-installed Chromium;
`E2E_BASE_URL` points the suite at a deployed site instead of starting servers.

Component tests use React Testing Library with MSW handlers for the API and axe-core for
structure checks (colour contrast is checked in the browser tests).
