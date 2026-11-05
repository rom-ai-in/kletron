# P02 — Secrets, accès et OIDC Entra ID

> PROJET v0.1 — 5 nov 2026. Pas un avis juridique. Configuration Entra ID à valider avec chaque client (registre V-ENTRA-1).

## 1. Principes
1. **Aucun secret** dans le chat, les commits, la documentation, les tickets, les captures, les journaux ou les rapports. Un secret exposé est **révoqué et remplacé**, pas seulement effacé (incident P05, sévérité S2 au minimum).
2. **Moindre privilège** et **séparation par client** : un secret appartient à une seule pile.
3. **Identité nominative** : chaque accès humain est rattaché à une personne ; pas de compte partagé.
4. **Traçabilité** : création, rotation, utilisation administrative et révocation des secrets sont journalisées (P06).

## 2. Catalogue des secrets et lieu de stockage
| Secret | Exemple | Stockage | Rotation [à confirmer] |
|---|---|---|---|
| Signature Desktop | certificat Windows (MSIX / Authenticode), Developer ID Apple + notarisation | HSM ou service de signature cloud ; à défaut, *environment* GitHub `release` protégé, approbateur Romain (D11, proposée) | à l'expiration ; immédiate si compromission |
| Secrets de CI | token de publication de feed | *environment* `release` uniquement ; aucun secret au niveau dépôt (D11, proposée) | 90 jours |
| Clés LiteLLM | clé maître, clés virtuelles par employé | coffre de la pile client (gestionnaire de secrets sur la VM, mécanisme à choisir, V-INT-2) | maître : 90 j ; virtuelles : à la révocation de l'employé |
| Clé EveryWare | clé d'API fournisseur | coffre de la pile client ; jamais sur les postes | 90 j ou selon ELCA |
| Jetons des connecteurs | OAuth bexio, Microsoft Graph, Abacus | coffre de la passerelle MCP, chiffré ; jetons de rafraîchissement jamais exposés à l'agent | selon le fournisseur ; révocation à la sortie du client |
| Client OIDC | secret ou certificat de l'application Entra ID | coffre de la pile ; **préférer un certificat** à un secret client | 12 mois max |
| Accès administrateur VM | clés SSH | clés nominatives par administrateur A&E, protégées par phrase de passe ou matériel ; bastion ELCA si disponible | révocation au départ d'une personne |

Règles : les secrets sont injectés au démarrage (variables d'environnement ou fichiers montés en lecture seule), **jamais** dans `config.yaml` versionné ni dans la config distante servie par la Console. L'agent Desktop ne détient **aucun** secret de connecteur : il passe par la passerelle MCP, qui les détient.

## 3. OIDC Entra ID (cible K4, K6, K11)
- **Fournisseur d'identité** : le tenant Entra ID **du client**. A&E ne crée pas de comptes utilisateurs.
- **Enregistrements d'application** (à créer par l'admin Entra du client, avec un guide A&E) :
  1. *Kletron Desktop* : client public, flux Authorization Code + PKCE, URI de redirection locale ;
  2. *Kletron Passerelle MCP* : API protégée (audience), scopes par fonction ;
  3. *Kletron Console* : application web confidentielle, accès réservé aux administrateurs.
- **Groupes** : l'appartenance aux groupes Entra (ou rôles d'application) pilote les droits groupe × connecteur × ressource × action (K9). Groupes minimaux proposés : `Kletron-Utilisateurs`, `Kletron-Validateurs`, `Kletron-Admins-Client`, `Kletron-Exploitation-AE` (invités B2B nominatifs A&E).
- **Accès conditionnel** : MFA obligatoire ; recommandation d'exiger un appareil conforme (Intune) pour Desktop et Console.
- **Jetons** : durée de vie courte (≤ 1 h pour l'accès) ; validation de l'émetteur, de l'audience, de la signature et du tenant par la passerelle et la Console ; aucun jeton dans les journaux (masquage, P06).
- **Désactivation** : un employé désactivé dans Entra perd l'accès dès l'expiration de son jeton ; la Console DEVRAIT en plus révoquer sa clé LiteLLM virtuelle (K17). Délai cible : < 1 h [à confirmer].
- État : points d'extension amont repérés (`agent/command_token_source.py`, `gateway/relay`), **non implémentés ni testés** avec un vrai tenant (registre V-ENTRA-1).

## 4. Accès humains de Numezis A&E
| Accès | Qui | Conditions |
|---|---|---|
| Console client (admin) | exploitants A&E désignés | invité B2B nominatif, MFA, groupe `Kletron-Exploitation-AE` |
| VM chez ELCA | administrateurs A&E désignés | clé nominative, bastion ou VPN ELCA, journalisé |
| Données métier du client | **personne par défaut** | uniquement sur demande écrite du client (support), limité dans le temps, journalisé |
| Dépôts GitHub | membres de l'org Kletron (à créer, V-GH-1) | MFA obligatoire, token par défaut en lecture seule, branches protégées |

## 5. Revue des accès
- **Trimestrielle**, lancée manuellement : liste des comptes A&E par client, groupes Entra Kletron, clés SSH, membres GitHub, clés LiteLLM actives. Résultat consigné dans `reports/acces-AAAA-TT-<client>.md` (sans secret).
- **Événementielle** : arrivée ou départ d'une personne A&E, fin de contrat client, incident.
- Départ d'une personne A&E : révocation de ses accès dans la journée ouvrable.

## 6. Bot et agents IA d'A&E
- Le bot de développement (box) n'a **aucun** accès aux piles clients, aux tenants Entra ou aux secrets de production.
- Toute action externe (push, création d'org, envoi de message, déploiement) exige l'OK explicite de Romain dans le chat.
