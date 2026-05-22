import type { Meta, StoryObj } from '@storybook/react'
import { KpiHero } from './kpi-hero'

const meta: Meta<typeof KpiHero> = {
  title: 'UI/KpiHero',
  component: KpiHero,
  parameters: {
    layout: 'padded',
    chromatic: { viewports: [360, 768, 1280, 1920] },
  },
}

export default meta
type Story = StoryObj<typeof KpiHero>

export const Default: Story = {
  args: {
    label: "CHIFFRE D'AFFAIRES MENSUEL",
    value: '12 450 €',
    hint: '37 missions facturées',
  },
}

export const WithTrendUp: Story = {
  args: {
    label: 'MISSIONS RÉALISÉES',
    value: 37,
    trend: 12,
    hint: 'vs semaine précédente',
  },
}

export const WithTrendDown: Story = {
  args: {
    label: 'TAUX DE RETOUR CLIENT',
    value: '2,1 %',
    trend: -4,
  },
}

export const Featured: Story = {
  args: {
    label: 'TEMPS ÉCONOMISÉ CE MOIS',
    value: '23 h 47',
    hint: 'Soit ~3 jours libérés sur le terrain.',
    featured: true,
  },
}

export const Naked: Story = {
  args: {
    label: 'NPS',
    value: 62,
    variant: 'naked',
  },
}
