import { eq, getTableColumns, lt } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { drizzle } from 'drizzle-orm/d1'
import {
  foodEntries,
  foodSupplies,
  careReminders,
  journalEntries,
  media,
  measurements,
  pets,
  processedMutations,
  outings,
} from '../db/schema'
import { foodEntrySchema, foodSupplySchema, outingSchema } from '../lib/schemas'
import type {
  CareReminder,
  JournalEntry,
  Measurement,
  OutboxItem,
  Pet,
  SyncSnapshot,
} from '../lib/types'

export class OwnershipError extends Error {
  constructor() {
    super('The requested record is not available.')
    this.name = 'OwnershipError'
  }
}

export class PawprintRepository {
  private db

  constructor(
    database: D1Database,
    private ownerId: string,
  ) {
    this.db = drizzle(database)
  }

  async applyMutation(item: OutboxItem) {
    const payloadUpdatedAt =
      typeof item.payload === 'object' &&
      item.payload !== null &&
      'updatedAt' in item.payload &&
      typeof item.payload.updatedAt === 'string'
        ? item.payload.updatedAt
        : item.createdAt
    const mutationId = `${this.ownerId}:${item.id}:${item.revision ?? payloadUpdatedAt}`
    const alreadyApplied = await this.db
      .select({ id: processedMutations.id })
      .from(processedMutations)
      .where(eq(processedMutations.id, mutationId))
      .get()
    if (alreadyApplied) return { duplicate: true }
    const { query: write } = await this.prepareWrite(item)
    const marker = this.db
      .insert(processedMutations)
      .values({
        id: mutationId,
        ownerId: this.ownerId,
        entityId: item.entityId,
        processedAt: new Date().toISOString(),
      })
      .onConflictDoNothing()
    const [writeResult] = await this.db.batch([write, marker] as const)

    return {
      duplicate: false,
      applied: (writeResult as D1Result).meta.changes > 0,
    }
  }

