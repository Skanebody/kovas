import { Card } from '@/components/ui/card'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { ChevronRight, MapPin, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

/**
 * Page d'entrée publique `/reclamer-ma-fiche` (FIX, 2026-05-27).
 *
 * Avant : 404 quand un diagnostiqueur arrivait via un email marketing
 * (ex. séquence RGPD #55) sans le `[id]` UUID en query. Le flux exigeait
 * un lien profond ou que l'utilisateur trouve d'abord sa fiche dans
 * l'annuaire — friction inacceptable.
 *
 * Maintenant : page de recherche entry point :
 *   1. Champ SIRET (14 chiffres) — match exact contre `diagnosticians.sirene_siret` ;
 *      si match unique → redirect direct vers `/reclamer-ma-fiche/[id]`.
 *   2. Sinon (multiple matchs ou no-match), champ nom + ville → liste de
 *      candidats cliquables.
 *
 * Server component pur + Server Action — pas de JS client, parse vocabulaire
 * naturel.
 *
 * Avatar SOBRE PROFESSIONNEL : tutoiement, factuel, pas d'emojis.
 */

export const metadata: Metadata = {
  title: 'Réclamer ma fiche diagnostiqueur — KOVAS',
  description:
    "Tu es diagnostiqueur immobilier ? Trouve et reprends le contrôle de ta fiche publique sur KOVAS Annuaire en 3 étapes vérifiées (SIRET, téléphone pro, pièce d'identité).",
  robots: { index: false, follow: false },
}

interface DiagSearchRow {
  id: string
  full_name: string | null
  company_name: string | null
  city: string | null
  postcode: string | null
  department_code: string | null
  sirene_siret: string | null
  claim_status: string | null
}

type SearchParams = Promise<{ siret?: string; q?: string; ville?: string }>

const SIRET_REGEX = /^\d{14}$/

/**
 * Server Component principal — lit les query params et déclenche la recherche.
 * Si SIRET valide (14 chiffres) + match unique → redirect côté serveur.
 */
export default async function ReclamerMaFicheIndexPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { siret, q, ville } = await searchParams

  // 1) Recherche par SIRET (14 chiffres exact) — match unique = redirect
  let matchedDiags: DiagSearchRow[] = []
  let searchPerformed = false
  let searchError: string | null = null

  const siretClean = (siret ?? '').replace(/\D/g, '').trim()
  const qTrim = (q ?? '').trim()
  const villeTrim = (ville ?? '').trim()

  if (siretClean && SIRET_REGEX.test(siretClean)) {
    searchPerformed = true
    matchedDiags = await searchBySiret(siretClean)
    if (matchedDiags.length === 1 && matchedDiags[0]) {
      redirect(`/reclamer-ma-fiche/${matchedDiags[0].id}`)
    }
    if (matchedDiags.length === 0) {
      searchError = `Aucune fiche trouvée pour le SIRET ${formatSiret(siretClean)}. Vérifie les 14 chiffres ou recherche par nom + ville.`
    }
  } else if (siretClean && !SIRET_REGEX.test(siretClean)) {
    searchError = 'Un SIRET valide comporte 14 chiffres exactement (sans espaces).'
    searchPerformed = true
  } else if (qTrim.length >= 2 || villeTrim.length >= 2) {
    searchPerformed = true
    matchedDiags = await searchByNameAndCity(qTrim, villeTrim)
    if (matchedDiags.length === 0) {
      searchError = 'Aucune fiche ne correspond à ces critères. Affine ton nom ou ta ville.'
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-5 sm:px-6 py-12 sm:py-16">
      {/* Hero */}
      <header className="space-y-3 mb-10">
        <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
          Annuaire diagnostiqueurs
        </p>
        <h1
          className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
          style={{ fontSize: 'clamp(32px, 4vw, 52px)' }}
        >
          Reprends le contrôle de{' '}
          <span className="font-serif italic font-normal">ta fiche publique</span>.
        </h1>
        <p className="text-[16px] sm:text-[17px] text-[#0F1419]/72 leading-relaxed max-w-2xl">
          KOVAS Annuaire est alimenté par la base officielle DHUP. Si une fiche existe à ton nom, tu
          peux la réclamer en quelques minutes pour la mettre à jour, recevoir les demandes de devis
          et y associer ton SaaS KOVAS.
        </p>
      </header>

      {/* Form recherche */}
      <Card variant="flat" padding="default" className="space-y-6">
        <form className="space-y-5" method="GET" action="/reclamer-ma-fiche">
          {/* Champ SIRET */}
          <div className="space-y-2">
            <label
              htmlFor="siret-input"
              className="block font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/72 font-semibold"
            >
              Méthode rapide · SIRET
            </label>
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <input
                id="siret-input"
                name="siret"
                type="text"
                inputMode="numeric"
                placeholder="14 chiffres (ex. 81234567890123)"
                defaultValue={siretClean}
                pattern="\d{14}"
                className="flex-1 min-w-[200px] rounded-lg border border-[#0F1419]/[0.12] bg-paper px-4 py-2.5 text-[15px] tabular-nums focus:outline-none focus:ring-2 focus:ring-chartreuse/60 focus:border-[#0F1419]/40"
              />
              <button
                type="submit"
                className="rounded-pill bg-[#0F1419] text-[#FDFBF6] px-6 py-2.5 font-semibold text-[14px] hover:bg-[#0F1419]/90 transition-colors"
              >
                Trouver ma fiche
              </button>
            </div>
            <p className="text-[12px] text-[#0F1419]/60">
              Si ton SIRET correspond à une fiche, tu es redirigé directement vers le flux de
              vérification.
            </p>
          </div>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#0F1419]/[0.08]" />
            </div>
            <div className="relative flex justify-center text-[11px] font-mono uppercase tracking-wider">
              <span className="bg-paper px-3 text-[#0F1419]/55">ou</span>
            </div>
          </div>

          {/* Recherche par nom + ville */}
          <div className="space-y-2">
            <label className="block font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/72 font-semibold">
              Recherche manuelle · nom + ville
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr,1fr,auto] gap-2">
              <input
                name="q"
                type="text"
                placeholder="Ton nom ou raison sociale"
                defaultValue={qTrim}
                minLength={2}
                className="rounded-lg border border-[#0F1419]/[0.12] bg-paper px-4 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-chartreuse/60 focus:border-[#0F1419]/40"
              />
              <input
                name="ville"
                type="text"
                placeholder="Ville d'exercice"
                defaultValue={villeTrim}
                minLength={2}
                className="rounded-lg border border-[#0F1419]/[0.12] bg-paper px-4 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-chartreuse/60 focus:border-[#0F1419]/40"
              />
              <button
                type="submit"
                className="rounded-pill border border-[#0F1419]/15 bg-paper px-5 py-2.5 font-semibold text-[14px] text-[#0F1419] hover:bg-[#0F1419]/[0.04] transition-colors whitespace-nowrap"
              >
                Rechercher
              </button>
            </div>
          </div>
        </form>
      </Card>

      {/* Erreur / résultats */}
      {searchPerformed && searchError ? (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {searchError}
        </div>
      ) : null}

      {matchedDiags.length > 0 ? (
        <section className="mt-8 space-y-3" aria-label="Résultats">
          <h2 className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            {matchedDiags.length} fiche{matchedDiags.length > 1 ? 's' : ''} trouvée
            {matchedDiags.length > 1 ? 's' : ''}
          </h2>
          <ul className="space-y-2">
            {matchedDiags.map((diag) => {
              const displayName =
                (diag.company_name ?? '').trim() ||
                (diag.full_name ?? '').trim() ||
                'Diagnostiqueur'
              const cityLabel = [diag.city, diag.postcode].filter(Boolean).join(' · ')
              const isClaimed = diag.claim_status === 'verified' || diag.claim_status === 'approved'
              return (
                <li key={diag.id}>
                  <Link
                    href={`/reclamer-ma-fiche/${diag.id}`}
                    className="group flex items-center gap-4 rounded-xl border border-[#0F1419]/[0.08] bg-paper px-4 py-3 hover:border-[#0F1419]/25 hover:bg-[#0F1419]/[0.02] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-sans font-semibold text-[15px] text-[#0F1419] capitalize truncate">
                        {displayName}
                      </p>
                      <div className="flex items-center gap-1.5 text-[12px] text-[#0F1419]/60 mt-0.5">
                        <MapPin className="size-3" aria-hidden />
                        <span className="capitalize">
                          {cityLabel || 'Localisation non renseignée'}
                        </span>
                      </div>
                    </div>
                    {isClaimed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#0F1419]/5 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[#0F1419]/55">
                        <ShieldCheck className="size-3" aria-hidden />
                        Déjà réclamée
                      </span>
                    ) : (
                      <ChevronRight
                        className="size-4 text-[#0F1419]/40 group-hover:text-[#0F1419] transition-colors"
                        aria-hidden
                      />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {/* Pourquoi réclamer */}
      <section className="mt-12 space-y-4">
        <h2 className="font-sans font-semibold text-[#0F1419] text-[22px] tracking-tight">
          Pourquoi réclamer ta fiche ?
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FeatureItem
            title="Mets tes infos à jour"
            text="Téléphone, email, photo, certifications, zone d'intervention, slogan — tu deviens maître de ta vitrine."
          />
          <FeatureItem
            title="Reçois des demandes qualifiées"
            text="Les particuliers qui cherchent un diagnostic dans ta zone arrivent directement sur ta fiche. Tu reçois leurs demandes par email."
          />
          <FeatureItem
            title="Synchronise avec KOVAS"
            text="Une fois claimée, ta fiche se synchronise avec ton compte logiciel KOVAS (rapports, devis, factures, planning)."
          />
        </ul>
      </section>

      {/* Comment ça marche */}
      <section className="mt-10 rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-6 sm:px-8 sm:py-7">
        <h2 className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/72 font-semibold mb-4">
          Vérification en 3 étapes — pattern Doctolib
        </h2>
        <ol className="space-y-3 text-[14px] text-[#0F1419]/82 leading-relaxed">
          <li className="flex gap-3">
            <span className="font-serif italic text-[#0F1419] text-[20px] leading-none mt-0.5 shrink-0">
              01
            </span>
            <span>
              <strong className="font-semibold text-[#0F1419]">SIRET</strong> — vérification
              automatique contre l'INSEE.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-serif italic text-[#0F1419] text-[20px] leading-none mt-0.5 shrink-0">
              02
            </span>
            <span>
              <strong className="font-semibold text-[#0F1419]">Téléphone professionnel</strong> — un
              code SMS est envoyé au numéro déclaré.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-serif italic text-[#0F1419] text-[20px] leading-none mt-0.5 shrink-0">
              03
            </span>
            <span>
              <strong className="font-semibold text-[#0F1419]">Pièce d'identité</strong> — photo de
              ta CNI ou passeport, vérifiée par notre équipe sous 24 à 48 h.
            </span>
          </li>
        </ol>
        <p className="mt-5 text-[12px] text-[#0F1419]/55">
          Aucune donnée n'est partagée. Ta CNI est stockée chiffrée et supprimée 90 jours après
          validation (RGPD). Tu peux annuler à toute étape.
        </p>
      </section>
    </div>
  )
}

function FeatureItem({ title, text }: { title: string; text: string }) {
  return (
    <li className="rounded-xl border border-[#0F1419]/[0.08] bg-paper px-4 py-4">
      <p className="font-sans font-semibold text-[14px] text-[#0F1419] mb-1.5">{title}</p>
      <p className="text-[12.5px] text-[#0F1419]/72 leading-relaxed">{text}</p>
    </li>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Recherche en base — admin client (table publique, RLS read-public déjà OK)
// ────────────────────────────────────────────────────────────────────────────

function getAdminClient() {
  return createAdminClient(
    // biome-ignore lint/style/noNonNullAssertion: env validés au boot Next.js
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: env validés au boot Next.js
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function searchBySiret(siret: string): Promise<DiagSearchRow[]> {
  const supabase = getAdminClient()
  // biome-ignore lint/suspicious/noExplicitAny: types DB pas régénérés côté FIX
  const { data, error } = await (supabase as any)
    .from('diagnosticians')
    .select(
      'id, full_name, company_name, city, postcode, department_code, sirene_siret, claim_status',
    )
    .eq('sirene_siret', siret)
    .eq('withdrawal_requested', false)
    .limit(5)
  if (error || !data) return []
  return data as DiagSearchRow[]
}

async function searchByNameAndCity(name: string, city: string): Promise<DiagSearchRow[]> {
  const supabase = getAdminClient()
  // biome-ignore lint/suspicious/noExplicitAny: types DB pas régénérés côté FIX
  let query = (supabase as any)
    .from('diagnosticians')
    .select(
      'id, full_name, company_name, city, postcode, department_code, sirene_siret, claim_status',
    )
    .eq('withdrawal_requested', false)
    .limit(20)

  if (name.length >= 2) {
    const safe = name.replace(/[%_]/g, '').slice(0, 50)
    query = query.or(`full_name.ilike.%${safe}%,company_name.ilike.%${safe}%`)
  }
  if (city.length >= 2) {
    const safe = city.replace(/[%_]/g, '').slice(0, 50)
    query = query.ilike('city', `%${safe}%`)
  }

  const { data, error } = await query
  if (error || !data) return []
  return data as DiagSearchRow[]
}

function formatSiret(s: string): string {
  return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, '$1 $2 $3 $4')
}
