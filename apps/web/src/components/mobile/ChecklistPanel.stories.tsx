import type { CompletionStatus } from '@/lib/local-ai/checklist-tracker'
import type { ChecklistItem } from '@/lib/local-ai/checklists/types'
import type { Meta, StoryObj } from '@storybook/react'
import { ChecklistPanel } from './ChecklistPanel'

const sampleItem = (id: string, overrides: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id,
  field_name: id,
  description_short: id,
  description_full: id,
  scope: 'mission',
  required: true,
  severity: 'important',
  requires_photo: false,
  trigger_question_after_ms: 60_000,
  trigger_question_text: '',
  keywords: [],
  diagnostic: 'dpe',
  ...overrides,
})

const baseStatus = (overrides: Partial<CompletionStatus>): CompletionStatus => ({
  diagnostics: ['dpe'],
  covered: [],
  missing_critical: [],
  missing_important: [],
  missing_optional: [],
  photos_missing: [],
  percentage: 0,
  by_section: [],
  rooms_visited: [],
  current_room: null,
  ...overrides,
})

const meta: Meta<typeof ChecklistPanel> = {
  title: 'Mobile/ChecklistPanel',
  component: ChecklistPanel,
  parameters: {
    layout: 'centered',
    chromatic: { viewports: [360, 768] },
  },
}

export default meta
type Story = StoryObj<typeof ChecklistPanel>

export const Empty: Story = {
  args: {
    status: baseStatus({}),
    forceExpanded: true,
  },
}

export const Partial: Story = {
  args: {
    status: baseStatus({
      covered: Array.from({ length: 10 }, (_, i) => sampleItem(`covered-${i}`)),
      missing_critical: [sampleItem('crit-1', { severity: 'critical' })],
      missing_important: Array.from({ length: 6 }, (_, i) => sampleItem(`imp-${i}`)),
      percentage: 55,
    }),
    forceExpanded: true,
  },
}

export const Complete: Story = {
  args: {
    status: baseStatus({
      covered: Array.from({ length: 25 }, (_, i) => sampleItem(`covered-${i}`)),
      percentage: 100,
    }),
    forceExpanded: true,
  },
}
