import { queryOptions } from '@tanstack/react-query'
import { getJournalEntry, getPet, listJournal, listMeasurements, listReminders } from './local-db'

export const petQuery = (petId: string) => queryOptions({ queryKey: ['pet', petId], queryFn: () => getPet(petId), enabled: typeof window !== 'undefined' })
export const journalQuery = (petId: string) => queryOptions({ queryKey: ['journal', petId], queryFn: () => listJournal(petId), enabled: typeof window !== 'undefined' })
export const journalEntryQuery = (entryId: string) => queryOptions({ queryKey: ['journal-entry', entryId], queryFn: () => getJournalEntry(entryId), enabled: typeof window !== 'undefined' })
export const measurementsQuery = (petId: string) => queryOptions({ queryKey: ['measurements', petId], queryFn: () => listMeasurements(petId), enabled: typeof window !== 'undefined' })
export const remindersQuery = (petId: string) => queryOptions({ queryKey: ['reminders', petId], queryFn: () => listReminders(petId), enabled: typeof window !== 'undefined' })
