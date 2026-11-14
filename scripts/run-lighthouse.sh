#!/usr/bin/env bash
# Starts the API (demo data) and the production web build, runs the Lighthouse budget
# check against them and stops both. Needs MongoDB on MONGO_TEST_URI or localhost:27017.
set -euo pipefail

MONGO="${MONGO_TEST_URI:-mongodb://127.0.0.1:27017}"
API_PORT=4100
WEB_PORT=4173

cleanup() {
  kill "${API_PID:-}" "${WEB_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT

if ! curl -fsS "http://127.0.0.1:${API_PORT}/readyz" >/dev/null 2>&1; then
  NODE_ENV=test LOG_LEVEL=warn PORT="${API_PORT}" \
    MONGODB_URI="${MONGO%/}/medmap_e2e" \
    JWT_ACCESS_SECRET="e2e-only-secret-e2e-only-secret-e2e-only" \
    WEB_ORIGIN="http://127.0.0.1:${WEB_PORT}" APP_BASE_URL="http://127.0.0.1:${WEB_PORT}" \
    ALLOW_DEMO_DATA=true RXNORM_ENABLED=false RATE_LIMIT_AUTH_MAX=100000 \
    npm run e2e:serve -w @medmap/api >/dev/null 2>&1 &
  API_PID=$!
fi

if ! curl -fsS "http://127.0.0.1:${WEB_PORT}/" >/dev/null 2>&1; then
  (cd apps/web && VITE_DEV_API_PROXY="http://127.0.0.1:${API_PORT}" \
    npx vite preview --host 127.0.0.1 --port "${WEB_PORT}" --strictPort >/dev/null 2>&1) &
  WEB_PID=$!
fi

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${API_PORT}/readyz" >/dev/null 2>&1 &&
    curl -fsS "http://127.0.0.1:${WEB_PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

npm run lighthouse -w @medmap/web
