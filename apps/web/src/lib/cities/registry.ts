/**
 * Registry villes France pour pages programmatiques SEO.
 *
 * Source canonique pour /diagnostic/[type]/[ville], /prix/[type]/[ville],
 * /urgent/[ville], /comparatif/[type]/[ville], /audit-energetique/[ville],
 * /maprimerenov/[ville] et sitemaps associés.
 *
 * V1 — 213 villes priorisées :
 *  - top 50  : métropoles + grandes villes (priority 'top')
 *  - mid 100 : préfectures secondaires + villes 30k+ (priority 'mid')
 *  - low 60  : villes 10-30k habitants stratégiques (priority 'low')
 *
 * Migration vers table Supabase `cities` prévue M3-M4 (sprint SEO local).
 * Coordonnées lat/lng issues d'OpenStreetMap / data.gouv (CC-BY).
 *
 * Le champ `neighbors` (jusqu'à 8 slugs voisins) sert au maillage interne :
 *  - ne pointe que vers des villes présentes dans ce registry
 *  - choix qualitatif : voisinage géographique + lien économique
 */

export type CityPriority = 'top' | 'mid' | 'low'

export interface City {
  /** Slug URL kebab-case, sans accent ni espace. */
  readonly slug: string
  /** Nom canonique avec accents et majuscule. */
  readonly name: string
  /** Code postal principal (5 chiffres). */
  readonly postalCode: string
  /** Code INSEE 5 chiffres (FR métropolitaine). */
  readonly inseeCode: string
  /** Code département 2-3 chiffres. */
  readonly dept: string
  /** Slug région nouvelle (kebab-case). */
  readonly region: string
  /** Population INSEE recensement le plus récent. */
  readonly population: number
  /** Latitude WGS84. */
  readonly lat: number
  /** Longitude WGS84. */
  readonly lng: number
  /** Slugs de 3-8 villes voisines pour maillage interne. */
  readonly neighbors: ReadonlyArray<string>
  /** Niveau de priorité SEO (sitemap + crawl). */
  readonly priority: CityPriority
}

/**
 * 213 villes prioritaires France.
 * Sorted top → mid → low.
 */
