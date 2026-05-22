import type { Meta, StoryObj } from '@storybook/react'
import { DiagnosticChip, type DiagnosticType } from './diagnostic-chip'

const meta: Meta<typeof DiagnosticChip> = {
  title: 'UI/DiagnosticChip',
  component: DiagnosticChip,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof DiagnosticChip>

const ALL: DiagnosticType[] = [
  'DPE',
  'AMIANTE',
  'PLOMB',
  'GAZ',
  'ELEC',
  'TERMITES',
  'CARREZ',
  'ERP',
]

export const All: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {ALL.map((t) => (
        <DiagnosticChip key={t} type={t} />
      ))}
    </div>
  ),
}

export const Long: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {ALL.map((t) => (
        <DiagnosticChip key={t} type={t} short={false} />
      ))}
    </div>
  ),
}