  async getSnapshot(): Promise<SyncSnapshot> {
    const [
      petRows,
      journalRows,
      measurementRows,
      reminderRows,
      outingRows,
      foodRows,
      supplyRows,
      mediaRows,
    ] = await this.db.batch([
      this.db.select().from(pets).where(eq(pets.ownerId, this.ownerId)),
      this.db
        .select(getTableColumns(journalEntries))
        .from(journalEntries)
        .innerJoin(pets, eq(journalEntries.petId, pets.id))
        .where(eq(pets.ownerId, this.ownerId)),
      this.db
        .select(getTableColumns(measurements))
        .from(measurements)
        .innerJoin(pets, eq(measurements.petId, pets.id))
        .where(eq(pets.ownerId, this.ownerId)),
      this.db
        .select(getTableColumns(careReminders))
        .from(careReminders)
        .innerJoin(pets, eq(careReminders.petId, pets.id))
        .where(eq(pets.ownerId, this.ownerId)),
      this.db
        .select(getTableColumns(outings))
        .from(outings)
        .innerJoin(pets, eq(outings.petId, pets.id))
        .where(eq(pets.ownerId, this.ownerId)),
      this.db
        .select(getTableColumns(foodEntries))
        .from(foodEntries)
        .innerJoin(pets, eq(foodEntries.petId, pets.id))
        .where(eq(pets.ownerId, this.ownerId)),
      this.db
        .select(getTableColumns(foodSupplies))
        .from(foodSupplies)
        .innerJoin(pets, eq(foodSupplies.petId, pets.id))
        .where(eq(pets.ownerId, this.ownerId)),
      this.db
        .select(getTableColumns(media))
        .from(media)
        .innerJoin(pets, eq(media.petId, pets.id))
        .where(eq(pets.ownerId, this.ownerId)),
    ] as const)

    const mediaRecords = mediaRows.map((record) => ({
      id: record.id,
      petId: record.petId,
      journalEntryId: record.journalEntryId ?? undefined,
      objectKey: record.objectKey,
      mimeType: record.mimeType,
      width: record.width ?? undefined,
      height: record.height ?? undefined,
      localUrl: `/api/media/${record.objectKey}`,
      createdAt: record.createdAt,
      syncState: 'synced' as const,
    }))
    const journalPhotos = new Map<string, (typeof mediaRecords)[number]>()
    const petAvatars = new Map<string, (typeof mediaRecords)[number]>()
    for (const record of mediaRecords) {
      if (record.journalEntryId) {
        const current = journalPhotos.get(record.journalEntryId)
        if (!current || current.createdAt < record.createdAt) {
          journalPhotos.set(record.journalEntryId, record)
        }
      } else {
        const current = petAvatars.get(record.petId)
        if (!current || current.createdAt < record.createdAt) {
          petAvatars.set(record.petId, record)
        }
      }
    }

    return {
      pets: petRows.map((record) => ({
        id: record.id,
        name: record.name,
        species: record.species as Pet['species'],
        breed: record.breed ?? undefined,
        birthDate: record.birthDate ?? undefined,
        approximateBirthDate: record.approximateBirthDate,
        currentWeight: record.currentWeight ?? undefined,
        weightUnit: record.weightUnit as Pet['weightUnit'],
        avatarObjectKey: record.avatarObjectKey ?? petAvatars.get(record.id)?.objectKey,
        avatarUrl: record.avatarObjectKey
          ? `/api/media/${record.avatarObjectKey}`
          : petAvatars.get(record.id)?.localUrl,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        syncState: 'synced',
      })),
      journal: journalRows.map((record) => ({
        id: record.id,
        petId: record.petId,
        type: record.type as JournalEntry['type'],
        occurredAt: record.occurredAt,
        title: record.title,
        body: record.body,
        mood: record.mood ?? undefined,
        photoUrl: journalPhotos.get(record.id)?.localUrl,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        deletedAt: record.deletedAt ?? undefined,
        syncState: 'synced',
      })),
      measurements: measurementRows.map((record) => ({
        id: record.id,
        petId: record.petId,
        type: record.type as Measurement['type'],
        numericValue: record.numericValue ?? undefined,
        unit: record.unit ?? undefined,
        measuredAt: record.measuredAt,
        note: record.note ?? undefined,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        deletedAt: record.deletedAt ?? undefined,
        syncState: 'synced',
      })),
      reminders: reminderRows.map((record) => ({
        id: record.id,
        petId: record.petId,
        title: record.title,
        notes: record.notes ?? undefined,
        dueAt: record.dueAt,
        recurrenceRule: record.recurrenceRule ?? undefined,
        completedAt: record.completedAt ?? undefined,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        deletedAt: record.deletedAt ?? undefined,
        syncState: 'synced',
      })),
      outings: outingRows.map((record) => ({
        ...record,
        kind: record.kind as 'walk' | 'potty',
        deletedAt: record.deletedAt ?? undefined,
        syncState: 'synced',
      })),
      food: foodRows.map((record) => ({
        ...foodEntrySchema.parse({
          ...record,
          supplyId: record.supplyId ?? undefined,
          deletedAt: record.deletedAt ?? undefined,
        }),
        syncState: 'synced',
      })),
      foodSupplies: supplyRows.map((record) => ({
        ...foodSupplySchema.parse({ ...record, deletedAt: record.deletedAt ?? undefined }),
        syncState: 'synced',
      })),
      media: mediaRecords,
    }
  }

  private async assertPetOwned(petId: string) {
    const pet = await this.db
      .select({ ownerId: pets.ownerId })
      .from(pets)
      .where(eq(pets.id, petId))
      .get()
    if (!pet || pet.ownerId !== this.ownerId) throw new OwnershipError()
  }

  private async assertJournalWritable(entryId: string, petId: string) {
    const existing = await this.db
      .select({ petId: journalEntries.petId })
      .from(journalEntries)
      .where(eq(journalEntries.id, entryId))
      .get()
    if (existing && existing.petId !== petId) throw new OwnershipError()
    await this.assertPetOwned(petId)
  }

