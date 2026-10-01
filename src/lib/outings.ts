import type { Outing } from './types'

export function outingMinutes(outing: Outing) {
  if (!outing.endedAt || outing.kind !== 'walk') return 0
  return (Date.parse(outing.endedAt) - Date.parse(outing.startedAt)) / 60_000
}

export function elapsedWalk(startedAt: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000))
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export function summarizeOutings(outings: Outing[], now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const week = new Date(today)
  week.setDate(week.getDate() - 6)
  const visible = outings
    .filter((item) => !item.deletedAt && Date.parse(item.startedAt) <= now.getTime())
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const completed = visible.filter(
    (item) => item.kind === 'walk' && item.endedAt && Date.parse(item.endedAt) <= now.getTime(),
  )
  const todayWalks = completed.filter((item) => Date.parse(item.startedAt) >= today.getTime())
  const weekWalks = completed.filter((item) => Date.parse(item.startedAt) >= week.getTime())

  return {
    todayCount: todayWalks.length,
    todayMinutes: Math.round(todayWalks.reduce((total, item) => total + outingMinutes(item), 0)),
    weekCount: weekWalks.length,
    weekMinutes: Math.round(weekWalks.reduce((total, item) => total + outingMinutes(item), 0)),
    lastWalk: completed[0],
    lastPee: visible.find((item) => (item.peeCount ?? 0) > 0),
    lastPoop: visible.find((item) => (item.poopCount ?? 0) > 0),
  }
}
