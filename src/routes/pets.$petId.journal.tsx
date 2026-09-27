import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/pets/$petId/journal')({ component: JournalRouteLayout })

function JournalRouteLayout() {
  return <Outlet />
}