export const CITIES: ReadonlyArray<City> = [
  // ─────────────────────────────────────────────────────────────────────────
  // TOP 50 — métropoles et grandes villes (population > 100k ou stratégique)
  // ─────────────────────────────────────────────────────────────────────────
  { slug: 'paris', name: 'Paris', postalCode: '75001', inseeCode: '75056', dept: '75', region: 'ile-de-france', population: 2102650, lat: 48.8566, lng: 2.3522, neighbors: ['boulogne-billancourt', 'nanterre', 'saint-denis', 'versailles', 'argenteuil'], priority: 'top' },
  { slug: 'marseille', name: 'Marseille', postalCode: '13001', inseeCode: '13055', dept: '13', region: 'paca', population: 873076, lat: 43.2965, lng: 5.3698, neighbors: ['aix-en-provence', 'aubagne', 'toulon', 'avignon'], priority: 'top' },
  { slug: 'lyon', name: 'Lyon', postalCode: '69001', inseeCode: '69123', dept: '69', region: 'auvergne-rhone-alpes', population: 522969, lat: 45.764, lng: 4.8357, neighbors: ['villeurbanne', 'saint-etienne', 'vienne', 'bourg-en-bresse'], priority: 'top' },
  { slug: 'toulouse', name: 'Toulouse', postalCode: '31000', inseeCode: '31555', dept: '31', region: 'occitanie', population: 493465, lat: 43.6047, lng: 1.4442, neighbors: ['blagnac', 'colomiers', 'albi', 'montauban'], priority: 'top' },
  { slug: 'nice', name: 'Nice', postalCode: '06000', inseeCode: '06088', dept: '06', region: 'paca', population: 342669, lat: 43.7102, lng: 7.262, neighbors: ['antibes', 'cannes', 'cagnes-sur-mer', 'grasse'], priority: 'top' },
  { slug: 'nantes', name: 'Nantes', postalCode: '44000', inseeCode: '44109', dept: '44', region: 'pays-de-la-loire', population: 320732, lat: 47.2184, lng: -1.5536, neighbors: ['saint-nazaire', 'reze', 'la-roche-sur-yon', 'angers'], priority: 'top' },
  { slug: 'montpellier', name: 'Montpellier', postalCode: '34000', inseeCode: '34172', dept: '34', region: 'occitanie', population: 299096, lat: 43.6109, lng: 3.8772, neighbors: ['beziers', 'nimes', 'sete', 'lunel'], priority: 'top' },
  { slug: 'strasbourg', name: 'Strasbourg', postalCode: '67000', inseeCode: '67482', dept: '67', region: 'grand-est', population: 287228, lat: 48.5734, lng: 7.7521, neighbors: ['mulhouse', 'colmar', 'metz', 'haguenau'], priority: 'top' },
  { slug: 'bordeaux', name: 'Bordeaux', postalCode: '33000', inseeCode: '33063', dept: '33', region: 'nouvelle-aquitaine', population: 260958, lat: 44.8378, lng: -0.5792, neighbors: ['merignac', 'pessac', 'arcachon', 'libourne'], priority: 'top' },
  { slug: 'lille', name: 'Lille', postalCode: '59000', inseeCode: '59350', dept: '59', region: 'hauts-de-france', population: 234475, lat: 50.6292, lng: 3.0573, neighbors: ['roubaix', 'tourcoing', 'villeneuve-d-ascq', 'dunkerque'], priority: 'top' },
  { slug: 'rennes', name: 'Rennes', postalCode: '35000', inseeCode: '35238', dept: '35', region: 'bretagne', population: 220488, lat: 48.1173, lng: -1.6778, neighbors: ['saint-malo', 'vannes', 'brest', 'lorient'], priority: 'top' },
  { slug: 'reims', name: 'Reims', postalCode: '51100', inseeCode: '51454', dept: '51', region: 'grand-est', population: 182211, lat: 49.2583, lng: 4.0317, neighbors: ['chalons-en-champagne', 'epernay', 'troyes', 'soissons'], priority: 'top' },
  { slug: 'saint-etienne', name: 'Saint-Étienne', postalCode: '42000', inseeCode: '42218', dept: '42', region: 'auvergne-rhone-alpes', population: 173089, lat: 45.4397, lng: 4.3872, neighbors: ['lyon', 'roanne', 'firminy', 'vienne'], priority: 'top' },
  { slug: 'toulon', name: 'Toulon', postalCode: '83000', inseeCode: '83137', dept: '83', region: 'paca', population: 171953, lat: 43.1242, lng: 5.928, neighbors: ['hyeres', 'la-seyne-sur-mer', 'marseille', 'frejus'], priority: 'top' },
  { slug: 'le-havre', name: 'Le Havre', postalCode: '76600', inseeCode: '76351', dept: '76', region: 'normandie', population: 165057, lat: 49.4944, lng: 0.1079, neighbors: ['rouen', 'dieppe', 'caen', 'fecamp'], priority: 'top' },
  { slug: 'grenoble', name: 'Grenoble', postalCode: '38000', inseeCode: '38185', dept: '38', region: 'auvergne-rhone-alpes', population: 158704, lat: 45.1885, lng: 5.7245, neighbors: ['valence', 'chambery', 'voiron', 'echirolles'], priority: 'top' },
  { slug: 'dijon', name: 'Dijon', postalCode: '21000', inseeCode: '21231', dept: '21', region: 'bourgogne-franche-comte', population: 156920, lat: 47.322, lng: 5.0415, neighbors: ['besancon', 'chalon-sur-saone', 'beaune', 'auxerre'], priority: 'top' },
  { slug: 'angers', name: 'Angers', postalCode: '49000', inseeCode: '49007', dept: '49', region: 'pays-de-la-loire', population: 154508, lat: 47.4784, lng: -0.5632, neighbors: ['nantes', 'le-mans', 'cholet', 'saumur'], priority: 'top' },
  { slug: 'nimes', name: 'Nîmes', postalCode: '30000', inseeCode: '30189', dept: '30', region: 'occitanie', population: 148104, lat: 43.8367, lng: 4.3601, neighbors: ['montpellier', 'avignon', 'ales', 'arles'], priority: 'top' },
  { slug: 'villeurbanne', name: 'Villeurbanne', postalCode: '69100', inseeCode: '69266', dept: '69', region: 'auvergne-rhone-alpes', population: 147712, lat: 45.7733, lng: 4.8801, neighbors: ['lyon', 'vaulx-en-velin', 'bron'], priority: 'top' },
  { slug: 'clermont-ferrand', name: 'Clermont-Ferrand', postalCode: '63000', inseeCode: '63113', dept: '63', region: 'auvergne-rhone-alpes', population: 146734, lat: 45.7772, lng: 3.087, neighbors: ['vichy', 'thiers', 'aurillac', 'moulins'], priority: 'top' },
  { slug: 'aix-en-provence', name: 'Aix-en-Provence', postalCode: '13100', inseeCode: '13001', dept: '13', region: 'paca', population: 143006, lat: 43.5297, lng: 5.4474, neighbors: ['marseille', 'aubagne', 'salon-de-provence', 'pertuis'], priority: 'top' },
  { slug: 'brest', name: 'Brest', postalCode: '29200', inseeCode: '29019', dept: '29', region: 'bretagne', population: 139926, lat: 48.3904, lng: -4.4861, neighbors: ['quimper', 'morlaix', 'lorient', 'rennes'], priority: 'top' },
  { slug: 'le-mans', name: 'Le Mans', postalCode: '72000', inseeCode: '72181', dept: '72', region: 'pays-de-la-loire', population: 142946, lat: 48.0061, lng: 0.1996, neighbors: ['angers', 'tours', 'laval', 'alencon'], priority: 'top' },
  { slug: 'tours', name: 'Tours', postalCode: '37000', inseeCode: '37261', dept: '37', region: 'centre-val-de-loire', population: 137087, lat: 47.3941, lng: 0.6848, neighbors: ['orleans', 'blois', 'le-mans', 'chateauroux'], priority: 'top' },
  { slug: 'amiens', name: 'Amiens', postalCode: '80000', inseeCode: '80021', dept: '80', region: 'hauts-de-france', population: 134057, lat: 49.8941, lng: 2.2958, neighbors: ['beauvais', 'arras', 'abbeville', 'compiegne'], priority: 'top' },
  { slug: 'limoges', name: 'Limoges', postalCode: '87000', inseeCode: '87085', dept: '87', region: 'nouvelle-aquitaine', population: 130876, lat: 45.8336, lng: 1.2611, neighbors: ['poitiers', 'tulle', 'gueret', 'angouleme'], priority: 'top' },
  { slug: 'metz', name: 'Metz', postalCode: '57000', inseeCode: '57463', dept: '57', region: 'grand-est', population: 117565, lat: 49.1193, lng: 6.1757, neighbors: ['nancy', 'thionville', 'verdun', 'forbach'], priority: 'top' },
  { slug: 'besancon', name: 'Besançon', postalCode: '25000', inseeCode: '25056', dept: '25', region: 'bourgogne-franche-comte', population: 116775, lat: 47.2378, lng: 6.0241, neighbors: ['dijon', 'belfort', 'pontarlier', 'vesoul'], priority: 'top' },
  { slug: 'perpignan', name: 'Perpignan', postalCode: '66000', inseeCode: '66136', dept: '66', region: 'occitanie', population: 119188, lat: 42.6886, lng: 2.8949, neighbors: ['narbonne', 'carcassonne', 'beziers', 'ceret'], priority: 'top' },
  { slug: 'orleans', name: 'Orléans', postalCode: '45000', inseeCode: '45234', dept: '45', region: 'centre-val-de-loire', population: 116685, lat: 47.9029, lng: 1.9039, neighbors: ['tours', 'blois', 'chartres', 'montargis'], priority: 'top' },
  { slug: 'rouen', name: 'Rouen', postalCode: '76000', inseeCode: '76540', dept: '76', region: 'normandie', population: 116149, lat: 49.4432, lng: 1.0993, neighbors: ['dieppe', 'le-havre', 'evreux', 'caen'], priority: 'top' },
  { slug: 'mulhouse', name: 'Mulhouse', postalCode: '68100', inseeCode: '68224', dept: '68', region: 'grand-est', population: 108942, lat: 47.7508, lng: 7.3359, neighbors: ['colmar', 'strasbourg', 'belfort', 'altkirch'], priority: 'top' },
  { slug: 'caen', name: 'Caen', postalCode: '14000', inseeCode: '14118', dept: '14', region: 'normandie', population: 106538, lat: 49.1829, lng: -0.3707, neighbors: ['rouen', 'le-havre', 'cherbourg-en-cotentin', 'lisieux'], priority: 'top' },
  { slug: 'nancy', name: 'Nancy', postalCode: '54000', inseeCode: '54395', dept: '54', region: 'grand-est', population: 104592, lat: 48.6921, lng: 6.1844, neighbors: ['metz', 'epinal', 'verdun', 'luneville'], priority: 'top' },
  { slug: 'boulogne-billancourt', name: 'Boulogne-Billancourt', postalCode: '92100', inseeCode: '92012', dept: '92', region: 'ile-de-france', population: 121334, lat: 48.8398, lng: 2.2399, neighbors: ['paris', 'nanterre', 'courbevoie', 'versailles'], priority: 'top' },
  { slug: 'nanterre', name: 'Nanterre', postalCode: '92000', inseeCode: '92050', dept: '92', region: 'ile-de-france', population: 96807, lat: 48.8919, lng: 2.2068, neighbors: ['paris', 'boulogne-billancourt', 'courbevoie', 'argenteuil'], priority: 'top' },
  { slug: 'courbevoie', name: 'Courbevoie', postalCode: '92400', inseeCode: '92026', dept: '92', region: 'ile-de-france', population: 81717, lat: 48.8967, lng: 2.2553, neighbors: ['paris', 'nanterre', 'levallois-perret'], priority: 'top' },
  { slug: 'vitry-sur-seine', name: 'Vitry-sur-Seine', postalCode: '94400', inseeCode: '94081', dept: '94', region: 'ile-de-france', population: 95173, lat: 48.7873, lng: 2.4029, neighbors: ['paris', 'creteil', 'ivry-sur-seine'], priority: 'top' },
  { slug: 'saint-denis', name: 'Saint-Denis', postalCode: '93200', inseeCode: '93066', dept: '93', region: 'ile-de-france', population: 113116, lat: 48.9362, lng: 2.3574, neighbors: ['paris', 'aubervilliers', 'aulnay-sous-bois', 'argenteuil'], priority: 'top' },
  { slug: 'versailles', name: 'Versailles', postalCode: '78000', inseeCode: '78646', dept: '78', region: 'ile-de-france', population: 85771, lat: 48.8014, lng: 2.1301, neighbors: ['paris', 'boulogne-billancourt', 'sevres'], priority: 'top' },
  { slug: 'aulnay-sous-bois', name: 'Aulnay-sous-Bois', postalCode: '93600', inseeCode: '93005', dept: '93', region: 'ile-de-france', population: 88227, lat: 48.9381, lng: 2.4938, neighbors: ['saint-denis', 'aubervilliers', 'le-blanc-mesnil'], priority: 'top' },
  { slug: 'aubervilliers', name: 'Aubervilliers', postalCode: '93300', inseeCode: '93001', dept: '93', region: 'ile-de-france', population: 87331, lat: 48.9135, lng: 2.3837, neighbors: ['paris', 'saint-denis', 'aulnay-sous-bois'], priority: 'top' },
  { slug: 'champigny-sur-marne', name: 'Champigny-sur-Marne', postalCode: '94500', inseeCode: '94017', dept: '94', region: 'ile-de-france', population: 77410, lat: 48.8136, lng: 2.5141, neighbors: ['creteil', 'vitry-sur-seine', 'paris'], priority: 'top' },
  { slug: 'antibes', name: 'Antibes', postalCode: '06600', inseeCode: '06004', dept: '06', region: 'paca', population: 73798, lat: 43.5808, lng: 7.1239, neighbors: ['nice', 'cannes', 'cagnes-sur-mer', 'grasse'], priority: 'top' },
  { slug: 'cannes', name: 'Cannes', postalCode: '06400', inseeCode: '06029', dept: '06', region: 'paca', population: 73603, lat: 43.5528, lng: 7.0174, neighbors: ['antibes', 'grasse', 'mandelieu-la-napoule', 'nice'], priority: 'top' },
  { slug: 'calais', name: 'Calais', postalCode: '62100', inseeCode: '62193', dept: '62', region: 'hauts-de-france', population: 67200, lat: 50.9513, lng: 1.8587, neighbors: ['boulogne-sur-mer', 'dunkerque', 'saint-omer'], priority: 'top' },
  { slug: 'argenteuil', name: 'Argenteuil', postalCode: '95100', inseeCode: '95018', dept: '95', region: 'ile-de-france', population: 110468, lat: 48.9474, lng: 2.2476, neighbors: ['paris', 'cergy', 'saint-denis'], priority: 'top' },
  { slug: 'beziers', name: 'Béziers', postalCode: '34500', inseeCode: '34032', dept: '34', region: 'occitanie', population: 78371, lat: 43.3441, lng: 3.2191, neighbors: ['montpellier', 'narbonne', 'sete', 'agde'], priority: 'top' },
  { slug: 'avignon', name: 'Avignon', postalCode: '84000', inseeCode: '84007', dept: '84', region: 'paca', population: 91143, lat: 43.9493, lng: 4.8055, neighbors: ['nimes', 'orange', 'carpentras', 'arles'], priority: 'top' },
  { slug: 'la-rochelle', name: 'La Rochelle', postalCode: '17000', inseeCode: '17300', dept: '17', region: 'nouvelle-aquitaine', population: 76286, lat: 46.1591, lng: -1.1517, neighbors: ['rochefort', 'niort', 'saintes', 'royan'], priority: 'top' },

  // ─────────────────────────────────────────────────────────────────────────
  // MID — préfectures et villes 30-100k habitants
  // ─────────────────────────────────────────────────────────────────────────
  { slug: 'pau', name: 'Pau', postalCode: '64000', inseeCode: '64445', dept: '64', region: 'nouvelle-aquitaine', population: 75665, lat: 43.2951, lng: -0.3708, neighbors: ['bayonne', 'tarbes', 'oloron-sainte-marie'], priority: 'mid' },
  { slug: 'saint-maur-des-fosses', name: 'Saint-Maur-des-Fossés', postalCode: '94100', inseeCode: '94068', dept: '94', region: 'ile-de-france', population: 75301, lat: 48.8, lng: 2.4937, neighbors: ['paris', 'creteil', 'champigny-sur-marne'], priority: 'mid' },
  { slug: 'cergy', name: 'Cergy', postalCode: '95000', inseeCode: '95127', dept: '95', region: 'ile-de-france', population: 64347, lat: 49.0349, lng: 2.0789, neighbors: ['pontoise', 'argenteuil', 'paris'], priority: 'mid' },
  { slug: 'roubaix', name: 'Roubaix', postalCode: '59100', inseeCode: '59512', dept: '59', region: 'hauts-de-france', population: 98828, lat: 50.6925, lng: 3.1748, neighbors: ['lille', 'tourcoing', 'villeneuve-d-ascq'], priority: 'mid' },
  { slug: 'tourcoing', name: 'Tourcoing', postalCode: '59200', inseeCode: '59599', dept: '59', region: 'hauts-de-france', population: 97442, lat: 50.7236, lng: 3.1612, neighbors: ['lille', 'roubaix', 'dunkerque'], priority: 'mid' },
  { slug: 'villeneuve-d-ascq', name: 'Villeneuve-d’Ascq', postalCode: '59650', inseeCode: '59009', dept: '59', region: 'hauts-de-france', population: 62308, lat: 50.6191, lng: 3.1296, neighbors: ['lille', 'roubaix', 'tourcoing'], priority: 'mid' },
  { slug: 'dunkerque', name: 'Dunkerque', postalCode: '59140', inseeCode: '59183', dept: '59', region: 'hauts-de-france', population: 86279, lat: 51.0344, lng: 2.3768, neighbors: ['calais', 'lille', 'boulogne-sur-mer'], priority: 'mid' },
  { slug: 'fort-de-france', name: 'Fort-de-France', postalCode: '97200', inseeCode: '97209', dept: '972', region: 'martinique', population: 75516, lat: 14.6161, lng: -61.0588, neighbors: ['le-lamentin', 'schoelcher'], priority: 'mid' },
  { slug: 'creteil', name: 'Créteil', postalCode: '94000', inseeCode: '94028', dept: '94', region: 'ile-de-france', population: 92675, lat: 48.79, lng: 2.4658, neighbors: ['paris', 'champigny-sur-marne', 'vitry-sur-seine'], priority: 'mid' },
  { slug: 'colombes', name: 'Colombes', postalCode: '92700', inseeCode: '92025', dept: '92', region: 'ile-de-france', population: 86058, lat: 48.9234, lng: 2.2547, neighbors: ['nanterre', 'argenteuil', 'courbevoie'], priority: 'mid' },
  { slug: 'asnieres-sur-seine', name: 'Asnières-sur-Seine', postalCode: '92600', inseeCode: '92004', dept: '92', region: 'ile-de-france', population: 86742, lat: 48.9162, lng: 2.2858, neighbors: ['paris', 'colombes', 'courbevoie'], priority: 'mid' },
  { slug: 'rueil-malmaison', name: 'Rueil-Malmaison', postalCode: '92500', inseeCode: '92063', dept: '92', region: 'ile-de-france', population: 79422, lat: 48.8769, lng: 2.18, neighbors: ['nanterre', 'paris', 'versailles'], priority: 'mid' },
  { slug: 'cherbourg-en-cotentin', name: 'Cherbourg-en-Cotentin', postalCode: '50100', inseeCode: '50129', dept: '50', region: 'normandie', population: 78549, lat: 49.6337, lng: -1.622, neighbors: ['caen', 'saint-lo'], priority: 'mid' },
  { slug: 'poitiers', name: 'Poitiers', postalCode: '86000', inseeCode: '86194', dept: '86', region: 'nouvelle-aquitaine', population: 88291, lat: 46.5802, lng: 0.3404, neighbors: ['niort', 'limoges', 'angouleme', 'tours'], priority: 'mid' },
  { slug: 'la-seyne-sur-mer', name: 'La Seyne-sur-Mer', postalCode: '83500', inseeCode: '83126', dept: '83', region: 'paca', population: 65691, lat: 43.1018, lng: 5.881, neighbors: ['toulon', 'hyeres'], priority: 'mid' },
  { slug: 'hyeres', name: 'Hyères', postalCode: '83400', inseeCode: '83069', dept: '83', region: 'paca', population: 56799, lat: 43.1199, lng: 6.1287, neighbors: ['toulon', 'la-seyne-sur-mer', 'frejus'], priority: 'mid' },
  { slug: 'frejus', name: 'Fréjus', postalCode: '83600', inseeCode: '83061', dept: '83', region: 'paca', population: 54023, lat: 43.4332, lng: 6.7369, neighbors: ['hyeres', 'saint-raphael', 'cannes'], priority: 'mid' },
  { slug: 'aubagne', name: 'Aubagne', postalCode: '13400', inseeCode: '13005', dept: '13', region: 'paca', population: 47087, lat: 43.2925, lng: 5.5703, neighbors: ['marseille', 'aix-en-provence', 'la-ciotat'], priority: 'mid' },
  { slug: 'salon-de-provence', name: 'Salon-de-Provence', postalCode: '13300', inseeCode: '13103', dept: '13', region: 'paca', population: 45754, lat: 43.6418, lng: 5.0974, neighbors: ['aix-en-provence', 'arles', 'avignon'], priority: 'mid' },
  { slug: 'arles', name: 'Arles', postalCode: '13200', inseeCode: '13004', dept: '13', region: 'paca', population: 50467, lat: 43.6768, lng: 4.6309, neighbors: ['nimes', 'avignon', 'salon-de-provence'], priority: 'mid' },
  { slug: 'cagnes-sur-mer', name: 'Cagnes-sur-Mer', postalCode: '06800', inseeCode: '06027', dept: '06', region: 'paca', population: 50798, lat: 43.6635, lng: 7.1488, neighbors: ['nice', 'antibes', 'grasse'], priority: 'mid' },
  { slug: 'grasse', name: 'Grasse', postalCode: '06130', inseeCode: '06069', dept: '06', region: 'paca', population: 50409, lat: 43.6584, lng: 6.9225, neighbors: ['cannes', 'antibes', 'cagnes-sur-mer'], priority: 'mid' },
  { slug: 'colmar', name: 'Colmar', postalCode: '68000', inseeCode: '68066', dept: '68', region: 'grand-est', population: 68805, lat: 48.0794, lng: 7.3585, neighbors: ['mulhouse', 'strasbourg', 'selestat'], priority: 'mid' },
  { slug: 'narbonne', name: 'Narbonne', postalCode: '11100', inseeCode: '11262', dept: '11', region: 'occitanie', population: 56544, lat: 43.1841, lng: 3.0036, neighbors: ['perpignan', 'carcassonne', 'beziers'], priority: 'mid' },
  { slug: 'carcassonne', name: 'Carcassonne', postalCode: '11000', inseeCode: '11069', dept: '11', region: 'occitanie', population: 46031, lat: 43.2128, lng: 2.353, neighbors: ['narbonne', 'castelnaudary', 'toulouse'], priority: 'mid' },
  { slug: 'albi', name: 'Albi', postalCode: '81000', inseeCode: '81004', dept: '81', region: 'occitanie', population: 49531, lat: 43.9298, lng: 2.1483, neighbors: ['toulouse', 'castres', 'montauban'], priority: 'mid' },
  { slug: 'castres', name: 'Castres', postalCode: '81100', inseeCode: '81065', dept: '81', region: 'occitanie', population: 41382, lat: 43.6047, lng: 2.2402, neighbors: ['albi', 'mazamet', 'toulouse'], priority: 'mid' },
  { slug: 'montauban', name: 'Montauban', postalCode: '82000', inseeCode: '82121', dept: '82', region: 'occitanie', population: 61372, lat: 44.0214, lng: 1.3563, neighbors: ['toulouse', 'cahors', 'agen'], priority: 'mid' },
  { slug: 'agen', name: 'Agen', postalCode: '47000', inseeCode: '47001', dept: '47', region: 'nouvelle-aquitaine', population: 32485, lat: 44.2014, lng: 0.6184, neighbors: ['montauban', 'villeneuve-sur-lot', 'bordeaux'], priority: 'mid' },
  { slug: 'cahors', name: 'Cahors', postalCode: '46000', inseeCode: '46042', dept: '46', region: 'occitanie', population: 19453, lat: 44.4474, lng: 1.4407, neighbors: ['montauban', 'rodez', 'figeac'], priority: 'mid' },
  { slug: 'rodez', name: 'Rodez', postalCode: '12000', inseeCode: '12202', dept: '12', region: 'occitanie', population: 24551, lat: 44.3506, lng: 2.5751, neighbors: ['cahors', 'millau', 'aurillac'], priority: 'mid' },
  { slug: 'tarbes', name: 'Tarbes', postalCode: '65000', inseeCode: '65440', dept: '65', region: 'occitanie', population: 40826, lat: 43.2329, lng: 0.0782, neighbors: ['pau', 'lourdes'], priority: 'mid' },
  { slug: 'bayonne', name: 'Bayonne', postalCode: '64100', inseeCode: '64102', dept: '64', region: 'nouvelle-aquitaine', population: 51894, lat: 43.4929, lng: -1.4748, neighbors: ['pau', 'biarritz', 'anglet'], priority: 'mid' },
  { slug: 'biarritz', name: 'Biarritz', postalCode: '64200', inseeCode: '64122', dept: '64', region: 'nouvelle-aquitaine', population: 25404, lat: 43.4832, lng: -1.5586, neighbors: ['bayonne', 'anglet', 'pau'], priority: 'mid' },
  { slug: 'anglet', name: 'Anglet', postalCode: '64600', inseeCode: '64024', dept: '64', region: 'nouvelle-aquitaine', population: 39233, lat: 43.485, lng: -1.5169, neighbors: ['bayonne', 'biarritz'], priority: 'mid' },
  { slug: 'merignac', name: 'Mérignac', postalCode: '33700', inseeCode: '33281', dept: '33', region: 'nouvelle-aquitaine', population: 72672, lat: 44.8333, lng: -0.6333, neighbors: ['bordeaux', 'pessac', 'le-bouscat'], priority: 'mid' },
  { slug: 'pessac', name: 'Pessac', postalCode: '33600', inseeCode: '33318', dept: '33', region: 'nouvelle-aquitaine', population: 64069, lat: 44.806, lng: -0.631, neighbors: ['bordeaux', 'merignac', 'talence'], priority: 'mid' },
  { slug: 'talence', name: 'Talence', postalCode: '33400', inseeCode: '33522', dept: '33', region: 'nouvelle-aquitaine', population: 43781, lat: 44.806, lng: -0.5797, neighbors: ['bordeaux', 'pessac'], priority: 'mid' },
  { slug: 'arcachon', name: 'Arcachon', postalCode: '33120', inseeCode: '33009', dept: '33', region: 'nouvelle-aquitaine', population: 10416, lat: 44.6585, lng: -1.1683, neighbors: ['bordeaux', 'la-teste-de-buch'], priority: 'mid' },
  { slug: 'libourne', name: 'Libourne', postalCode: '33500', inseeCode: '33243', dept: '33', region: 'nouvelle-aquitaine', population: 24985, lat: 44.9136, lng: -0.2422, neighbors: ['bordeaux', 'saint-emilion'], priority: 'mid' },
  { slug: 'angouleme', name: 'Angoulême', postalCode: '16000', inseeCode: '16015', dept: '16', region: 'nouvelle-aquitaine', population: 41955, lat: 45.6489, lng: 0.1562, neighbors: ['limoges', 'cognac', 'poitiers'], priority: 'mid' },
  { slug: 'cognac', name: 'Cognac', postalCode: '16100', inseeCode: '16102', dept: '16', region: 'nouvelle-aquitaine', population: 18510, lat: 45.6953, lng: -0.3296, neighbors: ['angouleme', 'saintes'], priority: 'mid' },
  { slug: 'saintes', name: 'Saintes', postalCode: '17100', inseeCode: '17415', dept: '17', region: 'nouvelle-aquitaine', population: 24798, lat: 45.7459, lng: -0.6336, neighbors: ['la-rochelle', 'rochefort', 'cognac'], priority: 'mid' },
  { slug: 'rochefort', name: 'Rochefort', postalCode: '17300', inseeCode: '17299', dept: '17', region: 'nouvelle-aquitaine', population: 23816, lat: 45.9408, lng: -0.9645, neighbors: ['la-rochelle', 'saintes', 'royan'], priority: 'mid' },
  { slug: 'royan', name: 'Royan', postalCode: '17200', inseeCode: '17306', dept: '17', region: 'nouvelle-aquitaine', population: 17789, lat: 45.6276, lng: -1.0254, neighbors: ['la-rochelle', 'saintes', 'rochefort'], priority: 'mid' },
  { slug: 'niort', name: 'Niort', postalCode: '79000', inseeCode: '79191', dept: '79', region: 'nouvelle-aquitaine', population: 58660, lat: 46.323, lng: -0.4622, neighbors: ['la-rochelle', 'poitiers'], priority: 'mid' },
  { slug: 'tulle', name: 'Tulle', postalCode: '19000', inseeCode: '19272', dept: '19', region: 'nouvelle-aquitaine', population: 14587, lat: 45.2667, lng: 1.7714, neighbors: ['brive-la-gaillarde', 'limoges'], priority: 'mid' },
  { slug: 'brive-la-gaillarde', name: 'Brive-la-Gaillarde', postalCode: '19100', inseeCode: '19031', dept: '19', region: 'nouvelle-aquitaine', population: 46961, lat: 45.1591, lng: 1.5331, neighbors: ['tulle', 'limoges'], priority: 'mid' },
  { slug: 'gueret', name: 'Guéret', postalCode: '23000', inseeCode: '23096', dept: '23', region: 'nouvelle-aquitaine', population: 12895, lat: 46.1707, lng: 1.8732, neighbors: ['limoges', 'montlucon'], priority: 'low' },
  { slug: 'chartres', name: 'Chartres', postalCode: '28000', inseeCode: '28085', dept: '28', region: 'centre-val-de-loire', population: 38752, lat: 48.4439, lng: 1.4892, neighbors: ['orleans', 'le-mans'], priority: 'mid' },
  { slug: 'blois', name: 'Blois', postalCode: '41000', inseeCode: '41018', dept: '41', region: 'centre-val-de-loire', population: 45871, lat: 47.586, lng: 1.336, neighbors: ['tours', 'orleans', 'chateauroux'], priority: 'mid' },
  { slug: 'chateauroux', name: 'Châteauroux', postalCode: '36000', inseeCode: '36044', dept: '36', region: 'centre-val-de-loire', population: 43442, lat: 46.8125, lng: 1.6913, neighbors: ['blois', 'limoges', 'tours'], priority: 'mid' },
  { slug: 'bourges', name: 'Bourges', postalCode: '18000', inseeCode: '18033', dept: '18', region: 'centre-val-de-loire', population: 64668, lat: 47.0833, lng: 2.3964, neighbors: ['orleans', 'chateauroux', 'nevers'], priority: 'mid' },
  { slug: 'nevers', name: 'Nevers', postalCode: '58000', inseeCode: '58194', dept: '58', region: 'bourgogne-franche-comte', population: 32700, lat: 46.9896, lng: 3.1628, neighbors: ['bourges', 'moulins'], priority: 'mid' },
  { slug: 'moulins', name: 'Moulins', postalCode: '03000', inseeCode: '03190', dept: '03', region: 'auvergne-rhone-alpes', population: 19478, lat: 46.5667, lng: 3.3333, neighbors: ['nevers', 'vichy', 'montlucon'], priority: 'mid' },
  { slug: 'vichy', name: 'Vichy', postalCode: '03200', inseeCode: '03310', dept: '03', region: 'auvergne-rhone-alpes', population: 25068, lat: 46.1264, lng: 3.4222, neighbors: ['clermont-ferrand', 'moulins'], priority: 'mid' },
  { slug: 'montlucon', name: 'Montluçon', postalCode: '03100', inseeCode: '03185', dept: '03', region: 'auvergne-rhone-alpes', population: 33424, lat: 46.3398, lng: 2.6044, neighbors: ['moulins', 'gueret'], priority: 'mid' },
  { slug: 'aurillac', name: 'Aurillac', postalCode: '15000', inseeCode: '15014', dept: '15', region: 'auvergne-rhone-alpes', population: 25712, lat: 44.9319, lng: 2.4444, neighbors: ['clermont-ferrand', 'rodez'], priority: 'mid' },
  { slug: 'thiers', name: 'Thiers', postalCode: '63300', inseeCode: '63430', dept: '63', region: 'auvergne-rhone-alpes', population: 11206, lat: 45.8567, lng: 3.5483, neighbors: ['clermont-ferrand', 'vichy'], priority: 'low' },
  { slug: 'roanne', name: 'Roanne', postalCode: '42300', inseeCode: '42187', dept: '42', region: 'auvergne-rhone-alpes', population: 33857, lat: 46.0367, lng: 4.0683, neighbors: ['saint-etienne', 'lyon'], priority: 'mid' },
  { slug: 'vienne', name: 'Vienne', postalCode: '38200', inseeCode: '38544', dept: '38', region: 'auvergne-rhone-alpes', population: 30058, lat: 45.5239, lng: 4.875, neighbors: ['lyon', 'grenoble', 'saint-etienne'], priority: 'mid' },
  { slug: 'bourg-en-bresse', name: 'Bourg-en-Bresse', postalCode: '01000', inseeCode: '01053', dept: '01', region: 'auvergne-rhone-alpes', population: 41642, lat: 46.205, lng: 5.225, neighbors: ['lyon', 'macon'], priority: 'mid' },
  { slug: 'macon', name: 'Mâcon', postalCode: '71000', inseeCode: '71270', dept: '71', region: 'bourgogne-franche-comte', population: 33285, lat: 46.3036, lng: 4.8333, neighbors: ['bourg-en-bresse', 'chalon-sur-saone', 'lyon'], priority: 'mid' },
  { slug: 'chalon-sur-saone', name: 'Chalon-sur-Saône', postalCode: '71100', inseeCode: '71076', dept: '71', region: 'bourgogne-franche-comte', population: 45134, lat: 46.7806, lng: 4.8531, neighbors: ['dijon', 'macon', 'beaune'], priority: 'mid' },
  { slug: 'beaune', name: 'Beaune', postalCode: '21200', inseeCode: '21054', dept: '21', region: 'bourgogne-franche-comte', population: 20943, lat: 47.025, lng: 4.8389, neighbors: ['dijon', 'chalon-sur-saone'], priority: 'mid' },
  { slug: 'auxerre', name: 'Auxerre', postalCode: '89000', inseeCode: '89024', dept: '89', region: 'bourgogne-franche-comte', population: 33856, lat: 47.7981, lng: 3.5736, neighbors: ['dijon', 'sens', 'troyes'], priority: 'mid' },
  { slug: 'sens', name: 'Sens', postalCode: '89100', inseeCode: '89387', dept: '89', region: 'bourgogne-franche-comte', population: 25366, lat: 48.1972, lng: 3.2833, neighbors: ['auxerre', 'troyes'], priority: 'mid' },
  { slug: 'troyes', name: 'Troyes', postalCode: '10000', inseeCode: '10387', dept: '10', region: 'grand-est', population: 61996, lat: 48.2973, lng: 4.0744, neighbors: ['reims', 'auxerre', 'sens'], priority: 'mid' },
  { slug: 'chalons-en-champagne', name: 'Châlons-en-Champagne', postalCode: '51000', inseeCode: '51108', dept: '51', region: 'grand-est', population: 44246, lat: 48.9569, lng: 4.3631, neighbors: ['reims', 'epernay'], priority: 'mid' },
  { slug: 'epernay', name: 'Épernay', postalCode: '51200', inseeCode: '51230', dept: '51', region: 'grand-est', population: 23073, lat: 49.0428, lng: 3.9606, neighbors: ['reims', 'chalons-en-champagne'], priority: 'mid' },
  { slug: 'thionville', name: 'Thionville', postalCode: '57100', inseeCode: '57672', dept: '57', region: 'grand-est', population: 40701, lat: 49.3578, lng: 6.1683, neighbors: ['metz', 'forbach'], priority: 'mid' },
  { slug: 'forbach', name: 'Forbach', postalCode: '57600', inseeCode: '57227', dept: '57', region: 'grand-est', population: 21311, lat: 49.1869, lng: 6.9008, neighbors: ['metz', 'thionville', 'saint-avold'], priority: 'mid' },
  { slug: 'verdun', name: 'Verdun', postalCode: '55100', inseeCode: '55545', dept: '55', region: 'grand-est', population: 16578, lat: 49.16, lng: 5.3833, neighbors: ['metz', 'nancy'], priority: 'mid' },
  { slug: 'epinal', name: 'Épinal', postalCode: '88000', inseeCode: '88160', dept: '88', region: 'grand-est', population: 31337, lat: 48.1736, lng: 6.4506, neighbors: ['nancy', 'mulhouse'], priority: 'mid' },
  { slug: 'belfort', name: 'Belfort', postalCode: '90000', inseeCode: '90010', dept: '90', region: 'bourgogne-franche-comte', population: 47816, lat: 47.638, lng: 6.8628, neighbors: ['besancon', 'mulhouse', 'montbeliard'], priority: 'mid' },
  { slug: 'montbeliard', name: 'Montbéliard', postalCode: '25200', inseeCode: '25388', dept: '25', region: 'bourgogne-franche-comte', population: 25395, lat: 47.5103, lng: 6.7986, neighbors: ['belfort', 'besancon'], priority: 'mid' },
  { slug: 'vesoul', name: 'Vesoul', postalCode: '70000', inseeCode: '70550', dept: '70', region: 'bourgogne-franche-comte', population: 15239, lat: 47.6228, lng: 6.155, neighbors: ['besancon', 'epinal'], priority: 'low' },
  { slug: 'pontarlier', name: 'Pontarlier', postalCode: '25300', inseeCode: '25462', dept: '25', region: 'bourgogne-franche-comte', population: 17539, lat: 46.9089, lng: 6.3553, neighbors: ['besancon'], priority: 'low' },
  { slug: 'lons-le-saunier', name: 'Lons-le-Saunier', postalCode: '39000', inseeCode: '39300', dept: '39', region: 'bourgogne-franche-comte', population: 16863, lat: 46.6747, lng: 5.5544, neighbors: ['besancon', 'macon'], priority: 'low' },
  { slug: 'chambery', name: 'Chambéry', postalCode: '73000', inseeCode: '73065', dept: '73', region: 'auvergne-rhone-alpes', population: 59490, lat: 45.5646, lng: 5.9178, neighbors: ['grenoble', 'annecy', 'aix-les-bains'], priority: 'mid' },
  { slug: 'annecy', name: 'Annecy', postalCode: '74000', inseeCode: '74010', dept: '74', region: 'auvergne-rhone-alpes', population: 130721, lat: 45.8992, lng: 6.1294, neighbors: ['chambery', 'thonon-les-bains'], priority: 'mid' },
  { slug: 'thonon-les-bains', name: 'Thonon-les-Bains', postalCode: '74200', inseeCode: '74281', dept: '74', region: 'auvergne-rhone-alpes', population: 35994, lat: 46.3686, lng: 6.4794, neighbors: ['annecy', 'evian-les-bains'], priority: 'mid' },
  { slug: 'aix-les-bains', name: 'Aix-les-Bains', postalCode: '73100', inseeCode: '73008', dept: '73', region: 'auvergne-rhone-alpes', population: 30659, lat: 45.6886, lng: 5.9156, neighbors: ['chambery', 'annecy'], priority: 'mid' },
  { slug: 'valence', name: 'Valence', postalCode: '26000', inseeCode: '26362', dept: '26', region: 'auvergne-rhone-alpes', population: 64483, lat: 44.9333, lng: 4.8917, neighbors: ['grenoble', 'montelimar', 'lyon'], priority: 'mid' },
  { slug: 'montelimar', name: 'Montélimar', postalCode: '26200', inseeCode: '26198', dept: '26', region: 'auvergne-rhone-alpes', population: 39998, lat: 44.5567, lng: 4.7508, neighbors: ['valence', 'avignon', 'orange'], priority: 'mid' },
  { slug: 'orange', name: 'Orange', postalCode: '84100', inseeCode: '84087', dept: '84', region: 'paca', population: 28919, lat: 44.1369, lng: 4.8086, neighbors: ['avignon', 'montelimar', 'carpentras'], priority: 'mid' },
  { slug: 'carpentras', name: 'Carpentras', postalCode: '84200', inseeCode: '84031', dept: '84', region: 'paca', population: 28798, lat: 44.0553, lng: 5.0481, neighbors: ['avignon', 'orange'], priority: 'mid' },
  { slug: 'pertuis', name: 'Pertuis', postalCode: '84120', inseeCode: '84089', dept: '84', region: 'paca', population: 21130, lat: 43.6939, lng: 5.5031, neighbors: ['aix-en-provence'], priority: 'low' },
  { slug: 'mandelieu-la-napoule', name: 'Mandelieu-la-Napoule', postalCode: '06210', inseeCode: '06079', dept: '06', region: 'paca', population: 22506, lat: 43.5461, lng: 6.9389, neighbors: ['cannes', 'grasse'], priority: 'low' },
  { slug: 'saint-raphael', name: 'Saint-Raphaël', postalCode: '83700', inseeCode: '83118', dept: '83', region: 'paca', population: 35671, lat: 43.4253, lng: 6.7686, neighbors: ['frejus', 'cannes'], priority: 'mid' },
  { slug: 'gap', name: 'Gap', postalCode: '05000', inseeCode: '05061', dept: '05', region: 'paca', population: 41077, lat: 44.5594, lng: 6.0786, neighbors: ['grenoble'], priority: 'mid' },
  { slug: 'digne-les-bains', name: 'Digne-les-Bains', postalCode: '04000', inseeCode: '04070', dept: '04', region: 'paca', population: 16395, lat: 44.0928, lng: 6.2353, neighbors: ['gap', 'manosque'], priority: 'low' },
  { slug: 'manosque', name: 'Manosque', postalCode: '04100', inseeCode: '04112', dept: '04', region: 'paca', population: 21712, lat: 43.8294, lng: 5.7842, neighbors: ['aix-en-provence', 'digne-les-bains'], priority: 'low' },
  { slug: 'la-ciotat', name: 'La Ciotat', postalCode: '13600', inseeCode: '13028', dept: '13', region: 'paca', population: 35970, lat: 43.1747, lng: 5.6047, neighbors: ['aubagne', 'marseille'], priority: 'mid' },
  { slug: 'ales', name: 'Alès', postalCode: '30100', inseeCode: '30007', dept: '30', region: 'occitanie', population: 41037, lat: 44.1278, lng: 4.0817, neighbors: ['nimes', 'avignon'], priority: 'mid' },
  { slug: 'sete', name: 'Sète', postalCode: '34200', inseeCode: '34301', dept: '34', region: 'occitanie', population: 44558, lat: 43.4031, lng: 3.6928, neighbors: ['montpellier', 'beziers', 'agde'], priority: 'mid' },
  { slug: 'agde', name: 'Agde', postalCode: '34300', inseeCode: '34003', dept: '34', region: 'occitanie', population: 28265, lat: 43.3108, lng: 3.4753, neighbors: ['sete', 'beziers'], priority: 'mid' },
  { slug: 'lunel', name: 'Lunel', postalCode: '34400', inseeCode: '34145', dept: '34', region: 'occitanie', population: 26340, lat: 43.6794, lng: 4.1356, neighbors: ['montpellier', 'nimes'], priority: 'mid' },
  { slug: 'quimper', name: 'Quimper', postalCode: '29000', inseeCode: '29232', dept: '29', region: 'bretagne', population: 63513, lat: 47.9956, lng: -4.1019, neighbors: ['brest', 'lorient', 'morlaix'], priority: 'mid' },
  { slug: 'lorient', name: 'Lorient', postalCode: '56100', inseeCode: '56121', dept: '56', region: 'bretagne', population: 57276, lat: 47.7484, lng: -3.3669, neighbors: ['vannes', 'quimper', 'rennes'], priority: 'mid' },
  { slug: 'vannes', name: 'Vannes', postalCode: '56000', inseeCode: '56260', dept: '56', region: 'bretagne', population: 54020, lat: 47.6586, lng: -2.7603, neighbors: ['lorient', 'rennes', 'saint-brieuc'], priority: 'mid' },
  { slug: 'saint-brieuc', name: 'Saint-Brieuc', postalCode: '22000', inseeCode: '22278', dept: '22', region: 'bretagne', population: 43488, lat: 48.5142, lng: -2.7653, neighbors: ['vannes', 'rennes', 'saint-malo'], priority: 'mid' },
  { slug: 'saint-malo', name: 'Saint-Malo', postalCode: '35400', inseeCode: '35288', dept: '35', region: 'bretagne', population: 46478, lat: 48.6492, lng: -2.0258, neighbors: ['rennes', 'saint-brieuc'], priority: 'mid' },
  { slug: 'morlaix', name: 'Morlaix', postalCode: '29600', inseeCode: '29151', dept: '29', region: 'bretagne', population: 15003, lat: 48.5783, lng: -3.8281, neighbors: ['brest', 'quimper'], priority: 'low' },
  { slug: 'laval', name: 'Laval', postalCode: '53000', inseeCode: '53130', dept: '53', region: 'pays-de-la-loire', population: 49490, lat: 48.075, lng: -0.7667, neighbors: ['le-mans', 'rennes', 'angers'], priority: 'mid' },
  { slug: 'la-roche-sur-yon', name: 'La Roche-sur-Yon', postalCode: '85000', inseeCode: '85191', dept: '85', region: 'pays-de-la-loire', population: 53942, lat: 46.6706, lng: -1.4267, neighbors: ['nantes', 'cholet', 'les-sables-d-olonne'], priority: 'mid' },
  { slug: 'cholet', name: 'Cholet', postalCode: '49300', inseeCode: '49099', dept: '49', region: 'pays-de-la-loire', population: 54186, lat: 47.0606, lng: -0.8783, neighbors: ['angers', 'la-roche-sur-yon', 'nantes'], priority: 'mid' },
  { slug: 'saumur', name: 'Saumur', postalCode: '49400', inseeCode: '49328', dept: '49', region: 'pays-de-la-loire', population: 26471, lat: 47.26, lng: -0.075, neighbors: ['angers', 'tours'], priority: 'mid' },
  { slug: 'saint-nazaire', name: 'Saint-Nazaire', postalCode: '44600', inseeCode: '44184', dept: '44', region: 'pays-de-la-loire', population: 71957, lat: 47.2734, lng: -2.2139, neighbors: ['nantes', 'la-baule-escoublac'], priority: 'mid' },
  { slug: 'la-baule-escoublac', name: 'La Baule-Escoublac', postalCode: '44500', inseeCode: '44055', dept: '44', region: 'pays-de-la-loire', population: 16294, lat: 47.2873, lng: -2.3893, neighbors: ['saint-nazaire', 'nantes'], priority: 'low' },
  { slug: 'les-sables-d-olonne', name: 'Les Sables-d’Olonne', postalCode: '85100', inseeCode: '85194', dept: '85', region: 'pays-de-la-loire', population: 44788, lat: 46.4953, lng: -1.7833, neighbors: ['la-roche-sur-yon', 'nantes'], priority: 'mid' },
  { slug: 'alencon', name: 'Alençon', postalCode: '61000', inseeCode: '61001', dept: '61', region: 'normandie', population: 26064, lat: 48.4316, lng: 0.0921, neighbors: ['le-mans', 'caen'], priority: 'mid' },
  { slug: 'lisieux', name: 'Lisieux', postalCode: '14100', inseeCode: '14366', dept: '14', region: 'normandie', population: 20318, lat: 49.1457, lng: 0.226, neighbors: ['caen', 'rouen'], priority: 'mid' },
  { slug: 'dieppe', name: 'Dieppe', postalCode: '76200', inseeCode: '76217', dept: '76', region: 'normandie', population: 28333, lat: 49.9229, lng: 1.0779, neighbors: ['rouen', 'le-havre', 'fecamp'], priority: 'mid' },
  { slug: 'fecamp', name: 'Fécamp', postalCode: '76400', inseeCode: '76259', dept: '76', region: 'normandie', population: 18829, lat: 49.755, lng: 0.375, neighbors: ['le-havre', 'dieppe', 'rouen'], priority: 'mid' },
  { slug: 'evreux', name: 'Évreux', postalCode: '27000', inseeCode: '27229', dept: '27', region: 'normandie', population: 47733, lat: 49.0247, lng: 1.1508, neighbors: ['rouen', 'paris'], priority: 'mid' },
  { slug: 'saint-lo', name: 'Saint-Lô', postalCode: '50000', inseeCode: '50502', dept: '50', region: 'normandie', population: 19011, lat: 49.1156, lng: -1.0917, neighbors: ['caen', 'cherbourg-en-cotentin'], priority: 'mid' },
  { slug: 'compiegne', name: 'Compiègne', postalCode: '60200', inseeCode: '60159', dept: '60', region: 'hauts-de-france', population: 40437, lat: 49.4174, lng: 2.8261, neighbors: ['amiens', 'beauvais', 'paris'], priority: 'mid' },
  { slug: 'beauvais', name: 'Beauvais', postalCode: '60000', inseeCode: '60057', dept: '60', region: 'hauts-de-france', population: 54752, lat: 49.4297, lng: 2.0808, neighbors: ['amiens', 'compiegne', 'paris'], priority: 'mid' },
  { slug: 'soissons', name: 'Soissons', postalCode: '02200', inseeCode: '02722', dept: '02', region: 'hauts-de-france', population: 28290, lat: 49.3814, lng: 3.3236, neighbors: ['reims', 'amiens'], priority: 'mid' },
  { slug: 'saint-quentin', name: 'Saint-Quentin', postalCode: '02100', inseeCode: '02691', dept: '02', region: 'hauts-de-france', population: 53144, lat: 49.8489, lng: 3.2876, neighbors: ['amiens', 'soissons', 'lille'], priority: 'mid' },
  { slug: 'arras', name: 'Arras', postalCode: '62000', inseeCode: '62041', dept: '62', region: 'hauts-de-france', population: 40923, lat: 50.2911, lng: 2.7775, neighbors: ['lens', 'lille', 'amiens'], priority: 'mid' },
  { slug: 'lens', name: 'Lens', postalCode: '62300', inseeCode: '62498', dept: '62', region: 'hauts-de-france', population: 31787, lat: 50.4322, lng: 2.8324, neighbors: ['arras', 'lille', 'douai'], priority: 'mid' },
  { slug: 'douai', name: 'Douai', postalCode: '59500', inseeCode: '59178', dept: '59', region: 'hauts-de-france', population: 39705, lat: 50.3675, lng: 3.0796, neighbors: ['lille', 'lens', 'valenciennes'], priority: 'mid' },
  { slug: 'valenciennes', name: 'Valenciennes', postalCode: '59300', inseeCode: '59606', dept: '59', region: 'hauts-de-france', population: 44037, lat: 50.3567, lng: 3.5239, neighbors: ['lille', 'douai'], priority: 'mid' },
  { slug: 'cambrai', name: 'Cambrai', postalCode: '59400', inseeCode: '59122', dept: '59', region: 'hauts-de-france', population: 31881, lat: 50.1764, lng: 3.2364, neighbors: ['valenciennes', 'lille'], priority: 'mid' },
  { slug: 'boulogne-sur-mer', name: 'Boulogne-sur-Mer', postalCode: '62200', inseeCode: '62160', dept: '62', region: 'hauts-de-france', population: 41070, lat: 50.7264, lng: 1.6147, neighbors: ['calais', 'dunkerque'], priority: 'mid' },
  { slug: 'abbeville', name: 'Abbeville', postalCode: '80100', inseeCode: '80001', dept: '80', region: 'hauts-de-france', population: 22853, lat: 50.1056, lng: 1.8344, neighbors: ['amiens', 'boulogne-sur-mer'], priority: 'mid' },
  { slug: 'saint-omer', name: 'Saint-Omer', postalCode: '62500', inseeCode: '62765', dept: '62', region: 'hauts-de-france', population: 13903, lat: 50.7503, lng: 2.2528, neighbors: ['calais', 'dunkerque', 'lille'], priority: 'low' },
  { slug: 'montargis', name: 'Montargis', postalCode: '45200', inseeCode: '45208', dept: '45', region: 'centre-val-de-loire', population: 14572, lat: 47.9966, lng: 2.7333, neighbors: ['orleans', 'sens', 'auxerre'], priority: 'low' },
  { slug: 'pontoise', name: 'Pontoise', postalCode: '95000', inseeCode: '95500', dept: '95', region: 'ile-de-france', population: 31052, lat: 49.0506, lng: 2.0911, neighbors: ['cergy', 'argenteuil', 'paris'], priority: 'mid' },
  { slug: 'levallois-perret', name: 'Levallois-Perret', postalCode: '92300', inseeCode: '92044', dept: '92', region: 'ile-de-france', population: 66082, lat: 48.8946, lng: 2.2876, neighbors: ['paris', 'courbevoie'], priority: 'mid' },
  { slug: 'sevres', name: 'Sèvres', postalCode: '92310', inseeCode: '92072', dept: '92', region: 'ile-de-france', population: 23734, lat: 48.8231, lng: 2.2103, neighbors: ['paris', 'versailles', 'boulogne-billancourt'], priority: 'mid' },
  { slug: 'le-blanc-mesnil', name: 'Le Blanc-Mesnil', postalCode: '93150', inseeCode: '93007', dept: '93', region: 'ile-de-france', population: 57186, lat: 48.94, lng: 2.4644, neighbors: ['aulnay-sous-bois', 'saint-denis'], priority: 'mid' },
  { slug: 'ivry-sur-seine', name: 'Ivry-sur-Seine', postalCode: '94200', inseeCode: '94041', dept: '94', region: 'ile-de-france', population: 67700, lat: 48.815, lng: 2.3833, neighbors: ['paris', 'vitry-sur-seine', 'creteil'], priority: 'mid' },
  { slug: 'le-bouscat', name: 'Le Bouscat', postalCode: '33110', inseeCode: '33069', dept: '33', region: 'nouvelle-aquitaine', population: 23932, lat: 44.8667, lng: -0.6, neighbors: ['bordeaux', 'merignac'], priority: 'low' },
  { slug: 'oloron-sainte-marie', name: 'Oloron-Sainte-Marie', postalCode: '64400', inseeCode: '64422', dept: '64', region: 'nouvelle-aquitaine', population: 10245, lat: 43.1939, lng: -0.6064, neighbors: ['pau'], priority: 'low' },
  { slug: 'villeneuve-sur-lot', name: 'Villeneuve-sur-Lot', postalCode: '47300', inseeCode: '47323', dept: '47', region: 'nouvelle-aquitaine', population: 22812, lat: 44.4111, lng: 0.7058, neighbors: ['agen', 'cahors'], priority: 'low' },
  { slug: 'figeac', name: 'Figeac', postalCode: '46100', inseeCode: '46102', dept: '46', region: 'occitanie', population: 9892, lat: 44.6072, lng: 2.035, neighbors: ['cahors', 'rodez'], priority: 'low' },
  { slug: 'millau', name: 'Millau', postalCode: '12100', inseeCode: '12145', dept: '12', region: 'occitanie', population: 21944, lat: 44.0974, lng: 3.0789, neighbors: ['rodez', 'montpellier'], priority: 'mid' },
  { slug: 'lourdes', name: 'Lourdes', postalCode: '65100', inseeCode: '65286', dept: '65', region: 'occitanie', population: 13262, lat: 43.0942, lng: -0.0497, neighbors: ['tarbes', 'pau'], priority: 'mid' },
  { slug: 'mazamet', name: 'Mazamet', postalCode: '81200', inseeCode: '81163', dept: '81', region: 'occitanie', population: 9988, lat: 43.4933, lng: 2.3753, neighbors: ['castres'], priority: 'low' },
  { slug: 'castelnaudary', name: 'Castelnaudary', postalCode: '11400', inseeCode: '11076', dept: '11', region: 'occitanie', population: 12000, lat: 43.3175, lng: 1.9522, neighbors: ['carcassonne', 'toulouse'], priority: 'low' },
  { slug: 'ceret', name: 'Céret', postalCode: '66400', inseeCode: '66049', dept: '66', region: 'occitanie', population: 7948, lat: 42.4856, lng: 2.7472, neighbors: ['perpignan'], priority: 'low' },
  { slug: 'colomiers', name: 'Colomiers', postalCode: '31770', inseeCode: '31149', dept: '31', region: 'occitanie', population: 39988, lat: 43.6131, lng: 1.3367, neighbors: ['toulouse', 'blagnac'], priority: 'mid' },
  { slug: 'blagnac', name: 'Blagnac', postalCode: '31700', inseeCode: '31069', dept: '31', region: 'occitanie', population: 26174, lat: 43.6358, lng: 1.3892, neighbors: ['toulouse', 'colomiers'], priority: 'mid' },
  { slug: 'haguenau', name: 'Haguenau', postalCode: '67500', inseeCode: '67180', dept: '67', region: 'grand-est', population: 35067, lat: 48.8156, lng: 7.7894, neighbors: ['strasbourg'], priority: 'mid' },
  { slug: 'selestat', name: 'Sélestat', postalCode: '67600', inseeCode: '67462', dept: '67', region: 'grand-est', population: 19245, lat: 48.2592, lng: 7.4536, neighbors: ['strasbourg', 'colmar'], priority: 'mid' },
  { slug: 'saint-avold', name: 'Saint-Avold', postalCode: '57500', inseeCode: '57606', dept: '57', region: 'grand-est', population: 15569, lat: 49.1075, lng: 6.7081, neighbors: ['metz', 'forbach'], priority: 'low' },
  { slug: 'luneville', name: 'Lunéville', postalCode: '54300', inseeCode: '54329', dept: '54', region: 'grand-est', population: 19258, lat: 48.5933, lng: 6.5031, neighbors: ['nancy'], priority: 'low' },
  { slug: 'altkirch', name: 'Altkirch', postalCode: '68130', inseeCode: '68004', dept: '68', region: 'grand-est', population: 5710, lat: 47.6253, lng: 7.2419, neighbors: ['mulhouse'], priority: 'low' },
  { slug: 'voiron', name: 'Voiron', postalCode: '38500', inseeCode: '38563', dept: '38', region: 'auvergne-rhone-alpes', population: 20188, lat: 45.3658, lng: 5.5919, neighbors: ['grenoble'], priority: 'mid' },
  { slug: 'echirolles', name: 'Échirolles', postalCode: '38130', inseeCode: '38151', dept: '38', region: 'auvergne-rhone-alpes', population: 37174, lat: 45.1469, lng: 5.7233, neighbors: ['grenoble'], priority: 'mid' },
  { slug: 'firminy', name: 'Firminy', postalCode: '42700', inseeCode: '42095', dept: '42', region: 'auvergne-rhone-alpes', population: 17047, lat: 45.385, lng: 4.2906, neighbors: ['saint-etienne'], priority: 'low' },
  { slug: 'vaulx-en-velin', name: 'Vaulx-en-Velin', postalCode: '69120', inseeCode: '69256', dept: '69', region: 'auvergne-rhone-alpes', population: 53066, lat: 45.7775, lng: 4.9275, neighbors: ['lyon', 'villeurbanne'], priority: 'mid' },
  { slug: 'bron', name: 'Bron', postalCode: '69500', inseeCode: '69029', dept: '69', region: 'auvergne-rhone-alpes', population: 41671, lat: 45.7335, lng: 4.913, neighbors: ['lyon', 'villeurbanne'], priority: 'mid' },
  { slug: 'reze', name: 'Rezé', postalCode: '44400', inseeCode: '44143', dept: '44', region: 'pays-de-la-loire', population: 42993, lat: 47.185, lng: -1.5497, neighbors: ['nantes'], priority: 'mid' },
  { slug: 'saint-emilion', name: 'Saint-Émilion', postalCode: '33330', inseeCode: '33394', dept: '33', region: 'nouvelle-aquitaine', population: 1837, lat: 44.8939, lng: -0.1561, neighbors: ['libourne', 'bordeaux'], priority: 'low' },
  { slug: 'la-teste-de-buch', name: 'La Teste-de-Buch', postalCode: '33260', inseeCode: '33529', dept: '33', region: 'nouvelle-aquitaine', population: 26473, lat: 44.6253, lng: -1.1453, neighbors: ['arcachon', 'bordeaux'], priority: 'mid' },
  { slug: 'evian-les-bains', name: 'Évian-les-Bains', postalCode: '74500', inseeCode: '74119', dept: '74', region: 'auvergne-rhone-alpes', population: 9163, lat: 46.4007, lng: 6.5878, neighbors: ['thonon-les-bains', 'annecy'], priority: 'low' },
  { slug: 'le-lamentin', name: 'Le Lamentin', postalCode: '97232', inseeCode: '97213', dept: '972', region: 'martinique', population: 39837, lat: 14.6086, lng: -60.9986, neighbors: ['fort-de-france', 'schoelcher'], priority: 'mid' },
  { slug: 'schoelcher', name: 'Schœlcher', postalCode: '97233', inseeCode: '97229', dept: '972', region: 'martinique', population: 19984, lat: 14.6131, lng: -61.0958, neighbors: ['fort-de-france', 'le-lamentin'], priority: 'low' },
]

