/**
 * KOVAS — XML 3CL Liciel builder
 *
 * Génère un fichier XML conforme au format 3CL-DPE 2021 importable dans Liciel.
 *
 * IMPORTANT (limite V1) : la DTD/XSD Liciel n'est PAS publiquement documentée.
 * Cette implémentation produit un **format JSON-intermédiaire enveloppé en XML**
 * compatible avec les passerelles XML "Imports spécifiques" Liciel les plus
 * permissives + le module générique `Importer XML/Excel` (cf. CLAUDE.md §13
 * "Stratégie défensive Liciel — résilience multi-voies").
 *
 * Stratégie résilience :
 *   - V1 — format XML générique (ce builder) + ZIP standard Liciel (zip-liciel.ts)
 *   - V2 — calibrage fin via reverse-engineering passerelle officielle Liciel
 *   - Phase 2 — envoi ADEME direct (indépendance totale)
 *
 * Tous les champs facultatifs sont émis OU omis. Aucune valeur par défaut piège :
 * un null reste null dans le XML (élément vide), jamais "0" ou "non renseigné".
 *
 * Authority : CLAUDE.md §3 feature 9 (export multi-format), §13 (résilience Liciel).
 */

// ============================================================
// Types entrants — exhaustifs 3CL-2021 (à minima les champs DHUP visibles)
// ============================================================

export interface Room3CLData {
  room_name: string
  room_type: string | null
  surface_sqm: number | null
  ceiling_height_m: number | null
  orientation: string | null
  data_3cl: Room3CLFields
  ai_confidence_score: number | null
  source: 'ai_extracted' | 'user_validated' | 'user_corrected'
  validated_by_user: boolean
}

/**
 * 30-40 champs structurés par pièce — cf. Schéma 3CL-DPE 2021 (ADEME).
 * Tous les champs sont nullable : un null = "non renseigné" (pas piège par défaut).
 */
export interface Room3CLFields {
  // Enveloppe
  windows?: Window3CL[]
  doors?: Door3CL[]
  walls?: Wall3CL[]
  floor?: Floor3CL | null
  ceiling?: Ceiling3CL | null
  // Systèmes
  heating_emitters?: HeatingEmitter3CL[]
  cooling_emitters?: CoolingEmitter3CL[]
  ventilation?: Ventilation3CL | null
  lighting?: Lighting3CL | null
  // Mesures
  measurements?: Measurement3CL[]
  // Observations libres (IA voice/photo)
  observations?: string[]
}

export interface Window3CL {
  type: string | null // 'simple_vitrage' | 'double_vitrage' | 'triple_vitrage' | ...
  frame_material: string | null // 'pvc' | 'bois' | 'alu' | 'mixte'
  surface_sqm: number | null
  orientation: string | null
  has_shutters: boolean | null
  shutter_type: string | null
  year_install: number | null
  u_value: number | null // W/m².K si dispo
  solar_factor: number | null
}

export interface Door3CL {
  type: string | null
  surface_sqm: number | null
  insulated: boolean | null
  year_install: number | null
}

export interface Wall3CL {
  orientation: string | null
  surface_sqm: number | null
  material: string | null
  insulation_type: string | null
  insulation_thickness_cm: number | null
  year_insulation: number | null
  u_value: number | null
}

export interface Floor3CL {
  surface_sqm: number | null
  material: string | null
  insulation_type: string | null
  insulation_thickness_cm: number | null
  on_unheated_space: boolean | null
}

export interface Ceiling3CL {
  surface_sqm: number | null
  material: string | null
  insulation_type: string | null
  insulation_thickness_cm: number | null
  under_roof: boolean | null
}

export interface HeatingEmitter3CL {
  type: string | null // 'radiateur_eau' | 'plancher_chauffant' | 'convecteur_elec' | ...
  energy_source: string | null // 'gaz' | 'fioul' | 'elec' | 'bois' | 'pac_air' | ...
  brand: string | null
  model: string | null
  power_kw: number | null
  year_install: number | null
  count: number | null
}

export interface CoolingEmitter3CL {
  type: string | null
  brand: string | null
  power_kw: number | null
  year_install: number | null
}

export interface Ventilation3CL {
  type: string | null // 'naturelle' | 'vmc_simple_flux' | 'vmc_double_flux' | ...
  has_inlet_grilles: boolean | null
  year_install: number | null
}

export interface Lighting3CL {
  bulb_type: string | null
  count: number | null
  power_w: number | null
}

