import { useAuth } from '@clerk/tanstack-react-start'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { PawPrint } from 'lucide-react'
import { useEffect, useState } from 'react'
import { clearLocalOwner, configureLocalOwner } from '../lib/local-db'
import { registerServiceWorker } from '../lib/pwa'
import { startSyncService, syncOutbox } from '../lib/sync'

const LAST_OWNER_KEY = 'pawprint:last-owner'

export function AppProviders({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (state) => state.location.pathname })
  const { isLoaded, isSignedIn, userId } = useAuth()
  const [localOwner, setLocalOwner] = useState<string>()
  const publicRoute = path.startsWith('/sign-in')

  useEffect(() => {
    void registerServiceWorker()
  }, [])

  useEffect(() => {
    if (publicRoute) {
      if (isLoaded && !isSignedIn) {
        clearLocalOwner()
        localStorage.removeItem(LAST_OWNER_KEY)
        setLocalOwner(undefined)
      }
      return
    }
    let cancelled = false
    const initialize = async (ownerId: string) => {
      await configureLocalOwner(ownerId)
      if (!cancelled) setLocalOwner(ownerId)
    }

    if (isLoaded && isSignedIn && userId) {
      localStorage.setItem(LAST_OWNER_KEY, userId)
      void initialize(userId)
    } else if (isLoaded) {
      clearLocalOwner()
      localStorage.removeItem(LAST_OWNER_KEY)
      setLocalOwner(undefined)
      window.location.replace('/sign-in')
    } else if (navigator.onLine === false) {
      const cachedOwner = localStorage.getItem(LAST_OWNER_KEY)
      if (cachedOwner) void initialize(cachedOwner)
    }

    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, publicRoute, userId])

  if (publicRoute) return children
  if (isLoaded && (!isSignedIn || !userId || localOwner !== userId)) {
    return (
      <LoadingScreen
        message={isSignedIn ? 'Opening your private life book…' : 'Taking you to sign in…'}
      />
    )
  }
  if (!localOwner)
    return (
      <LoadingScreen
        message={
          navigatorSafeOnline()
            ? 'Opening your private life book…'
            : 'Opening your offline memories…'
        }
      />
    )

  return (
    <AuthenticatedProviders key={localOwner} syncEnabled={Boolean(isLoaded && isSignedIn)}>
      {children}
    </AuthenticatedProviders>
  )
}

function AuthenticatedProviders({
  children,
  syncEnabled,
}: {
  children: React.ReactNode
  syncEnabled: boolean
}) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 1 } } }),
  )

  useEffect(() => {
    const stop = syncEnabled ? startSyncService() : () => undefined
    let timer: number | undefined
    const refresh = () => {
      void queryClient.invalidateQueries()
      if (syncEnabled) {
        window.clearTimeout(timer)
        timer = window.setTimeout(() => void syncOutbox(), 250)
      }
    }
    window.addEventListener('pawprint:data-changed', refresh)
    return () => {
      stop()
      window.removeEventListener('pawprint:data-changed', refresh)
      window.clearTimeout(timer)
    }
  }, [queryClient, syncEnabled])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <main id="main-content" className="launch-screen" aria-live="polite">
      <span className="launch-mark">
        <PawPrint size={34} />
      </span>
      <p>{message}</p>
    </main>
  )
}

function navigatorSafeOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}
