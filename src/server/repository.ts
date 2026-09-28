import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { careReminders, journalEntries, measurements, pets, processedMutations } from '../db/schema'
import type { CareReminder, JournalEntry, Measurement, OutboxItem, Pet } from '../lib/types'

export class PawprintRepository {
  private db
  constructor(database: D1Database) {
    this.db = drizzle(database)
  }

  async applyMutation(item: OutboxItem) {
    const alreadyApplied = await this.db
      .select({ id: processedMutations.id })
      .from(processedMutations)
      .where(eq(processedMutations.id, item.id))
      .get()
    if (alreadyApplied) return { duplicate: true }
    await this.write(item)
    await this.db
      .insert(processedMutations)
      .values({ id: item.id, entityId: item.entityId, processedAt: new Date().toISOString() })
      .onConflictDoNothing()
    return { duplicate: false }
  }

  private async write(item: OutboxItem) {
    if (item.entity === 'pet') {
      const p = item.payload as Pet
      await this.db
        .insert(pets)
        .values({
          id: p.id,
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
    } else if (item.entity === 'reminder') {
      const r = item.payload as CareReminder
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
