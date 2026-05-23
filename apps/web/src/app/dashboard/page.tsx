import { redirect } from 'next/navigation'

/**
 * Racine /dashboard.
 *
 * KOVAS n'a pas (encore) de tableau de bord agrégateur unique : chaque entité
 * (dossiers / clients / biens / facturation / planning) a sa propre page de
 * destination. Le point d'entrée le plus pertinent pour un diagnostiqueur qui
 * ouvre l'app est la page "Aujourd'hui" — sa journée de travail.
 *
 * Si `/dashboard/today` n'existe pas (selon le branch de feature), le repli
 * naturel est `/dashboard/dossiers` (liste des missions à traiter).
 *
 * Audit FIX-AUDIT-1 (2026-05-23) : remplace un 404 silencieux par une
 * redirection 307 attendue par les users qui tapent l'URL nue.
 */
export default function DashboardRootPage() {
  redirect('/dashboard/dossiers')
}