  private async assertMeasurementWritable(measurementId: string, petId: string) {
    const existing = await this.db
      .select({ petId: measurements.petId })
      .from(measurements)
      .where(eq(measurements.id, measurementId))
      .get()
    if (existing && existing.petId !== petId) throw new OwnershipError()
    await this.assertPetOwned(petId)
  }

  private async assertReminderWritable(reminderId: string, petId: string) {
    const existing = await this.db
      .select({ petId: careReminders.petId })
      .from(careReminders)
      .where(eq(careReminders.id, reminderId))
      .get()
    if (existing && existing.petId !== petId) throw new OwnershipError()
    await this.assertPetOwned(petId)
  }

  private async prepareWrite(item: OutboxItem): Promise<{ query: BatchItem<'sqlite'> }> {
    if (item.entity === 'pet') {
      const p = item.payload as Pet
      const existing = await this.db
        .select({ ownerId: pets.ownerId })
        .from(pets)
        .where(eq(pets.id, p.id))
        .get()
      if (existing && existing.ownerId !== this.ownerId) throw new OwnershipError()

      return {
        query: this.db
          .insert(pets)
          .values({
            id: p.id,
            ownerId: this.ownerId,
            name: p.name,
            species: p.species,
            breed: p.breed,
            birthDate: p.birthDate,
            approximateBirthDate: p.approximateBirthDate,
            currentWeight: p.currentWeight,
            weightUnit: p.weightUnit,
            avatarObjectKey: p.avatarObjectKey,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          })
          .onConflictDoUpdate({
            target: pets.id,
            set: {
              name: p.name,
              species: p.species,
              breed: p.breed,
              birthDate: p.birthDate,
              approximateBirthDate: p.approximateBirthDate,
              currentWeight: p.currentWeight,
              weightUnit: p.weightUnit,
              avatarObjectKey: p.avatarObjectKey,
              updatedAt: p.updatedAt,
            },
            setWhere: lt(pets.updatedAt, p.updatedAt),
          }),
      }
    }

    if (item.entity === 'journal') {
      const e = item.payload as JournalEntry
      await this.assertJournalWritable(e.id, e.petId)

      return {
        query: this.db
          .insert(journalEntries)
          .values({
            id: e.id,
            petId: e.petId,
            type: e.type,
            occurredAt: e.occurredAt,
            title: e.title,
            body: e.body,
            mood: e.mood,
            createdAt: e.createdAt,
            updatedAt: e.updatedAt,
            deletedAt: e.deletedAt,
          })
          .onConflictDoUpdate({
            target: journalEntries.id,
            set: {
              type: e.type,
              occurredAt: e.occurredAt,
              title: e.title,
              body: e.body,
              mood: e.mood,
              updatedAt: e.updatedAt,
              deletedAt: e.deletedAt,
            },
            setWhere: lt(journalEntries.updatedAt, e.updatedAt),
          }),
      }
    }

    if (item.entity === 'measurement') {
      const m = item.payload as Measurement
      await this.assertMeasurementWritable(m.id, m.petId)

      return {
        query: this.db
          .insert(measurements)
          .values({
            id: m.id,
            petId: m.petId,
            type: m.type,
            numericValue: m.numericValue,
            unit: m.unit,
            measuredAt: m.measuredAt,
            note: m.note,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt,
            deletedAt: m.deletedAt,
          })
          .onConflictDoUpdate({
            target: measurements.id,
            set: {
              type: m.type,
              numericValue: m.numericValue,
              unit: m.unit,
              measuredAt: m.measuredAt,
              note: m.note,
              updatedAt: m.updatedAt,
              deletedAt: m.deletedAt,
            },
            setWhere: lt(measurements.updatedAt, m.updatedAt),
          }),
      }
    }

    if (item.entity === 'outing') {
      const outing = outingSchema.parse(item.payload)
      const existing = await this.db
        .select({ petId: outings.petId, kind: outings.kind })
        .from(outings)
        .where(eq(outings.id, outing.id))
        .get()
      if (existing && (existing.petId !== outing.petId || existing.kind !== outing.kind)) {
        throw new OwnershipError()
      }
      await this.assertPetOwned(outing.petId)

      return {
        query: this.db
          .insert(outings)
          .values(outing)
          .onConflictDoUpdate({
            target: outings.id,
            set: {
              startedAt: outing.startedAt,
              endedAt: outing.endedAt,
              peeCount: outing.peeCount,
              poopCount: outing.poopCount,
              notes: outing.notes,
              updatedAt: outing.updatedAt,
              deletedAt: outing.deletedAt ?? null,
            },
            setWhere: lt(outings.updatedAt, outing.updatedAt),
          }),
      }
    }

    if (item.entity === 'foodSupply') {
      const supply = foodSupplySchema.parse(item.payload)
      const existing = await this.db
        .select({ petId: foodSupplies.petId, unit: foodSupplies.unit })
        .from(foodSupplies)
        .where(eq(foodSupplies.id, supply.id))
        .get()
      if (existing && (existing.petId !== supply.petId || existing.unit !== supply.unit)) {
        throw new OwnershipError()
      }
      await this.assertPetOwned(supply.petId)
      return {
        query: this.db
          .insert(foodSupplies)
          .values(supply)
          .onConflictDoUpdate({
            target: foodSupplies.id,
            set: {
              food: supply.food,
              amount: supply.amount,
              purchasedAt: supply.purchasedAt,
              notes: supply.notes,
              updatedAt: supply.updatedAt,
              deletedAt: supply.deletedAt ?? null,
            },
            setWhere: lt(foodSupplies.updatedAt, supply.updatedAt),
          }),
      }
    }

    if (item.entity === 'food') {
      const entry = foodEntrySchema.parse(item.payload)
      const existing = await this.db
        .select({ petId: foodEntries.petId })
        .from(foodEntries)
        .where(eq(foodEntries.id, entry.id))
        .get()
      if (existing && existing.petId !== entry.petId) throw new OwnershipError()
      await this.assertPetOwned(entry.petId)
      if (entry.supplyId) {
        const supply = await this.db
          .select()
          .from(foodSupplies)
          .where(eq(foodSupplies.id, entry.supplyId))
          .get()
        if (!supply || supply.petId !== entry.petId || supply.unit !== entry.unit) {
          throw new OwnershipError()
        }
      }

      return {
        query: this.db
          .insert(foodEntries)
          .values(entry)
          .onConflictDoUpdate({
            target: foodEntries.id,
            set: {
              food: entry.food,
              amount: entry.amount,
              unit: entry.unit,
              supplyId: entry.supplyId ?? null,
              fedAt: entry.fedAt,
              notes: entry.notes,
              updatedAt: entry.updatedAt,
              deletedAt: entry.deletedAt ?? null,
            },
            setWhere: lt(foodEntries.updatedAt, entry.updatedAt),
          }),
      }
    }

    if (item.entity === 'reminder') {
      const r = item.payload as CareReminder
      await this.assertReminderWritable(r.id, r.petId)

      return {
        query: this.db
          .insert(careReminders)
          .values({
            id: r.id,
            petId: r.petId,
            title: r.title,
            notes: r.notes,
            dueAt: r.dueAt,
            recurrenceRule: r.recurrenceRule,
            completedAt: r.completedAt,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            deletedAt: r.deletedAt,
          })
          .onConflictDoUpdate({
            target: careReminders.id,
            set: {
              title: r.title,
              notes: r.notes,
              dueAt: r.dueAt,
              recurrenceRule: r.recurrenceRule,
              completedAt: r.completedAt,
              updatedAt: r.updatedAt,
              deletedAt: r.deletedAt,
            },
            setWhere: lt(careReminders.updatedAt, r.updatedAt),
          }),
      }
    }

    throw new Error(`Unsupported synchronized entity: ${item.entity}`)
  }
}
