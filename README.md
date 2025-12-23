Fastamoni Donations API
=======================
Fastamoni is a Node.js service built with **NestJS + TypeORM + PostgreSQL** for user onboarding, wallets, secure donation transfers, and donation history. It uses **Redis** for caching, **Swagger** for API documentation, and **Artillery** for smoke + load tests.

## What you get

- **Auth (JWT)**: register, verify email, login
- **User profile**: get current user, set/reset transaction PIN
- **Wallets**: auto-create wallet per user, retrieve wallet balance
- **Donations**: create donations atomically (debit donor + credit beneficiary), list/count donations, fetch a single donation, fetch the donation’s transaction
- **Performance-focused implementation**: caching for hot read paths, targeted cache invalidation, and database-friendly queries

## Requirements

- **Node.js**: 18+
- **PostgreSQL**
- **Redis**

## Setup

1) Install dependencies

```bash
npm install
```

2) Create a `.env` in the repo root (this repo ignores `.env` by design)

Minimal example (adjust to your environment):

```bash
# Server
PORT=3000
NODE_ENV=development

# Postgres
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=fastamoni

# Auth
JWT_SECRET=supersecret

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Email (optional in dev; tests run with DISABLE_EMAIL=true)
SMTP_URL=smtp://user:pass@host:port
EMAIL_FROM=no-reply@fastamoni.test

# Load test fixtures (required for `npm run test:load`)
# Pre-existing VERIFIED user credentials:
TEST_USER_EMAIL=verified.user@example.com
TEST_USER_PASSWORD=TestPass123!
TEST_USER_PIN=123456

# A valid beneficiary user id (UUID) that exists in your DB
BENEFICIARY_ID=00000000-0000-0000-0000-000000000000

# Optional: a real donation id for GET /donations/:id and /transaction endpoints
# If unset, tests will hit a placeholder and expect 404 for those endpoints.
TEST_DONATION_ID=00000000-0000-0000-0000-000000000000

# Required for `npm run test:load`:
# A JWT access token for TEST_USER_EMAIL (see "Generating TEST_ACCESS_TOKEN" below)
TEST_ACCESS_TOKEN=eyJhbGciOi...
```

3) Run the app

```bash
npm run start:dev
```

- **Swagger UI**: `http://localhost:3000/api/docs`
- **API base**: `http://localhost:3000/api`

## Useful scripts

- `npm run start:dev`: start in watch mode
- `npm run build`: compile to `dist/`
- `npm run start:prod`: run compiled app (`node dist/main.js`)
- `npm run test:smoke`: runs a one-pass Artillery smoke suite (covers all endpoints once)
- `npm run test:load`: runs the 100 rps / 30s load test with a strict p99 threshold

## API overview (prefix `/api`)

### Auth

- `POST /auth/register`
  - Body: `{ firstName, lastName, email, password }`
  - Returns: `{ accessToken, user }`
- `POST /auth/verify-email`
  - Body: `{ code }`
  - Requires auth (uses the JWT from register/login)
- `POST /auth/resend-verification`
  - Requires auth
- `POST /auth/login`
  - Body: `{ email, password }`
  - Returns: `{ accessToken, user }`
  - If the user is not verified, login returns `401` and triggers a resend of the verification code.

### Users

- `GET /users/me` (auth)
- `POST /users/pin` (auth)
  - Body: `{ pin }`
- `POST /users/pin/reset` (auth)

### Wallets

- `GET /wallets/me` (auth)

### Donations

- `POST /donations` (auth)
  - Body: `{ beneficiaryId, amount, pin, message?, idempotencyKey? }`
- `GET /donations/count` (auth)
- `GET /donations?page=&limit=&startDate=&endDate=` (auth)
- `GET /donations/:id` (auth)
- `GET /donations/:id/transaction` (auth)

## Date/time and money handling

- **Timestamps**: stored as `timestamptz` and treated as UTC.
- **Money**: stored as `numeric(14,2)` (via transformer) to avoid floating-point drift.

## Load testing

This repo includes two Artillery suites:

### Smoke test (functional coverage)

Runs each endpoint once (or a small number of times) to confirm correctness.

```bash
npm run test:smoke
```

**You must set**:
- `BENEFICIARY_ID` (existing user id)
- `TEST_ACCESS_TOKEN` (JWT)
- Ideally `TEST_DONATION_ID` if you want 200s on `GET /donations/:id*` (otherwise those are allowed to return 404)

### Load test (performance gate)

Runs **100 rps for 30 seconds** and enforces:
- `http.response_time.p99 < 50ms`

```bash
npm run test:load
```

Important details:
- The load test is designed as a **steady-state read-heavy** workload (auth/register/PIN/writes are intentionally not part of the p99-gated mix).
- The test expects a valid `TEST_ACCESS_TOKEN` exported via `.env`.

### Generating `TEST_ACCESS_TOKEN`

1) Ensure you have a **verified** user in the DB (email verified).
2) Login:

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}"
```

Copy `accessToken` from the response into your `.env` as `TEST_ACCESS_TOKEN`.

## Common troubleshooting

### “Invalid or expired verification code” (but the email is fresh)

Verification code validation reads the verification fields directly from the DB. Two common gotchas:
- **Whitespace**: copy/paste may include spaces/newlines (the server normalizes the input now).
- **Code rotation**: calling login on an unverified user triggers a resend and may overwrite the old code.

### Load test failing with 401s

- Ensure `TEST_ACCESS_TOKEN` is present and valid for the user.
- Ensure the token is used as `Authorization: Bearer <token>`.

### Port 3000 already in use

The test scripts attempt to kill port 3000 automatically, but you can manually run:

```bash
lsof -ti:3000 | xargs kill -9
```

### Emails during tests

Tests run with `DISABLE_EMAIL=true` so SMTP cannot introduce flakiness or latency.

## Notes on performance & correctness

- **Caching**: hot read endpoints use cache keys (users/wallets/donation counts/lists) with TTLs.
- **Cache invalidation**: donation creation invalidates only affected keys (no global cache reset).
- **Transactions**: wallet balance updates and donation/transaction creation happen within a DB transaction with locking where appropriate.
- **Security**: parameterized queries (TypeORM), input validation (class-validator), and throttling/helmet middleware.