export interface Measurement3CL {
  kind: string | null // 'humidite' | 'co2' | 'temperature' | 'monoxyde'
  value: number | null
  unit: string | null
  measured_at: string | null
}

export interface BuildingGlobals3CL {
  reference: string
  type_mission: 'vente' | 'location' | 'audit' | 'autre'
  date_visite: string | null
  annee_construction: number | null
  surface_habitable: number | null
  surface_carrez: number | null
  property_type: string | null
  postal_code: string | null
  city: string | null
  address: string | null
  // Chauffage global (système collectif/individuel)
  heating_system_main: HeatingEmitter3CL | null
  heating_system_secondary: HeatingEmitter3CL | null
  // ECS
  ecs_system: {
    type: string | null
    energy_source: string | null
    brand: string | null
    power_kw: number | null
    year_install: number | null
    storage_liters: number | null
  } | null
  // Ventilation globale (souvent unique pour tout le logement)
  ventilation_global: Ventilation3CL | null
}

export interface BuildResult {
  xml: string
  json_intermediate: Record<string, unknown>
  format_version: '2021.1-kovas'
  rooms_count: number
  has_warnings: boolean
  warnings: string[]
}

// ============================================================
// Helpers XML safe
// ============================================================

function xmlEscape(v: unknown): string {
  if (v == null) return ''
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function tag(name: string, value: unknown, attrs: Record<string, unknown> = {}): string {
  const attrStr = Object.entries(attrs)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => ` ${k}="${xmlEscape(v)}"`)
    .join('')
  if (value == null || value === '') return `<${name}${attrStr}/>`
  return `<${name}${attrStr}>${xmlEscape(value)}</${name}>`
}

function block(name: string, inner: string, attrs: Record<string, unknown> = {}): string {
  const attrStr = Object.entries(attrs)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => ` ${k}="${xmlEscape(v)}"`)
    .join('')
  return `<${name}${attrStr}>\n${inner}\n</${name}>`
}

function indent(s: string, depth = 2): string {
  const pad = ' '.repeat(depth)
  return s
    .split('\n')
    .map((l) => (l ? pad + l : l))
    .join('\n')
}

// ============================================================
// XML render — pièces 3CL
// ============================================================

function renderWindow(w: Window3CL, idx: number): string {
  return block(
    'fenetre',
    [
      tag('type', w.type),
      tag('chassis', w.frame_material),
      tag('surface_m2', w.surface_sqm),
      tag('orientation', w.orientation),
      tag('volets', w.has_shutters == null ? '' : w.has_shutters ? 'oui' : 'non'),
      tag('type_volet', w.shutter_type),
      tag('annee_pose', w.year_install),
      tag('u_w_m2k', w.u_value),
      tag('facteur_solaire', w.solar_factor),
    ].join('\n'),
    { id: `WIN-${String(idx + 1).padStart(3, '0')}` },
  )
}

function renderDoor(d: Door3CL, idx: number): string {
  return block(
    'porte',
    [
      tag('type', d.type),
      tag('surface_m2', d.surface_sqm),
      tag('isolee', d.insulated == null ? '' : d.insulated ? 'oui' : 'non'),
      tag('annee_pose', d.year_install),
    ].join('\n'),
    { id: `DOOR-${String(idx + 1).padStart(3, '0')}` },
  )
}

function renderWall(w: Wall3CL, idx: number): string {
  return block(
    'paroi',
    [
      tag('orientation', w.orientation),
      tag('surface_m2', w.surface_sqm),
      tag('materiau', w.material),
      tag('type_isolant', w.insulation_type),
      tag('epaisseur_isolant_cm', w.insulation_thickness_cm),
      tag('annee_isolation', w.year_insulation),
      tag('u_w_m2k', w.u_value),
    ].join('\n'),
    { id: `WALL-${String(idx + 1).padStart(3, '0')}` },
  )
}

function renderFloor(f: Floor3CL | null | undefined): string {
  if (!f) return ''
  return block(
    'sol',
    [
      tag('surface_m2', f.surface_sqm),
      tag('materiau', f.material),
      tag('type_isolant', f.insulation_type),
      tag('epaisseur_isolant_cm', f.insulation_thickness_cm),
      tag(
        'sur_local_non_chauffe',
        f.on_unheated_space == null ? '' : f.on_unheated_space ? 'oui' : 'non',
      ),
    ].join('\n'),
  )
}

