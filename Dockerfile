# Multi-stage Dockerfile for hosting Horizon PM on any cloud or server
FROM node:22-bullseye AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy full source tree
COPY . .

# Build production bundle
RUN npm run build

# Runtime Stage
FROM node:22-bullseye-slim

WORKDIR /app

# Install native SQLite runtime requirements
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy build outputs from builder
COPY --from=builder /app/out ./out
COPY --from=builder /app/public ./public
COPY --from=builder /app/electron ./electron
COPY --from=builder /app/src/types ./src/types
COPY --from=builder /app/server ./server

# Persist data directory
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV DATABASE_PATH=/app/data/horizon.db

EXPOSE 3000

CMD ["npx", "tsx", "server/index.ts"]
