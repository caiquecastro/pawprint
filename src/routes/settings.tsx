import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Cloud, Database, Download, ShieldCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { listPets } from '../lib/local-db'

export const Route = createFileRoute('/settings')({ component: SettingsRoute })

function SettingsRoute() {
  const pets =
    useQuery({ queryKey: ['pets'], queryFn: listPets, enabled: typeof window !== 'undefined' })
      .data ?? []
  const pet = pets[0]
  return (
    <main
      id="main-content"
      className="w-[min(100%,_680px)] min-h-svh pt-[calc(1.2rem_+_env(safe-area-inset-top))] pb-8 my-0 mx-auto px-4"
    >
      <header>
        <Link
          to={pet ? '/pets/$petId' : '/setup'}
          params={pet ? { petId: pet.id } : {}}
          className="min-h-11 inline-flex items-center mb-[0.7rem] bg-transparent font-extrabold cursor-pointer p-0 gap-1 border-0"
        >
          <ArrowLeft size={18} /> Back
        </Link>
        <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem]">
          Pawprint
        </p>
        <h1 className="mt-[0.2rem] mb-[1.4rem] mx-0">Settings</h1>
      </header>
      <div className="bg-cream rounded-card shadow-panel pt-[0.3rem] pb-4 px-4 border border-[rgba(20,_35,_59,_0.08)]">
        <section className="grid grid-cols-[48px_1fr] border-b border-solid border-b-line py-4 px-0 gap-[0.8rem]">
          <span className="grid place-items-center rounded-full bg-[#e6eef0] size-11">
            <Database />
          </span>
          <div>
            <h2 className="mt-0 mb-1 font-sans text-[1rem] mx-0">Local-first memories</h2>
            <p className="text-ink-soft text-[0.85rem] m-0">
              New journal entries are stored in this account’s private space on this device, then
              synchronized when a connection is available.
            </p>
          </div>
        </section>
        <section className="grid grid-cols-[48px_1fr] border-b border-solid border-b-line py-4 px-0 gap-[0.8rem]">
          <span className="grid place-items-center rounded-full bg-[#e6eef0] size-11">
            <Cloud />
          </span>
          <div>
            <h2 className="mt-0 mb-1 font-sans text-[1rem] mx-0">Cloud synchronization</h2>
            <p className="text-ink-soft text-[0.85rem] m-0">
              Pending changes are retried safely using the same record ID, so a moment is never
              duplicated.
            </p>
          </div>
        </section>
        <section className="grid grid-cols-[48px_1fr] border-b border-solid border-b-line py-4 px-0 gap-[0.8rem]">
          <span className="grid place-items-center rounded-full bg-[#e6eef0] size-11">
            <ShieldCheck />
          </span>
          <div>
            <h2 className="mt-0 mb-1 font-sans text-[1rem] mx-0">Protected by your account</h2>
            <p className="text-ink-soft text-[0.85rem] m-0">
              Cloud records and photos are only returned when the signed-in account owns the pet.
            </p>
          </div>
        </section>
        <button
          className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-white w-full mt-4 py-[0.6rem] px-4 gap-[0.45rem] border border-line"
          onClick={() => window.print()}
        >
          <Download size={18} /> Print this page
        </button>
      </div>
      <p className="mt-6 text-center text-[#87919b] text-[0.75rem]">
        Pawprint MVP · built with care
      </p>
    </main>
  )
}
