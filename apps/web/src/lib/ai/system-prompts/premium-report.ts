/**
 * System prompt — génération du contenu narratif du PDF Premium Client Report
 * (upsell #1 Tugan v3.0, 19 €/mo).
 *
 * Contexte : le PDF Premium Client Report est ENVOYÉ AU PROPRIÉTAIRE (client final
 * du diagnostiqueur), pas à l'ADEME. Il complète le PDF réglementaire Liciel par
 * un rapport "soigné" qui justifie le tarif du diagnostiqueur et le différencie
 * des concurrents qui n'envoient qu'un PDF Liciel brut.
 *
 * Authority : CLAUDE.md §3 (focus 8 diagnostics) + brief Upsell #1 Premium Reports
 * 2026-05-26. Voir aussi `docs/avatar-client.md` (ton SOBRE PROFESSIONNEL — mais
 * adressé ici au PROPRIÉTAIRE, donc VOUVOIEMENT obligatoire vs le tutoiement
 * réservé à l'avatar diagnostiqueur).
 *
 * AUCUNE mention de provider IA tiers dans ce fichier (directive transversale 2026-05).
 * Le prompt parle de "rédacteur expert" — la couche transport (Edge Function)
 * appelle l'API du fournisseur cloud sans exposer la marque.
 */

import type { MissionType } from '@kovas/shared'

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Types — données contextuelles injectées dans le prompt                      */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Données mission minimales nécessaires à la génération du contenu narratif.
 * Sous-ensemble de `Mission` + champs dérivés (adresse, client, surface, etc.)
 * que la fonction parent (Edge Function `generate-premium-client-report`)
 * charge depuis Supabase avant d'appeler le rédacteur cloud.
 *
 * Tous les champs sont optionnels pour permettre une dégradation propre si
 * la donnée n'est pas encore saisie (le prompt instruit le rédacteur de
 * sauter les sections vides plutôt que d'inventer).
 */
