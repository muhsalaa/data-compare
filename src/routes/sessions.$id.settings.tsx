import { createFileRoute } from '@tanstack/react-router'
import { SessionSettingsPage } from '@/components/session/settings-page'

export const Route = createFileRoute('/sessions/$id/settings')({
  component: SessionSettingsPage,
})
