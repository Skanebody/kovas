/**
 * KOVAS — Algo A1.3.5 : Lead scoring + routing bandit.
 *
 * Calcule un score d'intent 0-100 pour un lead B2C (quote_request) en
 * combinant 6 signaux. Le score sert ensuite à :
 *   - prioriser le routing (high-intent = SMS, mid-intent = email, low = batch)
 *   - filtrer les leads à pousser dans le bandit Thompson (≥ threshold)
 *   - alimenter le pricing dynamique annuaire (lead premium = unlock plus cher)
 *
 * Pure function, déterministe — testable + cachable (`quote_requests.intent_score`).
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §6.3 (GC3 Annuaire B2C enrichi)
 *           + .claude/orchestration-kovas-app/algos-acqui-target.md §A1.3.5
 */

export interface LeadScoringInput {
  /** Bien — type d'opération (vente > location > travaux > audit pour intent) */
  property_situation: 'vente' | 'location' | 'travaux' | 'audit'
  /** Bien — type (maison génère + de diags, intent plus élevé) */
  property_type: 'maison' | 'appartement' | 'local_commercial' | 'autre'
  /** Bien — surface m² (proxy valeur du bien donc honoraires diag) */
  property_surface_m2: number | null
  /** Bien — code postal (urbanité = +volume, ruralité = +distance, ~équilibré) */
  property_postal_code: string | null
  /** Bien — année construction (anciens = + diags obligatoires : amiante, plomb) */
  property_year_built: number | null
  /** Liste des codes diagnostic demandés explicitement par le requester */
  diagnostics_requested: string[]
  /** Liste des codes que KOVAS a auto-suggérés (cohérence métier) */
  diagnostics_suggested_count: number
  /** Email — domaine pro vs particulier (pro = intent agence/notaire, ++) */
  requester_email: string
  /** Téléphone E.164 fourni (signal d'engagement) */
  has_phone: boolean
  /** Message libre rempli (signal d'engagement supplémentaire) */
  has_message: boolean
  /** Anti-spam — honeypot rempli => score = 0 */
  honeypot_filled: boolean
  /** Anti-spam — score reCAPTCHA (0-1, NULL = non vérifié) */
  recaptcha_score: number | null
}

export type IntentBucket = 'spam' | 'low' | 'mid' | 'high' | 'premium'

export interface LeadScoringResult {
  /** Score 0-100 final (NULL si spam détecté) */
  intent_score: number
  /** Bucket lisible (utilisé pour le routing) */
  bucket: IntentBucket
  /** Détail des contributions de chaque signal (audit + debug) */
  signals: ReadonlyArray<{
    code: string
    label: string
    points: number
    detail: string
  }>
  /** Si true, lead à exclure du routing (honeypot ou reCAPTCHA très faible) */
  exclude_from_routing: boolean
  /** Confidence 0-1 (incertitude due à champs NULL) */
  confidence: number
  /** Recommandation pour route-lead Edge Function */
  recommended_channel: 'sms_immediate' | 'email_priority' | 'email_batch' | 'skip'
}

// Domaines email considérés comme "pro" (intent supérieur)
const PRO_EMAIL_DOMAINS = new Set([
  // Agences immo nationales / régionales
  'orpi.com',
  'century21.fr',
  'foncia.com',
  'guy-hoquet.com',
  'laforet.com',
  'nestenn.com',
  'capifrance.fr',
  'iadfrance.com',
  // Notaires
  'notaires.fr',
  // Mandataires / réseaux
  'megagence.com',
  'safti.fr',
  // Pros du diagnostic / construction
  'rge.fr',
])

// Codes postaux préfixes urbains (M+ 100k habitants — intent volume)
const URBAN_PREFIXES = new Set([
  '13', // Bouches-du-Rhône (Marseille)
  '31', // Haute-Garonne (Toulouse)
  '33', // Gironde (Bordeaux)
  '34', // Hérault (Montpellier)
  '35', // Ille-et-Vilaine (Rennes)
  '38', // Isère (Grenoble)
  '44', // Loire-Atlantique (Nantes)
  '59', // Nord (Lille)
  '67', // Bas-Rhin (Strasbourg)
  '69', // Rhône (Lyon)
  '75', // Paris
  '76', // Seine-Maritime (Rouen)
  '77', // Seine-et-Marne
  '78', // Yvelines
  '83', // Var
  '91', // Essonne
  '92', // Hauts-de-Seine
  '93', // Seine-Saint-Denis
  '94', // Val-de-Marne
  '95', // Val-d'Oise
])

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function emailIsPro(email: string): boolean {
  const at = email.indexOf('@')
  if (at < 0) return false
  const domain = email
    .slice(at + 1)
    .toLowerCase()
    .trim()
  return PRO_EMAIL_DOMAINS.has(domain)
}

