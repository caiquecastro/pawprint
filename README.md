# Pawprint

Pawprint is a mobile-first, installable life book for a pet: journal moments, health history, care reminders, and photos in one calm place. It is built with TanStack Start, TanStack Router and Query, Cloudflare Workers, D1, R2, Drizzle, and IndexedDB.

## Local development

Requirements: Node.js 22.12 or newer and a current npm.

```bash
npm install
npm run db:migrate:local
npm run dev
```

Open `http://localhost:3000`. The app works before Cloudflare resources are configured: writes are saved to IndexedDB and remain visibly queued. Applying the local migration enables the D1 synchronization endpoint. Wrangler emulates the R2 bucket locally from `wrangler.jsonc`.

## Checks

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

## Cloudflare deployment

1. Create or reuse a D1 database named `pawprint-db` and an R2 bucket named `pawprint-photos`.
2. The committed `database_id` targets Pawprint's production database. When deploying from another Cloudflare account, replace it with that account's D1 database ID.
3. Run `npm run cf-typegen` after changing bindings.
4. Apply the schema with `npm run db:migrate:remote`.
5. Preview with `npm run preview`, then deploy with `npm run deploy`.

All D1 and R2 access stays in Worker-only route handlers (`/api/sync`, `/api/uploads`, and private `/api/media/*` reads). Do not put Cloudflare credentials in browser-visible `VITE_` variables.

## Offline model

IndexedDB stores pets, journal entries, health measurements, care reminders, media blobs, and an explicit mutation outbox. Client-generated UUIDs and the D1 `processed_mutations` table make retries idempotent. The sync service runs at startup and when connectivity returns; failed changes remain editable and can be retried from the status control.

The service worker caches the application shell and safe static assets. It deliberately excludes `/api/*` and all non-GET requests.

## Current MVP boundary

Pawprint is single-owner and local-first. Before a public launch, add authentication and derive `owner_id` from a verified session, background media compression/upload progress, Web Push, and automated browser coverage against deployed preview bindings. See `STATUS.md` for milestone details.
