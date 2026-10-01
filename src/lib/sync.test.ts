import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearLocalOwner,
  configureLocalOwner,
  getJournalEntry,
  getMediaForEntry,
  listOutbox,
  listPets,
  resetDatabaseForTests,
  saveJournalEntry,
  saveMedia,
  savePet,
  updateSyncResult,
} from './local-db'
import { syncOutbox } from './sync'
import type { JournalEntry, Pet, SyncSnapshot } from './types'

const now = '2026-10-01T12:00:00.000Z'

const pet = (patch: Partial<Pet> = {}): Pet => ({
  id: '108cb27a-70c1-421e-a062-9c5b707445ae',
  name: 'Juniper',
  species: 'dog',
  approximateBirthDate: false,
  weightUnit: 'kg',
  createdAt: now,
  updatedAt: now,
  ...patch,
})

const entry = (patch: Partial<JournalEntry> = {}): JournalEntry => ({
  id: 'a0ee2f36-1c2e-4e3d-9ab0-b0b33399312a',
  petId: pet().id,
  type: 'memory',
  occurredAt: now,
  title: 'Window watch',
  body: 'A long, serious look at a pigeon.',
  createdAt: now,
  updatedAt: now,
  ...patch,
})

const snapshot = (patch: Partial<SyncSnapshot> = {}): SyncSnapshot => ({
  pets: [],
  journal: [],
  measurements: [],
  reminders: [],
  outings: [],
  media: [],
  ...patch,
})

describe('two-way synchronization', () => {
  beforeEach(async () => {
    clearLocalOwner()
    await configureLocalOwner(`sync-test-${crypto.randomUUID()}`, false)
    await resetDatabaseForTests()
    vi.unstubAllGlobals()
  })

  it('restores server records into an empty device database', async () => {
    const remotePet = pet()
    const remoteEntry = entry()
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        snapshot({
          pets: [remotePet],
          journal: [remoteEntry],
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await syncOutbox(true)

    expect((await listPets())[0]?.name).toBe('Juniper')
    expect((await getJournalEntry(remoteEntry.id))?.title).toBe('Window watch')
    expect(fetchMock).toHaveBeenCalledWith('/api/sync', { method: 'GET' })
  })

  it('accepts newer remote records when the local record has no pending change', async () => {
    await savePet(pet({ name: 'Old local name' }))
    const queued = (await listOutbox())[0]
    if (!queued) throw new Error('Expected a queued pet')
    await updateSyncResult(queued, true)

    const remotePet = pet({
      name: 'New remote name',
      updatedAt: '2026-10-01T13:00:00.000Z',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(snapshot({ pets: [remotePet] }))),
    )

    await syncOutbox(true)

    expect((await listPets())[0]?.name).toBe('New remote name')
  })

  it('does not overwrite a pending local change while pulling remote state', async () => {
    await saveJournalEntry(entry({ title: 'Pending local edit' }))
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      if (init?.method === 'POST') {
        return Response.json({ message: 'Try later' }, { status: 503 })
      }

      return Response.json(
        snapshot({
          pets: [pet()],
          journal: [
            entry({
              title: 'Remote edit',
              updatedAt: '2026-10-01T13:00:00.000Z',
            }),
          ],
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncOutbox(true)

    expect((await getJournalEntry(entry().id))?.title).toBe('Pending local edit')
    expect((await listOutbox())[0]?.status).toBe('failed')
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'GET')).toBe(true)
  })

  it('uses the client media ID to make upload retries idempotent', async () => {
    const mediaId = '7ce6396a-74f2-4e7e-9f0f-82633e2d5fd6'
    await saveMedia({
      id: mediaId,
      petId: pet().id,
      mimeType: 'image/jpeg',
      blob: new Blob(['photo'], { type: 'image/jpeg' }),
      createdAt: now,
      syncState: 'pending',
    })
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      if (init?.method === 'POST') {
        return Response.json({ objectKey: 'photo-key', url: '/api/media/photo-key' })
      }

      return Response.json(snapshot())
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncOutbox(true)

    const upload = fetchMock.mock.calls.find(([input]) => input === '/api/uploads')
    const body = upload?.[1]?.body
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('mediaId')).toBe(mediaId)
  })

  it('reconciles media uploaded before stable client IDs were introduced', async () => {
    const objectKey = 'users/test/pets/pet/photo.jpeg'
    await saveMedia({
      id: 'cc02924a-e392-4c8c-acb8-aa9a793c99f2',
      petId: pet().id,
      journalEntryId: entry().id,
      objectKey,
      mimeType: 'image/jpeg',
      createdAt: now,
      syncState: 'synced',
    })
    const serverMediaId = 'bb877ccc-d8f9-483a-9631-7acb1867c64e'
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json(
          snapshot({
            media: [
              {
                id: serverMediaId,
                petId: pet().id,
                journalEntryId: entry().id,
                objectKey,
                mimeType: 'image/jpeg',
                localUrl: `/api/media/${objectKey}`,
                createdAt: now,
                syncState: 'synced',
              },
            ],
          }),
        ),
      ),
    )

    await syncOutbox(true)

    expect((await getMediaForEntry(entry().id))?.id).toBe(serverMediaId)
  })

  it('preserves local photo previews while their upload is still pending', async () => {
    const photoUrl = 'data:image/jpeg;base64,cGhvdG8='
    await saveJournalEntry(entry({ photoUrl }))
    const queued = (await listOutbox())[0]
    if (!queued) throw new Error('Expected a queued journal entry')
    await updateSyncResult(queued, true)
    await saveMedia({
      id: '3bb2ac2b-9da8-4cf0-b101-fdfe732e49ae',
      petId: pet().id,
      journalEntryId: entry().id,
      mimeType: 'image/jpeg',
      blob: new Blob(['photo'], { type: 'image/jpeg' }),
      localUrl: photoUrl,
      createdAt: now,
      syncState: 'failed',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json(
          snapshot({
            pets: [pet()],
            journal: [entry()],
          }),
        ),
      ),
    )

    await syncOutbox()

    expect((await getJournalEntry(entry().id))?.photoUrl).toBe(photoUrl)
  })
})
