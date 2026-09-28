import { SignIn } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'
import { PawPrint } from 'lucide-react'

export const Route = createFileRoute('/sign-in/$')({ component: SignInRoute })

function SignInRoute() {
  return (
    <main id="main-content" className="auth-page">
      <div className="setup-brand"><span><PawPrint size={17} /></span> Pawprint</div>
      <section className="auth-card">
        <p className="eyebrow">Your private life book</p>
        <h1>Come back to<br />their story.</h1>
        <p className="lede">Sign in to keep every memory private and synchronized across your devices.</p>
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
            elements: { rootBox: 'clerk-root', cardBox: 'clerk-card-box', card: 'clerk-card' },
          }}
        />
        <p className="privacy-note">Your cloud data is only available to your signed-in account. Offline changes remain on this device until you reconnect.</p>
      </section>
    </main>
  )
}
