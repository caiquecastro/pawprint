import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Bell, BookOpenText, Check, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { EmptyState } from '../components/EmptyState'
import { JournalComposer } from '../components/JournalComposer'
import { SyncBadge } from '../components/SyncBadge'
import { daysTogether, formatDate, petAge } from '../lib/format'
import { completeReminder, saveJournalEntry } from '../lib/local-db'
import { journalQuery, petQuery, remindersQuery } from '../lib/queries'

export const Route = createFileRoute('/pets/$petId/')({ component: TodayRoute })

function TodayRoute() {
  const { petId } = Route.useParams()
  const [compose, setCompose] = useState(false)
  const pet = useQuery(petQuery(petId)).data
  const entries = useQuery(journalQuery(petId)).data ?? []
  const reminders = useQuery(remindersQuery(petId)).data ?? []
  const upcoming = reminders.filter((item) => !item.completedAt).slice(0, 3)
  const thisWeek = entries.filter((entry) => Date.now() - new Date(entry.occurredAt).getTime() < 7 * 86_400_000)

  if (!pet) return <div className="launch-screen">Opening today’s page…</div>

  async function addMood(mood: string) {
    const now = new Date().toISOString()
    await saveJournalEntry({ id: crypto.randomUUID(), petId, type: 'mood', occurredAt: now, title: `${pet?.name} felt ${mood}`, body: `A quick daily check-in: ${mood}.`, mood, createdAt: now, updatedAt: now }, 'create')
  }

  return (
    <AppShell petId={petId}>
      <section className="pet-hero">
        <div className="pet-avatar">{pet.avatarUrl ? <img src={pet.avatarUrl} alt={`${pet.name}, ${pet.breed || pet.species}`} /> : <span>{pet.name.slice(0, 1)}</span>}<i aria-hidden /></div>
        <div><p className="eyebrow">Today with</p><h1>{pet.name}</h1><p>{petAge(pet.birthDate)} <span>·</span> {daysTogether(pet.createdAt)}</p></div>
      </section>

      <button className="hero-action" onClick={() => setCompose(true)}><span><Plus size={22} /></span><b>Add a moment</b><small>Photo, memory, milestone…</small><ArrowRight size={20} /></button>

      <section className="mood-card card">
        <div><p className="eyebrow">Daily check-in</p><h2>How’s {pet.name} today?</h2></div>
        <div className="mood-row" aria-label="Choose today’s mood">
          {[['Bright', '☀️'], ['Cozy', '🌙'], ['Playful', '🎾'], ['Off', '🌧️']].map(([label, emoji]) => <button key={label} onClick={() => void addMood(label.toLowerCase())}><span>{emoji}</span>{label}</button>)}
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="section-block">
          <div className="section-heading"><div><p className="eyebrow">Coming up</p><h2>Care</h2></div><Link to="/pets/$petId/care" params={{ petId }}>See all <ArrowRight size={15} /></Link></div>
          <div className="stack">
            {upcoming.length ? upcoming.map((reminder) => (
              <article className="reminder-row card" key={reminder.id}>
                <button className="round-check" onClick={() => void completeReminder(reminder.id)} aria-label={`Complete ${reminder.title}`}><Check size={16} /></button>
                <div><h3>{reminder.title}</h3><p>{formatDate(reminder.dueAt, { weekday: 'short', month: 'short', day: 'numeric' })}</p></div>
                <Bell size={18} />
              </article>
            )) : <EmptyState title="Nothing due" text="Add a care reminder and it’ll appear here." action={<Link className="text-link" to="/pets/$petId/care" params={{ petId }}>Add reminder</Link>} />}
          </div>
        </section>

        <aside className="week-card card">
          <span className="week-icon"><Sparkles size={20} /></span><p className="eyebrow">This week</p><strong>{thisWeek.length}</strong><h3>moments kept</h3><p>{upcoming.length} care item{upcoming.length === 1 ? '' : 's'} coming up</p>
        </aside>
      </div>

      <section className="section-block journal-preview">
        <div className="section-heading"><div><p className="eyebrow">The latest pages</p><h2>Recent moments</h2></div><Link to="/pets/$petId/journal" params={{ petId }}>Journal <BookOpenText size={15} /></Link></div>
        {entries.length ? <div className="timeline">
          {entries.slice(0, 4).map((entry) => <Link key={entry.id} to="/pets/$petId/journal/$entryId" params={{ petId, entryId: entry.id }} className="timeline-entry">
            <span className={`timeline-dot ${entry.type}`} aria-hidden />
            {entry.photoUrl && <img src={entry.photoUrl} alt="" />}
            <div><p className="entry-meta">{entry.type} · {formatDate(entry.occurredAt, { month: 'short', day: 'numeric' })}</p><h3>{entry.title}</h3><p className="clamp">{entry.body}</p><SyncBadge state={entry.syncState} /></div>
          </Link>)}
        </div> : <EmptyState title="A blank first page" text={`Keep the first small thing you noticed about ${pet.name} today.`} action={<button className="text-link" onClick={() => setCompose(true)}>Add the first moment</button>} />}
      </section>
      <JournalComposer petId={petId} open={compose} onClose={() => setCompose(false)} />
    </AppShell>
  )
}
