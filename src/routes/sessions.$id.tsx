import { createFileRoute } from '@tanstack/react-router'
import { SessionPage } from '@/components/session/session-page'
import { SessionsShell } from '@/components/session/sessions-shell'

export const Route = createFileRoute('/sessions/$id')({
  component: SessionsSessionRoute,
})

function SessionsSessionRoute() {
  return (
    <SessionsShell>
      <SessionPage />
    </SessionsShell>
  )
}
