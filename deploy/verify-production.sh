#!/usr/bin/env bash
set -Eeuo pipefail

set -a
source /etc/dealflow360-team-711.env
set +a
cookie_jar="$(mktemp)"
trap 'rm -f "$cookie_jar"' EXIT

payload="$(printf '{"email":"hiten@dealflow360.demo","password":"%s"}' "$DEMO_ADMIN_PASSWORD")"
login="$(curl --fail --silent --show-error -c "$cookie_jar" -H "Origin: $APP_ORIGIN" -H 'Content-Type: application/json' --data "$payload" http://127.0.0.1:4174/api/auth/login)"
csrf="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).csrfToken)' "$login")"
bootstrap="$(curl --fail --silent --show-error -b "$cookie_jar" -H "Origin: $APP_ORIGIN" http://127.0.0.1:4174/api/bootstrap)"
node -e 'const data=JSON.parse(process.argv[1]); if(!Array.isArray(data.data.catalog)||data.data.catalog.length<1||!Array.isArray(data.data.teams)||data.data.teams.length<1) process.exit(1)' "$bootstrap"
curl --fail --silent --show-error -b "$cookie_jar" -H "Origin: $APP_ORIGIN" -H "X-CSRF-Token: $csrf" -X POST http://127.0.0.1:4174/api/auth/logout >/dev/null
printf 'Production authentication and bootstrap verified.\n'
