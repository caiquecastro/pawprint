import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Plus, Utensils } from 'lucide-react'
import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { EmptyState } from '../components/EmptyState'
import { FoodComposer } from '../components/FoodComposer'
import { SyncBadge } from '../components/SyncBadge'
import { foodToday, formatPortion, remainingFood } from '../lib/food'
import { formatDate } from '../lib/format'
import { foodQuery, foodSuppliesQuery, petQuery } from '../lib/queries'
import type { FoodEntry, FoodSupply } from '../lib/types'

export const Route = createFileRoute('/pets/$petId/food')({ component: FoodRoute })

function FoodRoute() {
  const { petId } = Route.useParams()
  const pet = useQuery(petQuery(petId)).data
  const entries = useQuery(foodQuery(petId)).data ?? []
  const supplies = useQuery(foodSuppliesQuery(petId)).data ?? []
  const today = foodToday(entries)
  const [composer, setComposer] = useState<
    { kind: 'meal'; entry?: FoodEntry } | { kind: 'supply'; entry?: FoodSupply }
  >()

  return (
    <AppShell petId={petId}>
      <header className="pt-2 pb-6">
        <p className="text-ink-soft text-[0.72rem] font-extrabold tracking-[0.14em] uppercase">
          Everyday nourishment
        </p>
        <h1 className="mt-0 mb-3">Food</h1>
        <p className="text-ink-soft">Meals and food on hand for {pet?.name || 'your pet'}.</p>
        <div className="flex flex-wrap gap-3">
          <button
            className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-sunshine py-2.5 px-4 gap-2 border border-[#d1a51a]"
            onClick={() => setComposer({ kind: 'meal' })}
          >
            <Plus size={18} /> Log meal
          </button>
          <button
            className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-white py-2.5 px-4 gap-2 border border-line"
            onClick={() => setComposer({ kind: 'supply' })}
          >
            <Plus size={18} /> Add supply
          </button>
        </div>
      </header>
      <div className="bg-sunshine rounded-card p-5 mb-8">
        <h2 className="mb-2">
          {today.length} meal{today.length === 1 ? '' : 's'} today
        </h2>
        <p className="text-ink-soft m-0">
          {today.length
            ? `Latest: ${today[0].food} · ${formatPortion(today[0].amount, today[0].unit)}`
            : 'Log a meal to start today’s food record.'}
        </p>
      </div>
      <section className="mb-8">
        <h2>Food supply</h2>
        <p className="text-ink-soft text-[0.85rem]">
          Remaining amounts reflect meals linked to each bag or batch.
        </p>
        {supplies.length ? (
          <div className="grid gap-3 tablet:grid-cols-2">
            {supplies.map((supply) => {
              const remaining = remainingFood(supply, entries)
              const low = remaining <= supply.amount * 0.2
              return (
                <article
                  key={supply.id}
                  className="bg-cream rounded-card shadow-panel p-5 border border-line"
                >
                  <div className="flex justify-between items-start gap-3">
                    <h3 className="font-serif text-[1.2rem] mb-2">{supply.food}</h3>
                    <button
                      className="bg-transparent underline font-bold cursor-pointer min-h-11 border-0"
                      onClick={() => setComposer({ kind: 'supply', entry: supply })}
                      aria-label={`Edit ${supply.food} supply`}
                    >
                      Edit
                    </button>
                  </div>
                  <p className="text-[1.1rem] font-extrabold mb-1">
                    {formatPortion(Math.max(0, remaining), supply.unit)} left
                  </p>
                  <p className="text-ink-soft text-[0.82rem]">
                    Started with {formatPortion(supply.amount, supply.unit)} ·{' '}
                    {formatDate(supply.purchasedAt)}
                  </p>
                  {low && (
                    <p className="text-[#a03d30] font-bold text-[0.82rem]">
                      {remaining < 0
                        ? `${formatPortion(-remaining, supply.unit)} logged beyond this supply. Check the starting amount or meal portions.`
                        : remaining === 0
                          ? 'Time to restock'
                          : 'Running low — 20% or less left'}
                    </p>
                  )}
                  {supply.notes && (
                    <p className="text-ink-soft whitespace-pre-wrap break-words text-[0.85rem]">
                      {supply.notes}
                    </p>
                  )}
                  <SyncBadge state={supply.syncState} />
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title="What’s in the cupboard?"
            text="Add a bag or batch, then link meals to see how much is left."
          />
        )}
      </section>
      <section>
        <h2>Meal history</h2>
        {entries.length ? (
          <div className="grid gap-3">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className="bg-cream rounded-card shadow-panel p-5 border border-line"
              >
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="font-serif text-[1.2rem] mb-2">{entry.food}</h3>
                    <p className="font-bold mb-1">{formatPortion(entry.amount, entry.unit)}</p>
                    <p className="text-ink-soft text-[0.82rem]">
                      {formatDate(entry.fedAt, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <button
                    className="bg-transparent underline font-bold cursor-pointer min-h-11 border-0"
                    onClick={() => setComposer({ kind: 'meal', entry })}
                    aria-label={`Edit ${entry.food} meal`}
                  >
                    Edit
                  </button>
                </div>
                {entry.supplyId && (
                  <p className="text-ink-soft text-[0.82rem]">
                    From{' '}
                    {supplies.find((supply) => supply.id === entry.supplyId)?.food ??
                      'a removed supply'}
                  </p>
                )}
                {entry.notes && (
                  <p className="text-ink-soft whitespace-pre-wrap break-words text-[0.85rem]">
                    {entry.notes}
                  </p>
                )}
                <SyncBadge state={entry.syncState} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="The first bowl"
            text="Keep track of food, portions, feeding times, and appetite notes."
            action={
              <button
                className="inline-flex items-center gap-2 bg-transparent underline font-bold cursor-pointer min-h-11 border-0"
                onClick={() => setComposer({ kind: 'meal' })}
              >
                <Utensils size={16} /> Log the first meal
              </button>
            }
          />
        )}
      </section>
      {composer && (
        <FoodComposer
          key={composer.entry?.id ?? composer.kind}
          {...composer}
          petId={petId}
          supplies={supplies}
          onClose={() => setComposer(undefined)}
        />
      )}
    </AppShell>
  )
}
