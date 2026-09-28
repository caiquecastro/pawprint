import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Filter, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { z } from 'zod'
import { AppShell } from '../components/AppShell'
import { EmptyState } from '../components/EmptyState'
import { JournalComposer } from '../components/JournalComposer'
import { SyncBadge } from '../components/SyncBadge'
import { formatDate } from '../lib/format'
import { journalQuery, petQuery } from '../lib/queries'
import type { JournalEntryType } from '../lib/types'

const searchSchema = z.object({ compose: z.enum(['new']).optional() })
export const Route = createFileRoute('/pets/$petId/journal/')({
  validateSearch: searchSchema,
  component: JournalRoute,
})

function JournalRoute() {
  const { petId } = Route.useParams()
  const searchParams = Route.useSearch()
  const navigate = useNavigate()
  const pet = useQuery(petQuery(petId)).data
  const entries = useQuery(journalQuery(petId)).data
  const entryCount = entries?.length ?? 0
  const [query, setQuery] = useState('')
  const [type, setType] = useState<JournalEntryType | 'all'>('all')
  const [localCompose, setLocalCompose] = useState(false)
  const compose = searchParams.compose === 'new' || localCompose
  const filtered = useMemo(
    () =>
      (entries ?? []).filter(
        (entry) =>
          (type === 'all' || entry.type === type) &&
          `${entry.title} ${entry.body}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [entries, query, type],
  )
  const close = () => {
    setLocalCompose(false)
    if (searchParams.compose)
      void navigate({ to: '/pets/$petId/journal', params: { petId }, replace: true })
  }

  return (
    <AppShell petId={petId}>
      <header className="page-heading">
        <div>
          <p className="eyebrow">{pet?.name || 'Your pet'}’s life book</p>
          <h1>Journal</h1>
          <p>Every ordinary day becomes part of the story.</p>
        </div>
        <button className="small-add" onClick={() => setLocalCompose(true)}>
          <Plus size={18} /> Add
        </button>
      </header>
      <div className="journal-tools">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search journal"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search moments"
          />
        </label>
        <label className="filter-field">
          <Filter size={17} />
          <select
            aria-label="Filter journal by type"
            value={type}
            onChange={(event) => setType(event.target.value as JournalEntryType | 'all')}
          >
            <option value="all">All moments</option>
            <option value="memory">Memories</option>
            <option value="milestone">Milestones</option>
            <option value="routine">Routines</option>
            <option value="health">Health</option>
            <option value="mood">Moods</option>
          </select>
        </label>
      </div>
      {filtered.length ? (
        <div className="journal-grid">
          {filtered.map((entry) => (
            <Link
              key={entry.id}
              to="/pets/$petId/journal/$entryId"
              params={{ petId, entryId: entry.id }}
              className={`journal-card card ${entry.photoUrl ? 'has-photo' : ''}`}
            >
              {entry.photoUrl && <img src={entry.photoUrl} alt="" />}
              <div>
                <p className="entry-meta">
                  <span className={`type-dot ${entry.type}`} />
                  {entry.type} ·{' '}
                  {formatDate(entry.occurredAt, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <h2>{entry.title}</h2>
                <p className="clamp">{entry.body}</p>
                <SyncBadge state={entry.syncState} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title={entryCount ? 'No moments found' : 'Your first page is waiting'}
          text={
            entryCount
              ? 'Try another search or filter.'
              : `Keep a small detail about ${pet?.name || 'your pet'} before it slips away.`
          }
          action={
            !entryCount && (
              <button className="primary-button" onClick={() => setLocalCompose(true)}>
                <Plus size={18} /> Add a moment
              </button>
            )
          }
        />
      )}
      <JournalComposer petId={petId} open={compose} onClose={close} />
    </AppShell>
  )
}
