import type { MissionExportData } from '@/lib/exports/build-mission-data'
import JSZip from 'jszip'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Mock du client Supabase admin : storage.download renvoie un blob factice
 * pour permettre de tester la structure ZIP photos/annexes sans réseau.
 */
const downloadMock = vi.fn(async () => ({
  data: { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer },
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: { from: () => ({ download: downloadMock }) },
  }),
}))

import { deriveDateFinValidite, derivePeriodeConstruction } from './derived'
import { buildLicielZip } from './index'

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  downloadMock.mockClear()
})

function baseData(overrides: Partial<MissionExportData> = {}): MissionExportData {
  return {
    mission: {
      id: 'm1',
      reference: 'DOS-2026-001',
      type: 'dpe_vente',
      status: 'completed',
      scheduled_at: null,
      started_at: null,
      completed_at: '2026-05-20T09:00:00Z',
      notes: null,
      created_at: '2026-05-01T10:00:00Z',
    },
    property: {
      address: '12 rue des Lilas & Co',
      postal_code: '76200',
      city: 'Dieppe',
      property_type: 'maison',
      year_built: 1960,
      surface_total: 95.5,
      surface_carrez: 90,
      surface_boutin: null,
      floors: 2,
      cadastre_section: 'AB',
      cadastre_number: '0123',
      cadastre_prefix: '000',
      location: 'SRID=4326;POINT(1.0784 49.9229)',
    },
    client: {
      display_name: 'Jean Dupont',
      type: 'particulier',
      first_name: 'Jean',
      last_name: 'Dupont',
      email: 'jean@example.com',
      phone: '+33600000000',
      address: '3 rue du Port, Dieppe',
    },
    organization: { name: 'Cabinet Diag Normandie' },
    rooms: [
      { id: 'room-uuid-1', name: 'Salon', room_type: 'salon', surface_m2: 35.5 },
      { id: 'room-uuid-2', name: 'Cuisine', room_type: 'cuisine', surface_m2: 12 },
    ],
    photos: [],
    voiceNotes: [],
    ownerDocuments: [],
    exportedAt: '2026-05-28T12:00:00Z',
    isTrial: false,
    ...overrides,
  }
}

async function unzip(buffer: Buffer): Promise<JSZip> {
  return JSZip.loadAsync(buffer)
}

async function readText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path)
  expect(file, `fichier manquant dans le ZIP : ${path}`).not.toBeNull()
  if (!file) throw new Error(`fichier manquant : ${path}`)
  return file.async('string')
}

/* ─── Structure ZIP ────────────────────────────────────────────────────── */

describe('buildLicielZip — structure ZIP', () => {
  it('contient les XML attendus pour une mission DPE', async () => {
    const zip = await unzip(await buildLicielZip(baseData()))
    expect(zip.file('XML/LIV_donnees.xml')).not.toBeNull()
    expect(zip.file('XML/LIV_administratif.xml')).not.toBeNull()
    expect(zip.file('XML/LIV_DPE.xml')).not.toBeNull()
    expect(zip.file('LISEZ-MOI.txt')).not.toBeNull()
  })

  it('génère LIV_amiante.xml (pas LIV_DPE) pour une mission amiante', async () => {
    const zip = await unzip(
      await buildLicielZip(baseData({ mission: { ...baseData().mission, type: 'amiante_vente' } })),
    )
    expect(zip.file('XML/LIV_amiante.xml')).not.toBeNull()
    expect(zip.file('XML/LIV_DPE.xml')).toBeNull()
  })

  it('mappe chaque type de mission vers son fichier LIV_<diag>', async () => {
    const cases: Array<[MissionExportData['mission']['type'], string]> = [
      ['plomb_crep', 'XML/LIV_plomb.xml'],
      ['gaz', 'XML/LIV_gaz.xml'],
      ['electricite', 'XML/LIV_electricite.xml'],
      ['termites', 'XML/LIV_termites.xml'],
      ['carrez_boutin', 'XML/LIV_carrez.xml'],
      ['erp', 'XML/LIV_erp.xml'],
    ]
    for (const [type, file] of cases) {
      const zip = await unzip(
        await buildLicielZip(baseData({ mission: { ...baseData().mission, type } })),
      )
      expect(zip.file(file), `attendu ${file} pour ${type}`).not.toBeNull()
    }
  })

  it('range les photos par pièce Photos/PIECE_xxx avec numérotation séquentielle', async () => {
    const data = baseData({
      photos: [
        {
          id: 'p1',
          storage_path: 'org/m1/a.webp',
          room_id: 'room-uuid-1',
          width: null,
          height: null,
          taken_at: null,
          caption: 'cheminée',
        },
        {
          id: 'p2',
          storage_path: 'org/m1/b.webp',
          room_id: 'room-uuid-1',
          width: null,
          height: null,
          taken_at: null,
          caption: null,
        },
        {
          id: 'p3',
          storage_path: 'org/m1/c.webp',
          room_id: null,
          width: null,
          height: null,
          taken_at: null,
          caption: null,
        },
      ],
    })
    const zip = await unzip(await buildLicielZip(data))
    expect(zip.file('Photos/PIECE_001/photo_001.webp')).not.toBeNull()
    expect(zip.file('Photos/PIECE_001/photo_002.webp')).not.toBeNull()
    expect(zip.file('Photos/SANS_PIECE/photo_001.webp')).not.toBeNull()
  })

  it('range les documents propriétaire dans Annexes/ (basename nettoyé)', async () => {
    const data = baseData({
      ownerDocuments: [
        {
          id: 'd1',
          storage_path: 'org/m1/fac.pdf',
          original_name: '../../facture.pdf',
          doc_kind: 'facture',
        },
      ],
    })
    const zip = await unzip(await buildLicielZip(data))
    // Le basename est conservé, le composant de chemin retiré (anti zip-slip).
    expect(zip.file('Annexes/facture.pdf')).not.toBeNull()
    expect(zip.file('Annexes/../../facture.pdf')).toBeNull()
  })
})

