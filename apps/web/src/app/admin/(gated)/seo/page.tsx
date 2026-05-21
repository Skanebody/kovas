/**
 * /admin/seo — redirect vers le Kanban (vue par défaut du pipeline SEO).
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Pipeline SEO',
  robots: { index: false, follow: false },
}

export default function SeoIndexPage(): never {
  redirect('/admin/seo/kanban')
}
