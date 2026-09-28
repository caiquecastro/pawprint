import { createFileRoute } from '@tanstack/react-router'
import '@tanstack/react-start'
import { env } from 'cloudflare:workers'

export const Route = createFileRoute('/api/media/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!env.PHOTOS) return new Response('Photo storage unavailable', { status: 503 })
        if (!params._splat) return new Response('Photo not found', { status: 404 })
        const object = await env.PHOTOS.get(params._splat)
        if (!object) return new Response('Photo not found', { status: 404 })
        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)
        headers.set('cache-control', 'private, max-age=86400')
        return new Response(object.body, { headers })
      },
    },
  },
})
