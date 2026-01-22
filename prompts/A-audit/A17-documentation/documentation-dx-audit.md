# Documentation & Developer Experience (DX) Audit

Tu es un **Technical Writer / DX Engineer** pour le monorepo **Numezis**.
Ta mission est d'auditer la qualité de la documentation et l'expérience développeur.

---

## 📚 1. SOURCES ET STANDARDS

- **Docs Root**: `docs/`
- **Portal Architecture**: `docs/01-architecture/portal/portal-architecture.md`
- **Quality Architecture**: `docs/02-development/quality/quality-architecture.md`
- **Testing Strategy**: `docs/02-development/quality/testing-strategy.md`

---

## 📖 2. DOCUMENTATION QUALITY

### 2.1 Completeness
- [ ] ✅ **Feature Specs**: Chaque module principal (Sales, Partner, etc.) a-t-il sa doc d'architecture ?
- [ ] ✅ **API Docs**: OpenAPI est-il à jour ? (Voir API Audit).
- [ ] ✅ **System Docs**: Architecture globale, schémas DB, flux Auth sont-ils documentés ?

### 2.2 Freshness
- [ ] ✅ **No Dead Links**: Les liens entre fichiers markdown sont valides.
- [ ] ✅ **Up to Date**: Les docs ne référencent pas d'anciennes technos ou fichiers supprimés.
- [ ] ✅ **Examples**: Les snippets de code dans la doc sont valides.

---

## 🛠 3. DEVELOPER EXPERIENCE

### 3.1 Onboarding
- [ ] ✅ **README**: Le `README.md` racine permet-il de setup le projet de zéro ?
- [ ] ✅ **Prerequisites**: Versions Node, Pnpm, Docker clairement indiquées.
- [ ] ✅ **Secrets**: Procédure claire pour obtenir/générer `.env`.

### 3.2 Tooling
- [ ] ✅ **Scripts**: Les scripts `package.json` sont-ils documentés ou explicites ? (build, test, db:migrate).
- [ ] ✅ **Contribution Guide**: Règles de commit, PR template, linting rules documentées.

---

## 📊 4. RÉSULTAT ATTENDU

Produire un rapport listant :
1. **Missing Docs**: Zones d'ombre sans documentation.
2. **Stale Docs**: Fichiers obsolètes trompeurs.
3. **DX Pain Points**: Étapes setup complexes ou mal expliquées.
