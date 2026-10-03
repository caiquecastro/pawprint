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
      <header className="flex items-end justify-between pt-2 pb-[1.4rem] px-0 gap-4">
        <div>
          <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem] last:max-w-[500px] last:text-ink-soft last:m-0">
            Little acts of love
          </p>
          <h1 className="mt-0 mb-[0.6rem] mx-0">Care</h1>
          <p className="last:max-w-[500px] last:text-ink-soft last:m-0">
            Keep everyday care from getting lost in everyday life.
          </p>
        </div>
        <button
          className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-sunshine flex-none py-[0.6rem] px-4 gap-[0.45rem] border border-[#d1a51a]"
          onClick={show}
        >
          <Plus size={18} /> Add
        </button>
      </header>
      <Link
        className="bg-[#f8fbf6] rounded-card shadow-panel flex justify-between items-center p-[1.1rem] gap-4 border border-[rgba(20,_35,_59,_0.08)]"
        to="/pets/$petId/walks"
        params={{ petId }}
      >
        <div>
          <h2 className="mb-[0.4rem]">Walks & potty</h2>
          <p className="text-ink-soft text-[0.85rem] m-0">
            Start a walk, log a potty break, or see the history.
          </p>
        </div>
        <span aria-hidden>→</span>
      </Link>
      <Link
        className="bg-cream rounded-card shadow-panel flex justify-between items-center p-[1.1rem] gap-4 mt-3 border border-line"
        to="/pets/$petId/food"
        params={{ petId }}
      >
        <div>
          <h2 className="mb-[0.4rem]">Food & supply</h2>
          <p className="text-ink-soft text-[0.85rem] m-0">
            Log meals and see how much food is left.
          </p>
        </div>
        <span aria-hidden>→</span>
      </Link>
      <section className="mt-8">
        <div className="flex items-end justify-between mb-[0.85rem] gap-4">
          <div>
            <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem]">
              Next up
            </p>
            <h2 className="m-0">Upcoming</h2>
          </div>
          <span className="min-w-7.5 h-7.5 grid place-items-center rounded-full bg-sunshine font-extrabold">
            {upcoming.length}
          </span>
        </div>
        {upcoming.length ? (
          <div className="grid gap-[0.65rem]">
            {upcoming.map((item) => (
              <article
                className="bg-cream rounded-card shadow-panel min-h-[100px] grid grid-cols-[48px_1fr_auto] items-start p-4 gap-[0.8rem] border border-[rgba(20,_35,_59,_0.08)]"
                key={item.id}
              >
                <button
                  className="grid place-items-center rounded-full bg-white cursor-pointer text-transparent p-0 size-11.5 border-2 border-sky hover:text-white hover:bg-[#547c61] hover:border-[#547c61]"
                  onClick={() => void completeReminder(item.id)}
                  aria-label={`Complete ${item.title}`}
                >
                  <Check />
                </button>
                <div>
                  <h3 className="mt-0 mb-[0.15rem] text-[0.98rem] mx-0">{item.title}</h3>
                  <p className="mt-[0.3rem] mb-0 text-ink-soft text-[0.8rem] flex items-center mx-0 gap-[0.35rem]">
                    <Clock3 size={15} />{' '}
                    {formatDate(item.dueAt, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                  {item.notes && (
                    <p className="mt-[0.3rem] mb-0 text-ink-soft text-[0.8rem] flex items-center mx-0 gap-[0.35rem]">
                      {item.notes}
                    </p>
                  )}
                  {item.recurrenceRule && (
                    <span className="inline-flex items-center mt-[0.45rem] mr-[0.35rem] mb-0 ml-0 rounded-full bg-[#e7eff1] text-[0.68rem] font-bold py-[0.22rem] px-[0.45rem] gap-[0.3rem]">
                      <RotateCcw size={12} /> {item.recurrenceRule}
                    </span>
                  )}
                  <SyncBadge className="mt-[0.55rem]" state={item.syncState} />
                </div>
                <Bell className="text-coral" size={19} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="All cared for"
            text={`Nothing is due for ${pet?.name || 'your pet'} right now.`}
            action={
              <button
                className="inline-flex items-center bg-transparent text-[#425468] text-[0.82rem] font-extrabold underline underline-offset-3 cursor-pointer py-[0.4rem] px-0 gap-[0.3rem] border-0"
                onClick={show}
              >
                Add a reminder
              </button>
            }
          />
        )}
      </section>
      {complete.length > 0 && (
        <section className="mt-8">
          <button
            className="w-full min-h-12.5 flex justify-between bg-transparent font-extrabold cursor-pointer border-0"
            onClick={() => setShowCompleted(!showCompleted)}
          >
            Completed ({complete.length}) <span>{showCompleted ? '−' : '+'}</span>
          </button>
          {showCompleted && (
            <div className="grid gap-[0.65rem]">
              {complete.map((item) => (
                <article
                  className="bg-cream rounded-card shadow-panel min-h-19 grid grid-cols-[48px_1fr_auto] items-start opacity-68 p-4 gap-[0.8rem] border border-[rgba(20,_35,_59,_0.08)]"
                  key={item.id}
                >
                  <button
                    className="grid place-items-center rounded-full bg-[#547c61] cursor-pointer text-white p-0 size-11.5 border-2 border-[#547c61]"
                    onClick={() => void completeReminder(item.id)}
                    aria-label={`Mark ${item.title} incomplete`}
                  >
                    <Check />
                  </button>
                  <div>
                    <h3 className="mt-0 mb-[0.15rem] text-[0.98rem] line-through mx-0">
                      {item.title}
                    </h3>
                    <p className="mt-[0.3rem] mb-0 text-ink-soft text-[0.8rem] flex items-center mx-0 gap-[0.35rem]">
                      Completed {formatDate(item.completedAt!)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      <dialog
        ref={dialog}
        className="w-[min(100%,_620px)] max-h-[calc(100svh_-_1rem)] mt-auto mb-0 rounded-[26px_26px_0_0] bg-cream text-ink shadow-[0_-12px_50px_rgba(20,_35,_59,_0.2)] mx-auto p-0 border-0 backdrop:bg-[rgba(20,_35,_59,_0.48)] backdrop:backdrop-blur-[2px] open:animate-sheet-up tablet:mb-auto tablet:rounded-[26px]"
      >
        <form
          className="overflow-y-auto max-h-[calc(100svh_-_1rem)] pt-[1.2rem] pb-[calc(1.2rem_+_env(safe-area-inset-bottom))] px-4 tablet:p-6"
          onSubmit={handleSubmit(submit)}
        >
          <header className="flex justify-between items-start mb-[1.1rem]">
            <div>
              <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem]">
                A future nudge
              </p>
              <h2 className="text-[1.7rem] m-0">Add a reminder</h2>
            </div>
            <button
              type="button"
              className="inline-grid place-items-center rounded-full bg-transparent cursor-pointer p-0 size-11 border-0 hover:bg-[#e8ecee]"
              onClick={close}
            >
              <X />
            </button>
          </header>
          <label className="grid mb-[0.9rem] gap-[0.4rem]">
            <span className="text-[0.78rem] font-extrabold text-[#435066]">What needs doing?</span>
            <input
              className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
              autoFocus
              placeholder="Heartworm tablet"
              {...register('title')}
            />
          </label>
          {errors.title && (
            <p className="mt-[-0.55rem] mb-[0.7rem] text-[#a03d30] text-[0.78rem] font-bold mx-0">
              {errors.title.message}
            </p>
          )}
          <label className="grid mb-[0.9rem] gap-[0.4rem]">
            <span className="text-[0.78rem] font-extrabold text-[#435066]">Due</span>
            <input
              className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
              type="datetime-local"
              {...register('dueAt')}
            />
          </label>
          {errors.dueAt && (
            <p className="mt-[-0.55rem] mb-[0.7rem] text-[#a03d30] text-[0.78rem] font-bold mx-0">
              {errors.dueAt.message}
            </p>
          )}
          <label className="grid mb-[0.9rem] gap-[0.4rem]">
            <span className="text-[0.78rem] font-extrabold text-[#435066]">
              Repeat <small className="text-[#87909a] font-medium">optional</small>
            </span>
            <select
              className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
              {...register('recurrenceRule')}
            >
              <option value="">Doesn’t repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="grid mb-[0.9rem] gap-[0.4rem]">
            <span className="text-[0.78rem] font-extrabold text-[#435066]">
              Notes <small className="text-[#87909a] font-medium">optional</small>
            </span>
            <textarea
              className="w-full min-h-12.5 rounded-[13px] bg-white text-ink resize-y py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
              rows={3}
              placeholder="Dose, instructions, or context…"
              {...register('notes')}
            />
          </label>
          <button
            className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-sunshine w-full py-[0.6rem] px-4 gap-[0.45rem] border border-[#d1a51a] disabled:opacity-45 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving…' : 'Save reminder'}
          </button>
        </form>
      </dialog>
    </AppShell>
  )
}
