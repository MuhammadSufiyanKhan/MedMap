# Decisions

Short architecture decision records. Newest last.

## ADR-0001: TypeScript 6.0, not 7.0

- **Decision:** pin `typescript` to 6.0.x.
- **Alternatives:** TypeScript 7.0 (current stable).
- **Why:** `typescript-eslint` 8 supports `<6.1.0` only, and strict type-checked linting is
  a hard requirement. Revisit when typescript-eslint supports 7.

## ADR-0002: no `eslint-plugin-jsx-a11y`

- **Decision:** accessibility is enforced with axe tests (component and end-to-end), not
  with a JSX lint plugin.
- **Alternatives:** `eslint-plugin-jsx-a11y`.
- **Why:** it does not support ESLint 10.

## ADR-0003: Tailwind 4 with tokens in `tailwind.config.ts`

- **Decision:** keep all design tokens in `apps/web/tailwind.config.ts`, loaded with
  `@config`. A small plugin in the config emits CSS variables per theme.
- **Alternatives:** Tailwind 4's CSS-first `@theme` block.
- **Why:** the brief asks for tokens in the Tailwind config, and one typed file is easier
  to review than tokens spread over CSS.

## ADR-0004: OpenAPI generated with zod's own JSON Schema output

- **Decision:** a declarative route table (`RouteSpec`) drives validation, response
  serialisation and the OpenAPI 3.1 document, using `z.toJSONSchema`.
- **Alternatives:** `@asteasolutions/zod-to-openapi`.
- **Why:** no extra dependency, and `packages/shared` stays free of OpenAPI-specific code.
  Every response is parsed through its documented schema before it is sent, so responses
  cannot drift from the contract and undocumented fields are stripped.

## ADR-0005: ESM everywhere

- **Decision:** all workspaces are ES modules (`"type": "module"`, NodeNext in the API).
- **Alternatives:** CommonJS for the API.
- **Why:** `file-type` is ESM-only and the web app is ESM anyway.

## ADR-0006: refresh tokens are opaque, not JWTs

- **Decision:** refresh tokens are 48 random bytes, stored as SHA-256 hashes, rotated on
  every use, with family-wide revocation on reuse.
- **Alternatives:** signed JWT refresh tokens.
- **Why:** rotation and reuse detection need server state anyway, and an opaque token
  carries no claims to leak.

## ADR-0007: CSRF by double-submit cookie plus Origin allowlist

- **Decision:** cookie-authenticated endpoints (`/auth/refresh`, `/auth/logout`) require an
  `X-CSRF-Token` header equal to the readable `medmap_csrf` cookie, and a known `Origin`.
- **Alternatives:** rely on `SameSite=Strict` alone; a server-side CSRF token store.
- **Why:** defence in depth without server state. All other endpoints use a bearer token
  from memory and are not exposed to CSRF.

## ADR-0008: optimistic concurrency with an integer version

- **Decision:** mutable resources carry a `version` field. The ETag is `"v<version>"`.
  `PATCH` and `PUT` require `If-Match`; a missing header is 428 and a stale one is 412.
- **Alternatives:** ETags from content hashes or `updatedAt`.
- **Why:** a version makes the conditional update one atomic MongoDB query.

## ADR-0009: in-memory rate-limit store

- **Decision:** `express-rate-limit` with its memory store.
- **Alternatives:** a shared store in MongoDB or Redis.
- **Why:** the free-tier deployment runs one API instance. If the API is ever scaled out,
  switch to a shared store first; limits would otherwise be per instance.

## ADR-0010: milestone branches and pull requests from a cloud session

- **Decision:** each milestone lands as a pull request from a `feat/...` branch, opened and
  squash-merged with the session's GitHub tools once CI is green.
- **Alternatives:** committing straight to `main`.
- **Why:** the brief requires pull requests with green CI. Branch protection itself has to
  be applied by the owner (`docs/REPO_SETTINGS.md`) because the session cannot change
  repository settings.

## ADR-0011: Atkinson Hyperlegible Next as the only typeface

- **Decision:** one self-hosted variable font for all text.
- **Alternatives:** a display serif plus a text sans; system fonts.
- **Why:** it was designed for readers with low vision, which fits an audience of older
  people. Self-hosting keeps third-party requests off medical screens.

## ADR-0012: M2 and M3 land in one pull request

- **Decision:** medicines with name matching (M2) and the dataset, guard and engine (M3)
  are merged together.
- **Alternatives:** two pull requests.
- **Why:** the demo name catalogue is only valid while the demo dataset is active, so the
  normaliser depends on the dataset code. Splitting would have meant a temporary shim.
  This departs from "one pull request per milestone" in the brief.

## ADR-0013: "not in dataset" is its own unchecked reason

- **Decision:** a medicine whose ingredients never appear in the dataset is reported as
  could not check (`not_in_dataset`), the same as one that could not be identified.
- **Alternatives:** count it as checked with no flags.
- **Why:** if the source has no entry at all for an ingredient, the absence of a flag says
  nothing. Reporting it as checked would overstate what was looked up (safety rule 4).

## ADR-0014: an invented demo catalogue, gated on the active dataset

- **Decision:** the demo dataset uses made-up medicine names with `DEMO-` ids. A small
  demo normaliser resolves those names, and it is consulted only while the active dataset
  has `kind: demo`.
- **Alternatives:** demo pairs between real medicines.
- **Why:** fake pairs between real medicines would be invented medical facts that someone
  could mistake for real ones.

## ADR-0015: any member may run a check

- **Decision:** viewers can run interaction checks as well as read them.
- **Alternatives:** caregivers and owners only.
- **Why:** a check is derived data. It changes nothing a viewer can see, and without it a
  viewer could be left reading a stale result.

## ADR-0016: DDInter import maps names through RxNorm and skips what it cannot map

- **Decision:** the `ddinter` import format resolves drug names to RxNorm ingredients and
  imports a row only when both names match exactly one ingredient.
- **Alternatives:** fuzzy matching; keeping names as keys.
- **Why:** a wrong match would attach an interaction to the wrong medicine. Skipped rows
  are reported so the owner can see the coverage lost.

## ADR-0017: Lighthouse through its Node API, not Lighthouse CI

- **Decision:** `apps/web/scripts/lighthouse.ts` drives Lighthouse directly, signs in
  through the API and asserts the budgets for the landing and results pages.
- **Alternatives:** `@lhci/cli` with a Puppeteer login script.
- **Why:** the results page needs a session and a profile id that only exists at run time.
  LHCI needs a JavaScript login script and a static URL list; a TypeScript script is
  simpler and keeps the repository TypeScript-only.

## ADR-0018: GSAP loads with the page chunks that animate

- **Decision:** animation hooks import GSAP statically and live in lazily loaded page and
  layout chunks. The entry bundle contains no GSAP and no React Flow; React Flow loads
  when the Graph tab is opened.
- **Alternatives:** dynamic `import()` of GSAP inside each hook.
- **Why:** the brief asks for the `useGSAP` hook, which needs a static import. Both
  layouts use the route transition, so GSAP is part of every routed page after the first
  paint, while React Flow stays out until needed. Lighthouse performance is 99 on both
  measured pages.

## ADR-0019: the sharing screens ship with M4

- **Decision:** the sharing page and invite acceptance page are part of the M4 web
  milestone; M6 adds account export and deletion.
- **Alternatives:** hold the sharing screens back until M6.
- **Why:** the API has existed since M1 and the profile page links to sharing.
