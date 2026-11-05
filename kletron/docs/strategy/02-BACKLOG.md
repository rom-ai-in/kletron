# 02 — Backlog K1–K21

Source : stratégie Kletron 5 nov 2026 (`00-STRATEGIE.md`).  
S ≈ 1 semaine · M ≈ 2–3 semaines · L ≥ 4 semaines. Estimations.  
Statut à mettre à jour par le bot Kletron à chaque brique touchée.

| ID | Brique | Phase | Dépôt | Taille | Statut |
|---|---|---|---|---|---|
| K1 | Organisation et dépôts | 0 | — | S | à_faire — nom provisoire `kletron` (repli `kletron-ai`), PROPOSÉ, attend l'OK de Romain ; rien de créé |
| K2 | Fork, file de patchs, synchronisation, CI | 0 | kletron-agent | M | en_cours — base `ea6b602` ; **4 patchs DEP-3**, 15 fichiers amont / 106 contact, 0 test amont ; reconstruction OK ; gouvernance ALL PASS ; push `rom-ai-in/kletron` `dev` (t10u+t11u) |
| K3 | Marque CLI et Desktop, domaines Nous Research | 0 | kletron-agent | M | en_cours — rebrand au BUILD prouvé ; 0001+0002 ; reste logo définitif + certificat Windows (publisher encore Nous) — voir `kletron/docs/windows-signing.md` |
| K4 | kletron serve, Desktop distant, OIDC | 1 | kletron-agent | S | à_faire |
| K5 | Passerelle d’inférence LiteLLM | 1 | kletron-platform | S | à_faire |
| K6 | Passerelle MCP : OAuth, protocole 2026-07-28, journal | 1 | kletron-platform | M | à_faire |
| K7 | Connecteurs bexio et Microsoft 365 en lecture | 1 | kletron-platform | M | à_faire |
| K8 | Validations par un tiers | 1–2 | kletron-platform + kletron-agent | M | à_faire |
| K9 | Droits groupe × connecteur × ressource × action | 2 | kletron-platform | M | à_faire |
| K10 | Écritures bexio/Abacus, SharePoint, brouillon d’e-mail | 2 | kletron-platform | M | à_faire |
| K11 | Console : configuration verrouillée | 2 | kletron-platform | M | à_faire |
| K12 | Patchs agent : verrous, YOLO, validations | 2 | kletron-agent | M | fait_local — 0003 managed-scope ; 0004 yolo-lock ; 0005 plugin Desktop `kletron-validations` (overlay) ; budget 4 patchs / 15 fichiers / 106 contact / 0 test amont |
| K13 | Politiques OpenShell | 2 | kletron-platform | S | à_faire |
| K14 | Blueprint et pile par client | 3 | kletron-platform | L | à_faire |
| K15 | Desktop signé, Intune/Jamf | 3 | kletron-agent | M | à_faire — prérequis posés : `KLETRON_UPDATE_URL` (feed generic, canal explicite), `KLETRON_INSTALL_SOURCE` ; version `X.Y.Z-k.N` validée (semver, electron-updater, quad MSIX amont) mais exige un feed Kletron dédié ; publisher MSIX encore « CN=Nous Research Inc. » (attend certificat) |
| K16 | Bibliothèque de skills | 3 | kletron-skills | M | à_faire |
| K17 | Console : flotte, budgets, arrêt | 3 | kletron-platform | L | à_faire |
| K18 | Connecteurs sur mesure (OpenAPI) | 3 | kletron-platform | M | à_faire |
| K19 | Relais MCP officiels | 4 | kletron-platform | M | à_faire |
| K20 | ERP Numezis comme connecteur | 4 | kletron-platform | S | à_faire |
| K21 | Mode local | 4 | kletron-agent + kletron-platform | L | à_faire |

Dépôts proposés (pas de `kletron-gateway` séparé) : `kletron-agent` (public MIT), `kletron-platform` (privé — passerelle MCP + Console + LiteLLM + blueprints), `kletron-skills` (privé).

## Note 5 nov 2026, 10:15 Europe/Zurich (box)
Détails et preuves : `reports/2026-11-05-setup-proofs.md`. K3 est probablement sous-estimé : ~3 173 occurrences du mot « Hermes » dans `apps/desktop/src` + `electron` (hors tests) et ~1 456 dans `hermes_cli/*.py`, plus 1 037 adresses `nousresearch.com` (voir `reports/2026-11-05-phase0-audit.md` §6).

