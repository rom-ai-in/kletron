# P09 — Distribution du Desktop signé (Intune / Jamf)

> PROJET v0.1 — 5 nov 2026. **Aucun build Windows ni macOS natif n'a encore été produit ni testé** : seul le build Linux (AppImage) est prouvé sur la box. Certificats non obtenus (V-CERT-1/2), tests natifs non faits (V-TEST-1/2).

## 1. Principes
1. **Seuls des artefacts signés** au nom de l'éditeur Kletron retenu (Numezis, entité exacte à confirmer, V-JUR-1) sont distribués à un client. **Jamais** d'artefact signé ou publié au nom de Nous Research.
2. **Distribution gérée** : le client déploie via son MDM (Intune pour Windows, Jamf pour macOS). Pas d'installation libre par les employés en production.
3. **Mises à jour maîtrisées** : l'auto-update intégré est **désactivé par défaut** (patch 0002, pas d'`app-update.yml`). Il n'est activé que si `KLETRON_UPDATE_URL` pointe vers un feed Kletron dédié ; en entreprise, la voie recommandée est la **mise à jour par le MDM** (le client contrôle le calendrier).
4. **Traçabilité** : chaque artefact est relié à une release (`kletron-vX.Y.Z-k.N`), un `UPSTREAM_SHA`, un `patches.lock`, un manifeste de rebrand, une empreinte sha256 et une SBOM.

## 2. Formats et signature (état mesuré dans le code amont, à confirmer en test natif)
| OS | Format produit par le build | Signature requise | Point bloquant actuel |
|---|---|---|---|
| Windows | MSIX (`electron-builder` cible `msix` ; crochet de signature Azure Trusted Signing présent en amont) | certificat de signature de code au nom de l'éditeur Kletron ; le *Publisher* du manifeste MSIX doit correspondre exactement au sujet du certificat | `OUT_OF_STORE_PUBLISHER` = « CN=Nous Research Inc. » dans `scripts/msix-shared.mjs` : **à remplacer** dès que le certificat existe (changement d'identité → patch 0001 ou règle de build, revue D3) |
| macOS | DMG + ZIP, *hardened runtime*, notarisation via `scripts/notarize.mjs` | Apple Developer ID Application (+ Developer ID Installer si `.pkg` pour Jamf) ; notarisation Apple | compte Apple Developer de l'éditeur à créer ; fond DMG amont `packaging/nous-dmg-2b.tiff` à remplacer par un visuel Kletron (logo définitif) |
| Linux | AppImage | facultative (empreinte publiée) | prouvé sur la box (non signé) |

Identité : appId `ch.numezis.kletron` (PROPOSÉ, 03-DECISIONS) ; MSIX `Numezis.Kletron*`. À figer **avant la première build signée** : changer d'appId après diffusion casse les mises à jour et les profils MDM.

## 3. Chaîne de build et de signature
- Build dans la CI de l'org Kletron (à créer, V-GH-1), sur runners Windows et macOS, après `kletron/build/build.sh` (rebrand) et la gouvernance.
- Clés de signature : HSM ou service de signature cloud ; à défaut *environment* `release` protégé, **approbation de Romain obligatoire** à chaque signature (D11, proposée).
- Contrôles avant publication : signature vérifiée (`signtool verify` / `codesign --verify` + `spctl` + `stapler validate`) ; scan « 0 Hermes visible » ; absence d'`app-update.yml` pointant hors Kletron ; `LICENSE` MIT amont et `NOTICE` présents dans le paquet (docs/06 §11) ; notices tierces générées.

## 4. Windows — Intune
- Paquet : MSIX en *Line-of-business app* (ou `.intunewin` si un installeur Win32 devient nécessaire ; à décider après test).
- Pré-requis client : le certificat de l'éditeur doit être approuvé par les postes (certificat public reconnu, ou déploiement de la chaîne par Intune).
- Configuration poussée (profil ou script Intune) : `KLETRON_UPDATE_URL` vide (mises à jour par Intune) ; URL de la config distante et de la passerelle de la pile client ; aucune clé ni secret (l'utilisateur s'authentifie par OIDC, P02).
- Affectation : groupe Entra `Kletron-Utilisateurs` ; anneau pilote (5–10 personnes) puis généralisation.
- Accès conditionnel recommandé : appareil conforme.

## 5. macOS — Jamf
- Paquet : `.pkg` signé *Developer ID Installer* et notarisé (à produire à partir de l'app signée), ou app dans DMG selon la pratique du client.
- Profils de configuration : préférences gérées (config distante, passerelle) ; PPPC si des autorisations système sont nécessaires (à identifier en test natif) ; pas de secret.
- Smart group pilote puis généralisation.

## 6. Mises à jour et retrait
- Nouvelle version = nouvelle release signée, déposée par A&E dans le canal convenu (feed Kletron ou remise au client pour import MDM). Le client planifie le déploiement.
- Correctif de sécurité : même chemin, délai P04 §4 ; A&E signale l'urgence au client (personne habilitée, pas le bot).
- Retour arrière : republication de la version précédente sous un numéro supérieur (D10, proposée), car MSIX et electron-updater ne redescendent pas de version.
- Retrait d'urgence (P05 N6) : retrait du feed et de l'affectation MDM.

## 7. Critères pour autoriser la première distribution client
Certificats obtenus et testés (V-CERT-1/2) ; tests natifs Windows et macOS PASS (V-TEST-1/2) ; publisher MSIX et visuels Kletron définitifs ; avis juridique marque reçu (D13, V-JUR-1) ; OK écrit de Romain.
