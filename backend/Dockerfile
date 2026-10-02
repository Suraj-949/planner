# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Backend image.
#
# This must be built from the REPOSITORY ROOT, not from backend/, because the
# authoritative lockfile lives at the root — npm workspaces resolve every
# package from it. Building from backend/ would resolve fresh versions on every
# build and could drift from what CI tested.
#
#   docker build -f backend/Dockerfile -t planner-api .
#
# Run:
#
#   docker run -p 3000:3000 \
#     -e MONGO_URI="mongodb://..." \
#     -e JWT_SECRET="<32+ chars>" \
#     -e CORS_ORIGINS="https://your-app.example.com" \
#     planner-api
# ---------------------------------------------------------------------------

# ---- dependencies ---------------------------------------------------------
# Kept in its own layer so a source-only change does not reinstall node_modules.
FROM node:22-bookworm-slim AS deps

# `bcrypt` needs a toolchain to compile its native addon when no prebuilt binary
# matches this platform. Build tools live here only, never in the runtime image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Manifests only: the root lockfile plus every workspace package.json, so this
# layer is cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json

# --workspace backend installs only the API's dependencies; --omit=dev leaves
# mongodb-memory-server and the other test tooling out of the runtime image.
RUN npm ci --omit=dev --workspace backend \
    && npm cache clean --force

# ---- runtime --------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

# curl backs the container healthcheck below.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY backend/server.js ./backend/server.js
COPY backend/src ./backend/src

# The image runs unprivileged; `node` (uid 1000) ships with the base image.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

# Exec form so node is PID 1 and receives SIGTERM, which the graceful shutdown
# handler in server.js needs in order to close the Mongo connection.
CMD ["node", "backend/server.js"]