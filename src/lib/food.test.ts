import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { foodToday, remainingFood } from './food'
import {
  applySyncSnapshot,
  clearLocalOwner,
  configureLocalOwner,
  deleteFood,
  deleteFoodSupply,
  getDb,
  listFood,
  listFoodSupplies,
  listOutbox,
  listPets,
  resetDatabaseForTests,
  saveFood,
  saveFoodSupply,
  updateSyncResult,
} from './local-db'
import { foodEntrySchema } from './schemas'
import { syncOutbox } from './sync'
import type { FoodEntry, FoodSupply, SyncSnapshot } from './types'

const now = '2026-10-03T15:00:00.000Z'
const petId = '108cb27a-70c1-421e-a062-9c5b707445ae'
const meal = (patch: Partial<FoodEntry> = {}): FoodEntry => ({
  id: crypto.randomUUID(),
  petId,
  food: 'Chicken kibble',
  amount: 100,
  unit: 'g',
  fedAt: now,
  notes: '',
  createdAt: now,
  updatedAt: now,
  ...patch,
})
const supply = (patch: Partial<FoodSupply> = {}): FoodSupply => ({
  id: crypto.randomUUID(),
  petId,
  food: 'Chicken kibble',
  amount: 1000,
  unit: 'g',
  purchasedAt: now,
  notes: '',
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
  food: [],
  foodSupplies: [],
  media: [],
  ...patch,
})

beforeEach(async () => {
  clearLocalOwner()
  await configureLocalOwner(`food-tests-${crypto.randomUUID()}`, false)
  await resetDatabaseForTests()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(now))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  clearLocalOwner()
})

