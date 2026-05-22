import type { Meta, StoryObj } from '@storybook/react'
import { Check, Download, X } from 'lucide-react'
import { Button } from './button'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: { layout: 'padded' },
  args: { children: 'Continuer' },
}

export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = { args: { variant: 'default' } }

export const Accent: Story = {
  args: { variant: 'accent', children: 'Démarrer mon essai' },
}

export const Warm: Story = {
  args: { variant: 'warm', children: 'Valider mon mois' },
}

export const Outline: Story = {
  args: { variant: 'outline', children: 'Annuler' },
}

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Retour' },
}

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Supprimer définitivement' },
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Fermer">
        <X />
      </Button>
    </div>
  ),
}

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-col gap-3 items-start">
      <Button variant="default">
        <Check />
        Valider mission
      </Button>
      <Button variant="accent">
        <Download />
        Exporter Liciel
      </Button>
    </div>
  ),
}
