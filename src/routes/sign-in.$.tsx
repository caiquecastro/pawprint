import { SignIn } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'
import { PawPrint } from 'lucide-react'

export const Route = createFileRoute('/sign-in/$')({ component: SignInRoute })

function SignInRoute() {
  return (
    <main
      id="main-content"
      className="min-h-svh grid content-start bg-paper tablet:content-center tablet:py-8 tablet:px-0"
    >
      <div className="flex items-center pt-[calc(1rem_+_env(safe-area-inset-top))] pb-4 font-serif font-bold px-[1.2rem] gap-[0.55rem] tablet:fixed tablet:top-0 tablet:left-0">
        <span className="grid place-items-center rounded-full bg-sunshine size-8">
          <PawPrint size={17} />
        </span>{' '}
        Pawprint
      </div>
      <section className="w-[min(100%,_590px)] pt-[1.2rem] pb-8 my-0 mx-auto px-4 tablet:pt-8 tablet:px-8">
        <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem]">
          Your private life book
        </p>
        <h1 className="mb-4">
          Come back to
          <br />
          their story.
        </h1>
        <p className="text-ink-soft text-[1.05rem] leading-[1.65]">
          Sign in to keep every memory private and synchronized across your devices.
        </p>
        <SignIn
          routing="path"
          path="/sign-in"
          fallbackRedirectUrl="/"
          appearance={{
            variables: {
              colorPrimary: '#14233b',
              colorForeground: '#14233b',
              colorBackground: '#fffefa',
              borderRadius: '14px',
              fontFamily: "ui-rounded, 'SF Pro Rounded', 'Avenir Next', system-ui, sans-serif",
            },
            elements: {
              rootBox: 'w-full',
              cardBox: 'w-full',
              card: 'mt-[1.4rem] w-full border border-line shadow-card',
            },
          }}
        />
        <p className="mt-4 mb-0 max-w-[360px] text-[#79838e] text-center text-[0.72rem] mx-auto">
          Your cloud data is only available to your signed-in account. Offline changes remain on
          this device until you reconnect.
        </p>
      </section>
    </main>
  )
}
