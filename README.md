# Staywell Hotel Desk

A local-first hotel operations system for a 12-room property. It covers staff-run reservations and walk-ins, room operations, guest profiles, check-in/out, folios and payments, housekeeping, daily reporting, guest insights, staff roles, and audit activity. There is no public booking engine, OTA, channel manager, or online reservation integration.

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
7. Open the Vite address printed by its dev server. The default API address is `http://localhost:4000/api`.

Create production bundles with `npm --workspace apps/api run build` and `npm --workspace apps/web run build`. Set `VITE_API_URL` in `apps/web/.env` when the API is not at the local default.

The development seed defaults to `admin@local.hotel` / `ChangeMe123!` only when `ADMIN_PASSWORD` is unset. Change it before using any shared or production environment. Set each room's actual base rate in PostgreSQL before taking reservations; the seed deliberately uses `0` because currency and rates were not specified.

## Private ID image storage

Create a **private** bucket in Supabase Storage (or another S3-compatible object store). Configure `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` in `apps/api/.env`. For Supabase, use the project's S3 endpoint and an access key with access only to the private ID bucket. Do not make the bucket public. The API returns short-lived signed GET links only to authenticated reception, manager, and admin users. A local LAN deployment should use an object-store endpoint reachable from that LAN; the database and API can run on the hotel network so ordinary reception and housekeeping workflows do not depend on public internet.

## Roles

- **Receptionist:** guest profiles, reservations, check-in/out, room status, folios and payment entry.
- **Manager:** receptionist workflows plus reports, daily close and staff visibility.
- **Housekeeping:** room board and assigned room tasks; guest/folio records are not exposed through housekeeping endpoints.
- **Admin:** all workflows and staff account management.

Role and account-active checks happen on API requests. Store environment files and storage keys outside version control. Back up PostgreSQL and the private object bucket together; the DB contains references to guest ID objects, not the image bytes.

## Current operational notes

- Monetary values use the hotel's configured numbers as entered; set room rates and folio charges in the chosen local currency. Currency labeling is a deployment-specific follow-up because the property currency was not provided.
- Daily occupancy reporting covers completed or active stays. Reservation calendar entries are not counted as room occupancy until check-in.
- A checkout marks the room dirty and opens a turnover task. Completing cleaning moves it to Clean and creates an inspection task; completing the inspection moves it to Inspected.
- ID capture requires object storage to be reachable at upload time. If internet is unavailable and there is no local S3-compatible store, staff can complete the check-in without uploading an image and attach it later when storage is reachable.

## Database and operations

Use `npm run db:migrate` for local Prisma migrations. For production, generate and commit a reviewed migration in a controlled deployment environment, then apply with `prisma migrate deploy`; do not use `migrate dev` against production. Daily close is repeatable for a business date and updates that date's saved summary if run again.
