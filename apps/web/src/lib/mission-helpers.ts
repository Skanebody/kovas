export const MISSION_TYPE_LABELS: Record<string, string> = {
  dpe_vente: 'DPE vente',
  dpe_location: 'DPE location',
  copropriete: 'DPE copropriété',
  amiante_vente: 'Amiante (vente)',
  amiante_avant_travaux: 'Amiante avant travaux',
  plomb_crep: 'Plomb CREP',
  gaz: 'Gaz',
  electricite: 'Électricité',
  termites: 'Termites',
  carrez_boutin: 'Carrez / Boutin',
  erp: 'ERP',
}

export const MISSION_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  scheduled: 'Planifiée',
  in_progress: 'En cours',
  to_review: 'À relire',
  done: 'Terminée',
  exported: 'Exportée',
  archived: 'Archivée',
  cancelled: 'Annulée',
}

export const MISSION_STATUS_VARIANT: Record<
  string,
  'muted' | 'blue' | 'green' | 'orange' | 'red'
> = {
  draft: 'muted',
  scheduled: 'blue',
  in_progress: 'orange',
  to_review: 'orange',
  done: 'green',
  exported: 'green',
  archived: 'muted',
  cancelled: 'red',
}
