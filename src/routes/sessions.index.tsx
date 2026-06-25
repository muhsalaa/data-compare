import { createFileRoute, Link } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SessionsShell } from '@/components/session/sessions-shell'
import Activity from 'lucide-react/dist/esm/icons/activity'
import Plus from 'lucide-react/dist/esm/icons/plus'

export const Route = createFileRoute('/sessions/')({
  component: SessionsIndexPage,
})

function SessionsIndexPage() {
  const sessionCount = useLiveQuery(() => db.sessions.count(), [], 0)

  return (
    <SessionsShell>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Activity />
        </div>
        <div className="flex max-w-md flex-col gap-2">
          <h2 className="text-2xl font-semibold">
            {sessionCount > 0 ? 'Pick a session' : 'No sessions yet'}
          </h2>
          <p className="text-muted-foreground">
            {sessionCount > 0
              ? 'Choose a session from the sidebar to inspect charts, warnings, and history.'
              : 'Create your first session from the sidebar to start monitoring an API.'}
          </p>
        </div>
        <Link
          to="/sessions/new"
          className={cn(buttonVariants({}), 'inline-flex items-center')}
        >
          <Plus data-icon="inline-start" />
          Create Session
        </Link>
      </div>
    </SessionsShell>
  )
}
