# Release Notes

Use this document to track every shipped backend/frontend change.
Add new entries at the top (newest first).

## Update Rules

1. Create a new release section for every merged feature/fix batch.
2. Always include:
   - `Date` (YYYY-MM-DD)
   - `Version` (or sprint tag)
   - `Summary`
   - `API Changes`
   - `Database Changes`
   - `Behavior Changes`
   - `Breaking Changes` (or `None`)
   - `Verification`
3. Keep entries concise and production-focused.
4. Link important files/endpoints changed.

---

## 2026-04-02 | Version: unreleased

### Summary
- Fixed admin vehicle edits to submit only the fields present on the vehicle form, avoiding save failures caused by extra hidden payload fields.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The vehicle edit dialog now sends only the editable vehicle fields shown in the form when saving changes.
- Vehicle update requests no longer include hidden location data or create-only merchant assignment data from the admin vehicle dialog.

### Breaking Changes
- None.

### Internal Changes
- Removed unused hidden vehicle location form state from the admin vehicle dialog and split create vs update payload construction.

### Verification
- Updated files:
  - `website/src/components/vehicles/vehicle-dialog.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `npx eslint src/components/vehicles/vehicle-dialog.tsx`

## 2026-04-02 | Version: unreleased

### Summary
- Fixed driver detail lookups to honor the requested `merchant_id`, preventing false 404s when a user belongs to multiple merchants.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/api/v1/drivers/{driver_uuid}` now resolves merchant-scoped access using the supplied `merchant_id` for merchant users before loading the driver.
- Driver detail pages and links from merchant-scoped reports now load correctly even when the selected merchant is not the first merchant attached to the user.

### Breaking Changes
- None.

### Internal Changes
- Added regression coverage for fetching a driver under a non-default merchant membership.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/DriverController.php`
  - `app/Services/DriverService.php`
  - `tests/Feature/DriverIndexTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test tests/Feature/DriverIndexTest.php`

## 2026-04-02 | Version: unreleased

### Summary
- Fixed a frontend build failure by aligning the shared `Shipment` type with the driver data already used by the shipments list page.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- None.

### Breaking Changes
- None.

### Internal Changes
- Added the optional `driver` field to the shared frontend `Shipment` type so TypeScript matches the shipments list usage.

### Verification
- Updated files:
  - `website/src/lib/types.ts`
  - `docs/release-notes.md`
- Verification run:
  - `npm run build`

## 2026-04-02 | Version: unreleased

### Summary
- Fixed the shipments report page to reuse the admin shell’s active-merchant fallback so merchant-scoped report requests still include `merchant_id` when the session has merchants but no explicit `selected_merchant`.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The shipments report page now falls back to the first available merchant in the session when `selected_merchant` is empty.
- This prevents `The merchant_id field is required.` errors on the report page when the UI already shows an implicit active merchant.

### Breaking Changes
- None.

### Internal Changes
- Aligned the server-rendered report page’s merchant resolution with the existing admin shell merchant selection behavior.

### Verification
- Updated files:
  - `website/src/app/admin/logistics/shipments/reports/shipments_report/page.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `npx eslint src/app/admin/logistics/shipments/reports/shipments_report/page.tsx`

## 2026-04-02 | Version: unreleased

### Summary
- Fixed unscoped shipments report calls in location detail views so merchant-specific report endpoints always receive the selected `merchant_id`.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Location detail shipment counters now pass `merchant_id` when loading outbound and inbound shipment report totals.
- The dashboard location dialog now passes `merchant_id` for the same shipment report lookups, avoiding `The merchant_id field is required.` validation errors.

### Breaking Changes
- None.

### Internal Changes
- Aligned all remaining `getShipmentsFullReport` location-detail call sites with the stricter backend merchant scoping requirement.

### Verification
- Updated files:
  - `website/src/components/locations/location-detail-content.tsx`
  - `website/src/components/dashboard/location-dialog-content.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `npx eslint src/components/locations/location-detail-content.tsx src/components/dashboard/location-dialog-content.tsx`

## 2026-04-02 | Version: unreleased

### Summary
- Improved admin validation error messaging so report screens show the first concrete field error instead of the generic `Validation failed.` message.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Frontend API error handling now promotes the first field-level validation message from backend responses.
- The shipments report now shows actionable validation feedback such as a missing `merchant_id` instead of only the generic validation wrapper text.

### Breaking Changes
- None.

### Internal Changes
- Centralized validation-detail extraction in the shared frontend API client used across admin pages.

### Verification
- Updated files:
  - `website/src/lib/api/client.ts`
  - `docs/release-notes.md`
- Verification run:
  - Not run in this session.

## 2026-04-02 | Version: unreleased

### Summary
- Added the assigned driver column to the logistics shipments list so dispatch teams can see shipment ownership without opening each shipment.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The `admin/logistics/shipments` table now shows the current shipment driver name.
- Driver names in the shipments list link directly to the driver details page when a driver is assigned.
- Shipments without an assigned driver now show `Unassigned` in the new column.

### Breaking Changes
- None.

### Internal Changes
- Reused the existing `ShipmentResource.driver` payload already returned by the shipments API instead of introducing a new field.

### Verification
- Updated files:
  - `website/src/app/admin/logistics/shipments/page.tsx`
  - `docs/release-notes.md`
- Verification run:
  - Not run in this session.

## 2026-04-02 | Version: unreleased

### Summary
- Scoped the admin shipments report page to the selected merchant so report results no longer span multiple merchants unexpectedly.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `admin/logistics/shipments/reports/shipments_report` now sends the active `merchant_id` with the shipments full report request.
- Super admins without a selected merchant now see a prompt to choose a merchant instead of loading an unscoped shipments report.
- The `/api/v1/reports/shipments_full_report` endpoint now requires `merchant_id` when no merchant environment is present and returns only shipments for the requested merchant.

### Breaking Changes
- None.

### Internal Changes
- Added backend enforcement so direct API calls cannot load an unscoped shipments full report outside a merchant context.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/ReportController.php`
  - `tests/Feature/ShipmentsFullReportTest.php`
  - `website/src/app/admin/logistics/shipments/reports/shipments_report/page.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test tests/Feature/ShipmentsFullReportTest.php`

## 2026-04-02 | Version: unreleased

### Summary
- Added automatic driver creation during vehicle tracking sync when a provider position includes a driver integration id that does not yet exist locally.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `tracking:sync-vehicle-locations` now fetches and upserts missing drivers from the tracking provider before assigning them to vehicles and using them in auto-run lifecycle updates.
- Tracking sync now prefers a provider-specific single-driver fetch when available and falls back to bulk driver import filtering when it is not.
- If provider driver fetch/import fails, vehicle position sync continues and records the failure without blocking the rest of the job.

### Breaking Changes
- None.

### Internal Changes
- Centralized provider-driver import/upsert logic in `DriverService` and reused it from both tracking sync and the existing provider driver import flow.
- Added tracking-job regression coverage for single-fetch imports, bulk fallback imports, merchant-scoped collisions, and provider fetch failures.

### Verification
- Updated files:
  - `app/Jobs/TrackVehicleLocationsJob.php`
  - `app/Services/DriverService.php`
  - `app/Services/MerchantIntegrationService.php`
  - `app/Services/Mixtelematics/MixIntegrateService.php`
  - `tests/Feature/TrackVehicleLocationsJobTest.php`
  - `tests/Feature/TrackingProviderImportDriversTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php -l app/Jobs/TrackVehicleLocationsJob.php`
  - `php -l app/Services/DriverService.php`
  - `php -l app/Services/MerchantIntegrationService.php`
  - `php -l app/Services/Mixtelematics/MixIntegrateService.php`
  - `php artisan test tests/Feature/TrackVehicleLocationsJobTest.php`
  - `php artisan test tests/Feature/TrackingProviderImportDriversTest.php`

## 2026-04-02 | Version: unreleased

### Summary
- Fixed tracking sync driver resolution so vehicle activity and auto-created runs match drivers by integration ID within the correct merchant.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `tracking:sync-vehicle-locations` downstream lifecycle processing now prefers driver records whose `merchant_id` matches the current merchant when resolving a `driver_intergration_id`.
- Same-account drivers from other merchants no longer get attached to vehicle last-known-driver updates or auto-created runs when integration IDs collide.

### Breaking Changes
- None.

### Internal Changes
- Added a shared merchant-aware driver integration resolver in the auto-run lifecycle service, with a legacy fallback for null-merchant driver records on the same account.

### Verification
- Updated files:
  - `app/Services/AutoRunLifecycleService.php`
  - `tests/Feature/AutoRunLifecycleServiceTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test tests/Feature/AutoRunLifecycleServiceTest.php`

## 2026-04-01 | Version: unreleased

### Summary
- Highlighted the active merchant in the admin merchant switcher so users can see which merchant is currently selected before switching.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The merchant dropdown in the admin shell now gives the selected merchant a highlighted row style.
- The active merchant entry now shows a checkmark indicator and removes avatar grayscale for quicker visual recognition.

### Breaking Changes
- None.

### Internal Changes
- Kept the merchant switching logic unchanged while adding selected-state styling inside the existing dropdown button rendering.

### Verification
- Updated files:
  - `website/src/components/layout/admin-shell.tsx`
  - `docs/release-notes.md`
- Verification run:
  - Not run in this session.

## 2026-04-01 | Version: unreleased

### Summary
- Upgraded the existing vehicles CSV flow into a fleet-oriented import experience with a friendlier sample template and vehicle type matching by code or name.

### API Changes
- `POST /api/v1/vehicles/import` now accepts vehicle type values from the CSV by UUID, `code`, or `name`.

### Database Changes
- None.

### Behavior Changes
- The logistics vehicles import dialog now uses fleet-oriented copy for the title, action button, success toast, and sample file download label.
- The fleet sample CSV now publishes `vehicle_type` values like `car`, `trailer`, and `motorcycle` instead of requiring UUIDs.
- Vehicle CSV imports continue to upsert using `intergration_id`, then `plate_number`, then `ref_code`.
- Invalid vehicle types now fail only the affected row and return a row-level error in the import summary.

### Breaking Changes
- None.

### Internal Changes
- Kept backward compatibility for legacy CSV files by continuing to accept the `vehicle_type_id` header and UUID values during import.

### Verification
- Updated files:
  - `app/Services/VehicleService.php`
  - `website/src/components/vehicles/import-vehicles-dialog.tsx`
  - `website/public/samples/vehicles-import-sample.csv`
  - `tests/Feature/VehicleCsvImportTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test tests/Feature/VehicleCsvImportTest.php`

## 2026-04-01 | Version: unreleased

### Summary
- Updated the admin landing page title to show the selected merchant name instead of the generic `Admin dashboard` label.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Admin users viewing the main dashboard now see `{merchant_name} dashboard` when a merchant is selected.
- The page falls back to `Admin dashboard` only when no selected merchant name is available in session data.

### Breaking Changes
- None.

### Internal Changes
- Wired the dashboard header title to the authenticated session's `selected_merchant.name`.

### Verification
- Updated files:
  - `website/src/app/admin/page.tsx`
  - `docs/release-notes.md`
- Verification run:
  - Not run in this session.

## 2026-03-30 | Version: unreleased

### Summary
- Added a new `Shipments by Location` logistics analytics report with pickup/dropoff grouping, selectable date ranges, a bar chart, and a location totals table.

### API Changes
- Added `GET /api/v1/reports/shipments-by-location` with query params `merchant_id`, `date_range`, `location_type`, `start_date`, and `end_date`.

### Database Changes
- None.

### Behavior Changes
- Logistics users can now open a dedicated `Shipments by Location` analytics page from the navigation or analytics overview.
- The report can switch between pickup and dropoff location totals and updates results for the selected date range.
- The date range control now includes `Today`, `Yesterday`, `This week`, and `Custom`, with custom ranges selected through a ShadCN-style calendar range picker.
- Custom range selection now stays stable while the user is choosing both dates instead of jumping after the first click.
- Applying a custom range now preserves the exact selected local dates instead of shifting them back by one day in some timezones.
- The custom range picker no longer allows future dates to be selected.
- Each month panel in the custom range picker now only allows selecting dates from that displayed month, without outside-month overflow days.
- Clicking a location in the report now opens the shipments report with the same date range and the matching pickup or dropoff location filter applied.

### Breaking Changes
- None.

### Internal Changes
- Added a dedicated backend aggregation endpoint and frontend report components instead of deriving location totals from the paginated shipments full report.
- Replaced the custom report's two single-date inputs with a single range-picker control built on the shared calendar and popover UI primitives.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/ReportController.php`
  - `app/Http/Requests/ShipmentsByLocationReportRequest.php`
  - `routes/api.php`
  - `tests/Feature/ShipmentsByLocationReportTest.php`
  - `website/src/app/admin/logistics/analytics/page.tsx`
  - `website/src/app/admin/logistics/analytics/shipments-by-location/page.tsx`
  - `website/src/components/reports/shipments-by-location-chart.tsx`
  - `website/src/components/reports/shipments-by-location-controls.tsx`
  - `website/src/lib/api/reports.ts`
  - `website/src/lib/navigation.ts`
  - `website/src/lib/routes/admin.ts`
  - `docs/release-notes.md`
- Verification run:
  - Not run in this session.

## 2026-03-30 | Version: unreleased

### Summary
- Fixed the website production build after the tracking providers integrations screen lost a required UI import during the main-location-provider rollback.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The tracking provider import dialog once again renders the locations import toggle correctly during production builds.

### Breaking Changes
- None.

### Internal Changes
- Restored the `Switch` component import in the tracking providers integrations UI so Next.js lint/type validation passes in `npm run build`.

### Verification
- Updated files:
  - `website/src/components/integrations/tracking-providers.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `npm run build`

## 2026-03-29 | Version: unreleased

### Summary
- Removed the merchant-level main location provider feature and restored tracking sync to rely on each vehicle's provider-specific `intergration_id`.

### API Changes
- `PATCH /api/v1/merchants/{merchant_uuid}/settings` no longer accepts `main_location_provider_id`.
- Merchant API responses no longer include `main_location_provider_id` or `main_location_provider`.

### Database Changes
- Removed the unrun migration that would have added `main_location_provider_id` to `merchants`.

### Behavior Changes
- Vehicle location sync no longer chooses one canonical provider per merchant.
- Connected tracking providers no longer show or manage a "main location provider" control in settings or integrations.
- Tracking continues to run per active merchant integration, with provider resolution based on each vehicle's unique `intergration_id`.

### Breaking Changes
- None.

### Internal Changes
- Kept `has_location_services` as backend tracking-provider metadata and retained Fleetboard integration support.
- Removed obsolete merchant main-location-provider tests and frontend state/plumbing tied only to that feature.

### Verification
- Updated files:
  - `app/Http/Requests/UpdateMerchantSettingsRequest.php`
  - `app/Http/Resources/MerchantResource.php`
  - `app/Models/Merchant.php`
  - `app/Services/MerchantService.php`
  - `app/Services/VehicleLocationSyncService.php`
  - `database/migrations/2026_03_28_230000_add_main_location_provider_id_to_merchants_table.php`
  - `tests/Feature/MerchantMainLocationProviderTest.php`
  - `website/src/app/admin/settings/integrations/page.tsx`
  - `website/src/components/integrations/tracking-providers.tsx`
  - `website/src/components/settings/organization-settings-form.tsx`
  - `website/src/lib/api/merchants.ts`
  - `website/src/lib/types.ts`
  - `docs/release-notes.md`
- Verification run:
  - `rg -n "main_location_provider_id|mainLocationProvider|Main location provider|main_location_provider" app website/src tests docs`
  - Additional syntax/tests run in this session are listed below.

## 2026-03-28 | Version: unreleased

### Summary
- Added Fleetboard as a tracking provider option for vehicle import and v1 live location sync, and added provider-level `has_location_services` capability metadata for future tracking-provider classification.

### API Changes
- None.

### Database Changes
- Added `has_location_services` boolean on `tracking_providers`.

### Behavior Changes
- Vehicle location sync continues to run per active merchant integration, using each vehicle’s provider-specific `intergration_id` as the source of truth for provider lookups.
- Fleetboard provider metadata and setup fields are now seeded for backend/provider configuration.

### Breaking Changes
- None.

### Internal Changes
- Added a Fleetboard SOAP service adapter for login, vehicle import normalization, and live position normalization for latitude, longitude, speed, and odometer.
- Added explicit `has_location_services` capability metadata for tracking providers so backend code can classify location-capable providers without inferring support from names.

### Verification
- Updated files:
  - `app/Http/Resources/TrackingProviderResource.php`
  - `app/Models/TrackingProvider.php`
  - `app/Services/Fleetboard/FleetboardService.php`
  - `app/Services/TrackingProviderService.php`
  - `config/tracking_providers.php`
  - `database/migrations/2026_03_28_233000_add_has_location_services_to_tracking_providers_table.php`
  - `database/seeders/DatabaseSeeder.php`
  - `tests/Unit/FleetboardServiceTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php -l app/Services/Fleetboard/FleetboardService.php`
  - `php -l app/Models/TrackingProvider.php`
  - `php -l app/Http/Resources/TrackingProviderResource.php`
  - `php -l app/Services/TrackingProviderService.php`
  - `php -l tests/Unit/FleetboardServiceTest.php`
  - `php -l database/migrations/2026_03_28_233000_add_has_location_services_to_tracking_providers_table.php`
  - `php artisan test tests/Unit/FleetboardServiceTest.php`

## 2026-03-28 | Version: unreleased

### Summary
- Fixed the invite accept form so the first submit can advance the flow instead of being blocked by hidden client-side validation.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Clicking `Accept invite` on the first step now submits the invite token correctly, allowing the UI to move to the password step when the invited user still needs to create an account.

### Breaking Changes
- None.

### Internal Changes
- Stopped pre-populating the hidden `name` form field during the initial accept step so Zod does not require hidden password fields before the API request is sent.

### Verification
- Updated files:
  - `website/src/components/auth/invite-accept-form.tsx`
  - `docs/release-notes.md`
- Verification run:
  - Not run in this session.

## 2026-03-28 | Version: unreleased

### Summary
- Added backend logging for merchant invite tokens at the moment invite emails are dispatched.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- New merchant invites and resent invites now write the plain invite token and invite ID to the application logs before the invite email job is dispatched.

### Breaking Changes
- None.

### Internal Changes
- Centralized invite token logging in the shared invite-email dispatch path so initial sends and resends follow the same logging behavior.

### Verification
- Updated files:
  - `app/Services/InviteService.php`
  - `docs/release-notes.md`
- Verification run:
  - `php -l app/Services/InviteService.php`

## 2026-03-27 | Version: unreleased

### Summary
- Updated invite-link handling so unknown invite tokens show a specific `Token not found.` message instead of a generic preview failure.

### API Changes
- `GET /api/v1/merchant-invites/preview` now returns `error.code = INVITE_NOT_FOUND` with the message `Token not found.` when the invite token does not match a database record.

### Database Changes
- None.

### Behavior Changes
- `/auth/invites` now displays `Token not found.` when the invite preview token is missing from the database.

### Breaking Changes
- None.

### Internal Changes
- Preserved the specific preview validation error code through the API layer so the website can render a token-specific state.

### Verification
- Updated files:
  - `app/Services/InviteService.php`
  - `app/Http/Controllers/Api/V1/MerchantInviteController.php`
  - `website/src/app/auth/invites/page.tsx`
  - `website/src/components/auth/invite-accept-form.tsx`
  - `tests/Feature/InviteFlowTest.php`
  - `docs/release-notes.md`
- Verification run:
  - Not run in this session.

## 2026-03-27 | Version: unreleased

### Summary
- Added a dedicated invite-email sender configuration so merchant invite emails can use a separate `from` address from the rest of the system mail.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Merchant invite emails now send from `USER_INVITE_FROM_EMAIL` when it is set.
- Invite email logs now store the actual invite sender address and name instead of always recording the global mail sender.

### Breaking Changes
- None.

### Internal Changes
- Added invite-specific mail config with fallback to the global `MAIL_FROM_ADDRESS` and `MAIL_FROM_NAME`.

### Verification
- Updated files:
  - `config/mail.php`
  - `app/Mail/MerchantInviteMail.php`
  - `app/Services/LoggedMailSender.php`
  - `tests/Feature/EmailLogTest.php`
  - `.env.example`
  - `docs/release-notes.md`
- Verification run:
  - Not run in this session.

## 2026-03-27 | Version: unreleased

### Summary
- Fixed the Expo driver app crash caused by structured address objects being rendered directly in shipment and vehicle screens.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The mobile app now normalizes structured location payloads into human-readable address strings before rendering shipment offers, shipment details, and vehicle location text.
- Driver screens now tolerate backend responses where `full_address` or `last_location_address` arrive as nested address objects instead of plain strings.

### Breaking Changes
- None.

### Internal Changes
- Added mobile API-layer normalization helpers for shipment, offer, presence, and vehicle payloads so address formatting is handled centrally.

### Verification
- Updated files:
  - `mobile_app/src/lib/api.ts`
  - `docs/release-notes.md`
- Verification run:
  - `npm run lint` in `mobile_app` (passes)

## 2026-03-27 | Version: unreleased

### Summary
- Fixed the website production build by aligning the vehicle API payload type with the current admin vehicle form fields.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- None.

### Breaking Changes
- None.

### Internal Changes
- Made `photo_key` optional in the frontend `VehiclePayload` type so vehicle create requests match the form payload after the photo key field removal.

### Verification
- Updated files:
  - `website/src/lib/api/vehicles.ts`
  - `docs/release-notes.md`
- Verification run:
  - `npm run build` in `website` (passes; existing ESLint warnings remain in unrelated files)

## 2026-03-27 | Version: unreleased

### Summary
- Updated the website registration page to match the new split-screen authentication design used by the login flow.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/auth/register` now uses a full-screen two-column layout with the same branded header and desktop promo panel style as the login page.
- The registration form now uses the newer auth card styling, clearer placeholders, and aligned input sizing across name, email, country, and password fields.
- Mobile registration keeps the same streamlined form-first experience while hiding the desktop-only promo panel.

### Breaking Changes
- None.

### Internal Changes
- Refactored the register form presentation so it fits the page-level auth layout without changing the existing registration and auto-login logic.

### Verification
- Updated files:
  - `website/src/app/auth/register/page.tsx`
  - `website/src/components/auth/register-form.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit` (could not run in this shell because `node` is not available)

## 2026-03-27 | Version: unreleased

### Summary
- Redesigned the website login page into a full-screen split authentication layout with branded marketing content and a cleaner sign-in form.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/auth/login` now uses a two-column desktop layout with a dedicated brand header, a simplified sign-in card, and a branded right-side promotional panel.
- The sign-in form now includes inline forgot-password access beside the password label and clearer field placeholders for faster login completion.
- Mobile login keeps the form-first experience while preserving the new visual styling without the desktop promo panel.

### Breaking Changes
- None.

### Internal Changes
- Refactored the login form component styling to fit the new page-level auth layout instead of rendering inside the previous standalone card shell.

### Verification
- Updated files:
  - `website/src/app/auth/login/page.tsx`
  - `website/src/components/auth/login-form.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit` (could not run in this shell because `node` is not available)

## 2026-03-26 | Version: unreleased

### Summary
- Rebuilt the website landing page into a lighter Spoke-style SaaS experience focused on route planning, live tracking, delivery operations, and conversion.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/` now presents a cleaner product-led marketing flow with a new hero, trust bar, problem/solution section, feature grid, product showcase, process steps, metrics, testimonials, CTA, and footer.
- Homepage visuals now emphasize route maps, driver tracking, stop lists, and dispatch dashboards instead of the previous operations-heavy dark theme.
- Hover and motion behavior across buttons, cards, route lines, and driver pins were simplified into a lighter animation system tuned for desktop and mobile.

### Breaking Changes
- None.

### Internal Changes
- Replaced the previous homepage content model and module stylesheet with a page-scoped implementation tailored to the new landing-page information architecture.

### Verification
- Updated files:
  - `website/src/app/page.tsx`
  - `website/src/app/homepage.module.css`
  - `docs/release-notes.md`
- Verification run:
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit` (fails due to a pre-existing unrelated `VehiclePayload` type mismatch in `website/src/components/vehicles/vehicle-dialog.tsx:179`)

## 2026-03-26 | Version: unreleased

### Summary
- Refreshed the admin account page with a stronger profile layout, added profile photo upload, and exposed a dedicated endpoint for updating the logged-in user’s profile image.

### API Changes
- Added `POST /api/v1/me/profile-photo` to upload and persist the authenticated user’s profile image.
- `GET /api/v1/me` and `PATCH /api/v1/me` now return `profile_photo_url` in the user payload.

### Database Changes
- Added `users.profile_photo_path` to persist the stored path for each user profile image.

### Behavior Changes
- `/admin/settings/account` now shows a profile summary panel, a dedicated profile picture upload card, and updated account/password sections.
- Uploading a new profile photo updates the account page preview and the admin shell avatar using the same user session payload.

### Breaking Changes
- None.

### Internal Changes
- Added multipart upload validation and feature coverage for the logged-in user profile photo flow.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/MeController.php`
  - `app/Http/Requests/UploadUserProfilePhotoRequest.php`
  - `app/Http/Resources/UserResource.php`
  - `app/Models/User.php`
  - `database/migrations/2026_03_26_000001_add_profile_photo_path_to_users_table.php`
  - `routes/api.php`
  - `tests/Feature/LastAccessedMerchantTest.php`
  - `website/src/components/layout/admin-shell.tsx`
  - `website/src/components/settings/account-settings-form.tsx`
  - `website/src/lib/api/merchants.ts`
  - `website/src/lib/auth.ts`
  - `website/src/lib/nextauth.ts`
  - `website/src/lib/types.ts`
  - `website/src/types/next-auth.d.ts`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter=LastAccessedMerchantTest`
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit` (fails due to a pre-existing unrelated `VehiclePayload` type mismatch in `website/src/components/vehicles/vehicle-dialog.tsx:179`)

## 2026-03-26 | Version: unreleased

### Summary
- Refreshed the marketing landing page with a stronger Pick n Drop brand-led hero, a full-bleed operational visual, and simpler section structure focused on platform story, outcomes, workflow, integrations, trust, and conversion.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The first viewport now presents Pick n Drop as the dominant visual and messaging signal instead of a dashboard-like split layout.
- Hero content is reduced to a single headline, one support line, a CTA group, and one dominant logistics control visual.
- Follow-up sections are reorganized so each section has one job and less visual clutter across the landing page.
- Landing page typography, color treatment, spacing, and motion were updated for a more intentional promotional surface on desktop and mobile.

### Breaking Changes
- None.

### Internal Changes
- Rebuilt the homepage module styles around page-scoped design tokens and responsive layout rules instead of the previous card-heavy dark theme.

### Verification
- Updated files:
  - `website/src/app/page.tsx`
  - `website/src/app/homepage.module.css`
  - `docs/release-notes.md`
- Verification run:
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit` (fails due to a pre-existing unrelated `VehiclePayload` type mismatch in `website/src/components/vehicles/vehicle-dialog.tsx:179`)

## 2026-03-26 | Version: unreleased

### Summary
- Fixed the dashboard recent activity card so each activity title always opens a detail view, falling back to the activity log detail page when no related entity route exists.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Recent activity items on the admin dashboard now link to the related entity when supported.
- Activity items without an entity-specific admin route now link to `/admin/activity-log/{activityId}` instead of rendering as plain text.

### Breaking Changes
- None.

### Internal Changes
- Reused the existing activity log detail route helper as the dashboard card fallback target.

### Verification
- Updated files:
  - `website/src/components/dashboard/recent-activity-card.tsx`
  - `docs/release-notes.md`
- Verification run:
  - Not run.

## 2026-03-26 | Version: unreleased

### Summary
- Removed non-essential vehicle form inputs for location update time, integration id, and photo key from the admin vehicle dialog, and changed status to a switch control.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The admin vehicle create/edit dialog no longer shows `Location updated at`, `Intergration ID`, or `Photo key`.
- Vehicle saves from the admin dialog no longer submit those fields from the form payload.
- The admin vehicle status control now uses a shadcn switch instead of a select dropdown.

### Breaking Changes
- None.

### Internal Changes
- Simplified the vehicle dialog form state and validation to match the remaining editable inputs while preserving the existing active/inactive payload shape.

### Verification
- Updated files:
  - `website/src/components/vehicles/vehicle-dialog.tsx`
  - `docs/release-notes.md`
- Verification run:
  - Not run.

## 2026-03-26 | Version: unreleased

### Summary
- Replaced tracking-provider vehicle imports with a selection flow that loads provider vehicles into a filtered table, supports select-all, captures a vehicle type per selected row, and imports only the chosen vehicles.

### API Changes
- Added `GET /api/v1/tracking-providers/{provider_id}/vehicles` to preview provider vehicles for import selection.
- Updated `POST /api/v1/tracking-providers/{provider_id}/import_vehicles` to require `vehicles[]` entries containing `provider_vehicle_id` and `vehicle_type_id`, alongside `merchant_id`.

### Database Changes
- None.

### Behavior Changes
- Admin integrations now load provider vehicles before a vehicle import starts.
- Vehicle imports now stay disabled until at least one provider vehicle is selected and each selected row has a vehicle type chosen.
- Vehicle import jobs now create or update only the selected provider vehicles and apply the selected vehicle type to each imported vehicle.
- Tracking-provider import jobs for vehicles, drivers, and locations now dispatch onto the `imports` queue instead of the default queue.
- Vehicle import type resolution accepts the submitted vehicle type identifier more defensively and the admin UI loads a larger enabled-only vehicle type list for the import dropdown.
- Tracking-provider vehicle imports now persist the selected `merchant_id` onto imported vehicles and prefer merchant-scoped matches when updating existing provider-linked vehicles.
- Tracking-provider driver and location imports now also reclaim legacy unscoped records onto the selected merchant and persist the selected `merchant_id` during import updates.

### Breaking Changes
- `POST /api/v1/tracking-providers/{provider_id}/import_vehicles` no longer supports merchant-only bulk imports; callers must send selected provider vehicle ids.

### Verification
- Updated files:
  - `app/Jobs/ImportProviderDriversJob.php`
  - `app/Jobs/ImportProviderLocationsJob.php`
  - `app/Jobs/ImportProviderVehiclesJob.php`
  - `app/Http/Controllers/Api/V1/MerchantIntegrationController.php`
  - `app/Http/Requests/ListTrackingProviderVehiclesRequest.php`
  - `app/Http/Requests/ImportTrackingProviderVehiclesRequest.php`
  - `app/Http/Resources/TrackingProviderVehicleResource.php`
  - `app/Jobs/ImportProviderVehiclesJob.php`
  - `app/Services/MerchantIntegrationService.php`
  - `app/Services/Mixtelematics/MixIntegrateService.php`
  - `routes/api.php`
  - `website/src/components/integrations/tracking-providers.tsx`
  - `website/src/components/integrations/tracking-provider-vehicle-import-table.tsx`
  - `website/src/lib/api/tracking-providers.ts`
  - `website/src/lib/types.ts`
  - `tests/Feature/TrackingProviderOptionsTest.php`
  - `openapi.yaml`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter=TrackingProviderOptionsTest`
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-26 | Version: unreleased

