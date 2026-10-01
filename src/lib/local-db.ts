import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb'
import type {
  CareReminder,
  JournalEntry,
  Measurement,
  MediaRecord,
  OutboxItem,
  Outing,
  Pet,
} from './types'
import { outingSchema } from './schemas'

interface PawprintDB extends DBSchema {
  pets: { key: string; value: Pet }
  journal: { key: string; value: JournalEntry; indexes: { 'by-pet': string } }
  measurements: { key: string; value: Measurement; indexes: { 'by-pet': string } }
  reminders: { key: string; value: CareReminder; indexes: { 'by-pet': string } }
  media: { key: string; value: MediaRecord; indexes: { 'by-pet': string; 'by-entry': string } }
  outings: { key: string; value: Outing; indexes: { 'by-pet': string } }
  outbox: { key: string; value: OutboxItem; indexes: { 'by-status': string } }
}

const LEGACY_DB_NAME = 'pawprint-life-book'
const MIGRATION_KEY = 'pawprint:legacy-data-claimed'
let activeOwnerId: string | undefined
let activeDb: IDBPDatabase<PawprintDB> | undefined
let activeDbPromise: Promise<IDBPDatabase<PawprintDB>> | undefined

const openPawprintDb = (name: string) =>
  openDB<PawprintDB>(name, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('pets', { keyPath: 'id' })
        const journal = db.createObjectStore('journal', { keyPath: 'id' })
        journal.createIndex('by-pet', 'petId')
        const measurements = db.createObjectStore('measurements', { keyPath: 'id' })
        measurements.createIndex('by-pet', 'petId')
        const reminders = db.createObjectStore('reminders', { keyPath: 'id' })
        reminders.createIndex('by-pet', 'petId')
        const media = db.createObjectStore('media', { keyPath: 'id' })
        media.createIndex('by-pet', 'petId')
        media.createIndex('by-entry', 'journalEntryId')
        const outbox = db.createObjectStore('outbox', { keyPath: 'id' })
        outbox.createIndex('by-status', 'status')
      }
      if (oldVersion < 2) {
        const outings = db.createObjectStore('outings', { keyPath: 'id' })
        outings.createIndex('by-pet', 'petId')
      }
    },
  })

export async function configureLocalOwner(ownerId: string, migrateLegacy = true) {
  if (activeOwnerId === ownerId && activeDbPromise) return activeDbPromise
  activeDb?.close()
  activeOwnerId = ownerId
  activeDbPromise = openPawprintDb(`${LEGACY_DB_NAME}:${encodeURIComponent(ownerId)}`)
  activeDb = await activeDbPromise
  if (migrateLegacy) await claimLegacyData(activeDb)
  return activeDb
}

export function clearLocalOwner() {
  activeDb?.close()
  activeDb = undefined
  activeDbPromise = undefined
  activeOwnerId = undefined
}

export function getDb() {
  if (!activeDbPromise) throw new Error('Local account storage has not been initialized.')
  return activeDbPromise
}

async function claimLegacyData(target: IDBPDatabase<PawprintDB>) {
  if (typeof localStorage === 'undefined' || localStorage.getItem(MIGRATION_KEY)) return
  if ((await target.count('pets')) > 0) {
    localStorage.setItem(MIGRATION_KEY, activeOwnerId ?? 'claimed')
    return
  }

  const legacy = await openPawprintDb(LEGACY_DB_NAME)
  const [petsData, journalData, measurementsData, remindersData, mediaData, outboxData] =
    await Promise.all([
      legacy.getAll('pets'),
      legacy.getAll('journal'),
      legacy.getAll('measurements'),
      legacy.getAll('reminders'),
      legacy.getAll('media'),
      legacy.getAll('outbox'),
    ])
  const tx = target.transaction(
    ['pets', 'journal', 'measurements', 'reminders', 'media', 'outbox', 'outings'],
    'readwrite',
  )
  await Promise.all([
    ...petsData.map((record) => tx.objectStore('pets').put(record)),
    ...journalData.map((record) => tx.objectStore('journal').put(record)),
    ...measurementsData.map((record) => tx.objectStore('measurements').put(record)),
    ...remindersData.map((record) => tx.objectStore('reminders').put(record)),
    ...mediaData.map((record) => tx.objectStore('media').put(record)),
    ...outboxData.map((record) => tx.objectStore('outbox').put(record)),
  ])
  await tx.done
  legacy.close()
  localStorage.setItem(MIGRATION_KEY, activeOwnerId ?? 'claimed')
}

function notifyChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pawprint:data-changed'))
}

