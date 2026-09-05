#!/usr/bin/env bash
set -Eeuo pipefail

set -a
source /etc/dealflow360-team-711.env
set +a
cookie_jar="$(mktemp)"
pdf_file="$(mktemp)"
xls_file="$(mktemp)"
trap 'rm -f "$cookie_jar" "$pdf_file" "$xls_file"' EXIT

payload="$(printf '{"email":"hiten@dealflow360.demo","password":"%s"}' "$DEMO_ADMIN_PASSWORD")"
login="$(curl --fail --silent --show-error -c "$cookie_jar" -H "Origin: $APP_ORIGIN" -H 'Content-Type: application/json' --data "$payload" http://127.0.0.1:4174/api/auth/login)"
csrf="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).csrfToken)' "$login")"
bootstrap="$(curl --fail --silent --show-error -b "$cookie_jar" -H "Origin: $APP_ORIGIN" http://127.0.0.1:4174/api/bootstrap)"
node -e 'const {data}=JSON.parse(process.argv[1]); const minimum={catalog:16,customers:24,quotes:42,subscriptions:14,invoices:24,alerts:30,notifications:32,teams:1}; for(const [key,count] of Object.entries(minimum)) if(!Array.isArray(data[key])||data[key].length<count){console.error(`${key}: expected at least ${count}, received ${data[key]?.length ?? 0}`);process.exit(1)}' "$bootstrap"
curl --fail --silent --show-error -b "$cookie_jar" -H "Origin: $APP_ORIGIN" -o "$pdf_file" http://127.0.0.1:4174/api/reports/deals.pdf
curl --fail --silent --show-error -b "$cookie_jar" -H "Origin: $APP_ORIGIN" -o "$xls_file" http://127.0.0.1:4174/api/reports/deals.xls
test "$(head -c 4 "$pdf_file")" = '%PDF'
grep -q '<Workbook' "$xls_file"
curl --fail --silent --show-error -b "$cookie_jar" -H "Origin: $APP_ORIGIN" -H "X-CSRF-Token: $csrf" -X POST http://127.0.0.1:4174/api/auth/logout >/dev/null
printf 'Production authentication, bootstrap, PDF, and XLS verified.\n'
