/**
 * Layout racine /admin — minimal, pas de gate.
 *
 * La gate (auth + admin + 2FA) est dans le route group (gated)/layout.tsx
 * qui protège toutes les vraies pages admin. Les pages /admin/setup-2fa et
 * /admin/verify-2fa restent hors du groupe (gated) pour éviter une boucle
 * de redirect : un user sans 2FA cookie doit pouvoir accéder à ces deux
 * pages sans être renvoyé vers elles à l'infini.
 */

import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: {
    default: 'Admin · KOVAS',
    template: '%s · Admin · KOVAS',
  },
  robots: { index: false, follow: false },
}

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
