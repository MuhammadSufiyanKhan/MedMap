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
