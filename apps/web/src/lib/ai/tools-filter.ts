/**
 * KOVAS — Tool use restriction dynamique (Lot B50).
 *
 * Technique 13 du doc `AI_ECONOMICS.md` : **−200-500 tokens par appel**.
 *
 * Chaque tool exposé à Claude ajoute ~150 tokens à chaque appel (description
 * + JSON schema). Si on expose 10 tools mais que la mission n'en utilise
 * que 3, on paye 7 × 150 = 1050 tokens en input gaspillés à CHAQUE appel.
 *
 * Pattern : filtrer dynamiquement quels tools sont exposés selon le type
 * de mission (DPE / AMIANTE / PLOMB / GAZ / ELEC / TERMITES / CARREZ / ERP).
 *
 * Économie attendue à scale (1000 missions / jour avec ~5 appels Claude
 * chacune en moyenne, soit 5000 appels) :
 *   - 7 tools évités × 150 tok × 5000 appels = 5.25M tokens/jour
 *   - À $3/Mtok input Sonnet = $15.75/jour = ~14€/jour platform
 *   - = ~5100€/an d'économie pure infrastructure
 *
 * Ce module est **pure-fn** — il fournit la carte de routage tool ↔ mission
 * + un helper de filtrage. L'orchestration Claude reste côté caller.
 */

/**
 * Types de mission supportés (les 8 diagnostics standards FR couvrant 92%
 * du volume métier, cf. CLAUDE.md §3). Aligné sur la table missions.diagnostic_type.
 */
export type MissionType =
  | 'DPE'
  | 'AMIANTE'
  | 'PLOMB'
  | 'GAZ'
  | 'ELECTRICITE'
  | 'TERMITES'
  | 'CARREZ'
  | 'ERP'

/**
 * Tools KOVAS exposables à Claude. Liste exhaustive pour validation
 * type-safe. Chaque tool a un coût en tokens (~150 tok en moyenne pour
 * description + JSON schema).
 */
export type ToolName =
  // Tools data (read-only)
  | 'search_dpe_history' // Historique DPE ADEME pour ce bien
  | 'search_amiante_history' // Historique amiante
  | 'check_cadastre' // Vérification cadastre IGN
  | 'get_dvf_data' // Données DVF (transactions immobilières)
  | 'get_ban_address' // Résolution BAN adresse normalisée
  | 'get_georisques' // Risques naturels et technologiques
  | 'check_year_built' // Vérification année construction
  | 'list_materials' // Liste matériaux susceptibles d'amiante par âge
  | 'check_installation_year' // Année installation gaz/élec
  | 'get_termite_zone' // Zone d'infestation termites par commune
  | 'check_marprimerenov' // Eligibilité MaPrimeRénov'
  | 'list_aids' // Aides disponibles (CEE, MPR, etc.)
  | 'estimate_gains' // Estimation gains audit énergétique
  // Tools predictifs
  | 'predict_class' // Prédiction classe DPE
  | 'predict_dpe_class' // Prédiction classe DPE (alias)
  // Tools écriture (rare en production, surtout admin)
  | 'persist_finding' // Persister une découverte mission
  | 'create_alert' // Créer une alerte ADEME

/**
 * Carte mission type → liste des tools pertinents.
 *
 * Ne lister QUE les tools VRAIMENT utiles pour ce type de mission. Si on
 * ajoute un tool dans la liste sans qu'il soit utilisé, le coût tokens
 * augmente sans bénéfice.
 *
 * Tools transverses (BAN, cadastre, DVF) listés explicitement pour chaque
 * mission qui peut en avoir besoin — pas de "tous les tools partout".
 */
export const TOOLS_PER_MISSION_TYPE: Readonly<Record<MissionType, ReadonlyArray<ToolName>>> = {
  DPE: [
    'search_dpe_history',
    'check_cadastre',
    'get_ban_address',
    'get_dvf_data',
    'predict_dpe_class',
    'check_year_built',
  ],
  AMIANTE: [
    'search_amiante_history',
    'check_year_built',
    'list_materials',
    'check_cadastre',
    'get_ban_address',
  ],
  PLOMB: ['check_year_built', 'list_materials', 'check_cadastre', 'get_ban_address'],
  GAZ: ['check_installation_year', 'check_cadastre', 'get_ban_address'],
  ELECTRICITE: ['check_installation_year', 'check_cadastre', 'get_ban_address'],
  TERMITES: ['get_termite_zone', 'check_cadastre', 'get_ban_address'],
  CARREZ: ['check_cadastre', 'get_ban_address'],
  ERP: ['get_georisques', 'check_cadastre', 'get_ban_address'],
}

