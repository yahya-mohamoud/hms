# Hotel Management System: first-version architecture

## Product boundary

This system supports staff-operated reservations and walk-ins for a 12-room hotel. It has no public booking website, online reservation flow, channel manager, OTA connection, or dependency on continuous internet access for ordinary front-desk workflows. The application runs on a local network or a small hosted server; PostgreSQL is the source of truth. ID images use private S3-compatible object storage (Supabase Storage is supported by its S3 endpoint).

## Structure

- `apps/api`: Node.js, TypeScript, Express, Prisma, PostgreSQL. Modules are separated by rooms, reservations, guests, stays, housekeeping, billing, reports, authentication, users, and audit.
- `apps/web`: Vite, React, TypeScript, Tailwind CSS. A responsive staff workspace provides the daily operating views.
- `apps/api/prisma/schema.prisma`: normalized domain model; migrations are generated with Prisma in deployment.
- `docker-compose.yml`: local PostgreSQL for development. Production secrets are environment variables, never committed.

## Core data decisions

- A `Reservation` records planned dates, booking source (walk-in, phone, or group), deposit, cancellation, and a primary guest. `Stay` records the actual checked-in/out event and assigned room. This supports edits/cancellations without corrupting stay history and allows room moves to be represented as room assignments.
- `Guest` is the durable identity and the source for repeat-guest insights. Stay-based aggregates count completed stays/nights and paid folio revenue; they are computed from operational records instead of stale counters.
- `Folio` and `FolioItem` represent room charges and extras; `Payment` records each tender and is immutable in amount after recording. Outstanding balance is derived from charges minus payments.
- Room status is explicit, with housekeeping tasks recording who did what and when. A room cannot be assigned to overlapping active stays.
- ID document rows contain only private object keys and metadata. Uploads are resized, converted to WebP, and size-capped before object storage; clients receive short-lived signed URLs after authorization.
- Every important mutation can emit an `ActivityLog`; role checks are enforced in the API, not only in the UI.

## Operational modules

1. Authentication and staff roles: receptionist, manager, housekeeping, admin; JWT access tokens and hashed passwords.
2. Rooms and housekeeping: 12 seeded rooms, room-status board, task assignment, clean/inspect flow, out-of-order notes.
3. Guests and reservations: searchable guest profiles, walk-in/phone/group reservations, deposits, cancellation notes, daily/month occupancy.
4. Stays: check-in, room assignment/move, folio creation, check-out, final balance handling.
5. Billing: room charge posting, extras, cash/mobile money/card/bank transfer, printable invoice, daily closing summary.
6. Reports: arrivals/departures/occupancy, room status, revenue/occupancy trends, guest totals and repeat guests.

## Delivery sequence

1. Establish this architecture and Prisma schema.
2. Implement API foundations, auth/validation/error handling and domain endpoints.
3. Implement the staff UI and connect daily workflows to the API.
4. Add local setup/deployment guidance and operational seed data.

## First-version tradeoffs

The app favors clear staff workflows over complex hotel integrations. Reporting aggregates are queried from stays, folios, and payments; a 12-room property does not need a separate analytics warehouse. The API is stateless except for PostgreSQL and object storage. For a site with unreliable internet, host the API and PostgreSQL on the property LAN; configure object storage to be reachable on that LAN or provide a deliberate deferred-upload process before using ID capture offline.
