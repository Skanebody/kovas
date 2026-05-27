import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowRight, Lock, Sparkles } from 'lucide-react'
import Link from 'next/link'

interface UpsellCardProps {
  /** Numéro de section (style mockup "03"). */
  sectionNumber: string
  /** Titre de section (style mockup uppercase tracking large). */
  sectionTitle: string
  /** Description courte du module — 1-2 phrases factuelles, pas marketing. */
  description: string
  /** Nom du module (ex: "Cockpit ADEME", "Veille IA"). */
  moduleName: string
  /** Plan ou add-on requis (affiché en pillule). */
  requiredPlanOrAddon: string
  /** Prix mensuel HT du module ou plan (ex: "9 € HT/mois"). */
  priceLabel: string
  /** Lien vers la page d'activation/upgrade. */
  activateHref: string
  /** Label du bouton CTA (ex: "Activer un essai 14 jours"). */
  ctaLabel: string
  /** Hauteur min uniforme avec les vrais panels (pour layouts split). */
  minH?: string
}

/**
 * Carte d'upsell sobre pour les modules non inclus dans le plan utilisateur.
 *
 * Principe : pas de pub agressive. On montre factuellement le nom du module
 * + 1-2 phrases utiles + 1 bouton "Activer un essai 14 jours". Le diagnostiqueur
 * méfiant doit pouvoir l'ignorer si pas pertinent — pas de pop-up, pas de glow,
 * pas d'animation festive.
 *
 * Layout : style "panel" data-dense du mockup, avec header numéroté.
 *
 * Usage :
 *   <UpsellCard
 *     sectionNumber="03"
 *     sectionTitle="Cockpit ADEME"
 *     moduleName="Cockpit ADEME monitoring rétroactif"
 *     description="Surveillance automatique de tes DPE publiés sur l'API ADEME..."
 *     requiredPlanOrAddon="Découverte ou +"
 *     priceLabel="à partir de 19 € HT/mois"
 *     activateHref="/dashboard/account?module=cockpit_ademe_mode1"
 *     ctaLabel="Activer un essai 14 jours"
 *   />
 */
export function UpsellCard({
  sectionNumber,
  sectionTitle,
  description,
  moduleName,
  requiredPlanOrAddon,
  priceLabel,
  activateHref,
  ctaLabel,
  minH,
}: UpsellCardProps) {
  return (
    <Card
      variant="opaque"
      padding="none"
      className="flex flex-col"
      style={minH ? { minHeight: minH } : undefined}
    >
      {/* Header style mockup : "03 · COCKPIT ADEME" + meta */}
      <div className="flex items-center justify-between gap-3 border-b border-rule/60 px-5 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-ink">
          <span className="text-ink-mute">{sectionNumber} ·</span> {sectionTitle}
        </p>
        <span className="font-mono text-[10px] text-ink-mute tracking-[0.08em] uppercase inline-flex items-center gap-1">
          <Lock className="size-3" aria-hidden /> Non inclus
        </span>
      </div>

      {/* Body : description + bouton CTA */}
      <div className="flex-1 flex flex-col justify-between p-5 gap-5">
        <div className="space-y-3">
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden
              className="size-9 rounded-md bg-chartreuse/15 flex items-center justify-center shrink-0"
            >
              <Sparkles className="size-4 text-[#0F1419]" />
            </span>
            <div className="space-y-1">
              <p className="font-serif italic text-xl text-ink leading-tight">{moduleName}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
                {requiredPlanOrAddon} · {priceLabel}
              </p>
            </div>
          </div>

          <p className="text-[13px] text-ink-mute leading-relaxed">{description}</p>
        </div>

        <Button asChild variant="default" size="sm" className="w-full sm:w-auto self-start">
          <Link href={activateHref}>
            {ctaLabel} <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </Card>
  )
}
