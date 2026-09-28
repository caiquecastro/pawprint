import { AlertTriangle, Check, CloudUpload } from 'lucide-react'
import type { SyncState } from '../lib/types'

export function SyncBadge({ state }: { state?: SyncState }) {
  if (!state || state === 'synced')
    return (
      <span className="sync-badge synced">
        <Check size={12} /> Saved
      </span>
    )
  if (state === 'failed')
    return (
      <span className="sync-badge failed">
        <AlertTriangle size={12} /> Retry needed
      </span>
    )
  return (
    <span className="sync-badge">
      <CloudUpload size={12} /> Waiting to sync
    </span>
  )
}
