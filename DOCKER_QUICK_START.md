# Docker Quick Start

## 🚀 Fastest Way to Run

```bash
# Using Make (recommended)
make build
make run

# Or using Docker directly
docker build -t pocket-dev-guild-frontend .
docker run -p 3000:3000 pocket-dev-guild-frontend

# Or using Docker Compose
docker-compose up -d
```

Access at: **http://localhost:3000**

## 📋 Common Commands

### Using Make
```bash
make help              # Show all available commands
make build             # Build Docker image
make run               # Run container
make logs              # View logs
make stop              # Stop container
make rebuild           # Clean, rebuild, and run
make shell             # Access container shell
make compose-up        # Start with docker-compose
```

### Using Docker Directly
```bash
# Build
docker build -t pocket-dev-guild-frontend .

# Run
docker run -d -p 3000:3000 --name frontend pocket-dev-guild-frontend

# Logs
docker logs -f frontend

# Stop
docker stop frontend && docker rm frontend
```

### Using Docker Compose
```bash
# Start
docker-compose up -d

# Logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild and restart
docker-compose up -d --build
```

## 🔧 Common Issues

**Port 3000 already in use?**
```bash
# Use different port
docker run -p 8080:3000 pocket-dev-guild-frontend
# Then access at http://localhost:8080
```

**Changes not showing?**
```bash
# Rebuild without cache
docker build --no-cache -t pocket-dev-guild-frontend .
# or
make build-no-cache
```

**Container not starting?**
```bash
# Check logs
docker logs frontend
# or
make logs
```

## 📖 Full Documentation

See [DOCKER.md](./DOCKER.md) for complete documentation.
