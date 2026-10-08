#!/usr/bin/env bash
# Build for single-service hosting (Render etc.): frontend -> backend, then migrate/seed/owner.
set -euo pipefail
cd "$(dirname "$0")"

pip install -r backend/requirements.txt

( cd frontend && npm ci && npm run build )
rm -rf backend/frontend_dist && cp -r frontend/dist backend/frontend_dist

cd backend
export DJANGO_SETTINGS_MODULE=config.settings.prod
python manage.py collectstatic --noinput
python manage.py migrate --noinput
python manage.py seed
python manage.py ensure_owner
