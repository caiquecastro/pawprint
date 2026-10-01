import { createFileRoute } from '@tanstack/react-router'
import '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { syncMutationSchema } from '../lib/schemas'
import { getAuthenticatedUserId } from '../server/auth'
import { OwnershipError, PawprintRepository } from '../server/repository'

export const Route = createFileRoute('/api/sync')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const userId = await getAuthenticatedUserId()
          if (!userId) {
            return Response.json({ message: 'Sign in to download your records.' }, { status: 401 })
          }
          if (!env.DB) {
            return Response.json({ message: 'Cloud sync is not configured yet.' }, { status: 503 })
          }

          const snapshot = await new PawprintRepository(env.DB, userId).getSnapshot()
          return Response.json(snapshot)
        } catch (error) {
          console.error(
            JSON.stringify({
              event: 'sync_pull_failed',
              message: error instanceof Error ? error.message : 'unknown',
            }),
          )
          return Response.json(
            { message: 'Cloud records could not be downloaded.' },
            { status: 500 },
          )
        }
      },
      POST: async ({ request }) => {
        try {
          const userId = await getAuthenticatedUserId()
          if (!userId)
            return Response.json(
              { message: 'Sign in to synchronize your changes.' },
              { status: 401 },
            )
          const mutation = syncMutationSchema.parse(await request.json())
          if (!env.DB)
            return Response.json(
              { message: 'Cloud sync is not configured yet. Your change is safe on this device.' },
              { status: 503 },
            )
          const result = await new PawprintRepository(env.DB, userId).applyMutation({
            ...mutation,
            attemptCount: 0,
            status: 'pending',
          })
          return Response.json({ ok: true, ...result })
        } catch (error) {
          if (error instanceof Error && error.name === 'ZodError')
            return Response.json(
              { message: 'This change could not be validated.' },
              { status: 400 },
            )
          if (error instanceof OwnershipError)
            return Response.json({ message: 'Record not found.' }, { status: 404 })
          console.error(
            JSON.stringify({
              event: 'sync_mutation_failed',
              message: error instanceof Error ? error.message : 'unknown',
            }),
          )
          return Response.json(
            { message: 'Sync is temporarily unavailable. Your change remains on this device.' },
            { status: 500 },
          )
        }
      },
    },
  },
})
