# Managed Scope — Linux v1

Upstream Managed Scope directory on Linux: `/etc/hermes` (unchanged internal name).
Override: `HERMES_MANAGED_DIR=/path` (IT bootstrap only; never persisted to user `.env`).

## Install (root)

```bash
sudo mkdir -p /etc/hermes
sudo cp config.yaml /etc/hermes/config.yaml
sudo chmod 0644 /etc/hermes/config.yaml
# Optional: root:root ownership so non-root users cannot edit policy.
sudo chown root:root /etc/hermes /etc/hermes/config.yaml
```

macOS / Windows native paths are added by patch **0003** (`kletron_managed.py`):
- macOS: `/Library/Application Support/Kletron/managed`
- Windows: `%ProgramData%\Kletron\managed`

## Notes

- Managed Scope v1 is filesystem-permission based ("advisory" if the user can write the dir).
- Remote config mode ignores managed `config.yaml` (locks come from the remote plan); managed `.env` still applies.
- Hard enforcement for tools = MCP gateway + OpenShell (not the agent hook alone).
