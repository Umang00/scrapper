# Multi-stage build for API Server
FROM node:24-alpine AS builder

WORKDIR /app

# Copy workspace root and shared dependencies
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY api-server/package*.json ./api-server/

# Install dependencies
RUN npm ci --workspace=@universal-crawler/shared --workspace=@universal-crawler/api-server

# Copy source code
COPY shared/ ./shared/
COPY api-server/ ./api-server/

# Build shared types
WORKDIR /app/shared
RUN npm run build

# Build API server
WORKDIR /app/api-server
RUN npm run build

# Production image
FROM node:24-alpine AS runner

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 apiserver

WORKDIR /app

# Copy workspace configuration
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/api-server/package.json ./api-server/

# Install production dependencies only
RUN npm ci --workspace=@universal-crawler/shared --workspace=@universal-crawler/api-server --omit=dev

# Copy built artifacts
COPY --from=builder --chown=apiserver:nodejs /app/shared/dist ./shared/dist
COPY --from=builder --chown=apiserver:nodejs /app/api-server/dist ./api-server/dist

# Set working directory and user
WORKDIR /app/api-server
USER apiserver

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "dist/index.js"]
