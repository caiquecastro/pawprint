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
    <main id="main-content" className="launch-screen" aria-live="polite">
      <span className="launch-mark">
        <PawPrint size={34} />
      </span>
      <p>Opening your life book…</p>
    </main>
  )
}
