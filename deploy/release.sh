#!/usr/bin/env bash
set -Eeuo pipefail

app_root=/srv/apps/dealflow360-team-711
archive=/tmp/dealflow360-update.tar.gz
service=dealflow360-team-711.service
database_container=dealflow360-postgres
database_name=dealflow360
database_user=dealflow360
release_id="$(date +%Y%m%d%H%M%S)"
release_dir="$app_root/releases/$release_id"
backup_dir="$app_root/backups"
previous_release="$(readlink -f "$app_root/current")"

test -f "$archive"
test -n "$previous_release"
mkdir -p "$release_dir" "$backup_dir"
docker exec "$database_container" pg_dump -U "$database_user" -d "$database_name" -Fc > "$backup_dir/$release_id.dump"
tar -xzf "$archive" -C "$release_dir"
cd "$release_dir"
npm ci --omit=dev
python3 -m venv .venv
.venv/bin/python -m pip install --disable-pip-version-check --no-cache-dir -r requirements-reporting.txt

set -a
source /etc/dealflow360-team-711.env
set +a
export RELEASE_ID="$release_id"
npm run db:migrate
if [[ "${SEED_DEMO:-false}" == "true" ]]; then npm run db:seed; fi

ln -sfn "$release_dir" "$app_root/current"
if ! systemctl restart "$service" || ! curl --fail --silent --show-error --retry 8 --retry-delay 2 --retry-connrefused http://127.0.0.1:4174/api/health >/dev/null; then
  ln -sfn "$previous_release" "$app_root/current"
  systemctl stop "$service" || true
  docker exec "$database_container" psql -v ON_ERROR_STOP=1 -U "$database_user" -d "$database_name" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public AUTHORIZATION $database_user;"
  docker exec -i "$database_container" pg_restore --exit-on-error -U "$database_user" -d "$database_name" < "$backup_dir/$release_id.dump"
  systemctl restart "$service" || true
  exit 1
fi

printf 'Released %s\n' "$release_id"
