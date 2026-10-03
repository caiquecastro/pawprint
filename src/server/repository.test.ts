import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  getPlatformProxy,
  type PlatformProxy,
  unstable_splitSqlQuery as splitSqlQuery,
} from 'wrangler'
import type { FoodEntry, FoodSupply, OutboxItem, Pet } from '../lib/types'
import { PawprintRepository } from './repository'

const ownerId = 'repository-test-user'
const now = '2026-10-01T12:00:00.000Z'
let platform: PlatformProxy<{ DB: D1Database }>
let repository: PawprintRepository

const pet = (id: string, patch: Partial<Pet> = {}): Pet => ({
  id,
  name: 'Juniper',
  species: 'dog',
  approximateBirthDate: false,
  weightUnit: 'kg',
  createdAt: now,
  updatedAt: now,
  ...patch,
})

const mutation = (record: Pet, revision = crypto.randomUUID()): OutboxItem => ({
  id: `pet:${record.id}`,
  revision,
  entity: 'pet',
  entityId: record.id,
  operation: 'update',
  payload: record,
  createdAt: now,
  attemptCount: 0,
  status: 'pending',
})

beforeAll(async () => {
  platform = await getPlatformProxy<{ DB: D1Database }>({
    configPath: 'wrangler.jsonc',
    persist: false,
    remoteBindings: false,
  })
  for (const migration of [
    'migrations/0000_pawprint.sql',
    'migrations/0001_auth_ownership.sql',
    'migrations/0002_outings.sql',
    'migrations/0003_food.sql',
  ]) {
    const statements = splitSqlQuery(await readFile(migration, 'utf8')).map((statement) =>
      platform.env.DB.prepare(statement),
    )
    await platform.env.DB.batch(statements)
  }
  repository = new PawprintRepository(platform.env.DB, ownerId)
})

afterAll(async () => {
  await platform?.dispose()
})

describe('D1 synchronization repository', () => {
  it('keeps the newest version when stale mutations arrive later', async () => {
    const id = '64c09d97-9dfb-47f2-af9d-9abf978c59a2'
    await repository.applyMutation(mutation(pet(id)))
    await repository.applyMutation(
      mutation(
        pet(id, {
          name: 'Newest name',
          updatedAt: '2026-10-01T14:00:00.000Z',
        }),
      ),
    )
    const staleResult = await repository.applyMutation(
      mutation(
        pet(id, {
          name: 'Stale name',
          updatedAt: '2026-10-01T13:00:00.000Z',
        }),
      ),
    )

    expect(staleResult.applied).toBe(false)
    expect((await repository.getSnapshot()).pets.find((record) => record.id === id)?.name).toBe(
      'Newest name',
    )
  })

  it('rolls back the processed marker when the entity write fails', async () => {
    const id = '7fc4a274-f30b-4e27-a54c-cc5ed4a46a25'
    const revision = 'ace5b9cc-7263-445e-9e38-ce4993f74f03'
    const invalid = mutation(pet(id), revision)
    invalid.payload = { ...pet(id), name: undefined }

    await expect(repository.applyMutation(invalid)).rejects.toThrow(/NOT NULL constraint failed/)
    const markerCount = await platform.env.DB.prepare(
      'SELECT COUNT(*) AS count FROM processed_mutations WHERE entity_id = ?',
    )
      .bind(id)
      .first<number>('count')
    expect(markerCount).toBe(0)

    await expect(repository.applyMutation(mutation(pet(id), revision))).resolves.toMatchObject({
      applied: true,
      duplicate: false,
    })
  })

  it('returns only records owned by the authenticated account', async () => {
    const otherOwner = new PawprintRepository(platform.env.DB, 'another-owner')
    const otherPet = pet('a723652a-2fa1-4bed-a175-32003cd8ace6', { name: 'Private pet' })
    await otherOwner.applyMutation(mutation(otherPet))

    expect((await repository.getSnapshot()).pets).not.toContainEqual(
      expect.objectContaining({ id: otherPet.id }),
    )
    expect((await otherOwner.getSnapshot()).pets).toContainEqual(
      expect.objectContaining({ id: otherPet.id }),
    )
  })
})