/* ─── Mapping par catégorie A-H ────────────────────────────────────────── */

describe('buildLicielZip — mapping des champs (catégories A-H)', () => {
  it('§A identité du bien : champs Liciel exacts présents', async () => {
    const zip = await unzip(await buildLicielZip(baseData()))
    const dpe = await readText(zip, 'XML/LIV_DPE.xml')
    expect(dpe).toContain('<adresse_complete>12 rue des Lilas &amp; Co</adresse_complete>')
    expect(dpe).toContain('<code_postal>76200</code_postal>')
    expect(dpe).toContain('<ville>Dieppe</ville>')
    expect(dpe).toContain('<type_batiment>maison</type_batiment>')
    expect(dpe).toContain('<annee_construction>1960</annee_construction>')
    expect(dpe).toContain('<surface_habitable>95.5</surface_habitable>')
    expect(dpe).toContain('<surface_au_sol>95.5</surface_au_sol>')
    expect(dpe).toContain('<cadastre_section>AB</cadastre_section>')
    expect(dpe).toContain('<cadastre_numero>0123</cadastre_numero>')
    expect(dpe).toContain('<cadastre_prefixe>000</cadastre_prefixe>')
    expect(dpe).toContain('<niveaux_count>2</niveaux_count>')
    // GPS dérivé depuis location PostGIS (lng,lat).
    expect(dpe).toContain('<gps_longitude>1.0784</gps_longitude>')
    expect(dpe).toContain('<gps_latitude>49.9229</gps_latitude>')
  })

  it('§B propriétaire : nom_prenom / adresse / telephone / email', async () => {
    const zip = await unzip(await buildLicielZip(baseData()))
    const admin = await readText(zip, 'XML/LIV_administratif.xml')
    expect(admin).toContain('<nom_prenom>Jean Dupont</nom_prenom>')
    expect(admin).toContain('<adresse>3 rue du Port, Dieppe</adresse>')
    expect(admin).toContain('<telephone>+33600000000</telephone>')
    expect(admin).toContain('<email>jean@example.com</email>')
  })

  it('§C type de mission : type_mission / methode_calcul / dates', async () => {
    const zip = await unzip(await buildLicielZip(baseData()))
    const dpe = await readText(zip, 'XML/LIV_DPE.xml')
    expect(dpe).toContain('<type_mission>vente</type_mission>')
    expect(dpe).toContain('<methode_calcul>3CL-2021</methode_calcul>')
    expect(dpe).toContain('<date_visite>2026-05-20</date_visite>')
    // date_fin_validite = date_visite + 10 ans.
    expect(dpe).toContain('<date_fin_validite>2036-05-20</date_fin_validite>')
  })

  it('type_mission=location pour dpe_location', async () => {
    const zip = await unzip(
      await buildLicielZip(baseData({ mission: { ...baseData().mission, type: 'dpe_location' } })),
    )
    const dpe = await readText(zip, 'XML/LIV_DPE.xml')
    expect(dpe).toContain('<type_mission>location</type_mission>')
  })

  it('§E équipements : sous-blocs chauffage/ecs/ventilation depuis notes vocales', async () => {
    const data = baseData({
      voiceNotes: [
        {
          id: 'v1',
          room_id: null,
          duration_seconds: 30,
          transcript_raw: 'chaudière Frisquet de 2015, VMC simple flux, ballon eau chaude',
          transcript_structured: {
            equipment: [
              { kind: 'chaudiere', brand: 'frisquet', year_install: 2015 },
              { kind: 'ventilation', notes: 'vmc simple flux' },
              { kind: 'chauffe_eau' },
            ],
            observations: [],
            raw_keywords: [],
            confidence: 0.8,
          },
          created_at: '2026-05-20T09:30:00Z',
        },
      ],
    })
    const zip = await unzip(await buildLicielZip(data))
    const dpe = await readText(zip, 'XML/LIV_DPE.xml')
    expect(dpe).toContain('<chauffage>')
    expect(dpe).toContain('<marque>frisquet</marque>')
    expect(dpe).toContain('<annee_installation>2015</annee_installation>')
    expect(dpe).toContain('<ventilation>')
    expect(dpe).toContain('<ecs>')
  })

  it('§H pièces + photos : <piece> avec id/nom/surface et <photo file tag>', async () => {
    const data = baseData({
      photos: [
        {
          id: 'p1',
          storage_path: 'org/m1/a.jpg',
          room_id: 'room-uuid-1',
          width: null,
          height: null,
          taken_at: null,
          caption: 'fenêtre sud',
        },
      ],
    })
    const zip = await unzip(await buildLicielZip(data))
    const dpe = await readText(zip, 'XML/LIV_DPE.xml')
    expect(dpe).toContain('<piece id="PIECE_001" nom="Salon" surface="35.5">')
    expect(dpe).toContain('<photo file="Photos/PIECE_001/photo_001.jpg" tag="fenêtre sud"/>')
    expect(dpe).toContain('<piece id="PIECE_002" nom="Cuisine" surface="12"/>')
  })
})

