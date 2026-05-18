/**
 * Templates de pièces pré-remplis — feature 4 des 10 MVP V1.
 * Cf. CLAUDE.md §3
 *
 * Idée : 1 clic remplit les pièces typiques d'un T2/T3/T4/T5 maison ou appartement.
 * Gain temps terrain ~3-5 minutes par mission.
 */

export interface RoomTemplateItem {
  name: string
  room_type: string
}

export interface RoomTemplate {
  id: string
  label: string
  description: string
  rooms: RoomTemplateItem[]
}

export const ROOM_TEMPLATES: RoomTemplate[] = [
  // ===== Appartements =====
  {
    id: 'appt_t1',
    label: 'Appartement T1 / Studio',
    description: '1 pièce + cuisine + SDB + WC',
    rooms: [
      { name: 'Pièce principale', room_type: 'salon' },
      { name: 'Cuisine', room_type: 'cuisine' },
      { name: 'Salle de bain', room_type: 'salle_de_bain' },
      { name: 'WC', room_type: 'wc' },
      { name: 'Entrée', room_type: 'entree' },
    ],
  },
  {
    id: 'appt_t2',
    label: 'Appartement T2',
    description: 'Salon + 1 chambre',
    rooms: [
      { name: 'Salon', room_type: 'salon' },
      { name: 'Chambre', room_type: 'chambre' },
      { name: 'Cuisine', room_type: 'cuisine' },
      { name: 'Salle de bain', room_type: 'salle_de_bain' },
      { name: 'WC', room_type: 'wc' },
      { name: 'Entrée', room_type: 'entree' },
    ],
  },
  {
    id: 'appt_t3',
    label: 'Appartement T3',
    description: 'Salon + 2 chambres',
    rooms: [
      { name: 'Salon', room_type: 'salon' },
      { name: 'Chambre 1', room_type: 'chambre' },
      { name: 'Chambre 2', room_type: 'chambre' },
      { name: 'Cuisine', room_type: 'cuisine' },
      { name: 'Salle de bain', room_type: 'salle_de_bain' },
      { name: 'WC', room_type: 'wc' },
      { name: 'Entrée', room_type: 'entree' },
      { name: 'Couloir', room_type: 'couloir' },
    ],
  },
  {
    id: 'appt_t4',
    label: 'Appartement T4',
    description: 'Salon + 3 chambres',
    rooms: [
      { name: 'Salon', room_type: 'salon' },
      { name: 'Chambre 1', room_type: 'chambre' },
      { name: 'Chambre 2', room_type: 'chambre' },
      { name: 'Chambre 3', room_type: 'chambre' },
      { name: 'Cuisine', room_type: 'cuisine' },
      { name: 'Salle de bain', room_type: 'salle_de_bain' },
      { name: 'WC', room_type: 'wc' },
      { name: 'Entrée', room_type: 'entree' },
      { name: 'Couloir', room_type: 'couloir' },
    ],
  },
  {
    id: 'appt_t5',
    label: 'Appartement T5+',
    description: 'Salon + 4 chambres + SDB séparées',
    rooms: [
      { name: 'Salon / Séjour', room_type: 'sejour' },
      { name: 'Chambre 1', room_type: 'chambre' },
      { name: 'Chambre 2', room_type: 'chambre' },
      { name: 'Chambre 3', room_type: 'chambre' },
      { name: 'Chambre 4', room_type: 'chambre' },
      { name: 'Cuisine', room_type: 'cuisine' },
      { name: 'Salle de bain principale', room_type: 'salle_de_bain' },
      { name: 'Salle d\'eau', room_type: 'salle_de_bain' },
      { name: 'WC', room_type: 'wc' },
      { name: 'Entrée', room_type: 'entree' },
      { name: 'Couloir', room_type: 'couloir' },
      { name: 'Buanderie', room_type: 'buanderie' },
    ],
  },

  // ===== Maisons =====
  {
    id: 'maison_t3',
    label: 'Maison T3',
    description: '2 chambres + extérieur',
    rooms: [
      { name: 'Salon / Séjour', room_type: 'sejour' },
      { name: 'Cuisine', room_type: 'cuisine' },
      { name: 'Chambre 1', room_type: 'chambre' },
      { name: 'Chambre 2', room_type: 'chambre' },
      { name: 'Salle de bain', room_type: 'salle_de_bain' },
      { name: 'WC', room_type: 'wc' },
      { name: 'Entrée', room_type: 'entree' },
      { name: 'Couloir', room_type: 'couloir' },
      { name: 'Garage', room_type: 'garage' },
      { name: 'Grenier / Combles', room_type: 'grenier' },
    ],
  },
  {
    id: 'maison_t4',
    label: 'Maison T4',
    description: '3 chambres + 2 niveaux',
    rooms: [
      { name: 'Salon / Séjour', room_type: 'sejour' },
      { name: 'Cuisine', room_type: 'cuisine' },
      { name: 'Chambre 1', room_type: 'chambre' },
      { name: 'Chambre 2', room_type: 'chambre' },
      { name: 'Chambre 3', room_type: 'chambre' },
      { name: 'Salle de bain', room_type: 'salle_de_bain' },
      { name: 'WC', room_type: 'wc' },
      { name: 'Entrée', room_type: 'entree' },
      { name: 'Couloir', room_type: 'couloir' },
      { name: 'Buanderie', room_type: 'buanderie' },
      { name: 'Garage', room_type: 'garage' },
      { name: 'Cave', room_type: 'cave' },
      { name: 'Grenier / Combles', room_type: 'grenier' },
    ],
  },
  {
    id: 'maison_t5',
    label: 'Maison T5+',
    description: '4 chambres + dépendances',
    rooms: [
      { name: 'Salon', room_type: 'salon' },
      { name: 'Séjour', room_type: 'sejour' },
      { name: 'Cuisine', room_type: 'cuisine' },
      { name: 'Chambre 1', room_type: 'chambre' },
      { name: 'Chambre 2', room_type: 'chambre' },
      { name: 'Chambre 3', room_type: 'chambre' },
      { name: 'Chambre 4', room_type: 'chambre' },
      { name: 'Salle de bain principale', room_type: 'salle_de_bain' },
      { name: 'Salle d\'eau', room_type: 'salle_de_bain' },
      { name: 'WC', room_type: 'wc' },
      { name: 'Entrée', room_type: 'entree' },
      { name: 'Couloir', room_type: 'couloir' },
      { name: 'Buanderie', room_type: 'buanderie' },
      { name: 'Garage', room_type: 'garage' },
      { name: 'Cave', room_type: 'cave' },
      { name: 'Grenier / Combles', room_type: 'grenier' },
      { name: 'Terrasse', room_type: 'terrasse' },
    ],
  },
]

export function getTemplate(id: string): RoomTemplate | undefined {
  return ROOM_TEMPLATES.find((t) => t.id === id)
}
