import { openDB, type DBSchema } from 'idb'
import type { CareReminder, JournalEntry, Measurement, MediaRecord, OutboxItem, Pet } from './types'

interface PawprintDB extends DBSchema {
  pets: { key: string; value: Pet }
  journal: { key: string; value: JournalEntry; indexes: { 'by-pet': string } }
  measurements: { key: string; value: Measurement; indexes: { 'by-pet': string } }
  reminders: { key: string; value: CareReminder; indexes: { 'by-pet': string } }
  media: { key: string; value: MediaRecord; indexes: { 'by-pet': string; 'by-entry': string } }
  outbox: { key: string; value: OutboxItem; indexes: { 'by-status': string } }
}

const DB_NAME = 'pawprint-life-book'

export const getDb = () =>
  openDB<PawprintDB>(DB_NAME, 1, {
    upgrade(db) {
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
    },
  })

function notifyChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pawprint:data-changed'))
}

async function queueMutation(
  entity: OutboxItem['entity'],
  entityId: string,
  operation: OutboxItem['operation'],
  payload: unknown,
) {
  const db = await getDb()
  const id = `${entity}:${entityId}`
  const current = await db.get('outbox', id)
  const item: OutboxItem = {
    id,
    entity,
    entityId,
    operation: current?.operation === 'create' && operation === 'update' ? 'create' : operation,
    payload,
    createdAt: current?.createdAt ?? new Date().toISOString(),
    attemptCount: current?.attemptCount ?? 0,
    status: 'pending',
  }
  await db.put('outbox', item)
}

export async function listPets() {
  return (await (await getDb()).getAll('pets')).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function getPet(id: string) {
  return (await getDb()).get('pets', id)
}

export async function savePet(pet: Pet, operation: 'create' | 'update' = 'create') {
  const record = { ...pet, syncState: 'pending' as const }
  const db = await getDb()
  await db.put('pets', record)
  await queueMutation('pet', pet.id, operation, record)
  notifyChanged()
  return record
}

export async function listJournal(petId: string) {
  return (await (await getDb()).getAllFromIndex('journal', 'by-pet', petId))
    .filter((item) => !item.deletedAt)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

export async function getJournalEntry(id: string) {
  return (await getDb()).get('journal', id)
}

export async function saveJournalEntry(entry: JournalEntry, operation: 'create' | 'update' = 'create') {
  const record = { ...entry, syncState: 'pending' as const, syncError: undefined }
  const db = await getDb()
  await db.put('journal', record)
  await queueMutation('journal', entry.id, operation, record)
  notifyChanged()
  return record
}

export async function deleteJournalEntry(id: string) {
  const db = await getDb()
  const existing = await db.get('journal', id)
  if (!existing) return
  const record: JournalEntry = { ...existing, deletedAt: new Date().toISOString(), syncState: 'pending' }
  await db.put('journal', record)
  await queueMutation('journal', id, 'delete', record)
  notifyChanged()
}

export async function listMeasurements(petId: string) {
  return (await (await getDb()).getAllFromIndex('measurements', 'by-pet', petId))
    .filter((item) => !item.deletedAt)
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
}

export async function saveMeasurement(measurement: Measurement) {
  const record = { ...measurement, syncState: 'pending' as const }
  const db = await getDb()
  await db.put('measurements', record)
  await queueMutation('measurement', measurement.id, 'create', record)
  notifyChanged()
  return record
}

export async function listReminders(petId: string) {
  return (await (await getDb()).getAllFromIndex('reminders', 'by-pet', petId))
    .filter((item) => !item.deletedAt)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
}

export async function saveReminder(reminder: CareReminder, operation: 'create' | 'update' = 'create') {
  const record = { ...reminder, syncState: 'pending' as const }
  const db = await getDb()
  await db.put('reminders', record)
  await queueMutation('reminder', reminder.id, operation, record)
  notifyChanged()
  return record
}

export async function completeReminder(id: string) {
  const db = await getDb()
  const existing = await db.get('reminders', id)
  if (!existing) return
  return saveReminder(
    { ...existing, completedAt: existing.completedAt ? undefined : new Date().toISOString(), updatedAt: new Date().toISOString() },
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
  return (await (await getDb()).getAll('outbox')).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function resetDatabaseForTests() {
  const db = await getDb()
  const tx = db.transaction(['pets', 'journal', 'measurements', 'reminders', 'media', 'outbox'], 'readwrite')
  await Promise.all([
    tx.objectStore('pets').clear(),
    tx.objectStore('journal').clear(),
    tx.objectStore('measurements').clear(),
    tx.objectStore('reminders').clear(),
    tx.objectStore('media').clear(),
    tx.objectStore('outbox').clear(),
  ])
  await tx.done
}

export async function updateSyncResult(item: OutboxItem, success: boolean, error?: string) {
  const db = await getDb()
  const stores = {
    pet: 'pets',
    journal: 'journal',
    measurement: 'measurements',
    reminder: 'reminders',
  } as const
  if (item.entity === 'media') return
  if (success) {
    await db.delete('outbox', item.id)
    const store = stores[item.entity]
    const record = await db.get(store, item.entityId) as Record<string, unknown> | undefined
    if (record) await db.put(store, { ...record, syncState: 'synced', syncError: undefined } as never)
  } else {
    await db.put('outbox', { ...item, status: 'failed', attemptCount: item.attemptCount + 1, error })
    const store = stores[item.entity]
    const record = await db.get(store, item.entityId) as Record<string, unknown> | undefined
    if (record) await db.put(store, { ...record, syncState: 'failed', syncError: error } as never)
  }
  notifyChanged()
}
