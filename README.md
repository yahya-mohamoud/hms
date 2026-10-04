# Staywell Hotel Desk

A local-first hotel operations system for a 12-room property. It covers staff-run reservations and walk-ins, room status, guest profiles, check-in/out, folios and payments, daily reporting, guest insights, staff roles, and audit activity. There is no public booking engine, OTA, channel manager, online reservation integration, or digital housekeeping workflow.

## Architecture

Read [the architecture and data-model decisions](docs/architecture.md). The Prisma schema is at `apps/api/prisma/schema.prisma`. It separates reservations from actual stays, and guest profile data from private ID image objects. ID photos are resized to at most 1000 px, converted to WebP, and compressed before upload; PostgreSQL stores only object keys and metadata. Signed download URLs expire after five minutes.

## Local development

Requirements: Node.js 20+, npm 10+, Docker, and an S3-compatible object store when you want to use ID photo capture.

1. Start PostgreSQL with `docker compose up -d`.
2. Copy `apps/api/.env.example` to `apps/api/.env`; set a long random `JWT_SECRET`, a new `ADMIN_PASSWORD`, and a unique `ADMIN_RECOVERY_KEY` (at least 32 characters).
3. Install dependencies from the repository root with `npm install`.
4. Generate the Prisma client and create the local database schema with `npm run db:generate` and `npm run db:migrate`.
5. Seed 12 rooms and the first admin with `npm run db:seed`.
6. Start the API and web app in separate terminals with `npm run dev:api` and `npm run dev:web`.
7. Open the Vite address printed by its dev server. Browser API requests use `/api`, which Vite proxies to Express on port 4000.

Create production bundles with `npm run build`. The API serves `apps/web/dist` from its configured port when that build is present, so an on-prem installation can use one web address for both the app and API. During development Vite proxies `/api` to the API on port 4000.

The development seed defaults to `admin@local.hotel` / `ChangeMe123!` only when `ADMIN_PASSWORD` is unset. Change it before using any shared or production environment. Set each room's actual base rate in PostgreSQL before taking reservations; the seed deliberately uses `0` because currency and rates were not specified.

## Private ID image storage

Create a **private** bucket in Supabase Storage (or another S3-compatible object store). Configure `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` in `apps/api/.env`. For Supabase, use the project's S3 endpoint and an access key with access only to the private ID bucket. Do not make the bucket public. The API returns short-lived signed GET links only to authenticated reception, manager, and admin users. A local LAN deployment should use an object-store endpoint reachable from that LAN; the database and API can run on the hotel network so ordinary front-desk workflows do not depend on public internet.

## Roles

- **Receptionist:** guest profiles, reservations, check-in/out, room status, folios and payment entry.
- **Manager:** receptionist workflows plus guest insights and daily close.
- **Admin:** all workflows, activity-log access, staff account management, and administrator password recovery.

Worker accounts retained from earlier setup can be activated, deactivated, or deleted by an admin, but cannot sign in. Room status is updated directly by reception or management.

Role and account-active checks happen on API requests. Store environment files and storage keys outside version control. Back up PostgreSQL and the private object bucket together; the DB contains references to guest ID objects, not the image bytes.

## Current operational notes

- Monetary values use the hotel's configured numbers as entered; set room rates and folio charges in the chosen local currency. Currency labeling is a deployment-specific follow-up because the property currency was not provided.
- Daily occupancy reporting covers completed or active stays. Reservation calendar entries are not counted as room occupancy until check-in.
- A checkout marks the room Dirty. Staff mark it Clean, Inspected, or Available directly from the room board after preparing it.
- Reservation entry searches existing profiles by guest name and phone and lets staff reuse a matching guest record.
- Set `ADMIN_RECOVERY_KEY` to a unique random value of at least 32 characters in `apps/api/.env`. Only an active admin account with this key can use the password recovery form. Receptionists must contact the admin to have their password changed.
- ID capture requires object storage to be reachable at upload time. If internet is unavailable and there is no local S3-compatible store, staff can complete the check-in without uploading an image and attach it later when storage is reachable.

## Database and operations

Use `npm run db:migrate` for local Prisma migrations. For production, generate and commit a reviewed migration in a controlled deployment environment, then apply with `prisma migrate deploy`; do not use `migrate dev` against production. Daily close saves a one-time reconciliation snapshot for a business date, including tender totals, ADR and RevPAR. Repeating the close returns the saved snapshot without rewriting it. Checkout requires an exact zero folio balance; record a payment or correct an open charge before completing checkout.
