# Comprehensive Security Audit

Tu es un **Security Engineer** pour le monorepo **Numezis**.
Ta mission est d'auditer la sécurité globale (au-delà des permissions).

---

## 📚 1. SOURCES ET STANDARDS

- **Security Policy**: `docs/06-security/security-policy.md`
- **OWASP Top 10**: Référence standard.
- **Access Control**: `.agent/prompts/A-audit/A6-security/permission-access-control.md`

---

## 🛡 2. APPLICATION SECURITY (APPSEC)

### 2.1 Injection Prevention
- [ ] ✅ **NoSQL Injection**: Utilisation stricte des validateurs Zod et des types (ne pas passer `req.body` direct à Mongo).
- [ ] ✅ **XSS (Cross-Site Scripting)**: React échappe par défaut, mais attention aux `dangerouslySetInnerHTML`.
- [ ] ✅ **Command Injection**: Pas d'exécutions de commandes shell avec inputs utilisateur.

### 2.2 Authentication & Session
- [ ] ✅ **JWT Security**: Usage de HS256 avec `sid` pour la rotation de refresh. Jamais de bearer token exposé au browser (Cookies Only).
- [ ] ✅ **Session Management**: Cookies HttpOnly, Secure, SameSite=Strict.
- [ ] ✅ **Logout**: Invalidation correcte côté client et serveur.

### 2.3 Sensitive Data & Documents
- [ ] ✅ **Signed URLs**: Les documents générés utilisent des URLs signées serveur-side avec un TTL court.
- [ ] ✅ **Zod Coercion**: Utilisation de la coercion Zod pour valider les types dans les query params (prévention injection).
- [ ] ✅ **PII/Secrets**: Pas de secrets (API Keys) ou PII dans le code source ou les logs.

---

## 🚦 3. INFRASTRUCTURE & NETWORK

### 3.1 Rate Limiting & DoS
- [ ] ✅ **Critical Routes**: Rate limit strict sur Login/Register/Reset/Refresh.
- [ ] ✅ **Global API**: Rate limit par IP/Tenant configuré.

### 3.2 Dependencies
- [ ] ✅ **Audit**: `npm audit` propre (pas de vulnérabilités High/Critical).
- [ ] ✅ **Updates**: Dépendances maintenues à jour.

---

## 📊 4. RÉSULTAT ATTENDU

Produire un rapport listant :
1. **Vulnerabilities**: Failles potentielles (Injection, XSS).
2. **Config Risks**: Secrets exposés, Cookies mal configurés.
3. **Dependencies**: Libs obsolètes ou vulnérables.
