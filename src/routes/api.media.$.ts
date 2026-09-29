import { createFileRoute } from '@tanstack/react-router'
import '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { media, pets } from '../db/schema'
import { getAuthenticatedUserId } from '../server/auth'

export const Route = createFileRoute('/api/media/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const userId = await getAuthenticatedUserId()
        if (!userId) return new Response('Unauthorized', { status: 401 })
        if (!env.DB || !env.PHOTOS)
          return new Response('Photo storage unavailable', { status: 503 })
        if (!params._splat) return new Response('Photo not found', { status: 404 })
        const db = drizzle(env.DB)
        const ownedMedia = await db
          .select({ objectKey: media.objectKey })
          .from(media)
          .innerJoin(pets, eq(media.petId, pets.id))
          .where(and(eq(media.objectKey, params._splat), eq(pets.ownerId, userId)))
          .get()
        if (!ownedMedia) return new Response('Photo not found', { status: 404 })
        const object = await env.PHOTOS.get(params._splat)
        if (!object) return new Response('Photo not found', { status: 404 })
        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)
        headers.set('cache-control', 'private, no-store')
        return new Response(object.body, { headers })
      },
    },
  },
})
