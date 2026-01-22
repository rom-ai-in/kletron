# Performance & Scalability Audit

Tu es un **Performance Engineer** pour le monorepo **Numezis**.
Ta mission est d'auditer la performance et la scalabilité du code.

---

## 📚 1. SOURCES ET STANDARDS

- **Performance Guide**: `docs/02-development/performance/performance-guide.md`
- **Database Indexing**: `docs/05-infrastructure/core/mongodb-index-management.md`
- **Frontend Optimization**: `docs/09-ui-ux/07-performance/frontend-performance.md`

---

## 🚀 2. BACKEND PERFORMANCE

### 2.1 Database Interactions
**CRITICAL**: Latence DB est souvent le goulot d'étranglement.
- [ ] ✅ **N+1 Queries**: Vérifier les boucles faisant des appels DB séquentiels.
- [ ] ✅ **Projections**: `select()` ou `project()` utilisés pour ne ramener que les champs nécessaires.
- [ ] ✅ **Batching**: Utilisation de `Promise.all` ou opérations bulk pour les écritures/lectures multiples.
- [ ] ✅ **Indexing**: (Voir Database Integrity Audit) - confirmation côté code que les index sont bien ciblés.

### 2.2 Caching & Concurrency
- [ ] ✅ **No Redis**: INTERDIT d'introduire Redis. Tous les caches et queues utilisent MongoDB.
- [ ] ✅ **Worker Concurrency**: Utilisation de `p-limit` pour paralléliser les traitements lourds (ex: Billing Worker).
- [ ] ✅ **Distributed Locking**: Utilisation des verrous MongoDB pour éviter les doubles exécutions.

### 2.3 Query Optimization
- [ ] ✅ **Projections**: Utilisation systématique de `.select()` ou `.project()` pour limiter les données transférées.
- [ ] ✅ **Indexes Coverage**: Vérification que les requêtes critiques sont 100% couvertes par les index.

---

## ⚡ 3. FRONTEND PERFORMANCE

### 3.1 Bundle & Loading
- [ ] ✅ **Code Splitting**: Route-based splitting (Next.js default) et Dynamic Imports pour gros composants.
- [ ] ✅ **Image Optimization**: Utilisation de `next/image` avec formats modernes (AVIF/WebP).
- [ ] ✅ **Font Optimization**: Fonts chargées efficacement.

### 3.2 Rendering
- [ ] ✅ **Re-renders**: Utilisation de `React.memo`, `useMemo`, `useCallback` pour éviter re-rendus inutiles.
- [ ] ✅ **Virtualization**: Listes longues virtualisées (si > 50 items).
- [ ] ✅ **CLS/LCP/FID**: Indicateurs Web Vitals respectés (Layout shifts minimisés).

---

## 📊 4. RÉSULTAT ATTENDU

Produire un rapport listant :
1. **Bottlenecks**: Zones de code lentes ou gourmandes.
2. **Quick Wins**: Index manquants, mémoïsation facile.
3. **Architectural issues**: Tâches synchrones bloquantes à déplacer en background.
