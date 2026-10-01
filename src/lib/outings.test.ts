import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  adjustPottyCount,
  clearLocalOwner,
  configureLocalOwner,
  deleteOuting,
  finishWalk,
  getDb,
  listOutbox,
  listOutings,
  listPets,
  resetDatabaseForTests,
  saveOuting,
  startWalk,
} from './local-db'
import { elapsedWalk, summarizeOutings } from './outings'
import { outingSchema, syncMutationSchema } from './schemas'
import type { Outing } from './types'

const petId = '108cb27a-70c1-421e-a062-9c5b707445ae'
const now = '2026-09-30T15:00:00.000Z'
const example = (patch: Partial<Outing> = {}): Outing => ({
  id: crypto.randomUUID(),
  petId,
  kind: 'walk',
  startedAt: '2026-09-30T14:30:00.000Z',
  endedAt: now,
  peeCount: null,
  poopCount: null,
  notes: '',
  createdAt: now,
  updatedAt: now,
  ...patch,
})

beforeEach(async () => {
  clearLocalOwner()
  await configureLocalOwner('outings-tests', false)
  await resetDatabaseForTests()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(now))
})

afterEach(() => {
  vi.useRealTimers()
  clearLocalOwner()
})

describe('walk and potty records', () => {
  it('recovers an active walk and counts after reopening account storage', async () => {
    const walk = await startWalk(petId)
    await adjustPottyCount(walk.id, 'peeCount', 2)
    clearLocalOwner()
    await configureLocalOwner('outings-tests', false)
    vi.setSystemTime(new Date('2026-09-30T15:12:34.000Z'))
    const recovered = (await listOutings(petId))[0]
    expect(recovered.endedAt).toBeNull()
    expect(recovered.peeCount).toBe(2)
    expect(elapsedWalk(recovered.startedAt, Date.now())).toBe('12:34')
    const finished = await finishWalk(walk.id)
    expect(finished.endedAt).toBe('2026-09-30T15:12:34.000Z')
    expect(finished.poopCount).toBeNull()
  })

  it('atomically permits only one active walk per pet, including concurrent starts', async () => {
    const results = await Promise.allSettled([startWalk(petId), startWalk(petId)])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await listOutings(petId)).toHaveLength(1)
    expect(await listOutbox()).toHaveLength(1)
    await expect(startWalk(crypto.randomUUID())).resolves.toMatchObject({ endedAt: null })
  })

  it('distinguishes unknown, none, counts, and clearing an accidental count', async () => {
    const walk = await startWalk(petId)
    expect(walk.peeCount).toBeNull()
    await adjustPottyCount(walk.id, 'peeCount', 0)
    expect((await listOutings(petId))[0].peeCount).toBe(0)
    await adjustPottyCount(walk.id, 'peeCount', 1)
    await adjustPottyCount(walk.id, 'peeCount', null)
    expect((await listOutings(petId))[0].peeCount).toBeNull()
  })

  it('edits and soft-deletes walks and standalone potty breaks', async () => {
    const walk = await saveOuting(example())
    await saveOuting({ ...walk, notes: 'Shorter route', peeCount: 0 })
    const potty = await saveOuting(example({ kind: 'potty', startedAt: now, peeCount: 1 }))
    expect((await listOutings(petId))[0].id).toBe(potty.id)
    await deleteOuting(walk.id)
    expect(await listOutings(petId)).toHaveLength(1)
    expect((await listOutbox()).find((item) => item.entityId === walk.id)?.operation).toBe('delete')
    await expect(saveOuting(walk)).rejects.toThrow('deleted')
    await deleteOuting(potty.id)
    expect(await listOutings(petId)).toHaveLength(0)
  })

  it('allows another walk after discarding and isolates account and pet history', async () => {
    const walk = await startWalk(petId)
    await deleteOuting(walk.id)
    await startWalk(petId)
    expect(await listOutings(crypto.randomUUID())).toHaveLength(0)
    await configureLocalOwner('outings-other-account', false)
    expect(await listOutings(petId)).toHaveLength(0)
  })

  it('upgrades an existing v1 database without losing pets or queued changes', async () => {
    clearLocalOwner()
    const owner = `migration-${crypto.randomUUID()}`
    const db = await openDB(`pawprint-life-book:${owner}`, 1, {
      upgrade(database) {
        database.createObjectStore('pets', { keyPath: 'id' })
        database.createObjectStore('outbox', { keyPath: 'id' })
      },
    })
    await db.put('pets', { id: petId, createdAt: now, name: 'Juniper' })
    await db.put('outbox', { id: `pet:${petId}`, createdAt: now })
    db.close()
    await configureLocalOwner(owner, false)
    expect((await listPets())[0].name).toBe('Juniper')
    expect(await listOutbox()).toHaveLength(1)
    expect(await listOutings(petId)).toHaveLength(0)
    expect((await getDb()).version).toBe(2)
  })
})

