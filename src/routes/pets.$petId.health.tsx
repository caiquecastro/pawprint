import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { HeartPulse, Plus, Scale, Stethoscope, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { AppShell } from '../components/AppShell'
import { EmptyState } from '../components/EmptyState'
import { SyncBadge } from '../components/SyncBadge'
import { formatDate, toLocalInputDate } from '../lib/format'
import { saveMeasurement } from '../lib/local-db'
import { measurementsQuery, petQuery } from '../lib/queries'
import { measurementSchema } from '../lib/schemas'

export const Route = createFileRoute('/pets/$petId/health')({ component: HealthRoute })
type FormValue = z.input<typeof measurementSchema>

function HealthRoute() {
  const { petId } = Route.useParams()
  const pet = useQuery(petQuery(petId)).data
  const history = useQuery(measurementsQuery(petId)).data ?? []
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const latestWeight = history.find((item) => item.type === 'weight')
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValue>({
    resolver: zodResolver(measurementSchema),
    defaultValues: {
      type: 'weight',
      measuredAt: toLocalInputDate(),
      unit: pet?.weightUnit ?? 'kg',
    },
  })
  const type = watch('type')
  const show = () => {
    setOpen(true)
    dialog.current?.showModal()
  }
  const close = () => {
    setOpen(false)
    dialog.current?.close()
  }

  async function submit(values: FormValue) {
    const parsed = measurementSchema.parse(values)
    const now = new Date().toISOString()
    await saveMeasurement({
      id: crypto.randomUUID(),
      petId,
      type: parsed.type,
      numericValue: parsed.numericValue === '' ? undefined : parsed.numericValue,
      unit: parsed.unit || undefined,
      measuredAt: new Date(parsed.measuredAt).toISOString(),
      note: parsed.note || undefined,
      createdAt: now,
      updatedAt: now,
    })
    reset({ type: 'weight', measuredAt: toLocalInputDate(), unit: pet?.weightUnit ?? 'kg' })
    close()
  }

  return (
    <AppShell petId={petId}>
      <header className="flex items-end justify-between pt-2 pb-[1.4rem] px-0 gap-4">
        <div>
          <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem] last:max-w-[500px] last:text-ink-soft last:m-0">
            A gentle record, not advice
          </p>
          <h1 className="mt-0 mb-[0.6rem] mx-0">Health</h1>
          <p className="last:max-w-[500px] last:text-ink-soft last:m-0">
            Keep useful details together for you and your vet.
          </p>
        </div>
        <button
          className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-sunshine flex-none py-[0.6rem] px-4 gap-[0.45rem] border border-[#d1a51a]"
          onClick={show}
        >
          <Plus size={18} /> Record
        </button>
      </header>
      <div className="bg-cream rounded-card shadow-panel flex items-center p-[1.1rem] gap-4 border border-[rgba(20,_35,_59,_0.08)]">
        <span className="grid place-items-center rounded-[18px] bg-[#dfecef] text-[#4b7883] size-13.5">
          <Scale />
        </span>
        <div>
          <p className="text-ink-soft text-[0.78rem] m-0">Latest weight</p>
          <strong className="block font-serif text-[1.8rem]">
            {latestWeight?.numericValue ?? pet?.currentWeight ?? '—'}{' '}
            <small className="font-sans text-[0.8rem]">
              {latestWeight?.unit ?? pet?.weightUnit}
            </small>
          </strong>
          <p className="text-ink-soft text-[0.78rem] m-0">
            {latestWeight ? formatDate(latestWeight.measuredAt) : 'No measurement yet'}
          </p>
        </div>
      </div>
      <section className="mt-8">
        <div className="flex items-end justify-between mb-[0.85rem] gap-4">
          <div>
            <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem]">
              In order
            </p>
            <h2 className="m-0">Health history</h2>
          </div>
        </div>
        {history.length ? (
          <div className="grid">
            {history.map((item) => (
              <article
                className="grid grid-cols-[46px_1fr] border-b border-solid border-b-line py-4 px-0 gap-[0.8rem]"
                key={item.id}
              >
                <span className="grid place-items-center bg-[#e8edef] rounded-full size-10.5">
                  {item.type === 'weight' ? (
                    <Scale className="w-[19px]" />
                  ) : item.type === 'vet_visit' ? (
                    <Stethoscope className="w-[19px]" />
                  ) : (
                    <HeartPulse className="w-[19px]" />
                  )}
                </span>
                <div>
                  <p className="flex items-center mb-[0.2rem] text-[#687586] text-[0.7rem] font-extrabold tracking-[0.055em] uppercase gap-[0.38rem]">
                    {item.type.replace('_', ' ')} · {formatDate(item.measuredAt)}
                  </p>
                  <h3 className="my-[0.2rem] mx-0">
                    {item.type === 'weight'
                      ? `${item.numericValue} ${item.unit}`
                      : item.type === 'vet_visit'
                        ? 'Vet visit'
                        : 'Health note'}
                  </h3>
                  {item.note && <p className="text-ink-soft">{item.note}</p>}
                  <SyncBadge state={item.syncState} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No health notes yet"
            text={`Record ${pet?.name || 'your pet'}’s weight, a note, or a vet visit.`}
            action={
              <button
                className="inline-flex items-center bg-transparent text-[#425468] text-[0.82rem] font-extrabold underline underline-offset-3 cursor-pointer py-[0.4rem] px-0 gap-[0.3rem] border-0"
                onClick={show}
              >
                Add the first record
              </button>
            }
          />
        )}
      </section>
      <dialog
        ref={dialog}
        className="w-[min(100%,_620px)] max-h-[calc(100svh_-_1rem)] mt-auto mb-0 rounded-[26px_26px_0_0] bg-cream text-ink shadow-[0_-12px_50px_rgba(20,_35,_59,_0.2)] mx-auto p-0 border-0 backdrop:bg-[rgba(20,_35,_59,_0.48)] backdrop:backdrop-blur-[2px] open:animate-sheet-up tablet:mb-auto tablet:rounded-[26px]"
        onClose={() => setOpen(false)}
      >
        <form
          className="overflow-y-auto max-h-[calc(100svh_-_1rem)] pt-[1.2rem] pb-[calc(1.2rem_+_env(safe-area-inset-bottom))] px-4 tablet:p-6"
          onSubmit={handleSubmit(submit)}
        >
          <header className="flex justify-between items-start mb-[1.1rem]">
            <div>
              <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem]">
                Health history
              </p>
              <h2 className="text-[1.7rem] m-0">Add a record</h2>
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
            <span className="text-[0.78rem] font-extrabold text-[#435066]">Record type</span>
            <select
              className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
              {...register('type')}
            >
              <option value="weight">Weight</option>
              <option value="health_note">Health note</option>
              <option value="vet_visit">Vet visit</option>
            </select>
          </label>
          {type === 'weight' && (
            <div className="grid grid-cols-[1fr_92px] gap-[0.7rem] [@media(width<=370px)]:grid-cols-[1fr_86px] [@media(width<=370px)]:gap-[0.6rem]">
              <label className="grid mb-[0.9rem] gap-[0.4rem]">
                <span className="text-[0.78rem] font-extrabold text-[#435066]">Weight</span>
                <input
                  className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  {...register('numericValue')}
                />
              </label>
              <label className="grid mb-[0.9rem] gap-[0.4rem]">
                <span className="text-[0.78rem] font-extrabold text-[#435066]">Unit</span>
                <select
                  className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
                  {...register('unit')}
                >
                  <option value="kg">kg</option>
                  <option value="lb">lb</option>
                </select>
              </label>
            </div>
          )}
          {errors.numericValue && (
            <p className="mt-[-0.55rem] mb-[0.7rem] text-[#a03d30] text-[0.78rem] font-bold mx-0">
              {errors.numericValue.message}
            </p>
          )}
          <label className="grid mb-[0.9rem] gap-[0.4rem]">
            <span className="text-[0.78rem] font-extrabold text-[#435066]">When</span>
            <input
              className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
              type="datetime-local"
              {...register('measuredAt')}
            />
          </label>
          <label className="grid mb-[0.9rem] gap-[0.4rem]">
            <span className="text-[0.78rem] font-extrabold text-[#435066]">
              Notes <small className="text-[#87909a] font-medium">optional</small>
            </span>
            <textarea
              className="w-full min-h-12.5 rounded-[13px] bg-white text-ink resize-y py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
              rows={4}
              placeholder="Anything worth remembering…"
              {...register('note')}
            />
          </label>
          <button
            className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-sunshine w-full py-[0.6rem] px-4 gap-[0.45rem] border border-[#d1a51a] disabled:opacity-45 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving…' : 'Save health record'}
          </button>
        </form>
      </dialog>
      {open && null}
    </AppShell>
  )
}
