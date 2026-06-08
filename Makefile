.PHONY: help build run stop logs clean rebuild shell test health

IMAGE_NAME := pocket-dev-guild-frontend
CONTAINER_NAME := pocket-dev-guild-frontend

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build the Docker image
	docker build -t $(IMAGE_NAME) .

build-no-cache: ## Build the Docker image without cache
	docker build --no-cache -t $(IMAGE_NAME) .

run: ## Run the container
	docker run -d \
		-p 3000:3000 \
		--name $(CONTAINER_NAME) \
		$(IMAGE_NAME)

run-dev: ## Run container with development settings
	docker run -d \
		-p 3000:3000 \
		--name $(CONTAINER_NAME) \
		-e NODE_ENV=development \
		$(IMAGE_NAME)

stop: ## Stop the container
	docker stop $(CONTAINER_NAME) || true
	docker rm $(CONTAINER_NAME) || true

logs: ## Show container logs
	docker logs -f $(CONTAINER_NAME)

clean: ## Remove container and image
	docker stop $(CONTAINER_NAME) || true
	docker rm $(CONTAINER_NAME) || true
	docker rmi $(IMAGE_NAME) || true

rebuild: clean build run ## Clean, build, and run

shell: ## Get a shell inside the running container
	docker exec -it $(CONTAINER_NAME) /bin/sh

health: ## Check container health
	@docker inspect --format='{{.State.Health.Status}}' $(CONTAINER_NAME) 2>/dev/null || echo "Container not running"

ps: ## Show running containers
	docker ps -a | grep $(CONTAINER_NAME) || echo "Container not found"

# Docker Compose commands
compose-up: ## Start all services with docker-compose
	docker-compose up -d

compose-down: ## Stop all services with docker-compose
	docker-compose down

compose-logs: ## Show docker-compose logs
	docker-compose logs -f

compose-rebuild: ## Rebuild and restart all services
	docker-compose up -d --build

compose-ps: ## Show docker-compose services status
	docker-compose ps