describe('validation and summaries', () => {
  it('rejects invalid timestamps, reversed walks, fractional counts, and empty potty breaks', () => {
    for (const patch of [
      { startedAt: 'not a date' },
      { endedAt: '2026-09-30T14:00:00.000Z' },
      { endedAt: '2026-09-30T14:30:00.000Z' },
      { peeCount: -1 },
      { poopCount: 1.5 },
      { kind: 'potty' as const, startedAt: now },
    ]) {
      expect(outingSchema.safeParse(example(patch)).success).toBe(false)
    }
    expect(outingSchema.safeParse(example({ peeCount: 0 })).success).toBe(true)
    expect(
      outingSchema.safeParse(example({ kind: 'potty', startedAt: now, poopCount: 1 })).success,
    ).toBe(true)
  })

  it('ties sync IDs to the entity and payload and accepts legacy revisions', () => {
    const record = example()
    const mutation = {
      id: `outing:${record.id}`,
      entity: 'outing',
      entityId: record.id,
      operation: 'create',
      payload: record,
      createdAt: now,
    }
    expect(syncMutationSchema.safeParse(mutation).success).toBe(true)
    expect(
      syncMutationSchema.safeParse({ ...mutation, revision: crypto.randomUUID() }).success,
    ).toBe(true)
    expect(
      syncMutationSchema.safeParse({ ...mutation, entityId: crypto.randomUUID() }).success,
    ).toBe(false)
    expect(
      syncMutationSchema.safeParse({ ...mutation, payload: { ...record, id: crypto.randomUUID() } })
        .success,
    ).toBe(false)
  })

  it('uses local calendar days, excludes active/deleted/future walks, and includes standalone potty', () => {
    const localNow = new Date(2026, 8, 30, 15)
    const at = (day: number, hour: number, minute = 0) =>
      new Date(2026, 8, day, hour, minute).toISOString()
    const records = [
      example({ startedAt: at(30, 8), endedAt: at(30, 8, 20), peeCount: 1 }),
      example({ startedAt: at(29, 23, 50), endedAt: at(30, 0, 10) }),
      example({ startedAt: at(24, 0), endedAt: at(24, 0, 15) }),
      example({ startedAt: at(23, 23), endedAt: at(23, 23, 30) }),
      example({ startedAt: at(30, 12), endedAt: null }),
      example({ startedAt: at(30, 9), endedAt: at(30, 10), deletedAt: now }),
      example({ startedAt: at(31, 9), endedAt: at(31, 10) }),
      example({ kind: 'potty', startedAt: at(30, 11), endedAt: at(30, 11), poopCount: 1 }),
    ]
    const summary = summarizeOutings(records, localNow)
    expect(summary.todayCount).toBe(1)
    expect(summary.todayMinutes).toBe(20)
    expect(summary.weekCount).toBe(3)
    expect(summary.weekMinutes).toBe(55)
    expect(summary.lastPee?.id).toBe(records[0].id)
    expect(summary.lastPoop?.kind).toBe('potty')
  })
})
