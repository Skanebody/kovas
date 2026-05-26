/**
 * Section "Réactivité & vérification" pour la fiche publique diagnostiqueur (B37 / GC3).
 *
 * Server Component pur (rendu côté serveur, props pré-calculées par
 * `page.tsx`). Pas de JS client — la section reste sobre, modèle Doctolib
 * SANS illusion de booking temps réel (objectif = honnêteté + signaux de
 * confiance + valeur SEO supplémentaire).
 *
 * Authority : avatar client SOBRE PROFESSIONNEL (vouvoiement, aucun emoji
 * gaming) + design system V5 (sage / navy / chartreuse uniquement sur CTA).
 */

import type { AvailabilitySignals } from '@/lib/diag-availability'
import { Clock, RefreshCw, ShieldCheck } from 'lucide-react'

interface AvailabilitySectionProps {
  signals: AvailabilitySignals
  /** Phrase optionnelle qui chapeaute la section (default: "04 — Réactivité & vérification") */
  sectionNumber?: string
}

export function AvailabilitySection({ signals, sectionNumber = '04' }: AvailabilitySectionProps) {
  if (signals.signalsCount === 0) return null

  // Pastille pour le signal de réactivité — sobre, pas de chartreuse même quand
  // "fast" (le chartreuse est réservé strictement aux CTA conversion sur la fiche).
  const responseDotColor =
    signals.responseBucket === 'fast'
      ? 'bg-emerald-500'
      : signals.responseBucket === 'standard'
        ? 'bg-amber-500'
        : signals.responseBucket === 'slow'
          ? 'bg-slate-400'
          : 'bg-slate-300'

  return (
    <div>
      <div className="flex items-baseline gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
        <span className="font-mono text-xs text-black/40 uppercase tracking-[0.12em]">
          {sectionNumber}
        </span>
        <div className="hidden sm:block h-px flex-1 bg-black/8" aria-hidden />
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#0B1D33] sm:shrink-0 sm:ml-4 w-full sm:w-auto">
          Réactivité & vérification
        </h2>
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {signals.responseSentence ? (
          <li className="rounded-2xl border border-black/8 bg-white p-5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-black/45" aria-hidden />
              <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-black/45">
                Réactivité
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2.5">
              <span
                aria-hidden
                className={`inline-block h-2 w-2 rounded-full ${responseDotColor}`}
              />
              <p className="text-sm font-medium text-[#0B1D33]">{signals.responseSentence}</p>
            </div>
            <p className="mt-2 text-xs text-black/50">
              Médiane mesurée sur les demandes de devis reçues via KOVAS.
            </p>
          </li>
        ) : null}

        {signals.verifiedSentence ? (
          <li className="rounded-2xl border border-black/8 bg-white p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-black/45" aria-hidden />
              <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-black/45">
                Vérification
              </p>
            </div>
            <p className="mt-3 text-sm font-medium text-[#0B1D33] leading-relaxed">
              {signals.verifiedSentence}
            </p>
            <p className="mt-2 text-xs text-black/50">
              Croisement COFRAC · SIRENE · INPI · ADEME effectué par KOVAS.
            </p>
          </li>
        ) : null}

        {signals.updatedSentence ? (
          <li className="rounded-2xl border border-black/8 bg-white p-5">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-black/45" aria-hidden />
              <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-black/45">
                Fraîcheur
              </p>
            </div>
            <p className="mt-3 text-sm font-medium text-[#0B1D33] leading-relaxed">
              {signals.updatedSentence}
            </p>
            <p className="mt-2 text-xs text-black/50">
              Données rafraîchies en continu depuis les sources officielles.
            </p>
          </li>
        ) : null}
      </ul>
    </div>
  )
}
