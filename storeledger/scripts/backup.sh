#!/usr/bin/env sh
set -eu

project_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
backup_dir="$project_dir/backups"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$backup_dir"
cd "$project_dir"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$backup_dir/storeledger-$timestamp.dump"
find "$backup_dir" -type f -name 'storeledger-*.dump' -mtime +30 -delete

echo "Backup created: $backup_dir/storeledger-$timestamp.dump"

