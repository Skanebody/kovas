import type { CompletionStatus } from '@/lib/local-ai/checklist-tracker'
import type { ChecklistItem } from '@/lib/local-ai/checklists/types'
import type { Meta, StoryObj } from '@storybook/react'
import { CheckoutScreen } from './CheckoutScreen'

/**
 * CheckoutScreen — écran de sortie mission terrain (mobile).
 *
 * 3 scénarios canoniques :
 *   - AllComplete : tout est saisi (header vert success)
 *   - MissingCritical : items critiques absents (confirmation requise au départ)
 *   - MissingPhotos : photos manquantes (warning info non-bloquant)
 */

const sampleItem = (id: string, overrides: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id,
  field_name: id,
  description_short: `Item ${id}`,
  description_full: `Vérification ${id}`,
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

const meta: Meta<typeof CheckoutScreen> = {
  title: 'Mobile/CheckoutScreen',
  component: CheckoutScreen,
  parameters: {
    layout: 'fullscreen',
    chromatic: { viewports: [360, 414, 768] },
  },
  args: {
    onContinue: () => undefined,
    onComplete: () => undefined,
    onConfirmLeave: () => undefined,
  },
}

export default meta
type Story = StoryObj<typeof CheckoutScreen>

export const AllComplete: Story = {
  args: {
    status: baseStatus({
      covered: Array.from({ length: 18 }, (_, i) => sampleItem(`item-${i}`)),
      percentage: 100,
    }),
  },
}

export const MissingCritical: Story = {
  args: {
    status: baseStatus({
      covered: Array.from({ length: 12 }, (_, i) => sampleItem(`covered-${i}`)),
      missing_critical: [
        sampleItem('dpe.heating_system', {
          description_short: 'Système de chauffage principal',
          severity: 'critical',
        }),
        sampleItem('amiante.toiture_inspectee', {
          description_short: 'Toiture inspectée pour amiante',
          severity: 'critical',
        }),
      ],
      percentage: 80,
    }),
  },
}

export const MissingPhotos: Story = {
  args: {
    status: baseStatus({
      covered: Array.from({ length: 15 }, (_, i) => sampleItem(`covered-${i}`)),
      photos_missing: [
        sampleItem('dpe.chaudiere_photo', {
          description_short: 'Photo de la plaque signalétique chaudière',
          requires_photo: true,
        }),
        sampleItem('dpe.compteur_photo', {
          description_short: 'Photo compteur Linky',
          requires_photo: true,
        }),
      ],
      percentage: 90,
    }),
  },
}
