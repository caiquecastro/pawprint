export type SyncState = 'synced' | 'pending' | 'failed'

export type Pet = {
  id: string
  name: string
  species: 'dog' | 'cat' | 'other'
  breed?: string
  birthDate?: string
  approximateBirthDate: boolean
  currentWeight?: number
  weightUnit: 'kg' | 'lb'
  avatarUrl?: string
  avatarObjectKey?: string
  createdAt: string
  updatedAt: string
  syncState?: SyncState
}

export type JournalEntryType = 'memory' | 'health' | 'milestone' | 'routine' | 'mood'

export type JournalEntry = {
  id: string
  petId: string
  type: JournalEntryType
  occurredAt: string
  title: string
  body: string
  mood?: string
  photoUrl?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  syncState?: SyncState
  syncError?: string
}

export type Measurement = {
  id: string
  petId: string
  type: 'weight' | 'health_note' | 'vet_visit'
  numericValue?: number
  unit?: string
  measuredAt: string
  note?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  syncState?: SyncState
}

export type CareReminder = {
  id: string
  petId: string
  title: string
  notes?: string
  dueAt: string
  recurrenceRule?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  syncState?: SyncState
}

export type MediaRecord = {
  id: string
  petId: string
  journalEntryId?: string
  objectKey?: string
  mimeType: string
  width?: number
  height?: number
  blob?: Blob
  localUrl?: string
  createdAt: string
  syncState: SyncState
  progress?: number
  error?: string
}

export type Outing = {
  id: string
  petId: string
  kind: 'walk' | 'potty'
  startedAt: string
  endedAt: string | null
  peeCount: number | null
  poopCount: number | null
  notes: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  syncState?: SyncState
}

export type EntityKind = 'pet' | 'journal' | 'measurement' | 'reminder' | 'outing' | 'media'
export type MutationKind = 'create' | 'update' | 'delete'

export type OutboxItem = {
  id: string
  revision?: string
  entity: EntityKind
  entityId: string
  operation: MutationKind
  payload: unknown
  createdAt: string
  attemptCount: number
  status: 'pending' | 'syncing' | 'failed'
  error?: string
}
