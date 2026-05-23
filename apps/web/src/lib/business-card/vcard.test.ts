/**
 * Tests unitaires du générateur vCard 3.0.
 *
 * Exécutable via `node --test --import tsx <path>` (tsx ou ts-node).
 * Sans framework de tests configuré dans le repo, on utilise `node:test` +
 * `node:assert` (stable depuis Node 18). Aucun setup supplémentaire requis.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildCertificationNote, buildVCard } from './vcard'

test('buildVCard — payload minimal valide', () => {
  const out = buildVCard({
    firstName: 'Benjamin',
    lastName: 'Bel',
    organization: 'Nexus 1993',
  })
  assert.ok(out.startsWith('BEGIN:VCARD\r\n'))
  assert.ok(out.includes('VERSION:3.0'))
  assert.ok(out.includes('N:Bel;Benjamin;;;'))
  assert.ok(out.includes('FN:Benjamin Bel'))
  assert.ok(out.includes('ORG:Nexus 1993'))
  assert.ok(out.endsWith('END:VCARD\r\n'))
})

test('buildVCard — payload complet avec tous les champs', () => {
  const out = buildVCard({
    firstName: 'Benjamin',
    lastName: 'Bel',
    title: 'Diagnostiqueur immobilier certifié',
    organization: 'Nexus 1993',
    emailWork: 'contact@kovas.fr',
    phoneMobile: '+33612345678',
    phoneWork: '+33235123456',
    website: 'https://kovas.fr',
    addressLine1: '12 rue de la République',
    postalCode: '76200',
    city: 'Dieppe',
    country: 'France',
    note: 'Cert. RGE n° ABC123 · SIRET 12345678900012',
  })
  assert.ok(out.includes('TITLE:Diagnostiqueur immobilier certifié'))
  assert.ok(out.includes('TEL;TYPE=CELL,VOICE,PREF:+33612345678'))
  assert.ok(out.includes('TEL;TYPE=WORK,VOICE:+33235123456'))
  assert.ok(out.includes('EMAIL;TYPE=WORK,INTERNET:contact@kovas.fr'))
  assert.ok(out.includes('URL:https://kovas.fr'))
  assert.ok(out.includes('ADR;TYPE=WORK:;;12 rue de la République;Dieppe;;76200;France'))
  assert.ok(out.includes('NOTE:Cert. RGE n° ABC123 · SIRET 12345678900012'))
})

test('buildVCard — caractères spéciaux échappés (FR + ponctuation)', () => {
  const out = buildVCard({
    firstName: 'Élise',
    lastName: "D'Aubigné, fille",
    title: 'Experte ; spécialiste',
    organization: 'Cabinet "Étoile"; Paris',
    addressLine1: "5, place de l'Opéra",
    city: 'Saint-Étienne',
    postalCode: '42000',
  })
  // Caractères accentués passent en UTF-8 brut (pas de quoted-printable).
  assert.ok(out.includes("FN:Élise D'Aubigné\\, fille"))
  assert.ok(out.includes("N:D'Aubigné\\, fille;Élise;;;"))
  // `;` échappé en `\;`
  assert.ok(out.includes('TITLE:Experte \\; spécialiste'))
  assert.ok(out.includes('ORG:Cabinet "Étoile"\\; Paris'))
  // `,` échappé en `\,`
  assert.ok(out.includes("ADR;TYPE=WORK:;;5\\, place de l'Opéra;Saint-Étienne"))
})

test('buildVCard — logo embedded PHOTO base64', () => {
  // Mini PNG 1×1 transparent : minimal valid signature.
  const tinyPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg=='
  const out = buildVCard({
    firstName: 'Benjamin',
    lastName: 'Bel',
    organization: 'Nexus 1993',
    logoBase64: tinyPngBase64,
    logoMime: 'image/png',
  })
  assert.ok(out.includes('PHOTO;ENCODING=b;TYPE=PNG:'))
  // Le PHOTO est foldé en lignes max 75 octets — on vérifie juste la présence
  // du début du blob.
  assert.ok(out.includes('iVBORw0KGgoAAAAN'))
})

test('buildVCard — line folding RFC 2426 sur lignes > 75 octets', () => {
  const longTitle =
    'Diagnostiqueur immobilier certifié spécialisé DPE amiante plomb gaz électricité termites Carrez Boutin ERP'
  const out = buildVCard({
    firstName: 'Benjamin',
    lastName: 'Bel',
    organization: 'Nexus 1993',
    title: longTitle,
  })
  // Continuation lines commencent par CRLF + espace.
  const titleLineRegex = /TITLE:[\s\S]*?\r\n /
  assert.ok(titleLineRegex.test(out), 'TITLE doit être folded (CRLF + space)')
})

test('buildCertificationNote — combine cert + siret avec séparateur ·', () => {
  const note = buildCertificationNote({
    certificationN: 'ABC123',
    siret: '12345678900012',
    showCertification: true,
    showSiret: true,
  })
  assert.equal(note, 'Cert. RGE n° ABC123 · SIRET 12345678900012')
})

test('buildCertificationNote — respecte les toggles show_*', () => {
  assert.equal(
    buildCertificationNote({
      certificationN: 'ABC123',
      siret: '12345678900012',
      showCertification: false,
      showSiret: true,
    }),
    'SIRET 12345678900012',
  )
  assert.equal(
    buildCertificationNote({
      certificationN: 'ABC123',
      siret: '12345678900012',
      showCertification: true,
      showSiret: false,
    }),
    'Cert. RGE n° ABC123',
  )
  assert.equal(
    buildCertificationNote({
      certificationN: null,
      siret: null,
      showCertification: true,
      showSiret: true,
    }),
    undefined,
  )
})
