import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { saveJournalEntry, saveMedia } from '../lib/local-db'
import { journalEntrySchema, validatePhoto } from '../lib/schemas'
import { toLocalInputDate } from '../lib/format'
import type { JournalEntry } from '../lib/types'

type FormValue = z.input<typeof journalEntrySchema>

export function JournalComposer({ petId, open, onClose, entry }: { petId: string; open: boolean; onClose: () => void; entry?: JournalEntry }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [photo, setPhoto] = useState<File>()
  const [preview, setPreview] = useState(entry?.photoUrl)
  const [photoError, setPhotoError] = useState<string>()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValue>({
    resolver: zodResolver(journalEntrySchema),
    defaultValues: entry ? { type: entry.type, occurredAt: entry.occurredAt.slice(0, 16), title: entry.title, body: entry.body, mood: entry.mood } : { type: 'memory', occurredAt: toLocalInputDate(), title: '', body: '', mood: '' },
  })

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    if (!open && dialog.current?.open) dialog.current?.close()
  }, [open])

  async function submit(values: FormValue) {
    const parsed = journalEntrySchema.parse(values)
    const now = new Date().toISOString()
    const id = entry?.id ?? crypto.randomUUID()
    let photoUrl = preview
    if (photo) photoUrl = await readFile(photo)
    await saveJournalEntry({
      id, petId, type: parsed.type, occurredAt: new Date(parsed.occurredAt).toISOString(), title: parsed.title,
      body: parsed.body, mood: parsed.mood || undefined, photoUrl, createdAt: entry?.createdAt ?? now, updatedAt: now,
    }, entry ? 'update' : 'create')
    if (photo) await saveMedia({ id: crypto.randomUUID(), petId, journalEntryId: id, mimeType: photo.type, blob: photo, localUrl: photoUrl, createdAt: now, syncState: 'pending' })
    reset()
    onClose()
  }

  return (
    <dialog ref={dialog} className="sheet-dialog" onClose={onClose} onCancel={onClose}>
      <form className="composer" onSubmit={handleSubmit(submit)}>
        <header><div><p className="eyebrow">Life book</p><h2>{entry ? 'Edit this moment' : 'Add a moment'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X /></button></header>
        <label className="field"><span>Kind of moment</span><select {...register('type')}><option value="memory">Memory</option><option value="milestone">Milestone</option><option value="routine">Routine</option><option value="health">Health</option><option value="mood">Mood</option></select></label>
        <label className="field"><span>When</span><input type="datetime-local" {...register('occurredAt')} /></label>
        {errors.occurredAt && <p className="field-error">{errors.occurredAt.message}</p>}
        <label className="field"><span>Title</span><input autoFocus placeholder="The day the garden won" {...register('title')} /></label>
        {errors.title && <p className="field-error">{errors.title.message}</p>}
        <label className="field"><span>What happened?</span><textarea rows={5} placeholder="Capture the detail you never want to lose…" {...register('body')} /></label>
        {errors.body && <p className="field-error">{errors.body.message}</p>}
        <label className="field"><span>Mood <small>optional</small></span><input placeholder="Sleepy, bright-eyed, curious…" {...register('mood')} /></label>
        <label className="upload-button"><input type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" onChange={async (event) => {
          const file = event.target.files?.[0]
          if (!file) return
          const error = validatePhoto(file); setPhotoError(error ?? undefined)
          if (!error) { setPhoto(file); setPreview(await readFile(file)) }
        }} /><Camera size={18} /> {preview ? 'Change photo' : 'Attach a photo'}</label>
        {photoError && <p className="field-error" role="alert">{photoError}</p>}
        {preview && <img className="composer-preview" src={preview} alt="Moment attachment preview" />}
        <button className="primary-button full" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : entry ? 'Save changes' : 'Keep this moment'}</button>
      </form>
    </dialog>
  )
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file)
  })
}
