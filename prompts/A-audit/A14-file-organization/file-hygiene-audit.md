# A1 - File Organization & Cleanup Audit

## Mission

Auditer tous les fichiers récemment créés/modifiés dans le monorepo Numezis pour garantir :
1. **Consistance** : Les fichiers suivent les conventions établies
2. **Correction** : Les fichiers sont valides et respectent les standards
3. **Organisation** : Les fichiers sont classés au bon endroit selon leur nature
4. **Propreté** : Les fichiers temporaires/inutiles sont identifiés et supprimés

## Périmètre d'audit

### Fichiers à analyser
- Tous les fichiers créés/modifiés dans les **dernières 48h**
- Focus sur les fichiers non-code (`.md`, `.json`, `.txt`, rapports, etc.)
- Analyse des diffs Git pour comprendre l'intention

### Commandes de détection
```bash
# Fichiers récents (dernières 48h)
find . -type f -mtime -2 -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.turbo/*"

# Fichiers récents via Git (staged + unstaged)
git status --porcelain
git log --since="48 hours ago" --name-only --pretty=format: | sort -u

# Fichiers non-trackés
git ls-files --others --exclude-standard
```

---

## Règles de classification strictes

### ❌ INTERDIT AU ROOT (/)

**Pas de fichiers au niveau racine du monorepo**, sauf exceptions documentées ci-dessous.

#### Exceptions autorisées (STRICT)
- `package.json` : Workspace root
- `turbo.json` : Configuration Turborepo
- `.gitignore`, `.gitattributes` : Configuration Git
- `.env.example`, `.env.local` : Environnement (jamais `.env` committé)
- `README.md` : Description du projet
- `LICENSE` : Licence du projet
- `tsconfig.json`, `tsconfig.base.json` : Configuration TypeScript racine
- `.eslintrc.js`, `.prettierrc.js` : Configuration linting
- `.husky/` : Git hooks
- `.vscode/` : Configuration VS Code partagée

#### Fichiers ROOT INTERDITS (à déplacer ou supprimer)
- ❌ Rapports d'audit (`audit-*.md`, `report-*.json`, etc.)
- ❌ Fichiers de documentation générale (`docs.md`, `architecture.md`, etc.)
- ❌ Fichiers temporaires (`temp.md`, `tmp.txt`, `test.md`, etc.)
- ❌ Fichiers d'analyse statique (`analysis-*.json`, `results-*.csv`, etc.)
- ❌ Fichiers de notes personnelles (`notes.md`, `TODO.md`, etc.)
- ❌ Fichiers de prompts AI non versionnés (`prompt-*.md`)
- ❌ Fichiers de logs (`*.log`, `output.txt`, etc.)

**Action** : Ces fichiers doivent être :
- Déplacés vers `.agent/` si pertinents pour l'agent
- Déplacés vers `docs/` si documentation
- Supprimés si temporaires/obsolètes

---

### 📁 Règles de placement par type de fichier

#### 1. Documentation (`*.md`, `*.txt`)

| Type de doc | Emplacement autorisé | Interdit |
|-------------|---------------------|----------|
| Architecture, spécifications | `docs/01-architecture/`, `docs/02-development/`, etc. | Root, `.agent/`, `apps/`, `packages/` |
| Rapports d'audit monorepo | `.agent/audits/YYYY-MM-DD-*.md` | Root, `docs/`, `apps/` |
| Rapports de tests | `docs/05-infrastructure/testing/reports/` | Root, `.agent/` |
| Prompts et workflows agent | `.agent/prompts/`, `.agent/workflows/` | Root, `docs/` |
| README module/app | `apps/*/README.md`, `packages/*/README.md` | Root (sauf root workspace) |
| Notes temporaires | **SUPPRIMER** ou `.agent/scratch/` (non versionné) | Partout ailleurs |

**Règle absolue** :
- Un seul `README.md` par workspace (`apps/*`, `packages/*`)
- Pas de `docs/` local dans `apps/*` ou `packages/*` → tout va dans `docs/` racine
- Pas de fichiers `architecture.md`, `TODO.md`, `NOTES.md` versionnés hors `docs/`

#### 2. Rapports d'analyse & audits

