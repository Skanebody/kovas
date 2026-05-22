/**
 * États conceptuels du dossier (13 états) — Hub central refonte.
 *
 * Les états DB physiques sont 8 valeurs (draft/scheduled/on_site/back_office/done/exported/archived/cancelled).
 * Les états conceptuels ci-dessous étendent cette granularité côté UI via métadonnées
 * (paiement, signature ADEME, sync IA, validation, etc.) — ils ne migrent pas la table.
 *
 * Mapping : `resolveDossierState(dbStatus, metadata)` → état conceptuel.
 */
export const DOSSIER_STATES = [
  'brouillon',
  'confirme',
  'en_preparation',
  'en_mission',
  'a_synchroniser',
  'en_traitement_ia',
  'a_valider',
  'valide',
  'exporte',
  'envoye',
  'en_attente_paiement',
  'paye',
  'archive',
  'en_litige',
] as const

export type DossierState = (typeof DOSSIER_STATES)[number]

/**
 * Statut physique DB tel que stocké dans `dossiers.status`.
 */
export type DossierDbStatus =
  | 'draft'
  | 'scheduled'
  | 'on_site'
  | 'back_office'
  | 'done'
  | 'exported'
  | 'archived'
  | 'cancelled'

export interface DossierStateContext {
  status: string
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  metadata: Record<string, unknown> | null
}

/**
 * Résout l'état conceptuel à partir du statut DB + métadonnées.
 * Cascade : litige → archivé → paiement → exporté → validé → IA → mission → préparation → confirmé → brouillon.
 */
export function resolveDossierState(ctx: DossierStateContext): DossierState {
  const meta = ctx.metadata ?? {}
  const flag = (k: string): boolean => meta[k] === true

  if (flag('inLitigation')) return 'en_litige'
  if (ctx.status === 'archived') return 'archive'
  if (ctx.status === 'cancelled') return 'archive'

  if (flag('paid')) return 'paye'
  if (flag('invoiced') && !flag('paid')) return 'en_attente_paiement'

  if (flag('sentToClient')) return 'envoye'
  if (ctx.status === 'exported') return 'exporte'

  if (flag('validatedAt') || flag('validated')) return 'valide'
  if (flag('needsValidation')) return 'a_valider'

  if (flag('iaProcessing')) return 'en_traitement_ia'
  if (flag('pendingSync')) return 'a_synchroniser'

  if (ctx.status === 'on_site' || ctx.status === 'back_office') return 'en_mission'
  if (ctx.status === 'done') return 'a_valider'

  if (ctx.status === 'scheduled') {
    // Si J-3 ou moins avant scheduled_at → en_preparation
    if (ctx.scheduled_at) {
      const target = new Date(ctx.scheduled_at).getTime()
      const now = Date.now()
      const days = (target - now) / 86_400_000
      if (days >= 0 && days <= 3) return 'en_preparation'
    }
    return 'confirme'
  }

  return 'brouillon'
}

export const DOSSIER_STATE_LABEL: Record<DossierState, string> = {
  brouillon: 'Brouillon',
  confirme: 'Confirmé',
  en_preparation: 'En préparation',
  en_mission: 'En mission',
  a_synchroniser: 'À synchroniser',
  en_traitement_ia: 'Traitement IA',
  a_valider: 'À valider',
  valide: 'Validé',
  exporte: 'Exporté',
  envoye: 'Envoyé au client',
  en_attente_paiement: 'En attente paiement',
  paye: 'Payé',
  archive: 'Archivé',
  en_litige: 'En litige',
}

export type StatusPillVariant = 'blue' | 'amber' | 'green' | 'coral' | 'muted'

export interface StatusPillProps {
  variant: StatusPillVariant
  label: string
}

export function getStatusPillProps(state: DossierState): StatusPillProps {
  const label = DOSSIER_STATE_LABEL[state]
  const variant: StatusPillVariant = (() => {
    switch (state) {
      case 'brouillon':
        return 'muted'
      case 'confirme':
        return 'blue'
      case 'en_preparation':
      case 'en_mission':
      case 'a_synchroniser':
      case 'en_traitement_ia':
      case 'a_valider':
        return 'amber'
      case 'valide':
      case 'exporte':
      case 'envoye':
      case 'paye':
        return 'green'
      case 'en_attente_paiement':
        return 'amber'
      case 'en_litige':
        return 'coral'
      case 'archive':
        return 'muted'
      default:
        return 'muted'
    }
  })()
  return { variant, label }
}

