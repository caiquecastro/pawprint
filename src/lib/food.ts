import type { FoodEntry, FoodSupply } from './types'

export const foodUnits: FoodEntry['unit'][] = ['g', 'oz', 'cups', 'servings']

export function formatPortion(amount: number, unit: FoodEntry['unit']) {
  return `${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(amount)} ${unit}`
}

export function foodToday(entries: FoodEntry[], now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return entries.filter((entry) => {
    const fedAt = Date.parse(entry.fedAt)
    return !entry.deletedAt && fedAt >= start && fedAt <= now.getTime()
  })
}

export function remainingFood(supply: FoodSupply, entries: FoodEntry[]) {
  const used = entries
    .filter(
      (entry) => !entry.deletedAt && entry.supplyId === supply.id && entry.unit === supply.unit,
    )
    .reduce((total, entry) => total + entry.amount, 0)
  return supply.amount - used
}
