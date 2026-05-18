import { z } from 'zod'

// 8 diagnostics standards (post-Modification 18 — 92% volume métier FR)
// EXCLUS DÉFINITIVEMENT : audit_energetique, dtg
export const MissionTypeEnum = z.enum([
  'dpe_vente',
  'dpe_location',
  'amiante_vente',
  'amiante_avant_travaux',
  'plomb_crep',
  'gaz',
  'electricite',
  'termites',
  'carrez_boutin',
  'erp',
  'copropriete',
])
export type MissionType = z.infer<typeof MissionTypeEnum>

export const MissionStatusEnum = z.enum([
  'draft',
  'scheduled',
  'in_progress',
  'to_review',
  'done',
  'exported',
  'archived',
  'cancelled',
])
export type MissionStatus = z.infer<typeof MissionStatusEnum>

export const MissionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  propertyId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  createdBy: z.string().uuid(),
  reference: z.string(), // MIS-2026-00042 (per-org seq)
  type: MissionTypeEnum,
  status: MissionStatusEnum,
  priority: z.number().int().default(0),
  scheduledAt: z.date().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  exportedAt: z.date().optional(),
  licielExportPath: z.string().optional(),
  licielExportHash: z.string().optional(),
  dpeLetter: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']).optional(),
  gesLetter: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']).optional(),
  energyValue: z.number().optional(),
  gesValue: z.number().optional(),
  voiceSecondsTotal: z.number().int().default(0),
  photosCount: z.number().int().default(0),
  equipmentFindingsCount: z.number().int().default(0),
  aiCostEur: z.number().default(0),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional(),
})
export type Mission = z.infer<typeof MissionSchema>

// Mission templates (feature MVP V1 #4 — post-Modification 18)
export const RoomTemplateEnum = z.enum([
  'maison_t2',
  'maison_t3',
  'maison_t4',
  'maison_t5',
  'appartement_t1',
  'appartement_t2',
  'appartement_t3',
  'appartement_t4',
])
export type RoomTemplate = z.infer<typeof RoomTemplateEnum>

// Default rooms per template
export const ROOM_TEMPLATES: Record<RoomTemplate, string[]> = {
  appartement_t1: ['Séjour', 'Cuisine', 'Salle de bain', 'WC', 'Entrée'],
  appartement_t2: ['Séjour', 'Cuisine', 'Chambre', 'Salle de bain', 'WC', 'Entrée'],
  appartement_t3: ['Séjour', 'Cuisine', 'Chambre 1', 'Chambre 2', 'Salle de bain', 'WC', 'Entrée'],
  appartement_t4: [
    'Séjour',
    'Cuisine',
    'Chambre 1',
    'Chambre 2',
    'Chambre 3',
    'Salle de bain',
    'WC',
    'Entrée',
  ],
  maison_t2: ['Séjour', 'Cuisine', 'Chambre', 'Salle de bain', 'WC', 'Entrée', 'Extérieur'],
  maison_t3: [
    'Séjour',
    'Cuisine',
    'Chambre 1',
    'Chambre 2',
    'Salle de bain',
    'WC',
    'Entrée',
    'Extérieur',
  ],
  maison_t4: [
    'Séjour',
    'Cuisine',
    'Chambre 1',
    'Chambre 2',
    'Chambre 3',
    'Salle de bain',
    'WC',
    'Entrée',
    'Extérieur',
    'Garage',
  ],
  maison_t5: [
    'Séjour',
    'Cuisine',
    'Chambre 1',
    'Chambre 2',
    'Chambre 3',
    'Chambre 4',
    'Salle de bain',
    'WC',
    'Entrée',
    'Extérieur',
    'Garage',
  ],
}

// Export 3 modes (feature MVP V1 #8 — post-Modification 18)
export const ExportShareModeEnum = z.enum(['email', 'gdrive', 'dropbox', 'download'])
export type ExportShareMode = z.infer<typeof ExportShareModeEnum>

export const ExportFormatEnum = z.enum(['liciel_zip', 'pdf', 'docx', 'csv', 'json'])
export type ExportFormat = z.infer<typeof ExportFormatEnum>
