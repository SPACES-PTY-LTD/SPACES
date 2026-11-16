# Public website and operations

Implemented locally on 2026-10-30. This document covers the new marketing website, publishing, demo calendar and support centre. It does not change dashboard or driver-run behaviour.

## Setup and release gates

1. Use the repository's Node 22.23.4 runtime. Install the website lockfile dependencies and build the existing Next.js application.
2. Apply Laravel migrations through the normal deployment process, then run `php artisan db:seed --class=WebsiteContentSeeder`. This seeder is idempotent and never overwrites existing editorial work. It publishes the implementation-grounded platform, industry, security and help copy. Blog articles and legal policies remain drafts.
3. Set `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_SITE_URL` for the website and `WEBSITE_PUBLIC_URL` (marketing origin) / `FRONTEND_URL` (admin origin) for Laravel. The site URL must be the public marketing origin. Keep the existing app/admin origin configuration intact.
4. In **Website → Settings**, enter verified company contacts, support inbox and demo working hours/blackouts. The shared calendar uses Africa/Johannesburg, with UTC storage. No configured hours means no available slots.
5. In **Website → Pricing**, approve current paid plan amounts, VAT wording and display order. Existing free plans are unchanged and never displayed publicly. Approval hashes include plan title, active/free state, vehicle limits, both currencies and extra-vehicle charges; changing those values invalidates public display until reapproved.
6. Review and publish company-approved policies and give blog articles their actual named authors. Verify all production security claims and integrations before public release. The homepage includes an actual screenshot of the public developer documentation. Add further approved product screenshots via the image URL/description fields; existing verification screenshots containing company names have deliberately not been copied into public assets.
7. Configure real outbound mail, a shared queue worker and Laravel scheduler. `website:notifications` runs every minute, dispatching persistent outbox records and due demo reminders. Confirm delivery against a controlled inbox before releasing booking and tickets publicly. Mail bodies/calendar attachments are encrypted at rest with Laravel's application key.
8. Store private support attachments on the Laravel local disk (`storage/app/private/support`). Set `WEBSITE_SUPPORT_DISK` to a durable shared private disk such as the configured S3 disk for multi-instance hosting. Uploads explicitly request private visibility and each attachment retains its storage disk. Never expose that directory through a public symlink.

No production database, deployment, mail recipient or commercial price approval is changed by this implementation task. Content publication is a separate explicit editor action after local installation/seeding. No fabricated customers, testimonials, savings metrics, job vacancies or certifications are included.

## Editing and access

Only super admins may read/manage the Website workspace and its API. Content has a stable type/address, mutable draft and independent published snapshot. Saving does not alter the published version. Publish/unpublish actions are logged. Preview uses the saved, server-sanitised draft inside the authenticated workspace. Supported markup is paragraphs, headings, lists, bold/emphasis and blockquotes; arbitrary attributes, scripts and embeds are removed. Pasting into the editor inserts plain text.

Public hub cards, search and sitemap use only published snapshots. Static operational routes (pricing, booking, careers, support, resources, contact) remain available with honest empty/error states. Existing `/admin`, `/driver`, `/auth` and `/docs` routes are preserved. Search indexing is disallowed for private/management routes; authorization, not robots rules, protects private data.

Customer tickets use existing merchant membership checks, including read-only/viewer and billing roles. Super admins can manage all tickets. Driver and anonymous access is denied. Tickets are merchant-wide conversations, not private to one submitting colleague. Staff assignment is limited to super admins. Replies reopen resolved requests; staff replies move them to awaiting customer. Attachments are MIME/size checked, stored privately and downloaded only after a fresh ticket authorization check.

## Demo reservations and mail

Public slots contain timestamps only. The scheduler generates 15-minute start increments within working hours, requires 24-hour notice, limits the horizon to 30 days and blocks 30-minute meetings plus a 15-minute gap. Reservation and rescheduling transactions write/lock the singleton settings row before checking availability; all writers must retain this shared lock discipline. Database-backed serialization works independently of process-local cache locks.

Cancellation/rescheduling links carry random secrets in the URL fragment, are hashed in booking storage and expire one day after the appointment. The browser removes the fragment after reading it; API management requests send the secret in the POST body. Changing an appointment clears the old meeting URL and reminder state. Staff add the unique HTTPS meeting URL and trigger an update. Calendar files retain stable booking UIDs with an updated sequence. There is no external calendar synchronization or automatic conferencing.

Notifications are queued in the database transaction, so a mail failure cannot discard a booking or support reply. Delivery jobs claim records before sending, retry failed messages up to five attempts at five-minute intervals, and make errors visible to super admins. Staff can explicitly retry exhausted failures. A crashed sender is recovered after ten minutes; SMTP does not provide exactly-once delivery, so a crash after send can cause a duplicate. At most 100 pending records are dispatched per scheduler pass. Reminder generation is transactionally claimed to avoid duplicate reminder records.

## Feature-claim checklist

