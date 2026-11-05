# Critères exacts avant de dire « OK pour le Mac »

Tous doivent être VRAIS. Tant qu’un item est faux → **pas OK Mac**.

1. [ ] Archive SHA-256 vérifiée (`shasum -a 256 -c SHA256SUMS.txt`) sur le Mac.
2. [ ] `./scripts/kletron-install-mac.sh` termine exit 0 sur le Mac (CLI).
3. [ ] `kletron --version` affiche `Kletron Agent v0.22.7-k.1` (après rebrand build **ou** via arbre transformé / install stamp).
4. [ ] `kletron/tests/governance.sh` PASS sur le checkout Mac (ou CI équivalente sur runner macOS).
5. [ ] Desktop : `.app` / `.dmg` **construit sur macOS** (pas depuis la box Linux).
6. [ ] Signature code + notarisation Apple **avec certificat Kletron/Numezis** (pas auto-sign ad hoc pour une release client).
7. [ ] Fond DMG = asset Kletron (placeholder actuel acceptable en interne seulement) ; revue marque [V-JUR] ouverte tant que non validée.
8. [ ] Publisher / identité macOS ≠ Nous Research ; feed update = `KLETRON_UPDATE_URL` ou désactivé.
9. [ ] Aucun secret dans l’archive ni dans le dépôt poussé.
10. [ ] Romain a validé un smoke manuel : lancement UI Desktop, titre Kletron, pas d’appel réseau Nous.

Tant que 5–8 ou 10 sont ouverts → on peut dire « archive source prête », **pas** « OK install client Mac ».
