# ── Multi-Stage Production Dockerfile for Horizon PM Web Edition ──

# Stage 1: Build & Compile
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install native compilation tools for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package*.json ./

# Install full dependencies with desktop Electron binary download skipped
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN npm ci

# Copy source files
COPY . .

# Build web distribution assets into out/renderer
RUN npm run build

# Prune devDependencies to keep only production packages + native bindings
RUN npm prune --omit=dev


# Stage 2: Minimal Production Runtime
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Create persistent data directory and grant ownership to node user
RUN mkdir -p /app/data && chown -R node:node /app

# Copy production node_modules from builder (including compiled better-sqlite3 native bindings)
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/out ./out
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/electron ./electron
COPY --from=builder --chown=node:node /app/src/types ./src/types
COPY --from=builder --chown=node:node /app/server ./server
COPY --from=builder --chown=node:node /app/tsconfig.json ./tsconfig.json

# Run as non-root user for security
USER node

# Persistent volume for SQLite database and attachments
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV DATABASE_PATH=/app/data/horizon.db

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

CMD ["npx", "tsx", "server/index.ts"]
