import { createFileRoute } from '@tanstack/react-router'
import '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import { and, eq } from 'drizzle-orm'
import { journalEntries, media, pets } from '../db/schema'
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES } from '../lib/schemas'
import { getAuthenticatedUserId } from '../server/auth'
import { z } from 'zod'

export const Route = createFileRoute('/api/uploads')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getAuthenticatedUserId()
        if (!userId) return Response.json({ message: 'Sign in to upload photos.' }, { status: 401 })
        if (!env.DB || !env.PHOTOS)
          return Response.json({ message: 'Photo storage is not configured.' }, { status: 503 })
        const data = await request.formData()
        const file = data.get('file')
        const mediaId = data.get('mediaId')
        const petId = data.get('petId')
        const entryId = data.get('journalEntryId')
        const parsedMediaId = z.uuid().safeParse(mediaId)
        if (
          !(file instanceof File) ||
          typeof petId !== 'string' ||
          (mediaId !== null && !parsedMediaId.success)
        )
          return Response.json({ message: 'A photo and pet are required.' }, { status: 400 })
        if (!ALLOWED_PHOTO_TYPES.includes(file.type) || file.size > MAX_PHOTO_BYTES)
          return Response.json(
            { message: 'This photo type or size is not supported.' },
            { status: 400 },
          )
        const db = drizzle(env.DB)
        const ownerPet = await db
          .select({ id: pets.id })
          .from(pets)
          .where(and(eq(pets.id, petId), eq(pets.ownerId, userId)))
          .get()
        if (!ownerPet) return Response.json({ message: 'Pet not found.' }, { status: 404 })
        const id = parsedMediaId.success ? parsedMediaId.data : crypto.randomUUID()
        const journalEntryId = typeof entryId === 'string' && entryId ? entryId : undefined
        if (typeof entryId === 'string' && entryId) {
          const entry = await db
            .select({ id: journalEntries.id })
            .from(journalEntries)
            .where(and(eq(journalEntries.id, entryId), eq(journalEntries.petId, petId)))
            .get()
          if (!entry) return Response.json({ message: 'Journal entry not found.' }, { status: 404 })
        }
        const existingMedia = await db
          .select({ petId: media.petId, journalEntryId: media.journalEntryId })
          .from(media)
          .where(eq(media.id, id))
          .get()
        if (
          existingMedia &&
          (existingMedia.petId !== petId ||
            (existingMedia.journalEntryId ?? undefined) !== journalEntryId)
        ) {
          return Response.json({ message: 'Photo not found.' }, { status: 404 })
        }
        const ext = file.type.split('/')[1] || 'jpg'
        const key = `users/${userId}/pets/${petId}/${id}.${ext}`
        await env.PHOTOS.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
        const mediaWrite = db
          .insert(media)
          .values({
            id,
            petId,
            journalEntryId,
            objectKey: key,
            mimeType: file.type,
            createdAt: new Date().toISOString(),
          })
          .onConflictDoUpdate({
            target: media.id,
            set: {
              objectKey: key,
              mimeType: file.type,
            },
          })
        if (journalEntryId) {
          await db.batch([mediaWrite] as const)
        } else {
          await db.batch([
            mediaWrite,
            db.update(pets).set({ avatarObjectKey: key }).where(eq(pets.id, petId)),
          ] as const)
        }
        return Response.json({ id, objectKey: key, url: `/api/media/${key}` }, { status: 201 })
      },
    },
  },
})
