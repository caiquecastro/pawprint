import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { registerServiceWorker } from '../lib/pwa'
import { startSyncService, syncOutbox } from '../lib/sync'

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 1 } } }),
  )

  useEffect(() => {
    const stop = startSyncService()
    let timer: number | undefined
    const refresh = () => {
      void queryClient.invalidateQueries()
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void syncOutbox(), 250)
    }
    window.addEventListener('pawprint:data-changed', refresh)
    void registerServiceWorker()
    return () => {
      stop()
      window.removeEventListener('pawprint:data-changed', refresh)
      window.clearTimeout(timer)
    }
  }, [queryClient])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
