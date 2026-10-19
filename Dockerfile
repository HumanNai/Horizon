# Production Dockerfile for Horizon PM Web Edition
FROM node:20-bookworm-slim

WORKDIR /app

# Install native compilation tools for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package*.json ./

# Install production dependencies only (Fast, minimal, no desktop electron binaries)
RUN npm ci --omit=dev

# Copy application server, pre-built web client, and configuration
COPY out ./out
COPY public ./public
COPY electron ./electron
COPY src/types ./src/types
COPY server ./server
COPY tsconfig.json ./tsconfig.json

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
