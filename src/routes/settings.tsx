import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Cloud, Database, Download, ShieldCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { listPets } from '../lib/local-db'

export const Route = createFileRoute('/settings')({ component: SettingsRoute })

function SettingsRoute() {
  const pets = useQuery({ queryKey: ['pets'], queryFn: listPets, enabled: typeof window !== 'undefined' }).data ?? []
  const pet = pets[0]
  return <main id="main-content" className="settings-page"><header><Link to={pet ? '/pets/$petId' : '/setup'} params={pet ? { petId: pet.id } : {}} className="back-button"><ArrowLeft size={18} /> Back</Link><p className="eyebrow">Pawprint</p><h1>Settings</h1></header><div className="settings-list card"><section><span><Database /></span><div><h2>Local-first memories</h2><p>New journal entries are stored in this account’s private space on this device, then synchronized when a connection is available.</p></div></section><section><span><Cloud /></span><div><h2>Cloud synchronization</h2><p>Pending changes are retried safely using the same record ID, so a moment is never duplicated.</p></div></section><section><span><ShieldCheck /></span><div><h2>Protected by your account</h2><p>Cloud records and photos are only returned when the signed-in account owns the pet.</p></div></section><button className="secondary-button" onClick={() => window.print()}><Download size={18} /> Print this page</button></div><p className="version">Pawprint MVP · built with care</p></main>
}
