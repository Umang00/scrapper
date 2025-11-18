# Multi-stage build for Crawler Workers
FROM node:24-alpine AS builder

WORKDIR /app

# Copy workspace root and shared dependencies
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY workers/package*.json ./workers/

# Install dependencies (skip Puppeteer browser download, we'll use Playwright)
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci --workspace=@universal-crawler/shared --workspace=@universal-crawler/workers

# Copy source code
COPY shared/ ./shared/
COPY workers/ ./workers/

# Build shared types
WORKDIR /app/shared
RUN npm run build

# Build workers
WORKDIR /app/workers
RUN npm run build

# Production image
FROM mcr.microsoft.com/playwright:v1.56.1-noble AS runner

# Add non-root user for security
RUN groupadd --system --gid 1001 nodejs || true
RUN useradd --system --uid 1001 worker || true

WORKDIR /app

# Install Node.js 24 (Playwright image may have different version)
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
RUN apt-get update && apt-get install -y nodejs && rm -rf /var/lib/apt/lists/*

# Copy workspace configuration
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/workers/package.json ./workers/

# Install production dependencies only
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci --workspace=@universal-crawler/shared --workspace=@universal-crawler/workers --omit=dev

# Install Playwright browsers (already included in base image, but ensure they're available)
RUN npx playwright install chromium --with-deps || true

# Copy built artifacts
COPY --from=builder --chown=worker:nodejs /app/shared/dist ./shared/dist
COPY --from=builder --chown=worker:nodejs /app/workers/dist ./workers/dist

# Set working directory and user
WORKDIR /app/workers
USER worker

# Workers run as separate processes, no exposed ports
# Health check can be added if workers expose a health endpoint

# Start crawler worker
CMD ["node", "dist/crawler.js"]
