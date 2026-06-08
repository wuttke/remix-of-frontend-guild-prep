# Multi-stage build for TanStack Start SSR application
# Stage 1: Build the production app
FROM node:22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# Using --legacy-peer-deps based on README instructions
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Public Vite build-time env vars. Must be ARG (not just ENV) so docker-compose
# can pass them via build.args. They get baked into the client bundle.
ARG VITE_USE_MOCK_DATA
ENV VITE_USE_MOCK_DATA=$VITE_USE_MOCK_DATA

# Build the production app
# Nitro (preset: node-server, configured in vite.config.ts) produces
# .output/server/index.mjs (standalone Node HTTP server) and .output/public/
# (static assets). The bundle is self-contained — no runtime npm install needed.
RUN npm run build

# Stage 2: Production runtime
FROM node:22-alpine AS runner

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy the self-contained nitro build output from the builder stage.
# Includes server/, public/, and a bundled server/node_modules/, so no
# `npm ci` is needed in the runner.
COPY --from=builder /app/.output ./.output

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port 3000 (nitro node-server default)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => {process.exit(r.statusCode < 500 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Run the standalone nitro Node server
CMD ["node", ".output/server/index.mjs"]
