# API guide

Base URL in development: `http://localhost:4000/api/v1`. The full reference is generated:
[openapi.json](openapi.json), or Swagger UI at `/api/docs` outside production.

Conventions:

- JSON in, JSON out. Errors are `application/problem+json` with `type`, `title`, `status`,
  `detail`, `requestId` and, for validation errors, `errors[]`.
- Send `Authorization: Bearer <accessToken>` on everything except the public auth routes.
- Lists are cursor-paginated: `?limit=25&cursor=...` returns `{ "items": [], "nextCursor": null }`.
- `PATCH` and `PUT` need `If-Match` with the resource's `ETag`. Missing header: 428.
  Stale value: 412.
- Creating `POST`s accept `Idempotency-Key`. A retry with the same key and body returns the
  first response with `Idempotent-Replayed: true`.
- Every response carries `Cache-Control: no-store` and `X-Request-Id`.

The examples use a shell variable for the token:

```bash
API=http://localhost:4000/api/v1
```

## Create an account and sign in

```bash
curl -s -c cookies.txt -X POST "$API/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"carer@example.com","password":"a long enough password"}'
```

The response holds `accessToken` (15 minutes). The refresh token is set as an httpOnly
cookie that is only sent to `/api/v1/auth`.

```bash
TOKEN=$(curl -s -c cookies.txt -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"carer@example.com","password":"a long enough password"}' | jq -r .accessToken)
```

## Refresh and sign out

Both use the refresh cookie and need the CSRF header, which echoes the `medmap_csrf` cookie:

```bash
CSRF=$(grep medmap_csrf cookies.txt | awk '{print $7}')
curl -s -b cookies.txt -c cookies.txt -X POST "$API/auth/refresh" -H "X-CSRF-Token: $CSRF"
```

```bash
curl -s -b cookies.txt -X POST "$API/auth/logout" -H "X-CSRF-Token: $CSRF" -o /dev/null -w '%{http_code}\n'
```

## Profiles

```bash
curl -s -i -X POST "$API/profiles" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: create-mum-0001' \
  -d '{"displayName":"Mum","birthYear":1941}'
```

The response has `Location` and `ETag: "v1"`. To change it:

```bash
curl -s -X PATCH "$API/profiles/$PROFILE_ID" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H 'If-Match: "v1"' \
  -d '{"notes":"Takes tablets with breakfast"}'
```

## Sharing

Invite a caregiver (owner only). The token in the response is shown once:

```bash
curl -s -X POST "$API/profiles/$PROFILE_ID/invites" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"email":"sister@example.com","role":"caregiver"}'
```

The invited person signs in with that email and accepts:

```bash
curl -s -X POST "$API/invite-acceptances" \
  -H "Authorization: Bearer $OTHER_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"token\":\"$INVITE_TOKEN\"}"
```

Roles: `owner` can do everything; `caregiver` can read and change medicines; `viewer` can
only read. A user who is not a member gets 404 for every profile route.
