# Documentation password access

Set `DOCUMENTATION_PASSWORD` in the **Next.js website server environment** (`website/.env.local` locally). Do not use a `NEXT_PUBLIC_` prefix and do not put the value in Git. Use a randomly generated password of exactly eight printable ASCII characters, without spaces. Restart the Next.js server after setting or rotating it.

```dotenv
DOCUMENTATION_PASSWORD=
```

An unset or invalid password keeps documentation locked. The gate uses the shadcn Input OTP composition with the `input-otp` primitive, masked slots, text keyboard and paste support. The input has eight slots; this is a reusable shared password, not an emailed one-time code.

Protected routes: `/platform/integrations` and descendants, plus `/docs` and all descendants. Both middleware and server rendering check access. API reference data is server-only and passed into documentation navigation/search only after authorization. The anonymous Laravel content feed excludes these slugs, so existing CMS records are retained but no longer used as public editorial overrides for integrations. The built-in integrations page remains available after unlocking.

A successful check issues an HTTP-only, SameSite=Strict signed cookie valid for one hour, Secure in production. Password rotation invalidates existing cookies. Passwords are compared using fixed-length timing-safe hashes, never put in URLs or logged. Only protected local return destinations are accepted. Protected responses use no-store and noindex; protected routes are excluded from the sitemap. Marketing summaries and images remain public.

The unlock route enforces same-origin JSON requests, a 4 KB body limit and a ceiling of 20 attempts per minute per server process. **Before multi-instance/serverless deployment, configure a shared ingress/WAF rate limit for `/api/documentation/access`**; process-local counters reset on restart and are not shared across workers. Serve the site over HTTPS. Ensure the reverse proxy preserves the public request origin for same-origin checks. Do not cache protected routes at the CDN. Purge previously public documentation responses and obsolete static assets when deploying this change; a gate cannot retract copies already downloaded or indexed.

This gate controls documentation access only. Existing API authentication and merchant authorization remain unchanged. No production password is generated or set by this change.

Verification: `node --test website/tests/documentation-access.test.mjs`, TypeScript check, and `php artisan test --filter=test_public_content_excludes_protected_documentation` using the test SQLite database.