function isUrbanPostcode(postcode: string | null): boolean {
  if (!postcode || postcode.length < 2) return false
  return URBAN_PREFIXES.has(postcode.slice(0, 2))
}

export function scoreLeadIntent(input: LeadScoringInput): LeadScoringResult {
  const signals: Array<{ code: string; label: string; points: number; detail: string }> = []
  let nullsCount = 0
  let totalConsidered = 0

  // 0. Garde-fou anti-spam — exclusion immédiate
  if (input.honeypot_filled) {
    return {
      intent_score: 0,
      bucket: 'spam',
      signals: [
        {
          code: 'HONEYPOT',
          label: 'Honeypot rempli (bot)',
          points: 0,
          detail: 'Lead exclu du routing',
        },
      ],
      exclude_from_routing: true,
      confidence: 1,
      recommended_channel: 'skip',
    }
  }
  if (input.recaptcha_score !== null && input.recaptcha_score < 0.3) {
    return {
      intent_score: 0,
      bucket: 'spam',
      signals: [
        {
          code: 'RECAPTCHA_LOW',
          label: `reCAPTCHA ${input.recaptcha_score.toFixed(2)} (suspect)`,
          points: 0,
          detail: 'Lead exclu du routing',
        },
      ],
      exclude_from_routing: true,
      confidence: 1,
      recommended_channel: 'skip',
    }
  }

  // 1. Situation (max 25 pts)
  totalConsidered += 1
  const situationPoints =
    input.property_situation === 'vente'
      ? 25
      : input.property_situation === 'travaux'
        ? 18
        : input.property_situation === 'audit'
          ? 14
          : 10 // location
  signals.push({
    code: 'SITUATION',
    label: `Situation : ${input.property_situation}`,
    points: situationPoints,
    detail: 'Vente = volume diagnostic max (DPE + amiante + plomb + ERP + carrez/boutin)',
  })

  // 2. Type bien (max 15 pts)
  totalConsidered += 1
  const typePoints =
    input.property_type === 'maison'
      ? 15
      : input.property_type === 'appartement'
        ? 10
        : input.property_type === 'local_commercial'
          ? 8
          : 4
  signals.push({
    code: 'TYPE',
    label: `Type : ${input.property_type}`,
    points: typePoints,
    detail: 'Maison = + diagnostics (termites, gaz, élec si > 15 ans)',
  })

  // 3. Surface (max 10 pts — log scaling)
  totalConsidered += 1
  if (input.property_surface_m2 === null) {
    nullsCount += 1
    signals.push({
      code: 'SURFACE_NULL',
      label: 'Surface non renseignée',
      points: 0,
      detail: 'Donnée manquante',
    })
  } else {
    const surfacePoints = Math.min(
      10,
      Math.round(
        clamp01((Math.log(input.property_surface_m2 + 1) - Math.log(20)) / Math.log(10)) * 10,
      ),
    )
    signals.push({
      code: 'SURFACE',
      label: `${input.property_surface_m2} m²`,
      points: surfacePoints,
      detail: 'Surface > 100m² = honoraires diag supérieurs',
    })
  }

  // 4. Ancienneté (max 10 pts — > 1949 amiante, > 1996 plomb)
  totalConsidered += 1
  if (input.property_year_built === null) {
    nullsCount += 1
    signals.push({
      code: 'YEAR_NULL',
      label: 'Année construction non renseignée',
      points: 0,
      detail: 'Donnée manquante',
    })
  } else {
    let yearPoints = 0
    let detail = 'Construction récente'
    if (input.property_year_built < 1949) {
      yearPoints = 10
      detail = 'Avant 1949 — amiante + plomb obligatoires'
    } else if (input.property_year_built < 1997) {
      yearPoints = 8
      detail = 'Avant 1997 — amiante obligatoire'
    } else if (input.property_year_built < 2010) {
      yearPoints = 4
      detail = 'Récent — diagnostics standards'
    } else {
      yearPoints = 2
    }
    signals.push({
      code: 'YEAR',
      label: `Construction ${input.property_year_built}`,
      points: yearPoints,
      detail,
    })
  }

  // 5. Engagement (téléphone + message + nb diags demandés) — max 25 pts
  totalConsidered += 1
  const diagsCount = input.diagnostics_requested.length
  const diagsPoints = Math.min(15, diagsCount * 2.5)
  const phonePoints = input.has_phone ? 5 : 0
  const messagePoints = input.has_message ? 5 : 0
  const engagementPoints = Math.round(diagsPoints + phonePoints + messagePoints)
  signals.push({
    code: 'ENGAGEMENT',
    label: `Engagement (${diagsCount} diags, tél : ${input.has_phone ? 'oui' : 'non'}, msg : ${input.has_message ? 'oui' : 'non'})`,
    points: engagementPoints,
    detail: 'Profil rempli en détail = intent élevée',
  })

  // 6. Email pro (bonus +10 pts pour agences/notaires)
  totalConsidered += 1
  const proEmail = emailIsPro(input.requester_email)
  const proPoints = proEmail ? 10 : 0
  signals.push({
    code: 'EMAIL_PRO',
    label: proEmail ? `Email pro (${input.requester_email.split('@')[1]})` : 'Email particulier',
    points: proPoints,
    detail: proEmail
      ? 'Agence / notaire : intent volume + récurrent'
      : 'Email particulier (neutre)',
  })

  // 7. Urbanité (bonus +5 pts si bien en zone urbaine — diag pas trop loin)
  totalConsidered += 1
  if (input.property_postal_code === null) {
    nullsCount += 1
    signals.push({
      code: 'POSTCODE_NULL',
      label: 'Code postal non renseigné',
      points: 0,
      detail: 'Donnée manquante',
    })
  } else if (isUrbanPostcode(input.property_postal_code)) {
    signals.push({
      code: 'URBAN',
      label: `Zone urbaine (${input.property_postal_code})`,
      points: 5,
      detail: 'Concurrence diag dense → pricing dynamique',
    })
  } else {
    signals.push({
      code: 'RURAL',
      label: `Zone rurale/intermédiaire (${input.property_postal_code})`,
      points: 0,
      detail: 'Pas de bonus urbain',
    })
  }

  // Total brut (max théorique : 25 + 15 + 10 + 10 + 25 + 10 + 5 = 100)
  const totalPoints = signals.reduce((acc, s) => acc + s.points, 0)
  const intent_score = Math.max(0, Math.min(100, Math.round(totalPoints)))

  // Bucket + canal
  const bucket: IntentBucket =
    intent_score >= 75
      ? 'premium'
      : intent_score >= 60
        ? 'high'
        : intent_score >= 40
          ? 'mid'
          : 'low'

  const recommended_channel: LeadScoringResult['recommended_channel'] =
    bucket === 'premium'
      ? 'sms_immediate'
      : bucket === 'high'
        ? 'email_priority'
        : bucket === 'mid'
          ? 'email_batch'
          : 'email_batch'

  // Confidence : 1 - (nulls / total) avec plancher 0.6
  const confidence = Math.max(0.6, 1 - nullsCount / Math.max(1, totalConsidered))

  return {
    intent_score,
    bucket,
    signals,
    exclude_from_routing: false,
    confidence,
    recommended_channel,
  }
}

