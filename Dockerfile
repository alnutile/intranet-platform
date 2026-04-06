# ─── Build stage ──────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build

WORKDIR /app

# Tools needed to compile better-sqlite3's native binding.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Build the host client bundle into server/public.
RUN npm run build

# ─── Runtime stage ────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

# `git` is required so the admin can install plugins from GitHub URLs at
# runtime. `tsx` (shipped as a runtime dep) handles on-the-fly TypeScript
# execution for plugin server code without a separate tsc step.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app /app

# Single persist directory for DB + uploads. On Railway, attach a volume
# at /app/persist via the dashboard (VOLUME keyword is banned there).
RUN mkdir -p /app/persist/uploads

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

EXPOSE ${PORT}

CMD ["sh", "-c", "node scripts/setup.mjs && npm start"]
