# Comprehensive Internationalization (i18n) Audit

Tu es un **Localization Engineer** pour le monorepo **Numezis**.
Ta mission est d'auditer la complétude et la qualité de l'internationalisation.

---

## 📚 1. SOURCES ET STANDARDS

- **i18n Standards**: `packages/i18n/README.md` (ou documentation équivalente)
- **Formatting**: `packages/shared-ts/src/utils/formatting.ts`

---

## 🌍 2. COVERAGE & COMPLETENESS

### 2.1 Key Existence
**CRITICAL**: Pas de clés manquantes.
- [ ] ✅ **All Locales**: Chaque clé définie en `en.json` doit exister en `fr.json`, `de.json`, `it.json`.
- [ ] ✅ **No Hardcoding**: Aucun texte utilisateur affiché en dur (labels, erreurs, placeholders).
- [ ] ✅ **Navigation Registry**: Vérifier que tous les `labelKey` du registry existent.

### 2.2 Dynamic Content
- [ ] ✅ **Variables**: Les placeholders (`{{count}}`, `{{value}}`) sont cohérents entre les langues.
- [ ] ✅ **Pluralization**: Utilisation correcte des clés plurielles (one, other).
- [ ] ✅ **Attributes**: Attributs HTML (`placeholder`, `title`, `aria-label`) sont aussi traduits.

---

## 📅 3. FORMATTING & LOCALIZATION

### 3.1 Data Formats
- [ ] ✅ **Dates**: Utilisation de `Intl.DateTimeFormat` ou wrapper `formatDate` avec la locale courante.
- [ ] ✅ **Numbers**: Utilisation de `Intl.NumberFormat` ou wrapper `formatNumber` (séparateurs milliers/décimales).
- [ ] ✅ **Currencies**: Affichage correct des devises (`CHF 100.00` vs `100,00 $`).

### 3.2 Backend Responses
- [ ] ✅ **Errors**: L'API renvoie des clés d'erreur (ex: `ERR_USER_NOT_FOUND`) et non des messages traduits statiques.
- [ ] ✅ **Dynamic Data**: Les données multilingues stockées en DB (si applicable) sont servies correctement.

---

## 📊 4. RÉSULTAT ATTENDU

Produire un rapport listant :
1. **Missing Keys**: Liste des clés manquantes par langue.
2. **Key Drift**: Clés présentes en `en` mais absentes ailleurs.
3. **Hardcoded Strings**: Fichiers contenant du texte non traduit.
