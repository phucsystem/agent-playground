.PHONY: dev dev-up dev-down dev-logs prod prod-up prod-down prod-logs build install clean

# --- Development ---
dev:
	pnpm dev

dev-up:
	docker compose --profile dev up -d

dev-down:
	docker compose --profile dev down

dev-logs:
	docker compose --profile dev logs -f

dev-build:
	docker compose --profile dev build

# --- Production ---
prod-up:
	docker compose --profile prod up -d

prod-down:
	docker compose --profile prod down

prod-logs:
	docker compose --profile prod logs -f

prod-build:
	docker compose --profile prod build

# --- General ---
install:
	pnpm install

build:
	pnpm build

lint:
	pnpm lint

clean:
	rm -rf .next node_modules

# --- Docker ---
docker-clean:
	docker compose --profile dev --profile prod down --rmi local -v

# --- Database ---
db-migrate:
	supabase db push

db-seed:
	supabase db seed

db-reset:
	supabase db reset
