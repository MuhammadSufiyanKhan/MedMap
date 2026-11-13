# MedMap

A map of your medicines: see which combinations have a known interaction to ask your pharmacist about.

[![CI](https://github.com/MuhammadSufiyanKhan/MedMap/actions/workflows/ci.yml/badge.svg)](https://github.com/MuhammadSufiyanKhan/MedMap/actions/workflows/ci.yml)

> **Status: under construction.** See [docs/PROGRESS.md](docs/PROGRESS.md) for what works today.
> Sections below describe only what exists. Planned work is listed under [Roadmap](#roadmap).

## Screenshots

Screenshots will be added when the results screens are built (milestone M4).

## Safety and limits

MedMap is an information tool. It is not medical advice, and it does not diagnose or set doses.

- MedMap never says a combination is "safe". When nothing is flagged, it says only that no
  known interaction was found in the named source, with its version and date.
- A language model is used for one thing only: reading the text on a label photo. It never
  writes or rewrites anything about interactions. Severity and wording come from the
  dataset or from fixed text in the code.
- MedMap never tells you to stop, change, skip or delay a medicine. Every flag ends with:
  "Ask your pharmacist or prescriber about this combination."
- Medicines that could not be identified or checked are shown and counted, not hidden.
  Supplements and herbs are covered less fully than prescription medicines.
- The dataset name, version and date are shown with every result.
- The built-in dataset is made up, for demos and tests. It shows a "DEMO DATA, not medical
  information" banner, and the API refuses to start with it in production unless
  `ALLOW_DEMO_DATA=true`.
- For urgent symptoms, contact your local emergency services.

The fixed wording lives in [`packages/shared/src/safety.ts`](packages/shared/src/safety.ts).

## Features

Built so far:

- Strict TypeScript monorepo with lint-enforced layers.
- API foundation: validated configuration, structured logs with request ids, RFC 7807
  errors, rate limiting, security headers, health endpoints, OpenAPI generation.
- Shared zod schemas for every request and response.
- Design tokens (light, dark, high contrast) and the first UI primitive.
- Accounts: register, sign in, refresh-token rotation with reuse detection, sign out,
  email verification, password reset, lockout after repeated failures.
- Profiles with optimistic concurrency (ETag and If-Match) and idempotent creation.
- Caregiver sharing through the API: invites, roles (owner, caregiver, viewer), audit log.

## Tech stack

| Area    | Tools                                                                            |
| ------- | -------------------------------------------------------------------------------- |
| API     | Node 22, Express 5, Mongoose 9, zod 4, pino, helmet, argon2, jsonwebtoken        |
| Web     | React 19, Vite 8, React Router, TanStack Query, Tailwind CSS 4, React Flow, GSAP |
| Shared  | zod schemas and types in `packages/shared`                                       |
| Tests   | Vitest, Supertest, React Testing Library, MSW, Playwright, axe                   |
| Tooling | ESLint 10 (typescript-eslint strict, boundaries), Prettier, Husky, commitlint    |

## Architecture

```mermaid
flowchart LR
  subgraph Web["apps/web (four layers)"]
    P[presentation] --> A[application] --> S[services] --> D[domain]
  end
  subgraph API["apps/api (MVC + service + repository)"]
    R[routes] --> C[controllers] --> SV[services] --> RP[repositories] --> M[models]
    SV --> E[engine]
    SV --> I[integrations]
  end
  S -- "JSON over /api/v1" --> R
  M --> DB[(MongoDB)]
  I -- "names" --> RX[RxNorm]
  I -- "label text only" --> LX[Label extractor]

  photo([Label photo]) --> ext[Extraction] --> norm[Normalisation] --> eng[Interaction engine] --> graph([Ranked list and graph])
```

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/DECISIONS.md](docs/DECISIONS.md).

## Getting started

Prerequisites: Node 22 (see `.nvmrc`), npm 10 or newer, and Docker for MongoDB.

```bash
npm ci
```

```bash
cp .env.example .env
```

```bash
docker compose up -d mongo
```

```bash
npm run dev
```

The API listens on <http://localhost:4000> and the web app on <http://localhost:5173>.

Run the checks:

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

The API tests use `MONGO_TEST_URI` if set, then a MongoDB on `localhost:27017`, then
`mongodb-memory-server` as a fallback.

## Scripts

| Script                  | What it does                                             |
| ----------------------- | -------------------------------------------------------- |
| `npm run dev`           | Builds shared types, then runs API and web in watch mode |
| `npm run build`         | Builds all workspaces                                    |
| `npm run lint`          | ESLint, including layer-boundary rules                   |
| `npm run format`        | Formats with Prettier (`format:check` only checks)       |
| `npm run typecheck`     | TypeScript, zero errors required                         |
| `npm test`              | Unit and integration tests in every workspace            |
| `npm run test:coverage` | The same with coverage thresholds                        |
| `npm run openapi`       | Regenerates `docs/openapi.json`                          |
| `npm run docs:check`    | Markdown lint, relative-link check, env-table check      |
| `npm run db:up`         | Starts MongoDB with Docker                               |

## Project structure

```text
apps/
  api/        Express API (routes, controllers, services, repositories, models, engine)
  web/        React app (presentation, application, services, domain, app)
packages/
  shared/     zod schemas, shared types, fixed safety wording
docs/         plan, progress, decisions, design, runbook
scripts/      repository scripts (docs checks)
.github/      workflows, templates, dependabot
```

## Environment variables

<!-- env-table:start -->

| Name                        | Required | Default                          | Secret | Description                                      |
| --------------------------- | -------- | -------------------------------- | ------ | ------------------------------------------------ |
| `NODE_ENV`                  | no       | `development`                    | no     | `development`, `test` or `production`            |
| `PORT`                      | no       | `4000`                           | no     | API port                                         |
| `LOG_LEVEL`                 | no       | `info`                           | no     | pino log level                                   |
| `MONGODB_URI`               | yes      |                                  | yes    | MongoDB connection string                        |
| `JWT_ACCESS_SECRET`         | yes      |                                  | yes    | Access-token signing key, at least 32 characters |
| `ACCESS_TOKEN_TTL_SECONDS`  | no       | `900`                            | no     | Access-token lifetime                            |
| `REFRESH_TOKEN_TTL_DAYS`    | no       | `30`                             | no     | Refresh-token lifetime                           |
| `WEB_ORIGIN`                | no       | `http://localhost:5173`          | no     | Allowed browser origins, comma-separated         |
| `APP_BASE_URL`              | no       | `http://localhost:5173`          | no     | Public web URL used in email links               |
| `COOKIE_SECURE`             | no       | `true` in production             | no     | Send cookies over HTTPS only                     |
| `TRUST_PROXY`               | no       | `0`                              | no     | Number of reverse proxies in front of the API    |
| `ALLOW_DEMO_DATA`           | no       | `false`                          | no     | Lets production start on the demo dataset        |
| `API_DOCS_ENABLED`          | no       | on outside production            | no     | Serve Swagger UI at `/api/docs`                  |
| `RATE_LIMIT_GENERAL_MAX`    | no       | `300`                            | no     | Requests per IP per 15 minutes                   |
| `RATE_LIMIT_AUTH_MAX`       | no       | `20`                             | no     | Auth requests per IP per 15 minutes              |
| `RATE_LIMIT_EXTRACTION_MAX` | no       | `10`                             | no     | Label-extraction requests per IP per hour        |
| `RXNORM_ENABLED`            | no       | `true`                           | no     | Use the RxNorm name lookup                       |
| `RXNORM_BASE_URL`           | no       | `https://rxnav.nlm.nih.gov/REST` | no     | RxNorm API base URL                              |
| `LABEL_EXTRACTION_ENABLED`  | no       | `false`                          | no     | Turn label-photo reading on                      |
| `LABEL_EXTRACTOR`           | no       | `mock`                           | no     | `mock`, `ollama` or `anthropic`                  |
| `EXTRACTION_BASE_URL`       | no       |                                  | no     | Provider base URL (required for `ollama`)        |
| `EXTRACTION_MODEL`          | no       |                                  | no     | Vision model name (required for real providers)  |
| `EXTRACTION_API_KEY`        | no       |                                  | yes    | Provider API key (required for `anthropic`)      |
| `EXTRACTION_TIMEOUT_MS`     | no       | `20000`                          | no     | Extraction timeout per request                   |
| `EXTRACTION_DAILY_CAP`      | no       | `20`                             | no     | Label photos per user per day                    |
| `EMAIL_ADAPTER`             | no       | `console`                        | no     | `console` or `smtp`                              |
| `EMAIL_FROM`                | no       | `MedMap <no-reply@localhost>`    | no     | From address                                     |
| `SMTP_URL`                  | no       |                                  | yes    | SMTP connection URL (required for `smtp`)        |
| `SENTRY_DSN`                | no       |                                  | yes    | Enables error reporting when set                 |
| `VITE_DEV_API_PROXY`        | no       | `http://localhost:4000`          | no     | Where the web dev server proxies `/api`          |

<!-- env-table:end -->

## API overview

The API is versioned under `/api/v1`. Errors use `application/problem+json`. In development
the interactive docs are at <http://localhost:4000/api/docs>; the generated document is
[docs/openapi.json](docs/openapi.json). [docs/API.md](docs/API.md) has curl examples.

## Testing and quality gates

CI runs lint, formatting, typecheck, unit and integration tests with coverage thresholds,
build, an OpenAPI drift check, `npm audit` for production dependencies, docs checks and a
secret scan. All must be green before a merge.

## Deployment

Planned targets are Vercel (web), Render (API) and MongoDB Atlas. Nothing is deployed yet.
See [docs/PLAN.md](docs/PLAN.md).

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities as described in
[SECURITY.md](SECURITY.md).

## Licence

To be chosen. Until the owner picks a licence, all rights are reserved.

## Data sources

No real interaction dataset is bundled. See [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## Roadmap

Planned, not built yet: medicines and name lookup (M2),
interaction engine and demo dataset (M3), results list and graph (M4), label photos (M5),
caregiver sharing, export and delete (M6), hardening (M7), deployment (M8).
After v1: dose reminders, loose-pill identification, EHR integration, native apps.
