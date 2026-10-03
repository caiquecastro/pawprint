import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Bell, BookOpenText, Check, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { EmptyState } from '../components/EmptyState'
import { JournalComposer } from '../components/JournalComposer'
import { FoodTracker } from '../components/FoodTracker'
import { WalkTracker } from '../components/WalkTracker'
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
  const thisWeek = entries.filter(
    (entry) => Date.now() - new Date(entry.occurredAt).getTime() < 7 * 86_400_000,
  )

  if (!pet)
    return (
      <div className="min-h-svh grid place-content-center justify-items-center text-ink-soft gap-4">
        Opening today’s page…
      </div>
    )

  async function addMood(mood: string) {
    const now = new Date().toISOString()
    await saveJournalEntry(
      {
        id: crypto.randomUUID(),
        petId,
        type: 'mood',
        occurredAt: now,
        title: `${pet?.name} felt ${mood}`,
        body: `A quick daily check-in: ${mood}.`,
        mood,
        createdAt: now,
        updatedAt: now,
      },
      'create',
    )
  }

  return (
    <AppShell petId={petId}>
      <section className="flex items-center pt-[0.4rem] pb-5 px-0 gap-4">
        <div className="relative flex-none w-21.5 h-23.5 overflow-visible rounded-[43%_57%_48%_52%_/_47%_45%_55%_53%] bg-sky shadow-card -rotate-2 border-4 border-cream [@media(width<=370px)]:w-18.5 [@media(width<=370px)]:h-20.5">
          {pet.avatarUrl ? (
            <img
              className="object-cover rounded-[inherit] size-full"
              src={pet.avatarUrl}
              alt={`${pet.name}, ${pet.breed || pet.species}`}
            />
          ) : (
            <span className="grid place-items-center font-serif text-[2.7rem] size-full">
              {pet.name.slice(0, 1)}
            </span>
          )}
          <i
            className="absolute right-[-9px] bottom-2 bg-coral rounded-full size-5.5 border-3 border-paper"
            aria-hidden
          />
        </div>
        <div>
          <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem] last:text-ink-soft last:text-[0.88rem] last:m-0">
            Today with
          </p>
          <h1 className="mt-0 mb-[0.4rem] text-[clamp(2.6rem,_12vw,_4.8rem)] mx-0 [@media(width<=370px)]:text-[2.4rem]">
            {pet.name}
          </h1>
          <p className="last:text-ink-soft last:text-[0.88rem] last:m-0">
            {petAge(pet.birthDate)} <span className="text-coral py-0 px-1">·</span>{' '}
            {daysTogether(pet.createdAt)}
          </p>
        </div>
      </section>

      <button
        className="w-full min-h-18 grid grid-cols-[44px_1fr_auto] grid-rows-[1fr_1fr] items-center gap-y-0 gap-x-[0.85rem] rounded-card bg-sunshine shadow-[0_12px_26px_rgba(160,_119,_0,_0.16)] text-left cursor-pointer py-[0.8rem] px-4 border-0"
        onClick={() => setCompose(true)}
      >
        <span className="row-span-2 row-start-1 grid place-items-center rounded-full bg-ink text-white size-11">
          <Plus size={22} />
        </span>
        <b className="self-end font-serif text-[1.25rem]">Add a moment</b>
        <small className="self-start text-[#5f501a]">Photo, memory, milestone…</small>
        <ArrowRight className="row-span-2 row-start-1 col-start-3" size={20} />
      </button>

      {pet.species === 'dog' && <WalkTracker petId={petId} />}
      <FoodTracker petId={petId} />

      <section className="bg-cream rounded-card shadow-panel mt-4 p-[1.1rem] border border-[rgba(20,_35,_59,_0.08)]">
        <div>
          <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem]">
            Daily check-in
          </p>
          <h2 className="mb-0 text-[1.35rem]">How’s {pet.name} today?</h2>
        </div>
        <div
          className="grid grid-cols-[repeat(4,_1fr)] mt-4 gap-[0.45rem] [@media(width<=370px)]:gap-[0.3rem]"
          aria-label="Choose today’s mood"
        >
          {[
            ['Bright', '☀️'],
            ['Cozy', '🌙'],
            ['Playful', '🎾'],
            ['Off', '🌧️'],
          ].map(([label, emoji]) => (
            <button
              className="min-h-16.5 flex flex-col justify-center items-center rounded-[15px] bg-paper text-[0.68rem] font-bold cursor-pointer gap-[0.2rem] border border-line hover:bg-[#fff7d5] hover:border-sunshine-deep [@media(width<=370px)]:min-h-15.5"
              key={label}
              onClick={() => void addMood(label.toLowerCase())}
            >
              <span className="text-[1.35rem]">{emoji}</span>
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid mt-8 gap-4 tablet:grid-cols-[minmax(0,_1.6fr)_minmax(230px,_0.8fr)] tablet:items-end">
        <section className="mt-8 tablet:mt-0">
          <div className="flex items-end justify-between mb-[0.85rem] gap-4">
            <div>
              <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem]">
                Coming up
              </p>
              <h2 className="m-0">Care</h2>
            </div>
            <Link
              className="inline-flex items-center bg-transparent text-[#425468] text-[0.82rem] font-extrabold underline underline-offset-3 cursor-pointer py-[0.4rem] px-0 gap-[0.3rem] border-0"
              to="/pets/$petId/care"
              params={{ petId }}
            >
              See all <ArrowRight size={15} />
            </Link>
          </div>
          <div className="grid gap-[0.65rem]">
            {upcoming.length ? (
              upcoming.map((reminder) => (
                <article
                  className="bg-cream rounded-card shadow-panel min-h-17.5 grid grid-cols-[40px_1fr_auto] items-center py-[0.7rem] px-[0.9rem] gap-3 border border-[rgba(20,_35,_59,_0.08)]"
                  key={reminder.id}
                >
                  <button
                    className="grid place-items-center rounded-full bg-white cursor-pointer text-transparent p-0 size-8.5 border-2 border-sky hover:text-ink hover:bg-[#e1f1f4]"
                    onClick={() => void completeReminder(reminder.id)}
                    aria-label={`Complete ${reminder.title}`}
                  >
                    <Check size={16} />
                  </button>
                  <div>
                    <h3 className="mt-0 mb-[0.15rem] text-[0.98rem] mx-0">{reminder.title}</h3>
                    <p className="text-ink-soft text-[0.8rem] m-0">
                      {formatDate(reminder.dueAt, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <Bell className="text-coral" size={18} />
                </article>
              ))
            ) : (
              <EmptyState
                title="Nothing due"
                text="Add a care reminder and it’ll appear here."
                action={
                  <Link
                    className="inline-flex items-center bg-transparent text-[#425468] text-[0.82rem] font-extrabold underline underline-offset-3 cursor-pointer py-[0.4rem] px-0 gap-[0.3rem] border-0"
                    to="/pets/$petId/care"
                    params={{ petId }}
                  >
                    Add reminder
                  </Link>
                }
              />
            )}
          </div>
        </section>

        <aside className="bg-ink rounded-card shadow-panel relative overflow-hidden text-white p-[1.2rem] border border-[rgba(20,_35,_59,_0.08)] after:content-[''] after:absolute after:right-[-20px] after:bottom-[-25px] after:rounded-[42%_58%_48%_52%] after:bg-sunshine after:opacity-95 after:size-[105px]">
          <span className="absolute z-1 right-[1.15rem] top-[1.15rem] text-ink">
            <Sparkles size={20} />
          </span>
          <p className="flex items-center mb-[0.45rem] text-[#cbd1da] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem] last:mb-0 last:text-[0.82rem]">
            This week
          </p>
          <strong className="block font-serif text-[3.5rem] leading-[1]">{thisWeek.length}</strong>
          <h3 className="mt-[0.1rem] mb-[0.55rem] font-serif mx-0">moments kept</h3>
          <p className="last:mb-0 last:text-[#cbd1da] last:text-[0.82rem]">
            {upcoming.length} care item{upcoming.length === 1 ? '' : 's'} coming up
          </p>
        </aside>
      </div>

      <section className="mt-8">
        <div className="flex items-end justify-between mb-[0.85rem] gap-4">
          <div>
            <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem]">
              The latest pages
            </p>
            <h2 className="m-0">Recent moments</h2>
          </div>
          <Link
            className="inline-flex items-center bg-transparent text-[#425468] text-[0.82rem] font-extrabold underline underline-offset-3 cursor-pointer py-[0.4rem] px-0 gap-[0.3rem] border-0"
            to="/pets/$petId/journal"
            params={{ petId }}
          >
            Journal <BookOpenText size={15} />
          </Link>
        </div>
        {entries.length ? (
          <div className="relative grid before:content-[''] before:absolute before:top-3 before:bottom-5.5 before:left-[7px] before:w-0.5 before:bg-[repeating-linear-gradient(to_bottom,_var(--color-sky)_0_8px,_transparent_8px_15px)]">
            {entries.slice(0, 4).map((entry) => (
              <Link
                key={entry.id}
                to="/pets/$petId/journal/$entryId"
                params={{ petId, entryId: entry.id }}
                className="relative grid grid-cols-[16px_76px_1fr] min-h-[104px] pt-[0.55rem] pb-[1.1rem] px-0 gap-[0.8rem] not-has-[img]:grid-cols-[16px_1fr]"
              >
                <span
                  className="z-1 mt-1 outline-2 outline-solid outline-coral bg-coral rounded-full size-[15px] border-3 border-paper data-[type=health]:bg-sage data-[type=health]:outline-sage data-[type=milestone]:bg-sunshine data-[type=milestone]:outline-sunshine-deep data-[type=routine]:bg-sky data-[type=routine]:outline-[#5d94a1]"
                  data-type={entry.type}
                  aria-hidden
                />
                {entry.photoUrl && (
                  <img
                    className="object-cover rounded-[16px_16px_13px_13px] size-19"
                    src={entry.photoUrl}
                    alt=""
                  />
                )}
                <div>
                  <p className="flex items-center mb-[0.2rem] text-[#687586] text-[0.7rem] font-extrabold tracking-[0.055em] uppercase gap-[0.38rem]">
                    {entry.type} ·{' '}
                    {formatDate(entry.occurredAt, { month: 'short', day: 'numeric' })}
                  </p>
                  <h3 className="mt-[0.1rem] mb-[0.22rem] font-serif text-[1.16rem] mx-0">
                    {entry.title}
                  </h3>
                  <p className="mb-[0.35rem] line-clamp-2 overflow-hidden text-ink-soft text-[0.86rem]">
                    {entry.body}
                  </p>
                  <SyncBadge state={entry.syncState} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="A blank first page"
            text={`Keep the first small thing you noticed about ${pet.name} today.`}
            action={
              <button
                className="inline-flex items-center bg-transparent text-[#425468] text-[0.82rem] font-extrabold underline underline-offset-3 cursor-pointer py-[0.4rem] px-0 gap-[0.3rem] border-0"
                onClick={() => setCompose(true)}
              >
                Add the first moment
              </button>
            }
          />
        )}
      </section>
      <JournalComposer petId={petId} open={compose} onClose={() => setCompose(false)} />
    </AppShell>
  )
}
