/**
 * /admin/leads — Redirect vers la queue principale.
 *
 * Page d'index minimale : aucune vue dediee, on renvoie systematiquement
 * vers /admin/leads/queue (vue Server Component de la file complete).
 */

import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function AdminLeadsIndexPage() {
  redirect('/admin/leads/queue')
}
