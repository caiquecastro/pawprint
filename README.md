# Pawprint

Pawprint is a mobile-first, installable life book for a pet: journal moments, health history, care reminders, and photos in one calm place. It is built with TanStack Start, TanStack Router and Query, Cloudflare Workers, D1, R2, Drizzle, and IndexedDB.

## Local development

Requirements: Node.js 22.12 or newer and a current npm.

```bash
npm install
cp .env.example .env
npm run db:migrate:local
npm run dev
```

Create a Clerk application and replace the placeholder values in `.env`. Enable the sign-in methods you want in Clerk, then copy its publishable key, secret key, and JWT public key. `CLERK_AUTHORIZED_PARTIES` must contain the exact local and deployed origins that may mint session tokens.

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
4. Add `CLERK_SECRET_KEY` and `CLERK_JWT_KEY` as Worker secrets. Make `VITE_CLERK_PUBLISHABLE_KEY` available to the build, and configure `CLERK_AUTHORIZED_PARTIES` with the production origin.
5. Apply the schema with `npm run db:migrate:remote`.
6. Preview with `npm run preview`, then deploy with `npm run deploy`.

All D1 and R2 access stays in authenticated Worker-only route handlers (`/api/sync`, `/api/uploads`, and private `/api/media/*` reads). The Worker derives `owner_id` from the verified Clerk session; it never trusts an owner supplied by the browser. Do not put Cloudflare credentials or the Clerk secret key in browser-visible `VITE_` variables.

## Offline model

IndexedDB stores pets, journal entries, health measurements, care reminders, media blobs, and an explicit mutation outbox in a database scoped to the signed-in Clerk user. Client-generated UUIDs and owner-scoped D1 mutation IDs make retries idempotent. The sync service runs at startup and when connectivity returns; failed changes remain editable and can be retried from the status control. Existing pre-auth local data is claimed once by the first account that signs in after upgrading.

The service worker caches the application shell and safe static assets. It deliberately excludes `/api/*` and all non-GET requests.

## Current MVP boundary

Pawprint is authenticated, single-owner, and local-first. Before a public launch, add background media compression/upload progress, Web Push, account recovery UX validation, and automated browser coverage against deployed preview bindings. See `STATUS.md` for milestone details.
