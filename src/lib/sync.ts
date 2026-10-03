import {
  applySyncSnapshot,
  listOutbox,
  listUnsyncedMedia,
  updateMediaUpload,
  updateSyncResult,
} from './local-db'
import type { SyncSnapshot } from './types'

let syncing: Promise<void> | null = null

export function syncOutbox(force = false) {
  if (syncing) return syncing
  syncing = runSync(force).finally(() => {
    syncing = null
  })
  return syncing
}

async function runSync(force: boolean) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  const attempted = new Set<string>()
  while (true) {
    const items = (await listOutbox()).filter(
      (item) =>
        (force || item.status !== 'failed') &&
        !attempted.has(`${item.id}:${item.revision ?? 'legacy'}`),
    )
    if (items.length === 0) break
    for (const item of items) {
      attempted.add(`${item.id}:${item.revision ?? 'legacy'}`)
      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(item),
        })
        if (!response.ok) {
          const details = (await response
            .json()
            .catch(() => ({ message: 'Sync is temporarily unavailable.' }))) as { message?: string }
          throw new Error(details.message || 'Sync is temporarily unavailable.')
        }
        await updateSyncResult(item, true)
      } catch (error) {
        await updateSyncResult(item, false, error instanceof Error ? error.message : 'Sync failed.')
      }
    }
  }
  await syncMedia(force)
  await pullSnapshot()
}

async function syncMedia(force: boolean) {
  const media = await listUnsyncedMedia()
  for (const item of media) {
    if (item.syncState === 'failed' && !force) continue
    if (!item.blob) continue
    try {
      await updateMediaUpload(item.id, { syncState: 'pending', progress: 15, error: undefined })
      const form = new FormData()
      form.append('file', item.blob, `${item.id}.${item.mimeType.split('/')[1] || 'jpg'}`)
      form.append('mediaId', item.id)
      form.append('petId', item.petId)
      if (item.journalEntryId) form.append('journalEntryId', item.journalEntryId)
      const response = await fetch('/api/uploads', { method: 'POST', body: form })
      await updateMediaUpload(item.id, { progress: 75 })
      const result = (await response.json().catch(() => ({}))) as {
        message?: string
        objectKey?: string
        url?: string
      }
      if (!response.ok) throw new Error(result.message || 'Photo upload failed.')
      await updateMediaUpload(item.id, {
        syncState: 'synced',
        progress: 100,
        objectKey: result.objectKey,
        localUrl: result.url ?? item.localUrl,
      })
    } catch (error) {
      await updateMediaUpload(item.id, {
        syncState: 'failed',
        error: error instanceof Error ? error.message : 'Photo upload failed.',
        progress: 0,
      })
    }
  }
}

async function pullSnapshot() {
  try {
    const response = await fetch('/api/sync', { method: 'GET' })
    if (!response.ok) {
      const details = (await response
        .json()
        .catch(() => ({ message: 'Cloud records could not be downloaded.' }))) as {
        message?: string
      }
      throw new Error(details.message || 'Cloud records could not be downloaded.')
    }

    await applySyncSnapshot((await response.json()) as SyncSnapshot)
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'sync_pull_failed',
        message: error instanceof Error ? error.message : 'unknown',
      }),
    )
  }
}

export function startSyncService() {
  if (typeof window === 'undefined') return () => undefined
  const onOnline = () => void syncOutbox()
  window.addEventListener('online', onOnline)
  void syncOutbox()
  return () => window.removeEventListener('online', onOnline)
}
