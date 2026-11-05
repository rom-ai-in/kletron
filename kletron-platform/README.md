# kletron-platform (démo locale)

Pile TypeScript **locale** pour Kletron : passerelle MCP client, Console, configuration LiteLLM, blueprint `docker-compose`, harness OpenShell (deny-by-default), mocks **bexio** et **Microsoft 365** uniquement.

> Démo C0 uniquement. Aucun secret réel, aucun ERP, aucun déploiement ELCA, aucun push GitHub depuis ce dossier sans OK explicite.

## Pourquoi cette pile

La vraie barrière de sécurité Kletron n’est **pas** le hook `pre_tool_call` d’Hermès (fail-open). C’est :

1. la **passerelle MCP** (droits groupe × connecteur × ressource × action, refus par défaut, validations écriture, idempotence, journal append-only) ;
2. **OpenShell** (réseau refusé par défaut — ici un harness honnête qui documente la posture).

Voir `docs/00-STRATEGIE.md`, P01 §3.5, backlog K5–K9 / K11 / K13 / K14 / K17.

## Contenu

| Chemin | Rôle |
|---|---|
| `src/gateway/` | Passerelle MCP (`POST /mcp/tools/call`) |
| `src/console/` | Console (`GET /v1/config/self`, arrêts employé/client/global) |
| `src/policy/` | Moteur de droits + stops |
| `src/approvals/` | Validations humaines écriture |
| `src/idempotency/` | Cache d’idempotence |
| `src/journal/` | Journal JSONL append-only |
| `src/connectors/` | Mocks bexio + M365 (token gateway obligatoire) |
| `src/litellm/` | Génération de config LiteLLM via variables d’environnement |
| `src/openshell/` | Harness réseau deny-by-default |
| `config/demo-policy.json` | Politique de démo |
| `docker-compose.yml` | Blueprint pile locale |
| `tests/` | Preuves automatisées |

## Prérequis

- Node.js ≥ 20
- npm

## Commandes

```bash
cd /workspace/kletron/kletron-platform
npm install
npm run typecheck
npm test
npm run prove          # typecheck + tests + génération LiteLLM + échantillon journal
npm run litellm:config -- config/litellm.generated.yaml
npm run demo           # Console :7100 + gateway :7101
```

Variables : voir `.env.example`.

### Exemples HTTP

```bash
# Config verrouillée pour l’agent
curl -s 'http://127.0.0.1:7100/v1/config/self?profile=default&employeeId=emp-alice' | jq .

# Lecture bexio contacts (Alice = Kletron-Utilisateurs)
curl -s -X POST http://127.0.0.1:7101/mcp/tools/call \
  -H 'content-type: application/json' \
  -d '{
    "callId":"demo-1",
    "principal":{"employeeId":"emp-alice","displayName":"Alice","groups":["Kletron-Utilisateurs"]},
    "connector":"bexio","resource":"contacts","action":"read","payload":{}
  }' | jq .

# Arrêt global
curl -s -X POST http://127.0.0.1:7100/v1/stops/global \
  -H 'content-type: application/json' \
  -d '{"active":true,"by":"ops"}' | jq .
```

### Docker Compose (blueprint)

```bash
docker compose up console
# optionnel, profil with-litellm (EveryWare factice) :
docker compose --profile with-litellm up
```

## Tests de sécurité couverts

| Scénario | Attendu |
|---|---|
| Instruction piégée | Texte injecté n’élève pas les droits → `default_deny` |
| Outil / connecteur désactivé | `connector_disabled` même si l’agent « le voit » |
| Appel direct | OpenShell `network_denied` et/ou `direct_call_forbidden` |
| Validation écriture | `approval_required` puis exécution après approve |
| Idempotence | cache sur même clé+payload ; `idempotency_conflict` sinon |
| Arrêt global | `global_stop` sur tout appel |

## Limites (honnêtes)

- Pas de vrai serveur MCP wire-protocol 2026-07-28 (API HTTP `tools/call` équivalente pour la démo).
- Pas d’OIDC Entra réel (principals fournis dans la requête).
- Pas de NVIDIA OpenShell réel : harness local qui applique la même posture.
- Pas de LiteLLM/EveryWare live : config générée, endpoint d’exemple invalide.
- Mocks bexio/M365 uniquement (données synthétiques C0).
- Aucun push, secret, ou déploiement client.

## Rapport

`../reports/2026-11-05-platform-local.md`
