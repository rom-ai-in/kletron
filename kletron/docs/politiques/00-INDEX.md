# Politiques opérationnelles Kletron — index

> **Statut : PROJET v0.1 du 5 nov 2026 (box, Europe/Zurich), rédigé sur demande de Romain.**
> Ces documents sont des **politiques opérationnelles internes** de Numezis Advisory & Engineering (A&E). Ils **ne constituent pas un avis juridique** et **n'ont pas été validés** par un juriste, par ELCA, par EveryWare ni par un client. Les références à la nLPD (loi fédérale sur la protection des données, RS 235.1, en vigueur depuis le 1er sept. 2023) sont indicatives et doivent être vérifiées par un juriste (voir `21-REGISTRE-VALIDATIONS-EXTERNES.md`, V-JUR-2).
> Les décisions D1–D15 restent **ouvertes** sauf D5 et D12 (décidées). Quand une politique s'appuie sur une décision ouverte, elle l'indique par « (aligné sur Dn, proposée) » : la règle s'applique à titre provisoire et sera revue quand Romain tranchera.

## Hiérarchie
`00-STRATEGIE.md` prime → `03-DECISIONS.md` → ces politiques → procédures (`06-STRATEGIE-FORK-AMONT.md`, `SETUP-LOCAL.md`). En cas de contradiction, la règle la plus protectrice pour les données du client s'applique en attendant l'arbitrage de Romain.

## Liste
| # | Document | Objet | Briques K liées |
|---|---|---|---|
| P01 | `P01-SECURITE-PROTECTION-DONNEES.md` | Principes de sécurité, nLPD, rôles, interdiction des données de production sur EveryWare bêta sans accord écrit ELCA | toutes |
| P02 | `P02-SECRETS-ACCES-OIDC.md` | Secrets, comptes, accès, OIDC Entra ID, revue des accès | K4, K5, K6, K11, K17 |
| P03 | `P03-CLASSIFICATION-DONNEES-CONNECTEURS.md` | Classes de données, règles par classe, admission d'un connecteur | K6, K7, K9, K10, K18–K20 |
| P04 | `P04-CHANGEMENTS-SYNC-AMONT.md` | Gestion des changements, sync hebdomadaire Hermès, correctifs sécurité sous 48 h | K2, K3, K12, K15 |
| P05 | `P05-INCIDENTS-ARRET-URGENCE.md` | Réponse aux incidents, violation de données, arrêt d'urgence | K11, K13, K17 |
| P06 | `P06-JOURNALISATION-RETENTION-AUDIT.md` | Journaux, rétention, audit, accès aux journaux | K6, K11, K17 |
| P07 | `P07-SAUVEGARDE-REPRISE.md` | Sauvegardes, RPO/RTO, tests de restauration | K14 |
| P08 | `P08-EXPLOITATION-MONITORING.md` | Exploitation courante, monitoring, capacité, budgets | K5, K14, K17 |
| P09 | `P09-DISTRIBUTION-DESKTOP-SIGNEE.md` | Builds signés, Intune (Windows), Jamf (macOS), mises à jour | K15 |
| P10 | `P10-ACCEPTATION-CLIENT-GO-NO-GO.md` | Recette client, critères go/no-go, mise en production | K14, toutes |
| P11 | `P11-DEPLOIEMENT-PILE-CLIENT-REVERSIBILITE.md` | Une pile par client chez ELCA, déploiement, réversibilité, fin de contrat | K14 |
| M | `20-MATRICE-RESPONSABILITES.md` | Matrice RACI Numezis A&E / client / ELCA / EveryWare | — |
| R | `21-REGISTRE-VALIDATIONS-EXTERNES.md` | Validations externes restantes (GitHub org, certificat, juridique marque, ELCA/EveryWare, Entra ID, tests natifs Windows/macOS…) | — |

## Conventions
- **DOIT / NE DOIT PAS** : règle obligatoire. **DEVRAIT** : règle par défaut ; un écart est permis s'il est écrit et approuvé par le responsable Kletron A&E.
- **Responsable Kletron A&E** : Romain Magnin tant qu'aucune autre personne n'est désignée.
- Les valeurs chiffrées marquées **[à confirmer]** (rétention, RPO/RTO, délais) sont des propositions par défaut. Elles seront fixées dans le contrat ou l'annexe de traitement de chaque client.
- Aucun de ces documents ne contient de secret ; aucun ne doit en contenir (P02 §2).
- Aucune de ces politiques ne crée de routine ni d'automation du bot. Les contrôles périodiques sont **lancés manuellement** (règle README) ; la surveillance technique intégrée à la pile client est traitée en P08 §4 et au registre (V-INT-3).

## Révision
Revue à chaque fin de phase de la roadmap (00 §8), après tout incident de sévérité S1/S2 (P05) et au moins une fois par an. Toute modification est tracée dans le tableau ci-dessous.

| Version | Date | Auteur | Changement |
|---|---|---|---|
| 0.1 | 2026-11-05 | Bot Kletron (box), sur demande de Romain | Création de l'ensemble P01–P11, matrice, registre |
