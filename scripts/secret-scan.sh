#!/usr/bin/env bash
# Blocks PII and secrets from entering the repo. Runs as a pre-commit hook
# (against staged files) and in CI (against the whole tree). This repo is the
# system, never the data — see CLAUDE.md non-negotiable #2.
set -euo pipefail

if [ "${1:-}" = "--staged" ]; then
  mapfile -t files < <(git diff --cached --name-only --diff-filter=ACM)
  scope="staged files"
else
  mapfile -t files < <(git ls-files)
  scope="tracked files"
fi

if [ "${#files[@]}" -eq 0 ]; then
  echo "secret-scan: no $scope to scan."
  exit 0
fi

fail=0

# 1. Blocked paths: bill PDFs, any /data/ tree, real .env files.
for f in "${files[@]}"; do
  case "$f" in
    *.pdf)
      echo "BLOCKED: $f — PDFs (potential bills) must never be committed." ; fail=1 ;;
    data/*|*/data/*)
      echo "BLOCKED: $f — files under data/ must never be committed." ; fail=1 ;;
    .env|.env.*)
      if [ "$f" != ".env.example" ]; then
        echo "BLOCKED: $f — .env files must never be committed (use .env.example)." ; fail=1
      fi ;;
  esac
done

# 2. Content patterns. Only scan existing regular files; skip this script and
#    the fixture disclaimer that intentionally shows a redacted placeholder.
# Account-number-like: "account"/"acct" followed shortly by a NNNN-NNN-NNN
# grouping. Case-insensitive (bills say "Account Number").
account_re='(account|acct)[^0-9]{0,15}[0-9]{4}[- ]?[0-9]{3}[- ]?[0-9]{3}'

# Secret VALUES, not variable names — so documenting `SUPABASE_ANON_KEY` in
# .env.example or docs is fine, but a pasted real key is caught:
#   - GitHub tokens (ghp_/gho_/ghs_/ghr_ + 20+ chars)
#   - JWTs (Supabase anon/service keys, many bearer tokens: eyJ....….…)
#   - PEM private key blocks
secret_re='(gh[porsu]_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)'

for f in "${files[@]}"; do
  [ -f "$f" ] || continue
  case "$f" in
    scripts/secret-scan.sh|*/fixtures/*) continue ;;
  esac
  if grep -RInEqi "$account_re" "$f"; then
    echo "BLOCKED: $f — matches an account-number-like pattern." ; fail=1
  fi
  if grep -RInEq "$secret_re" "$f"; then
    echo "BLOCKED: $f — matches a credential/secret pattern." ; fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "secret-scan FAILED. Nothing committed. If this is a false positive on a"
  echo "synthetic fixture, place it under a fixtures/ directory or redact it."
  exit 1
fi

echo "secret-scan: clean ($scope)."
