import { Button } from '@/components/ui/button'
import type { Meta, StoryObj } from '@storybook/react'
import { Toaster } from 'sonner'
import { ToastProvider, useToast } from './Toast'

/**
 * Toast — wrapper Sonner KOVAS v5 (factuel + sobre).
 *
 * Story est interactive : clic sur les boutons déclenche les toasts depuis
 * le provider Sonner monté ici.
 */

function ToastDemo() {
  const { showToast } = useToast()
  return (
    <div className="flex flex-col items-start gap-3">
      <Button onClick={() => showToast({ title: 'Mission enregistrée.' })}>Default</Button>
      <Button
        variant="accent"
        onClick={() =>
          showToast({
            title: 'Export Liciel terminé.',
            body: 'Fichier disponible 24h.',
            variant: 'success',
          })
        }
      >
        Success
      </Button>
      <Button
        variant="destructive"
        onClick={() =>
          showToast({
            title: 'Erreur lors de la sauvegarde.',
            body: 'Vérifiez votre connexion.',
            variant: 'error',
          })
        }
      >
        Error
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          showToast({
            title: 'Photo supprimée.',
            action: { label: 'Annuler', onClick: () => undefined },
          })
        }
      >
        With action
      </Button>
    </div>
  )
}

const meta: Meta<typeof ToastDemo> = {
  title: 'Shared/Toast',
  component: ToastDemo,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
        <Toaster position="bottom-right" />
      </ToastProvider>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ToastDemo>

export const Playground: Story = {}
