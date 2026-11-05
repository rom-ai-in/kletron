# P05 — Réponse aux incidents et arrêt d'urgence

> ⚖️ Document opérationnel interne : **pas un avis juridique**, non validé par un juriste, ELCA, EveryWare ni un client.

> PROJET v0.1 — 5 nov 2026. Les délais d'annonce nLPD et contractuels sont **à vérifier par un juriste** (V-JUR-2). Aucun contact externe n'est pris par le bot : toute communication à un client, à ELCA ou au PFPDT est faite par une personne habilitée.

## 1. Définitions et sévérités
| Sévérité | Exemples | Prise en charge | Information du client |
|---|---|---|---|
| **S1 critique** | fuite ou suspicion de fuite de données C2+, action non autorisée exécutée sur un système client, compromission d'un secret de signature ou d'une clé maître, agent hors contrôle | immédiate, 24/7 pendant l'incident | **sans délai**, au plus tard 24 h après détection [à confirmer contrat] |
| **S2 majeur** | pile indisponible, secret de connecteur exposé, contournement d'une validation, faille exploitable sans preuve d'exploitation | ≤ 4 h ouvrables | ≤ 24 h |
| **S3 mineur** | dégradation, erreur de connecteur, alerte sans impact données | ≤ 1 jour ouvrable | rapport mensuel |

## 2. Rôles pendant un incident
- **Responsable d'incident** : Romain (ou suppléant désigné) — décide, coordonne, valide les communications.
- **Opérateur technique** A&E : diagnostic, confinement, preuves.
- **Client** : décide des mesures touchant ses données et ses utilisateurs ; **annonce au PFPDT et aux personnes concernées** si nécessaire (responsable du traitement).
- **ELCA / EveryWare** : investigation côté hébergement ou modèles, selon les contrats.

## 3. Déroulé
1. **Détecter et ouvrir** : fiche `reports/incident-AAAA-MM-JJ-<client>-<n>.md` (heure Europe/Zurich, source, symptômes ; sans secret ni donnée personnelle).
2. **Qualifier** la sévérité (§1). En cas de doute : sévérité supérieure.
3. **Confiner** (§4 arrêt d'urgence si nécessaire).
4. **Préserver les preuves** : copie des journaux concernés (P06) en lecture seule, horodatée, avec empreinte sha256 ; pas de redémarrage destructif avant copie, sauf si le confinement l'exige.
5. **Éradiquer** : correctif, rotation des secrets touchés, révocation de jetons.
6. **Restaurer** (P07) et surveiller renforcé 7 jours.
7. **Clôturer** : analyse de cause sans recherche de coupable, actions correctives datées, mise à jour des politiques, rapport au client (S1/S2) sous 10 jours ouvrables [à confirmer].

## 4. Arrêt d'urgence (« kill switch »)
Niveaux, du plus ciblé au plus large. Chaque niveau DOIT être **exécutable en moins de 15 minutes** par un exploitant A&E et **testé** avant le go (P10, critère G-OPS-4).

| Niveau | Action | Moyen (cible) | Moyen provisoire tant que K11/K17 n'existent pas |
|---|---|---|---|
| N1 Outil / connecteur | désactiver un connecteur, un outil ou une action d'écriture | Console : droit retiré, passerelle MCP refuse | config passerelle + redémarrage du service |
| N2 Utilisateur | bloquer un employé | désactivation Entra (client) + révocation de sa clé LiteLLM | révocation clé LiteLLM ; blocage du groupe |
| N3 Écritures | passer toute la pile en lecture seule | Console : mode « lecture seule » global | désactivation des actions d'écriture dans la passerelle |
| N4 Modèles | couper l'inférence | LiteLLM : budget à 0 / route coupée | arrêt du service LiteLLM |
| N5 Pile complète | arrêter tous les agents et la passerelle | Console : arrêt flotte (K17) | arrêt des services sur la VM ; coupure réseau sortant par ELCA |
| N6 Distribution | stopper la diffusion d'une version Desktop | retrait du feed Kletron, révocation de l'affectation Intune/Jamf | idem |

Règles : l'arrêt d'urgence est **conservateur** (fermer d'abord, comprendre ensuite) ; il ne supprime aucune donnée ni journal ; sa levée exige l'accord du responsable d'incident et, pour N3–N5, l'information du client. Le client peut lui-même demander N1–N5 à tout moment ; A&E exécute sans discussion préalable.

## 5. Violation de la sécurité des données (nLPD)
- A&E (sous-traitant) informe le client **sans délai** de toute violation de la sécurité des données dont il a connaissance (art. 24 al. 3 nLPD, à vérifier).
- Le client décide de l'annonce au PFPDT « dans les meilleurs délais » lorsque la violation entraîne vraisemblablement un risque élevé (art. 24 al. 1), et de l'information des personnes concernées.
- A&E fournit : nature de la violation, données et personnes concernées (estimation), conséquences, mesures prises et proposées.
- Les violations sont consignées même sans annonce, et le registre est conservé [durée à confirmer].

## 6. Contacts
Les coordonnées (A&E astreinte, client, ELCA, EveryWare) sont tenues dans le dossier d'exploitation de chaque client, **hors de ce dépôt**. Aucun numéro ni adresse personnelle n'est versé ici.

## 7. Exercices
Un exercice d'incident (table ronde) et un test d'arrêt d'urgence N1–N5 par pile avant le go, puis une fois par an et après tout changement majeur de la Console ou de la passerelle.