export interface PremiumReportContext {
  /** Type de diagnostic (DPE, amiante, etc.) — pilote la structure des sections. */
  readonly missionType?: MissionType
  /** Référence interne de la mission (MIS-2026-00042). */
  readonly missionReference?: string
  /** Nom complet du propriétaire (client final). */
  readonly ownerName?: string
  /** Adresse complète du bien (ligne 1 + code postal + ville). */
  readonly propertyAddress?: string
  /** Surface utile en m² (Carrez/Boutin si dispo). */
  readonly surfaceM2?: number
  /** Année de construction du bien (si connue). */
  readonly constructionYear?: number
  /** Lettre DPE si applicable (A → G). */
  readonly dpeLetter?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  /** Lettre GES si applicable (A → G). */
  readonly gesLetter?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  /** Score de conformité 0-100 (calculé côté KOVAS). */
  readonly conformityScore?: number
  /** Nombre de pièces saisies (utile pour dimensionner les sections). */
  readonly roomsCount?: number
  /** Nombre de photos disponibles (commentées par pièce). */
  readonly photosCount?: number
  /** Nom du diagnostiqueur (signature finale du rapport). */
  readonly diagnostiqueurName?: string
  /** Numéro de certification du diagnostiqueur (mention légale). */
  readonly diagnostiqueurCertNumber?: string
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helper principal — buildPremiumReportSystemPrompt                          */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Construit le system prompt structuré pour la génération du PDF Premium Client.
 *
 * Le prompt est conçu pour produire un retour JSON strict (consommé par le
 * composant `PremiumClientReport.tsx` côté Next.js) avec 4 sections :
 *   - `intro`           : 2-3 paragraphes contextuels (qui, quoi, pourquoi)
 *   - `par_piece[]`     : 1 entrée par pièce (titre + paragraphe + alertes)
 *   - `recommandations[]`: 3-7 recommandations priorisées (P1 / P2 / P3)
 *   - `conclusion`      : signature diagnostiqueur + invitation à reprendre contact
 *
 * Contraintes injectées :
 *   - VOUVOIEMENT obligatoire (le destinataire est le propriétaire)
 *   - Style sobre pédagogique, pas de jargon ADEME brut
 *   - Recommandations CHIFFRÉES (euros, kWh économisés, payback en années)
 *   - Mention MaPrimeRénov' si DPE F ou G
 *   - Ne PAS inventer de chiffres : si la donnée manque, écrire "à confirmer
 *     avec le diagnostiqueur" plutôt qu'une estimation hallucinée
 *
 * @param context - Données contextuelles de la mission (peut être quasi vide).
 * @returns String UTF-8 du system prompt complet (~2200 tokens). À passer
 *   tel quel dans le champ `system` de l'appel API du fournisseur cloud
 *   par l'Edge Function `generate-premium-client-report`.
 */
export function buildPremiumReportSystemPrompt(context: PremiumReportContext = {}): string {
  const {
    missionType,
    missionReference,
    ownerName,
    propertyAddress,
    surfaceM2,
    constructionYear,
    dpeLetter,
    gesLetter,
    conformityScore,
    roomsCount,
    photosCount,
    diagnostiqueurName,
    diagnostiqueurCertNumber,
  } = context

  const missionLabel = missionType ? MISSION_TYPE_LABEL[missionType] : undefined

  // Bloc de données contextuelles (vide si rien fourni).
  const contextLines: string[] = []
  if (missionLabel) contextLines.push(`- Type de diagnostic : ${missionLabel}`)
  if (missionReference) contextLines.push(`- Référence mission : ${missionReference}`)
  if (ownerName) contextLines.push(`- Propriétaire : ${ownerName}`)
  if (propertyAddress) contextLines.push(`- Adresse du bien : ${propertyAddress}`)
  if (typeof surfaceM2 === 'number') contextLines.push(`- Surface utile : ${surfaceM2} m²`)
  if (typeof constructionYear === 'number') {
    contextLines.push(`- Année de construction : ${constructionYear}`)
  }
  if (dpeLetter) contextLines.push(`- Étiquette DPE : ${dpeLetter}`)
  if (gesLetter) contextLines.push(`- Étiquette GES : ${gesLetter}`)
  if (typeof conformityScore === 'number') {
    contextLines.push(`- Score de conformité KOVAS : ${conformityScore} / 100`)
  }
  if (typeof roomsCount === 'number')
    contextLines.push(`- Nombre de pièces saisies : ${roomsCount}`)
  if (typeof photosCount === 'number') {
    contextLines.push(`- Nombre de photos disponibles : ${photosCount}`)
  }
  if (diagnostiqueurName) contextLines.push(`- Diagnostiqueur : ${diagnostiqueurName}`)
  if (diagnostiqueurCertNumber) {
    contextLines.push(`- Certification diagnostiqueur : ${diagnostiqueurCertNumber}`)
  }

  const contextBlock =
    contextLines.length > 0
      ? `Données contextuelles de la mission :\n${contextLines.join('\n')}`
      : 'Aucune donnée contextuelle fournie — produire un squelette générique ' +
        'avec mentions "à confirmer avec le diagnostiqueur" sur tous les chiffres.'

  // Bloc mention MaPrimeRénov' conditionnel (uniquement si DPE F ou G).
  const mprBlock =
    dpeLetter === 'F' || dpeLetter === 'G'
      ? `IMPORTANT : le bien est classé DPE ${dpeLetter} (passoire énergétique). Vous devez MENTIONNER explicitement MaPrimeRénov' dans les recommandations de priorité 1, en indiquant que des aides publiques peuvent couvrir 35 à 90 % du coût des travaux selon les revenus du foyer. Inviter le propriétaire à faire réaliser un audit énergétique pour calculer le parcours travaux optimal et débloquer le forfait Rénovation d'ampleur.`
      : "Si vous mentionnez des aides publiques (MaPrimeRénov', éco-PTZ, CEE), restez " +
        "factuel et invitez le propriétaire à se rapprocher d'un opérateur agréé pour " +
        'vérifier son éligibilité (revenus, propriétaire occupant vs bailleur, etc.).'

  return `Vous êtes un assistant rédacteur expert en diagnostics immobiliers français.
Vous rédigez un rapport PDF haut de gamme destiné au PROPRIÉTAIRE (client final du
diagnostiqueur), pas à l'ADEME ni à un organisme certificateur. Votre objectif est de
TRADUIRE les données techniques brutes du diagnostic en un récit clair, pédagogique et
actionnable pour quelqu'un qui n'est PAS expert du bâtiment.

RÔLE ET TON
- Rôle : rédacteur du PDF "premium" complémentaire du PDF réglementaire Liciel.
- Audience : le propriétaire du bien, profil non-expert, qui veut comprendre l'état
  de son logement et savoir quoi faire ensuite.
- Ton : sobre, professionnel, pédagogique. Pas de marketing. Pas d'emojis. Pas de
  phrases vendeuses ("incroyable", "génial", "exceptionnel" sont INTERDITS).
- Adresse : VOUVOIEMENT obligatoire ("vous", "votre logement", "vos travaux").
  Le tutoiement est INTERDIT dans ce rapport.

CONTRAINTES RÉDACTIONNELLES STRICTES
- Pas de jargon technique brut (kWh/m²/an, U-value, R thermique) sans
  reformulation immédiate dans le paragraphe qui suit.
- Recommandations CHIFFRÉES obligatoires : coût estimé en euros TTC, économies
  annuelles en euros, payback en années. Si une donnée manque, écrivez
  "à confirmer avec votre diagnostiqueur" — n'inventez JAMAIS un chiffre.
- Aucune mention de marque logicielle ou d'outil tiers de quelque nature
  que ce soit. Le rapport doit paraître produit par le diagnostiqueur
  lui-même, sans citer aucune plateforme intermédiaire.
- Aucune promesse de résultat juridique. Le PDF Liciel reste la seule pièce
  réglementaire opposable.

STRUCTURE DE SORTIE — JSON STRICT
Vous DEVEZ retourner un objet JSON unique, sans markdown autour, conforme au
schéma suivant :

{
  "intro": "string (2 à 3 paragraphes, ~250 mots)",
  "par_piece": [
    {
      "nom_piece": "string (ex: 'Séjour', 'Cuisine', 'Chambre 1')",
      "paragraphe": "string (~120 mots, état des lieux + points d'attention)",
      "alertes": ["string", ...] // 0 à 3 alertes courtes (humidité, isolation, etc.)
    }
  ],
  "recommandations": [
    {
      "priorite": 1 | 2 | 3,
      "titre": "string (verbe à l'infinitif, ex: 'Isoler les combles perdus')",
      "description": "string (~80 mots, technique + bénéfice)",
      "cout_estime_eur": number | null,
      "economies_annuelles_eur": number | null,
      "payback_annees": number | null,
      "aides_publiques": "string | null (ex: 'MaPrimeRénov' Sérénité jusqu'à 50%')"
    }
  ],
  "conclusion": "string (2 paragraphes, ~150 mots, signature diagnostiqueur + invitation à reprendre contact)"
}

RÈGLES PAR SECTION
- intro : présenter le bien (adresse, surface, année), rappeler l'objet du
  diagnostic, et synthétiser en une phrase l'état général ("votre logement
  présente un état général satisfaisant" / "votre logement nécessite plusieurs
  interventions prioritaires" — adapté aux données).
- par_piece : 1 entrée par pièce saisie (limité à ${roomsCount ?? 'N'} pièces).
  Si une pièce n'a pas de mesures, indiquer "Aucune anomalie significative
  relevée lors de la visite" plutôt qu'inventer.
- recommandations : 3 à 7 recommandations, classées par priorité 1 (urgent /
  sécurité), 2 (confort / valeur patrimoniale), 3 (optimisation long terme).
  Priorité 1 d'abord. ${mprBlock}
- conclusion : signer du diagnostiqueur (${diagnostiqueurName ?? '[Nom diagnostiqueur]'}),
  inviter le propriétaire à le recontacter pour toute question. Mentionner le
  numéro de certification (${diagnostiqueurCertNumber ?? '[N° certification]'}).

${contextBlock}

Produisez maintenant le JSON de sortie.`
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Mapping MissionType → libellé français lisible                              */
/* ─────────────────────────────────────────────────────────────────────────── */

const MISSION_TYPE_LABEL: Record<MissionType, string> = {
  dpe_vente: 'Diagnostic de Performance Énergétique (vente)',
  dpe_location: 'Diagnostic de Performance Énergétique (location)',
  amiante_vente: 'État Amiante (vente)',
  amiante_avant_travaux: 'Repérage Amiante avant travaux',
  plomb_crep: "Constat de Risque d'Exposition au Plomb (CREP)",
  gaz: 'État des installations de gaz',
  electricite: 'État des installations électriques',
  termites: 'État Termites',
  carrez_boutin: 'Mesurage Loi Carrez / Boutin',
  erp: 'État des Risques et Pollutions (ERP)',
  copropriete: 'Diagnostic Copropriété',
}
