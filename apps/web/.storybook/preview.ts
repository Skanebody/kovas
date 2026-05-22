import type { Preview } from '@storybook/react'
import '../src/app/globals.css'

/**
 * Preview Storybook — global decorators, viewports, parameters.
 *
 * Viewports Chromatic alignés sur les breakpoints KOVAS v5 :
 *   - 360 (mobile S — Pixel 5)
 *   - 768 (tablet / iPad portrait)
 *   - 1280 (desktop standard)
 *   - 1920 (desktop wide)
 */
const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'sage',
      values: [
        { name: 'sage', value: '#F5F7F4' },
        { name: 'paper', value: '#FDFBF6' },
        { name: 'navy', value: '#0F1419' },
        { name: 'white', value: '#FFFFFF' },
      ],
    },
    viewport: {
      viewports: {
        mobile_s: { name: 'Mobile S (360)', styles: { width: '360px', height: '780px' } },
        mobile_l: { name: 'Mobile L (414)', styles: { width: '414px', height: '896px' } },
        tablet: { name: 'Tablet (768)', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop (1280)', styles: { width: '1280px', height: '800px' } },
        wide: { name: 'Wide (1920)', styles: { width: '1920px', height: '1080px' } },
      },
    },
    chromatic: {
      viewports: [360, 768, 1280, 1920],
      pauseAnimationAtEnd: true,
    },
    a11y: {
      config: {
        rules: [
          // tokens chartreuse/sage en cours d'audit AA contrast → désactivé temporairement
          { id: 'color-contrast', enabled: false },
        ],
      },
    },
  },
}

export default preview
