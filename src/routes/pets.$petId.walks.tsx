import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, Pencil } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { EmptyState } from '../components/EmptyState'
import { OutingComposer } from '../components/OutingComposer'
import { SyncBadge } from '../components/SyncBadge'
import { WalkTracker } from '../components/WalkTracker'
import { formatDate } from '../lib/format'
import { outingMinutes, summarizeOutings } from '../lib/outings'
import { outingsQuery } from '../lib/queries'
import type { Outing } from '../lib/types'

export const Route = createFileRoute('/pets/$petId/walks')({ component: WalksRoute })

function WalksRoute() {
  const { petId } = Route.useParams()
  const query = useQuery(outingsQuery(petId))
  const outings = query.data ?? []
  const [editing, setEditing] = useState<Outing>()
  const summary = summarizeOutings(outings)
  const history = outings.filter((item) => item.endedAt)

  return (
    <AppShell petId={petId}>
      <Link
        className="min-h-11 inline-flex items-center mb-[0.7rem] bg-transparent font-extrabold cursor-pointer p-0 gap-1 border-0"
        to="/pets/$petId/care"
        params={{ petId }}
      >
        <ArrowLeft size={18} /> Care
      </Link>
      <header className="flex items-end justify-between pt-2 pb-[1.4rem] px-0 gap-4">
        <div>
          <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem] last:max-w-[500px] last:text-ink-soft last:m-0">
            A little fresh air
          </p>
          <h1 className="mt-0 mb-[0.6rem] mx-0">Walks & potty</h1>
          <p className="last:max-w-[500px] last:text-ink-soft last:m-0">
            Every adventure and little stop along the way.
          </p>
        </div>
      </header>
      <WalkTracker petId={petId} historyLink={false} />
      <section className="mt-8">
        <div className="flex items-end justify-between mb-[0.85rem] gap-4">
          <div>
            <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem]">
              Past seven days, including today
            </p>
            <h2 className="m-0">
              {summary.weekCount} {summary.weekCount === 1 ? 'walk' : 'walks'} ·{' '}
              {summary.weekMinutes === 0 && summary.weekCount > 0 ? '<1' : summary.weekMinutes} min
            </h2>
          </div>
        </div>
        <p className="text-ink-soft text-[0.82rem]">
          Completed walks, grouped by the day they started.
        </p>
      </section>
      <section className="mt-8">
        <div className="flex items-end justify-between mb-[0.85rem] gap-4">
          <h2 className="m-0">History</h2>
        </div>
        {query.isPending ? (
          <p>Loading history…</p>
        ) : query.isError ? (
          <p role="alert">Could not load the history. Please reload to try again.</p>
        ) : history.length ? (
          <div className="grid gap-[0.65rem]">
            {history.map((item) => (
              <article
                className="bg-cream rounded-card shadow-panel p-[1.1rem] border border-[rgba(20,_35,_59,_0.08)]"
                key={item.id}
              >
                <div className="flex items-start justify-between mb-[0.85rem] gap-4">
                  <div>
                    <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem] last:mb-0">
                      {formatDate(item.startedAt, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    <h3 className="mb-0">
                      {item.kind === 'walk'
                        ? `Walk · ${Math.max(0.1, Math.round(outingMinutes(item) * 10) / 10)} min`
                        : 'Potty break'}
                    </h3>
                  </div>
                  <button
                    className="inline-grid place-items-center rounded-full bg-transparent cursor-pointer p-0 size-11 border-0 hover:bg-[#e8ecee]"
                    aria-label={`Edit ${item.kind === 'walk' ? 'walk' : 'potty break'} from ${formatDate(item.startedAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
                    onClick={() => setEditing(item)}
                  >
                    <Pencil size={18} />
                  </button>
                </div>
                <p className="last:mb-0">
                  Pee: {item.peeCount ?? 'not recorded'} · Poop: {item.poopCount ?? 'not recorded'}
                </p>
                {item.notes && (
                  <p className="last:mb-0 whitespace-pre-wrap wrap-anywhere">{item.notes}</p>
                )}
                <SyncBadge state={item.syncState} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="The first steps"
            text="Start a walk or log a potty break to begin the history."
          />
        )}
      </section>
      {editing && (
        <OutingComposer
          petId={petId}
          kind={editing.kind}
          entry={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </AppShell>
  )
}