const entityStores = {
  pet: 'pets',
  journal: 'journal',
  measurement: 'measurements',
  reminder: 'reminders',
  outing: 'outings',
} as const

type SyncedEntity = keyof typeof entityStores
type RecordStore = (typeof entityStores)[SyncedEntity]
type RecordTransaction = IDBPTransaction<PawprintDB, (RecordStore | 'outbox')[], 'readwrite'>

async function queueMutation(
  tx: RecordTransaction,
  entity: OutboxItem['entity'],
  entityId: string,
  operation: OutboxItem['operation'],
  payload: unknown,
) {
  const outbox = tx.objectStore('outbox')
  const id = `${entity}:${entityId}`
  const current = await outbox.get(id)
  const item: OutboxItem = {
    id,
    revision: crypto.randomUUID(),
    entity,
    entityId,
    operation: current?.operation === 'create' && operation === 'update' ? 'create' : operation,
    payload,
    createdAt: current?.createdAt ?? new Date().toISOString(),
    attemptCount: current?.attemptCount ?? 0,
    status: 'pending',
  }
  await outbox.put(item)
}

async function persistRecord<T extends Pet | JournalEntry | Measurement | CareReminder | Outing>(
  entity: SyncedEntity,
  value: T,
  operation: OutboxItem['operation'],
) {
  const record = { ...value, syncState: 'pending' as const, syncError: undefined }
  const db = await getDb()
  const store = entityStores[entity]
  const tx = db.transaction([store, 'outbox'], 'readwrite')
  await tx.objectStore(store).put(record)
  await queueMutation(tx, entity, record.id, operation, record)
  await tx.done
  notifyChanged()
  return record
}

export async function listPets() {
  return (await (await getDb()).getAll('pets')).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )
}

export async function getPet(id: string) {
  return (await getDb()).get('pets', id)
}

export async function savePet(pet: Pet, operation: 'create' | 'update' = 'create') {
  return persistRecord('pet', pet, operation)
}

