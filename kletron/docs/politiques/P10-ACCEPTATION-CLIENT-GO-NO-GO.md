# P10 — Acceptation client et critères go/no-go

> ⚖️ Document opérationnel interne : **pas un avis juridique**, non validé par un juriste, ELCA, EveryWare ni un client.

> PROJET v0.1 — 5 nov 2026. Le go en production d'une pile client exige **tous** les critères ci-dessous au vert **et** l'OK écrit de Romain **et** le procès-verbal d'acceptation signé par le client. Aligné sur D9 (proposée).

## 1. Étapes
1. **Cadrage** : périmètre (employés, groupes, connecteurs, classes de données P03), DPA, rétentions, contacts, fenêtre de maintenance.
2. **Déploiement en environnement de recette** (pile du client, données C0) : P11.
3. **Recette fonctionnelle** par le client, sur scénarios convenus (§3).
4. **Revue go/no-go** (§2) : A&E + client ; décision écrite.
5. **Pilote** : groupe restreint, données réelles **seulement** si G-DON-1 à G-DON-4 sont verts ; 2 à 4 semaines.
6. **Généralisation** : après bilan du pilote.

## 2. Critères go/no-go
| ID | Critère | Preuve |
|---|---|---|
| **Juridique et données** | | |
| G-DON-1 | DPA client ↔ A&E signé ; sous-traitants ultérieurs (ELCA, EveryWare) acceptés par le client | contrat |
| G-DON-2 | Classification des sources validée par le client (P03) ; connecteurs et droits approuvés | fiche signée |
| G-DON-3 | **EveryWare** : accord écrit d'ELCA pour les données de production **si le service est en bêta** ; sinon conditions GA reçues | accord archivé (V-ELCA-1) |
| G-DON-4 | Information des employés faite par le client ; AIPD évaluée par le client | confirmation client |
| G-DON-5 | Durées de rétention fixées (P06) | annexe |
| **Sécurité** | | |
| G-SEC-1 | OIDC Entra ID fonctionnel ; MFA ; groupes ; un utilisateur désactivé perd l'accès | test |
| G-SEC-2 | Aucun secret dans config, journaux, dépôt ; coffre en place | scan + revue |
| G-SEC-3 | Gouvernance du fork ALL PASS ; 0 échec nouveau vs baseline ; aucun correctif sécurité en attente > 48 h | rapport de release |
| G-SEC-4 | Télémétrie off, aucun trafic vers des hôtes hors liste blanche (dont Nous) pendant la recette | journaux pare-feu / netguard |
| G-SEC-5 | Mode sans validation (YOLO) impossible pour un utilisateur ; écriture sans validation refusée par la passerelle ; refus d'une ressource non autorisée | tests |
| G-SEC-6 | OpenShell actif ; sortie réseau des agents limitée | test d'évasion simple |
| G-SEC-7 | Revue de vulnérabilités de la VM et des images (pas de critique ouverte) | rapport |
| **Exploitation** | | |
| G-OPS-1 | Journal d'audit complet pour chaque appel de la recette ; accès client aux journaux | échantillon |
| G-OPS-2 | Supervision et check-lists en place (P08) | check-list |
| G-OPS-3 | Sauvegarde **et restauration** testées sur VM vierge (P07) | rapport de restauration |
| G-OPS-4 | Arrêt d'urgence N1–N5 testé en < 15 min chacun (P05) | rapport |
| G-OPS-5 | Budgets LiteLLM configurés et testés (blocage à 100 %) | test |
| G-OPS-6 | Dossier d'exploitation client complet (P08 §7) | dossier |
| **Poste de travail** | | |
| G-DSK-1 | Desktop signé, déployé par Intune/Jamf sur l'anneau pilote, sans « Hermes » visible | captures |
| G-DSK-2 | Tests natifs Windows/macOS PASS sur la version livrée | rapport (V-TEST-1/2) |
| **Fonctionnel** | | |
| G-FCT-1 | Scénarios de recette du client PASS (§3) | PV |
| G-FCT-2 | Performance acceptable (latence p95 convenue) | mesure |

**NO-GO automatique** : un critère G-DON ou G-SEC rouge ; un correctif sécurité en attente > 48 h ; une restauration non testée ; un arrêt d'urgence non testé. Un critère G-OPS/G-FCT peut être accepté avec réserve **écrite**, datée, avec plan de levée, signée par Romain et le client.

## 3. Scénarios de recette minimaux
1. Connexion OIDC depuis le Desktop ; refus d'un compte hors groupe.
2. Lecture bexio (ou connecteur du périmètre) ; l'appel apparaît au journal (critère de fin de la Phase 1).
3. Tentative d'accès à une ressource non autorisée → refus journalisé.
4. Écriture soumise à validation → validée par un tiers → exécutée → journalisée ; même écriture refusée → non exécutée.
5. Dépassement de budget → blocage clair.
6. Arrêt d'urgence N3 (lecture seule) → écritures refusées ; levée.
7. Mise à jour du Desktop par le MDM vers la version suivante.

## 4. Procès-verbal
Modèle de PV : identification de la pile et des versions (release Kletron, `UPSTREAM_SHA`), liste des critères avec statut, réserves, décision (go / go avec réserves / no-go), signatures client et A&E, date. Archivé dans le dossier client.
