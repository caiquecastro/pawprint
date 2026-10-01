# Pawprint MVP status

## Completed

- [x] TanStack Start + typed file routes + Cloudflare Vite build scaffold
- [x] Pawprint mobile shell and responsive visual system
- [x] Drizzle D1 schema, indexes, initial migration, idempotent repository
- [x] First-use pet setup with photo capture and validation
- [x] Today screen, mood check-in, weekly summary, recent moments
- [x] Journal create, read, edit, soft-delete, filtering, sync states
- [x] Weight, health-note, and vet-visit history
- [x] Recurring care reminders and completion history
- [x] Walk timer, manual walk history, and standalone potty breaks with optional counts
- [x] Mutation revisions and acknowledgement checks preserve edits made during synchronization
- [x] R2 upload/download endpoints and D1 media metadata
- [x] IndexedDB records and explicit mutation outbox
- [x] Startup/online synchronization with retry and client UUID idempotency
- [x] Clerk authentication, account-scoped IndexedDB, and owner-authorized D1/R2 routes
- [x] Manifest, service worker, app icons, offline fallback, update prompt
- [x] Semantic labels, focus styles, reduced motion, 44px touch targets

## Decisions

- IndexedDB is the immediate source of truth on-device; D1 is the synchronized server record.
- Outbox keys are stable per entity; each edit gets a new revision, and D1 records processed revisions to make retries idempotent.
- The MVP is deliberately single-owner per account; Clerk sessions provide the owner boundary.
- Photos remain in IndexedDB while offline and use a Worker-only R2 binding when uploaded.

## Validation

- `npm run generate-routes` — passed
- `npm run typecheck` — passed
- `npm test` — 6/6 passed
- `npm run build` — Cloudflare client and Worker builds passed
- `npm audit --omit=dev` — 0 production vulnerabilities
- Local D1 migration — 15 statements applied successfully
- Local sync API — four queued writes synchronized and cleared exactly once
- Local R2 — multipart PNG upload returned 201 and object read-back returned `image/png`
- Production PWA preview — service worker installed and `/setup` reloaded successfully with the preview server stopped
- Manual browser flow at 375×812 and 390×844: setup, journal create/edit/detail, weight record, reminder create/complete, and reload persistence verified

## Deployment prerequisites

- Create or reuse the production D1 database and R2 bucket.
- Create Clerk development and production instances, configure allowed origins, and add the Clerk build/runtime keys.
- The committed D1 database ID targets Pawprint's production account; replace it when deploying from another Cloudflare account.
- Apply migrations with `npm run db:migrate:remote`, then run `npm run deploy`.
