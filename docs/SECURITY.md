# Security and privacy

This document describes how MedMap protects accounts and health data. It grows with each
milestone. To report a vulnerability see [../SECURITY.md](../SECURITY.md).

## Transport and headers

- helmet sets a strict Content-Security-Policy on the API (`default-src 'none'`), HSTS in
  production, `nosniff`, and `no-referrer`.
- CORS allows only the origins in `WEB_ORIGIN`.
- Every `/api/v1` response sends `Cache-Control: no-store`.

## Input handling

- Every params, query and body value is validated with a strict zod schema at the edge.
  Unknown keys are rejected, so operator objects such as `{"$gt": ""}` cannot reach a query.
- JSON bodies are limited to 100 kB.
- Cursors are opaque and validated before use.

## Errors and logs

- Errors are RFC 7807 documents with a request id. Stack traces and internals never leave
  the server.
- Logs are structured (pino) with a request id on every line. Request bodies are never
  logged, query strings are dropped from logged URLs, and credentials, tokens, emails and
  free-text health fields are redacted by path.

## Rate limiting

- 300 requests per 15 minutes per IP in general, 20 on auth endpoints, 10 per hour on label
  extraction. 429 responses carry `Retry-After` and the standard `RateLimit` header.

## Accounts and sessions

- Passwords are hashed with argon2id (19 MiB, 2 iterations). Minimum length 10.
- Sign-in answers the same 401 for an unknown email and a wrong password, and takes the
  same time for both. Five failures in a row lock the account for 15 minutes (429 with
  `Retry-After`).
- The access token is a 15-minute HS256 JWT held in browser memory only. The algorithm is
  pinned; `alg: none` and foreign keys are rejected.
- The refresh token is 48 random bytes in an `HttpOnly; Secure; SameSite=Strict` cookie
  scoped to `/api/v1/auth`. Only its SHA-256 hash is stored. Every refresh rotates it.
  Presenting an already-used token revokes the whole token family.
- Cookie-authenticated endpoints (`/auth/refresh`, `/auth/logout`) require the
  `X-CSRF-Token` header to match the `medmap_csrf` cookie and reject unknown origins.
- Email verification and password reset use single-use, hashed, expiring tokens. A password
  reset signs the user out everywhere. Reset requests always answer 202.
- In production the console email adapter prints no message bodies, because they contain
  tokens.

## Authorisation

- The user id comes only from the verified access token.
- Every profile-scoped service method first calls `AccessService.require`. A user who is
  not a member gets 404, the same as for a profile that does not exist. A member whose role
  is too low gets 403.
- Roles: `owner` (everything), `caregiver` (read, change medicines, read labels, run
  checks), `viewer` (read, run checks). The table is `PERMISSIONS` in
  `apps/api/src/services/access.service.ts`.
- `tests/integration/authorization.test.ts` builds its cases from the live route table and
  fails if a profile route has no stated expectation.

## Audit log

- Append-only: the model refuses single-document updates and deletes.
- Entries hold actor id, profile id, action and target id. No names, notes or medicine
  names are written.
- Entries are erased only with their profile or account.

## Label photos

- Off unless `LABEL_EXTRACTION_ENABLED=true`. The mock extractor is refused in production.
- The request is authenticated and role-checked (caregiver or owner) before any upload
  bytes are parsed.
- Photos are held in memory only: never written to disk, to the database or to logs.
- Limits: 5 MB per photo, 3 photos per request, no other form fields. Over the limits is
  413; a non-multipart body is 415.
- The file type is decided from magic bytes (`file-type`), not from the name or the
  client's Content-Type. Only JPEG, PNG and WebP are accepted.
- Every photo is decoded and re-encoded as JPEG with `sharp` before it leaves the server.
  That removes EXIF and all other metadata (location, device, time) and rejects files that
  are not really images. Large photos are scaled to 1600 px.
- Each provider call has a 20-second timeout. Errors and timeouts become "could not read"
  results; provider error bodies are never returned or logged.
- Limits: 10 requests per IP per hour, plus a per-user daily cap (`EXTRACTION_DAILY_CAP`,
  default 20 photos). Rejected uploads do not use up the allowance.
- The model's reply must match a strict schema; anything else is dropped. The system
  prompt tells the model to transcribe only and to ignore instructions printed on a label.
  Extracted text is only ever shown back to the user for confirmation. It never becomes
  clinical content and nothing follows instructions found in it.
- The consent screen says that photos go to the configured provider and are not stored by
  MedMap. Which provider you configure decides what that provider keeps: check its terms.
