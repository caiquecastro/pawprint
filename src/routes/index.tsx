import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PawPrint } from 'lucide-react'
import { useEffect } from 'react'
import { listPets } from '../lib/local-db'

export const Route = createFileRoute('/')({ component: IndexRoute })

function IndexRoute() {
  const navigate = useNavigate()
  useEffect(() => {
    void listPets().then((pets) => {
      if (pets[0])
        void navigate({ to: '/pets/$petId', params: { petId: pets[0].id }, replace: true })
      else void navigate({ to: '/setup', replace: true })
    })
  }, [navigate])
  return (
    <main
      id="main-content"
      className="min-h-svh grid place-content-center justify-items-center text-ink-soft gap-4"
      aria-live="polite"
    >
      <span className="grid place-items-center bg-sunshine text-ink rounded-[50%_50%_46%_54%_/_54%_46%_54%_46%] animate-breathe size-19">
        <PawPrint size={34} />
      </span>
      <p>Opening your life book…</p>
    </main>
  )
}
