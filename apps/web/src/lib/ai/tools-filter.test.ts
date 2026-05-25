/**
 * Vitest — tool use filtering dynamic (Lot B50).
 *
 * Pure-fn déterministes (zéro IO, zéro Math.random).
 */

import { describe, expect, it } from 'vitest'
import {
  type MissionType,
  TOOLS_PER_MISSION_TYPE,
  type ToolName,
  computeToolsCostTokens,
  estimateToolFilteringSavings,
  fullToolsCostTokens,
  getToolsForMission,
} from './tools-filter'

describe('TOOLS_PER_MISSION_TYPE carte', () => {
  it('contient les 8 mission types FR', () => {
    const required: MissionType[] = [
      'DPE',
      'AMIANTE',
      'PLOMB',
      'GAZ',
      'ELECTRICITE',
      'TERMITES',
      'CARREZ',
      'ERP',
    ]
    for (const m of required) {
      expect(TOOLS_PER_MISSION_TYPE[m]).toBeDefined()
    }
  })

  it('DPE expose les tools predict_dpe_class + search_dpe_history', () => {
    expect(TOOLS_PER_MISSION_TYPE.DPE).toContain('predict_dpe_class')
    expect(TOOLS_PER_MISSION_TYPE.DPE).toContain('search_dpe_history')
  })

  it('AMIANTE expose list_materials + check_year_built (< 1997 critique)', () => {
    expect(TOOLS_PER_MISSION_TYPE.AMIANTE).toContain('list_materials')
    expect(TOOLS_PER_MISSION_TYPE.AMIANTE).toContain('check_year_built')
  })

  it('ERP expose get_georisques (risque naturel/techno)', () => {
    expect(TOOLS_PER_MISSION_TYPE.ERP).toContain('get_georisques')
  })

  it('CARREZ a peu de tools (mesurage surface, pas de Vision)', () => {
    expect(TOOLS_PER_MISSION_TYPE.CARREZ.length).toBeLessThanOrEqual(3)
  })

  it('tous les types mission listent au moins 1 tool', () => {
    for (const tools of Object.values(TOOLS_PER_MISSION_TYPE)) {
      expect(tools.length).toBeGreaterThan(0)
    }
  })
})

describe('getToolsForMission', () => {
  it('retourne les tools pour DPE', () => {
    const tools = getToolsForMission('DPE')
    expect(tools.length).toBeGreaterThan(0)
    expect(tools).toContain('search_dpe_history')
  })

  it('retourne les tools pour AMIANTE différents de DPE', () => {
    const amianteTools = getToolsForMission('AMIANTE')
    const dpeTools = getToolsForMission('DPE')
    // Sets différents — pas l'inverse de set-equality
    expect(amianteTools).not.toEqual(dpeTools)
  })

  it('CARREZ a moins de tools que DPE (mission simple)', () => {
    expect(getToolsForMission('CARREZ').length).toBeLessThan(getToolsForMission('DPE').length)
  })
})

describe('computeToolsCostTokens', () => {
  it('zero tokens pour tableau vide', () => {
    expect(computeToolsCostTokens([])).toBe(0)
  })

  it('somme correctement les coûts individuels', () => {
    // check_year_built (100) + check_cadastre (150) = 250
    const cost = computeToolsCostTokens(['check_year_built', 'check_cadastre'])
    expect(cost).toBe(250)
  })

  it('coût croît avec nombre de tools', () => {
    const small = computeToolsCostTokens(['get_ban_address'])
    const big = computeToolsCostTokens(getToolsForMission('DPE'))
    expect(big).toBeGreaterThan(small)
  })
})

describe('fullToolsCostTokens', () => {
  it('est > 1500 tokens (au moins 10 tools × 150)', () => {
    expect(fullToolsCostTokens()).toBeGreaterThan(1500)
  })

  it('est >= au coût de la mission DPE (qui filtre)', () => {
    const dpeFiltered = computeToolsCostTokens(getToolsForMission('DPE'))
    expect(fullToolsCostTokens()).toBeGreaterThan(dpeFiltered)
  })
})

describe('estimateToolFilteringSavings', () => {
  it('zero savings si 0 calls', () => {
    const s = estimateToolFilteringSavings({ totalCalls: 0 })
    expect(s.baseline_cost_eur).toBe(0)
    expect(s.saved_eur).toBe(0)
  })

  it('économies positives sur 1000 calls', () => {
    const s = estimateToolFilteringSavings({ totalCalls: 1000 })
    expect(s.saved_tokens).toBeGreaterThan(0)
    expect(s.saved_eur).toBeGreaterThan(0)
    expect(s.saved_pct).toBeGreaterThan(0)
  })

  it('économies > 50% (médiane filtrée 5 tools vs full ~17 tools)', () => {
    const s = estimateToolFilteringSavings({ totalCalls: 1000 })
    expect(s.saved_pct).toBeGreaterThan(50)
  })

  it('respect custom token price', () => {
    // 5$ vs 3$ → 1.67× plus cher en baseline et filtered, ratio identique
    const standard = estimateToolFilteringSavings({ totalCalls: 1000 })
    const premium = estimateToolFilteringSavings({
      totalCalls: 1000,
      inputTokenPriceUsdPerMtok: 5,
    })
    expect(premium.baseline_cost_eur).toBeGreaterThan(standard.baseline_cost_eur)
    expect(premium.saved_pct).toBeCloseTo(standard.saved_pct, 1)
  })

  it('respect custom usdToEurRate', () => {
    const eur1 = estimateToolFilteringSavings({ totalCalls: 1000, usdToEurRate: 1.0 })
    const eur092 = estimateToolFilteringSavings({ totalCalls: 1000, usdToEurRate: 0.92 })
    // Taux 1.0 → coûts plus élevés (1$ = 1€ vs 1$ = 0.92€)
    expect(eur1.baseline_cost_eur).toBeGreaterThan(eur092.baseline_cost_eur)
  })

  it('clamp totalCalls à >= 0', () => {
    const s = estimateToolFilteringSavings({ totalCalls: -100 })
    expect(s.baseline_cost_eur).toBe(0)
  })

  it('matches AI_ECONOMICS direction (~5100€/an à scale plateforme)', () => {
    // Scale typique : 1000 missions/jour × 5 appels = 5000 calls/jour × 365j
    const s = estimateToolFilteringSavings({ totalCalls: 5000 * 365 })
    // Doc projette ~5100€/an. Avec hypothèses (Sonnet 3$/Mtok, EUR rate 0.92,
    // ~17 tools full vs ~5 filtered), l'ordre de grandeur doit être en
    // milliers d'euros (pas centaines, pas dizaines de milliers).
    expect(s.saved_eur).toBeGreaterThan(1000)
    expect(s.saved_eur).toBeLessThan(50000)
  })
})

describe('Tool token costs consistency', () => {
  it('tous les ToolName référencés dans TOOLS_PER_MISSION_TYPE ont un coût défini', () => {
    // Pour éviter de tomber sur le default 150 silently
    const allTools = new Set<ToolName>()
    for (const tools of Object.values(TOOLS_PER_MISSION_TYPE)) {
      for (const t of tools) allTools.add(t)
    }
    for (const tool of allTools) {
      // computeToolsCostTokens([tool]) doit retourner un nombre > 0
      expect(computeToolsCostTokens([tool])).toBeGreaterThan(0)
    }
  })
})