/**
 * Coût en tokens approximatif par tool (input — description + JSON schema).
 * Tools complexes (search_dpe_history avec filtres riches) coûtent plus
 * que tools simples (get_ban_address).
 */
const TOOL_TOKEN_COST: Readonly<Record<ToolName, number>> = {
  search_dpe_history: 200,
  search_amiante_history: 180,
  check_cadastre: 150,
  get_dvf_data: 200,
  get_ban_address: 120,
  get_georisques: 180,
  check_year_built: 100,
  list_materials: 130,
  check_installation_year: 100,
  get_termite_zone: 130,
  check_marprimerenov: 160,
  list_aids: 200,
  estimate_gains: 220,
  predict_class: 100,
  predict_dpe_class: 100,
  persist_finding: 150,
  create_alert: 130,
}

/**
 * Retourne les tools pertinents pour une mission donnée.
 *
 * Si le missionType est inconnu (pas dans l'enum), retourne un set vide
 * pour forcer le caller à fallback en exposant TOUS les tools (sécurité).
 */
export function getToolsForMission(missionType: MissionType): ReadonlyArray<ToolName> {
  return TOOLS_PER_MISSION_TYPE[missionType] ?? []
}

/**
 * Calcule le coût en tokens d'exposer un set de tools donné. Pure-fn.
 *
 * Utilisé par le caller pour décider de filtrer (vs exposer tout) et par
 * le dashboard `/admin/sante-tech` pour projeter les économies.
 */
export function computeToolsCostTokens(tools: ReadonlyArray<ToolName>): number {
  return tools.reduce((sum, t) => sum + (TOOL_TOKEN_COST[t] ?? 150), 0)
}

/** Total tokens de tous les tools (baseline = exposer tout partout). */
export function fullToolsCostTokens(): number {
  return Object.values(TOOL_TOKEN_COST).reduce((sum, c) => sum + c, 0)
}

/**
 * Estime l'économie tokens + EUR sur N appels avec filtrage actif.
 *
 * Hypothèse simplificatrice : on prend la médiane tools filtrés par
 * mission type (~5 tools, ~750 tokens) vs full pool (17 tools, ~2550
 * tokens). Économie ~1800 tokens/appel.
 */
export function estimateToolFilteringSavings(input: {
  totalCalls: number
  inputTokenPriceUsdPerMtok?: number // default 3$ (Sonnet 4.6)
  usdToEurRate?: number // default 0.92
}): {
  baseline_tokens: number
  filtered_tokens: number
  saved_tokens: number
  baseline_cost_eur: number
  filtered_cost_eur: number
  saved_eur: number
  saved_pct: number
} {
  const tokenPrice = input.inputTokenPriceUsdPerMtok ?? 3
  const eurRate = input.usdToEurRate ?? 0.92
  const callsCount = Math.max(0, input.totalCalls)

  const fullTokens = fullToolsCostTokens()
  // Médiane des tools filtrés : moyenne pondérée sur les MissionType
  const avgFilteredTokens =
    Object.values(TOOLS_PER_MISSION_TYPE).reduce(
      (sum, tools) => sum + computeToolsCostTokens(tools),
      0,
    ) / Math.max(1, Object.keys(TOOLS_PER_MISSION_TYPE).length)

  const baselineTok = callsCount * fullTokens
  const filteredTok = callsCount * avgFilteredTokens
  const savedTok = Math.max(0, baselineTok - filteredTok)

  const baselineCostEur = (baselineTok / 1_000_000) * tokenPrice * eurRate
  const filteredCostEur = (filteredTok / 1_000_000) * tokenPrice * eurRate
  const savedCostEur = Math.max(0, baselineCostEur - filteredCostEur)

  return {
    baseline_tokens: baselineTok,
    filtered_tokens: Math.round(filteredTok),
    saved_tokens: Math.round(savedTok),
    baseline_cost_eur: Math.round(baselineCostEur * 1_000_000) / 1_000_000,
    filtered_cost_eur: Math.round(filteredCostEur * 1_000_000) / 1_000_000,
    saved_eur: Math.round(savedCostEur * 1_000_000) / 1_000_000,
    saved_pct: baselineTok > 0 ? Math.round((savedTok / baselineTok) * 1000) / 10 : 0,
  }
}
