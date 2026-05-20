'use client'

/**
 * Ré-export "shortcut" — la modal ChecklistBeforeLeaving est définie dans
 * tools/PreDepartureChecklist.tsx (logique partagée entre la page standalone
 * et la version modale "avant de partir").
 *
 * On expose ici un alias dans le dossier shortcuts/ pour la cohérence du
 * naming (cf. brief module Utilities §5 — Raccourcis contextuels).
 */
export { ChecklistBeforeLeaving } from '@/components/utilities/tools/PreDepartureChecklist'
