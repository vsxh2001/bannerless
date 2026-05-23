# Multi-stage build for the Bannerless Next.js app.
#
# Both stages use the SAME base image (node:22-slim, Debian = glibc) so that
# better-sqlite3's native .node binary built/downloaded in the `builder` stage
# is ABI-compatible with the Node runtime in the final stage. Do not switch the
# final stage to Alpine (musl): the prebuilt/compiled binary would fail to load.

# ---- Builder: install deps, build the app, transpile the migrator -----------
FROM node:22-slim AS builder
WORKDIR /app

# Build essentials in case better-sqlite3 must compile from source (i.e. no
# prebuilt binary for this Node/platform). Harmless if the prebuilt is used.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first for better layer caching. devDependencies
# (TypeScript, tailwind, esbuild, ...) are required to build, so do NOT use --omit=dev.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build the Next.js app -> .next/standalone (minimal server.js + traced node_modules).
RUN npm run build

# Transpile the standalone migrator (src/db/migrate.ts) to plain ESM JS so the
# final stage can run it with `node` (no tsx/ts-node needed at runtime). The
# .mjs extension forces ESM regardless of the surrounding package.json "type".
# esbuild ships as part of the dev toolchain (tsx -> esbuild), so this adds no deps.
RUN node_modules/.bin/esbuild src/db/migrate.ts \
  --bundle=false --format=esm --platform=node --target=node22 \
  --outfile=migrate.mjs

# ---- Runner: minimal image that runs the standalone server ------------------
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
# Listen on all interfaces (Fly proxies to internal_port). Next's server.js
# reads HOSTNAME/PORT.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# Default DB path; fly.toml [env] overrides this to the mounted volume path.
ENV DATABASE_URL=/data/app.db

# /data is the Fly volume mount point. Ensure the non-root `node` user can write it.
RUN mkdir -p /data && chown node:node /data

# Standalone server output: a self-contained app root (server.js + traced
# node_modules). `.next/static` and `public/` are NOT bundled by standalone,
# so copy them in explicitly.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# Boot-time migration assets (used by docker-entrypoint.sh):
#  - drizzle/      : committed SQL migrations + meta journal
#  - migrate.mjs   : transpiled standalone migrator (drizzle-orm better-sqlite3)
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/migrate.mjs ./migrate.mjs

# The standalone trace bundles only what the app *routes* import. The migrator
# additionally needs better-sqlite3 (also pulled in by the app, but be explicit
# so the native .node binary is guaranteed present) and drizzle-orm's migrator
# submodule. Copying over an already-present path is a no-op.
COPY --from=builder --chown=node:node /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder --chown=node:node /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER node
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
