#!/bin/bash
set -euo pipefail

SECRETS_DIR="$(dirname "$0")/../server/secrets"

# Create secrets directory if it doesn't exist
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

echo "Created secrets directory: $SECRETS_DIR (chmod 700)"

# Write TON_HOT_WALLET_MNEMONIC if provided via environment
if [ -n "${TON_HOT_WALLET_MNEMONIC:-}" ]; then
  printf '%s' "$TON_HOT_WALLET_MNEMONIC" > "$SECRETS_DIR/TON_HOT_WALLET_MNEMONIC"
  chmod 600 "$SECRETS_DIR/TON_HOT_WALLET_MNEMONIC"
  echo "Written: $SECRETS_DIR/TON_HOT_WALLET_MNEMONIC (chmod 600)"
else
  echo "TON_HOT_WALLET_MNEMONIC not set — skipping mnemonic file creation."
  echo "To write it, run:"
  echo "  TON_HOT_WALLET_MNEMONIC='word1 word2 ...' bash scripts/setup-secrets.sh"
fi

echo ""
echo "Next steps:"
echo "  1. Verify server/secrets/ is listed in .gitignore (NEVER commit secrets)."
echo "  2. Set the secrets as environment variables in your server/.env or PM2 config."
echo "  3. Restrict file access on your server: only the process user should read secrets."
echo ""

# Remind about .gitignore
GITIGNORE="$(dirname "$0")/../.gitignore"
if [ -f "$GITIGNORE" ]; then
  if ! grep -q 'server/secrets/' "$GITIGNORE"; then
    echo "WARNING: 'server/secrets/' is NOT in .gitignore — add it immediately!"
  else
    echo "OK: 'server/secrets/' is already in .gitignore."
  fi
else
  echo "WARNING: No .gitignore found at project root. Create one and add 'server/secrets/'."
fi
