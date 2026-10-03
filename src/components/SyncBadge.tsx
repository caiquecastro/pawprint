import { AlertTriangle, Check, CloudUpload } from 'lucide-react'
import type { SyncState } from '../lib/types'

export function SyncBadge({ state, className = '' }: { state?: SyncState; className?: string }) {
  if (!state || state === 'synced')
    return (
      <span
        className={`inline-flex items-center text-[#4d7058] text-[0.68rem] font-bold gap-1 ${className}`}
      >
        <Check size={12} /> Saved
      </span>
    )
  if (state === 'failed')
    return (
      <span
        className={`inline-flex items-center text-[#a03d30] text-[0.68rem] font-bold gap-1 ${className}`}
      >
        <AlertTriangle size={12} /> Retry needed
      </span>
    )
  return (
    <span
      className={`inline-flex items-center text-[#826407] text-[0.68rem] font-bold gap-1 ${className}`}
    >
      <CloudUpload size={12} /> Waiting to sync
    </span>
  )
}
