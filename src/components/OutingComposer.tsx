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
      className="sheet-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <form className="composer" onSubmit={submit}>
        <header>
          <div>
            <p className="eyebrow">Everyday adventures</p>
            <h2 id={titleId}>
              {entry ? 'Edit' : 'Log'} {kind === 'walk' ? 'walk' : 'potty break'}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X />
          </button>
        </header>
        <fieldset className="outing-fields" disabled={busy}>
          <label className="field">
            <span>{kind === 'walk' ? 'Started at' : 'When'}</span>
            <input
              autoFocus
              type="datetime-local"
              required
              value={startedAt}
              max={toLocalInputDate()}
              onChange={(event) => setStartedAt(event.target.value)}
            />
          </label>
          {kind === 'walk' && (
            <label className="field">
              <span>Duration in minutes</span>
              <input
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
          <div className="field-pair">
            <label className="field">
              <span>
                Pee count <small>optional</small>
              </span>
              <input
                type="number"
                min="0"
                max="999"
                step="1"
                placeholder="Not recorded"
                value={pee}
                onChange={(event) => setPee(event.target.value)}
              />
            </label>
            <label className="field">
              <span>
                Poop count <small>optional</small>
              </span>
              <input
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
          <p className="outing-hint">
            Leave blank if not recorded. Enter 0 for none.
            {kind === 'potty' ? ' A potty break needs at least one pee or poop.' : ''}
          </p>
          <label className="field">
            <span>
              Notes <small>optional</small>
            </span>
            <textarea
              rows={3}
              maxLength={6000}
              placeholder="A favorite route, something you noticed…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          {error && (
            <p className="outing-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button full" disabled={busy}>
            {busy ? 'Saving…' : 'Save details'}
          </button>
          {entry && !confirmDelete && (
            <button
              className="text-link outing-delete"
              type="button"
              onClick={() => setConfirmDelete(true)}
            >
              Delete this record
            </button>
          )}
          {confirmDelete && (
            <div className="outing-delete-confirm">
              <p>Delete this {kind === 'walk' ? 'walk' : 'potty break'} from the history?</p>
              <div className="outing-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep it
                </button>
                <button className="danger-button" type="button" onClick={() => void remove()}>
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
