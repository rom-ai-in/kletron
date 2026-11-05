# P11 — Déploiement d'une pile par client chez ELCA et réversibilité

> ⚖️ Document opérationnel interne : **pas un avis juridique**, non validé par un juriste, ELCA, EveryWare ni un client.

> PROJET v0.1 — 5 nov 2026. Les modalités ELCA (provisionnement des VM, réseau, sauvegardes, contrat) sont **à obtenir** (V-ELCA-1 à V-ELCA-4). Aucun déploiement client réel sans OK explicite de Romain.

## 1. Principe : une pile complète par client (00 §3)
Chaque client a sa **propre VM chez ELCA** (ou son propre ensemble de VM), avec : Kletron Agent serveur, passerelle MCP client, LiteLLM, Console, OpenShell, coffre de secrets, reverse proxy, stockage des journaux et des sauvegardes. **Rien n'est partagé entre clients** : ni base, ni clé, ni journal, ni enregistrement Entra, ni budget, ni sauvegarde. Répliquer un client = déployer une pile depuis le blueprint (K14), pas paramétrer une base partagée.

## 2. Blueprint (K14)
- Décrit de manière déclarative : versions (release Kletron, images), services, réseau (liste blanche de sortie), volumes chiffrés, policies OpenShell, config Console par défaut (télémétrie off, YOLO bloqué, lecture seule par défaut), supervision, sauvegardes.
- Paramètres par client dans un fichier de valeurs **sans secret** ; les secrets sont injectés depuis le coffre.
- Versionné dans `kletron-platform` (privé) ; chaque déploiement référence une version du blueprint.
- Objectif Phase 3 : nouveau client déployé en **< 1 jour**.

## 3. Procédure de déploiement
| # | Étape | Porteur | Sortie |
|---|---|---|---|
| 1 | Cadrage, DPA, classification (P10 §1) | A&E + client | dossier client ouvert |
| 2 | Demande de VM à ELCA (taille, zone Suisse, réseau, sauvegarde) | A&E | VM livrée, accès admin nominatif |
| 3 | Enregistrements Entra ID et groupes (guide A&E) | admin Entra du client | IDs d'application (non secrets) transmis |
| 4 | Clé EveryWare et conditions (bêta : P01 §4) | A&E + ELCA | clé dans le coffre ; accord archivé si données réelles |
| 5 | Déploiement du blueprint | A&E | services verts |
| 6 | Connecteurs (P03 §3), OAuth par le client | A&E + client | connecteurs en lecture |
| 7 | Durcissement, scans, supervision, sauvegarde | A&E | rapports |
| 8 | Desktop signé dans Intune/Jamf (P09) | client (MDM) + A&E | anneau pilote |
| 9 | Recette et go/no-go (P10) | client + A&E | PV |

## 4. Évolutions de la pile
Changements selon P04 ; mise à jour **pile par pile** (pilote d'abord) ; chaque pile documente sa version courante dans le dossier client.

## 5. Réversibilité et fin de contrat
**Engagements proposés (à inscrire au contrat) [à confirmer]** :
1. **Restitution** au client, dans un délai de 30 jours après la demande, dans des formats ouverts : journaux d'audit (JSON lignes), configuration (YAML/JSON), droits et groupes, historique des validations, skills spécifiques au client (SKILL.md), sessions serveur si le client le demande.
2. **Pas de verrouillage** : Kletron Agent est MIT ; la passerelle et la Console exposent leurs données par export ; les connecteurs utilisent les API standard des éditeurs ; LiteLLM peut pointer vers un autre fournisseur de modèles sur décision du client.
3. **Transfert** : sur demande, assistance au transfert vers un autre exploitant ou un hébergement du client (prestation à chiffrer), y compris le blueprint de la pile du client (sous réserve de la licence de `kletron-platform`, à définir — V-JUR-3).
4. **Révocations** à la fin : jetons OAuth des connecteurs, clés EveryWare et LiteLLM, enregistrements Entra (par le client), accès A&E (invités B2B, SSH), affectations MDM.
5. **Effacement** : après confirmation écrite de la bonne réception de la restitution, suppression des données de la VM, des sauvegardes (à leur expiration ou par purge) et des copies A&E ; **attestation de suppression** remise au client ; exceptions limitées aux obligations légales de conservation, listées.
6. **Désinstallation** du Desktop par le MDM du client.

## 6. Changement d'hébergeur ou de fournisseur de modèles
- Hébergeur : la pile est conçue pour être redéployable ailleurs (blueprint) ; le passage nécessite l'accord du client (sous-traitance) et une revue P01.
- Modèles : un changement de fournisseur (hors EveryWare) est un changement **interdit sans décision écrite** (P04 §1), car il modifie le flux de données.

## 7. Démo ELCA (Phase 1)
La démo se fait sur une pile dédiée de démonstration, avec données **C0 uniquement** (compte bexio de démo), même si EveryWare passe en GA entre-temps, sauf accord écrit contraire. Elle est détruite ou conservée explicitement à la fin de la démo, sur décision de Romain.
