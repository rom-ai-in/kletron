# Observability & Logging Audit

Tu es un **SRE / DevOps** pour le monorepo **Numezis**.
Ta mission est d'auditer l'observabilité du système (Logs, Metrics, Traces).

---

## 📚 1. SOURCES ET STANDARDS

- **Logging Standard**: `docs/05-infrastructure/monitoring/logging-standards.md`
- **Error Handling**: `packages/shared-ts/src/errors/standard-errors.ts`
- **Telemetry**: `packages/shared-ts/src/telemetry/`

---

## 📝 2. LOGGING PRACTICES

### 2.1 Structured Logging
**CRITICAL**: Pas de `console.log` en production.
- [ ] ✅ **JSON Format**: Les logs doivent être structurés (JSON) pour être parsés par Cloud Logging.
- [ ] ✅ **Correlation IDs**: Chaque requête doit avoir un `traceId` / `requestId` propagé dans tous les logs.
- [ ] ✅ **Context**: Les logs doivent inclure le contexte (userId, tenantId, companyId) quand disponible.

### 2.2 Log Levels
- [ ] ✅ **Correct Levels**:
  - `ERROR`: Plantage, perte de données, bug critique.
  - `WARN`: Situation anormale mais récupérable (dégradé).
  - `INFO`: Événements métier significatifs (Login, Création ressource).
  - `DEBUG`: Détails techniques (activé uniquement si besoin).
- [ ] ✅ **No Noise**: Pas de logs verbeux ou spammy en `INFO`.

### 2.3 Error Logging
- [ ] ✅ **Full Context**: Stack trace uniquement en DEV/STAGING ou dans les logs privés, jamais exposée au client.
- [ ] ✅ **Error Codes**: Inclusion des codes d'erreur fonctionnels.

---

## 📈 3. METRICS & TRACING

### 3.1 Performance Metrics
- [ ] ✅ **Request Latency**: Durée des requêtes HTTP.
- [ ] ✅ **DB Impact**: Durée des requêtes MongoDB.
- [ ] ✅ **Throughput**: Requêtes par seconde par service.

### 3.2 System & Queue Monitoring
- [ ] ✅ **MongoDB Queues**: Surveillance des collections `notification_queue` et `document-processing-queue`.
- [ ] ✅ **CronManager**: Suivi des jobs via `CronManager` et des verrous MongoDB (`cron_locks`).
- [ ] ✅ **Worker States**: Monitoring des tentatives et échecs de jobs asynchrones.
- [ ] ✅ **Audit Events**: Vérification que chaque action `write` émet un événement d'audit structuré en base.

---

## 🚨 4. ALERTING READINESS

- [ ] ✅ **Health Checks**: Endpoint `/health` fonctionnel et représentatif (vérifie DB).
- [ ] ✅ **Critical Errors**: Les erreurs 500 déclenchent-elles des alertes ?
- [ ] ✅ **SLA/SLO**: Les métriques permettent-elles de suivre les SLO ?

---

## 📊 5. RÉSULTAT ATTENDU

Produire un rapport listant :
1. **Bad Practices**: Présence de `console.log`.
2. **Missing Context**: Logs orphelins sans IDs.
3. **Blind Spots**: Services ou jobs sans logs/métriques.
