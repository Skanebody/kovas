import type { Meta, StoryObj } from '@storybook/react'
import { CommandK } from './CommandK'

/**
 * CommandK — palette de commandes V5 (Cmd+K / Ctrl+K).
 *
 * Le composant gère son état d'ouverture en interne. Le user appuie sur Cmd+K
 * dans la story pour la voir.
 */
const meta: Meta<typeof CommandK> = {
  title: 'Shared/CommandK',
  component: CommandK,
  parameters: {
    layout: 'fullscreen',
    chromatic: { viewports: [768, 1280] },
    docs: {
      description: {
        component: 'Appuyez sur Cmd+K (Mac) ou Ctrl+K (Windows/Linux) pour ouvrir la palette.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof CommandK>

export const Default: Story = {
  args: { enableShortcut: true },
}