describe('food records and stock', () => {
  it('persists meals and supplies across reopening and isolates accounts and pets', async () => {
    const owner = `food-reload-${crypto.randomUUID()}`
    await configureLocalOwner(owner, false)
    const bag = await saveFoodSupply(supply())
    const entry = await saveFood(meal({ supplyId: bag.id }))
    clearLocalOwner()
    await configureLocalOwner(owner, false)
    expect(await listFood(petId)).toContainEqual(entry)
    expect(await listFoodSupplies(petId)).toContainEqual(bag)
    expect(await listFood(crypto.randomUUID())).toHaveLength(0)
    await configureLocalOwner(`another-${crypto.randomUUID()}`, false)
    expect(await listFood(petId)).toHaveLength(0)
    expect(await listFoodSupplies(petId)).toHaveLength(0)
  })

  it('recomputes stock when a meal is edited, moved to another bag, or deleted', async () => {
    const first = await saveFoodSupply(supply())
    const second = await saveFoodSupply(supply({ amount: 500 }))
    const entry = await saveFood(meal({ supplyId: first.id }))
    expect(remainingFood(first, await listFood(petId))).toBe(900)
    const edited = await saveFood({ ...entry, amount: 150 })
    expect(remainingFood(first, await listFood(petId))).toBe(850)
    await saveFood({ ...edited, supplyId: second.id })
    expect(remainingFood(first, await listFood(petId))).toBe(1000)
    expect(remainingFood(second, await listFood(petId))).toBe(350)
    await deleteFood(entry.id)
    expect(remainingFood(second, await listFood(petId))).toBe(500)
    expect((await listOutbox()).find((item) => item.entityId === entry.id)?.operation).toBe(
      'delete',
    )
    await expect(saveFood(entry)).rejects.toThrow('deleted')
  })

  it('keeps meal history when a supply is removed and prevents invalid links', async () => {
    const bag = await saveFoodSupply(supply())
    const entry = await saveFood(meal({ supplyId: bag.id }))
    await deleteFoodSupply(bag.id)
    expect(await listFoodSupplies(petId)).toHaveLength(0)
    expect(await listFood(petId)).toHaveLength(1)
    await expect(saveFood({ ...entry, notes: 'Still editable' })).resolves.toMatchObject({
      notes: 'Still editable',
    })
    await expect(saveFood(meal({ supplyId: bag.id }))).rejects.toThrow('removed')
    await expect(saveFoodSupply(bag)).rejects.toThrow('removed')
    const otherBag = await saveFoodSupply(supply({ petId: crypto.randomUUID() }))
    await expect(saveFood(meal({ supplyId: otherBag.id }))).rejects.toThrow('same portion unit')
    const activeBag = await saveFoodSupply(supply())
    await expect(saveFood(meal({ supplyId: activeBag.id, unit: 'cups' }))).rejects.toThrow(
      'same portion unit',
    )
    await expect(saveFoodSupply({ ...activeBag, unit: 'cups' })).rejects.toThrow('cannot change')
  })

  it('rejects invalid portions and future feedings without adding records or outbox changes', async () => {
    for (const amount of [0, -1, NaN, Infinity]) {
      expect(foodEntrySchema.safeParse(meal({ amount })).success).toBe(false)
    }
    await expect(saveFood(meal({ food: '   ' }))).rejects.toThrow('Enter the food name.')
    await expect(saveFood(meal({ fedAt: '2026-10-04T15:00:00.000Z' }))).rejects.toThrow('past')
    expect(await listFood(petId)).toHaveLength(0)
    expect(await listOutbox()).toHaveLength(0)
  })

  it('preserves pending edits and ignores stale acknowledgements during synchronization', async () => {
    const bag = await saveFoodSupply(supply())
    const entry = await saveFood(meal({ supplyId: bag.id }))
    const oldMutation = (await listOutbox()).find((item) => item.entity === 'food')!
    const edited = await saveFood({ ...entry, amount: 175 })
    await updateSyncResult(oldMutation, true)
    await applySyncSnapshot(
      snapshot({ food: [{ ...entry, amount: 90, updatedAt: '2026-10-03T16:00:00.000Z' }] }),
    )
    expect((await listFood(petId))[0].amount).toBe(175)
    const currentMutation = (await listOutbox()).find((item) => item.entity === 'food')!
    await updateSyncResult(currentMutation, true)
    await applySyncSnapshot(
      snapshot({ food: [{ ...edited, amount: 200, updatedAt: '2026-10-03T17:00:00.000Z' }] }),
    )
    expect((await listFood(petId))[0]).toMatchObject({ amount: 200, syncState: 'synced' })
  })

  it('restores food and stock on another device and syncs supplies before meals with equal queue times', async () => {
    const bag = supply()
    const entry = meal({ supplyId: bag.id })
    await applySyncSnapshot(snapshot({ food: [entry], foodSupplies: [bag] }))
    expect(remainingFood((await listFoodSupplies(petId))[0], await listFood(petId))).toBe(900)
    await saveFoodSupply(bag)
    await saveFood(entry)
    const posted: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
        if (init?.method === 'POST') {
          const item = JSON.parse(init.body as string)
          posted.push(item.entity)
          return Response.json({ ok: true })
        }
        return Response.json(snapshot())
      }),
    )
    await syncOutbox(true)
    expect(posted).toEqual(['foodSupply', 'food'])
    expect(await listOutbox()).toHaveLength(0)
  })

  it('upgrades v2 storage without losing existing pets or queued writes', async () => {
    clearLocalOwner()
    const owner = `food-upgrade-${crypto.randomUUID()}`
    const db = await openDB(`pawprint-life-book:${owner}`, 2, {
      upgrade(database) {
        database.createObjectStore('pets', { keyPath: 'id' })
        database.createObjectStore('outbox', { keyPath: 'id' })
      },
    })
    await db.put('pets', { id: petId, createdAt: now, name: 'Juniper' })
    await db.put('outbox', { id: `pet:${petId}`, createdAt: now })
    db.close()
    await configureLocalOwner(owner, false)
    expect((await getDb()).version).toBe(3)
    expect((await listPets())[0].name).toBe('Juniper')
    expect(await listOutbox()).toHaveLength(1)
    expect(await listFood(petId)).toHaveLength(0)
    expect(await listFoodSupplies(petId)).toHaveLength(0)
  })

  it('counts meals by local calendar day and keeps mixed units and unlinked meals out of stock totals', () => {
    const localNow = new Date(2026, 9, 3, 15)
    const bag = supply()
    const entries = [
      meal({ supplyId: bag.id, fedAt: new Date(2026, 9, 3, 0).toISOString() }),
      meal({ supplyId: bag.id, fedAt: new Date(2026, 9, 2, 23, 59).toISOString() }),
      meal({ fedAt: new Date(2026, 9, 3, 10).toISOString(), unit: 'cups' }),
      meal({ fedAt: new Date(2026, 9, 3, 16).toISOString() }),
      meal({ supplyId: bag.id, deletedAt: now }),
    ]
    expect(foodToday(entries, localNow)).toHaveLength(2)
    expect(remainingFood(bag, entries)).toBe(800)
  })
})
