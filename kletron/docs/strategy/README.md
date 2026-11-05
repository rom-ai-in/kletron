# Kletron — espace de travail (box)
**Ordre de lecture :** 00-STRATEGIE.md (prime sur tout) → 03-DECISIONS.md → 02-BACKLOG.md → HANDOFF.md → 05-REFERENCE-HERMES.md → STATUS-BOX.md → `politiques/00-INDEX.md` (politiques opérationnelles P01–P11, matrice RACI, registre des validations externes).

## Vocabulaire
- **Numezis** = l'ERP (avec son propre MCP, numezis.com/en/platform/mcp). **Kletron n'est PAS l'ERP.**
- **Numezis Advisory & Engineering** = vend, installe et accompagne Kletron.
- **Kletron** = le produit (fork mince d'Hermès Agent + passerelle MCP client + passerelle modèles + console + skills + OpenShell).

## Règles
- Aucun dépôt GitHub, fork distant, tag, push ni secret sans accord explicite de Romain.
- Aucune automation : tout est lancé manuellement par Romain.
- Fork mince : extensions prévues par Hermès d'abord, 5 patchs de code maximum (`patches/`).
- Le code ERP est copié une fois dans la passerelle, puis aucune dépendance.

## Chemins box
- `/workspace/kletron/docs/` (ces docs ; `docs/politiques/` = politiques opérationnelles, PROJET v0.1, non validées juridiquement) · `hermes-agent/` (clone amont shallow) · `kletron-v1-ref/` (archive v1 TS) · `kletron-agent/` (dépôt de travail : file de patchs dans `kletron-agent/kletron/patches/`, voir STATUS-BOX) · `reports/` (preuves)

## Politiques opérationnelles (5 nov 2026, PROJET v0.1)
`politiques/` contient : P01 sécurité et protection des données (nLPD ; **interdiction des données de production sur EveryWare bêta sans accord écrit d'ELCA**), P02 secrets / accès / OIDC Entra ID, P03 classification et connecteurs, P04 changements, sync hebdomadaire Hermès et correctifs sécurité ≤ 48 h, P05 incidents et arrêt d'urgence, P06 journalisation / rétention / audit, P07 sauvegarde / reprise, P08 exploitation / monitoring, P09 Desktop signé Intune/Jamf, P10 acceptation client et go/no-go, P11 pile par client chez ELCA et réversibilité, `20-MATRICE-RESPONSABILITES.md`, `21-REGISTRE-VALIDATIONS-EXTERNES.md`.
Ce ne sont **pas** des avis juridiques ; les valeurs [à confirmer] et les décisions D ouvertes restent à trancher par Romain.
