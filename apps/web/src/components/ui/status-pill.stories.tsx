import type { Meta, StoryObj } from '@storybook/react'
import { StatusPill } from './status-pill'

const meta: Meta<typeof StatusPill> = {
  title: 'UI/StatusPill',
  component: StatusPill,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof StatusPill>

export const Blue: Story = { args: { variant: 'blue', label: 'Planifié' } }
export const Amber: Story = { args: { variant: 'amber', label: 'En cours' } }
export const Green: Story = { args: { variant: 'green', label: 'Terminé' } }
export const Coral: Story = { args: { variant: 'coral', label: 'En retard' } }
export const Muted: Story = { args: { variant: 'muted', label: 'À démarrer' } }

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <StatusPill variant="blue" label="Planifié — 14:30" />
      <StatusPill variant="amber" label="En cours — pulse signature" />
      <StatusPill variant="green" label="Terminé · Exporté" />
      <StatusPill variant="coral" label="En retard de 2 jours" />
      <StatusPill variant="muted" label="À démarrer" />
    </div>
  ),
}
