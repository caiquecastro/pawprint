import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Bell, Check, Clock3, Plus, RotateCcw, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { AppShell } from '../components/AppShell'
import { EmptyState } from '../components/EmptyState'
import { SyncBadge } from '../components/SyncBadge'
import { formatDate, toLocalInputDate } from '../lib/format'
import { completeReminder, saveReminder } from '../lib/local-db'
import { petQuery, remindersQuery } from '../lib/queries'
import { parseRecurrence, reminderSchema } from '../lib/schemas'

export const Route = createFileRoute('/pets/$petId/care')({ component: CareRoute })
type FormValue = z.input<typeof reminderSchema>

function CareRoute() {
  const { petId } = Route.useParams()
  const pet = useQuery(petQuery(petId)).data
  const reminders = useQuery(remindersQuery(petId)).data ?? []
  const upcoming = reminders.filter((item) => !item.completedAt)
  const complete = reminders.filter((item) => item.completedAt)
  const dialog = useRef<HTMLDialogElement>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValue>({
    resolver: zodResolver(reminderSchema),
    defaultValues: {
      dueAt: toLocalInputDate(new Date(Date.now() + 86_400_000)),
      recurrenceRule: '',
    },
  })
  const show = () => dialog.current?.showModal()
  const close = () => dialog.current?.close()
  async function submit(values: FormValue) {
    const parsed = reminderSchema.parse(values)
    const now = new Date().toISOString()
    await saveReminder({
      id: crypto.randomUUID(),
      petId,
      title: parsed.title,
      notes: parsed.notes || undefined,
      dueAt: new Date(parsed.dueAt).toISOString(),
      recurrenceRule: parseRecurrence(parsed.recurrenceRule) ?? undefined,
      createdAt: now,
      updatedAt: now,
    })
    reset({ dueAt: toLocalInputDate(new Date(Date.now() + 86_400_000)), recurrenceRule: '' })
    close()
  }
  return (
    <AppShell petId={petId}>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Little acts of love</p>
          <h1>Care</h1>
          <p>Keep everyday care from getting lost in everyday life.</p>
        </div>
        <button className="small-add" onClick={show}>
          <Plus size={18} /> Add
        </button>
      </header>
      <Link className="walk-care-link card" to="/pets/$petId/walks" params={{ petId }}>
        <div>
          <h2>Walks & potty</h2>
          <p>Start a walk, log a potty break, or see the history.</p>
        </div>
        <span aria-hidden>→</span>
      </Link>
      <Link className="walk-care-link card mt-3" to="/pets/$petId/food" params={{ petId }}>
        <div>
          <h2>Food & supply</h2>
          <p>Log meals and see how much food is left.</p>
        </div>
        <span aria-hidden>→</span>
      </Link>
      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Next up</p>
            <h2>Upcoming</h2>
          </div>
          <span className="count-badge">{upcoming.length}</span>
        </div>
        {upcoming.length ? (
          <div className="care-list">
            {upcoming.map((item) => (
              <article className="care-card card" key={item.id}>
                <button
                  className="large-check"
                  onClick={() => void completeReminder(item.id)}
                  aria-label={`Complete ${item.title}`}
                >
                  <Check />
                </button>
                <div>
                  <h3>{item.title}</h3>
                  <p>
                    <Clock3 size={15} />{' '}
                    {formatDate(item.dueAt, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                  {item.notes && <p>{item.notes}</p>}
                  {item.recurrenceRule && (
                    <span className="recurrence">
                      <RotateCcw size={12} /> {item.recurrenceRule}
                    </span>
                  )}
                  <SyncBadge state={item.syncState} />
                </div>
                <Bell size={19} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="All cared for"
            text={`Nothing is due for ${pet?.name || 'your pet'} right now.`}
            action={
              <button className="text-link" onClick={show}>
                Add a reminder
              </button>
            }
          />
        )}
      </section>
      {complete.length > 0 && (
        <section className="section-block completed-section">
          <button className="completed-toggle" onClick={() => setShowCompleted(!showCompleted)}>
            Completed ({complete.length}) <span>{showCompleted ? '−' : '+'}</span>
          </button>
          {showCompleted && (
            <div className="care-list">
              {complete.map((item) => (
                <article className="care-card completed card" key={item.id}>
                  <button
                    className="large-check checked"
                    onClick={() => void completeReminder(item.id)}
                    aria-label={`Mark ${item.title} incomplete`}
                  >
                    <Check />
                  </button>
                  <div>
                    <h3>{item.title}</h3>
                    <p>Completed {formatDate(item.completedAt!)}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      <dialog ref={dialog} className="sheet-dialog">
        <form className="composer" onSubmit={handleSubmit(submit)}>
          <header>
            <div>
              <p className="eyebrow">A future nudge</p>
              <h2>Add a reminder</h2>
            </div>
            <button type="button" className="icon-button" onClick={close}>
              <X />
            </button>
          </header>
          <label className="field">
            <span>What needs doing?</span>
            <input autoFocus placeholder="Heartworm tablet" {...register('title')} />
          </label>
          {errors.title && <p className="field-error">{errors.title.message}</p>}
          <label className="field">
            <span>Due</span>
            <input type="datetime-local" {...register('dueAt')} />
          </label>
          {errors.dueAt && <p className="field-error">{errors.dueAt.message}</p>}
          <label className="field">
            <span>
              Repeat <small>optional</small>
            </span>
            <select {...register('recurrenceRule')}>
              <option value="">Doesn’t repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="field">
            <span>
              Notes <small>optional</small>
            </span>
            <textarea
              rows={3}
              placeholder="Dose, instructions, or context…"
              {...register('notes')}
            />
          </label>
          <button className="primary-button full" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save reminder'}
          </button>
        </form>
      </dialog>
    </AppShell>
  )
}
