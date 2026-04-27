# Pointz Server

Lightweight V1 recommendation API for choosing the best credit card by purchase category. User card selections are not stored by the backend; clients send selected card IDs with each recommendation request.

## Requirements

- Node.js 22+
- PostgreSQL 14+ (or use the included Docker compose)
- Docker, optional for containerized runs

## Local Development

Set `DATABASE_URL` and apply the schema/seed in `db/init.sql` to your Postgres instance:

```sh
createdb pointz
psql pointz -f db/init.sql
export DATABASE_URL=postgres://localhost:5432/pointz
npm install
npm run dev
```

The API starts on `http://localhost:3000`.

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
