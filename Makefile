.PHONY: dev build test local-setup

dev:
	docker-compose up

build:
	docker-compose build

test:
	cd server && uv run --extra dev pytest

local-setup:
	cd client && npm install
	cd server && uv venv .venv && uv sync --extra dev
