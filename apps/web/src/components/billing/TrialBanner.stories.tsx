import type { Meta, StoryObj } from '@storybook/react'
import { TrialBanner } from './TrialBanner'

const meta: Meta<typeof TrialBanner> = {
  title: 'Billing/TrialBanner',
  component: TrialBanner,
  parameters: {
    layout: 'padded',
    chromatic: { viewports: [360, 768, 1280] },
  },
}

export default meta
type Story = StoryObj<typeof TrialBanner>

const inDays = (n: number): string => new Date(Date.now() + n * 86400_000).toISOString()

export const Standard: Story = {
  args: {
    trialEndsAt: inDays(12),
    monthlyPriceCents: 5900,
    tierLabel: 'Standard',
  },
}

export const SoonExpiring: Story = {
  args: {
    trialEndsAt: inDays(2),
    monthlyPriceCents: 5900,
    tierLabel: 'Standard',
  },
}

export const Volume: Story = {
  args: {
    trialEndsAt: inDays(8),
    monthlyPriceCents: 9900,
    tierLabel: 'Volume',
  },
}