| Type de rapport | Emplacement autorisé | Interdit |
|-----------------|---------------------|----------|
| Audit global monorepo | `.agent/audits/YYYY-MM-DD-{topic}.md` | Root, `docs/`, `apps/`, `packages/` |
| Rapport de qualité (CI) | `docs/05-infrastructure/quality/reports/` | Root, `.agent/audits/` |
| Rapport d'erreurs applicatives | Stocké en **base de données** (MongoDB), pas en fichiers | Fichiers locaux |
| Analyse de dépendances | `docs/05-infrastructure/dependencies/analysis/` | Root, `.agent/` |
| Benchmark/performance | `docs/05-infrastructure/performance/` | Root, `.agent/` |

**Règle absolue** :
- Pas de rapports au root
- Pas de rapports dans `apps/` ou `packages/`
- Les rapports automatiques (CI) vont dans `docs/05-infrastructure/`
- Les audits manuels vont dans `.agent/audits/` avec date ISO

#### 3. Fichiers de configuration

| Type de config | Emplacement autorisé | Interdit |
|----------------|---------------------|----------|
| Workspace config | Root (`package.json`, `turbo.json`, etc.) | `apps/`, `packages/` (sauf workspace locaux) |
| App-specific config | `apps/*/` uniquement | Root |
| Package-specific config | `packages/*/` uniquement | Root |
| Scripts utilitaires | `scripts/` (root), **jamais** dans `apps/` ou `packages/` | `apps/`, `packages/`, `.agent/` |

#### 4. Fichiers de données & assets

| Type de données | Emplacement autorisé | Interdit |
|-----------------|---------------------|----------|
| Fichiers JSON statiques (données) | `apps/*/data/`, `packages/*/data/` | Root, `.agent/`, `docs/` |
| Fichiers de traduction (i18n) | `packages/i18n/messages/` **UNIQUEMENT** | `apps/web/`, `apps/api/`, root |
| Images/assets publics | `apps/web/public/` | Root, `docs/`, `.agent/` |
| Fixtures de test | `apps/*/tests/fixtures/`, `packages/*/tests/fixtures/` | Root, `docs/` |

#### 5. Fichiers temporaires & générés

**TOUS INTERDITS EN VERSION** (doivent être dans `.gitignore`)

| Pattern | Action |
|---------|--------|
| `*.log` | Supprimer, ajouter à `.gitignore` |
| `temp-*.md`, `tmp-*.txt` | Supprimer |
| `output-*.json` | Supprimer ou déplacer vers `.agent/scratch/` (non versionné) |
| `audit-YYYY-MM-DD-*.md` | Déplacer vers `.agent/audits/` ou supprimer si obsolète |
| `analysis-*.csv` | Supprimer ou déplacer vers `docs/05-infrastructure/` si pertinent |
| `test-results-*.json` | Supprimer (CI uniquement) |
| `.DS_Store` | Supprimer, ajouter à `.gitignore` |
| `*.swp`, `*.swo` | Supprimer (fichiers vim) |

---

## Critères de validation par fichier

Pour chaque fichier détecté, appliquer cette grille d'évaluation :

### 1. Légitimité
- [ ] Le fichier a-t-il une raison d'exister dans le repo ?
- [ ] Est-il référencé/utilisé par le code ou la doc ?
- [ ] Est-il temporaire/unique à un moment T ?

**Si NON à toutes** → **SUPPRIMER**

### 2. Emplacement
- [ ] Le fichier est-il dans le bon dossier selon les règles ci-dessus ?
- [ ] Respecte-t-il la hiérarchie `docs/` ou `.agent/` ?
- [ ] Est-il au root alors qu'il ne devrait pas ?

**Si NON** → **DÉPLACER** vers le bon emplacement

### 3. Nommage
- [ ] Le nom suit-il la convention ISO 8601 pour les dates ? (`YYYY-MM-DD-topic.md`)
- [ ] Le nom est-il descriptif et explicite ?
- [ ] Le nom évite-t-il les préfixes temporaires ? (`temp-`, `old-`, `backup-`)

**Si NON** → **RENOMMER** selon les conventions

### 4. Cohérence
- [ ] Le contenu correspond-il au nom/emplacement ?
- [ ] Le format est-il correct (Markdown, JSON, etc.) ?
- [ ] Les références internes sont-elles valides ?

