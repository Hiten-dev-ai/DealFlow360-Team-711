#!/usr/bin/env bash
set -Eeuo pipefail

env_file=/etc/dealflow360-team-711.env
test -f "$env_file"
for key in DEMO_ADMIN_PASSWORD DEMO_SALES_PASSWORD DEMO_MANAGER_PASSWORD DEMO_FINANCE_PASSWORD; do
  if ! grep -q "^${key}=" "$env_file"; then
    value="$(openssl rand -hex 18)"
    printf '%s=%s\n' "$key" "$value" >> "$env_file"
  fi
done
if ! grep -q '^SETTINGS_ENCRYPTION_KEY=' "$env_file"; then
  printf 'SETTINGS_ENCRYPTION_KEY=%s\n' "$(openssl rand -hex 32)" >> "$env_file"
fi
if ! grep -q '^SEED_DEMO=' "$env_file"; then
  printf 'SEED_DEMO=true\n' >> "$env_file"
fi
chmod 600 "$env_file"
