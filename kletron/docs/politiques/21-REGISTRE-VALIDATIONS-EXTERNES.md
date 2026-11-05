# 21 — Registre des validations externes restantes

> ⚖️ Document opérationnel interne : **pas un avis juridique**, non validé par un juriste, ELCA, EveryWare ni un client.

> État au 5 nov 2026, ~22:30 Europe/Zurich (box). **Aucune de ces validations n'est obtenue.** Le bot ne contacte personne (ni ELCA, ni EveryWare, ni client, ni Nous Research, ni avocat) et ne crée rien à l'extérieur : chaque ligne attend une action ou un OK explicite de Romain.
> Statuts : **OUVERT** (rien d'engagé) · **EN ATTENTE** (demandé, réponse attendue) · **OBTENU** (preuve archivée) · **SANS OBJET**.
> Mise à jour : à chaque validation obtenue, renseigner date, preuve (chemin dans le dossier, sans secret) et décision liée.

| ID | Validation | Qui doit valider / agir | Bloque | Pré-requis côté A&E (prêt ?) | Statut |
|---|---|---|---|---|---|
| **GitHub** | | | | | |
| V-GH-1 | Nom et création de l'org GitHub (`kletron` recommandé, repli `kletron-ai`) ; MFA obligatoire ; token par défaut en lecture seule | Romain | K1, K2 (push, CI), P09 (CI de signature), K15 | docs/03, docs/06 §6.6 (prêt) | OUVERT |
| V-GH-2 | Création des dépôts `kletron-agent` (public après rebrand), `kletron-platform` et `kletron-skills` (privés), protections de branches | Romain | K1 | idem | OUVERT |
| V-GH-3 | Premier push (miroir `upstream-base` + `kletron`), désactivation des 58 workflows amont, activation de `kletron-ci.yml` | Romain | K2, preuves CI multi-OS | `kletron-ci.yml` brouillon (non exécuté) | OUVERT |
| V-GH-4 | Passage public de `kletron-agent` | Romain, après V-JUR-1 | publication | rebrand au build prouvé (0 « Hermes » visible) | OUVERT |
| V-GH-5 | Archivage de la v1 `rom-ai-in/kletron` (tag `v1-final`) | Romain | ménage (non bloquant) | archive locale `kletron-v1-ref/` | OUVERT |
| **Signature et certificats** | | | | | |
| V-CERT-1 | Certificat de signature Windows au nom de l'éditeur (ou Azure Trusted Signing), et valeur exacte du *Publisher* MSIX | Romain (achat / vérification d'identité de l'entité) | P09, K15 ; remplace « CN=Nous Research Inc. » | point de remplacement identifié (`scripts/msix-shared.mjs`) | OUVERT |
| V-CERT-2 | Compte Apple Developer (Developer ID Application + Installer, notarisation) | Romain | P09 macOS, Jamf | `scripts/notarize.mjs` amont repéré | OUVERT |
| V-CERT-3 | Nom de domaine et hébergement du feed de mise à jour (`KLETRON_UPDATE_URL`) et de la source d'installation (`KLETRON_INSTALL_SOURCE`) | Romain | mises à jour hors MDM | variables prêtes, vides par défaut | OUVERT |
| V-CERT-4 | Figer l'appId `ch.numezis.kletron` (irréversible après diffusion) | Romain | première build signée | proposé (03-DECISIONS) | OUVERT |
| **Juridique** | | | | | |
| V-JUR-1 | Avis juridique marque (« Kletron » : antériorité CH/UE/US ; mention de non-affiliation ; identifiants internes « hermes » conservés ; demande USPTO « HERMES AGENT » 50111354) et entité éditrice | avocat mandaté par Romain (D13, proposée) | V-GH-4, première release client | docs/06 §11 (questions listées) | OUVERT |
| V-JUR-2 | Relecture nLPD de P01–P11 (rôles, art. 9, 16, 24 ; surveillance des employés ; durées de rétention) ; modèle de DPA | juriste mandaté par Romain | premier client avec données réelles | ce dossier de politiques | OUVERT |
| V-JUR-3 | Licence et conditions de `kletron-platform` / `kletron-skills` (privés) ; clauses de réversibilité ; notices tierces des binaires | juriste + Romain | contrat client, P11 §5 | — | OUVERT |
| V-JUR-4 | Logo définitif et charte (droits sur le visuel) | Romain (designer) | P09 (visuels DMG/MSIX), V-GH-4 | logo provisoire | OUVERT |
| **ELCA / EveryWare** | | | | | |
| V-ELCA-1 | **Accord écrit d'ELCA** pour des données de production sur EveryWare tant qu'il est en bêta (ou confirmation de disponibilité générale) | ELCA, demandé par Romain | tout usage de données réelles (P01 §4, G-DON-3) | exigences listées en P01 §4 | OUVERT |
| V-ELCA-2 | Conditions EveryWare : localisation, rétention et non-réutilisation des prompts/réponses, sous-traitants, disponibilité, notification d'incident, compatibilité API avec LiteLLM | ELCA / EveryWare | K5, P01, P05, RACI l. 21/29 | — | OUVERT |
| V-ELCA-3 | Offre VM : provisionnement, zone Suisse, réseau sortant filtrable, chiffrement au repos, sauvegardes et stockage séparé, bastion/VPN, durcissement de référence | ELCA | P06, P07, P11, K14 | besoins listés en P07/P11 | OUVERT |
| V-ELCA-4 | Validation de la matrice RACI et du montage contractuel (ELCA sous-traitant d'A&E ou du client) | ELCA + Romain | contrats | `20-MATRICE-RESPONSABILITES.md` | OUVERT |
| **Entra ID / client** | | | | | |
| V-ENTRA-1 | Tenant Entra de test (ou du premier client) : enregistrements d'application Desktop / passerelle / Console, groupes, MFA, accès conditionnel ; preuve de bout en bout | admin Entra (client ou tenant de test de Romain) | K4, K6, K11, G-SEC-1 | P02 §3 ; points d'extension amont repérés, **non testés** | OUVERT |
| V-CLI-1 | Premier client : DPA, classification, rétentions, scénarios de recette, fenêtre de maintenance | client, via Romain | P10 | modèles P03, P06, P10 | OUVERT |
| V-CLI-2 | Intune / Jamf du client : mode de paquet accepté, profil de configuration, anneau pilote | admin poste du client | P09, G-DSK-1 | P09 §4–5 | OUVERT |
| **Tests natifs** | | | | | |
| V-TEST-1 | Build, signature, installation, lancement, mise à jour MSIX et désinstallation sur **Windows** réel (Win 11, poste géré Intune) ; scan « 0 Hermes visible » ; aucun trafic hors liste blanche | A&E sur runner Windows (CI, V-GH-3) ou poste Windows mis à disposition par Romain | P09, G-DSK-2 | seul Linux prouvé sur la box | OUVERT |
| V-TEST-2 | Idem sur **macOS** réel (Apple Silicon + Intel si requis, poste Jamf) : signature, notarisation, Gatekeeper, PPPC | A&E sur runner macOS ou Mac de test **avec OK de Romain** (aucune action sur son Mac sans OK) | P09, G-DSK-2 | idem | OUVERT |
| V-TEST-3 | Verrouillage macOS/Windows (patch 0003 Managed Scope) et blocage YOLO (0004) testés en natif | A&E | K12, G-SEC-5 | plans 0003–0004 rédigés, non écrits | OUVERT |
| **Décisions internes (Romain)** | | | | | |
| V-INT-1 | Activer *Watch → Releases + Security alerts* sur `NousResearch/hermes-agent` (compte GitHub de Romain) | Romain | P04 §4 (détection 48 h) | — | OUVERT |
| V-INT-2 | Choix techniques : coffre de secrets, stockage des journaux en ajout seul, format des sauvegardes | Romain sur proposition A&E | P02, P06, P07 | à proposer avec K11/K14 | OUVERT |
| V-INT-3 | Supervision intégrée à la pile client et éventuelle Action GitHub de veille (D8 option 3) vs règle « aucune automation » | Romain | P08 §4, P04 §4 | — | OUVERT |
| V-INT-4 | Décisions D1–D4, D6–D11, D13–D15 (`03-DECISIONS-PROPOSITIONS-FORK.md`) | Romain | alignement définitif P04, P09 | proposées | OUVERT |
| V-INT-5 | Désignation d'un suppléant (incidents, signature, sync) | Romain | P05, risque R14 | — | OUVERT |
| V-INT-6 | Valeurs chiffrées marquées [à confirmer] dans P05–P08, P11 (délais, rétentions, RPO/RTO, SLA) | Romain, puis contrat client | contrats | propositions par défaut rédigées | OUVERT |

## Ce qui ne demande aucune validation externe (fait sur la box)
Fork mince local (2 patchs, 11 fichiers amont, 73 lignes de contact), rebrand au build prouvé, gouvernance 24 PASS, Desktop Linux packé et lancé, politiques P01–P11 rédigées. Rien n'a été poussé ni envoyé.