**Si NON** → **CORRIGER** ou **SUPPRIMER**

### 5. Duplication
- [ ] Un fichier similaire existe-t-il déjà ailleurs ?
- [ ] Le contenu est-il redondant avec la doc existante ?

**Si OUI** → **FUSIONNER** ou **SUPPRIMER**

---

## Workflow d'audit

### Phase 1 : Détection
1. Lister tous les fichiers récents (48h)
2. Filtrer par type (documentation, config, données, temporaires)
3. Exclure les fichiers de build/cache (`.next/`, `.turbo/`, `node_modules/`)

### Phase 2 : Analyse
Pour chaque fichier :
1. Lire le contenu et les métadonnées
2. Analyser le diff Git (si existant)
3. Identifier la catégorie (doc, audit, config, données, temporaire)
4. Appliquer les critères de validation (légitimité, emplacement, etc.)

### Phase 3 : Recommandations
Générer un rapport structuré :
```markdown
## Fichiers à SUPPRIMER (temporaires/obsolètes)
- [ ] /path/to/file1.md (raison : temporaire, créé pour debug)
- [ ] /path/to/file2.log (raison : fichier de log non versionné)

## Fichiers à DÉPLACER (mauvais emplacement)
- [ ] /audit-2026-01-19.md → /.agent/audits/2026-01-19-quality-check.md
- [ ] /apps/api/docs/architecture.md → /docs/01-architecture/api/overview.md

## Fichiers à RENOMMER (convention de nommage)
- [ ] /docs/audit.md → /docs/05-infrastructure/quality/reports/2026-01-19-audit.md

## Fichiers à FUSIONNER (duplication)
- [ ] /.agent/audits/2026-01-18-test.md + /.agent/audits/2026-01-19-test.md
  → fusionner dans un seul fichier daté du jour le plus récent

## Fichiers OK (bien placés et nécessaires)
- ✅ /docs/01-architecture/portal/portal-architecture.md
- ✅ /.agent/prompts/A-audit/A1-file-organization-audit.md
```

### Phase 4 : Exécution
1. Demander validation à l'utilisateur
2. Exécuter les actions approuvées (supprimer, déplacer, renommer)
3. Mettre à jour `.gitignore` si nécessaire
4. Créer un commit de nettoyage

---

## Règles spécifiques Numezis

### Docs (`docs/`)
- Suivre strictement la hiérarchie :
  - `01-architecture/` : Spécifications, décisions architecture
  - `02-development/` : Guides développement, conventions
  - `03-guides/` : Guides utilisateur, onboarding
  - `04-features/` : Documentation par feature/module
  - `05-infrastructure/` : CI/CD, qualité, déploiement
- Pas de fichiers orphelins (non référencés dans un index)
- Pas de duplication de contenu entre `docs/` et `.agent/`

### Agent (`.agent/`)
- `prompts/` : Prompts système pour l'agent (versionné)
- `workflows/` : Workflows réutilisables (versionné)
- `audits/` : Rapports d'audit manuels avec date ISO (versionné)
- `scratch/` : Fichiers temporaires (NON versionné, dans `.gitignore`)

### Apps & Packages (`apps/`, `packages/`)
- Pas de fichiers `docs/` locaux → tout va dans `docs/` racine
- Pas de rapports d'audit dans les workspaces
- Pas de fichiers de configuration globale (doivent être au root)
- `README.md` autorisé uniquement à la racine de chaque workspace

### Scripts (`scripts/`)
- Organisation stricte par tier (`quick-checks/`, `watch/`, `ci/`, `audit/`)
- Pas de scripts orphelins (non référencés dans `package.json`)
- Pas de scripts dans `apps/` ou `packages/` (sauf scripts build locaux)

---

## Interdictions absolues

**JAMAIS** accepter ces patterns :

