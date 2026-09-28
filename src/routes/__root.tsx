import { ClerkProvider } from '@clerk/tanstack-react-start'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { AppProviders } from '../components/AppProviders'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      {
        name: 'theme-color',
        content: '#14233b',
      },
      {
        name: 'description',
        content: 'A calm life book for the pet you love.',
      },
      {
        title: 'Pawprint — your pet’s life book',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', href: '/icons/icon-192.png', type: 'image/png' },
      { rel: 'apple-touch-icon', href: '/icons/icon-192.png' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <ClerkProvider signInUrl="/sign-in">
          <AppProviders>{children}</AppProviders>
        </ClerkProvider>
        <Scripts />
      </body>
    </html>
  )
}
