#!/bin/sh
# Container entrypoint for the Bannerless app on Fly.io.
#
# Runs DB migrations against the persistent volume DB, then hands off to the
# Next.js standalone server. Migrations run HERE (not via a Fly release_command)
# because Fly release machines do not mount the app volume, so the DB at
# $DATABASE_URL is only reachable from the running app machine.
set -e

# Default matches the Dockerfile / fly.toml volume path.
: "${DATABASE_URL:=/data/app.db}"
export DATABASE_URL

echo "[entrypoint] DATABASE_URL=$DATABASE_URL"
echo "[entrypoint] applying database migrations..."
# migrate.mjs is the transpiled src/db/migrate.ts (drizzle-orm better-sqlite3
# migrator). It is idempotent: already-applied migrations are skipped.
node migrate.mjs

echo "[entrypoint] starting Next.js server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
# exec so the Node process becomes PID 1 and receives signals (graceful shutdown).
exec node server.js
