import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Plus, Utensils } from 'lucide-react'
import { useState } from 'react'
import { foodToday, formatPortion, remainingFood } from '../lib/food'
import { formatDate } from '../lib/format'
import { foodQuery, foodSuppliesQuery } from '../lib/queries'
import { FoodComposer } from './FoodComposer'

export function FoodTracker({ petId }: { petId: string }) {
  const entries = useQuery(foodQuery(petId)).data ?? []
  const supplies = useQuery(foodSuppliesQuery(petId)).data ?? []
  const today = foodToday(entries)
  const last = entries.find((entry) => Date.parse(entry.fedAt) <= Date.now())
  const lowSupplies = supplies.filter(
    (supply) => remainingFood(supply, entries) <= supply.amount * 0.2,
  )
  const [compose, setCompose] = useState(false)

  return (
    <section className="bg-cream rounded-card shadow-panel mt-4 p-5 border border-line">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="flex items-center gap-2 m-0 text-[1.35rem]">
          <Utensils size={20} /> Food
        </h2>
        <Link
          className="underline text-[0.82rem] font-extrabold min-h-11 inline-flex items-center"
          to="/pets/$petId/food"
          params={{ petId }}
        >
          Meals & supply
        </Link>
      </div>
      <p className="font-bold mb-1">
        {today.length} meal{today.length === 1 ? '' : 's'} today
      </p>
      <p className="text-ink-soft text-[0.85rem]">
        {last
          ? `Last fed: ${last.food} · ${formatPortion(last.amount, last.unit)} · ${formatDate(last.fedAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
          : 'Keep a record of each bowl and little treat.'}
      </p>
      {lowSupplies.length > 0 && (
        <p className="text-[#a03d30] text-[0.82rem] font-bold">
          {lowSupplies.length} food supply {lowSupplies.length === 1 ? 'is' : 'items are'} running
          low.
        </p>
      )}
      <button
        className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-sunshine py-2.5 px-4 gap-2 border border-[#d1a51a]"
        onClick={() => setCompose(true)}
      >
        <Plus size={18} /> Log meal
      </button>
      {compose && (
        <FoodComposer
          kind="meal"
          petId={petId}
          supplies={supplies}
          onClose={() => setCompose(false)}
        />
      )}
    </section>
  )
}
