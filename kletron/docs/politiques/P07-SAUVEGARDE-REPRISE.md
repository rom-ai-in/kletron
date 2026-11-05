# P07 — Sauvegarde et reprise

> ⚖️ Document opérationnel interne : **pas un avis juridique**, non validé par un juriste, ELCA, EveryWare ni un client.

> PROJET v0.1 — 5 nov 2026. Les capacités de sauvegarde de la VM ELCA (snapshots, copie hors site, chiffrement) **ne sont pas encore connues** (registre V-ELCA-3). Les valeurs RPO/RTO sont des propositions [à confirmer] par contrat.

## 1. Quoi sauvegarder (par pile client)
| Élément | Contenu | Méthode cible | Fréquence proposée |
|---|---|---|---|
| Configuration de la pile | config Console, droits, connecteurs actifs, policies OpenShell, config LiteLLM (sans secret) | export versionné (dépôt de config client privé, ou blueprint K14) | à chaque changement |
| Bases de données | Console, passerelle MCP (droits, validations, journal), LiteLLM (clés virtuelles, budgets) | dump logique chiffré + snapshot VM | quotidienne |
| Journaux d'audit | P06 | copie en ajout seul vers un stockage séparé | quotidienne |
| Secrets | coffre de la pile | sauvegarde du coffre chiffrée, clé de récupération sous double contrôle | à chaque rotation |
| Agents serveur | `~/.hermes` des agents serveur (sessions, mémoires, skills locales) | snapshot | quotidienne |
| Artefacts | builds signés, rapports de sync | stockage de release A&E | à chaque release, ≥ 90 j |

Non sauvegardé par A&E : les postes des employés (responsabilité du client) et les données des systèmes métier (bexio, M365… restent sous la responsabilité de leurs fournisseurs).

## 2. Objectifs [à confirmer]
| Service | RPO | RTO |
|---|---|---|
| Journal d'audit | ≤ 24 h (cible ≤ 1 h quand la réplication existe) | 1 jour ouvrable |
| Pile complète | ≤ 24 h | 1 jour ouvrable (cible phase 3 : < 4 h, en cohérence avec « nouveau client déployé en < 1 jour ») |
| Configuration | 0 (versionnée) | redéploiement depuis le blueprint |

## 3. Règles
- Sauvegardes **chiffrées**, stockées **en Suisse**, dans un emplacement **séparé** de la VM de production (autre zone ou autre stockage ELCA, à confirmer).
- **Isolation par client** : aucune sauvegarde ne mélange deux clients.
- Rétention des sauvegardes : 30 jours glissants + 12 mensuelles [à confirmer, cohérence avec P06].
- Les secrets ne figurent jamais en clair dans une sauvegarde de configuration.

## 4. Tests de restauration
- **Avant le go** (P10, critère G-OPS-3) : restauration complète sur une VM vierge, vérification du journal d'audit (empreintes), de la connexion OIDC et d'un appel connecteur en lecture.
- Puis **semestriel** par pile, lancé manuellement, consigné dans `reports/restauration-AAAA-MM-<client>.md` (durée mesurée vs RTO).

## 5. Reprise après sinistre
1. Déclarer l'incident (P05).
2. Provisionner une VM ELCA depuis le blueprint (K14).
3. Restaurer secrets, bases, journaux, configuration.
4. Vérifier : santé des services, OIDC, connecteurs, budgets LiteLLM, liste blanche réseau.
5. Réouvrir aux utilisateurs avec l'accord du client ; rapport de reprise.
