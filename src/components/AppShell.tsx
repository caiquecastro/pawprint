import { UserButton } from '@clerk/tanstack-react-start'
import { Link, useRouterState } from '@tanstack/react-router'
import { Bell, BookOpenText, HeartPulse, Home, PawPrint, Plus, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { listOutbox, listUnsyncedMedia } from '../lib/local-db'
import { syncOutbox } from '../lib/sync'

export function AppShell({ petId, children }: { petId: string; children: React.ReactNode }) {
  const path = useRouterState({ select: (state) => state.location.pathname })
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [uploadProgress, setUploadProgress] = useState<number>()
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    const refresh = async () => {
      setOnline(navigator.onLine)
      const [outbox, media] = await Promise.all([listOutbox(), listUnsyncedMedia()])
      setPending(outbox.length + media.length)
      const activeUpload = media.find((item) => item.progress && item.progress > 0)
      setUploadProgress(activeUpload?.progress)
    }
    const update = () => setUpdateReady(true)
    void refresh()
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    window.addEventListener('pawprint:data-changed', refresh)
    window.addEventListener('pawprint:update-ready', update)
    return () => {
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', refresh)
      window.removeEventListener('pawprint:data-changed', refresh)
      window.removeEventListener('pawprint:update-ready', update)
    }
  }, [])

  const items = [
    { to: '/pets/$petId', label: 'Today', icon: Home, exact: true },
    { to: '/pets/$petId/journal', label: 'Journal', icon: BookOpenText },
    { to: '/pets/$petId/health', label: 'Health', icon: HeartPulse },
    { to: '/pets/$petId/care', label: 'Care', icon: Bell },
  ] as const

  return (
    <div className="app-frame">
      <header className="topbar">
        <Link to="/pets/$petId" params={{ petId }} className="brand" aria-label="Pawprint home">
          <span className="brand-mark">
            <PawPrint size={18} strokeWidth={2.7} />
          </span>
          <span>Pawprint</span>
        </Link>
        <div className="topbar-actions">
          {(!online || pending > 0) && (
            <button
              className="sync-pill"
              onClick={() => void syncOutbox(true)}
              aria-label={`${pending} changes waiting to sync`}
            >
              <span className={online ? 'status-dot pending' : 'status-dot offline'} />
              {online
                ? uploadProgress
                  ? `Uploading ${uploadProgress}%`
                  : `${pending} pending`
                : 'Offline'}
            </button>
          )}
          <UserButton appearance={{ elements: { avatarBox: 'account-avatar' } }} />
          <Link to="/settings" className="icon-button" aria-label="Settings">
            <Settings size={20} />
          </Link>
        </div>
      </header>

      {updateReady && (
        <output className="update-banner">
          A fresh version is ready.
          <button onClick={() => window.location.reload()}>Update</button>
        </output>
      )}

      <main id="main-content" className="screen">
        {children}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        {items.slice(0, 2).map((item) => (
          <NavItem
            key={item.label}
            {...item}
            petId={petId}
            active={
              item.label === 'Today'
                ? path === `/pets/${petId}`
                : path.startsWith(`/pets/${petId}/journal`)
            }
          />
        ))}
        <Link
          to="/pets/$petId/journal"
          search={{ compose: 'new' }}
          params={{ petId }}
          className="add-nav"
          aria-label="Add a moment"
        >
          <Plus size={27} strokeWidth={2.5} />
        </Link>
        {items.slice(2).map((item) => (
          <NavItem
            key={item.label}
            {...item}
            petId={petId}
            active={path.startsWith(item.to.replace('$petId', petId))}
          />
        ))}
      </nav>
    </div>
  )
}

function NavItem({
  to,
  label,
  icon: Icon,
  petId,
  active,
}: {
  to: string
  label: string
  icon: typeof Home
  petId: string
  active: boolean
}) {
  return (
    <Link
      to={to}
      params={{ petId }}
      className={`nav-item ${active ? 'active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={21} />
      <span>{label}</span>
    </Link>
  )
}
