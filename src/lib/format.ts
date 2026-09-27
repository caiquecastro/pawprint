export function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en', options ?? { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

export function toLocalInputDate(value = new Date()) {
  const offset = value.getTimezoneOffset()
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

export function petAge(birthDate?: string) {
  if (!birthDate) return 'Age not set'
  const born = new Date(birthDate)
  const now = new Date()
  const months = Math.max(0, (now.getFullYear() - born.getFullYear()) * 12 + now.getMonth() - born.getMonth())
  return months < 24 ? `${months} month${months === 1 ? '' : 's'} old` : `${Math.floor(months / 12)} years old`
}

export function daysTogether(createdAt: string) {
  const days = Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000) + 1)
  return `${days} day${days === 1 ? '' : 's'} together here`
}
