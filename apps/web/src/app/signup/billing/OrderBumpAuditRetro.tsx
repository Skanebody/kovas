'use client'

/**
 * OrderBumpAuditRetro — order bump Étape 5 du tunnel Tugan v3.0.
 *
 * Checkbox prominent (état local) pour l'add-on "Audit Rétrospectif IA"
 * facturé +99 € one-time. Pilote la query-param `audit_retro=true|false`
 * du CTA principal "Démarrer mon essai 30 jours".
 *
 * Spec : docs Tugan §11 (order bump high-converting B2B SaaS).
 *
 * Position UI : entre le récap plan et la zone Stripe Checkout.
 * On vise +18-25% AOV via simple checkbox sans friction supplémentaire
 * (la CB est déjà collectée pour le trial, on encaisse les 99 € le même
 * coup au moment du Setup Intent — futur câblage TUGAN-5).
 */

import { Button } from '@/components/ui/button'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

interface OrderBumpAuditRetroProps {
  /** Code plan recommandé (transmis au CTA pour /signup?plan=X&audit_retro=Y). */
  planCode: string
  /** Label du plan (ex. "Pro") affiché dans le CTA. */
  planName: string
}

/** Valeur propositions de l'audit rétrospectif (cf. docs Tugan §11). */
const AUDIT_RETRO_BULLETS: ReadonlyArray<string> = [
  'On importe TOUTES tes missions historiques (ZIP, MDB, PDF) — aucun copier-coller',
  'Détection automatique des leads MaPrimeRénov ' +
    'rétroactif sur ta base client (pool de relance pré-qualifié, ROI 90 jours)',
  'Knowledge graph pré-construit de ton activité — pré-remplissage intelligent dès la 1ère mission KOVAS',
  'Rapport audit risques ADEME sur 10 ans (defense panel en cas de contrôle ou contentieux)',
  'Profil linguistique personnalisé — 35 min gagnées dès la 1ère mission (vs 6 mois d’auto-apprentissage)',
]

export function OrderBumpAuditRetro({
  planCode,
  planName,
}: OrderBumpAuditRetroProps): React.ReactElement {
  const [checked, setChecked] = useState<boolean>(false)

  const ctaHref = `/signup?plan=${encodeURIComponent(planCode)}&audit_retro=${checked ? 'true' : 'false'}`

  return (
    <div className="space-y-6">
      {/* Order bump card */}
      <button
        type="button"
        onClick={() => setChecked((v) => !v)}
        aria-pressed={checked}
        aria-label={
          checked
            ? 'Retirer l’audit rétrospectif IA de ma commande'
            : 'Ajouter l’audit rétrospectif IA à ma commande pour 99 €'
        }
        className={[
          'w-full text-left rounded-2xl border-2 transition-all duration-200 p-6 sm:p-7 cursor-pointer',
          checked
            ? 'border-chartreuse-deep bg-chartreuse/20 shadow-glass'
            : 'border-dashed border-[#0F1419]/25 bg-paper hover:border-[#0F1419]/60 hover:bg-[#0F1419]/[0.02]',
        ].join(' ')}
      >
        <div className="flex items-start gap-4">
          {/* Checkbox visuelle */}
          <div
            className={[
              'mt-0.5 size-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-all',
              checked ? 'bg-[#0F1419] border-[#0F1419]' : 'bg-paper border-[#0F1419]/40',
            ].join(' ')}
            aria-hidden
          >
            {checked && <CheckCircle2 className="size-5 text-chartreuse" aria-hidden />}
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            {/* Eyebrow */}
            <p className="font-mono uppercase tracking-[0.18em] text-[10px] sm:text-[11px] font-semibold text-[#0F1419]/72">
              Order bump · Audit rétrospectif IA
            </p>

            {/* Question d'accroche */}
            <h2
              className="font-sans font-semibold tracking-tight text-[#0F1419] leading-tight"
              style={{ fontSize: 'clamp(20px, 2.4vw, 26px)' }}
            >
              Tu veux qu’on importe <span className="font-serif italic font-normal">toutes</span>{' '}
              tes missions historiques et qu’on les analyse&nbsp;?
            </h2>

            {/* Bullets value props */}
            <ul className="space-y-2.5">
              {AUDIT_RETRO_BULLETS.map((b) => (
                <li key={b} className="flex items-start gap-3 text-[13.5px] text-[#0F1419]/82">
                  <CheckCircle2
                    className="size-4 text-chartreuse-deep shrink-0 mt-0.5"
                    aria-hidden
                  />
                  <span className="leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>

            {/* Pricing + ROI */}
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4 pt-3 border-t border-[#0F1419]/10">
              <div className="flex items-baseline gap-1.5">
                <span
                  className="font-serif italic font-normal text-[#0F1419] leading-none"
                  style={{ fontSize: 'clamp(28px, 3.5vw, 40px)' }}
                >
                  + 99 €
                </span>
                <span className="text-[12px] text-[#0F1419]/55 font-mono">une fois</span>
              </div>
              <p className="text-[12px] text-[#0F1419]/72 sm:ml-auto leading-relaxed">
                ROI moyen mesuré&nbsp;: <strong className="text-[#0F1419]">3 200 €</strong> de
                revenue potentiel généré dans les 90 jours.
              </p>
            </div>

            {/* État textuel */}
            <p
              className={[
                'font-mono uppercase tracking-wider text-[10px] sm:text-[11px] font-semibold pt-1',
                checked ? 'text-chartreuse-deep' : 'text-[#0F1419]/55',
              ].join(' ')}
              aria-live="polite"
            >
              {checked
                ? '✓ Ajouté à ta commande (+99 € au prélèvement initial)'
                : 'Clique pour ajouter — décochage libre avant validation'}
            </p>
          </div>
        </div>
      </button>

      {/* CTA principal — pilote audit_retro via query param */}
      <div className="space-y-3">
        <Button asChild variant="accent" size="lg" className="w-full justify-center">
          <Link href={ctaHref}>
            Démarrer mon essai 30 jours · Plan {planName}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
        <p className="text-center text-[11px] font-mono text-[#0F1419]/40">
          Aujourd’hui tu paies&nbsp;: <strong className="text-[#0F1419]/72">0 €</strong>
          {checked && (
            <>
              {' '}
              <span className="text-[#0F1419]/30">·</span> Audit rétrospectif facturé{' '}
              <strong className="text-[#0F1419]/72">99 €</strong> à la souscription
            </>
          )}
        </p>
      </div>
    </div>
  )
}
