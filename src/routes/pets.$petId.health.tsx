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
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormValue>({ resolver: zodResolver(measurementSchema), defaultValues: { type: 'weight', measuredAt: toLocalInputDate(), unit: pet?.weightUnit ?? 'kg' } })
  const type = watch('type')
  const show = () => { setOpen(true); dialog.current?.showModal() }
  const close = () => { setOpen(false); dialog.current?.close() }

  async function submit(values: FormValue) {
    const parsed = measurementSchema.parse(values); const now = new Date().toISOString()
    await saveMeasurement({ id: crypto.randomUUID(), petId, type: parsed.type, numericValue: parsed.numericValue === '' ? undefined : parsed.numericValue, unit: parsed.unit || undefined, measuredAt: new Date(parsed.measuredAt).toISOString(), note: parsed.note || undefined, createdAt: now, updatedAt: now })
    reset({ type: 'weight', measuredAt: toLocalInputDate(), unit: pet?.weightUnit ?? 'kg' }); close()
  }

  return (
    <AppShell petId={petId}>
      <header className="page-heading"><div><p className="eyebrow">A gentle record, not advice</p><h1>Health</h1><p>Keep useful details together for you and your vet.</p></div><button className="small-add" onClick={show}><Plus size={18} /> Record</button></header>
      <div className="health-summary card"><span><Scale /></span><div><p>Latest weight</p><strong>{latestWeight?.numericValue ?? pet?.currentWeight ?? '—'} <small>{latestWeight?.unit ?? pet?.weightUnit}</small></strong><p>{latestWeight ? formatDate(latestWeight.measuredAt) : 'No measurement yet'}</p></div></div>
      <section className="section-block"><div className="section-heading"><div><p className="eyebrow">In order</p><h2>Health history</h2></div></div>
        {history.length ? <div className="history-list">{history.map((item) => <article className="history-row" key={item.id}><span>{item.type === 'weight' ? <Scale /> : item.type === 'vet_visit' ? <Stethoscope /> : <HeartPulse />}</span><div><p className="entry-meta">{item.type.replace('_', ' ')} · {formatDate(item.measuredAt)}</p><h3>{item.type === 'weight' ? `${item.numericValue} ${item.unit}` : item.type === 'vet_visit' ? 'Vet visit' : 'Health note'}</h3>{item.note && <p>{item.note}</p>}<SyncBadge state={item.syncState} /></div></article>)}</div> : <EmptyState title="No health notes yet" text={`Record ${pet?.name || 'your pet'}’s weight, a note, or a vet visit.`} action={<button className="text-link" onClick={show}>Add the first record</button>} />}
      </section>
      <dialog ref={dialog} className="sheet-dialog" onClose={() => setOpen(false)}><form className="composer" onSubmit={handleSubmit(submit)}><header><div><p className="eyebrow">Health history</p><h2>Add a record</h2></div><button type="button" className="icon-button" onClick={close}><X /></button></header>
        <label className="field"><span>Record type</span><select {...register('type')}><option value="weight">Weight</option><option value="health_note">Health note</option><option value="vet_visit">Vet visit</option></select></label>
        {type === 'weight' && <div className="field-pair weight-pair"><label className="field"><span>Weight</span><input type="number" step="0.1" inputMode="decimal" {...register('numericValue')} /></label><label className="field"><span>Unit</span><select {...register('unit')}><option value="kg">kg</option><option value="lb">lb</option></select></label></div>}
        {errors.numericValue && <p className="field-error">{errors.numericValue.message}</p>}
        <label className="field"><span>When</span><input type="datetime-local" {...register('measuredAt')} /></label>
        <label className="field"><span>Notes <small>optional</small></span><textarea rows={4} placeholder="Anything worth remembering…" {...register('note')} /></label>
        <button className="primary-button full" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save health record'}</button>
      </form></dialog>
      {open && null}
    </AppShell>
  )
}
