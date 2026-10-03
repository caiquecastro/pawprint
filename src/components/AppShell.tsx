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
    <div className="w-full min-h-svh">
      <header className="sticky top-0 z-30 h-[calc(64px_+_env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] pb-0 flex items-center justify-between bg-[rgba(242,_245,_247,_0.92)] backdrop-blur-[18px] border-b border-solid border-b-[rgba(20,_35,_59,_0.06)] px-[clamp(1rem,_4vw,_2rem)]">
        <Link
          to="/pets/$petId"
          params={{ petId }}
          className="flex items-center font-serif text-[1.2rem] font-bold gap-[0.6rem]"
          aria-label="Pawprint home"
        >
          <span className="grid place-items-center bg-sunshine text-ink rounded-[50%_50%_46%_54%_/_54%_46%_54%_46%] size-8.5">
            <PawPrint size={18} strokeWidth={2.7} />
          </span>
          <span>Pawprint</span>
        </Link>
        <div className="flex items-center gap-2">
          {(!online || pending > 0) && (
            <button
              className="min-h-9.5 flex items-center bg-cream rounded-full text-[0.75rem] font-bold cursor-pointer py-0 px-3 gap-[0.45rem] border border-line"
              onClick={() => void syncOutbox(true)}
              aria-label={`${pending} changes waiting to sync`}
            >
              <span
                className="rounded-full bg-sunshine-deep size-2 data-[offline=true]:bg-coral"
                data-offline={!online}
              />
              {online
                ? uploadProgress
                  ? `Uploading ${uploadProgress}%`
                  : `${pending} pending`
                : 'Offline'}
            </button>
          )}
          <UserButton appearance={{ elements: { avatarBox: 'size-[34px]' } }} />
          <Link
            to="/settings"
            className="inline-grid place-items-center rounded-full bg-transparent cursor-pointer p-0 size-11 border-0 hover:bg-[#e8ecee]"
            aria-label="Settings"
          >
            <Settings size={20} />
          </Link>
        </div>
      </header>

      {updateReady && (
        <output className="sticky top-[calc(64px_+_env(safe-area-inset-top))] z-29 flex justify-center items-center bg-ink text-white text-[0.85rem] py-[0.55rem] px-4 gap-4">
          A fresh version is ready.
          <button
            className="text-sunshine bg-transparent underline cursor-pointer border-0"
            onClick={() => window.location.reload()}
          >
            Update
          </button>
        </output>
      )}

      <main
        id="main-content"
        className="w-[min(100%,_1080px)] pt-[1.4rem] pb-[calc(106px_+_env(safe-area-inset-bottom))] my-0 mx-auto px-[clamp(1rem,_4vw,_2rem)] tablet:pt-8 [@media(width<=370px)]:px-[0.8rem]"
      >
        {children}
      </main>

      <nav
        className="fixed z-40 left-1/2 bottom-0 w-full -translate-x-1/2 grid grid-cols-[1fr_1fr_64px_1fr_1fr] items-end pt-[0.45rem] pr-[max(0.55rem,_env(safe-area-inset-left))] pb-[calc(0.4rem_+_env(safe-area-inset-bottom))] pl-[max(0.55rem,_env(safe-area-inset-right))] bg-[rgba(255,_254,_250,_0.97)] border-t border-solid border-t-line shadow-[0_-10px_30px_rgba(20,_35,_59,_0.08)] tablet:w-[520px] tablet:bottom-4 tablet:border-r tablet:border-solid tablet:border-r-line tablet:border-b tablet:border-b-line tablet:border-l tablet:border-l-line tablet:rounded-[22px] tablet:pb-[0.45rem]"
        aria-label="Main navigation"
      >
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
          className="self-start justify-self-center -translate-y-4.5 grid place-items-center rounded-[22px_22px_19px_19px] bg-sunshine shadow-[0_8px_20px_rgba(145,_108,_0,_0.24)] size-14.5 border-4 border-cream"
          aria-label="Add a moment"
        >
          <Plus size={27} strokeWidth={2.5} />
        </Link>
        {items.slice(2).map((item) => (
          <NavItem
            key={item.label}
            {...item}
            petId={petId}
            active={
              path.startsWith(item.to.replace('$petId', petId)) ||
              (item.label === 'Care' &&
                (path === `/pets/${petId}/walks` || path === `/pets/${petId}/food`))
            }
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
      className="min-h-13 flex flex-col items-center justify-center text-[#77808d] text-[0.65rem] font-bold rounded-[12px] gap-[0.18rem] aria-[current=page]:text-ink"
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={21} strokeWidth={active ? 2.7 : 2} />
      <span>{label}</span>
    </Link>
  )
}
