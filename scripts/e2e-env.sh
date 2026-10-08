#!/usr/bin/env bash
# Start backend (throwaway DB) + frontend dev server for Playwright. Usage: scripts/e2e-env.sh start|stop
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="${TMPDIR:-/tmp}/ftd-notebook-e2e"
mkdir -p "$RUN"
case "$1" in
start)
  rm -f "$RUN/db.sqlite3"
  export DATABASE_URL="sqlite:///$RUN/db.sqlite3" MEDIA_ROOT="$RUN/media"
  ( cd "$ROOT/backend" && "$ROOT/.venv/bin/python" manage.py migrate -v0 && "$ROOT/.venv/bin/python" manage.py seed >/dev/null \
    && "$ROOT/.venv/bin/python" manage.py shell -c "from django.contrib.auth import get_user_model as g; g().objects.create_superuser('owner','o@x.io','pw-12345-long')" >/dev/null 2>&1 )
  ( cd "$ROOT/backend" && setsid "$ROOT/.venv/bin/python" manage.py runserver 8000 --noreload >"$RUN/dj.log" 2>&1 & echo $! >"$RUN/dj.pid" )
  ( cd "$ROOT/frontend" && setsid npx vite --port 5173 >"$RUN/vite.log" 2>&1 & echo $! >"$RUN/vite.pid" )
  for i in $(seq 1 40); do curl -sf localhost:5173/api/v1/settings/ >/dev/null && break; sleep 0.5; done
  ;;
stop)
  pkill -f "manage.py runserver 8000 --noreload" || true
  pkill -f "vite --port 5173" || true
  rm -f "$RUN"/*.pid
  sleep 1
  ;;
esac
