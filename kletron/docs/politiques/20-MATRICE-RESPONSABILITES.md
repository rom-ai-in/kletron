# 20 — Matrice de responsabilités (RACI)

> ⚖️ Document opérationnel interne : **pas un avis juridique**, non validé par un juriste, ELCA, EveryWare ni un client.

> PROJET v0.1 — 5 nov 2026. **R** = réalise · **A** = approuve / rend compte (un seul A par ligne) · **C** = consulté · **I** = informé · — = sans rôle. À confirmer avec chaque client, ELCA et EveryWare (aucun d'eux n'a validé cette matrice, V-ELCA-4). Rôles nLPD présumés : client = responsable du traitement ; A&E = sous-traitant ; ELCA et EveryWare = sous-traitants ultérieurs (P01 §2).

| # | Activité | Numezis A&E | Client | ELCA (hébergement) | EveryWare (modèles) |
|---|---|---|---|---|---|
| **Produit** | | | | | |
| 1 | Fork Kletron Agent, rebrand au build, sync Hermès hebdomadaire | **A/R** | I | — | — |
| 2 | Correctifs sécurité ≤ 48 h (agent, passerelle, Console) | **A/R** | I | C (si OS/infra) | C (si modèles) |
| 3 | Développement passerelle MCP, Console, connecteurs, skills | **A/R** | C (besoins) | — | — |
| 4 | Signature et publication des builds Desktop | **A/R** | I | — | — |
| **Données et conformité** | | | | | |
| 5 | Finalités, périmètre, classification des données | C | **A/R** | — | — |
| 6 | Registre des traitements, AIPD, information des employés | C (description technique) | **A/R** | — | — |
| 7 | DPA client ↔ A&E | R | **A** | — | — |
| 8 | Contrat A&E ↔ ELCA (hébergement et EveryWare) ; liste des sous-traitants | **A/R** | C (accepte) | R | R |
| 9 | Accord écrit d'usage de données de production sur EveryWare bêta | R (demande) | C (accepte) | **A** | C |
| 10 | Annonce d'une violation au PFPDT / aux personnes | C (informe sans délai) | **A/R** | C | C |
| 11 | Demandes de droits des personnes | R (exécute) | **A** | — | C (si données modèles) |
| **Identité et accès** | | | | | |
| 12 | Tenant Entra ID, enregistrements d'application, groupes, MFA, accès conditionnel | C (guide) | **A/R** | — | — |
| 13 | Attribution des droits groupe × connecteur × ressource × action | R (configure) | **A** | — | — |
| 14 | Accès admin VM, invités B2B A&E, revue trimestrielle des accès | **A/R** | C | R (bastion/VPN) | — |
| 15 | Autorisation OAuth des connecteurs (bexio, M365…) | C | **A/R** | — | — |
| **Infrastructure et exploitation** | | | | | |
| 16 | Fourniture de la VM, réseau, stockage, sauvegarde d'infrastructure en Suisse | C | I | **A/R** | — |
| 17 | Déploiement et configuration de la pile (blueprint) | **A/R** | I | C | — |
| 18 | Correctifs OS et images de la pile | **A/R** | I | C | — |
| 19 | Supervision applicative, check-lists, rapport mensuel | **A/R** | I | — | — |
| 20 | Disponibilité de l'infrastructure | I | I | **A/R** | — |
| 21 | Disponibilité, qualité et localisation de l'inférence | I | I | C | **A/R** |
| 22 | Budgets de modèles par employé et global | R (configure) | **A** | — | C (tarifs) |
| 23 | Sauvegardes applicatives et tests de restauration | **A/R** | I | R (stockage) | — |
| **Postes de travail** | | | | | |
| 24 | Déploiement Desktop via Intune/Jamf, conformité des postes | C (paquets, guide) | **A/R** | — | — |
| 25 | Sécurité des postes (chiffrement disque, effacement à distance) | I | **A/R** | — | — |
| **Incidents et changements** | | | | | |
| 26 | Qualification et coordination d'incident Kletron | **A/R** | C | C | C |
| 27 | Décision d'arrêt d'urgence N1–N5 | R (exécute) | **A** (ou A&E en cas d'urgence avérée, information immédiate) | C | C |
| 28 | Incident d'infrastructure ELCA | I→C | I | **A/R** (informe A&E sans délai) | — |
| 29 | Incident modèles EveryWare (fuite, indisponibilité) | C | I | C | **A/R** (informe sans délai) |
| 30 | Changements normaux touchant les utilisateurs | R | **A** | I | I |
| **Recette, réversibilité** | | | | | |
| 31 | Go/no-go et PV d'acceptation | R | **A** | I | I |
| 32 | Restitution des données en fin de contrat | **A/R** | C (réceptionne) | C | — |
| 33 | Suppression des données et attestation | **A/R** | I | R (VM, sauvegardes infra) | R (si rétention de prompts) |

Remarques
- Ligne 27 : le client garde l'autorité finale ; A&E peut déclencher un arrêt conservateur en urgence avérée (P05 §4) et en informe immédiatement le client.
- Lignes 21 et 29 : les engagements effectifs d'EveryWare (localisation, rétention, non-réutilisation, notification) sont inconnus à ce jour (V-ELCA-2).
- Chez A&E, « A » = responsable Kletron A&E (Romain) tant qu'aucune autre personne n'est désignée (risque R14 de dépendance à une seule personne, docs/06 §9).
