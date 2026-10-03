import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  getPlatformProxy,
  type PlatformProxy,
  unstable_splitSqlQuery as splitSqlQuery,
} from 'wrangler'
import type { OutboxItem, Pet } from '../lib/types'
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
