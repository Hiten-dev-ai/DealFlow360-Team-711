#!/usr/bin/env bash
set -Eeuo pipefail

test_db=dealflow360_backend_verify_711
work_dir=/tmp/dealflow360-backend-verify-711
archive=/tmp/dealflow360-verify.tar.gz
container=dealflow360-postgres

case "$test_db:$work_dir" in
  dealflow360_backend_verify_*:/tmp/dealflow360-backend-verify-*) ;;
  *) exit 90 ;;
esac

cleanup() {
  docker exec "$container" dropdb -U dealflow360 --if-exists "$test_db" >/dev/null 2>&1 || true
  rm -rf -- "$work_dir"
}
trap cleanup EXIT

cleanup
mkdir -p "$work_dir"
tar -xzf "$archive" -C "$work_dir"
cd "$work_dir"
npm ci
docker exec "$container" createdb -U dealflow360 "$test_db"

set -a
source /etc/dealflow360-team-711.env
set +a
verify_url="${DATABASE_URL%/*}/$test_db"
export DATABASE_URL="$verify_url"
export TEST_DATABASE_URL="$verify_url"
export APP_ORIGIN=http://127.0.0.1:4199
export DEMO_ADMIN_PASSWORD='Verify-Admin-711!'
export DEMO_SALES_PASSWORD='Verify-Sales-711!'
export DEMO_MANAGER_PASSWORD='Verify-Manager-711!'
export DEMO_FINANCE_PASSWORD='Verify-Finance-711!'

npm run db:migrate
npm run db:seed
npx vitest run server/postgres-integration.test.js
