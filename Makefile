CLUSTER ?= basedrive
NS      ?= basedrive

.PHONY: dev services migrate test e2e images k8s-up k8s-secrets k8s-down k8s-logs

## Local dev: Postgres + MinIO in Docker, app on the host.
services:
	docker compose up -d --wait

migrate:
	pnpm db:migrate

dev: services migrate
	pnpm dev

test:
	pnpm typecheck && pnpm lint && pnpm test

e2e:
	pnpm test:e2e

## Kubernetes (k3d). One command: cluster + images + manifests.
images:
	docker build -t basedrive:local --target runner .
	docker build -t basedrive-migrate:local --target migrate .

k8s-up: images
	k3d cluster list $(CLUSTER) >/dev/null 2>&1 || \
	  k3d cluster create $(CLUSTER) -p "8080:80@loadbalancer" --agents 1
	k3d image import basedrive:local basedrive-migrate:local -c $(CLUSTER)
	kubectl apply -k k8s/overlays/local
	$(MAKE) k8s-secrets
	kubectl -n $(NS) rollout status statefulset/postgres --timeout=180s
	kubectl -n $(NS) rollout status deploy/web --timeout=300s
	@echo "→ http://basedrive.localhost:8080"

# Dev-only secrets with random values; real clusters use sealed/external secrets.
k8s-secrets:
	@PW=$$(openssl rand -hex 16); S3=$$(openssl rand -hex 16); \
	kubectl -n $(NS) get secret basedrive-secrets -o jsonpath='{.metadata.annotations.basedrive/generated}' 2>/dev/null | grep -q yes || ( \
	kubectl -n $(NS) create secret generic basedrive-secrets --dry-run=client -o yaml \
	  --from-literal=POSTGRES_PASSWORD=$$PW \
	  --from-literal=DATABASE_URL=postgres://basedrive:$$PW@postgres:5432/basedrive \
	  --from-literal=AUTH_SECRET=$$(openssl rand -base64 32) \
	  --from-literal=S3_ACCESS_KEY_ID=basedrive \
	  --from-literal=S3_SECRET_ACCESS_KEY=$$S3 \
	  --from-literal=CRON_SECRET=$$(openssl rand -hex 16) \
	  --from-literal=RESEND_API_KEY= --from-literal=AUTH_GITHUB_ID= --from-literal=AUTH_GITHUB_SECRET= \
	| kubectl annotate -f - basedrive/generated=yes --local -o yaml | kubectl apply -f - && \
	kubectl -n $(NS) rollout restart statefulset/postgres statefulset/minio deploy/web deploy/worker )

k8s-logs:
	kubectl -n $(NS) logs -l app=web --tail=100 -f

k8s-down:
	k3d cluster delete $(CLUSTER)
