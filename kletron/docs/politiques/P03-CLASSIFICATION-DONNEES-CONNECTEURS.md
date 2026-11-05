# P03 — Classification des données et admission des connecteurs

> PROJET v0.1 — 5 nov 2026. La classification finale de chaque source est **décidée par le client** (responsable du traitement). Pas un avis juridique.

## 1. Classes de données
| Classe | Définition | Exemples | EveryWare bêta (P01 §4) |
|---|---|---|---|
| **C0 — Démo / synthétique** | données fictives, générées ou publiques | compte bexio de démo, jeux d'essai | autorisé |
| **C1 — Interne** | données d'entreprise sans donnée personnelle notable | procédures, catalogue produits | interdit sans accord ELCA |
| **C2 — Confidentiel** | données personnelles ordinaires, données commerciales | contacts clients, factures, e-mails, agendas | interdit sans accord ELCA |
| **C3 — Strictement confidentiel** | données personnelles sensibles (art. 5 let. c nLPD : santé, opinions, mesures pénales, etc.), salaires, RH, secrets d'affaires majeurs | dossiers RH, paie, dossiers médicaux | interdit ; en production : accord client écrit + AIPD à évaluer + validation par un tiers obligatoire |
| **C4 — Interdit à l'agent** | secrets d'authentification, données soumises à secret professionnel non couvert, données que le client exclut | mots de passe, clés, dossiers d'avocat | jamais, sur aucun modèle |

Règle par défaut : **une source non classée est traitée comme C3**.

## 2. Règles par classe
| | C0 | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|
| Lecture par l'agent | oui | oui | oui, par groupe | groupe restreint, ressource par ressource | non |
| Écriture | oui | validation recommandée | **validation par un tiers** (K8) | validation par un tiers + double contrôle | non |
| Contenu dans les journaux | complet | métadonnées + extrait | métadonnées, contenu masqué | métadonnées seules | — |
| Envoi au modèle | oui | oui (EveryWare GA ou accord) | oui (idem) | seulement si le client l'accepte par écrit | non |
| Export hors pile | libre | sur demande client | sur demande client écrite | interdit sauf instruction écrite | — |

## 3. Admission d'un connecteur (avant toute activation chez un client)
Un connecteur (bexio, Abacus, Odoo, Microsoft 365, Google, OpenAPI sur mesure K18, relais MCP officiel K19, ERP Numezis K20) n'est activé qu'après cette fiche, conservée dans `kletron-platform` (une fiche par connecteur et par version) :
1. **Propriétaire** A&E et version.
2. **Origine du code** : copié une fois depuis l'ERP (00 §5, `04-SOURCES-A-PORTER.md`), écrit à neuf, ou tiers (licence vérifiée).
3. **Ressources et actions** exposées, avec la classe maximale de données touchées.
4. **Scopes OAuth** demandés : le minimum ; lecture seule par défaut.
5. **Hôtes réseau** contactés (ajoutés à la liste blanche OpenShell et au pare-feu de la VM).
6. **Masquage** : champs sensibles masqués dans les journaux et dans la ligne de consentement.
7. **Tests** : lecture, refus d'une ressource non autorisée, refus d'une écriture sans validation, jeton expiré, limite de débit, erreur fournisseur.
8. **Revue sécurité** par une seconde personne A&E (ou le bot sur demande de Romain, puis relecture humaine).
9. **Activation chez le client** : par la Console, pour des groupes nommés, après validation du client (P10).

## 4. Plugins, skills et MCP tiers
- L'installation de plugins du catalogue Hermès est **désactivée ou verrouillée** côté clients (risque supply chain R8, docs/06 §9).
- Les skills (K16) sont versionnées dans `kletron-skills`, relues avant publication et distribuées par la Console ; un employé ne peut pas installer une skill non approuvée en production.
- Un serveur MCP tiers n'est jamais branché directement sur l'agent : il passe par la passerelle MCP client (droits + journal).

## 5. Revue
Classification et liste des connecteurs actifs revues avec le client à chaque ajout de connecteur et au moins une fois par an.
