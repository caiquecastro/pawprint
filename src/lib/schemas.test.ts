import { describe, expect, it } from 'vitest'
import { journalEntrySchema, parseRecurrence, petSchema, reminderSchema } from './schemas'

describe('shared validation', () => {
  it('requires a pet name and either birthday or approximate age', () => {
    expect(
      petSchema.safeParse({
        name: '',
        species: 'dog',
        birthDate: '',
        ageYears: '',
        approximateBirthDate: false,
        weightUnit: 'kg',
      }).success,
    ).toBe(false)
    expect(
      petSchema.safeParse({
        name: 'Juniper',
        species: 'dog',
        birthDate: '2020-04-10',
        ageYears: '',
        approximateBirthDate: false,
        weightUnit: 'kg',
      }).success,
    ).toBe(true)
  })

  it('validates journal content', () => {
    expect(
      journalEntrySchema.safeParse({
        type: 'memory',
        occurredAt: '2026-09-26T10:00',
        title: '',
        body: '',
      }).success,
    ).toBe(false)
    expect(
      journalEntrySchema.safeParse({
        type: 'milestone',
        occurredAt: '2026-09-26T10:00',
        title: 'First swim',
        body: 'Ran straight into the lake.',
      }).success,
    ).toBe(true)
  })

  it('accepts only supported recurrence rules', () => {
    expect(parseRecurrence('weekly')).toBe('weekly')
    expect(parseRecurrence('')).toBeNull()
    expect(() => parseRecurrence('yearly')).toThrow('Unsupported recurrence rule')
    expect(
      reminderSchema.safeParse({ title: 'Tablet', dueAt: '', recurrenceRule: 'daily' }).success,
    ).toBe(false)
  })
})
