/**
 * Notifications Center — types V1.
 *
 * Notifications agrégées multi-sources affichées dans la cloche header
 * dashboard (pattern Linear). En V1 les données proviennent d'un mock
 * statique fourni par le layout serveur ; en V1.1 elles seront alimentées
 * par une vue PostgreSQL `app_notifications` côté Supabase qui agrégera :
 *
 * - leads annuaire reçus (table `directory_leads`)
 * - missions terminées (table `missions` status = 'completed')
 * - alertes risque ADEME (table `ademe_risk_alerts`)
 * - factures impayées (table `invoices` status = 'past_due')
 * - veille réglementaire (table `regulatory_notifications` — déjà câblée
 *   séparément via `RegulatoryNotificationsBadge`, intégrée ici pour
 *   centralisation visuelle future).
 *
 * Le périmètre "Notifications Center général" reste distinct du badge
 * réglementaire dédié `/dashboard/veille` qui garde sa cloche propre.
 */

/** Catégories sources de notifications (mappées sur DS v5 pastels). */
export type NotificationKind =
  | 'lead_directory'
  | 'mission_completed'
  | 'ademe_alert'
  | 'invoice_overdue'
  | 'regulatory_update'
  | 'system'

/** Notification atomique. */
export interface Notification {
  /** Identifiant stable (UUID en V1.1, slug stable en V1 mock). */
  id: string
  /** Catégorie source — pilote l'icône et la pastel. */
  kind: NotificationKind
  /** Titre court (1 ligne, ~60 chars max). */
  title: string
  /** Description optionnelle (2 lignes max via line-clamp). */
  message?: string
  /** ISO 8601 UTC. Timezone affichage = Europe/Paris. */
  createdAt: string
  /** Date de lecture (null = non lue). Format ISO 8601 UTC. */
  readAt: string | null
  /** Lien interne facultatif (cliquer la notif y mène + mark as read). */
  href?: string
}

/** Réponse mark-all-read serveur (V1 = no-op côté mock). */
export interface MarkAllReadResult {
  /** Nombre de notifications marquées comme lues. */
  count: number
}
