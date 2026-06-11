# Deployment Guide

## Environments

| Environment | Compose overlay | K8s overlay | Purpose |
|---|---|---|---|
| Development | `docker-compose.yml` (base only) | — | Local development |
| Staging | `+ docker-compose.staging.yml` | `overlays/staging` | Pre-prod validation |
| Production | `+ docker-compose.production.yml` | `overlays/production` | Live traffic |

---

## Prerequisites

```bash
# Validate secrets before any deployment
./security/validate_secrets.sh --env              # check env vars
./security/validate_secrets.sh --docker-secrets   # check Docker secrets
./security/validate_secrets.sh --vault            # check Vault paths

# Generate secrets from template (first time)
cp config/secrets/secrets.template .env
# Edit .env — replace every CHANGE_ME value
# Then create Docker secrets:
make create-secrets
```

---

## Docker Compose Deployment

### Development
```bash
cp .env.example .env
# Edit .env — fill in development values
make up-all-production
make integration-test-offline
```

### Staging
```bash
# Load staging CORS config
source config/cors/staging.env

# Validate secrets
ENVIRONMENT=staging ./security/validate_secrets.sh --docker-secrets

# Deploy with staging overlay
docker compose \
  -f docker-compose.yml \
  -f deploy/compose/docker-compose.staging.yml \
  up -d

# Run integration tests
python3 scripts/integration_test.py --suite contracts
python3 scripts/integration_test.py --suite fallback

# Run load gate against staging
ENVIRONMENT=staging GATEWAY_URL=https://api.staging.example.com \
  bash scripts/ci/load_gate.sh
```

### Production
```bash
# 1. Validate all gates pass in CI first
# 2. Load production CORS
source config/cors/production.env

# 3. Validate secrets
ENVIRONMENT=production ./security/validate_secrets.sh --vault

# 4. Deploy
docker compose \
  -f docker-compose.yml \
  -f deploy/compose/docker-compose.production.yml \
  up -d --no-build   # use pre-built images from registry

# 5. Verify health
make production-health

# 6. Run smoke test
python3 scripts/integration_test.py --suite contracts
python3 scripts/integration_test.py --suite health
```

---

## Kubernetes Deployment (Future)

### Staging
```bash
# Build and push images
docker buildx build -t registry.example.com/fraud-api-gateway:staging ./api-gateway
docker push registry.example.com/fraud-api-gateway:staging
# ... repeat for all services

# Deploy with kustomize
kubectl apply -k deploy/k8s/overlays/staging

# Verify rollout
kubectl rollout status deployment/api-gateway -n fraud-detection-staging
kubectl rollout status deployment/stage1-service -n fraud-detection-staging

# Run smoke tests against staging ingress
GATEWAY_URL=https://api.staging.example.com \
  python3 scripts/integration_test.py --suite gateway
```

### Production
```bash
# Update image tags in overlays/production/kustomization.yaml to release SHA
# Then:
kubectl apply -k deploy/k8s/overlays/production

# Monitor rollout
kubectl rollout status deployment/api-gateway -n fraud-detection
kubectl get hpa -n fraud-detection   # check autoscaler

# Verify with load gate
ENVIRONMENT=production GATEWAY_URL=https://api.example.com \
  bash scripts/ci/load_gate.sh
```

---

## Rollback

### Docker Compose
```bash
# Roll back to previous image tag
docker compose pull
docker compose up -d

# Or restart specific service
docker restart fraud_api_gateway
```

### Model Rollback
```bash
# Via app-backend governance API (ADMIN role required)
make app-rollback
```

### Kubernetes
```bash
# Roll back last deployment
kubectl rollout undo deployment/api-gateway -n fraud-detection

# Roll back to specific revision
kubectl rollout undo deployment/api-gateway --to-revision=3 -n fraud-detection
```

---

## Release Checklist

- [ ] All CI gates pass (lint, test, compose-validate)
- [ ] Security scan clean (no HIGH/CRITICAL findings)
- [ ] Offline integration tests pass
- [ ] Secrets validated for target environment
- [ ] CORS origins confirmed for target environment
- [ ] Load gate passes at target environment thresholds
- [ ] Production model AUC ≥ 0.93 (check MLflow)
- [ ] PostgreSQL backup taken before deploy
- [ ] Runbook reviewed: `docs/runbooks/incident_response.md`
