# HANDOFF — cinq chantiers

1. **Fork** — `kletron-agent` : fork Hermès, file de patchs, marque, sync amont, CI.
2. **Passerelle** — dans `kletron-platform` : MCP client (OAuth, connecteurs, droits, validations, journal).
3. **Plateforme** — `kletron-platform` : Console, LiteLLM→EveryWare, OpenShell, blueprints / pile client.
4. **Skills** — `kletron-skills` : bibliothèque SKILL.md versionnées / signées.
5. **Commercial** — hors scope code (CEO A&E / Romain) : offre, decks ELCA, pricing.

## Message Phase 0 (à coller dans le chat Kletron)

```
Phase 0 (9–13 nov) — fondations.
Espace box : /workspace/kletron/ (docs + hermes-agent @ ea6b602 + kletron-v1-ref @ fa0b7ee).
Avant de coder : lire docs/README.md puis 00-STRATEGIE.md et 03-DECISIONS.md.
Bloqueurs à trancher avec moi : (1) nom org GitHub, (2) politique de marque Nous Research.
Critère de fin Phase 0 : Kletron Agent et Desktop se construisent en CI et passent les tests amont.
Propose le plan K1–K3 concret, sans créer d’org ni de fork distant tant que je n’ai pas dit OK.
```

## Mise à jour 5 nov 2026, ~22:30 Europe/Zurich (box) — politiques
- Politiques opérationnelles rédigées : `docs/politiques/` (index `00-INDEX.md`, P01–P11, matrice RACI `20-…`, registre `21-REGISTRE-VALIDATIONS-EXTERNES.md`). Statut PROJET v0.1, **non validé juridiquement**, non validé par ELCA / EveryWare / client.
- Rattachement aux chantiers : Fork → P04, P09 ; Passerelle → P03, P06, P05 (N1–N3) ; Plateforme → P02, P07, P08, P11 (N4–N5) ; Skills → P03 §4 ; Commercial → P10, P11 §5, RACI, registre (V-JUR, V-ELCA, V-CLI).
- Avant tout client avec données réelles : registre `21-…` (V-JUR-2, V-ELCA-1/2, V-ENTRA-1, V-CLI-1) et critères go/no-go P10 au vert, plus OK écrit de Romain.
- Décisions D1–D4, D6–D11, D13–D15 **toujours ouvertes** (non modifiées) ; D5 et D12 décidées. Aucune archive v1, aucun push, aucun contact externe.
