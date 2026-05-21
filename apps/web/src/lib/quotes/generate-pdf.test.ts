/**
 * KOVAS — Tests unitaires du générateur PDF devis.
 *
 * Pattern aligné sur `business-card/vcard.test.ts` :
 *   node --test --import tsx <path>
 *
 * On vérifie que :
 *   - generateQuotePdf retourne un Buffer non vide
 *   - Le Buffer commence par `%PDF-` (signature PDF magic bytes)
 *   - computeQuoteTotals calcule correctement HT/TVA/TTC
 *   - generateFacturxXml produit un XML valide structurellement
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generateFacturxXml } from './generate-facturx-xml'
import { generateQuotePdf } from './generate-pdf'
import {
  computeQuoteTotals,
  type QuoteClientSnapshot,
  type QuoteLineItem,
  type QuoteOrganizationSnapshot,
} from './types'

const SAMPLE_LINES: QuoteLineItem[] = [
  {
    id: 'line-1',
    kind: 'diagnostic',
    designation: 'DPE — appartement 65 m²',
    quantity: 1,
    unitPriceHt: 130,
    tvaRate: 20,
    diagnosticType: 'DPE',
  },
  {
    id: 'line-2',
    kind: 'diagnostic',
    designation: 'Amiante — appartement 65 m²',
    quantity: 1,
    unitPriceHt: 110,
    tvaRate: 20,
    diagnosticType: 'AMIANTE',
  },
  {
    id: 'line-3',
    kind: 'travel',
    designation: 'Frais de déplacement — 5 €',
    quantity: 1,
    unitPriceHt: 5,
    tvaRate: 20,
  },
]

const SAMPLE_ORG: QuoteOrganizationSnapshot = {
  name: 'Cabinet KOVAS Démo',
  siret: '12345678900015',
  vatNumber: 'FR12345678900',
  address: '12 rue de la République',
  city: 'Paris',
  postalCode: '75008',
  country: 'FR',
  certificationN: 'COFRAC-DPE-2026',
}

const SAMPLE_CLIENT: QuoteClientSnapshot = {
  displayName: 'Jean Dupont',
  email: 'jean.dupont@example.com',
  phone: '+33612345678',
  companyName: null,
  siret: null,
  address: '5 avenue des Champs',
  city: 'Lyon',
  postalCode: '69000',
}

test('computeQuoteTotals — somme HT, TVA 20% et TTC arrondis', () => {
  const totals = computeQuoteTotals(SAMPLE_LINES)
  assert.equal(totals.subtotalHt, 245)
  assert.equal(totals.totalTva, 49)
  assert.equal(totals.totalTtc, 294)
})

test('computeQuoteTotals — lignes vides retournent 0', () => {
  const totals = computeQuoteTotals([])
  assert.equal(totals.subtotalHt, 0)
  assert.equal(totals.totalTva, 0)
  assert.equal(totals.totalTtc, 0)
})

test('generateQuotePdf — Buffer non vide commençant par %PDF-', () => {
  const buf = generateQuotePdf({
    reference: 'DEV-2026-00042',
    issuedAt: '2026-05-27',
    expiresAt: '2026-06-26',
    lines: SAMPLE_LINES,
    organization: SAMPLE_ORG,
    client: SAMPLE_CLIENT,
    notes: 'Merci pour votre confiance.',
    paymentTermsDays: 30,
    paymentMethod: 'virement',
    brandColorHex: '#0F1419',
    logoDataUrl: null,
  })
  assert.ok(Buffer.isBuffer(buf), 'le retour doit être un Buffer')
  assert.ok(buf.length > 1000, 'le PDF doit être non trivial (> 1 KB)')
  // Signature PDF magic
  const header = buf.subarray(0, 5).toString('ascii')
  assert.equal(header, '%PDF-', `Header attendu '%PDF-', reçu '${header}'`)
})

test('generateFacturxXml — XML CII valide structurellement', () => {
  const xml = generateFacturxXml({
    reference: 'DEV-2026-00042',
    issuedAt: '2026-05-27',
    expiresAt: '2026-06-26',
    lines: SAMPLE_LINES,
    totalHt: 245,
    totalTva: 49,
    totalTtc: 294,
    paymentTermsDays: 30,
    paymentMethod: 'virement',
    organization: SAMPLE_ORG,
    client: SAMPLE_CLIENT,
    profile: 'EN16931',
  })
  assert.ok(xml.startsWith('<?xml version="1.0"'), 'doit commencer par déclaration XML')
  assert.ok(xml.includes('<rsm:CrossIndustryInvoice'), 'doit contenir root CII')
  assert.ok(xml.includes('DEV-2026-00042'), 'doit contenir la référence')
  assert.ok(xml.includes('urn:cen.eu:en16931:2017'), 'profile EN16931 doit être déclaré')
  assert.ok(xml.includes('12345678900015'), 'SIRET émetteur doit être présent')
  assert.ok(xml.includes('Jean Dupont'), 'destinataire doit être présent')
  assert.ok(xml.includes('<ram:GrandTotalAmount>294.00</ram:GrandTotalAmount>'))
  // Vérifie la fermeture
  assert.ok(xml.trimEnd().endsWith('</rsm:CrossIndustryInvoice>'))
})

test('generateFacturxXml — escape XML correctement les caractères dangereux', () => {
  const xml = generateFacturxXml({
    reference: 'DEV-2026-00099',
    issuedAt: '2026-05-27',
    expiresAt: '2026-06-26',
    lines: [
      {
        id: 'l1',
        kind: 'custom',
        designation: 'A & B <test> "quoted"',
        quantity: 1,
        unitPriceHt: 100,
        tvaRate: 20,
      },
    ],
    totalHt: 100,
    totalTva: 20,
    totalTtc: 120,
    paymentTermsDays: 30,
    paymentMethod: 'virement',
    organization: SAMPLE_ORG,
    client: SAMPLE_CLIENT,
  })
  assert.ok(xml.includes('A &amp; B &lt;test&gt; &quot;quoted&quot;'))
  assert.ok(!xml.includes('<test>'))
})
