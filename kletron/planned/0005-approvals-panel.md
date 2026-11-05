# 0005 — Panneau de validations (**IMPLÉMENTÉ sans patch cœur** 2026-11-05)

## Route retenue : plugin Desktop (overlay)
- Bundled : `apps/desktop/src/plugins/kletron-validations/` (découverte auto `contrib/plugins.ts`).
- Inclus dans l'OVERLAY de `apply-patches.sh` (pas dans la series de patchs).
- UI : route `/validations`, nav latérale, chip status bar, page Settings « Kletron policy ».
- Branche sur `sessionApprovalRequests` / `answerApproval` (store existant).

## Sémantique d'échec (inchangée, tests `kletron/tests/py/test_governance_hooks.py`)
Le validateur Python `pre_tool_call` qui lève/timeout → fail-closed ; pipeline cassé ou plugin absent → fail-open.
Barrière réelle = passerelle MCP + OpenShell (K6/K13), pas ce panneau seul.