/* ─── Enums dérivés ────────────────────────────────────────────────────── */

describe('derivePeriodeConstruction (enum ADEME)', () => {
  it.each([
    [1900, 'avant_1948'],
    [1948, 'avant_1948'],
    [1960, '1949_1974'],
    [1980, '1975_1988'],
    [1995, '1989_2000'],
    [2015, 'apres_2001'],
  ])('année %i → %s', (year, expected) => {
    expect(derivePeriodeConstruction(year)).toBe(expected)
  })

  it('null si année absente', () => {
    expect(derivePeriodeConstruction(null)).toBeNull()
    expect(derivePeriodeConstruction(undefined)).toBeNull()
  })

  it('émet periode_construction dans le XML DPE', async () => {
    const zip = await unzip(await buildLicielZip(baseData()))
    const dpe = await readText(zip, 'XML/LIV_DPE.xml')
    expect(dpe).toContain('<periode_construction>1949_1974</periode_construction>')
  })
})

describe('deriveDateFinValidite', () => {
  it('ajoute 10 ans à la date de visite', () => {
    expect(deriveDateFinValidite('2026-05-20T09:00:00Z')).toBe('2036-05-20')
  })
  it('null si pas de date', () => {
    expect(deriveDateFinValidite(null)).toBeNull()
  })
})

/* ─── Échappement XML ──────────────────────────────────────────────────── */

describe('échappement XML strict', () => {
  it('échappe &, <, >, " dans les valeurs', async () => {
    const base = baseData()
    const property = base.property
    if (!property) throw new Error('fixture property attendue')
    const data = baseData({
      property: { ...property, address: 'Rue <test> & "co"' },
      rooms: [{ id: 'r1', name: 'Salon & <salle>', room_type: null, surface_m2: 20 }],
    })
    const zip = await unzip(await buildLicielZip(data))
    const dpe = await readText(zip, 'XML/LIV_DPE.xml')
    expect(dpe).toContain('Rue &lt;test&gt; &amp; &quot;co&quot;')
    expect(dpe).not.toContain('Rue <test> &')
    // Attribut nom de pièce échappé également.
    expect(dpe).toContain('nom="Salon &amp; &lt;salle&gt;"')
  })

  it('toutes les déclarations XML sont UTF-8', async () => {
    const zip = await unzip(await buildLicielZip(baseData()))
    for (const path of ['XML/LIV_donnees.xml', 'XML/LIV_administratif.xml', 'XML/LIV_DPE.xml']) {
      const xml = await readText(zip, path)
      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    }
  })
})

/* ─── Champs obligatoires non silencieusement omis ─────────────────────── */

describe('robustesse — champs obligatoires présents même si données absentes', () => {
  it("émet les balises clés vides si property/client absents (pas d'omission silencieuse)", async () => {
    const zip = await unzip(await buildLicielZip(baseData({ property: null, client: null })))
    const dpe = await readText(zip, 'XML/LIV_DPE.xml')
    const admin = await readText(zip, 'XML/LIV_administratif.xml')
    // §A obligatoires : balises présentes (vides) — jamais absentes.
    expect(dpe).toContain('<adresse_complete/>')
    expect(dpe).toContain('<surface_habitable/>')
    expect(dpe).toContain('<periode_construction/>')
    // §B obligatoire : nom_prenom présent même sans client.
    expect(admin).toContain('<nom_prenom/>')
    // methode_calcul reste fixe.
    expect(dpe).toContain('<methode_calcul>3CL-2021</methode_calcul>')
  })

  it('ne génère pas de XML diagnostic pour copropriete (pas de fichier dédié spec)', async () => {
    const zip = await unzip(
      await buildLicielZip(baseData({ mission: { ...baseData().mission, type: 'copropriete' } })),
    )
    expect(zip.file('XML/LIV_DPE.xml')).toBeNull()
    // donnees + administratif restent toujours présents.
    expect(zip.file('XML/LIV_donnees.xml')).not.toBeNull()
  })
})