1. ❌ Fichiers de documentation au root (sauf `README.md`)
2. ❌ Rapports d'audit dans `apps/` ou `packages/`
3. ❌ Fichiers temporaires versionnés (`temp-*`, `tmp-*`, `old-*`)
4. ❌ Fichiers de logs versionnés (`*.log`)
5. ❌ Fichiers de résultats de tests versionnés (CI uniquement)
6. ❌ Duplication de configuration (même config dans plusieurs endroits)
7. ❌ Fichiers sans extension ou extension incorrecte
8. ❌ Fichiers non-ASCII (sauf encodage UTF-8 valide)
9. ❌ Fichiers > 1 MB versionnés (doivent être dans `.gitignore` ou external storage)
10. ❌ Fichiers binaires non-assets (`.zip`, `.tar.gz`, `.exe`, etc.)

---

## Output attendu

Générer un rapport Markdown structuré :

```markdown
# Rapport d'audit - File Organization
Date : YYYY-MM-DD HH:MM
Périmètre : Fichiers modifiés dans les dernières 48h

## Résumé
- **Fichiers analysés** : X
- **Fichiers à supprimer** : Y
- **Fichiers à déplacer** : Z
- **Fichiers à renommer** : W
- **Fichiers OK** : K

## Détails

### 🗑️ Fichiers à SUPPRIMER (Y fichiers)
| Fichier | Raison | Taille | Dernière modif |
|---------|--------|--------|----------------|
| ... | ... | ... | ... |

### 📦 Fichiers à DÉPLACER (Z fichiers)
| Fichier actuel | Destination recommandée | Raison |
|----------------|------------------------|--------|
| ... | ... | ... |

### ✏️ Fichiers à RENOMMER (W fichiers)
| Fichier actuel | Nouveau nom | Raison |
|----------------|-------------|--------|
| ... | ... | ... |

### ✅ Fichiers OK (K fichiers)
| Fichier | Catégorie |
|---------|-----------|
| ... | ... |

## Actions Git recommandées

```bash
# Suppression
rm path/to/file1
rm path/to/file2

# Déplacement
git mv path/from path/to/destination

# Renommage
git mv old-name.md new-name.md

# Mise à jour .gitignore
echo "*.log" >> .gitignore
echo ".agent/scratch/" >> .gitignore

# Commit de nettoyage
git add .
git commit -m "chore: file organization cleanup - remove temp files, reorganize docs"
```

## Recommandations futures
- [ ] Ajouter pre-commit hook pour bloquer fichiers temporaires
- [ ] Documenter la hiérarchie `docs/` dans un `docs/README.md`
- [ ] Créer un script `scripts/ci/check-file-organization.sh` pour la CI
```

---

## Exemples de patterns à détecter

### Pattern 1 : Rapport d'audit au root
```bash
# Détecté
/audit-2026-01-19-quality.md

# Action
git mv /audit-2026-01-19-quality.md /.agent/audits/2026-01-19-quality.md
```

### Pattern 2 : Documentation locale dans app
```bash
# Détecté
/apps/api/docs/architecture.md

# Action
git mv /apps/api/docs/architecture.md /docs/01-architecture/api/overview.md
rm -rf /apps/api/docs/
```

### Pattern 3 : Fichier temporaire versionné
```bash
# Détecté
/temp-analysis.md
/output.log

# Action
rm /temp-analysis.md
rm /output.log
echo "temp-*.md" >> .gitignore
echo "*.log" >> .gitignore
```

### Pattern 4 : Duplication de config
```bash
# Détecté
/tsconfig.json
/apps/api/tsconfig.json (extends ../tsconfig.json)
/apps/web/tsconfig.json (extends ../tsconfig.json)

# Action : OK si extends, NON OK si duplication complète
# Vérifier que les configs locales étendent bien la racine
```

### Pattern 5 : Fichier sans date dans audit
```bash
# Détecté
/.agent/audits/quality-check.md

# Action
git mv /.agent/audits/quality-check.md /.agent/audits/2026-01-19-quality-check.md
```

---

## Intégration dans la qualité

Ce prompt doit être exécuté :
- **Manuellement** : Avant chaque PR majeure (migration, refactor)
- **Semi-automatiquement** : Via workflow `.agent/workflows/file-audit.md`
- **En CI** : Via script `scripts/ci/check-file-organization.sh` (à créer)

**Critère de succès** :
- 0 fichiers temporaires versionnés
- 0 fichiers au root hors whitelist
- 0 rapports d'audit dans `apps/` ou `packages/`
- 0 duplication de documentation
- 100% des fichiers dans la bonne catégorie
