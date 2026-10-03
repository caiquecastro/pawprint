import { z } from 'zod'

const optionalText = z.string().trim().max(6000).optional().or(z.literal(''))

export const petSchema = z
  .object({
    name: z.string().trim().min(1, 'Tell us your pet’s name.').max(60),
    species: z.enum(['dog', 'cat', 'other']),
    breed: z.string().trim().max(80).optional().or(z.literal('')),
    birthDate: z.string().optional().or(z.literal('')),
    ageYears: z.coerce.number().int().min(0).max(80).optional().or(z.literal('')),
    approximateBirthDate: z.boolean().default(false),
    currentWeight: z.coerce.number().positive().max(500).optional().or(z.literal('')),
    weightUnit: z.enum(['kg', 'lb']).default('kg'),
  })
  .refine((value) => Boolean(value.birthDate) || value.ageYears !== '', {
    message: 'Add a birthday or an approximate age.',
    path: ['birthDate'],
  })

export const journalEntrySchema = z.object({
  type: z.enum(['memory', 'health', 'milestone', 'routine', 'mood']),
  occurredAt: z.string().min(1, 'Choose when this happened.'),
  title: z.string().trim().min(1, 'Give this moment a title.').max(120),
  body: z.string().trim().min(1, 'Add a note so you remember the details.').max(6000),
  mood: z.string().trim().max(30).optional().or(z.literal('')),
})

export const measurementSchema = z
  .object({
    type: z.enum(['weight', 'health_note', 'vet_visit']),
    numericValue: z.coerce.number().positive().max(500).optional().or(z.literal('')),
    unit: z.string().trim().max(12).optional().or(z.literal('')),
    measuredAt: z.string().min(1, 'Choose a date.'),
    note: optionalText,
  })
  .refine((value) => value.type !== 'weight' || value.numericValue !== '', {
    message: 'Enter a weight.',
    path: ['numericValue'],
  })

export const reminderSchema = z.object({
  title: z.string().trim().min(1, 'What needs doing?').max(120),
  notes: optionalText,
  dueAt: z.string().min(1, 'Choose a due date.'),
  recurrenceRule: z.enum(['', 'daily', 'weekly', 'monthly']).optional(),
})

export const syncMutationSchema = z
  .object({
    id: z
      .string()
      .regex(/^(pet|journal|measurement|reminder|outing|food|foodSupply):[0-9a-f-]{36}$/),
    revision: z.uuid().optional(),
    entity: z.enum(['pet', 'journal', 'measurement', 'reminder', 'outing', 'food', 'foodSupply']),
    entityId: z.uuid(),
    operation: z.enum(['create', 'update', 'delete']),
    payload: z.record(z.string(), z.unknown()),
    createdAt: z.iso.datetime(),
  })
  .refine(
    (item) => item.id === `${item.entity}:${item.entityId}` && item.payload.id === item.entityId,
    {
      message: 'The change must refer to the same record.',
    },
  )

export const outingSchema = z
  .object({
    id: z.uuid(),
    petId: z.uuid(),
    kind: z.enum(['walk', 'potty']),
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime().nullable(),
    peeCount: z.number().int().min(0).max(999).nullable(),
    poopCount: z.number().int().min(0).max(999).nullable(),
    notes: z.string().trim().max(6000),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    deletedAt: z.iso.datetime().optional(),
  })
  .superRefine((value, context) => {
    if (value.endedAt && Date.parse(value.endedAt) < Date.parse(value.startedAt)) {
      context.addIssue({
        code: 'custom',
        message: 'End time must be after the start.',
        path: ['endedAt'],
      })
    }
    if (
      value.kind === 'walk' &&
      value.endedAt !== null &&
      Date.parse(value.endedAt) === Date.parse(value.startedAt)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'A walk needs a positive duration.',
        path: ['endedAt'],
      })
    }
    if (
      value.kind === 'potty' &&
      (value.endedAt !== value.startedAt || !(value.peeCount || value.poopCount))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Record at least one pee or poop for a potty break.',
        path: ['peeCount'],
      })
    }
  })

export function parseRecurrence(value?: string) {
  if (!value) return null
  if (!['daily', 'weekly', 'monthly'].includes(value)) {
    throw new Error('Unsupported recurrence rule')
  }
  return value as 'daily' | 'weekly' | 'monthly'
}

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

export function validatePhoto(file: File) {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) return 'Choose a JPG, PNG, WebP, or HEIC image.'
  if (file.size > MAX_PHOTO_BYTES) return 'Choose a photo smaller than 8 MB.'
  return null
}

export const foodEntrySchema = z.object({
  id: z.uuid(),
  petId: z.uuid(),
  supplyId: z.uuid().optional(),
  food: z.string().trim().min(1, 'Enter the food name.').max(120),
  amount: z.number().positive('Enter a portion greater than zero.').max(100000),
  unit: z.enum(['g', 'oz', 'cups', 'servings']),
  fedAt: z.iso.datetime(),
  notes: z.string().trim().max(6000),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().optional(),
})

export const foodSupplySchema = foodEntrySchema.omit({ supplyId: true, fedAt: true }).extend({
  purchasedAt: z.iso.datetime(),
})
