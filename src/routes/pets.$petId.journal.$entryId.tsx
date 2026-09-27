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
  if (!entry) return <div className="launch-screen">Opening this page…</div>
  return (
    <AppShell petId={petId}>
      <div className="detail-toolbar"><Link to="/pets/$petId/journal" params={{ petId }}><ArrowLeft size={19} /> Journal</Link><div><button className="icon-button" onClick={() => setEditing(true)} aria-label="Edit moment"><Pencil size={18} /></button><button className="icon-button danger" onClick={() => setConfirming(true)} aria-label="Delete moment"><Trash2 size={18} /></button></div></div>
      <article className="entry-detail">
        {entry.photoUrl && <img className="entry-photo" src={entry.photoUrl} alt={`Photo for ${entry.title}`} />}
        <p className="entry-meta"><span className={`type-dot ${entry.type}`} />{entry.type} · {formatDate(entry.occurredAt, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        <h1>{entry.title}</h1>
        {entry.mood && <p className="mood-label">Felt {entry.mood}</p>}
        <p className="entry-body">{entry.body}</p>
        <SyncBadge state={entry.syncState} />
      </article>
      {confirming && <div className="confirm-backdrop" role="presentation"><div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">Remove this moment?</h2><p>It will disappear from the journal and sync the deletion when you’re online.</p><div><button className="secondary-button" onClick={() => setConfirming(false)}>Keep it</button><button className="danger-button" onClick={async () => { await deleteJournalEntry(entry.id); await navigate({ to: '/pets/$petId/journal', params: { petId } }) }}>Remove</button></div></div></div>}
      <JournalComposer petId={petId} open={editing} onClose={() => setEditing(false)} entry={entry} />
    </AppShell>
  )
}
