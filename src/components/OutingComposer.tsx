import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { deleteOuting, saveOuting } from '../lib/local-db'
import { toLocalInputDate } from '../lib/format'
import { outingMinutes } from '../lib/outings'
import { outingSchema } from '../lib/schemas'
import type { Outing } from '../lib/types'

export function OutingComposer({
  petId,
  kind,
  entry,
  onClose,
}: {
  petId: string
  kind: Outing['kind']
  entry?: Outing
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const initialStart = toLocalInputDate(
    entry ? new Date(entry.startedAt) : new Date(Date.now() - (kind === 'walk' ? 20 * 60_000 : 0)),
  )
  const initialDuration = entry ? String(Number(outingMinutes(entry).toFixed(3))) : '20'
  const [startedAt, setStartedAt] = useState(initialStart)
  const [duration, setDuration] = useState(initialDuration)
  const [pee, setPee] = useState(entry?.peeCount?.toString() ?? '')
  const [poop, setPoop] = useState(entry?.poopCount?.toString() ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const now = new Date().toISOString()
      const start =
        entry && startedAt === initialStart ? entry.startedAt : new Date(startedAt).toISOString()
      const minutes = Number(duration)
      if (kind === 'walk' && (!Number.isFinite(minutes) || minutes <= 0)) {
        throw new Error('Enter a duration greater than zero.')
      }
      const end =
        kind === 'potty'
          ? start
          : entry?.endedAt && startedAt === initialStart && duration === initialDuration
            ? entry.endedAt
            : new Date(Date.parse(start) + minutes * 60_000).toISOString()
      if (Date.parse(start) > Date.now() || Date.parse(end) > Date.now()) {
        throw new Error('Choose a time and duration that end in the past.')
      }
      const result = outingSchema.safeParse({
        id: entry?.id ?? crypto.randomUUID(),
        petId,
        kind,
        startedAt: start,
        endedAt: end,
        peeCount: pee === '' ? null : Number(pee),
        poopCount: poop === '' ? null : Number(poop),
        notes,
        createdAt: entry?.createdAt ?? now,
        updatedAt: now,
      })
      if (!result.success) throw new Error(result.error.issues[0]?.message ?? 'Check the details.')
      await saveOuting(result.data)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!entry) return
    setBusy(true)
    try {
      await deleteOuting(entry.id)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete. Please try again.')
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      className="w-[min(100%,_620px)] max-h-[calc(100svh_-_1rem)] mt-auto mb-0 rounded-[26px_26px_0_0] bg-cream text-ink shadow-[0_-12px_50px_rgba(20,_35,_59,_0.2)] mx-auto p-0 border-0 backdrop:bg-[rgba(20,_35,_59,_0.48)] backdrop:backdrop-blur-[2px] open:animate-sheet-up tablet:mb-auto tablet:rounded-[26px]"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <form
        className="overflow-y-auto max-h-[calc(100svh_-_1rem)] pt-[1.2rem] pb-[calc(1.2rem_+_env(safe-area-inset-bottom))] px-4 tablet:p-6"
        onSubmit={submit}
      >
        <header className="flex justify-between items-start mb-[1.1rem]">
          <div>
            <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem]">
              Everyday adventures
            </p>
            <h2 className="text-[1.7rem] m-0" id={titleId}>
              {entry ? 'Edit' : 'Log'} {kind === 'walk' ? 'walk' : 'potty break'}
            </h2>
          </div>
          <button
            type="button"
            className="inline-grid place-items-center rounded-full bg-transparent cursor-pointer p-0 size-11 border-0 hover:bg-[#e8ecee]"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X />
          </button>
        </header>
        <fieldset className="min-w-0 m-0 p-0 border-0" disabled={busy}>
          <label className="grid mb-[0.9rem] gap-[0.4rem]">
            <span className="text-[0.78rem] font-extrabold text-[#435066]">
              {kind === 'walk' ? 'Started at' : 'When'}
            </span>
            <input
              className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
              autoFocus
              type="datetime-local"
              required
              value={startedAt}
              max={toLocalInputDate()}
              onChange={(event) => setStartedAt(event.target.value)}
            />
          </label>
          {kind === 'walk' && (
            <label className="grid mb-[0.9rem] gap-[0.4rem]">
              <span className="text-[0.78rem] font-extrabold text-[#435066]">
                Duration in minutes
              </span>
              <input
                className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
                type="number"
                min="0.001"
                step="any"
                required
                placeholder="20"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </label>
          )}
          <div className="grid grid-cols-[1fr_1fr] gap-[0.7rem] [@media(width<=370px)]:grid-cols-[1fr] [@media(width<=370px)]:gap-0">
            <label className="grid mb-[0.9rem] gap-[0.4rem]">
              <span className="text-[0.78rem] font-extrabold text-[#435066]">
                Pee count <small className="text-[#87909a] font-medium">optional</small>
              </span>
              <input
                className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
                type="number"
                min="0"
                max="999"
                step="1"
                placeholder="Not recorded"
                value={pee}
                onChange={(event) => setPee(event.target.value)}
              />
            </label>
            <label className="grid mb-[0.9rem] gap-[0.4rem]">
              <span className="text-[0.78rem] font-extrabold text-[#435066]">
                Poop count <small className="text-[#87909a] font-medium">optional</small>
              </span>
              <input
                className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
                type="number"
                min="0"
                max="999"
                step="1"
                placeholder="Not recorded"
                value={poop}
                onChange={(event) => setPoop(event.target.value)}
              />
            </label>
          </div>
          <p className="text-ink-soft text-[0.82rem]">
            Leave blank if not recorded. Enter 0 for none.
            {kind === 'potty' ? ' A potty break needs at least one pee or poop.' : ''}
          </p>
          <label className="grid mb-[0.9rem] gap-[0.4rem]">
            <span className="text-[0.78rem] font-extrabold text-[#435066]">
              Notes <small className="text-[#87909a] font-medium">optional</small>
            </span>
            <textarea
              className="w-full min-h-12.5 rounded-[13px] bg-white text-ink resize-y py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
              rows={3}
              maxLength={6000}
              placeholder="A favorite route, something you noticed…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          {error && (
            <p className="text-[#a03d30] text-[0.85rem] my-3 mx-0" role="alert">
              {error}
            </p>
          )}
          <button
            className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-sunshine w-full py-[0.6rem] px-4 gap-[0.45rem] border border-[#d1a51a] disabled:opacity-45 disabled:cursor-not-allowed"
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Save details'}
          </button>
          {entry && !confirmDelete && (
            <button
              className="inline-flex items-center bg-transparent text-[#a03d30] text-[0.82rem] font-extrabold underline underline-offset-3 cursor-pointer min-h-11 mt-3 py-[0.4rem] px-0 gap-[0.3rem] border-0"
              type="button"
              onClick={() => setConfirmDelete(true)}
            >
              Delete this record
            </button>
          )}
          {confirmDelete && (
            <div className="rounded-[14px] my-4 mx-0 p-4 border border-[#e6b6aa]">
              <p>Delete this {kind === 'walk' ? 'walk' : 'potty break'} from the history?</p>
              <div className="flex flex-wrap items-center gap-[0.65rem]">
                <button
                  className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-white py-[0.6rem] px-4 gap-[0.45rem] border border-line"
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep it
                </button>
                <button
                  className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-[#a03d30] text-white py-[0.6rem] px-4 gap-[0.45rem] border border-[#a03d30]"
                  type="button"
                  onClick={() => void remove()}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </fieldset>
      </form>
    </dialog>
  )
}
