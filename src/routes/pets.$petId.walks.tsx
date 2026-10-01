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
      <Link className="back-button" to="/pets/$petId/care" params={{ petId }}>
        <ArrowLeft size={18} /> Care
      </Link>
      <header className="page-heading">
        <div>
          <p className="eyebrow">A little fresh air</p>
          <h1>Walks & potty</h1>
          <p>Every adventure and little stop along the way.</p>
        </div>
      </header>
      <WalkTracker petId={petId} historyLink={false} />
      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Past seven days, including today</p>
            <h2>
              {summary.weekCount} {summary.weekCount === 1 ? 'walk' : 'walks'} ·{' '}
              {summary.weekMinutes === 0 && summary.weekCount > 0 ? '<1' : summary.weekMinutes} min
            </h2>
          </div>
        </div>
        <p className="outing-hint">Completed walks, grouped by the day they started.</p>
      </section>
      <section className="section-block">
        <div className="section-heading">
          <h2>History</h2>
        </div>
        {query.isPending ? (
          <p>Loading history…</p>
        ) : query.isError ? (
          <p role="alert">Could not load the history. Please reload to try again.</p>
        ) : history.length ? (
          <div className="stack">
            {history.map((item) => (
              <article className="outing-history-card card" key={item.id}>
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">
                      {formatDate(item.startedAt, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    <h3>
                      {item.kind === 'walk'
                        ? `Walk · ${Math.max(0.1, Math.round(outingMinutes(item) * 10) / 10)} min`
                        : 'Potty break'}
                    </h3>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Edit ${item.kind === 'walk' ? 'walk' : 'potty break'} from ${formatDate(item.startedAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
                    onClick={() => setEditing(item)}
                  >
                    <Pencil size={18} />
                  </button>
                </div>
                <p>
                  Pee: {item.peeCount ?? 'not recorded'} · Poop: {item.poopCount ?? 'not recorded'}
                </p>
                {item.notes && <p className="outing-notes">{item.notes}</p>}
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
