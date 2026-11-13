# MedMap build plan

MedMap is a visual medication interaction map. A caregiver photographs pill-bottle
labels or types names, confirms what was read, and sees a ranked plain-language list
of flagged interactions plus a node graph. It is an information tool, not medical
advice.

This file and `docs/PROGRESS.md` are enough for a new session to resume the work.

## 1. Architecture

Monorepo with npm workspaces. TypeScript everywhere.

| Workspace         | Role                                                                  |
| ----------------- | --------------------------------------------------------------------- |
| `packages/shared` | zod schemas, DTO types, enums, fixed safety templates. No app imports |
| `apps/api`        | Express 5 REST API, Mongoose, MVC with service and repository layers  |
| `apps/web`        | React 19 + Vite SPA in four layers                                    |

Backend dependency direction (lint-enforced):
`routes -> controllers -> services -> repositories -> models`.
Controllers return DTOs. Services take and return plain objects and throw `AppError`
subclasses. Only repositories import Mongoose. The interaction engine in `engine/` is
pure functions.

Frontend dependency direction (lint-enforced):
`presentation -> application -> services -> domain`, with `app/` as the bootstrap.

Data flow: label photo -> `LabelExtractor` adapter (text reading only) -> user confirms
and edits -> RxNorm normalisation to ingredient level -> interaction engine looks up
ingredient pairs in the indexed `InteractionPair` collection -> ranked list -> graph.

Safety enforcement points (section 1 of the brief):

| Rule                             | Enforcement                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| 1. Never say "safe"              | Unflagged pairs are never returned or drawn. UI test scans rendered results for "safe"   |
| 2. LLM only reads labels         | Extractor output is a zod-validated struct. Clinical text comes from dataset + templates |
| 3. Never advise stopping         | Fixed templates in `packages/shared/src/safety.ts`, snapshot-tested                      |
| 4. Unchecked medicines visible   | Engine returns `uncheckedMedications`; hatched node + badge + summary count              |
| 5. Dataset attribution           | `datasetInfo` on every check result, rendered by a shared `DatasetAttribution` component |
| 6. Demo-data guard               | Boot check in `server.ts` + production workflow check + persistent banner                |
| 7. Not medical advice            | First-run notice (blocking) + footer                                                     |

## 2. Technology choices

Current stable versions verified with `npm view` on 2026-11-13: Express 5, Mongoose 9,
zod 4, React 19, Vite 8, React Router 8, TanStack Query 5, Tailwind CSS 4, React Flow
(`@xyflow/react` 12), GSAP 3, Vitest 5, Playwright 1.65, ESLint 10.

Deviations, each recorded in `docs/DECISIONS.md`:

- TypeScript 6.0.x, not 7.0: `typescript-eslint` supports `<6.1.0` only.
- `eslint-plugin-jsx-a11y` is not used because it does not support ESLint 10.
  Accessibility is covered by axe tests instead.
- Tailwind 4 is CSS-first. Tokens live in `apps/web/tailwind.config.ts` (loaded with
  `@config`) and map to CSS variables so light, dark and high-contrast themes share
  semantic names.

## 3. Hosting

| Part     | Choice                                    | Free tier | Notes                                                        |
| -------- | ----------------------------------------- | --------- | ------------------------------------------------------------ |
| Web      | Vercel (static Vite build)                | Yes       | Rewrite `/api/*` to the API host so cookies stay same-origin |
| API      | Render web service from the GHCR image    | Yes       | Free instances sleep when idle; first request is slow        |
| Database | MongoDB Atlas M0, one project per env     | Yes       | M0 has no continuous backup; see risks                       |
| Images   | GitHub Container Registry                 | Yes       |                                                              |
| CI/CD    | GitHub Actions                            | Yes       | Free for public repos; private repos have a monthly quota    |

Nothing in the plan needs a paid resource. Paid options that would remove a risk, to
be bought only if you decide to: Render Starter (no sleep, about 7 USD per month),
Atlas M10 (backups and private networking, about 57 USD per month).

