# Makefile for Datacrafted Deployment Operations
# Provides convenient commands for building, testing, and deploying

.PHONY: help build run stop logs test clean docker-build docker-run k8s-deploy k8s-delete

# Default target - show help
help:
	@echo "Datacrafted Deployment Commands"
	@echo "================================"
	@echo ""
	@echo "Local Development:"
	@echo "  make dev              - Start development server"
	@echo "  make build            - Build production bundle"
	@echo "  make test             - Run tests"
	@echo "  make lint             - Run linters"
	@echo "  make type-check       - Run TypeScript type checking"
	@echo ""
	@echo "Docker Commands:"
	@echo "  make docker-build     - Build Docker image"
	@echo "  make docker-run       - Run Docker container"
	@echo "  make docker-stop      - Stop Docker container"
	@echo "  make docker-logs      - View Docker logs"
	@echo "  make docker-shell     - Open shell in container"
	@echo "  make docker-clean     - Remove Docker images and containers"
	@echo ""
	@echo "Docker Compose:"
	@echo "  make up               - Start all services with docker-compose"
	@echo "  make down             - Stop all services"
	@echo "  make restart          - Restart all services"
	@echo "  make ps               - Show running containers"
	@echo ""
	@echo "Kubernetes Commands:"
	@echo "  make k8s-deploy       - Deploy to Kubernetes"
	@echo "  make k8s-delete       - Delete from Kubernetes"
	@echo "  make k8s-status       - Show deployment status"
	@echo "  make k8s-logs         - View pod logs"
	@echo "  make k8s-shell        - Open shell in pod"
	@echo ""
	@echo "Database Commands:"
	@echo "  make db-migrate       - Run database migrations"
	@echo "  make db-generate      - Generate Prisma client"
	@echo "  make db-push          - Push schema changes to database"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean            - Clean build artifacts"
	@echo "  make health-check     - Check application health"

# =============================================================================
# Local Development
# =============================================================================

dev:
	npm run dev

build:
	npm run build

test:
	npm run test

lint:
	npm run lint

type-check:
	npm run type-check

# =============================================================================
# Docker Commands
# =============================================================================

IMAGE_NAME ?= datacrafted
IMAGE_TAG ?= latest
CONTAINER_NAME ?= datacrafted

docker-build:
	@echo "Building Docker image..."
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .

docker-run:
	@echo "Running Docker container..."
	docker run -d \
		--name $(CONTAINER_NAME) \
		-p 3000:3000 \
		--env-file .env.local \
		$(IMAGE_NAME):$(IMAGE_TAG)
	@echo "Container started. Access at http://localhost:3000"

docker-stop:
	@echo "Stopping Docker container..."
	docker stop $(CONTAINER_NAME) || true
	docker rm $(CONTAINER_NAME) || true

docker-logs:
	docker logs -f $(CONTAINER_NAME)

docker-shell:
	docker exec -it $(CONTAINER_NAME) sh

docker-health:
	@echo "Checking container health..."
	@docker exec $(CONTAINER_NAME) node -e \
		"require('http').get('http://localhost:3000/api/health', (r) => { \
			console.log('Status:', r.statusCode); \
			process.exit(r.statusCode === 200 ? 0 : 1); \
		})" && echo "Health check PASSED" || echo "Health check FAILED"

docker-clean:
	@echo "Cleaning Docker resources..."
	docker stop $(CONTAINER_NAME) || true
	docker rm $(CONTAINER_NAME) || true
	docker rmi $(IMAGE_NAME):$(IMAGE_TAG) || true

# =============================================================================
# Docker Compose
# =============================================================================

up:
	@echo "Starting services with docker-compose..."
	docker-compose up -d

down:
	@echo "Stopping services..."
	docker-compose down

restart:
	@echo "Restarting services..."
	docker-compose restart

ps:
	docker-compose ps

logs:
	docker-compose logs -f

# =============================================================================
# Kubernetes Commands
# =============================================================================

NAMESPACE ?= default

k8s-deploy:
	@echo "Deploying to Kubernetes..."
	kubectl apply -f kubernetes/deployment.yaml -n $(NAMESPACE)
	kubectl apply -f kubernetes/ingress.yaml -n $(NAMESPACE)
	@echo "Waiting for rollout to complete..."
	kubectl rollout status deployment/datacrafted -n $(NAMESPACE)

k8s-delete:
	@echo "Deleting from Kubernetes..."
	kubectl delete -f kubernetes/deployment.yaml -n $(NAMESPACE) || true
	kubectl delete -f kubernetes/ingress.yaml -n $(NAMESPACE) || true

k8s-status:
	@echo "Deployment status:"
	kubectl get deployments,pods,services,ingress -n $(NAMESPACE) -l app=datacrafted

k8s-logs:
	kubectl logs -f -l app=datacrafted -n $(NAMESPACE) --tail=100

k8s-shell:
	kubectl exec -it deployment/datacrafted -n $(NAMESPACE) -- sh

k8s-restart:
	kubectl rollout restart deployment/datacrafted -n $(NAMESPACE)

k8s-rollback:
	kubectl rollout undo deployment/datacrafted -n $(NAMESPACE)

k8s-scale:
	@read -p "Enter number of replicas: " replicas; \
	kubectl scale deployment/datacrafted --replicas=$$replicas -n $(NAMESPACE)

# =============================================================================
# Database Commands
# =============================================================================

db-generate:
	npx prisma generate

db-migrate:
	npx prisma migrate deploy

db-push:
	npx prisma db push

db-studio:
	npx prisma studio

# =============================================================================
# Utilities
# =============================================================================

clean:
	@echo "Cleaning build artifacts..."
	rm -rf .next
	rm -rf out
	rm -rf dist
	rm -rf node_modules/.cache
	@echo "Clean complete"

health-check:
	@echo "Checking application health..."
	@curl -f http://localhost:3000/api/health && \
		echo "\nHealth check PASSED" || \
		echo "\nHealth check FAILED"

# Production deployment with zero-downtime
deploy-production: docker-build
	@echo "Deploying to production..."
	@echo "Step 1: Building new image with tag $(IMAGE_TAG)"
	@echo "Step 2: Running database migrations"
	@make db-migrate
	@echo "Step 3: Deploying to Kubernetes with rolling update"
	@make k8s-deploy
	@echo "Production deployment complete!"

# CI/CD simulation
ci: lint type-check test build
	@echo "CI pipeline completed successfully!"