### Summary
- Fixed tracking provider activation so the admin UI submits the selected `merchant_id` and the API activates providers against the correct merchant in multi-merchant accounts.

### API Changes
- `POST /api/v1/tracking-providers/activate` now accepts `merchant_id` to scope activation to a specific merchant.

### Database Changes
- None.

### Behavior Changes
- Admin tracking provider activation now uses the currently selected merchant instead of implicitly activating against the first merchant available on the user.
- Users attached to multiple merchants can activate the same tracking provider for the intended merchant without cross-merchant leakage.

### Breaking Changes
- None.

### Internal Changes
- Added feature coverage for merchant-scoped tracking provider activation.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/MerchantIntegrationController.php`
  - `app/Http/Requests/ActivateTrackingProviderRequest.php`
  - `app/Services/MerchantIntegrationService.php`
  - `website/src/components/integrations/tracking-providers.tsx`
  - `website/src/lib/api/tracking-providers.ts`
  - `tests/Feature/TrackingProviderOptionsTest.php`
  - `openapi.yaml`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter=TrackingProviderOptionsTest`

## 2026-03-26 | Version: unreleased

### Summary
- Changed runs tracking to default to active runs only on first load while keeping the filter dialog available for broadening the result set.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/shipments/tracking` now loads with `Only show active runs` enabled by default.
- The tracking filter dialog now opens with the active-runs switch turned on unless the user has changed the applied filters.

### Breaking Changes
- None.

### Internal Changes
- Aligned the tracking page’s initial server fetch with the client-side default filter state so the first render matches subsequent filtered requests.

### Verification
- Updated files:
  - `website/src/app/admin/logistics/shipments/tracking/page.tsx`
  - `website/src/components/tracking/runs-tracking-view.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`
  - `npm run build`

## 2026-03-26 | Version: unreleased

### Summary
- Added a filter dialog to the runs tracking screen so operators can narrow the list to active runs and runs that still have shipments before applying the filters.

### API Changes
- `GET /api/v1/runs` now accepts:
  - `active_only`
  - `with_shipments`

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/shipments/tracking` now opens a filter dialog from the filter button instead of showing a disabled control.
- Tracking can now be filtered to only runs where `completed_at` is empty.
- Tracking can now be filtered to only runs that still have non-removed attached shipments.
- Search and pagination on the tracking list now preserve the applied filter state.

### Breaking Changes
- None.

### Internal Changes
- Removed debug logging from the tracking page and view while wiring the runs filter state through the frontend and backend list flow.

### Verification
- Updated files:
  - `website/src/components/tracking/runs-tracking-view.tsx`
  - `website/src/lib/api/runs.ts`
  - `app/Services/RunService.php`
  - `tests/Feature/RunApiTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter=RunApiTest`
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`
  - `npm run build`

## 2026-03-26 | Version: unreleased

### Summary
- Added reusable admin loading skeletons for table and detail screens and wired them into the admin route tree with route-level `loading.tsx` files.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Admin list pages now show a shared table-style loading skeleton during route transitions.
- Admin detail, form, and dashboard-style pages now show a shared detail-style loading skeleton during route transitions.
- Dynamic admin detail routes now use their own loading boundaries instead of falling back to generic parent loading states.

### Breaking Changes
- None.

### Internal Changes
- Added shared `AdminTableLoadingSkeleton` and `AdminDetailLoadingSkeleton` components under the website admin UI layer and attached them to admin route segments.

### Verification
- Updated files:
  - `website/src/components/admin/admin-loading-skeletons.tsx`
  - `website/src/app/admin/**/loading.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-26 | Version: unreleased

### Summary
- Fixed the shipment detail actions dropdown so it opens and stays interactive when the shipment detail view is rendered inside a dialog.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The shipment actions menu now works correctly in embedded shipment detail dialogs, allowing users to open the menu and launch its actions.

### Breaking Changes
- None.

### Internal Changes
- Configured the shipment actions Radix dropdown to run non-modally so it no longer conflicts with the parent dialog's focus and outside-interaction handling.

### Verification
- Updated files:
  - `website/src/components/shipments/shipment-detail-actions.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-26 | Version: unreleased

### Summary
- Fixed the account billing dashboard plan selector to satisfy the production React/Next build rules by replacing the synchronous state sync effect with derived selection state.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The billing dashboard plan dropdown now keeps its local selection state without relying on a synchronous `useEffect` state reset.

### Breaking Changes
- None.

### Internal Changes
- Resolved the blocking `react-hooks/set-state-in-effect` build error in the website production build.

### Verification
- Updated files:
  - `website/src/components/billing/account-billing-dashboard.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `npm run build`

## 2026-03-26 | Version: unreleased

### Summary
- Split the account billing screen into a current billing-cycle invoice preview and a separate previous-invoices history table with invoice-detail dialogs.

### API Changes
- `GET /api/v1/billing/summary` now includes `current_invoice_preview` with billing-period totals and preview line items for the current cycle.

### Database Changes
- None.

### Behavior Changes
- `/admin/billing` now shows a live preview of the current billing-cycle invoice before it is generated.
- Previous invoices now appear in a data table instead of the old inline card list.
- Clicking an invoice entry opens a dialog with full invoice details loaded from `GET /api/v1/billing/invoices/{invoice_uuid}`.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Services/BillingService.php`
  - `app/Http/Resources/AccountBillingSummaryResource.php`
  - `website/src/app/admin/billing/page.tsx`
  - `website/src/components/billing/account-billing-dashboard.tsx`
  - `website/src/lib/types.ts`
  - `tests/Feature/BillingTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter='BillingTest|AuthTest'`
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-25 | Version: unreleased

### Summary
- Added a seeded free 1-car trial plan, limited account-holder access to that plan to the first 14 days after registration, and added a downgrade confirmation because moving to the free plan automatically deletes extra merchant vehicles.

### API Changes
- `GET /api/v1/billing/plans` is now account-aware and hides the free plan after the account’s 14-day trial window ends.
- `GET /api/v1/billing/summary` now includes:
  - `can_select_free_plan`
  - `free_plan_available_until`
- Pricing plan resources now include:
  - `is_free`
  - `trial_days`

### Database Changes
- Added `pricing_plans.is_free`
- Added `pricing_plans.trial_days`
- Seeded a new `Free 1 Car` pricing plan with a 14-day trial window.

### Behavior Changes
- Account holders now see a confirmation dialog before downgrading a merchant to the free 1-car package.
- Downgrading a merchant to the free plan now keeps one deterministic vehicle and soft-deletes the rest.
- After the first 14 days from account registration, the free plan is removed from the account billing plan dropdown unless the merchant is already on that plan.

### Breaking Changes
- Merchant plan downgrades to the free plan now delete extra vehicle records for that merchant.

### Verification
- Updated files:
  - `database/migrations/2026_03_25_000006_add_free_plan_fields_to_pricing_plans_table.php`
  - `database/seeders/DatabaseSeeder.php`
  - `app/Models/PricingPlan.php`
  - `app/Services/BillingService.php`
  - `app/Http/Controllers/Api/V1/BillingController.php`
  - `app/Http/Resources/PricingPlanResource.php`
  - `app/Http/Resources/AccountBillingSummaryResource.php`
  - `website/src/components/billing/account-billing-dashboard.tsx`
  - `website/src/lib/types.ts`
  - `tests/Feature/BillingTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter='BillingTest|AuthTest'`
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-25 | Version: unreleased

### Summary
- Added account-country editing to the account settings page for account holders so they can change the billing country that drives billing currency and gateway routing.

### API Changes
- `GET /api/v1/me` now includes:
  - `is_account_holder`
  - `account_country_code`
- `PATCH /api/v1/me` now accepts `account_country_code` for account holders.

### Database Changes
- None.

### Behavior Changes
- `/admin/settings/account` now shows an all-countries dropdown only for account holders.
- Updating the account country from settings changes the owning account’s `country_code`.
- Non-account-holders do not see the field and cannot change account country through the profile update flow.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/MeController.php`
  - `app/Http/Resources/UserResource.php`
  - `website/src/components/settings/account-settings-form.tsx`
  - `website/src/lib/api/merchants.ts`
  - `website/src/lib/types.ts`
  - `tests/Feature/LastAccessedMerchantTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter='LastAccessedMerchantTest|AuthTest'`
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-25 | Version: unreleased

### Summary
- Removed manual gateway selection from the account billing portal so payment-method actions always use the gateway resolved from the account billing country.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/billing` no longer lets account holders choose a payment gateway when adding or syncing payment methods.
- Payment-method setup and sync actions now always use the account’s resolved billing gateway from country pricing.
- The billing UI now explains which gateway is being used and why.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `website/src/components/billing/account-billing-dashboard.tsx`
  - `website/src/app/admin/billing/page.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-25 | Version: unreleased

### Summary
- Added current billing-cycle dates and next billing date visibility to the account billing screen so users can see exactly when the next invoice will be generated.

### API Changes
- `GET /api/v1/billing/summary` now includes:
  - `current_billing_period_start`
  - `current_billing_period_end`
  - `next_billing_date`

### Database Changes
- None.

