# Pointz Server

Lightweight recommendation API for choosing the best credit card by purchase category. Written in **Rust** (Axum + SQLx + Tokio).

## Requirements

- Rust 1.83+ (via `rustup`)
- PostgreSQL 14+ (or use the included Docker compose)
- Docker, optional for containerized runs

## Local Development

```sh
# 1. Start Postgres
docker compose up -d postgres

# 2. Set env vars
export DATABASE_URL='postgres://pointz:pointz@127.0.0.1:5432/pointz'
export JWT_SECRET='dev-secret-change-me-in-production-please'

# 3. Initialise schema + seed catalog
cargo run --bin migrate
cargo run --bin seed

# 4. Run the server
cargo run --bin pointz-server
```

The API starts on `http://localhost:3000`.

## Required environment variables

| Var | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. |
| `JWT_SECRET` | yes | Long random string used to sign auth tokens (>= 16 chars). |
| `PORT` | no | Defaults to `3000`. |
| `HOST` | no | Defaults to `0.0.0.0`. |
| `CORS_ORIGINS` | no | Comma-separated allow-list. Defaults to mirror request origin. |
| `PGSSL` | no | Set to `true` to force `sslmode=require`. Auto-enabled for `*.rds.amazonaws.com`. |
| `RUST_LOG` | no | Defaults to `info`. |

## Docker

```sh
docker compose up --build
```

Multi-stage Rust build produces a small Debian-slim runtime image with four binaries (`pointz-server`, `pointz-migrate`, `pointz-seed`, `pointz-sync-cards`).

## Binaries

```sh
cargo run --bin pointz-server    # the HTTP server
cargo run --bin migrate          # idempotent schema setup
cargo run --bin seed             # load db/init.sql (cards + rules)
cargo run --bin sync-cards       # upsert from db/cards-dataset.json
cargo run --bin sync-cards -- --prune   # also delete missing cards
```

## Endpoints

All under `/api`, except `/health`.

| Method | Path | Description |
| --- | --- | --- |
| GET | /health | Liveness check |
| GET | /api/cards | Card catalog |
| GET | /api/categories | Reward categories |
| GET | /api/location | IP-based geolocation (X-Forwarded-For respected) |
| POST | /api/recommend | Best card for `{ownedCardIds, category, amount?}` |
| POST | /api/recommend-by-location | Same, but derives category from `{lat,lng}` via Overpass |
| POST | /api/auth/signup | `{email,password}` → `{token,user}` |
| POST | /api/auth/login | Same |
| GET | /api/auth/me | Current user (Bearer JWT) |
| GET | /api/me/owned-cards | List user's owned cards |
| PUT | /api/me/owned-cards | Replace the set: `{cardIds: [...]}` |
| POST | /api/me/owned-cards/:cardId | Add one |
| DELETE | /api/me/owned-cards/:cardId | Remove one |
| PATCH | /api/me/preferences | Partial preferences update (strict; rejects unknown keys) |

### POST /api/recommend example

```sh
curl -X POST http://localhost:3000/api/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "ownedCardIds": ["chase-sapphire-preferred","amex-gold","citi-double-cash"],
    "category": "dining",
    "amount": 42.5
  }'
```

## Card catalog data

The card catalog (`cards` + `reward_rules` tables) is sourced from
`db/cards-dataset.json`. The sync binary loads it from (in order):

1. `CARDS_DATA_URL` env var (http(s) JSON)
2. `CARDS_DATA_FILE` env var (path)
3. `<cwd>/db/cards-dataset.json` (default)

```sh
cargo run --bin sync-cards
CARDS_DATA_URL=https://example.com/cards.json cargo run --bin sync-cards
cargo run --bin sync-cards -- --prune
```

The sync runs in a single transaction, upserts cards & rules, deletes
upstream-removed rules, and (with `--prune`) deletes unknown cards.

### Weekly refresh

GitHub Action example:

```yaml
on:
  schedule: [{ cron: "15 3 * * 0" }]
  workflow_dispatch:
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo run --release --bin sync-cards
        working-directory: server
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          PGSSL: "true"
```
