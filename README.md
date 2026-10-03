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
4. Add `CLERK_SECRET_KEY` as a Worker secret. Make `VITE_CLERK_PUBLISHABLE_KEY` available to the build, and configure `CLERK_AUTHORIZED_PARTIES` with the production origin. `CLERK_JWT_KEY` is optional and enables networkless session-token verification.
5. Apply the schema with `npm run db:migrate:remote`.
6. Preview with `npm run preview`, then deploy with `npm run deploy`.

All D1 and R2 access stays in authenticated Worker-only route handlers (`/api/sync`, `/api/uploads`, and private `/api/media/*` reads). The Worker derives `owner_id` from the verified Clerk session; it never trusts an owner supplied by the browser. Do not put Cloudflare credentials or the Clerk secret key in browser-visible `VITE_` variables.

### Deployments from GitHub Actions

The CI workflow runs `npm run check` on pushes and pull requests. After checks pass, pushes to `main` build the application, apply pending production D1 migrations, and deploy the `app` Worker using the committed Cloudflare configuration. Production deployments run one at a time; an active deployment is not canceled by a newer push. After building, each deployment checks the latest `main` commit and skips both migrations and the Worker upload if its commit is stale.

Configure these GitHub Actions values in the repository settings or its `production` environment:

| Type     | Name                         | Value                                                                         |
| -------- | ---------------------------- | ----------------------------------------------------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`       | API token scoped to the production Cloudflare account.                        |
| Secret   | `CLOUDFLARE_ACCOUNT_ID`      | Account ID containing the Worker, `pawprint-db`, and `pawprint-photos`.       |
| Variable | `VITE_CLERK_PUBLISHABLE_KEY` | Publishable key for the production Clerk application, embedded at build time. |

Follow [Cloudflare's GitHub Actions authentication guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/#1-authentication) to create the API token. Start with the Edit Cloudflare Workers template, restrict it to the production account, and include Account / D1 / Edit for migrations and Account / Workers R2 Storage / Edit for the R2 binding.

Before the first CI deployment, provision the database and bucket and set `CLERK_SECRET_KEY` on the `app` Worker with `npx wrangler secret put CLERK_SECRET_KEY`. Set the optional `CLERK_JWT_KEY` there too if needed. Worker secrets stay in Cloudflare and are retained during deployment; they are not GitHub build variables. Ensure `CLERK_AUTHORIZED_PARTIES` in `wrangler.jsonc` matches the deployed origin.

The GitHub `production` environment can restrict deployment to `main` and require reviewers if desired. Database migrations run before the new Worker is uploaded, so migrations must remain compatible with the currently deployed application. If migration or deployment fails, inspect the workflow logs before retrying; a failed Worker upload does not undo successful migrations.

## Offline model

IndexedDB stores pets, journal entries, health measurements, care reminders, walks and potty breaks, meals and food supplies, media blobs, and an explicit mutation outbox in a database scoped to the signed-in Clerk user. Client-generated UUIDs, per-edit revisions, and stable media IDs make retries idempotent. Acknowledgements only clear the revision that was sent, so in-flight edits remain queued. The sync service pushes pending changes and downloads an owner-scoped D1 snapshot at startup and when connectivity returns. Pending local edits are protected while remote records merge by `updated_at`, and failed changes remain editable and can be retried from the status control. Existing pre-auth local data is claimed once by the first account that signs in after upgrading.

The service worker caches the application shell and safe static assets. It deliberately excludes `/api/*` and all non-GET requests.

## Current MVP boundary

Pawprint is authenticated, single-owner, and local-first. Before a public launch, add background media compression/upload progress, Web Push, account recovery UX validation, and automated browser coverage against deployed preview bindings. See `STATUS.md` for milestone details.

## Walks and potty breaks

Dogs have quick walk and potty controls on Today. Care links to the full Walks & potty history for any pet. Start a walk to save its start time immediately; the elapsed timer recovers after reopening the app. Finish saves the walk before opening its editable details. Forgotten timers can be corrected there or discarded while active. You can also log past walks and potty breaks, edit notes and counts, or delete a record.

Pee and poop counts are optional: blank means not recorded, while zero explicitly means none. Quick pee/poop buttons create standalone potty breaks with undo. Counts recorded during a walk belong to that walk; the last-record labels show the walk start time, not an exact potty event time. Today and seven-day totals include completed walks grouped by their local start date. Only one active walk per pet is allowed on a device. GPS and distance are not included.

Apply `migrations/0002_outings.sql` with the normal D1 migration commands before deploying this feature. The IndexedDB upgrade preserves existing records and queued changes.

## Food and supplies

Today has a quick meal log and a link to Food; Care also links to Food. Log a food name, portion, unit (grams, ounces, cups, or servings), feeding time, and optional notes. Meals can be edited or deleted from the history.

Add each bag or batch as a separate supply with its starting amount and purchase time. Link meals to that supply to deduct their portions automatically. Linked portions use the supply’s unit; units cannot change on an existing supply. Editing, deleting, or moving a meal between supplies recalculates the balance. Meals without a supply stay in the history without affecting stock. Supplies show a restock notice at 20% or less remaining, and flag portions logged beyond the starting amount. Removing a supply keeps its meal history.

Meals and supplies work offline and sync with the account. Apply `migrations/0003_food.sql` with the normal D1 migration commands before deploying. IndexedDB upgrades preserve existing records and queued changes.
