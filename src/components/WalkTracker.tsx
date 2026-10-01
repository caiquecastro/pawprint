import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Footprints } from 'lucide-react'
import { useEffect, useState } from 'react'
import { adjustPottyCount, deleteOuting, finishWalk, saveOuting, startWalk } from '../lib/local-db'
import { formatDate } from '../lib/format'
import { elapsedWalk, summarizeOutings } from '../lib/outings'
import { outingsQuery } from '../lib/queries'
import type { Outing } from '../lib/types'
import { OutingComposer } from './OutingComposer'
import { SyncBadge } from './SyncBadge'

export function WalkTracker({
  petId,
  historyLink = true,
}: {
  petId: string
  historyLink?: boolean
}) {
  const query = useQuery(outingsQuery(petId))
  const outings = query.data ?? []
  const active = outings.find((item) => item.kind === 'walk' && !item.endedAt)
  const activeId = active?.id
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ text: string; undoId?: string }>()
  const [composer, setComposer] = useState<{ kind: Outing['kind']; entry?: Outing }>()
  const [discard, setDiscard] = useState(false)
  const [undoCount, setUndoCount] = useState<{
    id: string
    field: 'peeCount' | 'poopCount'
    previous: number | null
  }>()
  const summary = summarizeOutings(outings, new Date(now))

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), activeId ? 1000 : 30_000)
    return () => window.clearInterval(timer)
  }, [activeId])

  async function perform(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
      await query.refetch()
      setNow(Date.now())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function quickPotty(field: 'peeCount' | 'poopCount') {
    const timestamp = new Date().toISOString()
    const record = await saveOuting({
      id: crypto.randomUUID(),
      petId,
      kind: 'potty',
      startedAt: timestamp,
      endedAt: timestamp,
      peeCount: field === 'peeCount' ? 1 : null,
      poopCount: field === 'poopCount' ? 1 : null,
      notes: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    setNotice({ text: `${field === 'peeCount' ? 'Pee' : 'Poop'} logged.`, undoId: record.id })
  }

  async function changeCount(field: 'peeCount' | 'poopCount', value: number | null) {
    if (!active) return
    await adjustPottyCount(active.id, field, value)
    setUndoCount({ id: active.id, field, previous: active[field] })
  }

  return (
    <section className="walk-card card" aria-label="Walks and potty breaks">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            <Footprints size={15} /> Everyday adventures
          </p>
          <h2>{active ? 'Out for a walk' : 'Walks & potty'}</h2>
        </div>
        {historyLink && (
          <Link to="/pets/$petId/walks" params={{ petId }}>
            History <ArrowRight size={15} />
          </Link>
        )}
      </div>
      {active ? (
        <div className="active-walk">
          <p className="walk-timer" aria-label="Elapsed walk time">
            {elapsedWalk(active.startedAt, now)}
          </p>
          <p className="outing-hint">
            Started{' '}
            {formatDate(active.startedAt, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
            . You can close the app and come back.
          </p>
          <div className="potty-counters">
            {(['peeCount', 'poopCount'] as const).map((field) => {
              const label = field === 'peeCount' ? 'Pee' : 'Poop'
              return (
                <div className="potty-counter" key={field}>
                  <p>
                    {label}: <strong aria-live="polite">{active[field] ?? 'Not recorded'}</strong>
                  </p>
                  <button
                    className="secondary-button"
                    disabled={busy || (active[field] ?? 0) >= 999}
                    onClick={() => void perform(() => changeCount(field, (active[field] ?? 0) + 1))}
                  >
                    {label} +1
                  </button>
                  <div className="outing-actions">
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() => void perform(() => changeCount(field, 0))}
                    >
                      None
                    </button>
                    {active[field] !== null && (
                      <button
                        className="text-link"
                        disabled={busy}
                        onClick={() => void perform(() => changeCount(field, null))}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {undoCount?.id === active.id && (
            <button
              className="text-link"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await adjustPottyCount(active.id, undoCount.field, undoCount.previous)
                  setUndoCount(undefined)
                })
              }
            >
              Undo last {undoCount.field === 'peeCount' ? 'pee' : 'poop'} change
            </button>
          )}
          <div className="outing-actions">
            <button
              className="primary-button"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  const finished = await finishWalk(active.id)
                  setComposer({ kind: 'walk', entry: finished })
                  setNotice({ text: 'Walk saved. You can adjust the details.' })
                })
              }
            >
              Finish walk
            </button>
            <button className="text-link" disabled={busy} onClick={() => setDiscard(true)}>
              Discard walk
            </button>
          </div>
          {discard && (
            <div className="outing-delete-confirm">
              <p>Discard this walk and its potty counts?</p>
              <div className="outing-actions">
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => setDiscard(false)}
                >
                  Keep walking
                </button>
                <button
                  className="danger-button"
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await deleteOuting(active.id)
                      setDiscard(false)
                    })
                  }
                >
                  Discard
                </button>
              </div>
            </div>
          )}
          <SyncBadge state={active.syncState} />
        </div>
      ) : (
        <>
          <p className="walk-today">
            <strong>{summary.todayCount}</strong> {summary.todayCount === 1 ? 'walk' : 'walks'} ·{' '}
            <strong>
              {summary.todayMinutes === 0 && summary.todayCount > 0 ? '<1' : summary.todayMinutes}
            </strong>{' '}
            min today
          </p>
          <div className="outing-actions">
            <button
              className="primary-button"
              disabled={busy || query.isPending}
              onClick={() =>
                void perform(async () => {
                  await startWalk(petId)
                  setNotice(undefined)
                  setDiscard(false)
                })
              }
            >
              <Footprints size={18} /> Start walk
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setComposer({ kind: 'walk' })}
            >
              Log past walk
            </button>
          </div>
        </>
      )}
      <div className="quick-potty">
        <p className="eyebrow">Potty break outside a walk</p>
        <div className="outing-actions">
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void perform(() => quickPotty('peeCount'))}
          >
            Log pee
          </button>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void perform(() => quickPotty('poopCount'))}
          >
            Log poop
          </button>
          <button
            className="text-link"
            disabled={busy}
            onClick={() => setComposer({ kind: 'potty' })}
          >
            Add details / past break
          </button>
        </div>
      </div>
      <dl className="outing-recent">
        <RecentRecord label="Last walk" entry={summary.lastWalk} />
        <RecentRecord label="Last pee record" entry={summary.lastPee} />
        <RecentRecord label="Last poop record" entry={summary.lastPoop} />
      </dl>
      {notice && (
        <output className="outing-notice">
          {notice.text}
          {notice.undoId && (
            <button
              className="text-link"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await deleteOuting(notice.undoId!)
                  setNotice({ text: 'Potty log undone.' })
                })
              }
            >
              Undo
            </button>
          )}
        </output>
      )}
      {(error || query.isError) && (
        <p className="outing-error" role="alert">
          {error || 'Could not load walk history. Please reload and try again.'}
        </p>
      )}
      {composer && (
        <OutingComposer petId={petId} {...composer} onClose={() => setComposer(undefined)} />
      )}
    </section>
  )
}

function RecentRecord({ label, entry }: { label: string; entry?: Outing }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {entry
          ? `${formatDate(entry.startedAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}${entry.kind === 'walk' && label !== 'Last walk' ? ' walk' : ''}`
          : 'Not recorded yet'}
      </dd>
    </div>
  )
}
