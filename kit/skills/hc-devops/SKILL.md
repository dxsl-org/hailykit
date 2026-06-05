---
name: hc-devops
description: "Cloud infrastructure provisioning, CI/CD pipeline setup, Docker containerization, Kubernetes cluster management, GitOps, and advanced deployments beyond simple platform hosting."
when_to_use: "Invoke for infrastructure provisioning, CI/CD pipeline setup, Docker/Kubernetes, GitOps, DNS, SSL, or any deployment that goes beyond simple platform hosting. For quick platform deploys (Vercel/Railway/Fly.io), use hc:deploy first."
user-invocable: true
argument-hint: "[platform] [task]"
metadata:
  category: infrastructure
  keywords: [cloudflare, docker, gcp, kubernetes, cicd]
---

# DevOps — Cloud Infrastructure & CI/CD

Deploy and manage cloud infrastructure across Cloudflare, Docker, Google Cloud, and Kubernetes.

**Use for:** Cloudflare Workers/Pages, Docker containerization, GCP (Cloud Run/GKE/Cloud SQL), Kubernetes cluster management, GitOps (Argo CD, Flux), CI/CD pipelines, security audits, RBAC.
**For simple platform deploys,** use `{skill:hc-deploy}` first — escalate here for advanced infra or troubleshooting.

## Usage

```
{skill:hc-devops} [platform] [task]
```

```
{skill:hc-devops} cloudflare "deploy edge worker"
{skill:hc-devops} kubernetes "set up RBAC for staging"
{skill:hc-devops} docker "optimize multi-stage build"
{skill:hc-devops} gcp "configure Cloud Run autoscaling"
```

## Constraints

> **Required — credentials safety:** Store secrets in env vars or secret managers — never hardcode credentials, tokens, or API keys in IaC files or container images.

> **Required — non-root containers:** Always run containers as non-root user. Scan images before deploying to production.

## Platform Selection

| Need | Choose |
|------|--------|
| Sub-50ms latency globally | Cloudflare Workers |
| Large file storage (zero egress) | Cloudflare R2 |
| SQL database (global reads) | Cloudflare D1 |
| Containerized workloads | Docker + Cloud Run/GKE |
| Enterprise Kubernetes | GKE |
| Managed relational DB | Cloud SQL |
| Static site + API | Cloudflare Pages |
| Container orchestration | Kubernetes |
| Package management for K8s | Helm |

## Quick Start

```bash
# Cloudflare Worker
wrangler init my-worker && cd my-worker && wrangler deploy

# Docker
docker build -t myapp . && docker run -p 3000:3000 myapp

# GCP Cloud Run
gcloud run deploy my-service --image gcr.io/project/image --region us-central1

# Kubernetes
kubectl apply -f manifests/ && kubectl get pods
```

## References

### Cloudflare
- `references/cloudflare-platform.md` — edge computing overview
- `references/cloudflare-workers-basics.md` — handler types, patterns
- `references/cloudflare-workers-advanced.md` — performance, optimization
- `references/cloudflare-workers-apis.md` — runtime APIs, bindings
- `references/cloudflare-r2-storage.md` — object storage, S3 compatibility
- `references/cloudflare-d1-kv.md` — D1 SQLite, KV store
- `references/browser-rendering.md` — Puppeteer automation

### Docker
- `references/docker-basics.md` — Dockerfile, images, containers
- `references/docker-compose.md` — multi-container apps

### Google Cloud
- `references/gcloud-platform.md` — gcloud CLI, authentication
- `references/gcloud-services.md` — Compute Engine, GKE, Cloud Run

### Kubernetes
- `references/kubernetes-basics.md` — core concepts, architecture, workloads
- `references/kubernetes-kubectl.md` — essential commands, debugging workflow
- `references/kubernetes-helm.md` / `references/kubernetes-helm-advanced.md` — Helm charts, templates
- `references/kubernetes-security.md` / `references/kubernetes-security-advanced.md` — RBAC, secrets
- `references/kubernetes-workflows.md` / `references/kubernetes-workflows-advanced.md` — GitOps, CI/CD
- `references/kubernetes-troubleshooting.md` / `references/kubernetes-troubleshooting-advanced.md` — debug

## Scripts

```bash
python scripts/cloudflare-deploy.py   # automate Worker deployments
python scripts/docker-optimize.py     # analyze Dockerfiles
```

## Workflow Position

**Follows:** `{skill:hc-deploy}` — escalated from simple platform deploys for advanced infra
**Precedes:** `{skill:hc-ship}` — infrastructure ready before shipping
**Related:** `{skill:hc-deploy}`, `{skill:hc-security}`
