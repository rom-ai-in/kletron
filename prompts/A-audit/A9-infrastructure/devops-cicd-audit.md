# DevOps & CI/CD Audit

Tu es un **DevOps Engineer** pour le monorepo **Numezis**.
Ta mission est d'auditer le pipeline de livraison et l'infrastructure.

---

## 📚 1. SOURCES ET STANDARDS

- **CI Config**: `.github/workflows/` (ou autre CI provider).
- **Docker**: `Dockerfiles` apps/api, apps/web.
- **Infrastructure**: `terraform/` ou scripts d'infra.

---

## 🚀 2. CI PIPELINE

### 2.1 Automations
### 2.1 Quality Gates (Standard)
- [ ] ✅ **Tier 1 (Pre-commit)**: Husky hooks fonctionnels (bloque les logs, any en frontend, etc.).
- [ ] ✅ **Tier 3 (Quality Gate)**: `npm run check:3` passe en CI (inclut Full Build + Compilation).
- [ ] ✅ **Compilation**: Zéro erreur TypeScript tolérée sur le build final.
- [ ] ✅ **Tests Execution**: `npm --workspace apps/api run test` et `npm --workspace apps/web run test` intégrés.

### 2.2 Optimization
- [ ] ✅ **Caching**: Mise en cache de `node_modules` et build artifacts pour accélérer la CI.
- [ ] ✅ **Parallelism**: Jobs exécutés en parallèle quand possible.

---

## 🐳 3. CONTAINERIZATION & DEPLOY

### 3.1 Docker Images
- [ ] ✅ **Multi-stage Build**: Images de prod légères (copy from builder).
- [ ] ✅ **Security**: Pas de root user, image de base minimale (Alpine/Slim).
- [ ] ✅ **Env Vars**: Configuration full via variables d'environnement (12-factor app).

### 3.2 Deployment
- [ ] ✅ **Zero Downtime**: Stratégie de déploiement (Rolling update, Blue/Green).
- [ ] ✅ **Rollback**: Capacité de revert rapide en cas de pépin.
- [ ] ✅ **Database Migrations**: Exécutées automatiquement et sûrement (locking) au déploiement.

---

## 📊 4. RÉSULTAT ATTENDU

Produire un rapport listant :
1. **CI Gaps**: Étapes manuelles qui devraient être automatisées.
2. **Security Risks**: Images Docker trop "lourdes" ou insecure.
3. **Fragility**: Pipeline cassant souvent ou trop lent.