## Note 5 nov 2026, ~10:45 Europe/Zurich (box)
Preuves : `reports/2026-11-05-setup-proofs-2.md`. Patchs : `0001-brand` (39 fichiers, +239/−27), `0002-nous-neutralize` (18 fichiers, +516/−18). Il reste 3 emplacements sur 5 pour K12 (plans 0003–0005).

## Note 5 nov 2026, ~12:00 Europe/Zurich (box)
Refactor « fork mince » (docs/06), preuves dans `reports/2026-11-05-setup-proofs-3.md`.

| | Avant | Après |
|---|---|---|
| Patchs | 2 | 2 |
| Fichiers amont modifiés | 47 | 15 |
| Lignes de contact | 152 | 85 |
| Tests amont modifiés | 9 | 0 |
| Assets binaires modifiés | 16 | 0 |
| DEP-3 | absent | OK |

- Il reste 3 emplacements de patch sur 5 pour K12.
- Deux bugs réels trouvés grâce aux tests amont non modifiés, et corrigés : `prog` CLI et APP_ID Linux.

## Note 5 nov 2026, ~13:03 Europe/Zurich (box)
K2/K3 : 0 échec inattendu. Pytest 9 attendus + 26 baseline + 5 fichiers e2e hôte (clone shallow/OOM) ; vitest 17 129 passés, 4 attendus + 1 baseline. Desktop packé et lancé : Kletron partout (titre, WM_CLASS, accueil), pas d'`app-update.yml`. Branches nettoyées (`backup/*-2026-11-05`). Détails : `STATUS-BOX.md`, `reports/2026-11-05-setup-proofs-3.md`.

## Note 5 nov 2026, ~14:00 Europe/Zurich (box)
Rebrand au BUILD (modèle VSCodium/Cursor), preuves `reports/2026-11-05-setup-proofs-4.md`. Ancienne piste « PR amont accesseur de nom produit » et packs i18n/skin runtime **abandonnées** (décision Romain). Budget 11 / 73. Procédure sync des règles : docs/06 §3.4.

## Note 5 nov 2026, ~22:30 Europe/Zurich (box) — politiques opérationnelles
Ensemble `docs/politiques/` (PROJET v0.1, pas d'avis juridique). Statuts K inchangés ; les politiques fixent les exigences que chaque brique devra prouver :

| Brique | Exigences ajoutées (politique) |
|---|---|
| K1, K2 | V-GH-1 à V-GH-3 (registre) ; sync hebdo manuelle + sécurité ≤ 48 h (P04) |
| K3, K15 | Desktop signé, publisher MSIX Kletron, visuels DMG Kletron, Intune/Jamf, tests natifs V-TEST-1/2 (P09) |
| K4, K6, K11 | OIDC Entra ID, groupes, MFA, révocation < 1 h (P02 §3) ; V-ENTRA-1 |
| K5 | clés virtuelles et budgets par employé, pas de contenu de prompt journalisé par défaut (P06), blocage EveryWare bêta pour données réelles sans accord ELCA (P01 §4) |
| K6–K10, K18–K20 | fiche d'admission connecteur, classes C0–C4, validation par un tiers pour écritures C2+ (P03) ; journal d'audit en ajout seul (P06) |
| K11, K17 | arrêt d'urgence N1–N6 < 15 min, testé (P05 §4) ; indicateur `provider_stage=beta` (P01 §4) |
| K12, K13 | YOLO impossible, OpenShell = barrière réelle avec la passerelle (P01 §3.5, G-SEC-5/6) |
| K14 | blueprint par client, sauvegarde + restauration testée, RPO/RTO, réversibilité et attestation de suppression (P07, P11) |
| K16 | skills relues, plugins catalogue verrouillés (P03 §4) |


## Note 5 nov 2026, ~22:30 Europe/Zurich (box)
Finalisation locale K12 : patchs **0003** + **0004** + plugin Desktop **0005** (sans patch). Preuves `reports/2026-11-05-setup-proofs-5.md`. Budget : 4 patchs / 15 fichiers amont / 106 lignes de contact / 0 test amont modifié. Push autorisé vers `rom-ai-in/kletron` branche `dev` (t10u+t11u) — sans force, avec sauvegarde de l'ancien `dev`.
