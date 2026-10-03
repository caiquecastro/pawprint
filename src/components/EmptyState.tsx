import { PawPrint } from 'lucide-react'

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string
  text: string
  action?: React.ReactNode
}) {
  return (
    <div className="grid justify-items-center text-center rounded-[22px] text-ink-soft py-[2.4rem] px-[1.2rem] border border-[#bdc7ce] border-dashed">
      <span className="grid place-items-center rounded-[45%_55%] bg-[#e3ecef] text-[#547785] -rotate-4 size-12">
        <PawPrint size={24} />
      </span>
      <h3 className="mt-[0.8rem] mb-1 text-ink font-serif text-[1.25rem] mx-0">{title}</h3>
      <p className="max-w-[330px] mb-[0.55rem]">{text}</p>
      {action}
    </div>
  )
}
