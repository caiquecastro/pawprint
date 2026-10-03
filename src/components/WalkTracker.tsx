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
    <section
      className="bg-[#f8fbf6] rounded-card shadow-panel my-[1.2rem] mx-0 p-[clamp(1rem,_4vw,_1.5rem)] border border-[rgba(20,_35,_59,_0.08)]"
      aria-label="Walks and potty breaks"
    >
      <div className="flex items-end justify-between mb-[0.85rem] gap-4">
        <div>
          <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem]">
            <Footprints size={15} /> Everyday adventures
          </p>
          <h2 className="m-0">{active ? 'Out for a walk' : 'Walks & potty'}</h2>
        </div>
        {historyLink && (
          <Link
            className="inline-flex items-center bg-transparent text-[#425468] text-[0.82rem] font-extrabold underline underline-offset-3 cursor-pointer py-[0.4rem] px-0 gap-[0.3rem] border-0"
            to="/pets/$petId/walks"
            params={{ petId }}
          >
            History <ArrowRight size={15} />
          </Link>
        )}
      </div>
      {active ? (
        <div>
          <p
            className="mt-3 mb-1 text-[clamp(3rem,_14vw,_4.5rem)] tabular-nums leading-[1.1] tracking-[-0.05em] mx-0"
            aria-label="Elapsed walk time"
          >
            {elapsedWalk(active.startedAt, now)}
          </p>
          <p className="text-ink-soft text-[0.82rem]">
            Started{' '}
            {formatDate(active.startedAt, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
            . You can close the app and come back.
          </p>
          <div className="grid grid-cols-2 my-4 mx-0 gap-[0.8rem]">
            {(['peeCount', 'poopCount'] as const).map((field) => {
              const label = field === 'peeCount' ? 'Pee' : 'Poop'
              return (
                <div className="rounded-[16px] bg-cream p-[0.85rem] border border-line" key={field}>
                  <p className="text-[0.85rem]">
                    {label}:{' '}
                    <strong className="block" aria-live="polite">
                      {active[field] ?? 'Not recorded'}
                    </strong>
                  </p>
                  <button
                    className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-white py-[0.6rem] px-4 gap-[0.45rem] border border-line"
                    disabled={busy || (active[field] ?? 0) >= 999}
                    onClick={() => void perform(() => changeCount(field, (active[field] ?? 0) + 1))}
                  >
                    {label} +1
                  </button>
                  <div className="flex flex-wrap items-center gap-[0.65rem]">
                    <button
                      className="inline-flex items-center bg-transparent text-[#425468] text-[0.82rem] font-extrabold underline underline-offset-3 cursor-pointer min-h-11 py-[0.4rem] px-0 gap-[0.3rem] border-0"
                      disabled={busy}
                      onClick={() => void perform(() => changeCount(field, 0))}
                    >
                      None
                    </button>
                    {active[field] !== null && (
                      <button
                        className="inline-flex items-center bg-transparent text-[#425468] text-[0.82rem] font-extrabold underline underline-offset-3 cursor-pointer min-h-11 py-[0.4rem] px-0 gap-[0.3rem] border-0"
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
              className="inline-flex items-center bg-transparent text-[#425468] text-[0.82rem] font-extrabold underline underline-offset-3 cursor-pointer min-h-11 py-[0.4rem] px-0 gap-[0.3rem] border-0"
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
          <div className="flex flex-wrap items-center gap-[0.65rem]">
            <button
              className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-sunshine py-[0.6rem] px-4 gap-[0.45rem] border border-[#d1a51a] disabled:opacity-45 disabled:cursor-not-allowed"
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
            <button
              className="inline-flex items-center bg-transparent text-[#425468] text-[0.82rem] font-extrabold underline underline-offset-3 cursor-pointer min-h-11 py-[0.4rem] px-0 gap-[0.3rem] border-0"
              disabled={busy}
              onClick={() => setDiscard(true)}
            >
              Discard walk
            </button>
          </div>
          {discard && (
            <div className="rounded-[14px] my-4 mx-0 p-4 border border-[#e6b6aa]">
              <p>Discard this walk and its potty counts?</p>
              <div className="flex flex-wrap items-center gap-[0.65rem]">
                <button
                  className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-white py-[0.6rem] px-4 gap-[0.45rem] border border-line"
                  disabled={busy}
                  onClick={() => setDiscard(false)}
                >
                  Keep walking
                </button>
                <button
                  className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-[#a03d30] text-white py-[0.6rem] px-4 gap-[0.45rem] border border-[#a03d30]"
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
          <p className="text-ink-soft">
            <strong className="text-ink">{summary.todayCount}</strong>{' '}
            {summary.todayCount === 1 ? 'walk' : 'walks'} ·{' '}
            <strong className="text-ink">
              {summary.todayMinutes === 0 && summary.todayCount > 0 ? '<1' : summary.todayMinutes}
            </strong>{' '}
            min today
          </p>
          <div className="flex flex-wrap items-center gap-[0.65rem]">
            <button
              className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-sunshine py-[0.6rem] px-4 gap-[0.45rem] border border-[#d1a51a] disabled:opacity-45 disabled:cursor-not-allowed"
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
              className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-white py-[0.6rem] px-4 gap-[0.45rem] border border-line"
              disabled={busy}
              onClick={() => setComposer({ kind: 'walk' })}
            >
              Log past walk
            </button>
          </div>
        </>
      )}
      <div className="mt-[1.2rem] pt-[1.2rem] border-t border-solid border-t-line">
        <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem]">
          Potty break outside a walk
        </p>
        <div className="flex flex-wrap items-center gap-[0.65rem]">
          <button
            className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-white py-[0.6rem] px-4 gap-[0.45rem] border border-line"
            disabled={busy}
            onClick={() => void perform(() => quickPotty('peeCount'))}
          >
            Log pee
          </button>
          <button
            className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-white py-[0.6rem] px-4 gap-[0.45rem] border border-line"
            disabled={busy}
            onClick={() => void perform(() => quickPotty('poopCount'))}
          >
            Log poop
          </button>
          <button
            className="inline-flex items-center bg-transparent text-[#425468] text-[0.82rem] font-extrabold underline underline-offset-3 cursor-pointer min-h-11 py-[0.4rem] px-0 gap-[0.3rem] border-0"
            disabled={busy}
            onClick={() => setComposer({ kind: 'potty' })}
          >
            Add details / past break
          </button>
        </div>
      </div>
      <dl className="grid mt-[1.2rem] mb-0 text-[0.8rem] mx-0 gap-[0.55rem]">
        <RecentRecord label="Last walk" entry={summary.lastWalk} />
        <RecentRecord label="Last pee record" entry={summary.lastPee} />
        <RecentRecord label="Last poop record" entry={summary.lastPoop} />
      </dl>
      {notice && (
        <output className="flex items-center mt-4 text-[#365940] text-[0.85rem] gap-3">
          {notice.text}
          {notice.undoId && (
            <button
              className="inline-flex items-center bg-transparent text-[#425468] text-[0.82rem] font-extrabold underline underline-offset-3 cursor-pointer min-h-11 py-[0.4rem] px-0 gap-[0.3rem] border-0"
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
        <p className="text-[#a03d30] text-[0.85rem] my-3 mx-0" role="alert">
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
    <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
      <dt className="font-bold">{label}</dt>
      <dd className="m-0 text-ink-soft">
        {entry
          ? `${formatDate(entry.startedAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}${entry.kind === 'walk' && label !== 'Last walk' ? ' walk' : ''}`
          : 'Not recorded yet'}
      </dd>
    </div>
  )
}
