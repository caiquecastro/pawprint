import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { foodUnits } from '../lib/food'
import { toLocalInputDate } from '../lib/format'
import { deleteFood, deleteFoodSupply, saveFood, saveFoodSupply } from '../lib/local-db'
import { foodEntrySchema, foodSupplySchema } from '../lib/schemas'
import type { FoodEntry, FoodSupply } from '../lib/types'

const inputClass =
  'w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]'
const labelClass = 'grid mb-[0.9rem] gap-[0.4rem] text-[0.78rem] font-extrabold text-[#435066]'
const buttonClass =
  'min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer py-[0.6rem] px-4 gap-[0.45rem] border disabled:opacity-45 disabled:cursor-not-allowed'

type Props = {
  petId: string
  supplies: FoodSupply[]
  onClose: () => void
} & ({ kind: 'meal'; entry?: FoodEntry } | { kind: 'supply'; entry?: FoodSupply })

export function FoodComposer({ petId, kind, entry, supplies, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const isSupply = kind === 'supply'
  const initialDate = entry ? ('fedAt' in entry ? entry.fedAt : entry.purchasedAt) : undefined
  const initialInputDate = toLocalInputDate(initialDate ? new Date(initialDate) : new Date())
  const [date, setDate] = useState(initialInputDate)
  const [food, setFood] = useState(entry?.food ?? '')
  const [amount, setAmount] = useState(entry?.amount.toString() ?? '')
  const [unit, setUnit] = useState<FoodEntry['unit']>(entry?.unit ?? 'g')
  const [supplyId, setSupplyId] = useState(
    entry && 'supplyId' in entry ? (entry.supplyId ?? '') : '',
  )
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  function chooseSupply(id: string) {
    setSupplyId(id)
    const supply = supplies.find((item) => item.id === id)
    if (supply) {
      setFood(supply.food)
      setUnit(supply.unit)
    }
  }

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const now = new Date().toISOString()
      const occurredAt =
        initialDate && date === initialInputDate ? initialDate : new Date(date).toISOString()
      const common = {
        id: entry?.id ?? crypto.randomUUID(),
        petId,
        food,
        amount: Number(amount),
        unit,
        notes,
        createdAt: entry?.createdAt ?? now,
        updatedAt: now,
      }
      if (isSupply) {
        const result = foodSupplySchema.safeParse({ ...common, purchasedAt: occurredAt })
        if (!result.success)
          throw new Error(result.error.issues[0]?.message ?? 'Check the details.')
        await saveFoodSupply(result.data)
      } else {
        const result = foodEntrySchema.safeParse({
          ...common,
          fedAt: occurredAt,
          supplyId: supplyId || undefined,
        })
        if (!result.success)
          throw new Error(result.error.issues[0]?.message ?? 'Check the details.')
        await saveFood(result.data)
      }
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!entry) return
    setBusy(true)
    setError('')
    try {
      if (isSupply) await deleteFoodSupply(entry.id)
      else await deleteFood(entry.id)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete. Please try again.')
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="w-[min(100%,_620px)] max-h-[calc(100svh_-_1rem)] mt-auto mb-0 rounded-[26px_26px_0_0] bg-cream text-ink shadow-[0_-12px_50px_rgba(20,_35,_59,_0.2)] mx-auto p-0 border-0 backdrop:bg-[rgba(20,_35,_59,_0.48)] backdrop:backdrop-blur-[2px] open:animate-sheet-up tablet:mb-auto tablet:rounded-[26px]"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <form
        className="overflow-y-auto max-h-[calc(100svh_-_1rem)] pt-[1.2rem] pb-[calc(1.2rem_+_env(safe-area-inset-bottom))] px-4 tablet:p-6"
        onSubmit={submit}
      >
        <header className="flex justify-between items-start mb-[1.1rem]">
          <div>
            <p className="text-ink-soft text-[0.72rem] font-extrabold tracking-[0.14em] uppercase">
              Everyday nourishment
            </p>
            <h2 className="text-[1.7rem] m-0" id={titleId}>
              {entry ? 'Edit' : isSupply ? 'Add' : 'Log'} {isSupply ? 'food supply' : 'meal'}
            </h2>
          </div>
          <button
            type="button"
            className="inline-grid place-items-center rounded-full bg-transparent cursor-pointer size-11 border-0 hover:bg-[#e8ecee]"
            aria-label="Close"
            onClick={onClose}
            disabled={busy}
          >
            <X />
          </button>
        </header>
        <fieldset className="min-w-0 m-0 p-0 border-0" disabled={busy}>
          {!isSupply && (
            <label className={labelClass}>
              <span>
                From your supply <small className="font-medium">optional</small>
              </span>
              <select
                className={inputClass}
                value={supplyId}
                onChange={(event) => chooseSupply(event.target.value)}
              >
                <option value="">Meal only — no supply deduction</option>
                {supplyId && !supplies.some((supply) => supply.id === supplyId) && (
                  <option value={supplyId}>Removed supply</option>
                )}
                {supplies.map((supply) => (
                  <option key={supply.id} value={supply.id}>
                    {supply.food} · {new Date(supply.purchasedAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={labelClass}>
            <span>Food name</span>
            <input
              className={inputClass}
              autoFocus
              required
              maxLength={120}
              placeholder="Chicken kibble"
              value={food}
              onChange={(event) => setFood(event.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              <span>{isSupply ? 'Starting amount' : 'Portion fed'}</span>
              <input
                className={inputClass}
                type="number"
                min="0.001"
                max="100000"
                step="any"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <label className={labelClass}>
              <span>Unit</span>
              <select
                className={inputClass}
                value={unit}
                disabled={Boolean(isSupply ? entry : supplyId)}
                onChange={(event) => setUnit(event.target.value as FoodEntry['unit'])}
              >
                {foodUnits.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className={labelClass}>
            <span>{isSupply ? 'Purchased at' : 'Fed at'}</span>
            <input
              className={inputClass}
              type="datetime-local"
              required
              max={toLocalInputDate()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label className={labelClass}>
            <span>
              Notes <small className="font-medium">optional</small>
            </span>
            <textarea
              className={`${inputClass} resize-y font-normal`}
              rows={3}
              maxLength={6000}
              placeholder={
                isSupply
                  ? 'Brand, flavor, or where you bought it…'
                  : 'Appetite, leftovers, or anything you noticed…'
              }
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <p className="text-ink-soft text-[0.82rem]">
            {isSupply
              ? 'Add each new bag separately. Linked meals are deducted from this starting amount.'
              : supplyId
                ? 'This portion is deducted from the selected supply. Editing or deleting the meal updates the balance.'
                : 'Link a supply above to also track how much food is left.'}
          </p>
          {error && (
            <p className="text-[#a03d30] text-[0.85rem] my-3" role="alert">
              {error}
            </p>
          )}
          <button className={`${buttonClass} bg-sunshine w-full border-[#d1a51a]`} disabled={busy}>
            {busy ? 'Saving…' : isSupply ? 'Save supply' : 'Save meal'}
          </button>
          {entry && !confirmDelete && (
            <button
              className="bg-transparent text-[#a03d30] text-[0.82rem] font-extrabold underline cursor-pointer min-h-11 mt-3 border-0"
              type="button"
              onClick={() => setConfirmDelete(true)}
            >
              Delete this {isSupply ? 'supply' : 'meal'}
            </button>
          )}
          {confirmDelete && (
            <div className="rounded-[14px] my-4 p-4 border border-[#e6b6aa]">
              <p>
                {isSupply
                  ? 'Remove this supply? Its logged meals will stay in the history.'
                  : 'Delete this meal? Its portion will be returned to the linked supply.'}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  className={`${buttonClass} bg-white border-line`}
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep it
                </button>
                <button
                  className={`${buttonClass} bg-[#a03d30] text-white border-[#a03d30]`}
                  type="button"
                  onClick={() => void remove()}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </fieldset>
      </form>
    </dialog>
  )
}
