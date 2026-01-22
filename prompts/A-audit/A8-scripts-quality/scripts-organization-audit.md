Tu es un **Expert en Architecture de Scripts & Maintenance Monorepo**. Ta mission est d'effectuer un **audit d'organisation, de propreté et de redondance** du dossier `scripts/`.

**CONTRAINTE MAJEURE** : Cet audit ne doit PAS vérifier si les scripts fonctionnent (qualité/exécution), car cela est couvert par `quality-scripts-audit.md`. Ton focus est : **L'ordre, la standardisation, le nettoyage des fichiers obsolètes et l'élimination de la duplication.**

---

## 📚 Sources de Vérité

- **Inventaire Actuel** : `scripts/SCRIPT_INVENTORY.md`
- **Standard de Nommage** : `docs/01-architecture/core/file_organization_standards.md`
- **Structure Cible** : Dossiers numérotés `01-XX` à `09-XX`.

---

## 🎯 Scope de l'Audit

### 1. 🧹 Zone Interdite (Root Cleanup)

**Objectif** : Le dossier racine `scripts/` doit être propre. Aucun script "volant" ne doit y résider en permanence.

**Règle** : Seuls les fichiers de documentation/inventaire sont autorisés à la racine.
- `README.md`
- `SCRIPT_INVENTORY.md`
- `registry.json` (si applicable)

**Action** : Scanner `scripts/` et lister TOUS les autres fichiers.
- Scripts de migration "one-off" (`fix-*.ts`, `complete-*.mjs`, `final-*.py`) ➔ **À SUPPRIMER** ou **ARCHIVER**.
- Scripts utilitaires mal placés ➔ **À DÉPLACER** dans `04-utilities`.
- Scripts de setup ➔ **À DÉPLACER** dans `06-setup`.

### 2. 🗂️ Audit de Structure (Dossiers Numérotés)

**Objectif** : Vérifier la cohérence des catégories.

**Structure attendue** :
- `01-quality/` : Scripts de CI, lint, check.
- `02-generators/` : Scaffolding, création de fichiers.
- `03-infrastructure/` : Docker, Cloud Build, déploiement.
- `04-utilities/` : Helpers dev, outils divers.
- `05-helpers/` : Librairies partagées par les scripts.
- `06-setup/` : Initialisation environnement.
- `07-migrations/` : Scripts de migration de données persistants.
- `08-diagnostic/` : Outils d'analyse ponctuelle.

**Vérifications** :
- [ ] Y a-t-il des dossiers non numérotés ?
- [ ] Y a-t-il des scripts dans `04-utilities` qui devraient être dans `01-quality` ?
- [ ] Y a-t-il des dossiers vides ?

### 3. ♻️ Détection de Redondance

**Objectif** : Identifier les scripts qui font la même chose.

**Vérifications à effectuer (Exemples à adapter)** :
- **i18n** : Comparer `scripts/audit_i18n.sh`, `scripts/check-i18n`, `scripts/fix-i18n...`.
  - ➔ Garder UN seul script de check officiel (Tier 2/3).
  - ➔ Garder UN seul script de fix officiel.
  - ➔ Supprimer les scripts "batch", "complete-all", "final-fix".
- **Nettoyage** : Comparer les multiples scripts de "fix-titles", "fix-structure".

**Action** : Proposer la **SUPPRESSION** immédiate des doublons obsolètes.

### 4. 🏷️ Audit de Nommage et Extensions

**Standard** :
- Langage : **TypeScript** (`.ts`) privilégié.
- Exceptions : `.mjs` pour scripts Node purs sans transpileur, `.sh` pour glue code simple.
- Interdit : `.py` (Python) sauf justification forte (dépendance spécifique).
- Convention : `kebab-case` (ex: `run-daily-audit.ts` et non `runDailyAudit.ts`).

**Vérifications** :
- [ ] Lister les fichiers ne respectant pas `kebab-case`.
- [ ] Lister les fichiers `.js` qui devraient être `.ts`.
- [ ] Lister les scripts Python `.py` et questionner leur nécessité (peuvent-ils être portés en TS ?).

### 5. 📖 Synchro Inventaire

**Objectif** : `SCRIPT_INVENTORY.md` doit refléter la réalité.

**Vérifications** :
- [ ] Est-ce que tous les fichiers présents sur le disque sont listés dans `SCRIPT_INVENTORY.md` ?
- [ ] Est-ce que des fichiers listés dans l'inventaire ont disparu du disque ?

---

## 📝 Format du Rapport

### 1. 🚨 Alertes Rouges (Nettoyage Immédiat)
Liste des fichiers à la racine `scripts/` qui doivent être **SUPPRIMÉS** ou **DÉPLACÉS**.
*(Ex: `scripts/accelerated-completion-sales.mjs` -> DELETE)*

### 2. ⚠️ Doublons Identifiés
Groupes de scripts suspects qui semblent redondants. Indiquer le "Survivant" et les "Condamnés".
*(Ex: i18n fixing scripts)*

### 3. 📂 Recommandations de Structure
Propositions de déplacements pour respecter la numérotation.
*(Ex: `scripts/add-missing-nav-keys.ts` -> `scripts/02-generators/navigation/`)*

### 4. 🐍 Audit Langages
Liste des scripts non-TS à évaluer pour réécriture.

---

## 🔧 Commandes Utiles pour l'Audit

```bash
# Lister les fichiers racines (hors dossiers)
find scripts -maxdepth 1 -type f

# Lister les doublons potentiels (par nom)
find scripts -name "*i18n*"
find scripts -name "*fix*"

# Vérifier les extensions
find scripts -name "*.py"
find scripts -name "*.js"
```
