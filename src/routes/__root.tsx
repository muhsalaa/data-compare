import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PollingManager } from '@/components/polling/polling-manager'

export const Route = createRootRoute({
  component: () => (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Toaster position="top-right" richColors />
        <PollingManager />
        <Outlet />
      </div>
    </TooltipProvider>
  ),
})
