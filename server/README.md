# Pointz Server

Lightweight V1 recommendation API for choosing the best credit card by purchase category. User card selections are not stored by the backend; clients send selected card IDs with each recommendation request.

## Requirements

- Node.js 22+
- PostgreSQL 14+ (or use the included Docker compose)
- Docker, optional for containerized runs

## Local Development

Set environment variables (copy `.env.example` to `.env` and edit), then bootstrap the database. The base catalog is seeded from `db/init.sql`; the application tables (including `users` and `user_owned_cards`) are managed by Drizzle migrations.

```sh
createdb pointz
psql pointz -f db/init.sql              # seeds the card catalog
cp .env.example .env                    # set DATABASE_URL and JWT_SECRET
npm install
npm run db:migrate                      # creates users + user_owned_cards
npm run dev
```

The API starts on `http://localhost:3000`.

## Required environment variables

| Var | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. |
| `JWT_SECRET` | yes | Long random string used to sign auth tokens (>= 16 chars). |
| `PORT` | no | Defaults to `3000`. |
| `HOST` | no | Defaults to `0.0.0.0`. |
| `CORS_ORIGINS` | no | Comma-separated allow-list. Defaults to allow-all. |

## Docker

```sh
docker compose up --build
```

This starts Postgres and the API. The seed in `db/init.sql` is loaded only on a
fresh Postgres volume; remove `postgres_data` to re-seed.

## Scripts

```sh
npm run dev
npm run build
npm start
npm run typecheck
npm run db:generate     # generate a new migration from src/lib/schema.ts
npm run db:migrate      # apply pending migrations from db/migrations
npm run db:sync         # upsert card catalog from db/cards-dataset.json
npm run db:studio       # open Drizzle Studio
```

## Endpoints

### GET /health

Returns service status.

### GET /cards

Returns the supported card catalog.

```sh
curl http://localhost:3000/cards
```

### GET /categories

Returns supported purchase categories.

```sh
curl http://localhost:3000/categories
```

### POST /recommend

Returns the best card, plain-English reason, and fallback rankings.

```sh
curl -X POST http://localhost:3000/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "ownedCardIds": ["chase-sapphire-preferred", "amex-gold", "citi-double-cash"],
    "category": "dining",
    "amount": 42.5
  }'
```

Example response:

```json
{
  "bestCard": {
    "id": "amex-gold",
    "name": "American Express Gold Card",
    "issuer": "American Express",
    "rewardRate": 4,
    "rewardType": "points",
    "estimatedRewards": 170,
    "matchedCategory": "dining",
    "notes": "4x at restaurants worldwide."
  },
  "alternatives": [
    {
      "id": "chase-sapphire-preferred",
      "name": "Chase Sapphire Preferred",
      "issuer": "Chase",
      "rewardRate": 3,
      "rewardType": "points",
      "estimatedRewards": 127.5,
      "matchedCategory": "dining"
    }
  ],
  "reason": "American Express Gold Card earns 4x points on dining, which is higher than your other selected cards."
}
```

## Card catalog data

The card catalog (`cards` + `reward_rules` tables) is sourced from
`db/cards-dataset.json`. This is the canonical, version-controlled list of US
consumer credit cards and their per-category earn rates.

There is currently no high-quality free public API for credit-card rewards
metadata, so this dataset is curated manually. The sync script is designed so
that swapping in a remote dataset later requires no code changes:

```sh
# Default: load db/cards-dataset.json
npm run db:sync

# Or point at a remote JSON file with the same schema
CARDS_DATA_URL=https://example.com/cards.json npm run db:sync

# Also delete cards no longer present in the dataset (off by default)
npm run db:sync -- --prune
```

The sync is idempotent: cards and rules are upserted in a single transaction.
Rules removed from a card upstream are deleted locally; unknown cards are
preserved unless `--prune` is passed.

### Weekly refresh

Add a cron entry on the API host:

```cron
# Sundays at 03:15 UTC
15 3 * * 0  cd /srv/pointz/server && /usr/bin/npm run db:sync >> /var/log/pointz-sync.log 2>&1
```

Or a GitHub Action that runs against the production DB:

```yaml
# .github/workflows/cards-sync.yml
on:
  schedule: [{ cron: "15 3 * * 0" }]
  workflow_dispatch:
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: server/package-lock.json }
      - run: npm ci
        working-directory: server
      - run: npm run db:sync
        working-directory: server
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          PGSSL: "true"
```

### Editing the dataset

Edit `db/cards-dataset.json` and bump `version` (date-stamp is fine), commit,
and the next scheduled run will pick it up. Schema is enforced at sync time by
zod — invalid changes will fail the run without touching the DB.


