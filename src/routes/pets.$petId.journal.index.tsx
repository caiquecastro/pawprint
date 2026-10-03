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
      <header className="flex items-end justify-between pt-2 pb-[1.4rem] px-0 gap-4">
        <div>
          <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem] last:max-w-[500px] last:text-ink-soft last:m-0">
            {pet?.name || 'Your pet'}’s life book
          </p>
          <h1 className="mt-0 mb-[0.6rem] mx-0">Journal</h1>
          <p className="last:max-w-[500px] last:text-ink-soft last:m-0">
            Every ordinary day becomes part of the story.
          </p>
        </div>
        <button
          className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-sunshine flex-none py-[0.6rem] px-4 gap-[0.45rem] border border-[#d1a51a]"
          onClick={() => setLocalCompose(true)}
        >
          <Plus size={18} /> Add
        </button>
      </header>
      <div className="grid grid-cols-[1fr_auto] mb-4 gap-[0.6rem]">
        <label className="min-h-12 flex items-center rounded-[15px] bg-cream py-0 px-[0.85rem] gap-[0.55rem] border border-line">
          <Search size={18} />
          <input
            className="min-w-0 w-full outline-0 bg-transparent text-ink border-0"
            aria-label="Search journal"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search moments"
          />
        </label>
        <label className="min-h-12 flex items-center rounded-[15px] bg-cream py-0 px-[0.85rem] gap-[0.55rem] border border-line">
          <Filter size={17} />
          <select
            className="min-w-0 w-1 outline-0 bg-transparent text-ink opacity-1 border-0"
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
        <div className="grid gap-[0.8rem] tablet:grid-cols-2 desktop:grid-cols-3">
          {filtered.map((entry) => (
            <Link
              key={entry.id}
              to="/pets/$petId/journal/$entryId"
              params={{ petId, entryId: entry.id }}
              className="bg-cream rounded-card shadow-panel grid grid-cols-[1fr] overflow-hidden border border-[rgba(20,_35,_59,_0.08)] data-[photo=true]:grid-cols-[108px_1fr] tablet:data-[photo=true]:grid-cols-[140px_1fr] desktop:data-[photo=true]:grid-cols-[1fr] [@media(width<=370px)]:data-[photo=true]:grid-cols-[88px_1fr]"
              data-photo={Boolean(entry.photoUrl)}
            >
              {entry.photoUrl && (
                <img
                  className="min-h-[150px] object-cover size-full desktop:h-[190px]"
                  src={entry.photoUrl}
                  alt=""
                />
              )}
              <div className="p-4">
                <p className="flex items-center mb-[0.2rem] text-[#687586] text-[0.7rem] font-extrabold tracking-[0.055em] uppercase gap-[0.38rem]">
                  <span
                    className="data-[type=health]:bg-sage data-[type=health]:outline-sage data-[type=milestone]:bg-sunshine data-[type=milestone]:outline-sunshine-deep data-[type=routine]:bg-sky data-[type=routine]:outline-[#5d94a1] rounded-full bg-coral outline-0 size-[9px]"
                    data-type={entry.type}
                  />
                  {entry.type} ·{' '}
                  {formatDate(entry.occurredAt, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <h2 className="text-[1.35rem] my-[0.4rem] mx-0">{entry.title}</h2>
                <p className="line-clamp-2 overflow-hidden text-ink-soft text-[0.86rem]">
                  {entry.body}
                </p>
                <SyncBadge className="mt-[0.6rem]" state={entry.syncState} />
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
              <button
                className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-sunshine py-[0.6rem] px-4 gap-[0.45rem] border border-[#d1a51a] disabled:opacity-45 disabled:cursor-not-allowed"
                onClick={() => setLocalCompose(true)}
              >
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
