import { eq, lte } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import {
  careReminders,
  journalEntries,
  measurements,
  pets,
  processedMutations,
  outings,
} from '../db/schema'
import { outingSchema } from '../lib/schemas'
import type { CareReminder, JournalEntry, Measurement, OutboxItem, Pet } from '../lib/types'

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
    const mutationId = `${this.ownerId}:${item.id}${item.revision ? `:${item.revision}` : ''}`
    const alreadyApplied = await this.db
      .select({ id: processedMutations.id })
      .from(processedMutations)
      .where(eq(processedMutations.id, mutationId))
      .get()
    if (alreadyApplied) return { duplicate: true }
    await this.write(item)
    await this.db
      .insert(processedMutations)
      .values({
        id: mutationId,
        ownerId: this.ownerId,
        entityId: item.entityId,
        processedAt: new Date().toISOString(),
      })
      .onConflictDoNothing()
    return { duplicate: false }
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

  private async write(item: OutboxItem) {
    if (item.entity === 'pet') {
      const p = item.payload as Pet
      const existing = await this.db
        .select({ ownerId: pets.ownerId })
        .from(pets)
        .where(eq(pets.id, p.id))
        .get()
      if (existing && existing.ownerId !== this.ownerId) throw new OwnershipError()
      await this.db
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
        })
    } else if (item.entity === 'journal') {
      const e = item.payload as JournalEntry
      await this.assertJournalWritable(e.id, e.petId)
      await this.db
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
        })
    } else if (item.entity === 'measurement') {
      const m = item.payload as Measurement
      await this.assertMeasurementWritable(m.id, m.petId)
      await this.db
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
        })
    } else if (item.entity === 'outing') {
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
      await this.db
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
          setWhere: lte(outings.updatedAt, outing.updatedAt),
        })
    } else if (item.entity === 'reminder') {
      const r = item.payload as CareReminder
      await this.assertReminderWritable(r.id, r.petId)
      await this.db
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
        })
    }
  }
}