export async function listJournal(petId: string) {
  return (await (await getDb()).getAllFromIndex('journal', 'by-pet', petId))
    .filter((item) => !item.deletedAt)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

export async function getJournalEntry(id: string) {
  return (await getDb()).get('journal', id)
}

export async function saveJournalEntry(
  entry: JournalEntry,
  operation: 'create' | 'update' = 'create',
) {
  return persistRecord('journal', entry, operation)
}

export async function deleteJournalEntry(id: string) {
  const db = await getDb()
  const existing = await db.get('journal', id)
  if (!existing) return
  const record: JournalEntry = {
    ...existing,
    deletedAt: new Date().toISOString(),
    syncState: 'pending',
  }
  await persistRecord('journal', record, 'delete')
}

export async function listMeasurements(petId: string) {
  return (await (await getDb()).getAllFromIndex('measurements', 'by-pet', petId))
    .filter((item) => !item.deletedAt)
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
}

export async function saveMeasurement(measurement: Measurement) {
  return persistRecord('measurement', measurement, 'create')
}

export async function listReminders(petId: string) {
  return (await (await getDb()).getAllFromIndex('reminders', 'by-pet', petId))
    .filter((item) => !item.deletedAt)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
}

export async function saveReminder(
  reminder: CareReminder,
  operation: 'create' | 'update' = 'create',
) {
  return persistRecord('reminder', reminder, operation)
}

export async function completeReminder(id: string) {
  const db = await getDb()
  const existing = await db.get('reminders', id)
  if (!existing) return
  return saveReminder(
    {
      ...existing,
      completedAt: existing.completedAt ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    'update',
  )
}

export async function saveMedia(record: MediaRecord) {
  await (await getDb()).put('media', record)
  notifyChanged()
  return record
}

export async function listUnsyncedMedia() {
  return (await (await getDb()).getAll('media')).filter((item) => item.syncState !== 'synced')
}

export async function updateMediaUpload(id: string, patch: Partial<MediaRecord>) {
  const db = await getDb()
  const record = await db.get('media', id)
  if (!record) return
  await db.put('media', { ...record, ...patch })
  notifyChanged()
}

export async function getMediaForEntry(entryId: string) {
  return (await (await getDb()).getAllFromIndex('media', 'by-entry', entryId))[0]
}

export async function listOutbox() {
  return (await (await getDb()).getAll('outbox')).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )
}

export async function resetDatabaseForTests() {
  if (!activeDbPromise) await configureLocalOwner('test-user', false)
  const db = await getDb()
  const tx = db.transaction(
    ['pets', 'journal', 'measurements', 'reminders', 'media', 'outbox', 'outings'],
    'readwrite',
  )
  await Promise.all([
    tx.objectStore('pets').clear(),
    tx.objectStore('journal').clear(),
    tx.objectStore('measurements').clear(),
    tx.objectStore('reminders').clear(),
    tx.objectStore('media').clear(),
    tx.objectStore('outbox').clear(),
    tx.objectStore('outings').clear(),
  ])
  await tx.done
}

export async function updateSyncResult(item: OutboxItem, success: boolean, error?: string) {
  if (item.entity === 'media') return
  const db = await getDb()
  const store = entityStores[item.entity]
  const tx = db.transaction([store, 'outbox'], 'readwrite')
  const current = await tx.objectStore('outbox').get(item.id)

  // An acknowledgement only applies to the snapshot that was sent.
  if (!current || current.revision !== item.revision) {
    await tx.done
    notifyChanged()
    return
  }

  if (success) {
    await tx.objectStore('outbox').delete(item.id)
  } else {
    await tx.objectStore('outbox').put({
      ...current,
      status: 'failed',
      attemptCount: current.attemptCount + 1,
      error,
    })
  }

  const record = await tx.objectStore(store).get(item.entityId)
  if (record) {
    const updated = {
      ...record,
      syncState: success ? ('synced' as const) : ('failed' as const),
      syncError: success ? undefined : error,
    }
    await tx.objectStore(store).put(updated)
  }
  await tx.done
  notifyChanged()
}

export async function listOutings(petId: string) {
  return (await (await getDb()).getAllFromIndex('outings', 'by-pet', petId))
    .filter((item) => !item.deletedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

async function mutateOuting(id: string, change: (existing?: Outing) => Outing) {
  const db = await getDb()
  const tx = db.transaction(['outings', 'outbox'], 'readwrite')
  // Observe transaction failures even when validation stops before tx.done.
  void tx.done.catch(() => undefined)
  try {
    const store = tx.objectStore('outings')
    const existing = await store.get(id)
    if (existing?.deletedAt)
      throw new Error('This record was deleted. Reopen the history to continue.')
    const parsed = outingSchema.parse(change(existing))
    if (existing && (existing.petId !== parsed.petId || existing.kind !== parsed.kind)) {
      throw new Error('A record cannot be moved to another pet or kind.')
    }
    if (parsed.kind === 'walk' && !parsed.endedAt && !parsed.deletedAt) {
      const outings = await store.index('by-pet').getAll(parsed.petId)
      if (
        outings.some(
          (item) => item.id !== id && item.kind === 'walk' && !item.endedAt && !item.deletedAt,
        )
      ) {
        throw new Error('There is already a walk in progress. Finish it before starting another.')
      }
    }
    const record = {
      ...parsed,
      updatedAt: new Date(
        Math.max(Date.now(), Date.parse(existing?.updatedAt ?? parsed.updatedAt) + 1),
      ).toISOString(),
      syncState: 'pending' as const,
    }
    await store.put(record)
    await queueMutation(
      tx,
      'outing',
      id,
      record.deletedAt ? 'delete' : existing ? 'update' : 'create',
      record,
    )
    await tx.done
    notifyChanged()
    return record
  } catch (error) {
    try {
      tx.abort()
    } catch {
      // The transaction may already have completed or aborted.
    }
    throw error
  }
}

export function saveOuting(outing: Outing) {
  return mutateOuting(outing.id, () => outing)
}

export function startWalk(petId: string) {
  const now = new Date().toISOString()
  return saveOuting({
    id: crypto.randomUUID(),
    petId,
    kind: 'walk',
    startedAt: now,
    endedAt: null,
    peeCount: null,
    poopCount: null,
    notes: '',
    createdAt: now,
    updatedAt: now,
  })
}

export function adjustPottyCount(
  id: string,
  field: 'peeCount' | 'poopCount',
  value: number | null,
) {
  return mutateOuting(id, (existing) => {
    if (!existing || existing.endedAt) throw new Error('This walk is no longer in progress.')
    return { ...existing, [field]: value, updatedAt: new Date().toISOString() }
  })
}

export function finishWalk(id: string) {
  return mutateOuting(id, (existing) => {
    if (!existing) throw new Error('This walk is no longer available.')
    if (existing.endedAt) return existing
    const now = new Date().toISOString()
    return { ...existing, endedAt: now, updatedAt: now }
  })
}

export function deleteOuting(id: string) {
  return mutateOuting(id, (existing) => {
    if (!existing) throw new Error('This record is no longer available.')
    const now = new Date().toISOString()
    return { ...existing, deletedAt: now, updatedAt: now }
  })
}
