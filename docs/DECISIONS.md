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
