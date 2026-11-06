#!/bin/sh
# Apply database migrations, then start the server (or whatever command was given).
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying database migrations..."
  (cd src/farma_bridge && alembic upgrade head)
fi

exec "$@"