/**
 * Sections visibles pour chaque état conceptuel.
 * `true` = section affichée. Les sections cachées restent montables (ex: utilisateur peut ré-ouvrir une note).
 */
export interface VisibleSections {
  identity: boolean
  capture: boolean
  dataQuality: boolean
  preExport: boolean
  exports: boolean
  communication: boolean
  billing: boolean
  followup: boolean
  notes: boolean
}

export function getVisibleSections(state: DossierState): VisibleSections {
  // Identity + notes toujours visibles
  const base: VisibleSections = {
    identity: true,
    capture: false,
    dataQuality: false,
    preExport: false,
    exports: false,
    communication: false,
    billing: false,
    followup: false,
    notes: true,
  }

  switch (state) {
    case 'brouillon':
    case 'confirme':
      return { ...base, capture: false, communication: true }
    case 'en_preparation':
      return { ...base, capture: true, communication: true }
    case 'en_mission':
    case 'a_synchroniser':
      return { ...base, capture: true, dataQuality: true }
    case 'en_traitement_ia':
      return { ...base, capture: true, dataQuality: true, preExport: true }
    case 'a_valider':
      return { ...base, capture: true, dataQuality: true, preExport: true, exports: true }
    case 'valide':
    case 'exporte':
      return { ...base, capture: true, dataQuality: true, preExport: true, exports: true, communication: true }
    case 'envoye':
    case 'en_attente_paiement':
      return {
        ...base,
        capture: false,
        dataQuality: false,
        exports: true,
        communication: true,
        billing: true,
        followup: true,
      }
    case 'paye':
      return {
        ...base,
        exports: true,
        communication: true,
        billing: true,
        followup: true,
      }
    case 'en_litige':
      return {
        ...base,
        capture: true,
        exports: true,
        communication: true,
        billing: true,
        followup: true,
      }
    case 'archive':
      return { ...base, identity: true, exports: true, billing: true }
    default:
      return base
  }
}

export interface PrimaryAction {
  label: string
  href?: string
  /** Server action id (à mapper côté client) */
  actionId?: string
  variant?: 'accent' | 'default'
  hidden?: boolean
}

/**
 * Action primaire contextuelle (bouton chartreuse à droite du header).
 * Cible : "1 action évidente par état".
 */
export function getPrimaryActionForState(state: DossierState, dossierId: string): PrimaryAction {
  switch (state) {
    case 'brouillon':
      return { label: 'Planifier la mission', actionId: 'schedule', variant: 'accent' }
    case 'confirme':
      return { label: 'Préparer la mission', actionId: 'prepare', variant: 'accent' }
    case 'en_preparation':
      return {
        label: 'Démarrer la mission',
        href: `/app/dossiers/${dossierId}?mode=mission`,
        variant: 'accent',
      }
    case 'en_mission':
      return {
        label: 'Reprendre la mission',
        href: `/app/dossiers/${dossierId}?mode=mission`,
        variant: 'accent',
      }
    case 'a_synchroniser':
      return { label: 'Synchroniser', actionId: 'sync', variant: 'accent' }
    case 'en_traitement_ia':
      return { label: 'Traitement en cours…', variant: 'default', hidden: false }
    case 'a_valider':
      return {
        label: 'Valider le dossier',
        href: `/app/dossiers/${dossierId}#data-quality`,
        variant: 'accent',
      }
    case 'valide':
      return { label: 'Exporter', actionId: 'export', variant: 'accent' }
    case 'exporte':
      return { label: 'Envoyer au client', actionId: 'send', variant: 'accent' }
    case 'envoye':
      return { label: 'Émettre la facture', actionId: 'invoice', variant: 'accent' }
    case 'en_attente_paiement':
      return { label: 'Relancer le paiement', actionId: 'reminder_payment', variant: 'accent' }
    case 'paye':
      return { label: 'Archiver le dossier', actionId: 'archive', variant: 'default' }
    case 'en_litige':
      return { label: 'Ouvrir le litige', actionId: 'litigation', variant: 'default' }
    case 'archive':
      return { label: 'Restaurer', actionId: 'restore', variant: 'default' }
    default:
      return { label: 'Action', hidden: true }
  }
}
