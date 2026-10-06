# Staywell Hotel Desk

A local-first hotel operations system for a 12-room property. It covers staff-run reservations and walk-ins, room status, guest profiles, check-in/out, folios and payments, daily reporting, guest insights, staff roles, and audit activity. There is no public booking engine, OTA, channel manager, online reservation integration, or digital housekeeping workflow.

## Architecture

Read [the architecture and data-model decisions](docs/architecture.md). The Prisma schema is at `apps/api/prisma/schema.prisma`. It separates reservations from actual stays, and guest profile data from private ID image objects. ID photos are resized to at most 1000 px, converted to WebP, and compressed before upload; PostgreSQL stores only object keys and metadata. Signed download URLs expire after five minutes.

## Local development

Requirements: Node.js 20+, npm 10+, Docker, and an S3-compatible object store when you want to use ID photo capture.

1. Start PostgreSQL with `docker compose up -d`.
2. Copy `apps/api/.env.example` to `apps/api/.env`; set a long random `JWT_SECRET` and a new `ADMIN_PASSWORD`.
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
- While signed in as admin, set a private recovery passphrase from **Team access**. If the admin forgets their password, the sign-in recovery form accepts the admin email, that passphrase and a new password. Receptionists cannot use this recovery flow.
- ID capture requires object storage to be reachable at upload time. If internet is unavailable and there is no local S3-compatible store, staff can complete the check-in without uploading an image and attach it later when storage is reachable.

## Database and operations

Use `npm run db:migrate` for local Prisma migrations. For production, generate and commit a reviewed migration in a controlled deployment environment, then apply with `prisma migrate deploy`; do not use `migrate dev` against production. Daily close saves a one-time reconciliation snapshot for a business date, including tender totals, ADR and RevPAR. Repeating the close returns the saved snapshot without rewriting it. Checkout requires an exact zero folio balance; record a payment or correct an open charge before completing checkout.

## Production deployment: Render + Supabase + Cloudflare R2

The recommended first deployment is one Render web service for both the Express API and the built React frontend. The browser calls the API at same-origin `/api`, so this setup needs one public hostname and avoids a separate frontend service. Supabase hosts PostgreSQL, and Cloudflare R2 stores private guest ID images. Keep the R2 bucket private; the API generates short-lived signed links after checking the user's role.

The repository includes `render.yaml` and pins the Node runtime in `.node-version`. Connect the repository in Render and use the Blueprint. Before the first deploy, create a Supabase project and a private R2 bucket, then supply these Render variables:

- `DATABASE_URL`: Supabase **Session pooler** connection string (port 5432), with `sslmode=require`. Use the connection string's exact username/password. The app runs as a long-lived Node service, so the session pooler works with Prisma's PostgreSQL driver.
- `WEB_ORIGIN`: the Render service origin, such as `https://staywell-hms.onrender.com` (no trailing slash). Add any additional trusted staff UI origin as a comma-separated value only if the UI is hosted separately.
- `S3_ENDPOINT`: `https://<account-id>.r2.cloudflarestorage.com`.
- `S3_REGION`: `auto`; `S3_BUCKET`: the private bucket name.
- `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`: credentials scoped to this bucket with object read/write access. Do not use public `r2.dev` links.
- `ADMIN_EMAIL` and a unique strong `ADMIN_PASSWORD`: the first administrator created by the one-time seed hook. Change this password after the first sign-in.

Render generates `JWT_SECRET`. The Blueprint build installs dependencies, generates Prisma Client and builds both workspaces. Its pre-deploy command applies committed migrations with `prisma migrate deploy`; the initial deploy hook seeds the 12 rooms and the first admin; the service starts the compiled Express app. Render checks `/api/health/ready`, which returns success only when PostgreSQL responds. Keep migrations additive and review them before deployment. Do not run the seed hook again as a routine deployment; it is only for the initial bootstrap.

After deploy, confirm the readiness URL responds, sign in with the seeded admin, set the admin recovery passphrase, set room type prices, and verify a guest ID upload followed by opening its private signed link. For ongoing operations, enable Supabase backups/PITR appropriate to the selected plan and separately configure an R2 lifecycle/backup policy; database backups contain object keys, while R2 holds the files. For an area with unreliable internet, cloud hosting cannot provide local offline access: run the API/database/object storage on the hotel LAN or maintain connectivity and a tested backup/restore procedure.
