/**
 * Cancellation — Step 1 : "Êtes-vous sûr ?"
 *
 * Server component. Affiche les modules actifs perdus, période de grâce post-résiliation
 * (90 jours en lecture + export, source de vérité RGPD KOVAS), et propose deux actions :
 *  - "Garder mon abonnement"  → /app/account
 *  - "Continuer"               → /app/account/cancellation?step=2
 *
 * Conforme décret n°2023-417 : parcours dédié, accessible sans appel téléphonique
 * ni courrier postal.
 */

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

export interface ActiveModule {
  id: string
  label: string
  description: string | null
}

interface Step1Props {
  modules: ActiveModule[]
  /** Nom de la formule courante (label lisible) */
  planLabel: string
  /** Date effective de fin (string ISO) */
  effectiveEndDate: string | null
}

function formatFr(date: string | null): string {
  if (!date) return 'fin de la période en cours'
  try {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return 'fin de la période en cours'
  }
}

export function CancellationStep1({ modules, planLabel, effectiveEndDate }: Step1Props) {
  return (
    <Card variant="opaque" padding="lg" className="space-y-6">
      <CardHeader className="space-y-2 p-0">
        <CardTitle className="text-2xl font-bold tracking-tight">
          Êtes-vous sûr de vouloir résilier votre abonnement{' '}
          <span className="font-serif italic font-normal">{planLabel}</span> ?
        </CardTitle>
        <p className="text-sm text-ink-mute">
          Votre abonnement restera actif jusqu&apos;au{' '}
          <strong className="text-ink">{formatFr(effectiveEndDate)}</strong>. Aucun nouveau
          prélèvement ne sera effectué après cette date.
        </p>
      </CardHeader>

      <CardContent className="space-y-5 p-0">
        {modules.length > 0 && (
          <section className="rounded-lg border border-accent-orange/30 bg-accent-orange/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-accent-orange shrink-0" />
              <h3 className="text-sm font-semibold text-accent-orange">
                Modules actifs qui seront perdus
              </h3>
            </div>
            <ul className="space-y-1.5 text-xs text-ink-soft">
              {modules.map((m) => (
                <li key={m.id} className="flex items-start gap-2">
                  <span className="text-accent-orange mt-0.5">•</span>
                  <span>
                    <strong className="text-ink">{m.label}</strong>
                    {m.description ? ` — ${m.description}` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-mute pt-1">
              Vos statistiques business cumulées et automatisations en cours seront désactivées.
            </p>
          </section>
        )}

        <section className="rounded-lg border border-rule bg-paper p-4 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-accent-green shrink-0" />
            <h3 className="text-sm font-semibold">Vos données restent accessibles</h3>
          </div>
          <p className="text-xs text-ink-mute leading-relaxed">
            Votre compte basculera en mode lecture et export complet pendant{' '}
            <strong className="text-ink">90 jours</strong> après expiration de l&apos;abonnement.
            Vous pourrez exporter tous vos dossiers (PDF, Word, CSV, JSON, ZIP Liciel) à votre
            rythme. Au-delà, suppression définitive automatique des données opérationnelles ; vos
            factures restent conservées 10 ans (obligation légale).
          </p>
        </section>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button asChild variant="default" size="lg" className="flex-1">
            <Link href="/app/account">Garder mon abonnement</Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="flex-1 text-ink-mute">
            <Link href="/app/account/cancellation?step=2">
              Continuer la résiliation <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
