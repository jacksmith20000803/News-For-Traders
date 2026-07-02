#!/bin/sh
set -eu

APP_DATABASE_URL="${DATABASE_URL:-}"
MIGRATE_DATABASE_URL="${DIRECT_DATABASE_URL:-${DATABASE_URL:-}}"

if [ -z "$APP_DATABASE_URL" ]; then
  echo "DATABASE_URL is required."
  exit 1
fi

if [ -z "${DIRECT_DATABASE_URL:-}" ]; then
  DERIVED_DIRECT_URL="$(node -e '
const raw = process.env.DATABASE_URL || "";
try {
  const url = new URL(raw);
  if (url.hostname.includes("-pooler")) {
    url.hostname = url.hostname.replace("-pooler.", ".").replace("-pooler", "");
    console.log(url.toString());
  }
} catch {
  process.exit(0);
}
' || true)"
  if [ -n "$DERIVED_DIRECT_URL" ]; then
    MIGRATE_DATABASE_URL="$DERIVED_DIRECT_URL"
    echo "DIRECT_DATABASE_URL is not set; derived a Neon direct host for migrations."
  fi
fi

if [ "$MIGRATE_DATABASE_URL" != "$APP_DATABASE_URL" ]; then
  echo "Running Prisma migrations with the direct database URL."
else
  echo "Running Prisma migrations with DATABASE_URL. For Neon, set DIRECT_DATABASE_URL to the unpooled connection string."
fi

attempt=1
max_attempts=6
while [ "$attempt" -le "$max_attempts" ]; do
  echo "Prisma migrate deploy attempt $attempt/$max_attempts..."
  if PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1 DATABASE_URL="$MIGRATE_DATABASE_URL" ./node_modules/.bin/prisma migrate deploy; then
    echo "Prisma migrations completed."
    break
  fi

  if [ "$attempt" -eq "$max_attempts" ]; then
    echo "Prisma migrations failed after $max_attempts attempts."
    exit 1
  fi

  sleep_seconds=$((attempt * 10))
  echo "Migration failed. Retrying in ${sleep_seconds}s..."
  sleep "$sleep_seconds"
  attempt=$((attempt + 1))
done

export DATABASE_URL="$APP_DATABASE_URL"
exec node server.js
