/**
 * Vitest — Pré-export findings IAL pour les risques étendus.
 *
 * Couvre la matrice :
 *   - Aucun bundle → []
 *   - Bundle vide → []
 *   - Radon classe 3 sans IAL coché → 1 finding warn
 *   - Radon classe 3 + IAL coché → []
 *   - Radon classe 1 → []
 *   - PPRI approuvé sans IAL coché → 1 finding warn
 *   - PPRI prescrit (pas approuvé) sans IAL coché → []
 *   - Argiles fort sans IAL coché → 1 finding warn
 *   - Argiles faible → []
 *   - Combos (3 conditions actives) → 3 findings
 */

import { describe, expect, it } from 'vitest'
import { buildExtendedRisksFindings } from './extended-risks-findings'
import type { ExtendedRisksBundle } from './georisques-cache'

function emptyBundle(): ExtendedRisksBundle {
  return {
    radon: null,
    ppri: [],
    argiles: null,
    cavites: [],
    source: 'georisques.gouv.fr',
    fetchedAt: new Date().toISOString(),
  }
}

describe('buildExtendedRisksFindings', () => {
  it('returns [] when bundle is null', () => {
    expect(buildExtendedRisksFindings(null, null)).toEqual([])
  })

  it('returns [] when bundle is empty', () => {
    expect(buildExtendedRisksFindings(emptyBundle(), null)).toEqual([])
  })

  it('warns when radon classe 3 and IAL not acknowledged', () => {
    const bundle = emptyBundle()
    bundle.radon = {
      codeInsee: '76217',
      classe: 3,
      obligationIAL: true,
      source: 'georisques.gouv.fr',
    }
    const findings = buildExtendedRisksFindings(bundle, null)
    expect(findings).toHaveLength(1)
    expect(findings[0].id).toBe('ial-radon')
    expect(findings[0].severity).toBe('warn')
  })

  it('does NOT warn when radon classe 3 + IAL acknowledged', () => {
    const bundle = emptyBundle()
    bundle.radon = {
      codeInsee: '76217',
      classe: 3,
      obligationIAL: true,
      source: 'georisques.gouv.fr',
    }
    const findings = buildExtendedRisksFindings(bundle, {
      ial_acknowledged: { radon: true },
    })
    expect(findings).toEqual([])
  })

  it('does NOT warn for radon classe 1', () => {
    const bundle = emptyBundle()
    bundle.radon = {
      codeInsee: '75056',
      classe: 1,
      obligationIAL: false,
      source: 'georisques.gouv.fr',
    }
    expect(buildExtendedRisksFindings(bundle, null)).toEqual([])
  })

  it('warns when an approuve PPRI exists and IAL not ack', () => {
    const bundle = emptyBundle()
    bundle.ppri = [
      {
        codeInsee: '76217',
        id: 'PPRI_76_001',
        libelle: 'PPRI Bresle',
        etat: 'approuvé',
        dateApprobation: '2014-05-12',
        url: null,
        source: 'georisques.gouv.fr',
      },
    ]
    const findings = buildExtendedRisksFindings(bundle, null)
    expect(findings).toHaveLength(1)
    expect(findings[0].id).toBe('ial-ppri')
  })

  it('does NOT warn when PPRI is only prescrit', () => {
    const bundle = emptyBundle()
    bundle.ppri = [
      {
        codeInsee: '76217',
        id: 'PPRI_DRAFT',
        libelle: 'PPRI en cours',
        etat: 'prescrit',
        dateApprobation: null,
        url: null,
        source: 'georisques.gouv.fr',
      },
    ]
    expect(buildExtendedRisksFindings(bundle, null)).toEqual([])
  })

  it('warns when argiles fort and IAL not ack', () => {
    const bundle = emptyBundle()
    bundle.argiles = {
      lat: 49.92,
      lng: 1.07,
      alea: 'fort',
      obligationIAL: true,
      source: 'georisques.gouv.fr',
    }
    const findings = buildExtendedRisksFindings(bundle, null)
    expect(findings).toHaveLength(1)
    expect(findings[0].id).toBe('ial-argiles')
    expect(findings[0].message).toContain('fort')
  })

  it('warns for argiles moyen too', () => {
    const bundle = emptyBundle()
    bundle.argiles = {
      lat: 49.92,
      lng: 1.07,
      alea: 'moyen',
      obligationIAL: true,
      source: 'georisques.gouv.fr',
    }
    const findings = buildExtendedRisksFindings(bundle, null)
    expect(findings).toHaveLength(1)
    expect(findings[0].message).toContain('moyen')
  })

  it('does NOT warn for argiles faible', () => {
    const bundle = emptyBundle()
    bundle.argiles = {
      lat: 49.92,
      lng: 1.07,
      alea: 'faible',
      obligationIAL: false,
      source: 'georisques.gouv.fr',
    }
    expect(buildExtendedRisksFindings(bundle, null)).toEqual([])
  })

  it('returns 3 findings when 3 conditions are active', () => {
    const bundle = emptyBundle()
    bundle.radon = {
      codeInsee: '76217',
      classe: 3,
      obligationIAL: true,
      source: 'georisques.gouv.fr',
    }
    bundle.ppri = [
      {
        codeInsee: '76217',
        id: 'PPRI_76_001',
        libelle: 'PPRI Bresle',
        etat: 'approuvé',
        dateApprobation: '2014-05-12',
        url: null,
        source: 'georisques.gouv.fr',
      },
    ]
    bundle.argiles = {
      lat: 49.92,
      lng: 1.07,
      alea: 'fort',
      obligationIAL: true,
      source: 'georisques.gouv.fr',
    }
    const findings = buildExtendedRisksFindings(bundle, null)
    expect(findings.map((f) => f.id).sort()).toEqual(['ial-argiles', 'ial-ppri', 'ial-radon'])
  })

  it('respects partial IAL ack (radon true, ppri false)', () => {
    const bundle = emptyBundle()
    bundle.radon = {
      codeInsee: '76217',
      classe: 3,
      obligationIAL: true,
      source: 'georisques.gouv.fr',
    }
    bundle.ppri = [
      {
        codeInsee: '76217',
        id: 'PPRI_76_001',
        libelle: 'PPRI Bresle',
        etat: 'approuvé',
        dateApprobation: '2014-05-12',
        url: null,
        source: 'georisques.gouv.fr',
      },
    ]
    const findings = buildExtendedRisksFindings(bundle, {
      ial_acknowledged: { radon: true },
    })
    expect(findings).toHaveLength(1)
    expect(findings[0].id).toBe('ial-ppri')
  })

  it('handles malformed metadata gracefully', () => {
    const bundle = emptyBundle()
    bundle.radon = {
      codeInsee: '76217',
      classe: 3,
      obligationIAL: true,
      source: 'georisques.gouv.fr',
    }
    expect(buildExtendedRisksFindings(bundle, { ial_acknowledged: 'invalid' })).toHaveLength(1)
    expect(buildExtendedRisksFindings(bundle, { ial_acknowledged: null })).toHaveLength(1)
  })
})
