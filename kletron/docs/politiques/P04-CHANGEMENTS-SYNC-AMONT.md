# P04 — Gestion des changements, synchronisation Hermès et correctifs sécurité

> ⚖️ Document opérationnel interne : **pas un avis juridique**, non validé par un juriste, ELCA, EveryWare ni un client.

> PROJET v0.1 — 5 nov 2026. Procédure détaillée : `06-STRATEGIE-FORK-AMONT.md` §5–§7. Les règles de cadence s'alignent sur D7, D9, D10 (proposées, non tranchées) ; D5 et D12 sont décidées.

## 1. Types de changement
| Type | Exemples | Approbation | Fenêtre |
|---|---|---|---|
| **Standard** | sync hebdomadaire sur tag stable, mise à jour de règles de rebrand, nouvelle skill relue | responsable Kletron A&E (Romain) ; information du client | fenêtre de maintenance convenue avec le client |
| **Normal** | nouveau connecteur, changement de droits, nouvelle version de la passerelle ou de la Console, nouveau patch cœur | revue écrite + OK de Romain ; **OK du client** si l'impact touche ses utilisateurs ou ses données | planifié, annoncé ≥ 5 jours ouvrables avant [à confirmer] |
| **Urgent (sécurité)** | correctif de sécurité amont ou Kletron, révocation de secret | Romain (ou suppléant désigné) ; client informé avant ou dès que possible | **≤ 48 h** (§4) |
| **Interdit sans décision écrite** | nouveau patch au-delà de 5, modification de `LICENSE`, activation de télémétrie, changement de fournisseur de modèles | Romain + client | — |

Tout changement : ticket ou entrée de rapport, description, risque, plan de retour arrière, preuve de test, date d'application. **Aucun déploiement client sans OK explicite de Romain.**

## 2. Règles permanentes du fork (rappel)
- **On ne demande rien à Nous Research** (D12, décidée) : pas de PR, pas d'issue, pas de demande de fonctionnalité.
- **Rebrand au build** (D5, décidée) : les chaînes affichées sont réécrites dans une copie jetable ; une chaîne amont non revue fait échouer le build.
- Plafond : **5 patchs cœur au maximum** ; budget proposé ≤ 40 fichiers amont, ≤ 400 lignes de contact, 0 test amont modifié (D3, proposée). État au 5 nov : 2 patchs, 11 fichiers, 73 lignes, 0 test.
- Interdits D4 (proposée) : pas de renommage d'identifiants internes (`hermes_cli`, `HERMES_HOME`, `~/.hermes`, commande `hermes`), pas de reformatage, pas de monkey-patch.

## 3. Synchronisation hebdomadaire (mode normal)
- **Fréquence** : une fois par semaine au plus, **déclenchée manuellement** par Romain ou à sa demande en session ; jamais par une routine du bot.
- **Cible** : dernier tag stable `vX.Y.Z` publié depuis au moins 48 h (décantation), jamais `canary` ni `rc` (aligné sur D7, proposée). Retour sur un tag dès v0.22.8 (base actuelle `ea6b602` = `main` non taggé).
- **Étapes** (docs/06 §6) : `check-upstream.sh` (à créer) → `sync-upstream.sh <tag>` (exit 2 sur conflit, rien ne bouge) → résolution des conflits en gardant l'intention du patch → `build.sh` (rebrand) → T1–T8.
- **Go/no-go technique** : gouvernance ALL PASS ; 0 échec nouveau vs baseline amont ; smoke Desktop et CLI sans « Hermes » visible ; aucun trafic hors liste blanche ; **OK écrit de Romain pour toute release client** (aligné sur D9, proposée).
- **Rapport** : une page en français `reports/sync-AAAA-MM-JJ.md` (base avant/après, conflits, temps passé, T1–T8, indicateurs §10 de docs/06).
- **Seuil d'escalade** : > 3 h sur un patch, ou > 6 h/semaine en moyenne sur 4 semaines (D15, proposée).

## 4. Correctifs de sécurité sous 48 h
**Déclencheurs** : GHSA/CVE sur hermes-agent ou une dépendance ; release amont mentionnant « Security » ; commit `fix(security|approval|mcp|auth|sandbox)` ou lot `deps` sécurité sur `main` ; alerte Dependabot/OSV ; vulnérabilité dans un composant Kletron (passerelle, Console, connecteurs) ou dans l'OS/les images de la pile.

**Horloge** : 48 h à partir de la **publication** du correctif (ou de la connaissance de la vulnérabilité pour nos composants). Une détection tardive est consignée.

| Situation | Action | Délai |
|---|---|---|
| Correctif dans un tag amont | sync anticipée vers ce tag, sans décantation | ≤ 48 h |
| Correctif seulement sur `main`, isolé | backport `9xxx-backport-<sha12>.patch` (Expires ≤ 14 j) | ≤ 48 h |
| Correctif sur `main`, non isolé | saut de base vers le SHA de `main` (comme le 5 nov) ; retour sur tag à la sync suivante | ≤ 48 h |
| Pas de correctif disponible | **mitigation** : config verrouillée, policy OpenShell, blocage dans la passerelle MCP, désactivation du connecteur ou de l'outil concerné | mitigation ≤ 48 h |
| Composant Kletron | correctif + release | ≤ 48 h |

Livraison aux clients : nouvelle version `X.Y.Z-k.N+1` (D6, proposée) par le canal signé (P09) et mise à jour des piles serveur. Si la faille est exploitable à distance et touche des données C2+, la mitigation est appliquée **avant** la release si celle-ci ne peut pas tenir les 48 h.

**Surveillance sans routine du bot** (aligné sur D8, proposée) : (1) notifications GitHub *Watch → Releases + Security alerts* sur le compte de Romain [action de Romain, V-INT-1] ; (2) script manuel `check-upstream.sh` lancé à la demande ; (3) une Action GitHub planifiée reste **à trancher** par Romain.

## 5. Retour arrière
- Avant release : rien ne change (scripts transactionnels).
- Après release : **republier la version précédente sous un numéro supérieur** (D10, proposée) ; artefacts signés conservés ≥ 90 jours.
- Avant toute release : vérifier l'absence de migration irréversible (`state.db`, config) ; sinon test d'upgrade **et** de retour.

## 6. Changements côté plateforme et infrastructure
Passerelle MCP, Console, LiteLLM, OpenShell, OS de la VM : même classification §1. Les correctifs OS sont appliqués mensuellement dans la fenêtre convenue, et sous 48 h pour une vulnérabilité critique exploitable. Chaque pile est mise à jour **client par client** (pas de mise à jour simultanée de toutes les piles) : une pile pilote d'abord, puis les autres.
