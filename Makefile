.PHONY: quickstart dev seed down infra help

help:
	@echo "Kletron — common targets"
	@echo "  make quickstart  Start Mongo, install deps, seed demo user/workspace, run dev stack"
	@echo "  make infra       docker compose up -d mongo only"
	@echo "  make seed        npm run seed:demo"
	@echo "  make dev         npm run dev"
	@echo "  make down        docker compose down"

infra:
	docker compose up -d mongo

seed:
	npm run seed:demo

dev:
	npm run dev

down:
	docker compose down

quickstart: infra
	npm install
	npm run seed:demo
	npm run dev