## 4. Prerequisites (only you can do these)

The build does not wait for these. Exact steps are in `docs/SETUP_CHECKLIST.md`.

| #   | What                                                                 | Needed for             | Verify with                         |
| --- | -------------------------------------------------------------------- | ---------------------- | ----------------------------------- |
| 1   | GitHub CLI logged in on your machine                                 | `setup-secrets.sh`     | `gh auth status`                    |
| 2   | Vercel account, project linked to this repo, a Vercel token          | Web deploys            | `vercel whoami`                     |
| 3   | Render account, two web services (staging, production), API key      | API deploys            | Render dashboard shows the services |
| 4   | MongoDB Atlas account, staging and production projects, DB users     | Database               | `mongosh "<uri>" --eval "db.ping"`  |
| 5   | GitHub Environments `staging` and `production` (you as reviewer)     | Deploy gates           | Repo settings -> Environments       |
| 6   | Branch protection on `main` (rules in `docs/REPO_SETTINGS.md`)       | Required checks        | Repo settings -> Branches           |
| 7   | A real interaction dataset file with a licence you have confirmed    | Production             | `npm run import:interactions`       |
| 8   | Label-extraction provider key (optional)                             | Photo extraction       | Extraction works on staging         |
| 9   | Email provider SMTP credentials (optional; console adapter otherwise) | Verification emails    | Receive a verification email        |
| 10  | Sentry DSN (optional)                                                | Error reporting        | Test event appears                  |
| 11  | Your decisions: repository licence, legal review of the disclaimer   | Public release         | n/a                                 |

## 5. Milestones

Each milestone is one pull request, squash-merged into `main` after CI is green.

| ID  | Scope                                                                                      |
| --- | ------------------------------------------------------------------------------------------ |
| M0  | Repo hygiene, scaffold, strict TS, lint with layer boundaries, design tokens, OpenAPI, CI  |
| M1  | Auth, profiles, authorisation helpers, audit log                                           |
| M2  | Manual medicines, RxNorm normalisation, shared schemas                                     |
| M3  | Dataset model, import job, demo dataset and guard, interaction engine                      |
| M4  | Ranked list and graph UI, responsive layouts, landing page with motion, a11y, print page   |
| M5  | Label extraction with confirm-and-edit, upload hardening, evaluation script                |
| M6  | Caregiver sharing and roles, export and delete                                             |
| M7  | Hardening, E2E, Docker, final CI, documentation pass                                       |
| M8  | Deployment and release automation, staging, gated production                               |

## 6. Risks

| Risk                                                                                    | Mitigation                                                                                  |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| No real interaction dataset yet; licence of DDInter 2.0 unverified                      | Demo dataset with guard. Production refuses demo data. You confirm the licence              |
| The cloud session cannot reach RxNorm, Atlas, Vercel or Render                          | Code against documented APIs with recorded fixtures and MSW. Steps in `SETUP_CHECKLIST.md`  |
| Staging cannot go live until you create the accounts and secrets                        | All workflows and configs are written and validated; recorded in `docs/BLOCKERS.md`         |
| Render free tier has no fixed egress IP, so Atlas needs a wide network allowlist        | Strong DB credentials, TLS, least-privilege user. Trade-off in `SECURITY.md`                |
| Atlas M0 has no continuous backups                                                      | Scheduled `mongodump` procedure in the runbook; upgrade path documented                     |
| Supplements and herbs have thin coverage in any dataset                                 | Stated in the UI wherever results appear                                                    |
| The medical disclaimer has not had legal review                                         | Blocker for production; listed in the final summary                                         |
| Very new major versions of tools (Vite 8, ESLint 10, zod 4)                             | Pin exact majors, verify APIs against installed types, CI on every PR                       |

## 7. How to resume

Read `docs/PROGRESS.md`, check out `main`, run `npm ci`, and continue at the first
milestone that is not marked done.
