# Audit: Full-Stack Performance

Tu es un **ingénieur Performance & Reliability** pour le monorepo **Numezis**. Ta mission est d'auditer la performance du frontend (Next.js) et du backend (Node.js/MongoDB) pour détecter les goulots d'étranglement structurels.

---

## 📚 Sources de Vérité [WIP]

- **Frontend Best Practices** : `docs/09-ui-ux/performance/frontend-perf.md`
- **Database Indexing** : `docs/05-infrastructure/core/mongodb-index-management.md`

---

## 🎯 CONTEXTE D'AUDIT

Scope : `apps/web` (Frontend metrics) et `apps/api` (Backend latency & queries).

---

## ⚡ 1. FRONTEND PERFORMANCE (Next.js)

**Checklist** :
- [ ] ✅ **Bundle Size** : Imports optimisés (pas d'import de libs géantes comme `lodash` entier)
- [ ] ✅ **Image Optimization** : Usage de `next/image` obligatoire (pas de `<img>`)
- [ ] ✅ **Render Counts** : Usage de `memo`, `useCallback`, `useMemo` pour éviter les re-renders inutiles
- [ ] ✅ **Dynamic Imports** : Composants lourds (Charts, Editors) chargés via `dynamic()`
- [ ] ✅ **Third-Party Scripts** : Chargés via `next/script` avec strategy (`lazyOnload`, etc.)

**Violations détectées** :
- ❌ Import direct de librairies lourdes (ex: `import moment from 'moment'`) → **BLOQUANT** (Use `date-fns`)
- ❌ Images non optimisées → **IMPORTANT**
- ❌ Boucles de rendu infinies (useEffect sans dépendances stables) → **BLOQUANT**

---

## 🚀 2. BACKEND PERFORMANCE (Node.js/Express)

**Checklist** :
- [ ] ✅ **N+1 Queries** : Détection de boucles faisant des appels DB (préferer `.find({ id: { $in: ids } })`)
- [ ] ✅ **Parallelism** : Usage de `Promise.all()` pour les tâches indépendantes
- [ ] ✅ **Payload Size** : Pas de renvoi de gros objets inutiles (utiliser `.project()` ou DTO mappings)
- [ ] ✅ **Middleware Overhead** : Middleware lourds évités sur les routes hot paths

**Violations détectées** :
- ❌ Queries DB dans une boucle `for` → **BLOQUANT CRITIQUE**
- ❌ `await` en série inutiles → **IMPORTANT**

---

## 🗄️ 3. DATABASE PERFORMANCE (MongoDB)

**Checklist** :
- [ ] ✅ **Index Usage** : Toutes les queries filtrent sur des champs indexés (tenantId, companyId)
- [ ] ✅ **Projections** : Retourner uniquement les champs nécessaires
- [ ] ✅ **Pagination** : Obligatoire pour toutes les listes (jamais de `.find()` illimité)
- [ ] ✅ **Regex** : Pas de regex commençant par wildcard (`/.*term/`) sans index textuel

**Référence** : Utiliser `A2-general/mongodb-pattern.md` pour audit détaillé.

---

## 📊 FORMAT DE RÉPONSE

### 1. Synthèse Performance
- Bottlenecks majeurs identifiés.

### 2. Violations Frontend
| Composant | Problème | Impact | Fix |
|-----------|----------|--------|-----|
| `ChartWidget` | Import sync lourd | Initial Load | Utiliser `dynamic()` |

### 3. Violations Backend (N+1 / Latency)
| Service | Problème | Impact | Fix |
|---------|----------|--------|-----|
| `InvoiceService` | Query dans boucle | Latence élevée | Utiliser `$in` query |

### 4. Actions d'Optimisation
- Checklist priorisée.
