# Courier Integrate (Laravel 12)

Production-grade REST API for a Pickup-Integrate-style logistics aggregator.

## Requirements
- PHP 8.2+
- Composer
- SQLite (local) or MySQL (production)

## Setup (Local)
1. Install dependencies:
   ```bash
   composer install
   ```
2. Copy env:
   ```bash
   cp .env.example .env
   ```
3. Generate app key:
   ```bash
   php artisan key:generate
   ```
4. Create SQLite DB:
   ```bash
   touch database/database.sqlite
   ```
5. Run migrations + seed super admin:
   ```bash
   php artisan migrate
   php artisan db:seed
   ```
6. Run queue worker (database driver):
   ```bash
   php artisan queue:work
   ```

## Production (MySQL)
Update `.env`:
```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=courier_integrate
DB_USERNAME=YOUR_USER
DB_PASSWORD=YOUR_PASS
```

## Mail
Local default: `MAIL_MAILER=log`.
For SMTP (Mailgun/SES):
```
MAIL_MAILER=smtp
MAIL_HOST=YOUR_SMTP_HOST
MAIL_PORT=587
MAIL_USERNAME=YOUR_USER
MAIL_PASSWORD=YOUR_PASS
MAIL_FROM_ADDRESS="noreply@example.com"
MAIL_FROM_NAME="Courier Integrate"
```

## Queue
Local default: `QUEUE_CONNECTION=database`.
For Redis:
```
QUEUE_CONNECTION=redis
REDIS_HOST=127.0.0.1
```

## Super Admin
Seeded automatically:
- Email: `admin@example.com`
- Password: `password`

## Roles & Permissions
- `super_admin`: access everything.
- `user`: access only resources linked to merchants they belong to.

## Invites
- Owner/Admin can invite by email and role.
- Accept via token in email link: `{FRONTEND_URL}/invites/accept?token=...`.
- Invites expire after `INVITE_EXPIRES_HOURS` (default 168).
- Resend throttled to 3/day per invite.

## Example cURL
Register:
```bash
curl -X POST http://localhost/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d @docs/examples/register.json
```
Create merchant:
```bash
curl -X POST http://localhost/api/v1/merchants \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme"}'
```
Create shipment:
```bash
curl -X POST http://localhost/api/v1/shipments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @docs/examples/create_shipment.json
```

## Docs
- OpenAPI: `openapi.yaml`
- Postman: `postman_collection.json`
- Examples: `docs/examples/*.json`
- Release Notes: `docs/release-notes.md`

## Notes
- All API routes are under `/api/v1`.
- Responses use a consistent envelope with `meta.request_id` for correlation.
- Queue jobs handle quotes, booking, webhooks, invites, and cleanups.

## Running Tests
```bash
php artisan test
```

## Environment Variables
```
APP_ENV, APP_KEY, DB_*
FRONTEND_URL
MAIL_* (SMTP)
CARRIER_WEBHOOK_SECRET_DUMMY
WEBHOOK_RETRY_MAX_ATTEMPTS
WEBHOOK_RETRY_BASE_SECONDS
INVITE_EXPIRES_HOURS
IDEMPOTENCY_EXPIRES_HOURS
```