describe('D1 food and supply synchronization', () => {
  const foodMutation = (
    record: FoodEntry | FoodSupply,
    entity: 'food' | 'foodSupply',
  ): OutboxItem => ({
    id: `${entity}:${record.id}`,
    revision: crypto.randomUUID(),
    entity,
    entityId: record.id,
    operation: record.deletedAt ? 'delete' : 'create',
    payload: record,
    createdAt: now,
    attemptCount: 0,
    status: 'pending',
  })

  it('round-trips stock and meals, deduplicates retries, rejects stale edits, and persists deletions', async () => {
    const petId = crypto.randomUUID()
    await repository.applyMutation(mutation(pet(petId)))
    const bag: FoodSupply = {
      id: crypto.randomUUID(),
      petId,
      food: 'Kibble',
      amount: 1000,
      unit: 'g',
      purchasedAt: now,
      notes: '',
      createdAt: now,
      updatedAt: now,
    }
    await repository.applyMutation(foodMutation(bag, 'foodSupply'))
    const entry: FoodEntry = {
      id: crypto.randomUUID(),
      petId,
      supplyId: bag.id,
      food: 'Kibble',
      amount: 100,
      unit: 'g',
      fedAt: now,
      notes: '',
      createdAt: now,
      updatedAt: now,
    }
    const queued = foodMutation(entry, 'food')
    await repository.applyMutation(queued)
    expect(await repository.applyMutation(queued)).toMatchObject({ duplicate: true })
    await repository.applyMutation(
      foodMutation({ ...entry, amount: 150, updatedAt: '2026-10-01T14:00:00.000Z' }, 'food'),
    )
    await repository.applyMutation(
      foodMutation({ ...entry, amount: 75, updatedAt: '2026-10-01T13:00:00.000Z' }, 'food'),
    )
    const snapshot = await repository.getSnapshot()
    expect(snapshot.food.find((item) => item.id === entry.id)).toMatchObject({
      amount: 150,
      supplyId: bag.id,
    })
    expect(snapshot.foodSupplies.find((item) => item.id === bag.id)).toMatchObject({
      amount: 1000,
      unit: 'g',
    })
    await repository.applyMutation(
      foodMutation(
        { ...entry, deletedAt: '2026-10-01T15:00:00.000Z', updatedAt: '2026-10-01T15:00:00.000Z' },
        'food',
      ),
    )
    expect(
      (await repository.getSnapshot()).food.find((item) => item.id === entry.id)?.deletedAt,
    ).toBe('2026-10-01T15:00:00.000Z')
  })

  it('enforces ownership on food, supplies, and links and validates portions', async () => {
    const other = new PawprintRepository(platform.env.DB, 'food-other-owner')
    const otherPetId = crypto.randomUUID()
    const ownPetId = crypto.randomUUID()
    await other.applyMutation(mutation(pet(otherPetId)))
    await repository.applyMutation(mutation(pet(ownPetId)))
    const bag: FoodSupply = {
      id: crypto.randomUUID(),
      petId: otherPetId,
      food: 'Private food',
      amount: 500,
      unit: 'g',
      purchasedAt: now,
      notes: '',
      createdAt: now,
      updatedAt: now,
    }
    await other.applyMutation(foodMutation(bag, 'foodSupply'))
    const entry: FoodEntry = {
      id: crypto.randomUUID(),
      petId: otherPetId,
      food: 'Private food',
      amount: 50,
      unit: 'g',
      supplyId: bag.id,
      fedAt: now,
      notes: '',
      createdAt: now,
      updatedAt: now,
    }
    await other.applyMutation(foodMutation(entry, 'food'))
    await expect(repository.applyMutation(foodMutation(entry, 'food'))).rejects.toThrow(
      'not available',
    )
    await expect(
      repository.applyMutation(foodMutation({ ...entry, petId: ownPetId }, 'food')),
    ).rejects.toThrow('not available')
    await expect(
      repository.applyMutation(
        foodMutation({ ...entry, id: crypto.randomUUID(), petId: ownPetId }, 'food'),
      ),
    ).rejects.toThrow('not available')
    await expect(
      repository.applyMutation(foodMutation({ ...bag, petId: ownPetId }, 'foodSupply')),
    ).rejects.toThrow('not available')
    await expect(
      repository.applyMutation(
        foodMutation(
          { ...entry, id: crypto.randomUUID(), petId: ownPetId, supplyId: undefined, amount: 0 },
          'food',
        ),
      ),
    ).rejects.toThrow('Enter a portion greater than zero.')
    const snapshot = await repository.getSnapshot()
    expect(snapshot.food.some((item) => item.id === entry.id)).toBe(false)
    expect(snapshot.foodSupplies.some((item) => item.id === bag.id)).toBe(false)
  })
})
