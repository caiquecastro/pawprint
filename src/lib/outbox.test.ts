import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearLocalOwner,
  configureLocalOwner,
  getJournalEntry,
  listOutbox,
  listPets,
  resetDatabaseForTests,
  saveJournalEntry,
  savePet,
} from './local-db'
import { syncOutbox } from './sync'

const entry = () => ({
  id: 'a0ee2f36-1c2e-4e3d-9ab0-b0b33399312a',
  petId: '108cb27a-70c1-421e-a062-9c5b707445ae',
  type: 'memory' as const,
  occurredAt: '2026-09-26T12:00:00.000Z',
  title: 'Window watch',
  body: 'A long, serious look at a pigeon.',
  createdAt: '2026-09-26T12:00:00.000Z',
  updatedAt: '2026-09-26T12:00:00.000Z',
})

const emptySnapshot = () =>
  Response.json({
    pets: [],
    journal: [],
    measurements: [],
    reminders: [],
    outings: [],
    media: [],
  })

describe('offline outbox', () => {
  beforeEach(async () => {
    clearLocalOwner()
    await configureLocalOwner('test-user', false)
    await resetDatabaseForTests()
    vi.unstubAllGlobals()
  })

  it('keeps local records isolated by authenticated account', async () => {
    const now = '2026-09-26T12:00:00.000Z'
    await savePet({
      id: 'pet-a',
      name: 'Juniper',
      species: 'dog',
      approximateBirthDate: false,
      weightUnit: 'kg',
      createdAt: now,
      updatedAt: now,
    })
    await configureLocalOwner('another-user', false)
    expect(await listPets()).toHaveLength(0)
    await configureLocalOwner('test-user', false)
    expect((await listPets())[0]?.name).toBe('Juniper')
  })

  it('keeps a create idempotent when edited before sync', async () => {
    await saveJournalEntry(entry(), 'create')
    await saveJournalEntry({ ...entry(), title: 'Edited before sync' }, 'update')
    const outbox = await listOutbox()
    expect(outbox).toHaveLength(1)
    const queued = outbox[0]
    if (!queued) throw new Error('Expected one queued change')
    expect(queued.operation).toBe('create')
    expect((queued.payload as { title: string }).title).toBe('Edited before sync')
  })

  it('synchronizes a client UUID exactly once', async () => {
    await saveJournalEntry(entry(), 'create')
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (_input, init) =>
        init?.method === 'GET' ? emptySnapshot() : Response.json({ ok: true }),
      )
    vi.stubGlobal('fetch', fetchMock)
    await syncOutbox(true)
    await syncOutbox(true)
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
    expect(await listOutbox()).toHaveLength(0)
    expect((await getJournalEntry(entry().id))?.syncState).toBe('synced')
  })

  it('preserves failed changes and retries them', async () => {
    await saveJournalEntry(entry(), 'create')
    let postCount = 0
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      if (init?.method === 'GET') return emptySnapshot()

      postCount += 1
      return postCount === 1
        ? Response.json({ message: 'Try later' }, { status: 503 })
        : Response.json({ ok: true })
    })
    vi.stubGlobal('fetch', fetchMock)
    await syncOutbox(true)
    expect((await listOutbox())[0]?.status).toBe('failed')
    await syncOutbox(true)
    expect(await listOutbox()).toHaveLength(0)
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(2)
  })
})

it('gives edits a new server revision after a successful sync', async () => {
  clearLocalOwner()
  await configureLocalOwner('revision-test', false)
  await resetDatabaseForTests()
  await saveJournalEntry(entry())
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockImplementation(async (_input, init) =>
      init?.method === 'GET' ? emptySnapshot() : Response.json({ ok: true }),
    )
  vi.stubGlobal('fetch', fetchMock)
  await syncOutbox(true)
  await saveJournalEntry({ ...entry(), title: 'Later edit' }, 'update')
  await syncOutbox(true)
  const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')
  const first = JSON.parse(String(posts[0]?.[1]?.body))
  const second = JSON.parse(String(posts[1]?.[1]?.body))
  expect(second.id).toBe(first.id)
  expect(second.revision).not.toBe(first.revision)
  expect(second.payload.title).toBe('Later edit')
  vi.unstubAllGlobals()
})

it.each([true, false])(
  'preserves and sends edits made during an in-flight request (success: %s)',
  async (success) => {
    clearLocalOwner()
    await configureLocalOwner(`in-flight-${success}`, false)
    await resetDatabaseForTests()
    await saveJournalEntry(entry())
    let firstPost = true
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      if (init?.method === 'GET') return emptySnapshot()

      if (firstPost) {
        firstPost = false
        await saveJournalEntry({ ...entry(), title: 'Edited while syncing' }, 'update')
        return Response.json({ ok: success }, { status: success ? 200 : 503 })
      }
      return Response.json({ ok: true })
    })
    vi.stubGlobal('fetch', fetchMock)
    await syncOutbox(true)
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(2)
    expect((await getJournalEntry(entry().id))?.title).toBe('Edited while syncing')
    expect((await getJournalEntry(entry().id))?.syncState).toBe('synced')
    expect(await listOutbox()).toHaveLength(0)
    vi.unstubAllGlobals()
  },
)
