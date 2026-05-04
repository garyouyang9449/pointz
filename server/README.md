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

## V1 Notes

- Supported geography is US.
- Points and miles are treated as raw multipliers, not dollar values.
- Merchant-specific exceptions, signup bonuses, rotating activation tracking, and user point valuations are excluded.
- Card data is seeded into Postgres from `db/init.sql` and should be reviewed periodically against issuer terms.
