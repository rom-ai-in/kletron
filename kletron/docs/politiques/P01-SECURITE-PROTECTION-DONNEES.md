# P01 — Sécurité et protection des données

> PROJET v0.1 — 5 nov 2026. Politique opérationnelle interne, **pas un avis juridique**. Références nLPD à vérifier par un juriste (registre V-JUR-2).

## 1. Objet et périmètre
S'applique à toute pile Kletron (agent et Desktop, passerelle MCP client, passerelle modèles LiteLLM, Console, bibliothèque de skills, OpenShell), à son déploiement chez ELCA, à son exploitation par Numezis A&E et aux environnements de développement (box, CI).

## 2. Rôles au sens de la nLPD (proposition à confirmer par contrat)
| Acteur | Rôle présumé | Conséquence opérationnelle |
|---|---|---|
| Client | **Responsable du traitement** : décide des finalités (quels employés, quels connecteurs, quelles données) | Valide la classification (P03), les droits par groupe et les durées de rétention (P06) ; informe ses employés |
| Numezis A&E | **Sous-traitant** (art. 9 nLPD) : installe, configure et exploite la pile pour le client | N'agit que sur instruction documentée du client ; contrat de sous-traitance (DPA) obligatoire avant toute donnée réelle |
| ELCA (hébergement VM) | **Sous-traitant ultérieur** de Numezis A&E, ou sous-traitant direct du client selon le montage contractuel [à confirmer] | Autorisation préalable du client exigée (art. 9 al. 3 nLPD) ; lieu d'hébergement documenté |
| EveryWare (modèles, ELCA) | **Sous-traitant ultérieur** pour l'inférence | Les prompts et réponses peuvent contenir des données personnelles : conditions d'utilisation, localisation, rétention et non-réutilisation pour l'entraînement à obtenir **par écrit** (V-ELCA-2) |
| Nous Research (amont Hermès) | **Aucun rôle** : aucune donnée ne lui est transmise | Garanti par le patch 0002 (blocage réseau, télémétrie forcée off) et le contrôle G1/G4 (P04) |

## 3. Principes (DOIT)
1. **Pas de donnée de production avant le go** : aucune donnée réelle d'un client ne transite par une pile qui n'a pas passé P10 (acceptation) et dont le DPA n'est pas signé.
2. **Minimisation** : les connecteurs sont en lecture seule par défaut (K7) ; l'écriture n'est ouverte que par groupe, ressource et action explicitement autorisés (K9), avec validation par un tiers (K8) pour les actions de classe C3/C4 (P03).
3. **Protection par défaut et dès la conception** (art. 7 nLPD) : télémétrie désactivée et verrouillée, mises à jour automatiques désactivées sauf feed Kletron explicite (`KLETRON_UPDATE_URL`), installation distante désactivée sauf source Kletron (`KLETRON_INSTALL_SOURCE`), mode sans validation (YOLO) bloqué (patch 0004 ou config verrouillée).
4. **Une pile par client** : aucune base, clé, journal ou modèle partagé entre deux clients (00 §3, P11).
5. **Défense en profondeur** : les approvals et hooks Hermès sont des heuristiques (SECURITY.md amont ; le hook `pre_tool_call` laisse passer l'outil si le contrôle plante). **La barrière de sécurité réelle est la passerelle MCP client (droits, validations, journal) plus l'isolation OpenShell.** Aucune promesse client ne repose sur les seules approvals de l'agent.
6. **Localisation** : données, journaux et sauvegardes en Suisse chez ELCA, sauf accord écrit du client. Toute communication de données à l'étranger suit l'art. 16 nLPD [à vérifier par juriste].
7. **Pas de réutilisation** : les données d'un client ne servent ni à l'entraînement, ni à l'évaluation, ni à la démonstration pour un autre client.

## 4. Règle EveryWare bêta (DOIT)
Tant que le service de modèles EveryWare est en **bêta** ou en préversion :
- **Interdiction de faire transiter des données de production** (données réelles de clients, d'employés, de tiers, ou toute donnée de classe C2 et au-dessus, P03) par EveryWare **sans accord écrit préalable d'ELCA** précisant au minimum : lieu de traitement, rétention des prompts et réponses, non-réutilisation, sous-traitants, engagement de disponibilité, procédure de notification d'incident.
- Sans cet accord, seules sont admises les **données synthétiques ou de démonstration** (classe C0, P03), y compris pour la démo ELCA de la Phase 1 (lecture bexio sur un **compte bexio de démonstration**).
- L'accord ELCA est archivé dans le dossier client et référencé dans le registre `21-REGISTRE-VALIDATIONS-EXTERNES.md` (V-ELCA-1). L'accord du **client** reste aussi nécessaire (sous-traitance ultérieure).
- Contrôle technique : la Console (K11) DEVRAIT porter un indicateur `models.provider_stage = beta` qui bloque l'activation des connecteurs de production tant que l'accord n'est pas enregistré. Tant que K11 n'existe pas, le contrôle est manuel et fait partie de la check-list go/no-go (P10, critère G-DON-3).

## 5. Obligations nLPD à préparer pour chaque client (liste de travail, non exhaustive)
| Sujet | Livrable | Porteur | Réf. indicative |
|---|---|---|---|
| Registre des activités de traitement | fiche « Kletron » dans le registre du client ; registre de sous-traitant chez A&E | client / A&E | art. 12 |
| Analyse d'impact (AIPD) | à évaluer par le client, notamment si profilage ou données sensibles | client (A&E fournit la description technique) | art. 22–23 |
| Information des employés | texte d'information sur l'usage de l'agent, les journaux et la surveillance | client | art. 19 ; droit du travail (surveillance des employés) à vérifier |
| Sous-traitance | DPA client ↔ A&E ; contrat A&E ↔ ELCA ; liste des sous-traitants ultérieurs | A&E | art. 9 |
| Annonce de violation | procédure P05 §5 | client (A&E informe sans délai) | art. 24 |
| Droits des personnes | procédure d'extraction / suppression dans les journaux et sessions (P06 §6) | A&E sur demande du client | art. 25 ss |
| Sécurité | ce document + P02–P08 | A&E | art. 8 ; OPDo |

## 6. Mesures techniques minimales par pile
- Chiffrement en transit TLS 1.2+ partout, y compris entre composants de la pile ; certificats gérés par A&E.
- Chiffrement au repos des volumes et sauvegardes (mécanisme ELCA à confirmer, V-ELCA-3).
- Accès utilisateur uniquement via OIDC Entra ID du client (P02) ; aucun compte local partagé.
- OpenShell : chaque agent est isolé, système de fichiers et réseau sortant restreints à une liste blanche (passerelle MCP, passerelle modèles, Console).
- Sortie réseau de la VM limitée à : EveryWare, API des connecteurs autorisés, Entra ID, dépôts de mises à jour Kletron. Hôtes Nous Research bloqués (netguard + pare-feu).
- Durcissement OS de la VM selon la référence ELCA [à confirmer], correctifs OS mensuels et sécurité sous 48 h (P04).

## 7. Environnements non productifs
- La box et la CI ne reçoivent **jamais** de données client réelles ni de secrets client.
- Les captures d'écran, rapports et tickets ne contiennent ni donnée personnelle réelle ni secret.

## 8. Écarts
Tout écart à cette politique est demandé par écrit, motivé, limité dans le temps et approuvé par le responsable Kletron A&E **et** par le client lorsqu'il concerne ses données. Il est consigné dans le dossier client.