function renderCeiling(c: Ceiling3CL | null | undefined): string {
  if (!c) return ''
  return block(
    'plafond',
    [
      tag('surface_m2', c.surface_sqm),
      tag('materiau', c.material),
      tag('type_isolant', c.insulation_type),
      tag('epaisseur_isolant_cm', c.insulation_thickness_cm),
      tag('sous_toiture', c.under_roof == null ? '' : c.under_roof ? 'oui' : 'non'),
    ].join('\n'),
  )
}

function renderHeatingEmitter(h: HeatingEmitter3CL, idx: number): string {
  return block(
    'emetteur_chauffage',
    [
      tag('type', h.type),
      tag('energie', h.energy_source),
      tag('marque', h.brand),
      tag('modele', h.model),
      tag('puissance_kw', h.power_kw),
      tag('annee_pose', h.year_install),
      tag('nombre', h.count),
    ].join('\n'),
    { id: `HEAT-${String(idx + 1).padStart(3, '0')}` },
  )
}

function renderRoom(r: Room3CLData, idx: number): string {
  const d = r.data_3cl ?? {}
  const inner = [
    tag('nom', r.room_name),
    tag('type', r.room_type),
    tag('surface_m2', r.surface_sqm),
    tag('hauteur_sous_plafond_m', r.ceiling_height_m),
    tag('orientation', r.orientation),
    tag('source_donnees', r.source),
    tag('valide_diagnostiqueur', r.validated_by_user ? 'oui' : 'non'),
    tag('confiance_ia', r.ai_confidence_score),
    d.windows && d.windows.length > 0
      ? block('fenetres', d.windows.map(renderWindow).join('\n'))
      : '',
    d.doors && d.doors.length > 0 ? block('portes', d.doors.map(renderDoor).join('\n')) : '',
    d.walls && d.walls.length > 0 ? block('parois', d.walls.map(renderWall).join('\n')) : '',
    renderFloor(d.floor),
    renderCeiling(d.ceiling),
    d.heating_emitters && d.heating_emitters.length > 0
      ? block('emetteurs_chauffage', d.heating_emitters.map(renderHeatingEmitter).join('\n'))
      : '',
    d.ventilation
      ? block(
          'ventilation',
          [
            tag('type', d.ventilation.type),
            tag(
              'entrees_air',
              d.ventilation.has_inlet_grilles == null
                ? ''
                : d.ventilation.has_inlet_grilles
                  ? 'oui'
                  : 'non',
            ),
            tag('annee_pose', d.ventilation.year_install),
          ].join('\n'),
        )
      : '',
    d.lighting
      ? block(
          'eclairage',
          [
            tag('type_ampoule', d.lighting.bulb_type),
            tag('nombre', d.lighting.count),
            tag('puissance_w', d.lighting.power_w),
          ].join('\n'),
        )
      : '',
    d.measurements && d.measurements.length > 0
      ? block(
          'mesures',
          d.measurements
            .map((m, i) =>
              block(
                'mesure',
                [
                  tag('nature', m.kind),
                  tag('valeur', m.value),
                  tag('unite', m.unit),
                  tag('mesuree_a', m.measured_at),
                ].join('\n'),
                { id: `MEAS-${String(i + 1).padStart(3, '0')}` },
              ),
            )
            .join('\n'),
        )
      : '',
    d.observations && d.observations.length > 0
      ? block('observations', d.observations.map((obs) => tag('observation', obs)).join('\n'))
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  return block('piece', indent(inner), { id: `PIECE-${String(idx + 1).padStart(3, '0')}` })
}

// ============================================================
// XML render — globals bâti + chauffage + ECS + ventilation
// ============================================================

function renderHeatingSystem(name: string, h: HeatingEmitter3CL | null): string {
  if (!h) return ''
  return block(
    name,
    [
      tag('type', h.type),
      tag('energie', h.energy_source),
      tag('marque', h.brand),
      tag('modele', h.model),
      tag('puissance_kw', h.power_kw),
      tag('annee_pose', h.year_install),
    ].join('\n'),
  )
}

function renderEcs(g: BuildingGlobals3CL): string {
  const e = g.ecs_system
  if (!e) return ''
  return block(
    'ecs',
    [
      tag('type', e.type),
      tag('energie', e.energy_source),
      tag('marque', e.brand),
      tag('puissance_kw', e.power_kw),
      tag('annee_pose', e.year_install),
      tag('capacite_litres', e.storage_liters),
    ].join('\n'),
  )
}

function renderBati(g: BuildingGlobals3CL): string {
  return block(
    'bati',
    [
      tag('annee_construction', g.annee_construction),
      tag('surface_habitable_m2', g.surface_habitable),
      tag('surface_carrez_m2', g.surface_carrez),
      tag('type_logement', g.property_type),
      tag('adresse', g.address),
      tag('code_postal', g.postal_code),
      tag('ville', g.city),
    ].join('\n'),
  )
}

function renderVentilationGlobal(g: BuildingGlobals3CL): string {
  const v = g.ventilation_global
  if (!v) return ''
  return block(
    'ventilation_globale',
    [
      tag('type', v.type),
      tag('entrees_air', v.has_inlet_grilles == null ? '' : v.has_inlet_grilles ? 'oui' : 'non'),
      tag('annee_pose', v.year_install),
    ].join('\n'),
  )
}

// ============================================================
// Validation warnings (champs critiques manquants)
// ============================================================

function detectWarnings(globals: BuildingGlobals3CL, rooms: Room3CLData[]): string[] {
  const w: string[] = []
  if (globals.annee_construction == null) w.push('annee_construction manquante')
  if (globals.surface_habitable == null) w.push('surface_habitable manquante')
  if (!globals.heating_system_main) w.push('heating_system_main manquant')
  if (!globals.ecs_system) w.push('ecs_system manquant')
  if (rooms.length === 0) w.push('aucune piece')
  for (const r of rooms) {
    if (r.surface_sqm == null) w.push(`piece "${r.room_name}" sans surface`)
    if ((r.data_3cl?.windows?.length ?? 0) === 0) w.push(`piece "${r.room_name}" sans fenetre`)
  }
  return w
}

// ============================================================
// Entry point
// ============================================================

export function buildXml3CL(globals: BuildingGlobals3CL, rooms: Room3CLData[]): BuildResult {
  const warnings = detectWarnings(globals, rooms)

  const inner = [
    block(
      'meta',
      [
        tag('reference', globals.reference),
        tag('type_mission', globals.type_mission),
        tag('methode_calcul', '3CL-2021'),
        tag('date_visite', globals.date_visite),
        tag('format_version', '2021.1-kovas'),
        tag('genere_par', 'KOVAS App'),
        tag('genere_le', new Date().toISOString()),
      ].join('\n'),
    ),
    renderBati(globals),
    renderHeatingSystem('chauffage_principal', globals.heating_system_main),
    renderHeatingSystem('chauffage_secondaire', globals.heating_system_secondary),
    renderEcs(globals),
    renderVentilationGlobal(globals),
    block('pieces', rooms.map(renderRoom).join('\n')),
    warnings.length > 0
      ? block('avertissements', warnings.map((m) => tag('avertissement', m)).join('\n'))
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<dpe_3cl version="2021.1-kovas">\n${indent(inner)}\n</dpe_3cl>\n`

  // Format JSON-intermédiaire complémentaire (useful pour debug + V2 reverse-engineering ciblé)
  const json_intermediate = {
    meta: {
      reference: globals.reference,
      type_mission: globals.type_mission,
      methode_calcul: '3CL-2021',
      format_version: '2021.1-kovas',
      genere_par: 'KOVAS App',
      genere_le: new Date().toISOString(),
    },
    bati: {
      annee_construction: globals.annee_construction,
      surface_habitable: globals.surface_habitable,
      surface_carrez: globals.surface_carrez,
      property_type: globals.property_type,
      address: globals.address,
      postal_code: globals.postal_code,
      city: globals.city,
    },
    chauffage_principal: globals.heating_system_main,
    chauffage_secondaire: globals.heating_system_secondary,
    ecs: globals.ecs_system,
    ventilation_globale: globals.ventilation_global,
    pieces: rooms.map((r) => ({
      id: r.room_name,
      type: r.room_type,
      surface_m2: r.surface_sqm,
      hauteur_sous_plafond_m: r.ceiling_height_m,
      orientation: r.orientation,
      source: r.source,
      valide_diagnostiqueur: r.validated_by_user,
      confiance_ia: r.ai_confidence_score,
      data_3cl: r.data_3cl,
    })),
    avertissements: warnings,
  }

  return {
    xml,
    json_intermediate,
    format_version: '2021.1-kovas',
    rooms_count: rooms.length,
    has_warnings: warnings.length > 0,
    warnings,
  }
}
