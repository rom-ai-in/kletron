# P06 — Journalisation, rétention et audit

> ⚖️ Document opérationnel interne : **pas un avis juridique**, non validé par un juriste, ELCA, EveryWare ni un client.

> PROJET v0.1 — 5 nov 2026. Les durées sont des **propositions par défaut [à confirmer]** avec chaque client et un juriste (proportionnalité, art. 6 nLPD ; surveillance des employés).

## 1. Ce qui est journalisé
| Journal | Source | Contenu minimal | Contenu exclu |
|---|---|---|---|
| **Audit passerelle MCP** (journal de référence) | passerelle MCP client (K6) | horodatage UTC + fuseau, utilisateur (ID Entra), groupe, agent/session, connecteur, ressource, action, décision (autorisé/refusé/en attente de validation), validateur, résultat, durée, empreinte des paramètres | secrets, jetons, contenu C3/C4 ; contenu C2 masqué (P03) |
| **Validations** | passerelle + plugin Desktop (K8) | demande, validateur, décision, motif | — |
| **Administration** | Console (K11, K17) | changement de config, de droits, de connecteurs, arrêts d'urgence, accès A&E | secrets |
| **Modèles** | LiteLLM (K5) | utilisateur, modèle, jetons consommés, coût, latence, erreurs | **pas de contenu de prompt/réponse par défaut** |
| **Agent** | Hermès (`~/.hermes/logs`, sessions, `state.db`) | journaux techniques, historique des sessions sur le poste ou dans l'agent serveur | — (contenu potentiellement C2+ : traiter comme donnée client) |
| **Infrastructure** | VM, OpenShell, pare-feu | connexions admin, refus réseau, redémarrages, ressources | — |
| **Build et release** | CI, rapports de sync | SHA amont, patchs, résultats T1–T8, signatures | secrets |

Règles : horloge synchronisée (NTP) ; format structuré (JSON lignes) ; masquage des secrets à la source (en plus du masquage amont, qui reste une heuristique) ; les journaux d'audit sont **en ajout seul** et protégés contre la modification (empreintes chaînées ou stockage WORM, mécanisme à choisir, V-INT-2).

## 2. Rétention par défaut [à confirmer]
| Journal | Durée proposée | Justification |
|---|---|---|
| Audit passerelle MCP, validations, administration | 12 mois | traçabilité des actions sur les systèmes du client |
| Modèles (usage, coûts) | 13 mois | facturation et budgets annuels |
| Contenu des sessions agent côté serveur | 90 jours, ou durée choisie par le client | minimisation ; l'utilisateur DEVRAIT pouvoir effacer ses sessions |
| Infrastructure | 6 mois | sécurité |
| Preuves d'incident | durée de l'incident + 2 ans, ou selon instruction | défense, obligations |
| Build et release, artefacts signés | ≥ 90 jours pour les artefacts (D10, proposée) ; rapports de sync : durée de vie du produit | reproductibilité |

À échéance : suppression ou anonymisation, consignée. Les sauvegardes suivent la rétention propre de P07 (les données supprimées disparaissent des sauvegardes à leur expiration).

## 3. Accès aux journaux
- **Client** (admins, groupe `Kletron-Admins-Client`) : lecture de ses journaux via la Console ; export sur demande.
- **A&E** : lecture pour l'exploitation et les incidents uniquement ; tout accès est lui-même journalisé.
- **ELCA / EveryWare** : aucun accès aux journaux applicatifs, sauf instruction écrite du client pour un incident.
- Les journaux ne servent **pas** à évaluer la performance individuelle des employés, sauf décision documentée du client conforme au droit du travail (à vérifier par le client).

## 4. Audit
- **Interne A&E**, trimestriel, lancé manuellement : échantillon de 20 actions d'écriture → présence de la validation ; revue des accès (P02 §5) ; contrôle que la télémétrie est off et qu'aucun hôte Nous n'est contacté (refus pare-feu et netguard) ; vérification des empreintes des journaux.
- **Client** : droit d'audit selon le DPA ; A&E fournit les journaux, la configuration (sans secret) et les rapports.
- **Release** : chaque release conserve `UPSTREAM_SHA`, `patches.lock`, manifeste du rebrand, rapport de sync, SBOM (à produire en CI).

## 5. Postes de travail (Desktop)
Les journaux et sessions locaux de l'agent (`~/.hermes`) sont sur le poste de l'employé : ils relèvent de la politique de gestion des postes du client (chiffrement disque, effacement à distance via Intune/Jamf). En mode Desktop distant (K4), l'historique DEVRAIT rester côté serveur.

## 6. Droits des personnes
Sur demande du client : extraction ou suppression des entrées d'un utilisateur (sessions, journaux non soumis à une obligation de conservation) sous 20 jours ouvrables [à confirmer], avec trace de l'opération.