/**
 * Thompson sampling Beta(alpha, beta) en TypeScript (Box-Muller approximation).
 *
 * Pour chaque candidat diag avec ses paramètres Beta(α, β), on tire un
 * échantillon X ~ Beta(α, β) et on classe par X décroissant. Le candidat
 * top reçoit le lead — exploration naturelle car la variance de Beta diminue
 * avec l'expérience accumulée (alpha + beta grand → distribution étroite).
 *
 * Implémenté ici en JS pour permettre des tests unitaires + un fallback côté
 * route-lead Edge Function si la RPC SQL n'est pas dispo. La RPC SQL reste la
 * voie privilégiée en prod (gen_random_uuid mieux semée côté PG).
 */
export function thompsonSampleBeta(alpha: number, beta: number): number {
  // Beta(a, b) = X / (X + Y) où X ~ Gamma(a, 1) et Y ~ Gamma(b, 1)
  // Pour α, β entiers ou demi-entiers petits, on approxime via Marsaglia-Tsang ou
  // Cheng. Ici, gamma simple via sum of exponentials (rapide, suffisant).
  function gamma(k: number): number {
    // Marsaglia-Tsang pour k >= 1
    if (k < 1) {
      return gamma(k + 1) * Math.random() ** (1 / k)
    }
    const d = k - 1 / 3
    const c = 1 / Math.sqrt(9 * d)
    // biome-ignore lint/correctness/noConstantCondition: rejection sampling intentional
    while (true) {
      let x = 0
      let v = 0
      do {
        // Box-Muller pour x ~ N(0, 1)
        const u1 = Math.random()
        const u2 = Math.random()
        x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
        v = 1 + c * x
      } while (v <= 0)
      v = v * v * v
      const u = Math.random()
      if (u < 1 - 0.0331 * x ** 4) return d * v
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
    }
  }

  const x = gamma(alpha)
  const y = gamma(beta)
  return x / (x + y)
}
