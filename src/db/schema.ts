import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const pets = sqliteTable('pets', {
  id: text('id').primaryKey(), name: text('name').notNull(), species: text('species').notNull(), breed: text('breed'),
  birthDate: text('birth_date'), approximateBirthDate: integer('approximate_birth_date', { mode: 'boolean' }).notNull().default(false),
  currentWeight: real('current_weight'), weightUnit: text('weight_unit').notNull().default('kg'), avatarObjectKey: text('avatar_object_key'),
  ownerId: text('owner_id').notNull().default('single-owner'), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
})

export const journalEntries = sqliteTable('journal_entries', {
  id: text('id').primaryKey(), petId: text('pet_id').notNull().references(() => pets.id, { onDelete: 'cascade' }), type: text('type').notNull(),
  occurredAt: text('occurred_at').notNull(), title: text('title').notNull(), body: text('body').notNull(), mood: text('mood'),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(), deletedAt: text('deleted_at'),
}, (table) => [index('journal_pet_occurred_idx').on(table.petId, table.occurredAt), index('journal_updated_idx').on(table.updatedAt)])

export const measurements = sqliteTable('measurements', {
  id: text('id').primaryKey(), petId: text('pet_id').notNull().references(() => pets.id, { onDelete: 'cascade' }), type: text('type').notNull(),
  numericValue: real('numeric_value'), unit: text('unit'), measuredAt: text('measured_at').notNull(), note: text('note'),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(), deletedAt: text('deleted_at'),
}, (table) => [index('measurements_pet_measured_idx').on(table.petId, table.measuredAt)])

export const careReminders = sqliteTable('care_reminders', {
  id: text('id').primaryKey(), petId: text('pet_id').notNull().references(() => pets.id, { onDelete: 'cascade' }), title: text('title').notNull(), notes: text('notes'),
  dueAt: text('due_at').notNull(), recurrenceRule: text('recurrence_rule'), completedAt: text('completed_at'), createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(), deletedAt: text('deleted_at'),
}, (table) => [index('reminders_pet_due_idx').on(table.petId, table.dueAt), index('reminders_completed_idx').on(table.completedAt)])

export const media = sqliteTable('media', {
  id: text('id').primaryKey(), petId: text('pet_id').notNull().references(() => pets.id, { onDelete: 'cascade' }),
  journalEntryId: text('journal_entry_id').references(() => journalEntries.id, { onDelete: 'set null' }), objectKey: text('object_key').notNull().unique(),
  mimeType: text('mime_type').notNull(), width: integer('width'), height: integer('height'), createdAt: text('created_at').notNull(),
}, (table) => [index('media_pet_idx').on(table.petId), index('media_journal_idx').on(table.journalEntryId)])

export const processedMutations = sqliteTable('processed_mutations', {
  id: text('id').primaryKey(), entityId: text('entity_id').notNull(), processedAt: text('processed_at').notNull(),
})
