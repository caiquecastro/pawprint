import { clerkMiddleware } from '@clerk/tanstack-react-start/server'
import { createStart } from '@tanstack/react-start'

const authorizedParties = process.env.CLERK_AUTHORIZED_PARTIES?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

export const startInstance = createStart(() => ({
  requestMiddleware: [
    clerkMiddleware({
      authorizedParties: authorizedParties?.length ? authorizedParties : undefined,
    }),
  ],
}))
