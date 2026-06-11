# 🛡️ Decision Intelligent System

> An enterprise-grade, AI-powered **Fraud Detection Platform** built with a hardened microservices architecture, real-time decision intelligence, and end-to-end security hardening.

---

## 📁 Repository Structure

```
Decision Intelligent System/
├── fraud-detection hardened/          # ✅ Production-ready hardened build
│   ├── .github/                       # GitHub Actions workflows & CODEOWNERS
│   ├── app-backend/                   # Python backend services
│   ├── config/                        # CORS & secrets configuration
│   ├── deploy/                        # Docker Compose & Kubernetes manifests
│   ├── frontend/                      # Next.js dashboard frontend
│   ├── scripts/                       # CI scripts & integration tests
│   ├── security/                      # Secret validation & security tooling
│   ├── sinks/                         # Data sink connectors
│   └── transaction-adapters/          # Transaction ingestion adapters
├── fraud-detection-milestone-*/       # Milestone snapshots (a, b, c)
├── fraud-detection p-*/               # Phase snapshots (0–9)
├── fraud-detection changes/           # Change tracking
├── decision_intelligence_platform_architecture.html  # Architecture diagram
├── fraud_detection_updated_architecture.svg          # Architecture SVG
└── package.json
```

---

## 🏗️ Architecture Highlights

- **Multi-stage fraud detection pipeline** — transaction adapters → AI decision engine → action sinks
- **Next.js frontend** with real-time dashboard (App Router, middleware auth)
- **Python backend** microservices with FastAPI-style service layer
- **Docker Compose** (dev/staging/production overlays) + **Kubernetes** manifests (staging/production)
- **CI/CD** via GitHub Actions — lint, test, compose-validate, load gate, and security scan gates
- **Secrets management** — environment, Docker secrets, and HashiCorp Vault support
- **CORS hardening** per environment (dev / staging / production)
- **MLflow** model governance with AUC ≥ 0.93 production gate

---

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd "Decision Intelligent System"

# 2. Copy and configure environment
cp "fraud-detection hardened/config/secrets/secrets.template" .env
# Edit .env — replace every CHANGE_ME value

# 3. Start development stack
cd "fraud-detection hardened"
make up-all-production
```

---

## 🔐 Security

Before any deployment, validate secrets:

```bash
./security/validate_secrets.sh --env              # check env vars
./security/validate_secrets.sh --docker-secrets   # check Docker secrets
./security/validate_secrets.sh --vault            # check Vault paths
```

---

## 📖 Documentation

- [Deployment Guide](fraud-detection%20hardened/deploy/README.md) — Docker Compose, Kubernetes, rollback procedures
- [Architecture Diagram](decision_intelligence_platform_architecture.html) — Full system overview

---

## 🧪 Testing

```bash
# Offline integration tests
python3 scripts/integration_test.py --suite contracts
python3 scripts/integration_test.py --suite fallback
python3 scripts/integration_test.py --suite health

# Load gate
bash scripts/ci/load_gate.sh
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router), TypeScript |
| Backend | Python, FastAPI |
| Infrastructure | Docker Compose, Kubernetes, Kustomize |
| CI/CD | GitHub Actions |
| ML | MLflow, scikit-learn |
| Secrets | Docker Secrets, HashiCorp Vault |
| Database | PostgreSQL |

---

## 📋 Release Checklist

- [ ] All CI gates pass (lint, test, compose-validate)
- [ ] Security scan clean (no HIGH/CRITICAL findings)
- [ ] Offline integration tests pass
- [ ] Secrets validated for target environment
- [ ] CORS origins confirmed for target environment
- [ ] Load gate passes at target environment thresholds
- [ ] Production model AUC ≥ 0.93 (check MLflow)
- [ ] PostgreSQL backup taken before deploy

---

## 📄 License

Private — All rights reserved.
