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

export function JournalComposer({
  petId,
  open,
  onClose,
  entry,
}: {
  petId: string
  open: boolean
  onClose: () => void
  entry?: JournalEntry
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [photo, setPhoto] = useState<File>()
  const [preview, setPreview] = useState(entry?.photoUrl)
  const [photoError, setPhotoError] = useState<string>()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValue>({
    resolver: zodResolver(journalEntrySchema),
    defaultValues: entry
      ? {
          type: entry.type,
          occurredAt: entry.occurredAt.slice(0, 16),
          title: entry.title,
          body: entry.body,
          mood: entry.mood,
        }
      : { type: 'memory', occurredAt: toLocalInputDate(), title: '', body: '', mood: '' },
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
    await saveJournalEntry(
      {
        id,
        petId,
        type: parsed.type,
        occurredAt: new Date(parsed.occurredAt).toISOString(),
        title: parsed.title,
        body: parsed.body,
        mood: parsed.mood || undefined,
        photoUrl,
        createdAt: entry?.createdAt ?? now,
        updatedAt: now,
      },
      entry ? 'update' : 'create',
    )
    if (photo)
      await saveMedia({
        id: crypto.randomUUID(),
        petId,
        journalEntryId: id,
        mimeType: photo.type,
        blob: photo,
        localUrl: photoUrl,
        createdAt: now,
        syncState: 'pending',
      })
    reset()
    onClose()
  }

  return (
    <dialog
      ref={dialog}
      className="w-[min(100%,_620px)] max-h-[calc(100svh_-_1rem)] mt-auto mb-0 rounded-[26px_26px_0_0] bg-cream text-ink shadow-[0_-12px_50px_rgba(20,_35,_59,_0.2)] mx-auto p-0 border-0 backdrop:bg-[rgba(20,_35,_59,_0.48)] backdrop:backdrop-blur-[2px] open:animate-sheet-up tablet:mb-auto tablet:rounded-[26px]"
      onClose={onClose}
      onCancel={onClose}
    >
      <form
        className="overflow-y-auto max-h-[calc(100svh_-_1rem)] pt-[1.2rem] pb-[calc(1.2rem_+_env(safe-area-inset-bottom))] px-4 tablet:p-6"
        onSubmit={handleSubmit(submit)}
      >
        <header className="flex justify-between items-start mb-[1.1rem]">
          <div>
            <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem]">
              Life book
            </p>
            <h2 className="text-[1.7rem] m-0">{entry ? 'Edit this moment' : 'Add a moment'}</h2>
          </div>
          <button
            type="button"
            className="inline-grid place-items-center rounded-full bg-transparent cursor-pointer p-0 size-11 border-0 hover:bg-[#e8ecee]"
            onClick={onClose}
            aria-label="Close"
          >
            <X />
          </button>
        </header>
        <label className="grid mb-[0.9rem] gap-[0.4rem]">
          <span className="text-[0.78rem] font-extrabold text-[#435066]">Kind of moment</span>
          <select
            className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
            {...register('type')}
          >
            <option value="memory">Memory</option>
            <option value="milestone">Milestone</option>
            <option value="routine">Routine</option>
            <option value="health">Health</option>
            <option value="mood">Mood</option>
          </select>
        </label>
        <label className="grid mb-[0.9rem] gap-[0.4rem]">
          <span className="text-[0.78rem] font-extrabold text-[#435066]">When</span>
          <input
            className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
            type="datetime-local"
            {...register('occurredAt')}
          />
        </label>
        {errors.occurredAt && (
          <p className="mt-[-0.55rem] mb-[0.7rem] text-[#a03d30] text-[0.78rem] font-bold mx-0">
            {errors.occurredAt.message}
          </p>
        )}
        <label className="grid mb-[0.9rem] gap-[0.4rem]">
          <span className="text-[0.78rem] font-extrabold text-[#435066]">Title</span>
          <input
            className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
            autoFocus
            placeholder="The day the garden won"
            {...register('title')}
          />
        </label>
        {errors.title && (
          <p className="mt-[-0.55rem] mb-[0.7rem] text-[#a03d30] text-[0.78rem] font-bold mx-0">
            {errors.title.message}
          </p>
        )}
        <label className="grid mb-[0.9rem] gap-[0.4rem]">
          <span className="text-[0.78rem] font-extrabold text-[#435066]">What happened?</span>
          <textarea
            className="w-full min-h-12.5 rounded-[13px] bg-white text-ink resize-y py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
            rows={5}
            placeholder="Capture the detail you never want to lose…"
            {...register('body')}
          />
        </label>
        {errors.body && (
          <p className="mt-[-0.55rem] mb-[0.7rem] text-[#a03d30] text-[0.78rem] font-bold mx-0">
            {errors.body.message}
          </p>
        )}
        <label className="grid mb-[0.9rem] gap-[0.4rem]">
          <span className="text-[0.78rem] font-extrabold text-[#435066]">
            Mood <small className="text-[#87909a] font-medium">optional</small>
          </span>
          <input
            className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
            placeholder="Sleepy, bright-eyed, curious…"
            {...register('mood')}
          />
        </label>
        <label className="min-h-12 flex items-center justify-center mb-[0.8rem] rounded-[14px] cursor-pointer gap-[0.45rem] border border-[#9ba8b0] border-dashed">
          <input
            className="absolute opacity-0 size-px"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            capture="environment"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              const error = validatePhoto(file)
              setPhotoError(error ?? undefined)
              if (!error) {
                setPhoto(file)
                setPreview(await readFile(file))
              }
            }}
          />
          <Camera size={18} /> {preview ? 'Change photo' : 'Attach a photo'}
        </label>
        {photoError && (
          <p
            className="mt-[-0.55rem] mb-[0.7rem] text-[#a03d30] text-[0.78rem] font-bold mx-0"
            role="alert"
          >
            {photoError}
          </p>
        )}
        {preview && (
          <img
            className="w-full max-h-[220px] mb-4 object-cover rounded-[16px]"
            src={preview}
            alt="Moment attachment preview"
          />
        )}
        <button
          className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-sunshine w-full py-[0.6rem] px-4 gap-[0.45rem] border border-[#d1a51a] disabled:opacity-45 disabled:cursor-not-allowed"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving…' : entry ? 'Save changes' : 'Keep this moment'}
        </button>
      </form>
    </dialog>
  )
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