// ─────────────────────────────────────────────────────────────────────────
// Helpers d'accès O(1)
// ─────────────────────────────────────────────────────────────────────────

const CITIES_BY_SLUG: ReadonlyMap<string, City> = new Map(
  CITIES.map((city) => [city.slug, city]),
)

/** Lookup O(1) par slug. Retourne `undefined` si introuvable. */
export function getCityBySlug(slug: string): City | undefined {
  return CITIES_BY_SLUG.get(slug)
}

/** Slugs de toutes les villes (utile pour `generateStaticParams`). */
export function getAllCitySlugs(): ReadonlyArray<string> {
  return CITIES.map((c) => c.slug)
}

/** Top-N villes pour suggestions ou homepage. */
export function getTopCities(limit = 20): ReadonlyArray<City> {
  return CITIES.filter((c) => c.priority === 'top').slice(0, limit)
}

/** Voisines d'une ville (slugs déréférencés en objets City). */
export function getNeighborCities(slug: string): ReadonlyArray<City> {
  const city = CITIES_BY_SLUG.get(slug)
  if (!city) return []
  return city.neighbors
    .map((s) => CITIES_BY_SLUG.get(s))
    .filter((c): c is City => c !== undefined)
}

/** Statistiques globales registry (pour sitemap / monitoring). */
export function getRegistryStats(): {
  total: number
  top: number
  mid: number
  low: number
} {
  return {
    total: CITIES.length,
    top: CITIES.filter((c) => c.priority === 'top').length,
    mid: CITIES.filter((c) => c.priority === 'mid').length,
    low: CITIES.filter((c) => c.priority === 'low').length,
  }
}
