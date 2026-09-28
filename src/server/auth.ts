import { auth } from '@clerk/tanstack-react-start/server'

export async function getAuthenticatedUserId() {
  const { isAuthenticated, userId } = await auth()
  return isAuthenticated && userId ? userId : null
}