| Public claim | Implementation evidence | Publication boundary |
| --- | --- | --- |
| Scheduling and runs | `ScheduleController`, `RunController`, admin schedule/run pages | Demonstrate deployed readiness and permissions; no automatic optimisation claim. |
| Tracking and recorded journeys | `RunTrackService`, `VehicleLocationSyncService`, tracking integrations | Depends on provider configuration and available data. |
| Driver document import | `DriverDocumentImportController`, `DriverImportReviewService`, canonical dashboard plan | Human review remains required; native and provider checks remain deployment gates. |
| Document reporting | Existing missing/coverage/expiry report pages | No claim of independently verified signatures. |
| Location automation | `docs/location-automation-actions.md`, location automation services | Only supported conditions/actions; an event alone does not prove delivery. |
| Operational reporting | Existing shipment, waiting-time, speeding and vehicle report pages | Data completeness matters. |
| MiX/Powerfleet and Fleetboard integration code | Provider services in `app/Services` | Confirm configured compatibility; no partnership claim. |
| Access controls | `MerchantAccess`, `RoleMiddleware`, merchant-scoped controllers | Code evidence is not an independent production security audit. |
| Password hashing | `User` password cast, `AuthService` | Applies to passwords. |
| Encrypted integration settings | `MerchantIntegration` encrypted cast | Does not imply all storage/backups are encrypted. |
| Auditability | `ActivityLogService` | No immutable or exhaustive logging claim. |

## Verification

See the release-notes entry for actual checks performed. Production mail, deployed integration connections, approved prices/policies/contact details and approved screenshots remain release gates. Test database setup is isolated from the existing application database.

## Feature discovery and demo presentation (2026-10-30)

Platform and Industries overviews now use a shared frontend catalogue of implementation-grounded summaries, existing illustrations and industry photography. Dropdowns remain useful if public content cannot load: published detail pages are preferred, with overview anchors otherwise. This does not publish drafts or substitute content for unpublished detail URLs.

Demo booking uses time selection, contact details and confirmation states. Changing time preserves contact fields; a server-side starts_at validation conflict refreshes availability. The confirmation uses the returned appointment time. Management links retain their existing private fragment-token handling. No calendar or email rules changed.

Local verification found an environment blocker: the configured MAMP database socket is absent, and the active local socket rejects the configured credentials. Do not substitute another database, migrate, seed or publish merely to make the preview work. Restore the intended local database connection, then verify public content, configured hours and real browser booking with a safe mail sink. Automated booking tests use isolated data and never send email.

## Built-in platform landing pages (2026-10-30)

At the user’s explicit request, all seven recognised platform routes are now built-in public pages: scheduling, tracking, driver-app, documents, automation, reporting and integrations. This supersedes the earlier overview-only fallback for these routes. Their reviewed static copy, illustrations, workflow steps and FAQs are maintained in the frontend feature catalogue and landing-page content module. They remain available when the CMS cannot be reached, and appear in navigation and the sitemap.

Only published CMS content may add a product-details section and SEO overrides. Unpublishing that CMS record removes those additions; it does not remove the built-in feature page. CMS drafts are never used as a fallback. Unknown platform slugs retain the existing CMS-only/error behaviour. Industry detail pages retain individual publication control. No records were seeded or published for this change.

## Built-in industry landing pages (2026-10-30)

Road freight, wholesale distribution, courier operations, retail delivery and fuel depots now have built-in public landing pages, following the user’s request to extend the immediately available platform-page approach. Each has industry-specific content, a photographic hero, three capability chapters, a workflow, FAQs and related platform links. The shared industry catalogue now supplies the homepage cards, dropdown, overview, footer and sitemap, including fuel depots.

This supersedes the earlier publication-only behaviour for these five industry routes. Only published CMS product details/SEO may supplement them; unpublishing removes those additions rather than the built-in page. Drafts remain private and unknown industry slugs retain existing CMS/error behaviour. No records were seeded or published.

Fuel-depot copy covers transport dispatch, tracking-dependent journeys and location events, waiting-time context and delivery-document review. It does not offer fuel-stock reconciliation, tank telemetry, metering, loading controls, certification or regulatory compliance. The depot photo is generated and visibly labelled illustrative; provenance and the final prompt are recorded in website-visual-assets.md.

## Built-in editorial library (30 October 2026)
Ten practical guides live in `website/src/lib/website/blog-posts.ts`, with dedicated image-led index/detail layouts. They are available independently of the local CMS connection. Published CMS records override matching built-in slugs; drafts are never passed to the library merger. Unpublishing an override restores the built-in guide rather than hiding that route. Remove a built-in entry in code to withdraw it completely. New CMS articles continue to use the existing publishing workflow.

Earlier dates are explicitly labelled **Editorial date** (edition dates), while publication metadata, cards and sitemaps retain 30 October 2026, the date the guides were added to this library. Deployment is separate and has not been performed. Author credit is the Spaces Digital Editorial Team; no personal author identity is invented. Each generated cover is labelled illustrative. Content avoids quantified outcomes, automatic optimisation, independent signature verification and specialist fuel-system claims.
