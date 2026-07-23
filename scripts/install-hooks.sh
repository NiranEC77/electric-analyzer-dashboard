#!/usr/bin/env bash
# Installs the local pre-commit hook. Run once after cloning:
#   bash scripts/install-hooks.sh
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
hook_path="$repo_root/.git/hooks/pre-commit"

cat > "$hook_path" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
bash "$(git rev-parse --show-toplevel)/scripts/secret-scan.sh" --staged
HOOK

chmod +x "$hook_path"
echo "Installed pre-commit hook -> $hook_path"
