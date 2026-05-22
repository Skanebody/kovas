import type { StorybookConfig } from '@storybook/nextjs'

/**
 * Storybook config — KOVAS App (Next.js 15 + Tailwind + tokens v5).
 *
 * Pourquoi Storybook + Chromatic ?
 *   - Catalogue visuel des composants v5 critiques (PreExportPanel, Checkout,
 *     ChecklistPanel, KpiHero, etc.)
 *   - Tests de régression visuels automatisés via Chromatic (4 viewports
 *     mobile/tablet/desktop/wide)
 *   - Référence vivante de l'avatar Benjamin Bel (vouvoiement, sobriété)
 *
 * Lancement :
 *   pnpm storybook         # dev local sur :6006
 *   pnpm storybook:build   # build statique pour Chromatic
 *   pnpm chromatic         # upload + diff visuels
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)', '../stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  staticDirs: ['../public'],
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
  },
  docs: {
    autodocs: 'tag',
  },
}

export default config
