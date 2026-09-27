import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/pets/$petId')({ component: PetRouteLayout })

function PetRouteLayout() {
  return <Outlet />
}
