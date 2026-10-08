PY ?= .venv/bin/python
.PHONY: setup dev test seed migrate superuser lint backup

setup:
	python3 -m venv .venv
	.venv/bin/pip install -e "backend[dev]"

migrate:
	cd backend && ../$(PY) manage.py migrate

seed: migrate
	cd backend && ../$(PY) manage.py seed

superuser:
	cd backend && ../$(PY) manage.py createsuperuser

dev: migrate
	cd backend && ../$(PY) manage.py runserver

test:
	cd backend && ../$(PY) -m pytest -q

lint:
	cd backend && ../.venv/bin/ruff check . && ../.venv/bin/ruff format --check .

backup:
	cd backend && ../$(PY) manage.py dumpdata --indent 2 -o ../backups/export-$$(date +%F).json
