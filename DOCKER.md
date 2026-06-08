# Docker Deployment Guide

This guide covers deploying the TanStack Start SSR frontend using Docker.

## Quick Start

### Build and run with Docker

```bash
# Build the image
docker build -t pocket-dev-guild-frontend .

# Run the container
docker run -p 3000:3000 pocket-dev-guild-frontend
```

Access the app at: `http://localhost:3000`

### Build and run with Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f frontend

# Stop services
docker-compose down
```

## Dockerfile Overview

The Dockerfile uses a **multi-stage build** approach:

### Stage 1: Builder

- Based on `node:20-alpine`
- Installs build dependencies (Python, make, g++ for native modules)
- Copies source code
- Runs `npm run build` to create production assets
- Outputs: `dist/client/` (static assets) and `dist/server/` (SSR server)

### Stage 2: Runner

- Based on `node:20-alpine`
- Installs only production dependencies
- Copies built assets from builder stage
- Runs as non-root user for security
- Uses `dumb-init` for proper signal handling
- Exposes port 3000
- Runs `npm run preview` to start the SSR server

## Environment Variables

Set environment variables in `docker-compose.yml` or via `-e` flag:

```bash
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e VITE_USE_MOCK_DATA=false \
  pocket-dev-guild-frontend
```

**Important:** Only `VITE_*` prefixed variables are accessible in the client.
Server-only secrets should NOT use the `VITE_` prefix.

## Production Deployment

### Option 1: Frontend Only

```bash
docker-compose up -d frontend
```

### Option 2: With nginx Reverse Proxy

Uncomment the nginx service in `docker-compose.yml`:

```bash
docker-compose up -d
```

This will:

- Run the frontend SSR server on port 3000 (internal)
- Run nginx on port 80 (external)
- nginx proxies requests to the frontend

### Option 3: Frontend + Backend

If you have a backend service (FastAPI, etc.):

1. Update `docker-compose.yml` to include your backend service
2. Uncomment the backend proxy section in `nginx.conf`
3. Run: `docker-compose up -d`

## Health Checks

The Dockerfile includes a health check that verifies the server is responding:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

Check health status:

```bash
docker ps
# Look for (healthy) or (unhealthy) in STATUS column
```

## Troubleshooting

### Container won't start

Check logs:

```bash
docker logs pocket-dev-guild-frontend
# or
docker-compose logs frontend
```

### Port already in use

Change the port mapping:

```bash
docker run -p 8080:3000 pocket-dev-guild-frontend
# or update docker-compose.yml ports: ["8080:3000"]
```

### Build fails

Clear Docker build cache:

```bash
docker build --no-cache -t pocket-dev-guild-frontend .
```

### File changes not reflected

Rebuild the image:

```bash
docker-compose up -d --build
```

## Performance Optimization

### Reduce image size

The multi-stage build already keeps the image small by:

- Using Alpine Linux (minimal base image)
- Installing only production dependencies in final stage
- Using `.dockerignore` to exclude unnecessary files

### Build cache optimization

Layers are ordered to maximize cache hits:

1. System dependencies (rarely change)
2. Package files (change occasionally)
3. Source code (changes frequently)

## Security Best Practices

✅ **Implemented:**

- Non-root user (nodejs:1001)
- Minimal base image (Alpine)
- Production dependencies only
- Signal handling (dumb-init)
- Health checks

🔒 **Additional recommendations:**

- Use Docker secrets for sensitive data
- Scan images for vulnerabilities: `docker scan pocket-dev-guild-frontend`
- Keep base images updated
- Use specific image tags (not `latest`)

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: docker build -t pocket-dev-guild-frontend .
      - name: Push to registry
        run: |
          echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u "${{ secrets.DOCKER_USERNAME }}" --password-stdin
          docker push pocket-dev-guild-frontend
```

## Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - General deployment guide
- [README.md](./README.md) - Project overview