### Behavior Changes
- `/admin/billing` now shows the current billing period window and the next invoice date derived from the account’s anniversary billing schedule.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Services/BillingService.php`
  - `app/Http/Resources/AccountBillingSummaryResource.php`
  - `website/src/components/billing/account-billing-dashboard.tsx`
  - `website/src/lib/types.ts`
  - `tests/Feature/BillingTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter='BillingTest|AuthTest'`
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-25 | Version: unreleased

### Summary
- Changed invoice generation from fixed calendar-month billing to account-anniversary billing based on each account’s registration date.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Billing cycles are now calculated from the account `created_at` date instead of calendar month boundaries.
- Invoices are now generated on each account’s billing anniversary day rather than always on the 1st of the month.
- Accounts created on the 29th, 30th, or 31st now bill on the last valid day of shorter months.
- The billing generator command still uses `billing:generate-monthly-invoices`, but it now runs daily and generates invoices only for accounts due on that date.

### Breaking Changes
- Invoice timing has changed from shared calendar-month billing to per-account anniversary billing.

### Verification
- Updated files:
  - `app/Services/BillingService.php`
  - `routes/console.php`
  - `tests/Feature/BillingTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter='BillingTest|AuthTest'`

## 2026-03-25 | Version: unreleased

### Summary
- Refactored billing gateway handling to use a stricter strategy contract for customer setup, gateway-hosted payment-method setup bootstrapping, saved-card sync, and recurring charge execution without collecting card details in our own UI.

### API Changes
- Added authenticated billing endpoints:
  - `POST /api/v1/billing/payment-methods/setup`
  - `POST /api/v1/billing/payment-methods/sync`
- Billing gateway payloads now expose capability flags for `supports_card_retrieval` and `supports_hosted_card_capture`.
- Billing summary payloads now expose resolved gateway capabilities so `/admin/billing` can switch behavior per gateway.

### Database Changes
- Added masked-only metadata columns to `account_payment_methods`:
  - `funding_type`
  - `bank`
  - `signature`
  - `is_reusable`
  - `retrieved_from_gateway`

### Behavior Changes
- `/admin/billing` no longer presents manual card-entry fields.
- Payment-method setup is now gateway-driven:
  - Stripe bootstraps a setup intent/client-secret flow.
  - Paystack and PayFast expose hosted/redirect setup metadata and rely on masked authorization/token details rather than local card capture.
- Saved payment methods are now normalized through gateway strategy classes and refreshed through a shared sync flow.
- Stripe gateway sync can retrieve masked saved-card data directly from the gateway.
- Paystack and PayFast now explicitly behave as masked metadata/token-based gateways rather than pretending to support direct customer card listing.
- Recurring charges continue to use stored reusable gateway references only.

### Breaking Changes
- The account billing UI no longer supports manually typing gateway card metadata into the application.

### Verification
- Updated files:
  - `app/Services/Billing/Gateways/BillingGatewayInterface.php`
  - `app/Services/Billing/Gateways/StripeBillingGateway.php`
  - `app/Services/Billing/Gateways/PaystackBillingGateway.php`
  - `app/Services/Billing/Gateways/PayfastBillingGateway.php`
  - `app/Services/Billing/Gateways/FreeBillingGateway.php`
  - `app/Services/Billing/Data/*`
  - `app/Services/BillingService.php`
  - `app/Http/Controllers/Api/V1/BillingController.php`
  - `app/Http/Requests/BillingGatewayActionRequest.php`
  - `app/Http/Resources/PaymentGatewayResource.php`
  - `app/Http/Resources/PaymentMethodSetupIntentResource.php`
  - `app/Http/Resources/PaymentMethodSyncResource.php`
  - `app/Http/Resources/AccountBillingSummaryResource.php`
  - `app/Http/Resources/AccountPaymentMethodResource.php`
  - `app/Models/AccountPaymentMethod.php`
  - `database/migrations/2026_03_25_000005_add_masked_gateway_fields_to_account_payment_methods_table.php`
  - `routes/api.php`
  - `website/src/components/billing/account-billing-dashboard.tsx`
  - `website/src/lib/api/billing.ts`
  - `website/src/lib/types.ts`
  - `tests/Feature/BillingTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter='BillingTest|AuthTest'`
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-25 | Version: unreleased

### Summary
- Added an account-based billing system with regional currency/gateway routing, merchant-level pricing plans, invoice generation, payment-method storage, recurring charge commands, a new account billing portal at `/admin/billing`, and a super-admin billing configuration area at `/admin/settings/billing`.

### API Changes
- Added authenticated billing endpoints:
  - `GET /api/v1/billing/summary`
  - `GET /api/v1/billing/gateways`
  - `GET /api/v1/billing/plans`
  - `GET /api/v1/billing/invoices`
  - `GET /api/v1/billing/invoices/{invoice_uuid}`
  - `POST /api/v1/billing/invoices/{invoice_uuid}/charge`
  - `POST /api/v1/billing/payment-methods`
  - `PATCH /api/v1/billing/payment-methods/{payment_method_uuid}/default`
  - `DELETE /api/v1/billing/payment-methods/{payment_method_uuid}`
  - `PATCH /api/v1/billing/merchants/{merchant_uuid}/plan`
- Added super-admin billing catalog endpoints:
  - `GET /api/v1/admin/billing/gateways`
  - `GET /api/v1/admin/billing/country-pricing`
  - `GET /api/v1/admin/billing/plans`
  - `GET /api/v1/admin/billing/accounts`
  - `GET /api/v1/admin/billing/accounts/{account_uuid}`
- `POST /api/v1/auth/register` now requires `country_code` and persists it to the created account.

### Database Changes
- Added billing fields to `accounts`: `country_code`, `is_billing_exempt`.
- Added `merchants.plan_id`.
- Added billing catalog tables: `payment_gateways`, `country_pricing`, `pricing_plans`.
- Added billing runtime tables: `account_billing_profiles`, `account_payment_methods`, `account_invoices`, `account_invoice_lines`, `account_invoice_payment_attempts`.
- Added billing config env variables for Stripe, PayFast, Paystack, and shared invoice defaults in `.env.example`.
- Seeded default gateways, country pricing rows, and starter pricing plans in `DatabaseSeeder`.

### Behavior Changes
- Account billing country now drives resolved currency and payment gateway selection.
- South African accounts resolve to ZAR pricing via PayFast seed data; non-matched countries fall back to USD via the default country-pricing row.
- Merchant plans are now account-billing aware and can be managed by account holders from `/admin/billing`.
- Monthly invoices can be generated per account and broken down by merchant plan charges and extra active vehicles.
- Saved payment methods now store non-sensitive gateway references only, with gateway-specific charge adapters for `free`, `stripe`, `payfast`, and `paystack`.
- Added recurring billing console commands:
  - `php artisan billing:generate-monthly-invoices`
  - `php artisan billing:charge-due-invoices`
- Added SQLite-safe guards to older raw `ALTER TABLE ... MODIFY ...` migrations so feature tests can boot in the default test database.

### Breaking Changes
- Registration requests that omit `country_code` now fail validation.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/BillingController.php`
  - `app/Http/Controllers/Api/V1/AdminBillingController.php`
  - `app/Services/BillingService.php`
  - `app/Services/Billing/*`
  - `app/Models/Account.php`
  - `app/Models/Merchant.php`
  - `app/Models/PaymentGateway.php`
  - `app/Models/CountryPricing.php`
  - `app/Models/PricingPlan.php`
  - `app/Models/AccountBillingProfile.php`
  - `app/Models/AccountPaymentMethod.php`
  - `app/Models/AccountInvoice.php`
  - `app/Models/AccountInvoiceLine.php`
  - `app/Models/AccountInvoicePaymentAttempt.php`
  - `app/Http/Resources/AccountBillingSummaryResource.php`
  - `app/Http/Resources/AccountInvoiceResource.php`
  - `app/Http/Resources/AccountPaymentMethodResource.php`
  - `app/Http/Requests/RegisterRequest.php`
  - `app/Services/AuthService.php`
  - `routes/api.php`
  - `routes/console.php`
  - `config/billing.php`
  - `database/migrations/2026_03_25_000002_create_billing_catalog_tables.php`
  - `database/migrations/2026_03_25_000003_create_account_billing_tables.php`
  - `database/migrations/2026_03_25_000004_add_billing_fields_to_accounts_and_merchants.php`
  - `database/seeders/DatabaseSeeder.php`
  - `website/src/app/admin/billing/page.tsx`
  - `website/src/app/admin/settings/billing/page.tsx`
  - `website/src/components/billing/account-billing-dashboard.tsx`
  - `website/src/components/billing/admin-billing-settings.tsx`
  - `website/src/components/auth/register-form.tsx`
  - `website/src/lib/api/billing.ts`
  - `website/src/lib/navigation.ts`
  - `website/src/lib/routes/admin.ts`
  - `website/src/lib/types.ts`
  - `tests/Feature/AuthTest.php`
  - `tests/Feature/BillingTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter='AuthTest|BillingTest'`
  - `php artisan route:list --path=billing`
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-25 | Version: unreleased

### Summary
- Improved merchant invite acceptance errors so valid invites no longer fall back to the generic "Invite is invalid" message when more specific action is required.

### API Changes
- `POST /api/v1/merchant-invites/accept` now returns specific invite error codes and messages for missing account setup data, expired invites, revoked invites, already accepted invites, and missing tokens.

### Database Changes
- None.

### Behavior Changes
- New users opening a valid invite now receive a clear prompt to set their name and password instead of seeing a misleading invalid-invite error.
- Expired, revoked, already accepted, and missing invite tokens now return specific acceptance messages that the website can surface directly.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/MerchantInviteController.php`
  - `app/Services/InviteService.php`
  - `website/src/components/auth/invite-accept-form.tsx`
  - `tests/Feature/InviteFlowTest.php`
  - `docs/release-notes.md`
- Verification target:
  - Run `php artisan test --filter=InviteFlowTest` to confirm invite acceptance returns the expected success and specific validation error responses.

## 2026-03-25 | Version: unreleased

### Summary
- Extended outbound email logging to persist the rendered HTML message body for each logged email attempt.

### API Changes
- None.

### Database Changes
- Added nullable `email_logs.html_message` to store the rendered email body captured during send attempts.

### Behavior Changes
- `LoggedMailSender` now saves the rendered message body into `email_logs.html_message` before delivery and keeps it on both `sent` and `failed` outcomes.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Models/EmailLog.php`
  - `app/Services/LoggedMailSender.php`
  - `database/migrations/2026_03_25_000001_add_html_message_to_email_logs_table.php`
  - `tests/Feature/EmailLogTest.php`
  - `docs/release-notes.md`
- Verification target:
  - Run `php artisan test --filter=EmailLogTest` to confirm email logs retain the rendered message body for both successful and failed sends.

## 2026-03-23 | Version: unreleased

### Summary
- Added persistent outbound email logging for queued mail sends so invite and shipment failure emails now record delivery attempts and outcomes.

### API Changes
- None.

### Database Changes
- Added `email_logs` table with a unique `uuid`, recipient payloads, mail metadata, contextual foreign keys, and delivery status timestamps for `pending`, `sent`, and `failed` email attempts.

### Behavior Changes
- `SendMerchantInviteEmailJob` now writes an `email_logs` row before sending and updates it to `sent` or `failed` after the mail transport completes.
- `SendOfferFailedEmailJob` now follows the same logging flow, including shipment/environment linkage for later auditing.
- Failed outbound sends now retain the transport exception message in `email_logs.error_message` before the job is re-thrown to Laravel's queue failure handling.
- When `MAIL_MAILER` uses local non-delivery transports like `log` or `array`, invite and offer-failed emails now run synchronously so `email_logs` updates do not depend on a long-running queue worker being restarted.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Jobs/SendMerchantInviteEmailJob.php`
  - `app/Jobs/SendOfferFailedEmailJob.php`
  - `app/Models/EmailLog.php`
  - `app/Services/LoggedMailSender.php`
  - `database/migrations/2026_03_23_000001_create_email_logs_table.php`
  - `tests/Feature/EmailLogTest.php`
  - `docs/release-notes.md`
- Verification target:
  - Run `php artisan test --filter=EmailLogTest` to confirm successful sends are marked `sent` and transport exceptions are marked `failed`.

## 2026-03-22 | Version: unreleased

### Summary
- Added website middleware that forces requests on `app.spaces.za.com` into the admin area instead of rendering the public-facing site.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Requests to the Next.js website on host `app.spaces.za.com` now redirect to `/admin` unless they are already under `/admin`.
- Next.js API routes, internal asset routes, and common metadata files remain accessible without this redirect so admin auth and assets continue to work.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `website/middleware.ts`
  - `docs/release-notes.md`
- Verification target:
  - Confirm `app.spaces.za.com/` redirects to `/admin`.
  - Confirm `app.spaces.za.com/admin` does not redirect again.
  - Confirm Next.js API and asset paths remain unaffected by middleware matching.

## 2026-03-22 | Version: unreleased

### Summary
- Added persisted last accessed merchant selection for regular admin users so the website restores the previously selected merchant after a new login.

### API Changes
- Added authenticated endpoint `PATCH /api/v1/me/last-accessed-merchant` to save the current user’s preferred merchant by merchant UUID.
- `/api/v1/me` now includes `last_accessed_merchant_id` as the preferred merchant UUID when available.

### Database Changes
- Added nullable `users.last_accessed_merchant_id` foreign key referencing `merchants.id` with `nullOnDelete()`.

### Behavior Changes
- Admin merchant switching now persists the selected merchant in Laravel before the website session updates.
- NextAuth merchant bootstrap now falls back to the persisted preferred merchant when no newer in-session selection exists.
- Creating a merchant as a regular user now also marks that merchant as the user’s last accessed merchant.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/MeController.php`
  - `app/Http/Requests/UpdateLastAccessedMerchantRequest.php`
  - `app/Http/Resources/UserResource.php`
  - `app/Models/User.php`
  - `app/Services/MerchantService.php`
  - `database/migrations/2026_03_22_000001_add_last_accessed_merchant_id_to_users_table.php`
  - `routes/api.php`
  - `website/src/components/layout/admin-shell.tsx`
  - `website/src/lib/api/merchants.ts`
  - `website/src/lib/types.ts`
  - `website/src/types/next-auth.d.ts`
  - `tests/Feature/LastAccessedMerchantTest.php`
  - `docs/release-notes.md`
- Verification target:
  - Backend feature tests cover save success, authorization rejection, `/me` payload exposure, and null-on-delete behavior.

## 2026-03-21 | Version: unreleased

### Summary
- Extended vehicle tracking address parsing to persist Mix Telematics `FormattedAddress` values into the vehicle's last known location address.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `TrackVehicleLocationsJob` now checks Mix Telematics `FormattedAddress` in addition to the existing address keys when saving `vehicles.last_location_address`.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Jobs/TrackVehicleLocationsJob.php`
  - `docs/release-notes.md`
- Verified by code review:
  - `extractAddress()` now accepts `FormattedAddress` before falling back to lat/long-only storage.
- Not run:
  - Live Mix Telematics payload sync in this shell session.

## 2026-03-21 | Version: unreleased

### Summary
- Updated vehicle tracking sync so provider-detected drivers are marked active and automatically linked to the detected vehicle when that driver-vehicle pairing does not already exist.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- When `TrackVehicleLocationsJob` receives a provider position with a resolvable driver integration ID, the matched driver now has `drivers.is_active` set to `true`.
- The same tracking sync now creates a `driver_vehicles` assignment for that driver and vehicle if one does not already exist, preserving historical multi-vehicle relationships for drivers who operate different trucks.
- Expanded tracking payload parsing to recognize additional driver identifier keys such as `DriverIntegrationId`, `driver_id`, and `DriverID`.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Jobs/TrackVehicleLocationsJob.php`
  - `docs/release-notes.md`
- Verified by code review:
  - Detected drivers are resolved within the merchant/account scope before status or assignment changes are applied.
  - Assignment creation remains deduplicated through the existing `DriverVehicleService::assignVehicle()` flow.
- Not run:
  - End-to-end provider sync test against a live tracking payload in this shell session.

## 2026-03-21 | Version: unreleased

### Summary
- Switched the Expo mobile app theme source to NativeWind `useColorScheme` / `colorScheme`, added an in-app account screen theme toggle, and started replacing hard-coded mobile colors with semantic design tokens plus a shared text primitive.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Mobile app root navigation theme and status bar now follow NativeWind's active color scheme instead of the plain React Native appearance hook.
- Account screen now includes a theme control that toggles NativeWind between light and dark mode at runtime.
- Existing themed helper components now read the NativeWind-backed color scheme object so shared theme-aware UI keeps working.
- The active theme now propagates across the app shell and major driver flows, including auth, dashboard, shipments, documents, vehicles, and shipment scan/completion screens.
- Mobile styling now has shared semantic color tokens such as `background`, `card`, `primary`, `secondary`, `muted`, `destructive`, `warning`, and `success` defined in `global.css` / Tailwind.
- Converted the main tab, auth, account edit, vehicle detail, shipment detail, shipment scan, and shipment completion screens away from raw Tailwind hex background/text classes to semantic utilities like `bg-background`, `bg-card`, `bg-secondary`, and `text-card-foreground`.
- Added `@/component/ui/Text` as the shared app text primitive with default `text-foreground`, and updated app screens to use it so foreground text color is inherited centrally while still allowing extra classes per usage.
- Replaced unsupported slash-opacity token usage like `text-secondary-foreground/80` with explicit opacity utilities so NativeWind resolves the semantic text colors correctly.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `mobile_app/app/_layout.tsx`
  - `mobile_app/global.css`
  - `mobile_app/tailwind.config.js`
  - `mobile_app/component/ui/Text.tsx`
  - `mobile_app/app/(tabs)/_layout.tsx`
  - `mobile_app/app/(tabs)/index.tsx`
  - `mobile_app/app/(tabs)/bookings.tsx`
  - `mobile_app/app/(tabs)/vehicles.tsx`
  - `mobile_app/app/(tabs)/documents.tsx`
  - `mobile_app/app/(tabs)/explore.tsx`
  - `mobile_app/app/(auth)/login.tsx`
  - `mobile_app/app/(auth)/register.tsx`
  - `mobile_app/app/account/edit-profile.tsx`
  - `mobile_app/app/vehicles/[vehicle_id].tsx`
  - `mobile_app/app/shipments/[shipment_id].tsx`
  - `mobile_app/app/shipments/[shipment_id]/scan.tsx`
  - `mobile_app/app/shipments/completed.tsx`
  - `mobile_app/hooks/use-color-scheme.ts`
  - `mobile_app/hooks/use-color-scheme.web.ts`
  - `mobile_app/hooks/use-theme-color.ts`
  - `mobile_app/components/ui/collapsible.tsx`
  - `mobile_app/components/parallax-scroll-view.tsx`
  - `docs/release-notes.md`
- Verified by:
  - `npx expo lint` in `mobile_app` completed with 0 errors.
  - Root layout now consumes NativeWind `colorScheme` for navigation theme + status bar style.
  - Account screen toggle calls NativeWind `toggleColorScheme()`.
  - Main app screens now use NativeWind semantic color utilities or scheme-aware icon/input colors so toggling applies beyond a single screen.
  - App screens now import the shared `@/component/ui/Text` wrapper instead of raw React Native `Text`.
  - Repo search confirms no remaining hard-coded Tailwind page color classes under `mobile_app/app` / `mobile_app/components`.
- Remaining:
  - Runtime verification on device/simulator was not run in this shell session.

## 2026-03-19 | Version: unreleased

### Summary
- Fixed mobile auth session persistence crash caused by incompatible AsyncStorage native module linkage in Expo.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Mobile app no longer throws `AsyncStorageError: Native module is null, cannot access legacy storage` during session read/write.
- Session storage now auto-falls back to in-memory storage if native AsyncStorage binding is unavailable at runtime.
- Removed verbose auth storage debug logs to reduce console noise.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `mobile_app/package.json`
  - `mobile_app/package-lock.json`
  - `mobile_app/src/lib/auth-storage.ts`
  - `docs/release-notes.md`
- Verified by dependency check:
  - `npx expo install --check` now reports AsyncStorage version compatibility issue resolved (`@react-native-async-storage/async-storage` expected `2.2.0`).
- Not run:
  - Full Expo app runtime smoke test on device/simulator in this shell session.

## 2026-03-19 | Version: unreleased

### Summary
- Audited `DataTable` pagination wiring across app/admin pages and fixed missing URL page forwarding on invoiced shipments.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/shipments/invoiced?page=<n>` now fetches and renders the correct API page instead of always returning page 1.
- Verified other `DataTable` pages with server-backed pagination are already parsing and forwarding `page` correctly.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `website/src/app/admin/logistics/shipments/invoiced/page.tsx`
  - `docs/release-notes.md`
- Verified by code audit:
  - Reviewed all `DataTable` usages under `website/src/app`.
  - Confirmed page passthrough on all paginated server data pages after this fix.
- Not run:
  - Automated tests/lint for this audit task.

## 2026-03-19 | Version: unreleased

### Summary
- Fixed admin shipments pagination so URL query `?page=<n>` is passed to the shipments API and loads the correct page.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Navigating directly to routes like `/admin/logistics/shipments?page=3` now fetches and displays page 3 results instead of always showing page 1.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `website/src/app/admin/logistics/shipments/page.tsx`
  - `docs/release-notes.md`
- Verified logic:
  - `searchParams.page` is parsed and forwarded to `listShipments(..., { page })`.
- Not run:
  - Automated tests/lint for this page (not requested in this task).

## 2026-03-19 | Version: unreleased

### Summary
- Added targeted mobile diagnostics for the driver online/offline toggle to trace where `Unable to update online status.` originates.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Mobile app now logs online-toggle flow milestones:
  - toggle start metadata
  - geolocation availability/success/failure details
  - outgoing `/driver/presence/status` payload
  - successful status response payload
  - structured API error metadata (`status`, `code`, `requestId`, `details`) on failure
- API client request logs now include method + URL and structured failure output for non-success responses.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `mobile_app/app/(tabs)/index.tsx`
  - `mobile_app/src/lib/api.ts`
  - `docs/release-notes.md`
- Could not run:
  - Mobile lint/typecheck/tests (`node`/`npm` not available in shell PATH)

## 2026-03-19 | Version: unreleased

### Summary
- Added driver profile editing in the mobile app with an `Edit profile` action and save flow backed by a new driver profile update endpoint.

### API Changes
- Added `PATCH /api/v1/driver/profile` (driver-role only) to update authenticated driver user profile fields:
  - `name` (`sometimes`, string, max 255)
  - `telephone` (`nullable`, string, max 50)
- Mobile app now calls this endpoint when saving profile updates.

### Database Changes
- None.

### Behavior Changes
- Account tab now includes an `Edit profile` button.
- New mobile screen `/account/edit-profile` allows editing:
  - name
  - telephone
- Save updates backend profile data and refreshes local session user data immediately.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Http/Requests/UpdateDriverProfileRequest.php`
  - `app/Http/Controllers/Api/V1/MeController.php`
  - `routes/api.php`
  - `mobile_app/src/lib/api.ts`
  - `mobile_app/src/providers/auth-provider.tsx`
  - `mobile_app/app/(tabs)/explore.tsx`
  - `mobile_app/app/account/edit-profile.tsx`
  - `mobile_app/app/_layout.tsx`
  - `docs/release-notes.md`
- Could not run:
  - PHP lint (`php` not available in shell PATH)
  - Mobile lint/typecheck/tests (`node`/`npm` not available in shell PATH)

## 2026-03-19 | Version: unreleased

### Summary
- Added shipment status tab filtering on the driver bookings screen with backend support for `active` and `completed` status filters.

### API Changes
- Updated `GET /api/v1/driver/shipments` to support query param `status` values:
  - `active` (returns non-completed statuses)
  - `completed` (returns `delivered`, `failed`, `cancelled`)
  - direct completed values (`delivered`, `failed`, `cancelled`)
- Mobile app now calls `GET /api/v1/driver/shipments?per_page=20&status=<tab>` when loading/switching booking tabs.

### Database Changes
- None.

### Behavior Changes
- Driver Bookings tab defaults to `Active` and fetches active shipments on load.
- Switching to `Completed` refetches shipments with `status=completed`.
- Pull-to-refresh now respects the currently selected shipment tab filter.
- Empty state messaging now changes based on selected tab.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/DriverShipmentController.php`
  - `mobile_app/src/lib/api.ts`
  - `mobile_app/app/(tabs)/bookings.tsx`
  - `docs/release-notes.md`
- Could not run:
  - PHP lint (`php` not available in shell PATH)
  - Mobile lint/typecheck/tests (`node`/`npm` not available in shell PATH)

## 2026-03-19 | Version: unreleased

### Summary
- Enhanced driver online toggle to include current location/device context when updating presence status.

### API Changes
- No backend endpoint contract changes.
- Mobile client now sends additional fields to `POST /api/v1/driver/presence/status` when toggling online/offline:
  - `is_available`
  - `latitude`
  - `longitude`
  - `platform`
  - `user_device_id`

### Database Changes
- None.

### Behavior Changes
- Going online now attempts to fetch current coordinates before status update and submits them immediately.
- Dispatch can receive a fresh location at online-toggle time instead of waiting for the next heartbeat cycle.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `mobile_app/src/lib/api.ts`
  - `mobile_app/app/(tabs)/index.tsx`
  - `docs/release-notes.md`
- Could not run:
  - Mobile lint/typecheck/tests (`node`/`npm` not available in shell PATH)

## 2026-03-19 | Version: unreleased

### Summary
- Fixed driver mobile app online toggle flow to handle the `/driver/presence/status` response shape correctly and avoid false failure messages.

### API Changes
- No backend endpoint contract changes.
- Mobile client now expects `/driver/presence/status` response as device status payload (`user_device_id`, `platform`, `push_provider`, `push_token`, `last_seen_at`) instead of assuming full `DriverPresence`.

### Database Changes
- None.

### Behavior Changes
- Toggling online/offline no longer throws when status response does not include `active_offers` and other presence fields.
- App now updates existing in-memory presence fields safely and waits for heartbeat to refresh full presence/offers payload.
- Removed misleading Promise logging by awaiting the status request before logging response.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `mobile_app/src/lib/api.ts`
  - `mobile_app/app/(tabs)/index.tsx`
  - `docs/release-notes.md`
- Could not run:
  - Mobile lint/typecheck/tests (`node`/`npm` not available in shell PATH)

## 2026-03-19 | Version: unreleased

### Summary
- Added `login_context` support to auth login and enforced admin-only sign-in for the admin web app.

### API Changes
- Updated `POST /api/v1/auth/login` to accept optional `login_context`:
  - `admin`
  - `driver`
- Context enforcement:
  - `admin` accepts only `user` and `super_admin` roles.
  - `driver` accepts only `driver` role.

### Database Changes
- None.

### Behavior Changes
- NextAuth credentials login now sends `login_context: "admin"` for admin web sign-in.
- Admin layout now enforces server-side role guard `["user", "super_admin"]` for all `/admin` routes.
- Driver-role users are blocked from establishing admin web sessions and from rendering admin pages.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Http/Requests/LoginRequest.php`
  - `app/Services/AuthService.php`
  - `website/src/lib/nextauth.ts`
  - `website/src/components/auth/login-form.tsx`
  - `website/src/app/admin/layout.tsx`
- Passed:
  - `/opt/homebrew/bin/php -l app/Http/Requests/LoginRequest.php`
  - `/opt/homebrew/bin/php -l app/Services/AuthService.php`
- Could not run:
  - Frontend lint/typecheck (`node`/`npm` not available in shell PATH)

## 2026-03-19 | Version: unreleased

### Summary
- Added an admin action on the driver detail page to update a driver password via a dedicated dialog and endpoint.

### API Changes
- Added `PATCH /api/v1/drivers/{driver_uuid}/password` for updating a driver password.
- Request payload:
  - `password` (required)
  - `password_confirmation` (required via `confirmed` validation)
- Endpoint is inside admin API role middleware (`role:user,super_admin`), so it is not accessible to driver-role users.

### Database Changes
- None.

### Behavior Changes
- Driver detail `Actions` dropdown now includes `Update password`.
- Selecting it opens a dialog with:
  - New password
  - Confirm new password
- Saving calls the new password endpoint and refreshes driver detail on success.
- Password update activity is logged as `Driver password updated`.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Http/Requests/UpdateDriverPasswordRequest.php`
  - `app/Http/Controllers/Api/V1/DriverController.php`
  - `app/Services/DriverService.php`
  - `routes/api.php`
  - `website/src/lib/api/drivers.ts`
  - `website/src/components/drivers/update-driver-password-dialog.tsx`
  - `website/src/components/drivers/driver-detail-actions.tsx`
- Passed:
  - `/opt/homebrew/bin/php -l app/Http/Requests/UpdateDriverPasswordRequest.php`
  - `/opt/homebrew/bin/php -l app/Http/Controllers/Api/V1/DriverController.php`
  - `/opt/homebrew/bin/php -l app/Services/DriverService.php`
  - `/opt/homebrew/bin/php -l routes/api.php`
- Could not run:
  - `cd website && npm run lint -- --file src/components/drivers/update-driver-password-dialog.tsx --file src/components/drivers/driver-detail-actions.tsx --file src/lib/api/drivers.ts` (Node/NPM not installed in shell PATH)

## 2026-03-19 | Version: unreleased

### Summary
- Switched merchant logo storage and retrieval to AWS S3 disk usage.

### API Changes
- No endpoint shape changes.
- `logo_url` in merchant responses is now generated from S3 storage URLs.

### Database Changes
- None.

### Behavior Changes
- Merchant logo uploads are now written to `s3` disk instead of local/public disk.
- Merchant list/detail logo URLs now resolve from the `s3` disk.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Services/MerchantService.php`
  - `app/Http/Resources/MerchantResource.php`
- Passed:
  - `/opt/homebrew/bin/php -l app/Services/MerchantService.php`
  - `/opt/homebrew/bin/php -l app/Http/Resources/MerchantResource.php`

## 2026-03-19 | Version: unreleased

### Summary
- Refactored admin setup timezone and country inputs into reusable shared components and reused them on the admin settings page.
- Implemented end-to-end settings persistence for merchant name, timezone, operating countries, and merchant logo upload.
- Added merchant logo support to merchant API resources so merchant list responses include logo URL data.

### API Changes
- Added `POST /api/v1/merchants/{merchant_uuid}/logo` (multipart form upload with `logo` image file).
- Updated merchant resource payloads (including list endpoints using `MerchantResource`) to include:
  - `logo_url`

### Database Changes
- Added nullable `logo_path` column to `merchants` table.
  - Migration: `database/migrations/2026_03_19_120000_add_logo_path_to_merchants_table.php`

### Behavior Changes
- `Settings` page now loads selected merchant context and saves:
  - organization name
  - timezone
  - operating countries
  - merchant logo (image upload)
- Setup wizard and settings now share the same country/timezone selector behavior and option sources.
- Uploading a new logo replaces the previous stored merchant logo file path.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `website/src/components/settings/timezone-select.tsx`
  - `website/src/components/settings/country-multi-select.tsx`
  - `website/src/lib/geo-options.ts`
  - `website/src/components/settings/admin-setup-wizard.tsx`
  - `website/src/components/settings/organization-settings-form.tsx`
  - `website/src/app/admin/settings/page.tsx`
  - `website/src/lib/api/merchants.ts`
  - `website/src/lib/types.ts`
  - `app/Http/Requests/UploadMerchantLogoRequest.php`
  - `app/Http/Controllers/Api/V1/MerchantController.php`
  - `app/Services/MerchantService.php`
  - `app/Http/Resources/MerchantResource.php`
  - `app/Models/Merchant.php`
  - `routes/api.php`
  - `database/migrations/2026_03_19_120000_add_logo_path_to_merchants_table.php`
- Passed:
  - `php -l app/Http/Controllers/Api/V1/MerchantController.php`
  - `php -l app/Services/MerchantService.php`
  - `php -l app/Http/Resources/MerchantResource.php`
  - `php -l app/Http/Requests/UploadMerchantLogoRequest.php`
  - `php -l app/Models/Merchant.php`
  - `php -l database/migrations/2026_03_19_120000_add_logo_path_to_merchants_table.php`
  - `php -l routes/api.php`
  - `cd website && npm run lint` (warnings only, no errors)

## 2026-03-18 | Version: unreleased

### Summary
- Normalized `tracking.updated` webhook event identifiers to UUID-based values and removed numeric tracking event ID leakage.

### API Changes
- Webhook payload contract change for `tracking.updated` event payloads:
  - Removed `event.id`
  - Replaced `event.uuid` with `event.event_id`
  - `event.account_id`, `event.merchant_id`, `event.shipment_id`, and `event.booking_id` now carry UUID strings (or `null` for `booking_id` when no booking exists)
- Top-level `shipment_id` and `shipment_uuid` remain unchanged.

### Database Changes
- None.

### Behavior Changes
- `ProcessCarrierWebhookJob` now constructs an explicit outbound `event` payload map instead of forwarding `TrackingEvent::toArray()`.
- Outbound event metadata keeps non-ID fields (`event_code`, `event_description`, `occurred_at`, `payload`, `created_at`, `updated_at`) while ensuring identifier fields are UUID-oriented.

### Breaking Changes
- Webhook consumers relying on numeric `event.id` or `event.uuid` must migrate to `event.event_id` and UUID-based identifier values.

### Verification
- Updated files:
  - `app/Jobs/ProcessCarrierWebhookJob.php`
  - `tests/Feature/CarrierWebhookTest.php`
- Passed:
  - `php -l app/Jobs/ProcessCarrierWebhookJob.php`
  - `php -l tests/Feature/CarrierWebhookTest.php`
- Attempted:
  - `php artisan test --filter=CarrierWebhookTest` (fails in test bootstrap due existing SQLite-incompatible migration `2026_02_06_000004_update_quote_status_enum_add_booked.php` using `ALTER TABLE ... MODIFY ... ENUM ...`)

## 2026-03-18 | Version: unreleased

### Summary
- Added support for address-level location type slug input on shipment create/on-demand/update payloads.

### API Changes
- `POST /api/v1/shipments`
- `POST /api/v1/shipments/on-demand`
- `PATCH /api/v1/shipments/{shipment_uuid}`
- `pickup_address` and `dropoff_address` now accept:
  - `location_type` (slug, e.g. `"dropoff"`)
  - `location_type_slug` (slug alias)
  - alongside existing `location_type_id` (UUID).

### Database Changes
- None.

### Behavior Changes
- Address location type resolution now supports this precedence:
  - `location_type_id` / `location_type_uuid` (UUID) first
  - then `location_type` / `location_type_slug` (slug)
  - then endpoint default slug fallback (`pickup`/`dropoff`/`waypoint` as applicable).

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Http/Requests/StoreShipmentRequest.php`
  - `app/Http/Requests/UpdateShipmentRequest.php`
  - `app/Services/LocationService.php`
- Passed:
  - `php -l app/Http/Requests/StoreShipmentRequest.php`
  - `php -l app/Http/Requests/UpdateShipmentRequest.php`
  - `php -l app/Services/LocationService.php`

## 2026-03-18 | Version: unreleased

### Summary
- Added support for vehicle type code input on shipment create/on-demand/update payloads.

### API Changes
- `POST /api/v1/shipments`
- `POST /api/v1/shipments/on-demand`
- `PATCH /api/v1/shipments/{shipment_uuid}`
- These endpoints now accept `requested_vehicle_type` (vehicle type `code`, e.g. `"motorcycle"`) in addition to `requested_vehicle_type_id` (UUID).

### Database Changes
- None.

### Behavior Changes
- Shipment requested vehicle type resolution now supports:
  - `requested_vehicle_type_id` (UUID) first priority
  - fallback `requested_vehicle_type` (code) when UUID is not supplied.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Http/Requests/StoreShipmentRequest.php`
  - `app/Http/Requests/UpdateShipmentRequest.php`
  - `app/Services/ShipmentService.php`
- Passed:
  - `php -l app/Http/Requests/StoreShipmentRequest.php`
  - `php -l app/Http/Requests/UpdateShipmentRequest.php`
  - `php -l app/Services/ShipmentService.php`

## 2026-03-18 | Version: unreleased

### Summary
- Updated registration auto-login flow to explicitly load merchants and set the selected merchant in session, mirroring login initialization behavior.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- After successful register + auto-login, the frontend now:
  - fetches merchants using the new session access token,
  - creates a default `Main` merchant if none exist,
  - updates NextAuth session with `merchants` and `selected_merchant` before redirecting to dashboard.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/components/auth/register-form.tsx`
- Passed:
  - `cd website && npm run lint`

## 2026-03-18 | Version: unreleased

### Summary
- Fixed registration flow termination caused by an accidental hard `exit()` in the account-id model trait used during user creation.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Removed debug termination statements from `HasAccountId` so `User::create()` can complete normally during registration and downstream logs/DB writes continue.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `app/Http/Traits/HasAccountId.php`
- Passed:
  - `php -l app/Http/Traits/HasAccountId.php`
  - `php -l app/Services/AuthService.php`
  - `php -l app/Http/Controllers/Api/V1/AuthController.php`
  - `php -l app/Http/Requests/RegisterRequest.php`

## 2026-03-18 | Version: unreleased

### Summary
- Added end-to-end registration debug logging across Next.js proxy and Laravel auth flow to trace upstream responses, CORS headers, validation failures, and DB write execution.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `POST /api/auth/register` (Next.js proxy) now logs full upstream response diagnostics: status, headers, raw body, timing, and CORS-related headers (`access-control-allow-*`) with an origin match check.
- Laravel registration now logs:
  - register endpoint invocation metadata in `AuthController@register`
  - validation failure details in `RegisterRequest::failedValidation`
  - service-layer registration milestones (user creation, account creation, token creation) and exceptions in `AuthService::register`.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `website/src/app/api/auth/register/route.ts`
  - `app/Http/Controllers/Api/V1/AuthController.php`
  - `app/Http/Requests/RegisterRequest.php`
  - `app/Services/AuthService.php`
- Passed:
  - `php -l app/Http/Controllers/Api/V1/AuthController.php`
  - `php -l app/Http/Requests/RegisterRequest.php`
  - `php -l app/Services/AuthService.php`
  - `cd website && npm run lint`

## 2026-03-18 | Version: unreleased

### Summary
- Added structured observability logs for the frontend register proxy route to improve debugging of upstream signup failures.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `POST /api/auth/register` now logs request lifecycle events in the Next.js server runtime (`requestId`, duration, upstream status/content-type, and fetch failure details) without logging passwords.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/app/api/auth/register/route.ts`
- Passed:
  - `cd website && npm run lint`

## 2026-03-18 | Version: unreleased

### Summary
- Updated frontend registration flow to always attempt automatic login after successful signup and improved registration failure observability.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- After `POST /api/auth/register` succeeds, the register form now automatically signs in with credentials using `signIn(..., { redirect: false })` and performs explicit client navigation to the dashboard callback URL.
- Registration failures now both display an error in the UI and log structured failure details (`status` and parsed `payload`) to the browser console.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/components/auth/register-form.tsx`
- Passed:
  - `cd website && npm run lint`

## 2026-03-18 | Version: unreleased

### Summary
- Fixed frontend registration CORS failures by moving signup calls to a same-origin Next.js API proxy route.

### API Changes
- Added frontend proxy endpoint `POST /api/auth/register` (Next.js route) to forward registration payloads to backend `POST /api/v1/auth/register`.

### Database Changes
- None.

### Behavior Changes
- Registration from `website` now posts to same-origin `/api/auth/register` instead of calling `NEXT_PUBLIC_API_BASE_URL` directly from the browser, eliminating browser CORS preflight dependency for signup.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `website/src/app/api/auth/register/route.ts`
  - `website/src/components/auth/register-form.tsx`
- Passed:
  - `cd website && npm run lint`

## 2026-03-12 | Version: unreleased

### Summary
- Added a dedicated frontend merchant invite acceptance flow at `/auth/invites` and updated invite emails to use the new auth route.

### API Changes
- `POST /api/v1/merchant-invites/accept` now returns accepted user context (`email`, `name`, `created`) alongside the merchant and membership role so the frontend can complete the invite flow.
- Added `GET /api/v1/merchant-invites/preview?token=...` so the frontend can resolve invite context before acceptance.

### Database Changes
- None.

### Behavior Changes
- Merchant invite emails now link to `/auth/invites?token=...` instead of `/invites/accept?token=...`.
- Added an auth-styled invite acceptance page that starts with an invite review step, then shows a dedicated password setup screen when the invite requires account creation.
- The invite acceptance page now shows invite context up front, including the recipient name when the invited email already belongs to a user account.
- Preserved backward compatibility for older emailed links by redirecting `/invites/accept` to `/auth/invites`.

### Breaking Changes
- None.

### Verification
- Updated backend files:
  - `app/Mail/MerchantInviteMail.php`
  - `app/Http/Controllers/Api/V1/MerchantInviteController.php`
  - `app/Services/InviteService.php`
  - `routes/api.php`
- Updated frontend files:
  - `website/src/app/auth/invites/page.tsx`
  - `website/src/app/invites/accept/page.tsx`
  - `website/src/components/auth/invite-accept-form.tsx`
  - `website/src/lib/api/merchants.ts`
  - `website/src/lib/types.ts`
- Passed:
  - `php -l app/Mail/MerchantInviteMail.php`
  - `php -l app/Http/Controllers/Api/V1/MerchantInviteController.php`
  - `php -l app/Services/InviteService.php`
  - `cd website && npm run build`

## 2026-03-12 | Version: unreleased

### Summary
- Fixed the merchant role migration ordering so MySQL accepts the new membership role values before legacy rows are remapped.

### API Changes
- None.

### Database Changes
- Updated `2026_03_12_120000_update_merchant_roles_for_memberships_and_invites.php` to temporarily widen the `merchant_user.role` and `merchant_invites.role` enums during both `up()` and `down()` before applying role value remaps.

### Behavior Changes
- Prevents the migration from failing with MySQL `Data truncated for column 'role'` when converting legacy merchant roles such as `owner` or `admin` to `member`.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `database/migrations/2026_03_12_120000_update_merchant_roles_for_memberships_and_invites.php`
- Passed:
  - `php -l database/migrations/2026_03_12_120000_update_merchant_roles_for_memberships_and_invites.php`

## 2026-03-12 | Version: unreleased

### Summary
- Added merchant-scoped user management with the new membership roles `account_holder`, `member`, `modifier`, `biller`, and `resource_viewer`, including a unified users/invites settings experience and dedicated user detail pages.

### API Changes
- Added merchant people endpoints:
  - `GET /api/v1/merchants/{merchant_uuid}/users`
  - `POST /api/v1/merchants/{merchant_uuid}/users`
  - `GET /api/v1/merchants/{merchant_uuid}/users/{person_uuid}`
  - `PATCH /api/v1/merchants/{merchant_uuid}/users/{person_uuid}`
  - `DELETE /api/v1/merchants/{merchant_uuid}/users/{person_uuid}`
  - `POST /api/v1/merchants/{merchant_uuid}/users/{person_uuid}/resend`
- Merchant responses now include merchant-specific access metadata for the authenticated user.
- Merchant member/invite validation now accepts and normalizes the new merchant role model.

### Database Changes
- Added migration `2026_03_12_120000_update_merchant_roles_for_memberships_and_invites.php` to remap legacy merchant membership and invite roles to the new merchant-specific role set and update MySQL enums.

### Behavior Changes
- Account holders are treated as members of every merchant in their account and can create merchants, view merchant users, and invite users without requiring explicit membership on every merchant.
- Merchant user management moved to `/admin/settings/users` for the selected merchant and now combines active members and pending invites in one list.
- Added dedicated merchant user detail pages at `/admin/settings/users/[userId]` with role editing, invite resend, and remove/revoke actions.
- Merchant users can no longer change their own membership role from the frontend user detail screen, but can update their own name and telephone details there.
- Hidden the settings Users navigation entry for merchant users who do not have user-management permission.
- Merchant resource and membership policies now use the new merchant access resolver instead of the legacy `owner/admin/developer/billing/read_only` checks.

### Breaking Changes
- Merchant membership and invite roles now use `account_holder`, `member`, `modifier`, `biller`, and `resource_viewer` as the primary role set.

### Verification
- Updated backend files:
  - `app/Support/MerchantAccess.php`
  - `app/Services/MerchantService.php`
  - `app/Services/MerchantUserService.php`
  - `app/Services/InviteService.php`
  - `app/Policies/MerchantPolicy.php`
  - `app/Policies/ShipmentPolicy.php`
  - `app/Policies/QuotePolicy.php`
  - `app/Policies/BookingPolicy.php`
  - `app/Policies/RoutePolicy.php`
  - `app/Policies/RunPolicy.php`
  - `app/Policies/MerchantEnvironmentPolicy.php`
  - `app/Policies/WebhookSubscriptionPolicy.php`
  - `app/Http/Controllers/Api/V1/MerchantUserController.php`
  - `app/Http/Resources/MerchantPersonResource.php`
  - `routes/api.php`
- Updated frontend files:
  - `website/src/app/admin/settings/users/page.tsx`
  - `website/src/app/admin/settings/users/[userId]/page.tsx`
  - `website/src/components/users/merchant-user-profile-dialog.tsx`
  - `website/src/components/users/merchant-user-invite-dialog.tsx`
  - `website/src/components/users/merchant-user-role-dialog.tsx`
  - `website/src/components/users/merchant-user-resend-button.tsx`
  - `website/src/components/users/merchant-user-delete-dialog.tsx`
  - `website/src/lib/api/merchants.ts`
  - `website/src/lib/types.ts`
  - `website/src/lib/auth.ts`
  - `website/src/lib/nextauth.ts`
  - `website/src/types/next-auth.d.ts`
  - `website/src/components/layout/admin-nav.tsx`
- Passed:
  - `php -l app/Support/MerchantAccess.php`
  - `php -l app/Services/MerchantUserService.php`
  - `php -l app/Http/Controllers/Api/V1/MerchantUserController.php`
  - `php -l app/Http/Resources/MerchantPersonResource.php`
  - `cd website && npm run build`
- Test limitation:
  - `php artisan test --filter=InviteFlowTest` is currently blocked by a pre-existing SQLite-incompatible migration (`ALTER TABLE ... MODIFY`) outside this change set.

## 2026-03-12 | Version: unreleased

### Summary
- Fixed multiple dashboard/detail component prop type mismatches uncovered by the website production build.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Driver dashboard dialog, driver detail view, and location detail view now normalize nullable `merchantId` props to `undefined` before passing them into child components that require `string | undefined`.
- Prevented TypeScript build failures triggered during `npm run build` in the `website` app.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `website/src/components/dashboard/driver-dialog-content.tsx`
  - `website/src/components/drivers/driver-detail-content.tsx`
  - `website/src/components/locations/location-detail-content.tsx`
- Production build passed:
  - `cd website && npm run build`
- Build completed with existing lint warnings in unrelated files, but no blocking errors.

## 2026-03-12 | Version: unreleased

### Summary
- Fixed dashboard driver dialog file section prop typing for nullable merchant IDs.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Driver dashboard dialog now converts nullable `merchantId` values to `undefined` before passing them into the files section component.
- Prevents TypeScript build failure where `null` was passed to a prop expecting `string | undefined`.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/components/dashboard/driver-dialog-content.tsx`
- Environment limitation:
  - `npm`/`node` unavailable in this environment, so local build could not be executed.

## 2026-03-12 | Version: unreleased

### Summary
- Fixed webhook subscriptions settings page data mapping type error by narrowing successful API responses before accessing `data`.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/settings/subscriptions` now uses an explicit `successResponse` guard before mapping subscription rows and normalizing pagination metadata.
- Prevents TypeScript build failure where `.map` was attempted on a union containing non-array `data`.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/app/admin/settings/subscriptions/page.tsx`
- Environment limitation:
  - `npm`/`node` unavailable in this environment, so local build could not be executed.

## 2026-03-12 | Version: unreleased

### Summary
- Fixed webhook subscriptions settings page TypeScript narrowing for API error handling.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/settings/subscriptions` now reads error messages from a properly narrowed API error object before rendering `loading_error`.
- Prevents TypeScript build failure where `message` was accessed on a non-error API response union.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/app/admin/settings/subscriptions/page.tsx`
- Environment limitation:
  - `npm`/`node` unavailable in this environment, so local build could not be executed.

## 2026-03-12 | Version: unreleased

### Summary
- Fixed missing documents analytics page pagination meta typing for `DataTable`.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/analytics/missing-documents` now normalizes pagination metadata before passing it to `DataTable`.
- Keeps `summary_by_type` from raw report metadata while using strict pagination shape for table rendering.
- Prevents TypeScript build failure caused by optional pagination fields in raw API `meta`.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/app/admin/logistics/analytics/missing-documents/page.tsx`
- Environment limitation:
  - `npm`/`node` unavailable in this environment, so local build could not be executed.

## 2026-03-12 | Version: unreleased

### Summary
- Fixed document expiry analytics page pagination meta typing for `DataTable`.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/analytics/document-expiry` now normalizes API pagination metadata before passing it to `DataTable`.
- Prevents TypeScript build failure caused by optional pagination fields in raw API `meta`.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/app/admin/logistics/analytics/document-expiry/page.tsx`
- Environment limitation:
  - `npm`/`node` unavailable in this environment, so local build could not be executed.

## 2026-03-11 | Version: unreleased

### Summary
- Fixed document coverage analytics page pagination meta typing for `DataTable`.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/analytics/document-coverage` now normalizes API pagination metadata before passing it to `DataTable`, ensuring required pagination fields are present.
- Prevents TypeScript build failure caused by optional pagination fields in raw API `meta`.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/app/admin/logistics/analytics/document-coverage/page.tsx`
- Environment limitation:
  - `npm`/`node` unavailable in this environment, so local build could not be executed.

## 2026-03-11 | Version: unreleased

### Summary
- Fixed webhook deliveries list page type safety when creating detail links from optional delivery IDs.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/(super)/webhook-deliveries` now generates row `href` only when `delivery_id` exists; otherwise it falls back to an empty link value.
- Prevents TypeScript build failure from passing `string | undefined` to `AdminRoute.webhookDeliveryDetails`.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/app/admin/(super)/webhook-deliveries/page.tsx`
- Environment limitation:
  - `npm`/`node` unavailable in this environment, so local build could not be executed.

## 2026-03-11 | Version: unreleased

### Summary
- Fixed webhook delivery detail page type safety for breadcrumb/title rendering when delivery fields are missing.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/(super)/webhook-deliveries/[deliveryId]` now safely falls back to default display values when a webhook delivery record has missing optional fields (`delivery_id`, `event`, `status`, `createdAt`).
- Prevents TypeScript build failure caused by passing `string | undefined` to breadcrumb labels.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/app/admin/(super)/webhook-deliveries/[deliveryId]/page.tsx`
- Environment limitation:
  - `npm`/`node` unavailable in this environment, so local build could not be executed.

## 2026-03-11 | Version: unreleased

### Summary
- Added route efficiency stats on route details with a new backend stats endpoint and frontend analytics cards/tooltips.

### API Changes
- Added `GET /api/v1/routes/{route_uuid}/stats`.
- Added optional query params on route stats endpoint:
  - `merchant_id`
  - `from` (`YYYY-MM-DD`)
  - `to` (`YYYY-MM-DD`)
- Endpoint returns:
  - route summary metrics (distance/time/utilization/idle/speeds/stops)
  - return-to-collection metrics
  - driver/route/fleet benchmark averages and deltas
  - time breakdown and timeline segments
  - data quality and calculation definitions metadata

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/routes/[routeId]` now displays a **Route Efficiency** section with:
  - key KPI cards (distance variance, driving/idle/utilization/speed, stop completion)
  - return-to-collection performance
  - benchmark comparison values and deltas
  - time breakdown bars and timeline segment summaries
- Added explanatory tooltips for route stats labels on the frontend.
- If stats fail to load, the route detail page still renders and shows a scoped stats error card.

### Breaking Changes
- None.

### Verification
- Backend files updated:
  - `routes/api.php`
  - `app/Http/Controllers/Api/V1/RouteController.php`
  - `app/Http/Requests/RouteStatsRequest.php`
  - `app/Services/RouteStatsService.php`
- Frontend files updated:
  - `website/src/lib/types.ts`
  - `website/src/lib/api/routes.ts`
  - `website/src/components/routes/route-stats-panel.tsx`
  - `website/src/app/admin/logistics/routes/[routeId]/page.tsx`
- Environment limitations:
  - `php` binary unavailable, so PHP syntax checks could not be executed.
  - `npm` binary unavailable, so frontend lint checks could not be executed.

## 2026-03-11 | Version: unreleased

### Summary
- Fixed Admin Logistics Routes sorting and added backend sort support for the routes listing endpoint.

### API Changes
- `GET /api/v1/routes` now supports:
  - `sort_by`: `created_at|updated_at|title|code|estimated_distance|estimated_duration`
  - `sort_dir`: `asc|desc`
- Added request validation for routes listing via `ListRoutesRequest`.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/routes` table headers are now sortable for:
  - `Title`
  - `Code`
  - `Distance (km)`
  - `Duration (min)`
  - `Updated`
- Sorting now applies server-side and remains consistent with pagination/filter query params.
- Routes list search input now maps to backend filtering across `title`, `code`, and `description`.

### Breaking Changes
- None.

### Verification
- Frontend lint passed:
  - `src/app/admin/logistics/routes/page.tsx`
  - `src/lib/api/routes.ts`
- Backend wiring reviewed:
  - `app/Http/Requests/ListRoutesRequest.php`
  - `app/Http/Controllers/Api/V1/RouteController.php`
  - `app/Services/RouteService.php`
- PHP syntax checks could not be run in this environment (`php` command unavailable).

## 2026-03-11 | Version: unreleased

### Summary
- Updated the **Add Subscription** form to match the new edit form UI and behavior.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Replaced the generic create-resource dialog on `/admin/webhooks/subscriptions` with a webhook-specific create dialog.
- New create dialog now uses:
  - the same event-type cards
  - shadcn `Switch` controls
  - the same endpoint URL input style as edit
- Create flow now submits `merchant_id`, `url`, and selected `event_types` to create subscriptions and refreshes the list on success.

### Breaking Changes
- None.

### Verification
- Frontend lint passed:
  - `src/app/admin/webhooks/subscriptions/page.tsx`
  - `src/components/webhooks/webhook-subscription-create-dialog.tsx`

## 2026-03-11 | Version: unreleased

### Summary
- Refined webhook subscription edit event picker by removing `Webhook Test` from selectable events and switching controls to shadcn `Switch`.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Edit dialog event list no longer includes `webhook.test` as a selectable subscription event.
- Event selection UI now uses shadcn `Switch` controls instead of native checkboxes.
- Existing legacy/custom events saved on a subscription are still displayed and can be toggled.

### Breaking Changes
- None.

### Verification
- Frontend lint passed:
  - `src/components/webhooks/webhook-subscription-detail-actions.tsx`
  - `src/lib/webhooks.ts`

## 2026-03-11 | Version: unreleased

### Summary
- Updated webhook subscription edit dialog to present selectable event types instead of free-text event input.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- On `/admin/webhooks/subscriptions/[subscriptionId]` edit action:
  - Users now select event subscriptions from a list of available webhook event types.
  - Existing saved custom/legacy event keys are preserved and shown as selectable options.
- Saves continue to use `PATCH /api/v1/webhooks/subscriptions/{subscription_uuid}` with selected `event_types`.

### Breaking Changes
- None.

### Verification
- Frontend lint passed:
  - `src/components/webhooks/webhook-subscription-detail-actions.tsx`
  - `src/lib/webhooks.ts`

## 2026-03-11 | Version: unreleased

### Summary
- Added `Edit` action to webhook subscription detail page with a dialog to update endpoint URL and event types.

### API Changes
- Added `PATCH /api/v1/webhooks/subscriptions/{subscription_uuid}` to update webhook subscriptions.
- Added `UpdateWebhookSubscriptionRequest` validation for partial updates:
  - `url` (optional, valid URL)
  - `event_types` (optional array, minimum one item when provided)

### Database Changes
- None.

### Behavior Changes
- Webhook subscription detail page actions now include:
  - `Edit` (opens dialog, updates subscription, refreshes page)
  - `Test`
  - `Delete`
- Edit dialog pre-fills current URL and event types from subscription data.

### Breaking Changes
- None.

### Verification
- Frontend lint passed for updated files:
  - `src/app/admin/webhooks/subscriptions/[subscriptionId]/page.tsx`
  - `src/components/webhooks/webhook-subscription-detail-actions.tsx`
  - `src/lib/api/webhooks.ts`
- Backend route/controller/request/policy wiring reviewed:
  - `routes/api.php`
  - `app/Http/Controllers/Api/V1/WebhookSubscriptionController.php`
  - `app/Http/Requests/UpdateWebhookSubscriptionRequest.php`
  - `app/Policies/WebhookSubscriptionPolicy.php`
- PHP syntax checks could not be run in this environment (`php` command unavailable).

## 2026-03-11 | Version: unreleased

### Summary
- Added a webhook subscription detail page with delivery attempt/response history and actionable `Test`/`Delete` controls.

### API Changes
- Added `GET /api/v1/webhooks/subscriptions/{subscription_uuid}` to fetch:
  - subscription details
  - paginated delivery attempts for that subscription
- `WebhookDeliveryResource` now also returns:
  - `attempts`
  - `last_response_code`
  - `last_response_body`
  - `last_attempt_at`
  - `created_at`
  - compatibility aliases (`delivery_id`, `event`, `createdAt`)

### Database Changes
- None.

### Behavior Changes
- `/admin/webhooks/subscriptions` rows now link to a dedicated detail page.
- New page `/admin/webhooks/subscriptions/[subscriptionId]` shows:
  - endpoint details (URL, status, subscribed events)
  - delivery attempts table with response code/body and attempt count
  - actions dropdown with `Test` and `Delete`
- `Delete` now confirms in a dialog, then redirects back to subscriptions list on success.
- `Test` queues a webhook test delivery and refreshes page data.

### Breaking Changes
- None.

### Verification
- Frontend lint passed for changed website files, including new detail page and actions component.
- Backend logic reviewed for route/controller/resource wiring:
  - `routes/api.php`
  - `app/Http/Controllers/Api/V1/WebhookSubscriptionController.php`
  - `app/Http/Resources/WebhookDeliveryResource.php`
- PHP syntax checks could not be run in this environment (`php` command unavailable).

## 2026-03-11 | Version: unreleased

### Summary
- Fixed Admin Settings webhook subscriptions frontend to use merchant-scoped listing and corrected table field rendering.

### API Changes
- `GET /api/v1/webhooks/subscriptions` frontend client now sends `merchant_id` from the currently selected merchant context.
- Endpoint behavior verified in controller code: `WebhookSubscriptionController@index` accepts `merchant_id` (or `merchant_uuid`) and filters records by that merchant.

### Database Changes
- None.

### Behavior Changes
- `/admin/webhooks/subscriptions` now only loads subscriptions for the currently selected merchant (for merchant users).
- When no merchant is selected, the page now shows a clear prompt instead of attempting an unscoped request.
- Events and created timestamp now render correctly from API fields (`event_types`, `created_at`).

### Breaking Changes
- None.

### Verification
- Frontend lint passed for touched files:
  - `src/app/admin/webhooks/subscriptions/page.tsx`
  - `src/lib/api/webhooks.ts`
  - `src/lib/types.ts`
- Code review confirmed backend filtering in `app/Http/Controllers/Api/V1/WebhookSubscriptionController.php`.

## 2026-03-11 | Version: unreleased

### Summary
- Added DataTable-based sorting to Logistics Analytics document reports (`Missing Documents`, `Expired/Expiring Documents`, `Upload Coverage by Type`) with backend-supported sort params.

### API Changes
- `GET /api/v1/reports/missing-documents` now accepts:
  - `sort_by`: `merchant_name|entity_type|entity_label|file_type_name`
  - `sort_dir`: `asc|desc`
- `GET /api/v1/reports/document-expiry` now accepts:
  - `sort_by`: `merchant_name|entity_type|entity_label|file_type_name|original_name|uploaded_at|expires_at|days_to_expiry`
  - `sort_dir`: `asc|desc`
- `GET /api/v1/reports/document-coverage` now accepts:
  - `sort_by`: `merchant_name|entity_type|file_type_name|required_count|uploaded_count|missing_count|expired_count|compliance_percent`
  - `sort_dir`: `asc|desc`

### Database Changes
- None.

### Behavior Changes
- Replaced report table markup with shared `DataTable` component on:
  - `/admin/logistics/analytics/missing-documents`
  - `/admin/logistics/analytics/document-expiry`
  - `/admin/logistics/analytics/document-coverage`
- Added clickable sortable headers on these pages, with sorting persisted in URL query params and applied by report endpoints.
- Existing filters and pagination remain functional and now work with sort state.

### Breaking Changes
- None.

### Verification
- Code review confirmed the three analytics pages now render `DataTable` and pass `enableSorting`, `sortableColumns`, and `sortKeyMap`.
- Code review confirmed backend request validation and controller logic accept and apply allow-listed `sort_by`/`sort_dir`.
- Automated lint/build not run in this environment because `npm` is unavailable.
- PHP syntax checks not run in this environment because `php` is unavailable.

### Internal Changes
- Added report sort parameter typing in `website/src/lib/api/reports.ts`.

## 2026-03-11 | Version: unreleased

### Summary
- Fixed analytics report runtime error caused by passing server-side functions into client `DataTable` props.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Table-based analytics pages (`route-waiting-times`, `drivers-speeding`, `stops-analysis`) now render without the React Server/Client serialization error.
- Formatted values (minutes, speed, latest timestamps) remain displayed in the same columns.

### Breaking Changes
- None.

### Verification
- Code review confirmed `customValue` function props were removed from `DataTable` column definitions in affected server pages.
- Code review confirmed each page now maps preformatted display fields into row data for client-safe rendering.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Replaced `customValue` callbacks with precomputed `*Display` fields in analytics report rows.

## 2026-03-11 | Version: unreleased

### Summary
- Migrated table-based Logistics Analytics reports to the shared `DataTable` component.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The following analytics report tables now use the standard `DataTable` UI with consistent styling and sorting indicators:
  - `/admin/logistics/analytics/route-waiting-times`
  - `/admin/logistics/analytics/drivers-speeding`
  - `/admin/logistics/analytics/stops-analysis`
- Existing URL sorting behavior (`sort_by`, `sort_dir`) remains supported for these pages.

### Breaking Changes
- None.

### Verification
- Code review confirmed raw table markup was replaced with `DataTable` on all three analytics pages.
- Code review confirmed sort key mappings and custom formatted values (`minutes`, `kph`, `date/time`) still render correctly.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Added `DataTable` column configs with `customValue` and `sortKeyMap` for aggregated analytics row models.

## 2026-03-11 | Version: unreleased

### Summary
- Added clickable column sorting controls to table-based Logistics Analytics pages.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Added URL-driven sorting (`sort_by`, `sort_dir`) for:
  - `/admin/logistics/analytics/route-waiting-times`
  - `/admin/logistics/analytics/drivers-speeding`
  - `/admin/logistics/analytics/stops-analysis`
- Table headers are now clickable and toggle ascending/descending order per column on each page.

### Breaking Changes
- None.

### Verification
- Code review confirmed each analytics page now parses `searchParams` sorting values and applies deterministic in-page row sorting.
- Code review confirmed headers render sortable links via `withAdminQuery(...)` and analytics route constants.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Introduced per-page sort normalization and sorting helpers for aggregated analytics row models.

## 2026-03-11 | Version: unreleased

### Summary
- Enabled server-backed sorting for the Admin Settings Users table.

### API Changes
- `GET /api/v1/admin/users` now supports sorting params:
  - `sort_by`: `created_at|name|email|role`
  - `sort_dir`: `asc|desc`

### Database Changes
- None.

### Behavior Changes
- `/admin/settings/users` now supports sortable headers for:
  - `Name`
  - `Email`
  - `Role`
- Sorting is applied on the backend and preserved through pagination.

### Breaking Changes
- None.

### Verification
- Code review confirmed users table now enables sorting and passes `sort_by`/`sort_dir`.
- Code review confirmed `AdminController::users()` applies allow-listed sorting with fallback direction.
- Automated lint/build not run in this environment because `npm` is unavailable.
- PHP syntax check not run in this environment because `php` is unavailable.

### Internal Changes
- Added users page sort normalization and admin API client sort param typing.

## 2026-03-11 | Version: unreleased

### Summary
- Enabled server-backed sorting for the Admin Logistics Carriers table.

### API Changes
- `GET /api/v1/carriers` now supports sorting params:
  - `sort_by`: `created_at|name|code|type|enabled`
  - `sort_dir`: `asc|desc`

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/carriers` now supports sortable headers for:
  - `Carrier`
  - `Code`
  - `Type`
- Sorting is applied on the backend and preserved through pagination.

### Breaking Changes
- None.

### Verification
- Code review confirmed carriers table now enables sorting and sends `sort_by`/`sort_dir`.
- Code review confirmed `AdminCarrierController@index` now applies allow-listed sorting with direction fallback.
- Automated lint/build not run in this environment because `npm` is unavailable.
- PHP syntax check not run in this environment because `php` is unavailable.

### Internal Changes
- Added carriers page sort normalization and API client sort param typing.

## 2026-03-11 | Version: unreleased

### Summary
- Enabled server-backed sorting for the Admin Logistics Bookings table.

### API Changes
- `GET /api/v1/bookings` and `/api/v1/admin/bookings` now support sorting params handled by booking list service:
  - `sort_by`: `created_at|uuid|shipment_id|status|booked_at`
  - `sort_dir`: `asc|desc`

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/shipments/bookings` now supports sortable headers for:
  - `Booking`
  - `Shipment`
  - `Status`
  - `Scheduled`
- Sorting is applied at the API layer and preserved through pagination.

### Breaking Changes
- None.

### Verification
- Code review confirmed bookings table now enables sorting and passes `sort_by`/`sort_dir`.
- Code review confirmed `BookingService` now applies allow-listed sorting for both account and environment listing flows.
- Automated lint/build not run in this environment because `npm` is unavailable.
- PHP syntax check not run in this environment because `php` is unavailable.

### Internal Changes
- Added `applyListSorting()` helper in `BookingService` and sort key mapping in bookings page (`booking_id -> uuid`, `scheduledAt -> booked_at`).

## 2026-03-11 | Version: unreleased

### Summary
- Enabled server-backed sorting for the Admin Logistics Quotes table.

### API Changes
- `GET /api/v1/quotes` now supports sorting params used by the list service:
  - `sort_by`: `created_at|merchant_order_ref|collection_date|status|expires_at|requested_at`
  - `sort_dir`: `asc|desc`

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/shipments/quotes` now supports sortable headers for:
  - `Order Ref`
  - `Collection Date`
  - `Status`
  - `Expires At`
  - `Requested At`
- Sorting is applied on the backend and preserved through pagination.

### Breaking Changes
- None.

### Verification
- Code review confirmed quotes table enables sorting and passes `sort_by`/`sort_dir`.
- Code review confirmed `QuoteService::listQuotes()` applies allow-listed sort keys with direction fallback.
- Automated lint/build not run in this environment because `npm` is unavailable.
- PHP syntax check not run in this environment because `php` is unavailable.

### Internal Changes
- Added sort param typing to quotes API client and sort normalization in quotes admin page.

## 2026-03-11 | Version: unreleased

### Summary
- Enabled server-backed sorting for the Admin Logistics Vehicles table.

### API Changes
- `GET /api/v1/vehicles` now accepts sorting params consumed by the service:
  - `sort_by`: `created_at|plate_number|type|make|model|is_active`
  - `sort_dir`: `asc|desc`

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/vehicles` now supports sortable headers for `Plate`, `Type`, `Make`, `Model`, and `Status`.
- Type sorting orders by vehicle type name; status sorting maps to `is_active`.

### Breaking Changes
- None.

### Verification
- Code review confirmed vehicles table now enables sorting and sends `sort_by`/`sort_dir`.
- Code review confirmed `VehicleService::listVehicles()` applies allow-listed sorting and joins `vehicle_types` when sorting by type.
- Code review confirmed scoped/filter/search clauses are qualified with `vehicles.*` to avoid ambiguous columns when joins are applied.
- Automated lint/build not run in this environment because `npm` is unavailable.
- PHP syntax check not run in this environment because `php` is unavailable.

### Internal Changes
- Added sort param typing to `listVehicles` API client and sort key mapping in vehicles page table config.

## 2026-03-11 | Version: unreleased

### Summary
- Fixed SQL ambiguity in Locations listing after enabling `Type` sorting.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/locations` no longer throws a SQL error when listing/sorting locations (including `Type` sort).

### Breaking Changes
- None.

### Verification
- Code review confirmed `LocationService::listLocations()` now qualifies location table columns (`locations.*`) in filters/search clauses to avoid ambiguous column references during joins.
- Automated lint/build not run in this environment because `npm` is unavailable.
- PHP syntax check not run in this environment because `php` is unavailable.

### Internal Changes
- Hardened query column qualification in location list service to remain safe when joining `location_types` for sorting.

## 2026-03-11 | Version: unreleased

### Summary
- Fixed Locations table sorting for the `Type` column.

### API Changes
- Extended `GET /api/v1/locations` sorting allow-list:
  - `sort_by` now also supports `type`.

### Database Changes
- None.

### Behavior Changes
- On `/admin/logistics/locations`, clicking the `Type` column header now sorts results by location type title.

### Breaking Changes
- None.

### Verification
- Code review confirmed frontend table marks `type` as sortable and sends `sort_by=type`.
- Code review confirmed `ListLocationsRequest` now validates `type` in `sort_by`.
- Code review confirmed `LocationService::listLocations()` joins `location_types` and orders by `location_types.title` for `sort_by=type`.
- Automated lint/build not run in this environment because `npm` is unavailable.
- PHP syntax check not run in this environment because `php` is unavailable.

### Internal Changes
- Updated location sort normalization and backend sortable column mapping to include `type`.

## 2026-03-11 | Version: unreleased

### Summary
- Enabled server-backed sorting for the Admin Logistics Locations table.

### API Changes
- `GET /api/v1/locations` now supports:
  - `sort_by`: `created_at|name|code|company|city`
  - `sort_dir`: `asc|desc`

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/locations` now allows clicking sortable column headers (`Name`, `Code`, `Company`, `City`) to sort results.
- Sorting is applied on the backend and reflected in paginated results.

### Breaking Changes
- None.

### Verification
- Code review confirmed frontend table now sends `sort_by` and `sort_dir` and enables sortable columns.
- Code review confirmed `ListLocationsRequest` validates `sort_by` and `sort_dir`.
- Code review confirmed `LocationService::listLocations()` applies dynamic sort with safe allow-list fallback.
- Automated lint/build not run in this environment because `npm` is unavailable.
- PHP syntax check not run in this environment because `php` is unavailable.

### Internal Changes
- Added location list sort normalization in `website/src/app/admin/logistics/locations/page.tsx` and typed sort params in `website/src/lib/api/locations.ts`.

## 2026-03-10 | Version: unreleased

### Summary
- Added in-page driver and location detail dialogs to the Locations Activity view so users can inspect those entities without leaving the page.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- In `/admin/logistics/locations/activity`:
  - Driver links in Truck details and Location details now open a driver dialog instead of navigating away.
  - Location links in Truck details and Location details now open a location dialog instead of navigating away.
  - New dialogs match the existing shipment dialog flow and stay above high-z activity overlays.

### Breaking Changes
- None.

### Verification
- Code review confirmed new dialog components and content loaders:
  - `website/src/components/dashboard/driver-map-dialog.tsx`
  - `website/src/components/dashboard/driver-dialog-content.tsx`
  - `website/src/components/dashboard/location-map-dialog.tsx`
  - `website/src/components/dashboard/location-dialog-content.tsx`
- Code review confirmed activity page now opens driver/location dialogs from detail panel references.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Reused existing driver/location detail UI building blocks in new client-side dialog content components for map-context rendering.

## 2026-03-10 | Version: unreleased

### Summary
- Refactored the admin location detail route to use a reusable location detail content component, aligned with the shipment detail page pattern.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- No intended user-facing behavior change; location detail data, actions, and layout remain the same.

### Breaking Changes
- None.

### Verification
- Code review confirmed `website/src/app/admin/logistics/locations/[locationId]/page.tsx` now only resolves auth/params and delegates rendering.
- Code review confirmed location detail data-loading and UI moved into `website/src/components/locations/location-detail-content.tsx`.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Added reusable server component `LocationDetailContent` with `locationId`, `accessToken`, `merchantId`, and `embedded` props for composable location detail rendering.

## 2026-03-10 | Version: unreleased

### Summary
- Refactored the admin driver detail route to use a reusable driver detail content component, matching the shipment detail page structure.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- No user-facing behavior changes intended; driver detail UI and data remain the same.

### Breaking Changes
- None.

### Verification
- Code review confirmed `website/src/app/admin/logistics/drivers/[driverId]/page.tsx` is now a thin auth/params wrapper.
- Code review confirmed driver detail rendering and data loading moved to `website/src/components/drivers/driver-detail-content.tsx`.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Added reusable server component `DriverDetailContent` with `driverId`, `accessToken`, `merchantId`, and `embedded` props for composable driver-detail reuse.

## 2026-03-10 | Version: unreleased

### Summary
- Expanded contextual linking in Locations Activity truck details to navigate or open related resources faster.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- In `/admin/logistics/locations/activity` truck details:
  - Vehicle reference now links to vehicle details when `vehicleId` exists.
  - Event type now links to filtered vehicle activities when `vehicleId` exists.
  - Driver integration reference now links to driver details when `driverId` exists.
  - Driver email/phone now use `mailto:` and `tel:` links.
  - Shipment destination links to location details when location is known.
  - Shipment status now opens the shipment dialog when `shipmentId` exists.

### Breaking Changes
- None.

### Verification
- Code review confirmed additional links/buttons route to `vehicle`, `driver`, `location`, and shipment dialog contexts using available IDs.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Added `openShipmentDialog` callback and reused existing admin route helpers (`AdminLinks`, `withAdminQuery`) in truck details rendering.

## 2026-03-10 | Version: unreleased

### Summary
- Increased shipment stop timeline connector thickness and removed visible gaps between adjacent stop cards.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Shipment stop connector rails are now 2px thick.
- Connector segments extend by 1px beyond each card boundary so lines visually touch from one stop card to the next.

### Breaking Changes
- None.

### Verification
- Code review confirmed timeline rails now use `w-[2px]` with `-top-px`/`-bottom-px` overlap in the stop list.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Refined connector segment classes in `website/src/components/shipments/shipment-stops-overview.tsx`.

## 2026-03-10 | Version: unreleased

### Summary
- Improved shipment stops timeline UI to render a continuous connector line between stop markers.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- In shipment stop overview cards, timeline connector lines now stay visually connected between entries even when stop card heights vary.
- Active and hover card states were slightly refined for clearer timeline focus.

### Breaking Changes
- None.

### Verification
- Code review confirmed per-stop connector rails now render with top/bottom half segments around each stop marker.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Updated timeline card rendering in `website/src/components/shipments/shipment-stops-overview.tsx` to remove fixed-height connector blocks.

## 2026-03-10 | Version: unreleased

### Summary
- Made the truck details shipment `Reference` field open the shipment dialog when linked shipment data exists.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- In `/admin/logistics/locations/activity`, clicking `Reference` under Truck details now opens the shipment details dialog if `shipmentRecord.shipmentId` is available.

### Breaking Changes
- None.

### Verification
- Code review confirmed `Reference` now renders as a button and sets `selectedShipmentId` from `selectedTruck.shipmentRecord.shipmentId`.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Reused existing dialog open state (`selectedShipmentId`) for additional shipment reference entry point.

## 2026-03-10 | Version: unreleased

### Summary
- Raised the shipment dialog overlay z-index to fully cover high-z activity page UI elements.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Shipment dialog backdrop now overlays activity HUD elements (search controls, totals, floating cards) on `/admin/logistics/locations/activity`.

### Breaking Changes
- None.

### Verification
- Code review confirmed `ShipmentMapDialog` now applies `overlayClassName=\"z-[2147483647]\"`.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Updated per-dialog overlay layering configuration in `ShipmentMapDialog`.

## 2026-03-10 | Version: unreleased

### Summary
- Raised shipment dialog stacking order so it renders above high-z overlays in the locations activity view.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Shipment details dialog now reliably appears above activity HUD panels (search input, activity badges, vehicle totals) in `/admin/logistics/locations/activity`.

### Breaking Changes
- None.

### Verification
- Code review confirmed `ShipmentMapDialog` now sets content to `z-[2147483647]` and overlay to `z-[2147483646]`.
- Code review confirmed shared `DialogContent` now supports `overlayClassName` for targeted z-index overrides.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Extended `DialogContent` API with an optional `overlayClassName` prop for per-dialog layering control.

## 2026-03-10 | Version: unreleased

### Summary
- Changed shipment click behavior in Locations Activity truck details to open the in-page shipment dialog instead of navigating away.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- In `/admin/logistics/locations/activity`, clicking a truck shipment reference now opens the `ShipmentMapDialog` with shipment details.
- Users stay on the activity view context while reviewing shipment details.

### Breaking Changes
- None.

### Verification
- Manual UI review in `website/src/app/admin/logistics/locations/activity/page.tsx` confirms shipment reference now triggers `selectedShipmentId` dialog state.
- Attempted automated lint was not run in this environment because `npm` is not available.

### Internal Changes
- Reused the existing dashboard shipment dialog component (`ShipmentMapDialog`) in the locations activity page.

## 2026-03-10 | Version: unreleased

### Summary
- Updated vehicle activity timeline entries to link to location details only when the location record is present in the activity payload.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- In `Latest vehicle activities`, location text is now clickable only when `activity.location.location_id` exists.
- Activities that only have a raw `location_id` (without a loaded `location` entry) now render non-clickable location text to avoid broken navigation.

### Breaking Changes
- None.

### Verification
- Manual review of timeline rendering confirms location links now require `activity.location.location_id`.
- Attempted `npm --prefix website run lint -- src/components/vehicles/vehicle-activity-timeline-card.tsx` (failed in this environment: `npm` command not found).

### Internal Changes
- Refined timeline link rendering logic in `website/src/components/vehicles/vehicle-activity-timeline-card.tsx` to derive links from nested location resources.

## 2026-03-10 | Version: unreleased

### Summary
- Scoped dashboard summary stats and created-over-time analytics to the actively selected merchant when the admin UI has a merchant context, and started persisting `merchant_id` on vehicles.

### API Changes
- Updated `GET /api/v1/reports/dashboard_stats` to accept optional `merchant_id` filtering.
- Updated `GET /api/v1/reports/created_over_time` to accept optional `merchant_id` filtering.
- Updated `GET /api/v1/reports/shipments_full_report` to consume optional `merchant_id` filtering.
- Updated vehicle create/update payloads to persist `merchant_id`, and vehicle detail fetch now honors merchant-scoped filtering.

### Database Changes
- Added nullable `merchant_id` to `vehicles` with a backfill from runs, vehicle activity, driver assignments, and single-merchant accounts.

### Behavior Changes
- Admin dashboard and logistics analytics now send the selected merchant UUID when requesting dashboard stats.
- Admin dashboard and logistics analytics now send the selected merchant UUID when requesting created-over-time chart data.
- Admin logistics analytics now sends selected merchant UUID when requesting shipment full report data.
- Route Waiting Times analytics now sends selected merchant UUID on paginated shipment full report requests.
- Locations activity API polling now consistently reuses the selected merchant UUID for vehicle check and vehicle activity requests.
- All pages under `/admin/logistics/analytics/*` now resolve merchant scope from `session.selected_merchant` and send that UUID to their analytics endpoints.
- `GET /api/v1/vehicles/latest-activity-check` now scopes its vehicle base set by `vehicles.merchant_id` (selected merchant) instead of broad account-level matching.
- Dashboard stat counts now respect the provided merchant filter for shipments, bookings, quotes, merchants, and members.
- Dashboard `Total fleet` now counts vehicles using the actual `vehicles` schema instead of the removed/nonexistent `status` column path.
- Created-over-time chart counts now respect the provided merchant filter for quotes, shipments, and bookings.
- New and imported vehicles now store the selected merchant, and vehicle merchant filtering now uses the vehicle record's `merchant_id`.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `php -l app/Http/Requests/DashboardStatsReportRequest.php`
- `php -l app/Http/Requests/CreatedOverTimeReportRequest.php`
- `php -l app/Services/VehicleService.php`
- `php -l app/Services/VehicleActivityService.php`
- `php -l database/migrations/2026_03_10_120000_add_merchant_id_to_vehicles_table.php`
- Reviewed `storage/logs/laravel.log` and removed the failing dashboard vehicle count path that queried `vehicles.status`.

### Internal Changes
- Extended the website reports API client to pass `merchant_id` through `getDashboardStats`.

## 2026-03-05 | Version: unreleased

### Summary
- Upgraded Postman collections to YAML-based v3 schema files for easier review and source control diffs.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Added YAML Postman collection files:
  - `postman/collections/Courier Integrate API - Drivers.postman_collection.yaml`
  - `postman/collections/Courier Integrate API - Super Admins.postman_collection.yaml`
  - `postman/collections/Courier Integrate API.postman_collection.yaml`
- Updated collection schema reference in YAML files to `https://schema.getpostman.com/json/collection/v3.0.0/collection.json`.

### Breaking Changes
- None.

### Verification
- Confirmed all YAML files were generated from the corresponding JSON collections and include the v3 schema URL.

### Internal Changes
- Preserved original JSON collections and added YAML variants alongside them.


## 2026-03-04 | Version: unreleased

### Summary
- Added `Expired / Expiring Documents` and `Upload Coverage by Type` reports with dedicated backend APIs and analytics pages.

### API Changes
- Added `GET /api/v1/reports/document-expiry`:
  - Params: `merchant_id`, `entity_type`, `status` (`expired|expiring`), `expiring_in_days`, `page`, `per_page`.
  - Returns paginated document rows with expiry status and days-to-expiry.
- Added `GET /api/v1/reports/document-coverage`:
  - Params: `merchant_id`, `entity_type`, `page`, `per_page`.
  - Returns paginated coverage rows per merchant/entity/file type with required/uploaded/missing/expired counts and compliance percent.

### Database Changes
- None.

### Behavior Changes
- Added analytics page: `/admin/logistics/analytics/document-expiry`.
- Added analytics page: `/admin/logistics/analytics/document-coverage`.
- Added navigation items:
  - `Expired / Expiring Documents`
  - `Upload Coverage by Type`

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `php -l app/Http/Requests/DocumentComplianceReportRequest.php`
- `php -l app/Http/Requests/MissingDocumentsReportRequest.php`
- `npm run build` (in `website/`)

### Internal Changes
- Added shared document-compliance request validation and report client typings for expiry/coverage payloads.

## 2026-03-04 | Version: unreleased

### Summary
- Added a new `Missing Documents` analytics report to identify entries that do not have required uploads by active file type.

### API Changes
- Added `GET /api/v1/reports/missing-documents`.
- Query params:
  - `merchant_id` (optional, UUID)
  - `entity_type` (optional: `shipment`, `driver`, `vehicle`)
  - `per_page` (optional, max 200)
  - `page` (optional)
- Response includes paginated missing-document rows and `summary_by_type` in metadata.

### Database Changes
- None.

### Behavior Changes
- Added analytics page: `/admin/logistics/analytics/missing-documents`.
- Added `Missing Documents` item under Logistics > Analytics navigation.
- Report displays:
  - Summary counts of missing entries per merchant/entity/document type.
  - Detailed missing rows with links to entity detail pages.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `php -l app/Http/Requests/MissingDocumentsReportRequest.php`
- `npm run build` (in `website/`)

### Internal Changes
- Extended reports API client/types and admin route constants to support missing-documents analytics.

## 2026-03-04 | Version: unreleased

### Summary
- Added three logistics analytics reports: Route Waiting Times, Stops Analysis, and Drivers Speeding.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Added new analytics pages:
  - `/admin/logistics/analytics/route-waiting-times`
  - `/admin/logistics/analytics/stops-analysis`
  - `/admin/logistics/analytics/drivers-speeding`
- Updated analytics navigation links so each submenu item opens its dedicated report page.
- Reports use existing shipment full report and vehicle activity data to compute route wait times, stop dwell metrics, and driver speeding aggregates.

### Breaking Changes
- None.

### Verification
- `npm run build` (in `website/`)

### Internal Changes
- Extended frontend admin routes and report row typing (`from_time_out`) to support route wait-time calculations.

## 2026-03-04 | Version: unreleased

### Summary
- Removed standalone `end_run` from location automation and renamed `start_run` in the UI to `End run & start new run` to match the enforced lifecycle.

### API Changes
- `PUT /api/v1/merchants/{merchant_uuid}/location-automation` no longer accepts `end_run` as an action.
- Supported action set is now:
  - `record_vehicle_entry`
  - `record_vehicle_exit`
  - `start_run`
  - `create_shipment`

### Database Changes
- None.

### Behavior Changes
- Stored automation rules containing `end_run` are ignored by runtime execution.
- Admin automation action pickers no longer offer `End run`; the rollover behavior remains part of `start_run`.
- Action display text now explicitly communicates rollover behavior as `End run & start new run`.

### Breaking Changes
- Existing clients that submit `end_run` in location automation updates will fail validation and must migrate to `start_run`.

### Verification
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Http/Requests/UpdateMerchantLocationAutomationRequest.php`
- `npm --prefix website run build`

### Internal Changes
- Removed dead `completeActiveRunAtLocation` execution path tied to configured `end_run`.

## 2026-03-04 | Version: unreleased

### Summary
- Simplified location automation lifecycle actions and updated auto-run/auto-shipment sequencing to rely on vehicle entry/exit, run start/end, and shipment creation only.

### API Changes
- `PUT /api/v1/merchants/{merchant_uuid}/location-automation` now accepts this reduced action set for `entry`/`exit` rules:
  - `record_vehicle_entry`
  - `record_vehicle_exit`
  - `start_run`
  - `end_run`
  - `create_shipment`

### Database Changes
- None.

### Behavior Changes
- Shipment delivery completion is now triggered by vehicle geofence exit, which closes the open shipment delivery stage timing and marks the matching auto-created shipment as delivered.
- Auto-created shipments are constrained to one shipment per `run_id + dropoff_location_id`.
- Auto-created shipment `collection_date` is now set to at least one second after run start to preserve chronological stage ordering.
- `start_run` now rolls over runs by ending the current run first only when that run already has shipments; runs with no shipments remain open and are reused.
- Default fallback automation rules were simplified:
  - Entry: `record_vehicle_entry`, optional `start_run`, optional `create_shipment`
  - Exit: `record_vehicle_exit`

### Breaking Changes
- Saved automation configurations using removed actions (`attach_to_active_run`, `mark_origin_departure`, `mark_shipment_collected`, `mark_shipment_delivered`, `update_run_destination`) must be updated before re-saving through the API/UI.

### Verification
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Http/Requests/UpdateMerchantLocationAutomationRequest.php`
- `php -l tests/Feature/AutoRunLifecycleServiceTest.php`
- `php artisan test tests/Feature/AutoRunLifecycleServiceTest.php` (fails in this environment due to existing SQLite-incompatible migration SQL: `ALTER TABLE ... MODIFY ... ENUM ...`)

### Internal Changes
- Removed legacy action options from validation/types/UI and aligned local docs to the reduced lifecycle action model.

## 2026-03-04 | Version: unreleased

### Summary
- Fixed shared table layout constraints so wide tables scroll within their container instead of stretching parent layouts.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Data tables now keep their parent container width in flex/grid layouts and use horizontal scrolling for overflow content.

### Breaking Changes
- None.

### Verification
- Not run; change is limited to shared table container CSS classes.

### Internal Changes
- Added `min-w-0`/`max-w-full` constraints to shared table wrappers in `website/src/components/ui/table.tsx` and `website/src/components/common/data-table.tsx`.

## 2026-03-04 | Version: unreleased

### Summary
- Fixed the tracking view type mismatch that was blocking the website production build.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- None at runtime; the shipment tracking page helper now accepts the nullable location shape already used by run stop data.

### Breaking Changes
- None.

### Verification
- `npm run build` (in `website/`)

### Internal Changes
- Relaxed the `formatRunStopLocation` helper input type in `website/src/components/tracking/runs-tracking-view.tsx` to match the actual stop payload shape used during build-time type checking.

## 2026-03-04 | Version: unreleased

### Summary
- Changed run tracking search to query the runs endpoint instead of filtering only the already loaded client-side list.

### API Changes
- `GET /api/v1/runs` now accepts a `search` parameter that filters by run UUID, status, service area, notes, driver name/email, and vehicle plate/reference.

### Database Changes
- None.

### Behavior Changes
- Typing in the tracking page search box now refreshes the run list from the API and keeps infinite loading aligned to the active search term.
- Empty search results now show a search-specific empty state instead of reusing the generic no-runs message.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/RunService.php`

### Internal Changes
- Replaced local run filtering in the tracking view with a deferred server-backed fetch path and propagated the active search term into paginated load-more requests.

## 2026-03-04 | Version: unreleased

### Summary
- Added total parcel counts to the run tracking view.

### API Changes
- `GET /api/v1/runs` shipment entries now include `total_parcel_count` for each run shipment when parcel data is loaded.

### Database Changes
- None.

### Behavior Changes
- The shipment tracking page now shows the real total parcel count for the selected run instead of a placeholder.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/RunService.php`
- `php -l app/Http/Resources/RunResource.php`

### Internal Changes
- The run listing service now eager-loads shipment parcels so the tracking summary can aggregate parcel totals without extra requests.

## 2026-03-04 | Version: unreleased

### Summary
- Added location type display to the shipment tracking stop details.

### API Changes
- Vehicle activity location payloads now include nested location type metadata (`title`, `slug`, `icon`) so tracking and activity-based stop views can display the location type consistently.

### Database Changes
- None.

### Behavior Changes
- The shipment tracking page now shows `Location type` in the stop detail panel when the selected stop has location type information.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Resources/VehicleActivityResource.php`

### Internal Changes
- Extended the website stop/location type definitions and reused them in the shared stop overview component.

## 2026-03-04 | Version: unreleased

### Summary
- Improved the run tracking map so it can render planned route locations when live stop activity coordinates are not available yet.

### API Changes
- `GET /api/v1/runs` now includes full route stop location details inside `route.stops`, including address and coordinates, for tracking consumers.

### Database Changes
- None.

### Behavior Changes
- The shipment tracking page now falls back to route-plan stops for the map and stop list when the run has no mapped vehicle activity stops yet.
- Run tracking maps should now load location markers more reliably for newly planned or lightly updated runs.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Resources/RunResource.php`

### Internal Changes
- Corrected the website run type to treat `run.stops` as vehicle-activity-shaped stop records and added `run.route` typing for route-plan fallback rendering.

## 2026-03-04 | Version: unreleased

### Summary
- Added automation action and condition context to vehicle activity metadata for records created while location automation actions execute.

### API Changes
- `vehicle_activity.metadata` for automation-triggered records now includes an `automation_action` object with the executed action name, action ID, event, location context, and condition details.

### Database Changes
- None.

### Behavior Changes
- Vehicle activities emitted by configured location automation now record which automation action triggered them and whether that action had conditions, including the matched condition list and count.
- Visit metadata automation execution logs now also record action IDs plus condition presence and count.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/AutoRunLifecycleService.php`

### Internal Changes
- Wrapped configured action execution in a temporary automation context so downstream `recordVehicleActivity()` calls inherit consistent automation metadata automatically.

## 2026-03-04 | Version: unreleased

### Summary
- Improved location automation flow-map event node interaction so the full event card can be used to add actions.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The `On Entry` and `On Exit` nodes in the location automation flow map are now directly clickable instead of relying on a small floating control, making them easier to interact with.

### Breaking Changes
- None.

### Verification
- Not run; change is limited to event-node interaction behavior in the website UI.

### Internal Changes
- Replaced the event node's small positioned button with a full-card add-action trigger and corrected it to call the add-action handler.

## 2026-03-04 | Version: unreleased

### Summary
- Added inline action-type dropdowns to the location automation flow map nodes.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Admin users can now change an automation action directly from the flow map node instead of switching to the rule editor list below.

### Breaking Changes
- None.

### Verification
- Not run; change is limited to the website flow-map interaction UI.

### Internal Changes
- Passed the existing `updateActionType` handler into React Flow node data so custom action nodes can render the shared action selector.

## 2026-03-04 | Version: unreleased

### Summary
- Changed location automation action descriptions from inline copy to info-icon tooltips.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The location automation flow cards and action editor rows now show detailed action help in a hover/focus tooltip instead of always-visible text, reducing visual clutter while keeping the runtime explanation available.

### Breaking Changes
- None.

### Verification
- Not run; change is limited to tooltip-based presentation in the website UI.

### Internal Changes
- Reused the shared tooltip component for action help in the location automation manager.

## 2026-03-04 | Version: unreleased

### Summary
- Added a markdown reference document listing the current location automation actions and their reviewed descriptions.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- None at runtime.

### Breaking Changes
- None.

### Verification
- Reviewed `docs/location-automation-actions.md` for action coverage and description alignment with the current automation UI copy.

### Internal Changes
- Added `docs/location-automation-actions.md` with a two-column action name/description table for location automation review.

## 2026-03-04 | Version: unreleased

### Summary
- Expanded location automation action descriptions so each option explains the real runtime side effects it can trigger.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The location automation UI now describes when actions only document the existing visit record versus when they create runs, attach shipments, update bookings, increment attempts, or record additional vehicle activity events.

### Breaking Changes
- None.

### Verification
- Not run; change is limited to descriptive copy in the website UI.

### Internal Changes
- Updated `ACTION_OPTIONS` descriptions in the location automation manager to match `AutoRunLifecycleService` behavior more closely.

## 2026-03-04 | Version: unreleased

### Summary
- Added visible action descriptions to the location automation flow cards and action editor rows.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Admin users can now read a short explanation for each automation action directly in the flow canvas and in the per-step editor.

### Breaking Changes
- None.

### Verification
- Not run; change is limited to rendering existing action description text in the website UI.

### Internal Changes
- Reused the existing `ACTION_OPTIONS` description metadata instead of introducing new action copy sources.

## 2026-03-04 | Version: unreleased

### Summary
- Replaced the vehicle activities page filter form with the shared `DataTable` filter controls.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Vehicle activity filtering now uses the table's built-in filter tray for merchant, vehicle, location, plate number, event type, date range, and page size.
- Resetting to the full list now uses the `All` table view instead of a standalone form reset button.

### Breaking Changes
- None.

### Verification
- Not run; change is limited to filter UI wiring in the Next.js page.

### Internal Changes
- Removed the custom GET form from the vehicle activities page and mapped its existing query params to `DataTable.filters`.

## 2026-03-04 | Version: unreleased

### Summary
- Fixed the vehicle activities table so the vehicle column links to the correct vehicle detail page.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Clicking a vehicle in the admin vehicle activities table now opens the matching vehicle detail page.

### Breaking Changes
- None.

### Verification
- Not run; change is limited to the vehicle link mapping in the Next.js table row data.

### Internal Changes
- Updated the vehicle activity row mapper to use `vehicle.vehicle_id` from the API resource instead of the missing top-level `vehicle_id` field for `vehicle_href`.

## 2026-03-04 | Version: unreleased

### Summary
- Expanded vehicle activity table linking so operational columns open the relevant related record or activity detail page.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The vehicle activities table now links `Occurred`, `Event`, `Coordinates`, `Speed / Limit`, and `Run ID` cells to the vehicle activity detail view.
- Merchant, vehicle, driver, location, shipment, and activity ID cells continue linking to their corresponding entity pages.

### Breaking Changes
- None.

### Verification
- Not run; change is limited to static column link configuration in the Next.js page.

### Internal Changes
- Updated the admin vehicle activities table column definitions to reuse the existing `activity_href` link target for detail-oriented cells.

## 2026-03-04 | Version: unreleased

### Summary
- Added a dedicated admin vehicle activity detail view with related entity links, event timing, speed, coordinates, and raw metadata.

### API Changes
- Added `GET /api/v1/vehicle-activities/{activity_uuid}` to fetch one scoped vehicle activity record.

### Database Changes
- None.

### Behavior Changes
- The vehicle activities table now links each activity ID to a dedicated detail page.
- Admin users can inspect one vehicle event in more depth, including the related vehicle, driver, location, shipment, visit timestamps, and map coordinates.

### Breaking Changes
- None.

### Verification
- `npm run build` (in `website/`)

### Internal Changes
- Extended the website vehicle activity API helper/types and added a scoped backend fetch method for single-record activity retrieval.

## 2026-03-04 | Version: unreleased

### Summary
- Fixed the website production build by correcting the React Flow node state typing used by the location automation settings canvas.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- None at runtime; the admin location automation page now passes Next.js production type-checking during `npm run build`.

### Breaking Changes
- None.

### Verification
- `npm run build` (in `website/`)

### Internal Changes
- Updated `website/src/components/settings/location-automation-manager.tsx` to use `useNodesState<Node<FlowNodeData>>` so the hook generic matches `@xyflow/react`'s node constraint.

## 2026-03-04 | Version: unreleased

### Summary
- Wired `AutoRunLifecycleService` to execute saved merchant location automation rules for location entry and exit events.

### API Changes
- None beyond the previously added merchant location automation GET/PATCH endpoints.

### Database Changes
- None beyond the previously added `merchants.location_automation_settings` JSON column.

### Behavior Changes
- Auto run and auto shipment lifecycle handling now reads the selected merchant's saved `entry` and `exit` actions for the visited location type.
- When no saved rule exists for a location type yet, the lifecycle still falls back to the previous collection/delivery-point-based default behavior so existing flows keep working.
- Supported runtime actions now include starting runs, ending runs, creating shipments, attaching visits to active runs, marking origin departure, marking shipments delivered, updating run destinations, and recording automation execution metadata on `vehicle_activity.metadata`.
- Location automation conditions are now evaluated at runtime against the current run, shipment, and location context before each configured action executes.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l tests/Feature/AutoRunLifecycleServiceTest.php`
- `php artisan test --filter=AutoRunLifecycleServiceTest` (blocked by existing SQLite-incompatible migration `2026_02_06_000004_update_quote_status_enum_add_booked.php`)

### Internal Changes
- Added a saved-rule execution layer in `AutoRunLifecycleService` so future location automation changes can be applied without re-hardcoding merchant behavior in service branches.

## 2026-03-04 | Version: unreleased

### Summary
- Connected the website `Location Automation` settings page to the new merchant location automation GET/PATCH endpoints.

### API Changes
- None beyond the previously added `GET /api/v1/merchants/{merchant_uuid}/location-automation` and `PATCH /api/v1/merchants/{merchant_uuid}/location-automation` endpoints.

### Database Changes
- None beyond the previously added `merchants.location_automation_settings` JSON column.

### Behavior Changes
- The website location automation page now loads persisted merchant automation rules from the API instead of relying on browser-local draft state.
- Saving the flow editor now persists the selected merchant's `entry` and `exit` rule graph through the PATCH endpoint.
- Merchants with no saved automation rules now still get default editor rows generated from their current location types, which can then be saved to the API.
- The page now shows a `Saved` versus `Unsaved changes` state based on the current rule graph.

### Breaking Changes
- None.

### Verification
- `cd website && npx eslint src/components/settings/location-automation-manager.tsx src/lib/api/location-automation.ts`

### Internal Changes
- Added a dedicated website API helper for merchant location automation and merged server-saved rules with current location types before rendering the editor.

## 2026-03-04 | Version: unreleased

### Summary
- Added dedicated merchant location automation GET/PATCH endpoints backed by persisted merchant-level location automation settings.

### API Changes
- Added `GET /api/v1/merchants/{merchant_uuid}/location-automation` to return merchant-wide location automation settings and the current `enabled` state.
- Added `PATCH /api/v1/merchants/{merchant_uuid}/location-automation` to update the merchant-wide location automation rule graph and optionally toggle `enabled`.

### Database Changes
- Added nullable `location_automation_settings` JSON to `merchants`.

### Behavior Changes
- Merchant owners/admins and super admins can now persist location automation rules per merchant instead of relying only on browser-local draft state.
- The location automation payload now validates action types, condition fields/operators, and rejects `location_type_id` values that do not belong to the route merchant.
- Location automation responses now include current location type metadata such as name, slug, icon, and color alongside the stored `entry` and `exit` rules.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/UpdateMerchantLocationAutomationRequest.php`
- `php -l app/Http/Resources/MerchantLocationAutomationResource.php`
- `php -l app/Services/MerchantService.php`
- `php -l app/Http/Controllers/Api/V1/MerchantController.php`
- `php -l tests/Feature/MerchantTest.php`
- `php artisan test --filter=MerchantTest` (blocked by existing SQLite-incompatible migration `2026_02_06_000004_update_quote_status_enum_add_booked.php`)

### Internal Changes
- Stored a snapshot of location type presentation metadata together with the automation rules so GET responses remain usable even if the location type details change later.

## 2026-03-03 | Version: unreleased

### Summary
- Added a new admin `Location Automation` settings page with a UI-first editor for merchant-wide vehicle visit automation rules grouped by merchant location type, now rendered in a single draggable flow diagram with `@xyflow/react`.

### API Changes
- None.
- Reused the existing `PATCH /api/v1/merchants/{merchant_uuid}/settings` endpoint to toggle `allow_auto_shipment_creations_at_locations` from the new page.

### Database Changes
- None.

### Behavior Changes
- The admin settings area now includes a `Location Automation` page at `admin/settings/location-automation`.
- Users can now review merchant location types in a single shared flow canvas where location types run across the top, each type has `Entry` and `Exit` child nodes, and actions are arranged beneath those event nodes.
- Users can now configure ordered draft `entry` and `exit` action lists per location type with drag-and-drop reordering directly in the diagram, with action nodes stacked vertically under each event node.
- Users can now add actions directly from each event node and remove actions directly from action nodes without leaving the diagram.
- Flow diagram add/remove buttons inside custom nodes now respond correctly instead of being swallowed by React Flow drag and pan gestures.
- Flow diagram node controls now stop pointer, mouse, and touch gestures early so add/remove buttons remain clickable inside draggable custom nodes.
- Widened each location type branch in the flow canvas so longer action labels like `Record vehicle exit` have more horizontal room before wrapping.
- Entry and exit action stacks now both load directly beneath their own event nodes instead of placing exit actions much lower on initial render.
- Increased the vertical spacing between stacked action nodes so multi-line action cards no longer overlap on initial load.
- Each action now supports draft condition rows in the UI so future automation endpoint payloads have a clear editing model.
- The page persists draft action matrices locally in the browser per merchant while backend GET/PATCH automation endpoints are still pending.
- The page exposes the existing merchant automation enable/disable switch in-context so users can toggle location automation without leaving the editor.

### Breaking Changes
- None.

### Verification
- `cd website && npx eslint src/components/settings/location-automation-manager.tsx src/app/admin/settings/location-automation/page.tsx src/app/admin/settings/page.tsx src/lib/routes/admin.ts src/lib/navigation.ts src/lib/types.ts`

### Internal Changes
- Added shared frontend types for location automation rules, actions, and conditions to support later API integration without redesigning the UI.
- Added the `@xyflow/react` dependency to support node-based rule editing on the website.

## 2026-03-03 | Version: unreleased

### Summary
- Refined the shipment stops overview dialog so it only shows stop detail rows and section headers when corresponding data is present.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Shipment stop detail dialogs in the website admin no longer render placeholder rows for missing vehicle, driver, location, or shipment context fields.
- Stop details now still show valid zero-like values such as `0` coordinates or speed values instead of hiding them.

### Breaking Changes
- None.

### Verification
- `cd website && npx eslint src/components/shipments/shipment-stops-overview.tsx`

### Internal Changes
- Added display-value guards and section row builders to centralize conditional detail rendering.

## 2026-03-02 | Version: unreleased

### Summary
- Added standalone merchant data purge support for `vehicle_activity`, so vehicle activity logs can be deleted without also purging runs, vehicles, or locations.

### API Changes
- Extended `POST /api/v1/merchants/{merchant_uuid}/purge-data` so `types` now accepts `vehicle_activity` as a valid purge target.

### Database Changes
- None.

### Behavior Changes
- Merchant account owners can now submit a purge request with only `vehicle_activity` selected and remove just that merchant's vehicle activity records.
- Purging `vehicle_activity` no longer requires deleting the related vehicles, runs, or locations as a side effect.
- The admin settings delete-data screen now exposes `Vehicle activity` as its own selectable purge option and clarifies that it can be deleted independently.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/DataPurgeService.php`
- `php -l tests/Feature/DataPurgeControllerTest.php`
- `php artisan test --filter=DataPurgeControllerTest`
- `cd website && npx eslint src/lib/api/delete-data.ts src/components/settings/delete-data-manager.tsx`

### Internal Changes
- Added a dedicated purge handler for the `vehicle_activity` table and a focused feature test for the purge endpoint.

## 2026-03-02 | Version: unreleased

### Summary
- Added a live admin dashboard bookings map backed by a new mapped bookings report endpoint, with vehicle plate search, status-count legend overlays, and shipment details opened in an AJAX-loaded dialog from map markers.

### API Changes
- Added `GET /api/v1/reports/mapped-bookings` to return active mapped bookings for the authenticated user, with optional `merchant_id` and `search` filters.
- The mapped bookings report searches booking UUID, shipment UUID, merchant order reference, driver name, vehicle plate number, and vehicle reference code.
- The mapped bookings payload now returns map-ready rows containing `booking_id`, `shipment_id`, `status`, `latitude`, `longitude`, `merchant_order_ref`, `driver_name`, `vehicle_plate_number`, `vehicle_label`, and `updated_at`, plus `meta.counts_by_status`.

### Database Changes
- None.

### Behavior Changes
- The admin dashboard now shows a `Live bookings map` card for the selected merchant, plotting active bookings with status-colored markers.
- The map legend now floats over the bottom of the map and shows filtered counts like `In transit - 20`.
- Dashboard users can now search the live map by vehicle plate number, booking, shipment, merchant order reference, driver name, or vehicle reference code.
- Clicking a map marker now opens the related shipment details inside a dialog without refreshing the page; the dialog fetches shipment data over the API and keeps the full shipment detail page route available.
- Shipment detail rendering is now shared between the standalone shipment page and the dashboard dialog so both surfaces stay aligned.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/MappedBookingsReportRequest.php`
- `php -l app/Http/Resources/MappedBookingReportResource.php`
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `php -l app/Models/Shipment.php`
- `php -l routes/api.php`
- `cd website && npx eslint src/app/admin/page.tsx 'src/app/admin/logistics/shipments/[shipmentId]/page.tsx' src/components/shipments/shipment-detail-content.tsx src/components/dashboard/mapped-bookings-map-card.tsx src/components/dashboard/shipment-map-dialog.tsx src/lib/api/reports.ts src/lib/types.ts src/components/common/status-badge.tsx`
- `cd website && npm run build`

### Internal Changes
- Added a dedicated mapped bookings report request/resource pair and extracted the shipment detail page body into a reusable component for dialog embedding.

## 2026-03-01 | Version: unreleased

### Summary
- Added fleet maintenance tracking for vehicles, a dashboard fleet status pie chart, and vehicle detail actions to place vehicles in and out of maintenance mode.

### API Changes
- Added `GET /api/v1/reports/fleet_status` to return `active`, `maintenance`, `standby`, and `total` vehicle counts, with optional `merchant_id` scoping.
- Added `PATCH /api/v1/vehicles/{vehicle_uuid}/maintenance` to enter or clear maintenance mode for a vehicle.
- Extended vehicle API responses with `maintenance_mode_at`, `maintenance_expected_resolved_at`, and `maintenance_description`.

### Database Changes
- Added nullable `maintenance_mode_at`, `maintenance_expected_resolved_at`, and `maintenance_description` columns to `vehicles`.

### Behavior Changes
- The admin dashboard now shows a client-fetched fleet status pie chart for the selected merchant.
- Vehicle detail pages now expose maintenance metadata and show either `Put in maintenance mode` or `Remove maintenance mode` in the actions dropdown.
- Entering maintenance mode now requires an expected resolve date and maintenance description; removing maintenance mode clears the stored maintenance fields.
- Fleet status reporting now treats vehicles with `maintenance_mode_at` as maintenance, vehicles with non-delivered/non-cancelled assigned shipments as active, and the remaining non-maintenance vehicles as standby.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/UpdateVehicleMaintenanceRequest.php`
- `php -l app/Http/Requests/FleetStatusReportRequest.php`
- `php -l app/Http/Controllers/Api/V1/VehicleController.php`
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `php -l app/Http/Resources/VehicleResource.php`
- `php -l app/Services/VehicleService.php`
- `php -l app/Models/Vehicle.php`
- `php -l database/migrations/2026_03_01_190000_add_maintenance_fields_to_vehicles_table.php`
- `cd website && npx eslint src/app/admin/page.tsx 'src/app/admin/logistics/vehicles/[vehicleId]/page.tsx' src/components/reports/fleet-status-chart.tsx src/components/vehicles/vehicle-detail-actions.tsx src/components/vehicles/vehicle-maintenance-dialog.tsx src/lib/api/reports.ts src/lib/api/vehicles.ts src/lib/types.ts`

### Internal Changes
- Reused the existing vehicle service scoping rules for the new fleet status summary and kept the dashboard fleet chart self-fetching inside its own component.

## 2026-03-01 | Version: unreleased

### Summary
- Added an `Expired files` card to the admin dashboard and linked each expired file item to its related shipment, driver, or vehicle detail page.

### API Changes
- Added `GET /api/v1/files/expired` to list expired entity files visible to the authenticated user, with optional `merchant_id` and `per_page` filters.
- Extended expired file payloads with `entity_id` and `entity_label` so the website can route users to the relevant detail page.

### Database Changes
- None.

### Behavior Changes
- The admin dashboard now shows up to five expired files for the selected merchant under a dedicated `Expired files` section.
- Each expired file row links directly to the related entity file section, including opening the shipment detail `Files` tab, and shows the expired document name, type, and expiry date.
- The dashboard recent activity card is now rendered through a reusable component alongside the new expired files component.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/ListExpiredEntityFilesRequest.php`
- `php -l app/Http/Controllers/Api/V1/EntityFileController.php`
- `php -l app/Services/EntityFileService.php`
- `php -l app/Http/Resources/EntityFileResource.php`
- `cd website && npx eslint src/app/admin/page.tsx 'src/app/admin/logistics/drivers/[driverId]/page.tsx' 'src/app/admin/logistics/vehicles/[vehicleId]/page.tsx' 'src/app/admin/logistics/shipments/[shipmentId]/page.tsx' src/components/files/entity-files-section.tsx src/components/dashboard/recent-activity-card.tsx src/components/dashboard/expired-files-card.tsx src/lib/api/entity-files.ts src/lib/types.ts`

### Internal Changes
- Added a reusable website API helper for expired entity files and moved the dashboard activity rendering into a standalone card component.

## 2026-03-01 | Version: unreleased

### Summary
- Fixed website build-blocking type errors across routes, shipments, and shared file table components.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The website production build now completes successfully again.
- Admin routes view links now point to the correct routes index constant.
- Shipment parcel typing now includes parcel codes used by the shipment detail UI.

### Breaking Changes
- None.

### Verification
- `npm run build` in `website`

### Internal Changes
- Added missing `page` and `per_page` request params to the typed website shipments API client.
- Tightened shared entity file table column typing so conditional columns do not leak `null` into `DataTable`.

## 2026-03-01 | Version: unreleased

### Summary
- The website admin activity log now uses the shared `DataTable` filter panel instead of a standalone filter form.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Activity log filtering for account, merchant, environment, actor, action, entity, date range, null-environment-only, and page size now runs through the shared table filter UI while keeping the same query params.
- The activity log page no longer renders a separate inline filter form above the table.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Replaced the page-level activity log GET form with shared `DataTable` URL-backed text, date, and select filters.

## 2026-03-01 | Version: unreleased

### Summary
- Fixed the admin tracking providers UI so import actions only appear for provider capabilities returned by the API.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The Integrations admin page now hides `Import Drivers`, `Import Locations`, and `Import Vehicles` actions unless the selected tracking provider exposes the matching capability flag:
  - `has_driver_importing`
  - `has_locations_importing`
  - `has_vehicle_importing`

### Breaking Changes
- None.

### Verification
- `npx eslint src/components/integrations/tracking-providers.tsx src/lib/types.ts`

### Internal Changes
- Extended the website `TrackingProvider` type with import capability flags and gated import button rendering with a shared capability helper.

## 2026-03-01 | Version: unreleased

### Summary
- Fixed tracking provider listing so invalid encrypted merchant integration payloads no longer crash the API response.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `GET /api/v1/tracking-providers` now returns tracking providers even if a related merchant integration row contains invalid encrypted `integration_data`; the affected integration payload is returned as `null` instead of triggering a decrypt exception.
- Admin tracking provider list responses now go through normal controller error handling again.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Resources/TrackingProviderResource.php`
- `php -l app/Http/Controllers/Api/V1/AdminTrackingProviderController.php`

### Internal Changes
- Wrapped merchant integration payload access in the tracking provider resource with decrypt-exception handling to tolerate legacy or corrupted ciphertext.

## 2026-03-01 | Version: unreleased

### Summary
- Added driver shipment file uploads in the mobile app and allowed shipment file types to be marked as driver-uploadable from admin settings.

### API Changes
- Added driver shipment file endpoints:
  - `GET /api/v1/driver/shipments/{shipment_uuid}/files`
  - `POST /api/v1/driver/shipments/{shipment_uuid}/files`
- Extended `GET /api/v1/driver/files/types` to accept `entity_type`, including `entity_type=shipment`.
- Driver-authenticated file downloads now rely on the shared authenticated file download endpoint:
  - `GET /api/v1/files/{file_uuid}/download?format=url`

### Database Changes
- None.

### Behavior Changes
- Drivers can now upload shipment files from the mobile shipment detail screen, but only for shipment file types flagged as driver-uploadable.
- Driver shipment file access is restricted to shipments currently assigned to that driver.
- Admins can now enable the existing driver upload flag for shipment file types in the File Types settings UI.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/EntityFileService.php`
- `php -l app/Services/FileTypeService.php`
- `php -l app/Http/Controllers/Api/V1/EntityFileController.php`
- `php -l app/Http/Controllers/Api/V1/FileTypeController.php`
- `php -l routes/api.php`
- `npx eslint src/components/settings/file-types-manager.tsx`
- `npx eslint src/lib/api.ts 'app/shipments/[shipment_id].tsx'`

### Internal Changes
- Reused the existing `driver_can_upload` file type flag for shipment file types and wired the mobile shipment detail screen to the new shipment-specific driver file endpoints.

## 2026-03-01 | Version: unreleased

### Summary
- Fixed shipment file tables so `hideStatusColumn` now removes the status column when requested.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `EntityFilesSection` now respects `hideStatusColumn`, allowing shipment file tabs to hide the status column while keeping the rest of the file table unchanged.

### Breaking Changes
- None.

### Verification
- `npx eslint src/components/files/entity-files-section.tsx 'src/app/admin/logistics/shipments/[shipmentId]/page.tsx'`

### Internal Changes
- Added an optional `hideStatusColumn` prop to the shared website entity file section and used it to build table columns conditionally.

## 2026-03-01 | Version: unreleased

### Summary
- Fixed shipment file tables so `hideExpiryColumn` now removes the expiry column when requested.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `EntityFilesSection` now respects `hideExpiryColumn`, allowing shipment file tabs to hide the expiry column while keeping the rest of the file table unchanged.

### Breaking Changes
- None.

### Verification
- `npx eslint src/components/files/entity-files-section.tsx 'src/app/admin/logistics/shipments/[shipmentId]/page.tsx'`

### Internal Changes
- Added an optional `hideExpiryColumn` prop to the shared website entity file section and used it to build table columns conditionally.

## 2026-03-01 | Version: unreleased

### Summary
- Moved shipment file uploads and file listing into a dedicated Files tab on the shipment detail page.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The shipment detail page now shows uploads and existing shipment files under a separate `Files` tab instead of mixing them into the main `Details` tab.

### Breaking Changes
- None.

### Verification
- `npx eslint 'src/app/admin/logistics/shipments/[shipmentId]/page.tsx'`

### Internal Changes
- Repositioned the existing shipment `EntityFilesSection` within the shipment detail tabs without changing its upload or download behavior.

## 2026-03-01 | Version: unreleased

### Summary
- Fixed the admin file types settings page crash caused by relying on `useEffectEvent` in a runtime where it was unavailable.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The File Types settings page now loads and refreshes file types with a standard effect-based fetch flow instead of calling `useEffectEvent`.
- Saving a file type now safely refreshes the current list without leaving the dialog in a stuck loading state if the reload fails.

### Breaking Changes
- None.

### Verification
- `npx eslint src/components/settings/file-types-manager.tsx`

### Internal Changes
- Replaced the `useEffectEvent`-based list loader in the website file types manager with a shared async helper plus guarded `useEffect` reload logic.

## 2026-03-01 | Version: unreleased

### Summary
- Added admin and driver-app interfaces for managing merchant-scoped shipment, driver, and vehicle files, including mobile driver document uploads.

### API Changes
- Website now uses the previously added `GET/POST/PATCH /api/v1/file-types` endpoints to manage merchant file types in admin settings.
- Website now uses the previously added entity file endpoints to list, upload, download, and delete shipment, driver, and vehicle files.
- Mobile driver app now uses:
  - `GET /api/v1/driver/files/types`
  - `GET /api/v1/driver/files`
  - `POST /api/v1/driver/files`
  - `GET /api/v1/driver/files/{file_uuid}/download?format=url`

### Database Changes
- None.

### Behavior Changes
- Admin settings now include a File Types area with shipment, driver, and vehicle views for managing active upload requirements.
- Shipment, driver, and vehicle detail pages now show a secure files section with upload, download, and delete actions.
- The driver mobile app now has a Documents tab where drivers can upload only the allowed driver file types and must supply an expiry date when the file type requires one.
- Driver file downloads in the mobile app open through authorized temporary URLs instead of public links.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/EntityFileController.php`
- `php -l app/Http/Resources/FileTypeResource.php`
- `php -l app/Http/Resources/EntityFileResource.php`
- `npx eslint mobile_app/src/lib/api.ts 'mobile_app/app/(tabs)/documents.tsx' 'mobile_app/app/(tabs)/_layout.tsx'`
- `npx eslint website/src/components/files/entity-files-section.tsx website/src/components/settings/file-types-manager.tsx website/src/app/admin/settings/file-types/page.tsx`

### Internal Changes
- Added shared website file-management clients and a multipart-capable mobile API request path for secure file uploads.

## 2026-03-01 | Version: unreleased

### Summary
- Added the backend foundation for merchant-scoped shipment, driver, and vehicle file management with private storage support and configurable merchant-specific file types.

### API Changes
- Added merchant-scoped file type endpoints:
  - `GET /api/v1/file-types`
  - `POST /api/v1/file-types`
  - `PATCH /api/v1/file-types/{file_type_uuid}`
- Added authenticated entity file endpoints:
  - `GET /api/v1/shipments/{shipment_uuid}/files`
  - `POST /api/v1/shipments/{shipment_uuid}/files`
  - `GET /api/v1/drivers/{driver_uuid}/files`
  - `POST /api/v1/drivers/{driver_uuid}/files`
  - `GET /api/v1/vehicles/{vehicle_uuid}/files`
  - `POST /api/v1/vehicles/{vehicle_uuid}/files`
  - `GET /api/v1/files/{file_uuid}/download`
  - `DELETE /api/v1/files/{file_uuid}`
- Added driver-mobile file endpoints:
  - `GET /api/v1/driver/files/types`
  - `GET /api/v1/driver/files`
  - `POST /api/v1/driver/files`
  - `GET /api/v1/driver/files/{file_uuid}/download`

### Database Changes
- Added `file_types` table for merchant-specific shipment, driver, and vehicle file type definitions.
- Added `entity_files` table for polymorphic file attachments with secure storage metadata and optional expiry dates.

### Behavior Changes
- File types are now merchant-specific and can be configured per entity type (`shipment`, `driver`, `vehicle`).
- Driver-uploadable file types are controlled by a dedicated `driver_can_upload` flag.
- File types can require expiry dates, and uploads for those file types are rejected without `expires_at`.
- Uploaded files are stored on the configured filesystem disk with private visibility and are only downloadable through authorized endpoints.
- File deletion removes the underlying object from storage before deleting the application record.

### Breaking Changes
- None.

### Verification
- `php -l app/Models/FileType.php`
- `php -l app/Models/EntityFile.php`
- `php -l app/Services/FileTypeService.php`
- `php -l app/Services/EntityFileService.php`
- `php -l app/Http/Controllers/Api/V1/FileTypeController.php`
- `php -l app/Http/Controllers/Api/V1/EntityFileController.php`
- `php -l app/Http/Requests/StoreFileTypeRequest.php`
- `php -l app/Http/Requests/UpdateFileTypeRequest.php`
- `php -l app/Http/Requests/UploadEntityFileRequest.php`
- `php -l app/Http/Resources/FileTypeResource.php`
- `php -l app/Http/Resources/EntityFileResource.php`
- `php -l routes/api.php`

### Internal Changes
- Added shared backend services for merchant access checks, file type management, secure private file storage, expiry enforcement, and authorized download resolution.

## 2026-03-01 | Version: unreleased

### Summary
- The website admin routes list now uses the shared `DataTable` filter panel instead of a standalone filter form.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Routes filtering for merchant ID, search text, and page size now runs through the shared table filter UI while keeping the same URL query params.
- The routes page no longer renders a separate inline filter form above the table.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Removed duplicated page-level filter form markup from the website routes admin page and reused the existing shared `DataTable` filter configuration.

## 2026-03-01 | Version: unreleased

### Summary
- The website admin locations list now uses the shared `DataTable` filter panel instead of a standalone filter form.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Locations filtering for search text, location type, and page size now runs through the shared table filter UI and continues to drive the same URL query params.
- The locations page no longer renders a separate inline filter form above the table.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Updated the shared website `DataTable` to only show its client-side quick search input when `searchKeys` are configured, preventing duplicate search controls on server-filtered pages.

## 2026-03-01 | Version: unreleased

### Summary
- Shipment detail parcel cards on the website now display a QR code image when a parcel code exists.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Parcel detail cards now render a QR image for each parcel that has a `parcel_code`, alongside the existing parcel metadata.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Added lightweight QR image URL generation for parcel codes in the website shipment detail view without introducing a new frontend dependency.

## 2026-03-01 | Version: unreleased

### Summary
- The shipments report page now uses the shared `DataTable` filter system instead of a custom inline GET form.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Shipments report filters now live in the shared table filter panel and continue to drive the same report query params.
- The report page reset action now clears filters from the page header instead of the removed inline form.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Added URL-backed text filter support to the shared website `DataTable` so report pages can reuse the same filter infrastructure as other list views.

## 2026-03-01 | Version: unreleased

### Summary
- The shipments API endpoint now honors website sorting for pickup location, dropoff location, and collection date.

### API Changes
- `GET /api/v1/shipments` sorting now accepts `sort_dir` as an alias for `sort_direction`.
- `GET /api/v1/shipments` sorting now accepts `pickup_location` and `dropoff_location` as aliases for the joined pickup/dropoff location name sorts.

### Database Changes
- None.

### Behavior Changes
- Website shipment list sorting now works when users sort by pickup location, dropoff location, or collection date from the shared table UI.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/ShipmentService.php`

### Internal Changes
- Added sort-key and sort-direction aliases in `ShipmentService::applyShipmentListSorting()` to match the website table query params.

## 2026-03-01 | Version: unreleased

### Summary
- The website shipments page now forwards the `per_page` query param to the shipments API so URL-driven page size requests take effect.

### API Changes
- The website shipments page now passes `per_page` through to `GET /api/v1/shipments`.

### Database Changes
- None.

### Behavior Changes
- URLs such as `/admin/logistics/shipments?from=2026-02-01&to=2026-02-28&per_page=100` now request up to 100 shipment rows from the API instead of falling back to the default page size.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Added `per_page` query-param parsing to the website shipments list page.

## 2026-03-01 | Version: unreleased

### Summary
- Website data table date filters now use the shared shadcn-style date picker instead of native date inputs.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `DataTable` date filters now open a calendar popover and still write URL-backed filter values in `YYYY-MM-DD` format.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Updated the shared `DatePicker` to stay synchronized with controlled values so URL-driven table filters render the selected date correctly.

## 2026-03-01 | Version: unreleased

### Summary
- Website data tables now auto-open their filter panel when the current URL already contains an active filter query param.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `DataTable` sets its filter panel open on initial load when any configured filter `url_param_name` exists in the current query string with a non-empty value.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Reused existing URL-backed filter metadata to derive the initial filter-panel visibility state in the shared website table component.

## 2026-03-01 | Version: unreleased

### Summary
- The website shipments list now exposes more server-backed filters for shipment status workflows, invoicing, auto assignment, priority, and created-date range.

### API Changes
- The website shipments page now sends `priority`, `auto_assign`, `invoiced`, `from`, and `to` query params to `GET /api/v1/shipments` when those filters are selected.

### Database Changes
- None.

### Behavior Changes
- Shipment list filters now include priority, auto-assign state, invoiced state, created-from date, and created-to date.
- URL-backed date filters now render as date inputs in the shared website `DataTable`.
- URL-backed filters are treated as server-side filters, so the table no longer tries to re-filter fetched rows client-side for those params.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Extended the shared website `DataTable` filter model with a date input type and broadened shipment API typings to cover supported list filters.

## 2026-03-01 | Version: unreleased

### Summary
- URL-backed `DataTable` filters on the website now update the current route query string and stay synchronized with query-param values.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `DataTable` filters can now declare `url_param_name` to push the selected option into the current page URL.
- URL-backed filters read their selected value from the current query string, falling back to the filter `value` prop when needed.
- Changing a URL-backed filter clears the `page` query param so pagination resets when the filter changes.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Extended the shared website table filter model with URL param support while keeping local in-memory filtering for non-URL filters.

## 2026-03-01 | Version: unreleased

### Summary
- The shared website data table now supports top-of-table view links with automatic active-state highlighting based on the current route and query string.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `DataTable` consumers can now pass a `views` prop to render linked view pills above the table header.
- View pills highlight automatically when the current pathname matches and the current query string matches the view link exactly or as a subset, depending on the view configuration.
- Table pagination and sorting params are ignored for view matching so the active view remains highlighted while paging or sorting within the same view.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Added shared `DataTableView` matching logic to the website table component so list pages can reuse the same top-level view navigation pattern.

## 2026-03-01 | Version: unreleased

### Summary
- Shipment detail pages on the website now hide empty parcel metadata fields instead of rendering placeholder parcel rows.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Parcel cards on `website` shipment detail pages now render only weight, dimensions, declared value, contents, and parcel code when those values exist.
- Parcels with no populated metadata now show a compact "No parcel details available." message instead of empty placeholders.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Simplified parcel detail rendering in the website shipment detail view by building a filtered list of visible parcel fields before render.

## 2026-03-01 | Version: unreleased

### Summary
- Website auth now refreshes expired API access tokens through the refresh-token endpoint and logs the user out when refresh fails.

### API Changes
- Website frontend now calls `POST /api/v1/auth/refresh` automatically after authenticated API requests receive `401 Unauthorized`.

### Database Changes
- None.

### Behavior Changes
- NextAuth sessions now track access-token expiry and refresh tokens before expiry during session resolution.
- Browser-side authenticated API requests retry once with a newly refreshed access token when the original token has expired.
- If token refresh fails or no refresh token is available, the website signs the user out and redirects to `/auth/login`.

### Breaking Changes
- None.

### Verification
- `npm run lint` in `website`

### Internal Changes
- Added a website session bridge so shared API helpers can update NextAuth token state after refresh and trigger a centralized logout on refresh failure.

## 2026-03-01 | Version: unreleased

### Summary
- Auto-created shipments now receive a default parcel with a generated parcel code, and shipment parcel measurements are now optional while `contents_description` remains required.

### API Changes
- Shipment create and update payloads now allow parcel `weight`, `weight_measurement`, `length_cm`, `width_cm`, and `height_cm` to be omitted.
- Shipment create and update payloads now require `parcels.*.contents_description`.
- Added maintenance command: `php artisan shipments:backfill-auto-created-parcels`

### Database Changes
- Made `shipment_parcels.weight`, `weight_measurement`, `length_cm`, `width_cm`, and `height_cm` nullable.

### Behavior Changes
- Auto-created shipments created from geofence lifecycle events now also create a default parcel with `contents_description` set to `Parcel #1`.
- Default parcels created for auto-created shipments now receive a generated stable `parcel_code`.
- Existing auto-created shipments without parcels can be backfilled with the new Artisan command.

### Breaking Changes
- Shipment parcel payloads now require `contents_description`.

### Verification
- `php -l app/Services/ShipmentParcelService.php`
- `php -l app/Services/ShipmentService.php`
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Http/Requests/StoreShipmentRequest.php`
- `php -l app/Http/Requests/UpdateShipmentRequest.php`
- `php -l routes/console.php`
- `php -l database/migrations/2026_03_01_190000_make_shipment_parcel_measurements_nullable.php`
- `php -l tests/Feature/AutoRunLifecycleServiceTest.php`
- `php artisan test --filter=AutoRunLifecycleServiceTest` blocked by existing SQLite-incompatible migration `database/migrations/2026_02_06_000004_update_quote_status_enum_add_booked.php`

### Internal Changes
- Added `ShipmentParcelService` so default parcel creation and auto-created shipment parcel backfills use the same code path.

## 2026-03-01 | Version: unreleased

### Summary
- Added stable parcel QR codes and parcel-level pickup scanning so shipments only move to `in_transit` after every parcel is scanned.

### API Changes
- `POST /api/v1/driver/shipments/{shipment_uuid}/scan` now requires `parcel_code` and records pickup scans per parcel instead of generic shipment-only scan events.
- Driver shipment responses now include parcel scan progress fields:
  - `total_parcel_count`
  - `scanned_parcel_count`
  - `all_parcels_scanned`
  - per-parcel `parcel_code`, `is_picked_up_scanned`, and pickup scan timestamps
- Added maintenance command: `php artisan shipments:backfill-parcel-codes`

### Database Changes
- Added `parcel_code`, `picked_up_scanned_at`, and `picked_up_scanned_by_user_id` to `shipment_parcels`.

### Behavior Changes
- Shipment parcels now receive stable uppercase alphanumeric parcel codes suitable for QR printing.
- Duplicate parcel scans are ignored and return an `already_scanned` result.
- Parcel scans are rejected when the scanned code does not belong to the shipment being picked up.
- Shipments remain in pickup state until all parcels are scanned.
- Once all parcels are scanned, booking status is written to `picked_up`, then immediately moved to `in_transit`, and shipment status also moves to `in_transit`.
- The Expo driver app now opens a dedicated camera-based parcel scanning screen with live scan progress and a bottom-sheet list of scanned parcels.

### Breaking Changes
- Driver scan clients must send `parcel_code` instead of relying on a shipment-level `event_code` scan payload.

### Verification
- `php -l app/Services/ParcelCodeService.php`
- `php -l app/Services/ShipmentService.php`
- `php -l app/Http/Controllers/Api/V1/DriverShipmentController.php`
- `php -l app/Http/Resources/ShipmentParcelResource.php`
- `php -l app/Http/Resources/ShipmentResource.php`
- `php -l app/Http/Requests/DriverScanRequest.php`
- `php -l routes/console.php`
- `php -l tests/Feature/DriverShipmentApiTest.php`
- `php -l database/migrations/2026_03_01_170000_add_pickup_scan_fields_to_shipment_parcels_table.php`
- `npm run lint` in `expo-driver-app`
- `php artisan test --filter=DriverShipmentApiTest` blocked by existing SQLite-incompatible migration `database/migrations/2026_02_06_000004_update_quote_status_enum_add_booked.php`

### Internal Changes
- Added a reusable parcel code generation/backfill service, scan-result metadata for the driver app scan flow, and a dedicated Expo scan route using `expo-camera` with `@gorhom/bottom-sheet`.

## 2026-03-01 | Version: unreleased

### Summary
- Added internal booking lifecycle support for auto-created shipments so auto-run flows now create and advance bookings through run start and delivery.

### API Changes
- Added one-time maintenance command: `php artisan shipments:backfill-auto-bookings`.

### Database Changes
- None.

### Behavior Changes
- Auto-created shipments now create an internal booking when they are attached to an auto-created run.
- Auto-created shipment bookings now sync `current_driver_id` from the run driver.
- Starting a run now moves attached auto-created shipment bookings to `in_transit` and stamps `collected_at`.
- Auto-delivering a shipment now also marks the related booking as `delivered` and stamps `delivered_at`.
- Existing auto-created shipments missing bookings can be backfilled with the new Artisan command.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/InternalBookingLifecycleService.php`
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Services/RunService.php`
- `php -l routes/console.php`
- `php -l tests/Feature/AutoRunLifecycleServiceTest.php`
- `php -l tests/Feature/RunApiTest.php`

### Internal Changes
- Centralized internal booking lifecycle updates in `InternalBookingLifecycleService` so auto-run booking creation, driver sync, and status stamping are handled consistently.

## 2026-03-01 | Version: unreleased

### Summary
- Added sorting and free-text search support to the driver list endpoint.

### API Changes
- `GET /api/v1/drivers` now accepts:
  - `search` to match driver `name` or `email`
  - `sort_by` with `created_at`, `name`, `email`, `telephone`, `intergration_id`, `is_active`, or `imported_at`
  - `sort_direction` with `asc` or `desc`

### Database Changes
- None.

### Behavior Changes
- Driver list responses can now be ordered explicitly instead of always returning `created_at desc`.
- Driver list filtering now supports `?search=xyz` against the related driver user name and email fields.

### Breaking Changes
- None.

### Verification
- `php artisan test --filter=DriverIndexTest`
- `php -l app/Http/Requests/ListDriversRequest.php`
- `php -l app/Services/DriverService.php`
- `php -l app/Http/Controllers/Api/V1/DriverController.php`

### Internal Changes
- Added a dedicated list request for driver index validation and updated `openapi.yaml` to document the new query parameters.

## 2026-03-01 | Version: unreleased

### Summary
- Added a timed driver delivery-offer workflow with driver online presence, device registration, offer acceptance/decline APIs, merchant dispatch settings, and app-side online/offer handling.

### API Changes
- Added driver device and presence endpoints:
  - `POST /api/v1/driver/devices/register`
  - `POST /api/v1/driver/presence/heartbeat`
  - `POST /api/v1/driver/presence/status`
- Added driver offer endpoints:
  - `GET /api/v1/driver/offers`
  - `POST /api/v1/driver/offers/{offer_uuid}/accept`
  - `POST /api/v1/driver/offers/{offer_uuid}/decline`
- Added shipment offer management endpoints:
  - `POST /api/v1/shipments/{shipment_uuid}/dispatch-offers/start`
  - `GET /api/v1/shipments/{shipment_uuid}/offers`
- Merchant APIs now support dispatch-offer settings:
  - `support_email`
  - `max_driver_distance`
  - `delivery_offers_expiry_time`
  - `driver_offline_timeout_minutes`
- Shipment APIs now support `requested_vehicle_type_id`.
- Shipment resources can now expose delivery offer history for merchant/admin consumers.

### Database Changes
- Added merchant fields for support email, offer expiry, max driver distance, and driver offline timeout.
- Added `requested_vehicle_type_id` to shipments.
- Added `user_devices`, `driver_presences`, and `delivery_offers` tables.
- Added a migration to allow internal bookings without `quote_option_id`.

### Behavior Changes
- Auto-assignable shipments now start a timed delivery-offer flow instead of requiring immediate manual booking/driver assignment.
- Drivers can go online/offline from the mobile app, send heartbeat/location updates, and receive active offers in heartbeat responses.
- Drivers can accept or decline delivery offers from the app dashboard.
- Accepting an offer creates an internal booking without a quote option, creates a run, attaches the shipment, and moves the shipment to `booked`.
- Declined or expired offers rotate to the next eligible online driver.
- When no eligible driver remains, shipment status moves to `offer_failed` and a support email job is queued to the merchant support address.

### Breaking Changes
- Merchant and shipment payloads now include new dispatch-related fields.
- Shipments may now enter the `offer_failed` status.
- Internal booking creation now assumes `quote_option_id` may be null after the new migration is applied.

### Verification
- `php artisan route:list --path=driver`
- `php -l app/Services/DeliveryOfferService.php`
- `php -l app/Services/DriverPresenceService.php`
- `php -l app/Services/UserDeviceService.php`
- `php -l app/Http/Controllers/Api/V1/DriverOfferController.php`
- `php -l app/Http/Controllers/Api/V1/DriverPresenceController.php`
- `php -l app/Http/Controllers/Api/V1/ShipmentOfferController.php`
- `php -l app/Http/Controllers/Api/V1/ShipmentController.php`
- `php -l app/Http/Resources/DeliveryOfferResource.php`
- `php -l app/Http/Resources/DriverPresenceResource.php`
- `php -l app/Services/ShipmentService.php`
- `npm run lint` in `expo-driver-app`

### Internal Changes
- Added delivery-offer orchestration, offer expiry job handling, support-email notification job/mail, device and presence persistence models, and app-side timed heartbeat/offer controls.

---

## 2026-03-01 | Version: unreleased

### Summary
- Migrated the driver delivery API from booking-centric endpoints to shipment-centric endpoints and updated the Expo driver app to consume the new shipment contract.

### API Changes
- Replaced `GET /api/v1/driver/bookings` with `GET /api/v1/driver/shipments`.
- Replaced `GET /api/v1/driver/bookings/{booking_uuid}` with `GET /api/v1/driver/shipments/{shipment_uuid}`.
- Replaced driver status, scan, POD, and cancel routes to use `/api/v1/driver/shipments/{shipment_uuid}/...`.
- Driver shipment responses are now shipment-first and include booking operational fields under a nested `booking` object.
- Updated `openapi.yaml` to document the new driver shipment endpoints.

### Database Changes
- None.

### Behavior Changes
- Driver shipment visibility still follows active runs assigned to the authenticated driver with statuses `draft`, `dispatched`, or `in_progress`.
- Driver shipment actions still only allow internal carriers and still persist booking-backed operational changes such as tracking events, POD, and cancellations.
- The Expo driver app now loads list and detail data from `/driver/shipments`, navigates by `shipment_id`, and exposes in-app controls for shipment status updates, scan events, POD submission, and cancellation.

### Breaking Changes
- Removed the v1 driver booking endpoints:
  - `GET /api/v1/driver/bookings`
  - `GET /api/v1/driver/bookings/{booking_uuid}`
  - `PATCH /api/v1/driver/bookings/{booking_uuid}/status`
  - `POST /api/v1/driver/bookings/{booking_uuid}/scan`
  - `POST /api/v1/driver/bookings/{booking_uuid}/pod`
  - `POST /api/v1/driver/bookings/{booking_uuid}/cancel`

### Verification
- `php -l app/Http/Controllers/Api/V1/DriverShipmentController.php`
- `php -l app/Http/Resources/DriverShipmentResource.php`
- `php -l tests/Feature/DriverShipmentApiTest.php`
- `npm run lint` in `expo-driver-app`
- `php artisan test --filter=DriverShipmentApiTest` blocked by an existing SQLite-incompatible migration in `database/migrations/2026_02_05_000098_update_booking_status_enum.php` (`ALTER TABLE ... MODIFY ...`)

### Internal Changes
- Added `DriverShipmentResource`, a shipment-scoped `DriverShipmentController`, feature coverage for shipment-based driver actions, and Expo driver API helpers/forms for all driver shipment mutations.

---

## 2026-03-01 | Version: unreleased

### Summary
- Reworked the driver bookings lookup to derive eligible records from shipments assigned to the driver's active runs, and added SQL debug logging for that query path.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Driver booking endpoints now determine visibility from `shipments.currentRunShipment.run.driver_id` instead of starting from a bookings-based relationship filter.
- Driver booking endpoints now emit a debug log entry containing the raw SQL, bindings array, and interpolated SQL for both the booking query and the shipment subquery used by `queryDriverBookings()`.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/DriverBookingController.php`

### Internal Changes
- Added an interpolation helper in `DriverBookingController` to render query bindings into the logged SQL string for both the outer booking query and the shipment subquery.

---

## 2026-03-01 | Version: unreleased

### Summary
- Synced run driver and vehicle assignments into `driver_vehicles` so dispatching a run also guarantees the driver has that vehicle assignment record.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Creating a run with both `driver_id` and `vehicle_id` now automatically creates the corresponding `driver_vehicles` row when it does not already exist.
- Updating a draft or dispatched run to a driver and vehicle pair now backfills the missing `driver_vehicles` assignment without creating duplicates.
- Shipment driver assignment inherits the same sync behavior because it reuses the run create/update flow.

### Breaking Changes
- None.

### Verification
- `php artisan test --filter=RunApiTest`

### Internal Changes
- `RunService` now reuses `DriverVehicleService::assignVehicle()` after run persistence to keep run assignments and driver vehicle assignments aligned.

---

## 2026-03-01 | Version: unreleased

### Summary
- Fixed the Expo driver login regression caused by strict native storage failures interrupting the sign-in flow after a successful API login.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Driver login no longer redirects and then drops back to the login screen when native session persistence fails at write time.
- The auth provider now commits the persisted session before publishing authenticated UI state.
- Native auth storage falls back to in-memory session storage again when the runtime cannot complete `AsyncStorage` operations.

### Breaking Changes
- None.

### Verification
- `npm run lint`

### Internal Changes
- Removed the debug auth hydration log and reordered sign-in session persistence in `expo-driver-app/src/providers/auth-provider.tsx`.

---

## 2026-03-01 | Version: unreleased

### Summary
- Stopped the Expo driver app from silently storing auth sessions in native in-memory fallback storage, which was causing sessions to disappear after the app closed.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Native auth session reads and writes now require real `AsyncStorage` persistence instead of degrading to process memory.
- Existing driver sessions persist across full app restarts only when the runtime provides a working native storage module.
- Web auth storage continues using `window.localStorage`.

### Breaking Changes
- None.

### Verification
- `npm run lint`

### Internal Changes
- Removed the native in-memory fallback from `expo-driver-app/src/lib/auth-storage.ts`.

---

## 2026-03-01 | Version: unreleased

### Summary
- Added an explicit login-screen auth guard so the Expo driver app redirects authenticated drivers straight to the dashboard instead of leaving them on the login form.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/(auth)/login` now shows a loading state during auth hydration.
- If a driver session already exists after hydration, the login route immediately redirects to `/(tabs)`.
- The login form only renders when no authenticated session is present.

### Breaking Changes
- None.

### Verification
- `npm run lint`

### Internal Changes
- Added route-level auth guarding in `expo-driver-app/app/(auth)/login.tsx` to complement the root layout redirect logic.

---

## 2026-03-01 | Version: unreleased

### Summary
- Fixed Expo driver auth persistence so a saved driver session survives app refreshes unless the backend explicitly rejects the token or refresh token.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The Expo driver app now restores the last saved session immediately during startup instead of forcing a fresh login on every reload.
- Startup validation failures caused by transient network/API errors no longer clear the saved driver session.
- Saved auth is only removed when `/me` and token refresh both fail with `401 Unauthorized`.

### Breaking Changes
- None.

### Verification
- `npm run lint`

### Internal Changes
- Simplified the auth bootstrap flow in `expo-driver-app/src/providers/auth-provider.tsx` to distinguish invalid auth from transient bootstrap failures.

---

## 2026-03-01 | Version: unreleased

### Summary
- Fixed driver booking endpoints to resolve assignments from shipment runs instead of the legacy `bookings.current_driver_id` field.

### API Changes
- No endpoint changes.
- Driver booking responses now prefer the active run driver when populating `current_driver_id`.

### Database Changes
- None.

### Behavior Changes
- `GET /api/v1/driver/bookings` and related driver booking actions now only expose bookings whose shipment is attached to an active run assigned to the authenticated driver.
- Driver booking detail, status update, scan, POD, and cancel actions now follow run-based driver assignment consistently.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/DriverBookingController.php`
- `php -l app/Http/Resources/BookingResource.php`

---

## 2026-03-01 | Version: unreleased

### Summary
- Added a shipment driver assignment endpoint that updates the shipment's active run or creates a new draft run when none exists.

### API Changes
- Added `POST /api/v1/shipments/{shipment_uuid}/assign_driver`.
- Request payload accepts `driver_id` and optional `vehicle_id`.
- Response returns `ShipmentResource`; new run creation responds with `201 Created`, existing run updates respond with `200 OK`.

### Database Changes
- None.

### Behavior Changes
- Assigning a driver from a shipment now reuses the current active run when present by updating its `driver_id` and optional `vehicle_id`.
- If a shipment has no active run, the API creates a new draft run for the shipment's merchant/environment and attaches that shipment automatically.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/ShipmentController.php`
- `php -l app/Http/Requests/AssignShipmentDriverRequest.php`
- `php -l app/Services/RunService.php`
- `php -l tests/Feature/RunApiTest.php`

---

## 2026-03-01 | Version: unreleased

### Summary
- Added SQL logging for the driver list query so `listDrivers()` now records the generated SQL and bound parameters for debugging.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `GET /api/v1/drivers` now writes a debug log entry with the final `listDrivers()` SQL, its bindings, and an interpolated SQL string before pagination executes.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/DriverService.php`

### Internal Changes
- Added application logging around the driver listing query builder.

---

## 2026-03-01 | Version: unreleased

### Summary
- Added `merchant_id` to drivers and now persist merchant ownership whenever drivers are created manually or imported.

### API Changes
- Driver responses now include `merchant_id`.
- `POST /api/v1/drivers` now stores the resolved merchant on the created driver record.
- Driver CSV import and tracking-provider driver import now also persist merchant ownership on imported drivers.

### Database Changes
- Added nullable foreign key `drivers.merchant_id` referencing `merchants.id`.
- Existing driver rows are backfilled from their linked carrier merchant where available.

### Behavior Changes
- Merchant-scoped driver queries now prefer the driver’s own `merchant_id` instead of relying only on carrier ownership.
- Run driver resolution and tracking-provider driver import matching now scope drivers to the merchant first, with fallback handling for legacy rows that still lack `merchant_id`.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/DriverService.php`
- `php -l app/Services/MerchantIntegrationService.php`
- `php -l app/Services/RunService.php`
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Services/DataPurgeService.php`
- `php -l app/Models/Driver.php`
- `php -l app/Http/Resources/DriverResource.php`
- `php -l database/migrations/2026_03_01_120000_add_merchant_id_to_drivers_table.php`

---

## 2026-03-01 | Version: unreleased

### Summary
- Added real driver bookings and vehicles tabs in the Expo app, including booking and vehicle detail screens backed by Laravel driver endpoints.

### API Changes
- No backend endpoint changes.
- The Expo driver app now consumes:
  - `GET /api/v1/driver/bookings`
  - `GET /api/v1/driver/bookings/{booking_uuid}`
  - `GET /api/v1/driver/vehicles`
  - `GET /api/v1/driver/vehicles/{vehicle_uuid}`

### Database Changes
- None.

### Behavior Changes
- The mobile app tab bar now includes dedicated `Bookings` and `Vehicles` sections.
- Bookings list and detail screens load real assigned-booking data for the authenticated driver.
- Vehicles list and detail screens load real assigned-vehicle data for the authenticated driver.
- API failures in the new list/detail screens are shown directly in the UI.

### Breaking Changes
- None.

### Verification
- `npm run lint`

---

## 2026-03-01 | Version: unreleased

### Summary
- Hardened Expo auth storage again so each AsyncStorage operation falls back when the module exists but throws because its native binding is unavailable.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Session storage now catches runtime failures from `getItem`, `setItem`, and `removeItem` on the AsyncStorage module itself.
- Auth bootstrap and logout continue using fallback storage even when the AsyncStorage package is installed but not linked in the active runtime.

### Breaking Changes
- None.

### Verification
- `npm run lint`

---

## 2026-03-01 | Version: unreleased

### Summary
- Restored the Expo auth storage fallback adapter after a direct `AsyncStorage` implementation reintroduced native-module crashes during session cleanup.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Session clear, read, and write operations no longer call native AsyncStorage directly when the runtime does not expose the module.
- Login bootstrap and logout now degrade safely to web storage or in-memory storage instead of crashing on missing native storage bindings.

### Breaking Changes
- None.

### Verification
- `npm run lint`

---

## 2026-03-01 | Version: unreleased

### Summary
- Improved Expo driver login error handling so API authentication and validation failures are shown directly in the login screen.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Login failures now surface Laravel API error messages in the Expo driver app.
- Validation error details returned by the API are expanded and displayed as individual messages on the login form.

### Breaking Changes
- None.

### Verification
- `npm run lint`

---

## 2026-03-01 | Version: unreleased

### Summary
- Hardened Expo driver auth storage to avoid runtime crashes when the native AsyncStorage module is unavailable.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The Expo driver app now falls back to `localStorage` on web and in-memory session storage when native AsyncStorage is unavailable.
- Corrupted stored session payloads are cleared automatically instead of crashing session restore.

### Breaking Changes
- None.

### Verification
- `npm run lint`

---

## 2026-03-01 | Version: unreleased

### Summary
- Added a driver-focused Expo login flow with persisted auth state, environment-based API configuration, and a placeholder authenticated dashboard.

### API Changes
- No backend endpoint changes.
- The Expo driver app now consumes:
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/me`

### Database Changes
- None.

### Behavior Changes
- Unauthenticated users in `expo-driver-app` are redirected to a login screen.
- Authenticated users are redirected to the driver dashboard after successful login.
- The mobile app persists access and refresh tokens locally and attempts token refresh during session restore when the access token is no longer valid.
- Non-driver accounts are blocked from signing into the driver app.
- Driver self-registration is intentionally unavailable in-app and is shown as a placeholder screen.

### Breaking Changes
- None.

### Verification
- `npm install @react-native-async-storage/async-storage`
- `npm run lint`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added run stop history to run responses using the run's related vehicle activity events.

### API Changes
- Run payloads now include:
  - `stops`
- `stops` is an ordered collection of `vehicle_activity` entries related to the run, serialized with the vehicle activity response shape.

### Database Changes
- None.

### Behavior Changes
- Run responses now include all recorded vehicle events for the run ordered by `occurred_at`, oldest to newest.

### Breaking Changes
- None.

### Verification
- `php -l app/Models/Run.php`
- `php -l app/Services/RunService.php`
- `php -l app/Http/Resources/RunResource.php`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added run last-location details sourced from the latest location-based stop recorded for each run.

### API Changes
- Run payloads now include:
  - `last_location`
- `last_location` uses the standard `LocationResource` shape.

### Database Changes
- None.

### Behavior Changes
- Run responses now expose the latest location-based stop for the run itself using the standard `LocationResource` shape in a top-level `last_location` block.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Resources/RunResource.php`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added tracking provider capability flags and a default-tracking flag, and now enforce import availability from provider configuration.

### API Changes
- Tracking provider payloads now include:
  - `default_tracking`
  - `has_driver_importing`
  - `has_locations_importing`
  - `has_vehicle_importing`
- Admin tracking provider create/update requests now accept the same fields.

### Database Changes
- Added nullable/boolean flags on `tracking_providers`:
  - `default_tracking`
  - `has_driver_importing`
  - `has_locations_importing`
  - `has_vehicle_importing`

### Behavior Changes
- Provider import endpoints now require both:
  - the provider capability flag to be enabled in the database
  - the underlying provider service method to exist
- Providers with disabled import flags are treated as not supporting that import feature even if an implementation exists.

### Breaking Changes
- None.

### Verification
- `php -l database/migrations/2026_02_28_000004_add_capability_flags_to_tracking_providers_table.php`
- `php -l app/Models/TrackingProvider.php`
- `php -l app/Http/Resources/TrackingProviderResource.php`
- `php -l app/Http/Requests/StoreTrackingProviderRequest.php`
- `php -l app/Http/Requests/UpdateTrackingProviderRequest.php`
- `php -l app/Services/TrackingProviderService.php`
- `php -l app/Services/MerchantIntegrationService.php`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added shipment list filtering by invoice state.

### API Changes
- `GET /api/v1/shipments` now accepts:
  - `invoiced=true` to return only shipments with a non-null `invoiced_at`
  - `invoiced=false` to return only shipments with a null `invoiced_at`

### Database Changes
- None.

### Behavior Changes
- Shipment list filtering now supports invoice state using `shipments.invoiced_at`.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/ShipmentService.php`
- `php -l tests/Feature/ShipmentQuoteTest.php`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added shipment stop history to single-shipment responses using the shipment's related vehicle activity events.

### API Changes
- Single-shipment payloads now include:
  - `driver`
  - `vehicle`
  - `stops`
- `stops` is an ordered collection of `vehicle_activity` entries related to the shipment, serialized with the vehicle activity response shape.
- Applies to single-shipment responses from:
  - `POST /api/v1/shipments`
  - `POST /api/v1/shipments/on-demand`
  - `GET /api/v1/shipments/{shipment_uuid}`
  - `PATCH /api/v1/shipments/{shipment_uuid}`

### Database Changes
- None.

### Behavior Changes
- Shipment responses now include the assigned run driver and vehicle details when a current run exists for the shipment.
- Shipment detail responses now return all recorded vehicle events for the shipment ordered by `occurred_at`, oldest to newest.
- Shipment list responses remain unchanged and do not eager-load shipment stops.

### Breaking Changes
- None.

### Verification
- `php -l app/Models/Shipment.php`
- `php -l app/Http/Resources/ShipmentResource.php`
- `php -l app/Http/Controllers/Api/V1/ShipmentController.php`
- `php -l tests/Feature/ShipmentQuoteTest.php`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added shipment invoice fields to CRUD APIs and automatic invoice timestamping when an invoice number is assigned without an explicit invoice date.

### API Changes
- Shipment payloads now include:
  - `delivery_note_number`
  - `invoice_number`
  - `invoiced_at`
- Applies to shipment create, on-demand create, list, show, and update responses.
- Shipment create/update requests now accept:
  - `invoice_number`
  - `invoiced_at`

### Database Changes
- Added nullable `shipments.invoice_number`.
- Added nullable `shipments.invoiced_at`.

### Behavior Changes
- Creating a shipment with `invoice_number` but without `invoiced_at` now defaults `invoiced_at` to the current timestamp.
- Updating a shipment with a changed `invoice_number` but without `invoiced_at` now defaults `invoiced_at` to the current timestamp.
- Explicit `invoiced_at` values are preserved when provided.

### Breaking Changes
- None.

### Verification
- `php -l database/migrations/2026_02_28_000003_add_invoice_fields_to_shipments_table.php`
- `php -l app/Models/Shipment.php`
- `php -l app/Http/Resources/ShipmentResource.php`
- `php -l app/Http/Requests/StoreShipmentRequest.php`
- `php -l app/Http/Requests/UpdateShipmentRequest.php`
- `php -l app/Services/ShipmentService.php`
- `php -l tests/Feature/ShipmentQuoteTest.php`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added CSV import endpoints for merchant vehicles and drivers.

### API Changes
- Added endpoint:
  - `POST /api/v1/vehicles/import`
  - request body: `merchant_id`, `file` (`csv`/`txt`)
- Added endpoint:
  - `POST /api/v1/drivers/import`
  - request body: `merchant_id`, `file` (`csv`/`txt`)
- Both endpoints return:
  - `processed`
  - `created`
  - `updated`
  - `failed`
  - `errors` (row-level import failures)

### Database Changes
- None.

### Behavior Changes
- Vehicle CSV import upserts rows by `intergration_id`, then `plate_number`, then `ref_code`.
- Driver CSV import upserts rows by `email`, then `intergration_id`.
- Merchant users import drivers into their merchant carrier automatically; admin users may optionally provide `carrier_id` in the CSV.
- Driver imports generate a random password for newly created driver users when the CSV password column is blank.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/ImportVehiclesRequest.php`
- `php -l app/Http/Requests/ImportDriversRequest.php`
- `php -l app/Http/Controllers/Api/V1/VehicleController.php`
- `php -l app/Http/Controllers/Api/V1/DriverController.php`
- `php -l app/Services/VehicleService.php`
- `php -l app/Services/DriverService.php`
- `php -l routes/api.php`
- `php -l tests/Feature/VehicleCsvImportTest.php`
- `php -l tests/Feature/DriverCsvImportTest.php`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added vehicle last-known-driver tracking so tracking events can update a persistent driver snapshot on each vehicle.

### API Changes
- Vehicle payloads now include:
  - `last_driver_id`
  - `driver_logged_at`
  - `last_driver`
- Applies to:
  - `GET /api/v1/vehicles`
  - `GET /api/v1/vehicles/{vehicle_uuid}`
  - vehicle objects returned from `GET /api/v1/vehicle-activities`
  - vehicle objects returned from `GET /api/v1/vehicles/latest-activity-check`

### Database Changes
- Added nullable `vehicles.last_driver_id` foreign key to `drivers.id`.
- Added nullable `vehicles.driver_logged_at`.

### Behavior Changes
- Tracking vehicle activity events now update the owning vehicle's last-known driver when a driver can be resolved from the event metadata or linked run.
- Driver snapshots only advance when the new activity row has a newer `vehicle_activity.created_at` value than the current `driver_logged_at`.
- Tracking events without a resolvable driver leave the existing vehicle driver snapshot unchanged.

### Breaking Changes
- None.

### Verification
- `php -l database/migrations/2026_02_28_000002_add_last_driver_fields_to_vehicles_table.php`
- `php -l app/Models/Vehicle.php`
- `php -l app/Models/VehicleActivity.php`
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Services/VehicleService.php`
- `php -l app/Services/VehicleActivityService.php`
- `php -l app/Http/Resources/VehicleResource.php`
- `php -l app/Http/Resources/VehicleActivityResource.php`
- `php -l app/Http/Resources/VehicleLatestActivityCheckResource.php`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added a merchant-scoped vehicle latest-activity check endpoint that returns every vehicle for a merchant, including vehicles with no activity history.

### API Changes
- Added endpoint:
  - `GET /api/v1/vehicles/latest-activity-check?merchant_id={merchant_uuid}`
- Response shape mirrors vehicle activity payloads while remaining vehicle-backed:
  - always includes `merchant` and `vehicle`
  - returns latest activity fields from the most recent row by `occurred_at`
  - returns `null` for activity-derived fields when a vehicle has no activity
- The endpoint returns all vehicles for the merchant in a single response and does not paginate.

### Database Changes
- None.

### Behavior Changes
- Vehicle latest-activity checks now include inactive and activity-less vehicles in the merchant account scope.
- When multiple activities exist for a vehicle, the endpoint selects the latest by `occurred_at` and uses the highest `id` as a tie-breaker.

### Breaking Changes
- None.

### Verification
- `vendor/bin/phpunit --filter=VehicleLatestActivityCheckTest`
- `php -l app/Http/Requests/ListVehicleLatestActivityCheckRequest.php`
- `php -l app/Http/Resources/VehicleLatestActivityCheckResource.php`
- `php -l app/Http/Controllers/Api/V1/VehicleActivityController.php`
- `php -l app/Services/VehicleActivityService.php`
- `php -l routes/api.php`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added shipment-stage collection and delivery activity attempts plus run origin departure tracking so shipment full reports can show real collection and delivery durations.
- Added shipment listing sorting for merchant reference, service type, pickup, dropoff, status, collection date, ready time, priority, and created time.

### API Changes
- `GET /api/v1/reports/shipments_full_report` now returns:
  - `from_vehicle_activity`
  - `to_vehicle_activity`
- `GET /api/v1/shipments` now accepts:
  - `sort_by=created_at`
  - `sort_by=merchant_order_ref`
  - `sort_by=service_type`
  - `sort_by=from`
  - `sort_by=to`
  - `sort_by=status`
  - `sort_by=collection_date`
  - `sort_by=ready_at`
  - `sort_by=priority`
  - optional `sort_direction=asc|desc`
- These fields now prefer the latest `shipment_collection` and `shipment_delivery` activity attempts, with fallback to legacy shipment-linked location visits.
- Run payloads now include `origin_departure_time`.
- Vehicle activity listing now accepts `shipment_collection` and `shipment_delivery` in the `event_type` filter.

### Database Changes
- Added nullable `runs.origin_departure_time`.

### Behavior Changes
- Exiting an origin pickup geofence now records `runs.origin_departure_time` when the open `entered_location` visit belongs to the run origin.
- Auto-created shipments now set `collection_date` from `run.started_at` when available during creation.
- Shipment listings now support sorting by created time, merchant reference, service type, pickup location name, dropoff location name, shipment status, collection date, ready time, and priority.
- Shipment listing filters now qualify `shipments.*` columns correctly when location joins are present, preventing ambiguous-column SQL errors.
- Entering a dropoff geofence for an active run now creates one shipment attempt row per attempt for:
  - `shipment_collection`, populated from `run.started_at` and `run.origin_departure_time` when both values exist
  - `shipment_delivery`, opened with the real dropoff entry timestamp
- Exiting the dropoff geofence closes the latest open `shipment_delivery` attempt for that shipment/run/location.
- Raw `entered_location` and `exited_location` events continue to be recorded.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/ShipmentService.php`
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `php -l app/Http/Resources/RunResource.php`
- `php -l app/Models/Run.php`
- `php -l app/Models/VehicleActivity.php`
- `php -l app/Http/Requests/ListVehicleActivitiesRequest.php`
- `php -l database/migrations/2026_02_28_000001_add_origin_departure_time_to_runs_table.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Added `location_type_id` and free-text `search` filters to the merchant-scoped locations listing endpoint.

### API Changes
- `GET /api/v1/locations` now accepts:
  - `location_type_id` to filter locations by a specific location type UUID
  - `search` to match locations by name, code, address, contact, province/post code, or integration id

### Database Changes
- None.

### Behavior Changes
- Location listing now validates list query params through a dedicated request class.
- `location_type_id` filtering is scoped to the authenticated account and requested merchant context.
- `search` supports partial multi-word matching across common location text fields.

### Breaking Changes
- None.

### Verification
- `vendor/bin/phpunit --filter=LocationIndexFiltersTest`
- `php -l app/Http/Requests/ListLocationsRequest.php`
- `php -l app/Http/Controllers/Api/V1/LocationController.php`
- `php -l app/Services/LocationService.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Corrected MiX location polygon coordinate handling so imported geofence WKT remains in the original axis order while API polygon arrays and derived map centers use valid latitude/longitude positions.

### API Changes
- `LocationResource` now serializes stored `polygon_bounds` WKT to `[latitude, longitude]` coordinate pairs consistently with location create/update APIs.

### Database Changes
- None.

### Behavior Changes
- Fixed MiX `shapeWkt` centroid fallback to read WKT points as `longitude latitude` instead of duplicating the latitude value.
- Imported MiX locations now derive fallback center points without corrupting longitude values.
- Stored polygon WKT is still passed through unchanged to the database geometry column.

### Breaking Changes
- None.

### Verification
- `phpunit --filter=MixIntegrateServiceTest`
- `phpunit --filter=LocationResourceTest`

---

## 2026-02-27 | Version: unreleased

### Summary
- Added a protected merchant data purge endpoint with password confirmation and typed bulk-deletion controls.

### API Changes
- Added endpoint:
  - `POST /api/v1/merchants/{merchant_uuid}/purge-data`
- Request body:
  - `merchant_id` (required merchant UUID; must match route merchant)
  - `password` (required)
  - `types` (required array; allowed: `shipments`, `runs`, `routes`, `drivers`, `vehicles`, `locations`, `location_types`, `merchant_integrations`, `webhooks`, `api_call_logs`, `idempotency_keys`, `merchant_invites`, `activity_logs`)
- Response now includes:
  - `merchant_uuid`
  - `requested_types`
  - `processed_types`
  - `results` (deleted row counts per table/type)

### Database Changes
- None.

### Behavior Changes
- Purge endpoint now:
  - requires authenticated `user`/`super_admin` role
  - requires `merchant_id` in payload to match the route merchant
  - allows only the owning user of the merchant account to execute the purge
  - verifies the caller password before any delete operation
  - executes deletes in a dependency-safe order inside a transaction
  - records an activity log entry describing requested/processed types and deleted counts
- Added guardrail: `locations` purge is blocked when shipments still exist unless `shipments` is included.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/DataPurgeRequest.php`
- `php -l app/Http/Controllers/Api/V1/DataPurgeController.php`
- `php -l app/Services/DataPurgeService.php`
- `php -l routes/api.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Updated MiX import location-type auto-creation to generate and persist merchant-unique slugs from location type titles.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- When MiX location import encounters an unknown `LocationType` title:
  - creates `location_types` with `slug` generated from title
  - ensures slug is unique per merchant (suffixes like `-2`, `-3` as needed)
  - persists default flags/sequence values required by location types schema
- Removed temporary debug `HERE` logs from this import path.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/Mixtelematics/MixIntegrateService.php`
- Import locations with new `LocationType` titles and confirm created rows include valid `slug` values.

---

## 2026-02-27 | Version: unreleased

### Summary
- Ensured provider import payloads include merchant/account context values for queued imports.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `MerchantIntegrationService` now augments integration data passed to provider import methods with:
  - `account_id`
  - `merchant_id`
  - `merchant_uuid`
- Applies to:
  - `import_vehicles`
  - `import_drivers`
  - `import_locations`

### Breaking Changes
- None.

### Verification
- `php -l app/Services/MerchantIntegrationService.php`
- Run import locations job and confirm provider receives `integrationData.account_id` and `integrationData.merchant_id`.

---

## 2026-02-27 | Version: unreleased

### Summary
- Disabled MiX bearer token caching so each token request is fetched live.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `MixIntegrateService::getBearerToken` no longer uses cache storage.
- Every call now requests a fresh token from MiX identity endpoint.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/Mixtelematics/MixIntegrateService.php`
- `php -l docs/release-notes.md`

---

## 2026-02-27 | Version: unreleased

### Summary
- Added detailed lifecycle/error logging to provider location import queue job to diagnose queue failures.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `ImportProviderLocationsJob` now logs:
  - job start (with request context)
  - pre-import call start
  - post-import call completion with `imported_count`
  - skip completion when import user is missing
  - failure details with exception class, message, and trace

### Breaking Changes
- None.

### Verification
- `php -l app/Jobs/ImportProviderLocationsJob.php`
- `php -l docs/release-notes.md`

---

## 2026-02-27 | Version: unreleased

### Summary
- Replaced `imports_in_progress` with richer `imports_stats` tracking for provider imports.

### API Changes
- Import queue acknowledgement payload now returns `imports_stats` instead of `imports_in_progress`.
- `GET /api/v1/tracking-providers/imports-statuses` now returns:
  - `inprogress` (`locations`, `drivers`, `vehicles`)
  - `last_import_counts` (`locations`, `drivers`, `vehicles`)
  - `last_import_errors` (`locations`, `drivers`, `vehicles`)

### Database Changes
- Added migration:
  - `database/migrations/2026_02_27_181000_replace_imports_in_progress_with_imports_stats_on_merchants_table.php`
- Migration actions:
  - add `merchants.imports_stats` (JSON nullable)
  - backfill from existing `imports_in_progress`
  - drop `merchants.imports_in_progress`

### Behavior Changes
- Queue start now sets `imports_stats.inprogress.{type}` to start timestamp.
- Queue completion now updates:
  - `imports_stats.inprogress.{type}` to `null`
  - `imports_stats.last_import_counts.{type}` with imported row count
  - `imports_stats.last_import_errors.{type}` with error message or `null`

### Breaking Changes
- Yes.
- Clients reading `imports_in_progress` must switch to `imports_stats` and nested fields.

### Verification
- `php -l app/Services/MerchantIntegrationService.php`
- `php -l app/Jobs/ImportProviderVehiclesJob.php`
- `php -l app/Jobs/ImportProviderDriversJob.php`
- `php -l app/Jobs/ImportProviderLocationsJob.php`
- `php -l app/Http/Controllers/Api/V1/MerchantIntegrationController.php`
- `php -l app/Models/Merchant.php`
- `php -l database/migrations/2026_02_27_181000_replace_imports_in_progress_with_imports_stats_on_merchants_table.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Moved tracking-provider imports (locations, drivers, vehicles) to queued jobs and added merchant-level import progress tracking.

### API Changes
- Import endpoints now queue jobs and return immediate accepted responses:
  - `POST /api/v1/tracking-providers/{provider_id}/import_vehicles`
  - `POST /api/v1/tracking-providers/{provider_id}/import_drivers`
  - `POST /api/v1/tracking-providers/{provider_id}/import_locations`
- New endpoint:
  - `GET /api/v1/tracking-providers/imports-statuses?merchant_id={merchant_uuid}`
- Import endpoint response shape now includes:
  - `queued` (bool)
  - `already_in_progress` (bool)
  - `imports_in_progress` (object with `locations`, `drivers`, `vehicles`)

### Database Changes
- Added migration:
  - `database/migrations/2026_02_27_180000_add_imports_in_progress_to_merchants_table.php`
- Migration adds nullable JSON `merchants.imports_in_progress`.

### Behavior Changes
- Import requests no longer run long-running provider sync inline; they dispatch queue jobs.
- On queue dispatch, `merchants.imports_in_progress.{type}` is set to current timestamp (`Y-m-d H:i:s`).
- On job completion/failure, that key is reset to `null`.
- If an import type is already in progress, duplicate queue requests for the same type are not enqueued.

### Breaking Changes
- Yes.
- Import endpoints changed from synchronous result payloads (`imported_count` + resources) to asynchronous queue acknowledgement payloads.

### Verification
- `php -l app/Services/MerchantIntegrationService.php`
- `php -l app/Http/Controllers/Api/V1/MerchantIntegrationController.php`
- `php -l app/Jobs/ImportProviderVehiclesJob.php`
- `php -l app/Jobs/ImportProviderDriversJob.php`
- `php -l app/Jobs/ImportProviderLocationsJob.php`
- `php -l app/Http/Requests/GetTrackingProviderImportStatusesRequest.php`
- `php -l routes/api.php`
- `php -l database/migrations/2026_02_27_180000_add_imports_in_progress_to_merchants_table.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Added explicit API CORS configuration to allow local Next.js frontend requests.

### API Changes
- Cross-origin requests from local frontend origins are now allowed for `api/*` routes.

### Database Changes
- None.

### Behavior Changes
- Added `config/cors.php` with:
  - `paths`: `api/*`, `sanctum/csrf-cookie`
  - `allowed_origins`: `http://localhost:3000`, `http://127.0.0.1:3000`
  - `allowed_methods`: `*`
  - `allowed_headers`: `*`
- Browser preflight (`OPTIONS`) requests for API endpoints can now be answered with CORS headers before auth middleware blocks them.

### Breaking Changes
- None.

### Verification
- `php -l config/cors.php`
- `php artisan config:clear`
- Re-test `POST /api/v1/tracking-providers/{provider_id}/import_locations` from `http://localhost:3000`.

---

## 2026-02-27 | Version: unreleased

### Summary
- MiX location import now derives missing coordinates from geofence polygon center.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- During tracking-provider location import, if `latitude`/`longitude` are missing but a polygon `ShapeWkt` geofence is present:
  - the system computes polygon centroid coordinates, and
  - stores those as location latitude/longitude.
- If centroid cannot be computed (invalid/degenerate polygon), coordinates remain null.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/Mixtelematics/MixIntegrateService.php`
- Import a location with `ShapeWkt` but no `latitude`/`longitude` and confirm stored coordinates are populated from polygon center.

---

## 2026-02-27 | Version: unreleased

### Summary
- Added `imported_at` tracking to imported locations, drivers, and vehicles.

### API Changes
- Import responses for locations, drivers, and vehicles now include:
  - `imported_at`

### Database Changes
- Added migration:
  - `database/migrations/2026_02_27_170000_add_imported_at_to_locations_drivers_vehicles_tables.php`
- Migration adds nullable timestamp `imported_at` to:
  - `locations`
  - `drivers`
  - `vehicles`

### Behavior Changes
- Each successful tracking-provider import upsert now sets `imported_at` on the affected row for:
  - vehicles
  - drivers
  - locations
- `metadata.imported_at` behavior remains unchanged.

### Breaking Changes
- None.

### Verification
- `php -l database/migrations/2026_02_27_170000_add_imported_at_to_locations_drivers_vehicles_tables.php`
- `php -l app/Services/MerchantIntegrationService.php`
- `php -l app/Models/Location.php`
- `php -l app/Models/Driver.php`
- `php -l app/Models/Vehicle.php`
- `php -l app/Http/Resources/LocationResource.php`
- `php -l app/Http/Resources/DriverResource.php`
- `php -l app/Http/Resources/VehicleResource.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Added `only_with_geofences` support to tracking-provider location imports so clients can import only geofenced locations on demand.

### API Changes
- `POST /api/v1/tracking-providers/{provider_id}/import_locations` now accepts:
  - `only_with_geofences` (optional boolean)

### Database Changes
- None.

### Behavior Changes
- Import request can now override integration options for a single run with `only_with_geofences`.
- For MiX imports, when `only_with_geofences=true`, locations are imported only if geofence data exists:
  - non-empty `ShapeWkt`, or
  - numeric `Radius` greater than `0`.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/ImportTrackingProviderLocationsRequest.php`
- `php -l app/Http/Controllers/Api/V1/MerchantIntegrationController.php`
- `php -l app/Services/MerchantIntegrationService.php`
- `php -l app/Services/Mixtelematics/MixIntegrateService.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Added support for location contact email storage and response serialization.

### API Changes
- Location create/update payloads now accept:
  - `email` (nullable, valid email, max 255)
- Location resource payloads now return:
  - `email`

### Database Changes
- Added migration:
  - `database/migrations/2026_02_27_160000_add_email_to_locations_table.php`
- Migration adds nullable `email` column to `locations`.

### Behavior Changes
- Location email can now be persisted via manual create/update, CSV import, address-based location creation, and tracking-provider location imports.

### Breaking Changes
- None.

### Verification
- `php -l database/migrations/2026_02_27_160000_add_email_to_locations_table.php`
- `php -l app/Models/Location.php`
- `php -l app/Http/Resources/LocationResource.php`
- `php -l app/Http/Requests/StoreLocationRequest.php`
- `php -l app/Http/Requests/UpdateLocationRequest.php`
- `php -l app/Services/LocationService.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Fixed tracking-provider location import failures when provider polygon WKT is saved into `locations.polygon_bounds` (MySQL geometry).

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Provider-imported `polygon_bounds` is now persisted as geometry using `ST_GeomFromText(...)` for non-sqlite drivers.
- On sqlite, imported polygon WKT continues to be stored as plain text.
- Invalid polygon WKT strings are skipped with a warning log instead of causing a full location import failure.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/MerchantIntegrationService.php`
- Import provider locations with `polygon_bounds` WKT and confirm no MySQL 1416 geometry error.

---

## 2026-02-27 | Version: unreleased

### Summary
- Made key location address fields nullable to support integration/import payloads that do not provide full structured address data.

### API Changes
- None.

### Database Changes
- Added migration:
  - `database/migrations/2026_02_27_150000_make_location_address_fields_nullable.php`
- Migration changes `locations` columns to nullable:
  - `address_line_1`
  - `city`
  - `province`
  - `post_code`

### Behavior Changes
- Location records can now be persisted with missing values for the four address fields above.

### Breaking Changes
- None.

### Verification
- `php -l database/migrations/2026_02_27_150000_make_location_address_fields_nullable.php`
- `php -l docs/release-notes.md`

---

## 2026-02-27 | Version: unreleased

### Summary
- Switched auto run/shipment lifecycle logic from `locations.is_loading_location` to location type flags (`collection_point`, `delivery_point`) and added lifecycle vehicle activity events.

### API Changes
- Vehicle activity event type filters now support:
  - `shipment_created`
  - `shipment_ended`
  - `run_started`
  - `run_ended`
- Vehicle activity location payload no longer includes `is_loading_location`.

### Database Changes
- Added migration:
  - `database/migrations/2026_02_27_140000_drop_is_loading_location_from_locations_table.php`
- Migration drops `locations.is_loading_location`.

### Behavior Changes
- Auto lifecycle decisions now use location type flags:
  - `collection_point=true` drives run start/finish behavior.
  - `delivery_point=true` drives auto shipment creation/attempt behavior.
  - if both flags are true, delivery handling and collection handling are both executed.
  - if location has no `location_type_id`/relation, auto create/complete behavior is skipped.
- On lifecycle transitions, system now records explicit vehicle activity events for shipment and run boundaries.
- Collection-point re-entry to the same origin location no longer completes the active run unless at least one run shipment exists.

### Breaking Changes
- Yes.
- `locations.is_loading_location` is removed from runtime behavior and database schema; clients should rely on `location_types.collection_point` and `location_types.delivery_point`.

### Verification
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Models/VehicleActivity.php`
- `php -l app/Http/Requests/ListVehicleActivitiesRequest.php`
- `php -l app/Services/LocationService.php`
- `php -l app/Http/Resources/VehicleActivityResource.php`
- `php -l database/migrations/2026_02_27_140000_drop_is_loading_location_from_locations_table.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Updated shipment full report pickup timing fields to use the latest previous pickup location visit per shipment.

### API Changes
- `GET /api/v1/reports/shipments_full_report` now includes:
  - `from_time_out` (alias of pickup `time_out`)
- `from_time_to` remains for backward compatibility and now resolves from the same latest pickup visit source.

### Database Changes
- None.

### Behavior Changes
- Pickup-side report times now resolve from the latest `vehicle_activity` record where:
  - `shipment_id` matches shipment
  - `location_id` matches `shipments.pickup_location_id`
  - `event_type = entered_location`
- This replaces aggregate `MIN(entered_at)` / `MAX(exited_at)` behavior with latest-visit values.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `php -l docs/release-notes.md`

---

## 2026-02-27 | Version: unreleased

### Summary
- Added merchant onboarding timestamp support via `setup_completed_at` on merchant settings updates.

### API Changes
- `PATCH /api/v1/merchants/{merchant_uuid}/settings` now accepts:
  - `setup_completed_at` (optional, nullable date/datetime)
- Merchant responses now include:
  - `setup_completed_at` (formatted in merchant timezone)

### Database Changes
- Added `setup_completed_at` (nullable timestamp) to `merchants`:
  - migration: `database/migrations/2026_02_27_130000_add_setup_completed_at_to_merchants_table.php`

### Behavior Changes
- Merchant settings update now persists `setup_completed_at` when supplied.
- Returned merchant payloads include `setup_completed_at` immediately after update.

### Breaking Changes
- None.

### Verification
- `php -l database/migrations/2026_02_27_130000_add_setup_completed_at_to_merchants_table.php`
- `php -l app/Http/Requests/UpdateMerchantSettingsRequest.php`
- `php -l app/Services/MerchantService.php`
- `php -l app/Http/Resources/MerchantResource.php`
- `php -l tests/Feature/MerchantTest.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Replaced legacy `locations.type` usage with `locations.location_type_id` across schema, APIs, and services.

### API Changes
- Location payloads now use `location_type_id` (UUID of `location_types`) instead of `type`.
- `POST /api/v1/locations` now accepts `location_type_id` (and defaults to merchant `waypoint` when omitted).
- `PATCH /api/v1/locations/{location_uuid}` now accepts `location_type_id` for updates.
- Location responses now return:
  - `location_type_id`
  - `location_type_slug`
- Route/run location stop payloads now expose `location_type_id`/`location_type_slug` instead of string `type`.
- Shipment/quote address payloads now accept optional:
  - `pickup_address.location_type_id`
  - `dropoff_address.location_type_id`

### Database Changes
- Added migration:
  - `database/migrations/2026_02_27_120000_replace_locations_type_with_location_type_id.php`
- Migration actions:
  - add `locations.location_type_id` foreign key to `location_types`
  - backfill `location_type_id` from existing `locations.type` values (creating merchant `location_types` rows as needed)
  - drop `locations.type`

### Behavior Changes
- Location create/update/import now resolve and persist location type via `location_type_id`.
- Address-based location creation for shipments/quotes now assigns default types by context:
  - pickup addresses default to `pickup`
  - dropoff addresses default to `dropoff`
  - imports/default address flows use `waypoint` when type is unspecified
- CSV import now validates optional `location_type_id` UUID input instead of `type` slug.

### Breaking Changes
- Yes.
- Clients must stop sending/reading `locations.type` and move to `location_type_id` (`UUID`) for all location type handling.

### Verification
- `php -l database/migrations/2026_02_27_120000_replace_locations_type_with_location_type_id.php`
- `php -l app/Services/LocationService.php`
- `php -l app/Http/Requests/StoreLocationRequest.php`
- `php -l app/Http/Requests/UpdateLocationRequest.php`
- `php -l app/Http/Resources/LocationResource.php`
- `php -l app/Http/Resources/RouteResource.php`
- `php -l app/Http/Resources/RunResource.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Made location type sync accept missing slugs by deriving them from the provided title.

### API Changes
- `PATCH /api/v1/location-types` now supports payload items without `types[].slug`.
- If `types[].slug` is omitted (or blank), the backend resolves slug from `types[].title`.
- Sync now returns validation errors for:
  - invalid provided slugs that cannot be normalized
  - duplicate resolved slugs within the same `types` payload

### Database Changes
- None.

### Behavior Changes
- Bulk sync now updates/creates records using a resolved slug (`slug` input or title-derived slug).
- Clients can send cleaner payloads using only `title` for new/updated type entries when explicit slugs are unnecessary.
- Location types docs now reflect optional `slug` behavior and title-based slug generation.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/LocationTypeService.php`
- `rg -n "types\\[\\]\\.slug|generates it from" docs/location-types-explained.md`

---

## 2026-02-27 | Version: unreleased

### Summary
- Updated location type fallback defaults to return seven operational slugs instead of a single `default` type.

### API Changes
- `GET /api/v1/location-types` fallback payload now returns these slugs when a merchant has no saved location types:
  - `depot`, `pickup`, `dropoff`, `service`, `waypoint`, `break`, `fuel`
- Fallback point flags now map as:
  - `collection_point=true`: `depot`, `pickup`
  - `delivery_point=true`: `service`

### Database Changes
- None.

### Behavior Changes
- Merchant fallback location types now align with configured operational defaults:
  - `depot` is fallback `default=true` at sequence `1`
  - remaining fallback types are returned in sequence order through `fuel` (`7`)
- Added feature coverage for fallback order and point flag behavior.
- Updated location type API docs examples to reflect the new fallback defaults.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/LocationTypeService.php`
- `php -l tests/Feature/LocationTypeFallbackTest.php`
- `rg -n "Fallback slugs are|delivery_point=true only for \`service\`" docs/location-types-explained.md`
- `php artisan test --filter=LocationTypeFallbackTest`

---

## 2026-02-26 | Version: unreleased

### Summary
- Added `delivery_point` support to location types across database, API validation, responses, service sync logic, docs, and Postman samples.

### API Changes
- `LocationTypeResource` now includes:
  - `delivery_point` (boolean)
- `PATCH /api/v1/location-types` request now accepts:
  - `types[].delivery_point` (optional boolean)
- `GET /api/v1/location-types` responses now include `delivery_point` for each type (including fallback default types).

### Database Changes
- Added `delivery_point` column to `location_types`:
  - migration: `database/migrations/2026_02_26_130000_add_delivery_point_to_location_types_table.php`
  - type: `boolean`
  - default: `false`

### Behavior Changes
- Bulk location type sync now persists `delivery_point` per submitted type.
- Fallback/default location type payload now includes `delivery_point=false`.
- Updated Postman patch request examples and location-type docs to include `delivery_point`.

### Breaking Changes
- None.

### Verification
- `php -l database/migrations/2026_02_26_130000_add_delivery_point_to_location_types_table.php`
- `php -l app/Models/LocationType.php`
- `php -l app/Http/Resources/LocationTypeResource.php`
- `php -l app/Http/Requests/SyncLocationTypesRequest.php`
- `php -l app/Services/LocationTypeService.php`
- `php -r 'foreach (glob("postman/collections/*.json") as $f) { json_decode(file_get_contents($f), true); if (json_last_error()) { echo "INVALID $f: ".json_last_error_msg()."\n"; exit(1);} } echo "OK\n";'`

---

## 2026-02-26 | Version: unreleased

### Summary
- Restored location type listing endpoint while retaining bulk sync patch endpoint.

### API Changes
- Added back:
  - `GET /api/v1/location-types?merchant_id={merchant_uuid}`
- Existing retained:
  - `PATCH /api/v1/location-types`
- `GET /api/v1/location-types` supports optional filters:
  - `collection_point` (boolean)
  - `default` (boolean)
- `GET /api/v1/location-types` response includes `meta.is_default_fallback` to indicate when fallback defaults are returned.

### Database Changes
- None.

### Behavior Changes
- Clients can fetch merchant location types without submitting a patch payload.
- If a merchant has no saved types, GET returns default fallback types (`is_default_fallback=true`) as before.
- Postman collections now expose both GET and PATCH requests for location types.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/LocationTypeController.php`
- `php -l app/Services/LocationTypeService.php`
- `php -l routes/api.php`
- `php artisan route:list --path=api/v1/location-types`
- `php -r 'foreach (glob("postman/collections/*.json") as $f) { json_decode(file_get_contents($f), true); if (json_last_error()) { echo "INVALID $f: ".json_last_error_msg()."\n"; exit(1);} } echo "OK\n";'`

---

## 2026-02-26 | Version: unreleased

### Summary
- Refactored location type management to a single bulk sync endpoint using `PATCH /api/v1/location-types`.

### API Changes
- Removed location type endpoints:
  - `GET /api/v1/location-types`
  - `GET /api/v1/location-types/{location_type_uuid}`
  - `POST /api/v1/location-types`
  - `PATCH /api/v1/location-types/{location_type_uuid}`
  - `DELETE /api/v1/location-types/{location_type_uuid}`
- Added single endpoint:
  - `PATCH /api/v1/location-types`
- New request contract:
  - `merchant_id` (required UUID)
  - `types` (required array, min 1)
  - `types[].location_type_id` (optional UUID)
  - `types[].slug` (required, distinct in payload)
  - `types[].title` (required)
  - `types[].collection_point`, `types[].sequence`, `types[].icon`, `types[].color`, `types[].default` (optional)
- New response contract for patch:
  - returns full saved location type list for the merchant.

### Database Changes
- None.

### Behavior Changes
- Patch now performs bulk sync:
  - creates types when merchant has none
  - updates existing types by `location_type_id` or `slug`
  - creates new submitted types
  - removes omitted merchant types
- Default handling is normalized so only one submitted `default=true` (first encountered) is kept.
- Updated Postman collections and docs to reflect bulk patch-only flow.

### Breaking Changes
- Yes.
- Clients must stop using location type `GET/POST/DELETE` and item-level patch endpoints and use only `PATCH /api/v1/location-types`.

### Verification
- `php -l app/Http/Controllers/Api/V1/LocationTypeController.php`
- `php -l app/Services/LocationTypeService.php`
- `php -l app/Http/Requests/SyncLocationTypesRequest.php`
- `php -l routes/api.php`
- `php artisan route:list --path=api/v1/location-types`
- `php -r 'foreach (glob("postman/collections/*.json") as $f) { json_decode(file_get_contents($f), true); if (json_last_error()) { echo "INVALID $f: ".json_last_error_msg()."\n"; exit(1);} } echo "OK\n";'`

---

## 2026-02-26 | Version: unreleased

### Summary
- Updated Postman collections to include the new `location-types` endpoints.

### API Changes
- No runtime API contract changes.
- Documentation/testing collections now include:
  - `GET /api/v1/location-types?merchant_id={{merchant_id}}`
  - `POST /api/v1/location-types`
  - `GET /api/v1/location-types/{{location_type_uuid}}`
  - `PATCH /api/v1/location-types/{{location_type_uuid}}`
  - `DELETE /api/v1/location-types/{{location_type_uuid}}`

### Database Changes
- None.

### Behavior Changes
- No application runtime behavior changes.

### Internal Changes
- Added and standardized `location-types` request entries in:
  - `postman/collections/Courier Integrate API.postman_collection.json`
  - `postman/collections/Courier Integrate API - Super Admins.postman_collection.json`
  - `postman/collections/Courier Integrate API - Drivers.postman_collection.json`
  - `postman/collections/New Collection.postman_collection.json`

### Breaking Changes
- None.

### Verification
- `php -r 'foreach (glob("postman/collections/*.json") as $f) { json_decode(file_get_contents($f), true); if (json_last_error()) { echo "INVALID $f: ".json_last_error_msg()."\n"; exit(1);} echo "OK $f\n"; }'`
- `rg -n "GET /api/v1/location-types|POST /api/v1/location-types|GET /api/v1/location-types/\{\{location_type_uuid\}\}|PATCH /api/v1/location-types/\{\{location_type_uuid\}\}|DELETE /api/v1/location-types/\{\{location_type_uuid\}\}" postman/collections/*.json`

---

## 2026-02-26 | Version: unreleased

### Summary
- Added merchant-managed `location_types` API with full CRUD and default fallback response when a merchant has no saved location types.

### API Changes
- Added endpoints:
  - `GET /api/v1/location-types` (requires `merchant_id` for merchant-scoped listing)
  - `GET /api/v1/location-types/{location_type_uuid}`
  - `POST /api/v1/location-types`
  - `PATCH /api/v1/location-types/{location_type_uuid}`
  - `DELETE /api/v1/location-types/{location_type_uuid}`
- Added request/response schema support for fields:
  - `slug`, `title`, `collection_point`, `sequence`, `icon`, `color`, `default`, `merchant_id`, `account_id`
- `GET /api/v1/location-types` now returns `meta.is_default_fallback=true` and a built-in default type when no location types exist for the merchant.

### Database Changes
- Added table `location_types` with merchant/account scoping and soft deletes:
  - migration: `database/migrations/2026_02_26_120000_create_location_types_table.php`
  - columns: `uuid`, `account_id`, `merchant_id`, `slug`, `title`, `collection_point`, `sequence`, `icon`, `color`, `default`, timestamps, `deleted_at`
  - constraints/indexes:
    - unique: `(merchant_id, slug)`
    - indexes on `(merchant_id, sequence)` and `(merchant_id, default)`

### Behavior Changes
- Users can now manage merchant-specific location types instead of relying only on hardcoded location `type` values.
- When a merchant has no saved location types, the API returns a default type payload (`slug=default`, `title=Default`) so clients always have at least one option.
- Setting `default=true` on create/update clears existing default flags for other location types under the same merchant.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/LocationTypeController.php`
- `php -l app/Services/LocationTypeService.php`
- `php -l app/Http/Requests/StoreLocationTypeRequest.php`
- `php -l app/Http/Requests/UpdateLocationTypeRequest.php`
- `php -l app/Http/Resources/LocationTypeResource.php`
- `php -l app/Models/LocationType.php`
- `php -l app/Http/Requests/BaseRequest.php`
- `php -l routes/api.php`
- `php -l database/migrations/2026_02_26_120000_create_location_types_table.php`
- `php artisan route:list --path=api/v1/location-types`

---

## 2026-02-26 | Version: unreleased

### Summary
- Added driver details to vehicle activity API responses.

### API Changes
- `VehicleActivityResource` now includes a `driver` object (when activity is linked to a run with a driver), with:
  - `driver_id`
  - `name`
  - `email`
  - `telephone`
  - `intergration_id`
  - `is_active`

### Database Changes
- None.

### Behavior Changes
- Vehicle activity list responses now expose driver identity/contact fields for easier UI rendering without separate run/driver fetches.
- `VehicleActivityService` now eager-loads `run.driver.user` to avoid N+1 queries when serializing driver details.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Resources/VehicleActivityResource.php`
- `php -l app/Services/VehicleActivityService.php`

---

## 2026-02-26 | Version: unreleased

### Summary
- Added real-time vehicle activity broadcasting over authenticated private socket channels.

### API Changes
- Added broadcast auth endpoint for private channels:
  - `POST /api/v1/broadcasting/auth` (middleware: `auth.api`)
- Added private channel:
  - `merchant.{merchantUuid}.vehicle-activities`
- Added event name on the channel:
  - `vehicle.activity.created` (payload includes `VehicleActivityResource` data under `activity`)

### Database Changes
- None.

### Behavior Changes
- Every newly created `vehicle_activity` record in the auto-run lifecycle now emits `vehicle.activity.created` to the merchant-scoped private channel.
- Channel authorization allows:
  - `super_admin`
  - users in the same account as the merchant
  - users linked to or owning the merchant
- Added `config/broadcasting.php` with a safe default (`BROADCAST_CONNECTION=log`) so broadcast dispatch does not break when no realtime provider is configured yet.
- Implemented in `app/Events/VehicleActivityCreated.php`, `routes/channels.php`, `app/Providers/AppServiceProvider.php`, and `app/Services/AutoRunLifecycleService.php`.

### Breaking Changes
- None.

### Verification
- `php -l app/Events/VehicleActivityCreated.php`
- `php -l routes/channels.php`
- `php -l app/Providers/AppServiceProvider.php`
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l config/broadcasting.php`

---

## 2026-02-25 | Version: unreleased

### Summary
- Auto-created runs now attempt to resolve and assign driver from tracking payload `driverID` (`driverIntegrationId`) by matching `drivers.intergration_id`.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- In geofence loading-location entry flow, auto-created runs now set `runs.driver_id` using:
  1. `drivers.intergration_id == driverIntegrationId` (same merchant account), otherwise
  2. fallback to latest `driver_vehicles` assignment for the vehicle (existing behavior).
- Updated in `app/Services/AutoRunLifecycleService.php`.
- Added coverage for integration-id assignment in `tests/Feature/AutoRunLifecycleServiceTest.php`.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l tests/Feature/AutoRunLifecycleServiceTest.php`
- `php artisan test --filter=AutoRunLifecycleServiceTest` (fails due pre-existing SQLite-incompatible migration: `2026_02_05_000098_update_booking_status_enum.php` uses MySQL `ALTER TABLE ... MODIFY ... ENUM`)

---

## 2026-02-24 | Version: unreleased

### Summary
- Added filter and sort capabilities to the full shipments report endpoint.

### API Changes
- `GET /api/v1/reports/shipments_full_report` now supports filters:
  - `date_created`
  - `collection_date`
  - `shipment_number`
  - `delivery_note_number`
  - `truck_plate_number`
  - `driver_id`
  - `from_location_id`
  - `to_location_id`
  - `shipment_status`
- `GET /api/v1/reports/shipments_full_report` now supports sorting:
  - `sort_by=date_created|collection_date|shipment_number|delivery_note_number|truck_plate_number|driver_name|shipment_status|delivered_volume`
  - `sort_direction=asc|desc`

### Database Changes
- None.

### Behavior Changes
- Report rows are now filtered at query level before pagination.
- Sorting by truck plate and driver name is based on the latest non-removed run-shipment association.
- Sorting by `delivered_volume` uses parcel weight totals for deterministic ordering.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/ReportController.php`

---

## 2026-02-24 | Version: unreleased

### Summary
- Added a full shipments reporting endpoint with shipment, routing, location, timing, and delivered-volume data.
- Added `delivery_note_number` to shipments.
- Updated shipment parcel schema from `weight_kg` to `weight` with explicit `weight_measurement`, and added parcel `type`.

### API Changes
- Added endpoint:
  - `GET /api/v1/reports/shipments_full_report`
- Report rows now include:
  - `date_created`, `collection_date`, `shipment_number` (`merchant_order_ref`), `delivery_note_number`, `truck_plate_number`, `driver`, `shipment_type`, `from_location`, `from_time_in`, `from_time_to`, `to_location`, `to_time_in`, `to_time_out`, `shipment_status`, `delivered_volume`.
- Shipment create/update payloads now accept:
  - `delivery_note_number`
  - parcel `weight`, `weight_measurement`, `type` (replacing `weight_kg`)
- Quote request payload parcel validation now expects:
  - `weight`, `weight_measurement`, `type` (replacing `weight_kg`)
- Shipment resource now exposes `delivery_note_number`.
- Shipment parcel resource now exposes `weight`, `weight_measurement`, and `type`.

### Database Changes
- Added shipment field:
  - `database/migrations/2026_02_24_202457_add_delivery_note_number_to_shipments_table.php`
- Updated `shipment_parcels` weight schema:
  - rename `weight_kg` -> `weight`
  - add `weight_measurement` (default `kg`)
  - add `type`
  - migration: `database/migrations/2026_02_24_202458_update_shipment_parcels_weight_fields.php`

### Behavior Changes
- Full shipment report now returns full `LocationResource` objects for both pickup and dropoff locations.
- Pickup/dropoff in/out times are derived from shipment-linked `vehicle_activity` geofence enter visits.
- Delivered volume is rendered as grouped totals by measurement unit (example: `12 kg, 4 l`) and only populated for delivered shipments.

### Breaking Changes
- `weight_kg` is replaced by `weight` + `weight_measurement` in shipment parcel API payloads/resources and in the `shipment_parcels` table schema.

### Verification
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `php -l app/Http/Requests/CreateQuoteRequest.php`
- `php -l app/Http/Requests/StoreShipmentRequest.php`
- `php -l app/Http/Requests/UpdateShipmentRequest.php`
- `php -l app/Http/Resources/ShipmentParcelResource.php`
- `php -l app/Http/Resources/ShipmentResource.php`
- `php -l app/Models/Shipment.php`
- `php -l app/Models/ShipmentParcel.php`
- `php -l app/Services/ShipmentService.php`
- `php -l database/migrations/2026_02_24_202457_add_delivery_note_number_to_shipments_table.php`
- `php -l database/migrations/2026_02_24_202458_update_shipment_parcels_weight_fields.php`
- `php -l tests/Feature/ShipmentQuoteTest.php`
- `php -l routes/api.php`
- `php artisan route:list --path=api/v1/reports/shipments_full_report`
- `php artisan test --filter=ShipmentQuoteTest` (fails due pre-existing SQLite-incompatible migration: `2026_02_05_000098_update_booking_status_enum.php` uses MySQL `ALTER TABLE ... MODIFY ... ENUM`)

---

## 2026-02-23 | Version: unreleased

### Summary
- Removed route stop uniqueness requirement on `(route_id, sequence)` to allow multiple stops sharing the same sequence.

### API Changes
- Route create/update validation now allows repeated `stops.*.sequence` values.

### Database Changes
- Dropped unique index `uq_route_stops_route_sequence` on `route_stops(route_id, sequence)`.
- Added non-unique index `idx_route_stops_route_sequence` on `route_stops(route_id, sequence)`.
- Migration:
  - `database/migrations/2026_02_23_000014_drop_unique_route_sequence_on_route_stops_table.php`

### Behavior Changes
- Route stop syncing now supports repeated sequence values for a single route and preserves requested duplicates.
- Updated in `app/Services/RouteService.php`, `app/Http/Requests/StoreRouteRequest.php`, and `app/Http/Requests/UpdateRouteRequest.php`.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/RouteService.php`
- `php -l app/Http/Requests/StoreRouteRequest.php`
- `php -l app/Http/Requests/UpdateRouteRequest.php`
- `php -l tests/Feature/RouteServiceTest.php`

---

## 2026-02-23 | Version: unreleased

### Summary
- Fixed duplicate `route_stops` sequence writes during repeated auto-route sync in vehicle tracking workflows.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Auto-route stop syncing now reuses/restores existing stop rows by `sequence` instead of soft-deleting and reinserting.
- Prevents `SQLSTATE[23000] ... Duplicate entry '<route_id>-<sequence>' for key 'route_stops.uq_route_stops_route_sequence'` during repeated auto-route creation/sync.
- Updated in `app/Services/RouteService.php`.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/RouteService.php`
- `php -l tests/Feature/RouteServiceTest.php`

---

## 2026-02-23 | Version: unreleased

### Summary
- Changed auto-created shipment default lifecycle status from `booked` to `in_transit`.

### API Changes
- None.

### Database Changes
- Expanded shipment status enum to include `in_transit` (MySQL):
  - `database/migrations/2026_02_23_000013_update_shipment_status_enum_add_in_transit.php`

### Behavior Changes
- In geofence-driven auto shipment creation, new auto-created shipments now start as `in_transit`.
- Existing non-terminal auto-created shipments encountered in the same flow are normalized to `in_transit` instead of `booked`.
- Updated in `app/Services/AutoRunLifecycleService.php`.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l database/migrations/2026_02_23_000013_update_shipment_status_enum_add_in_transit.php`
- `php -l tests/Feature/AutoRunLifecycleServiceTest.php`

---

## 2026-02-23 | Version: unreleased

### Summary
- Added shipment linkage to vehicle activity records.

### API Changes
- `GET /api/v1/vehicle-activities` now returns `shipment_id` and `shipment` object on each activity.
- Added `shipment_id` filter support on `GET /api/v1/vehicle-activities`.

### Database Changes
- Added nullable `shipment_id` foreign key to `vehicle_activity`:
  - `database/migrations/2026_02_23_000012_add_shipment_id_to_vehicle_activity_table.php`

### Behavior Changes
- On dropoff geofence entry, `vehicle_activity` enter events now store the related shipment.
- On dropoff geofence exit, exit events now carry `shipment_id` and delivery sync uses the linked shipment when available.
- Updated in `app/Services/AutoRunLifecycleService.php`.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Http/Resources/VehicleActivityResource.php`
- `php -l app/Services/VehicleActivityService.php`

---

## 2026-02-23 | Version: unreleased

### Summary
- Updated auto-created shipment lifecycle around geofence events.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Auto-created shipments for dropoff geofence entry are now created/normalized with `status=booked`.
- When vehicle exits that dropoff geofence visit, the matching auto-created shipment is marked `delivered`.
- Related `run_shipments` row is moved to `done` when auto-delivery occurs on location exit.
- Changed in `app/Services/AutoRunLifecycleService.php`.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/AutoRunLifecycleService.php`

---

## 2026-02-23 | Version: unreleased

### Summary
- Added route management domain and route assignment to runs.
- Added location stop type support (`locations.type`).
- Wired auto-run lifecycle to create/assign auto routes when ending a run at a loading location.

### API Changes
- Added route endpoints:
  - `GET /api/v1/routes`
  - `GET /api/v1/routes/{route_uuid}`
  - `POST /api/v1/routes`
  - `PATCH /api/v1/routes/{route_uuid}`
  - `DELETE /api/v1/routes/{route_uuid}`
- Run payloads now accept `route_id` and responses include route details.
- Location payloads now accept `type`.

### Database Changes
- Added `locations.type`:
  - `database/migrations/2026_02_22_000008_add_type_to_locations_table.php`
- Added `routes` table:
  - `database/migrations/2026_02_22_000009_create_routes_table.php`
- Added `route_stops` table:
  - `database/migrations/2026_02_22_000010_create_route_stops_table.php`
- Added `runs.route_id`:
  - `database/migrations/2026_02_22_000011_add_route_id_to_runs_table.php`

### Behavior Changes
- Route stop order is sequence-based with unique sequence per route.
- Auto route code format:
  - `AUTO-ROUTE-{origin_location_name_or_company}-{destination_location_name_or_company}`
- Auto-created routes are restored if previously soft-deleted and reused.

### Breaking Changes
- None.

### Verification
- `php -l` passed for new/updated route/location/run service and request/resource files.
- `php artisan route:list --path=api/v1/routes` confirms route endpoints are registered.

---

## Entry Template

```md
## YYYY-MM-DD | Version: x.y.z

### Summary
- ...

### API Changes
- ...

### Database Changes
- ...

### Behavior Changes
- ...

### Breaking Changes
- None.

### Verification
- ...
```
