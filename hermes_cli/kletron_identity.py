"""Kletron product identity (Python side): the desktop application id.

Kletron is a distribution of Hermes Agent by Nous Research (MIT, see LICENSE / NOTICE).
Module names, ``HERMES_*`` variables, ``~/.hermes`` paths and the ``hermes`` command are deliberately
unchanged; ``kletron`` is an alias entry point. Displayed strings ("Hermes" -> "Kletron") are NOT
patched: they are rewritten at build time in a throw-away copy of the tree (kletron/build/rebrand,
VSCodium/Cursor model, docs/06-STRATEGIE-FORK-AMONT.md).
"""

# Must equal apps/desktop/product-identity.cjs appId (upstream test_linux_desktop_entry checks it).
APP_ID = "ch.numezis.kletron"
