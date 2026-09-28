import { createFileRoute } from '@tanstack/react-router'
import '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { syncMutationSchema } from '../lib/schemas'
import { PawprintRepository } from '../server/repository'

export const Route = createFileRoute('/api/sync')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const mutation = syncMutationSchema.parse(await request.json())
          if (!env.DB)
            return Response.json(
              { message: 'Cloud sync is not configured yet. Your change is safe on this device.' },
              { status: 503 },
            )
          const result = await new PawprintRepository(env.DB).applyMutation({
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
          console.error('sync_mutation_failed', {
            message: error instanceof Error ? error.message : 'unknown',
          })
          return Response.json(
            { message: 'Sync is temporarily unavailable. Your change remains on this device.' },
            { status: 500 },
          )
        }
      },
    },
  },
})
