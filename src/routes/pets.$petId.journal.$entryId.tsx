import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { JournalComposer } from '../components/JournalComposer'
import { SyncBadge } from '../components/SyncBadge'
import { formatDate } from '../lib/format'
import { deleteJournalEntry } from '../lib/local-db'
import { journalEntryQuery } from '../lib/queries'

export const Route = createFileRoute('/pets/$petId/journal/$entryId')({ component: JournalDetail })

function JournalDetail() {
  const { petId, entryId } = Route.useParams()
  const navigate = useNavigate()
  const entry = useQuery(journalEntryQuery(entryId)).data
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  if (!entry)
    return (
      <div className="min-h-svh grid place-content-center justify-items-center text-ink-soft gap-4">
        Opening this page…
      </div>
    )
  return (
    <AppShell petId={petId}>
      <div className="min-h-12.5 flex justify-between items-center">
        <Link
          className="flex items-center font-extrabold gap-[0.4rem]"
          to="/pets/$petId/journal"
          params={{ petId }}
        >
          <ArrowLeft size={19} /> Journal
        </Link>
        <div className="flex items-center gap-2">
          <button
            className="inline-grid place-items-center rounded-full bg-transparent cursor-pointer p-0 size-11 border-0 hover:bg-[#e8ecee]"
            onClick={() => setEditing(true)}
            aria-label="Edit moment"
          >
            <Pencil size={18} />
          </button>
          <button
            className="inline-grid place-items-center rounded-full bg-transparent cursor-pointer text-[#a03d30] p-0 size-11 border-0 hover:bg-[#e8ecee]"
            onClick={() => setConfirming(true)}
            aria-label="Delete moment"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      <article className="w-[min(100%,_720px)] my-4 mx-auto">
        {entry.photoUrl && (
          <img
            className="w-full max-h-[55vh] object-cover rounded-[26px_26px_20px_20px] mb-[1.4rem]"
            src={entry.photoUrl}
            alt={entry.title}
          />
        )}
        <p className="flex items-center mb-[0.2rem] text-[#687586] text-[0.7rem] font-extrabold tracking-[0.055em] uppercase gap-[0.38rem]">
          <span
            className="data-[type=health]:bg-sage data-[type=health]:outline-sage data-[type=milestone]:bg-sunshine data-[type=milestone]:outline-sunshine-deep data-[type=routine]:bg-sky data-[type=routine]:outline-[#5d94a1] rounded-full bg-coral outline-0 size-[9px]"
            data-type={entry.type}
          />
          {entry.type} ·{' '}
          {formatDate(entry.occurredAt, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
        <h1 className="mt-[0.8rem] mb-4 mx-0">{entry.title}</h1>
        {entry.mood && (
          <p className="inline-block rounded-full bg-[#fff2c2] text-[0.8rem] py-[0.35rem] px-[0.7rem]">
            Felt {entry.mood}
          </p>
        )}
        <p className="whitespace-pre-wrap font-serif text-[1.12rem] leading-[1.8]">{entry.body}</p>
        <SyncBadge state={entry.syncState} />
      </article>
      {confirming && (
        <div
          className="fixed z-80 inset-0 grid place-items-center bg-[rgba(20,_35,_59,_0.52)] p-4"
          role="presentation"
        >
          <div
            className="w-[min(100%,_420px)] rounded-[22px] bg-white shadow-card p-[1.3rem]"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 className="mb-2" id="delete-title">
              Remove this moment?
            </h2>
            <p className="text-ink-soft">
              It will disappear from the journal and sync the deletion when you’re online.
            </p>
            <div className="flex justify-end gap-[0.6rem]">
              <button
                className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-white py-[0.6rem] px-4 gap-[0.45rem] border border-line"
                onClick={() => setConfirming(false)}
              >
                Keep it
              </button>
              <button
                className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-[#a03d30] text-white py-[0.6rem] px-4 gap-[0.45rem] border border-[#a03d30]"
                onClick={async () => {
                  await deleteJournalEntry(entry.id)
                  await navigate({ to: '/pets/$petId/journal', params: { petId } })
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
      <JournalComposer
        petId={petId}
        open={editing}
        onClose={() => setEditing(false)}
        entry={entry}
      />
    </AppShell>
  )
}
