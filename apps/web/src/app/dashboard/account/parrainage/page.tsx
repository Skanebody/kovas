import { AppPageHeader } from '@/components/app-page-header'
import { ReferralLinkHero } from '@/components/referral/ReferralLinkHero'
import { ReferralsTable } from '@/components/referral/ReferralsTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ensureReferralCode } from '@/lib/referral/code-generator'
import { formatCredits, getUserCredits } from '@/lib/referral/credits-manager'
import {
  REFERRAL_MAX_REWARDED_PER_YEAR,
  REFERRAL_REWARD_EUR_CENTS,
  getReferralStats,
  listMyReferrals,
} from '@/lib/referral/referral-engine'
import { ArrowLeft, Gift, Link2, Share2, Users } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Programme parrainage' }

/**
 * Page parrainage — FIX-EE.
 *
 * Refonte 2026-05-23 :
 *   - Liens affiliés trackés https://kovas.fr/r/KOV-XXXXX (au lieu d'un simple code)
 *   - Hero copy/share multi-canaux (Email · WhatsApp · LinkedIn · SMS · QR)
 *   - Dashboard live 4 KPI (inscrits / payants / crédits / quota annuel)
 *   - Tableau filleuls avec filtres + tri client
 *   - FAQ 4 questions
 *
 * Cause root du bug "ne fonctionne pas" : la migration 20260522220000 enable RLS
 * sur referral_codes avec UNIQUEMENT une policy SELECT (owner). Pas de policy
 * INSERT → l'INSERT initial de code échouait silencieusement et la page crashait.
 * Fix appliqué par la migration 20260524210000_referral_clicks_tracking.sql qui
 * ajoute la policy "referral_codes: owner insert" + INSERT WITH CHECK.
 */
export default async function ParrainagePage() {
  const { supabase, user, profile } = await getCurrentUser()

  // Garantit un code de parrainage à l'arrivée sur la page (idempotent).
  // Si la génération échoue (RLS / réseau), on continue le rendu sans crash
  // et on affiche un fallback formulaire de retry.
  let code: string | null = null
  let codeError: string | null = null
  try {
    code = await ensureReferralCode(supabase, user.id)
  } catch (err) {
    codeError = err instanceof Error ? err.message : 'Génération impossible'
  }

  const [stats, credits, referrals] = await Promise.all([
    code ? getReferralStats(supabase, user.id) : Promise.resolve(null),
    getUserCredits(supabase, user.id),
    code ? listMyReferrals(supabase, user.id) : Promise.resolve([]),
  ])

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'
  const shareUrl = code ? `${siteUrl}/r/${code}` : ''
  const referrerName = profile.full_name?.trim() || 'un confrère'

  return (
    <div className="max-w-3xl space-y-8">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/account">
          <ArrowLeft className="size-4" /> Mon compte
        </Link>
      </Button>

      <AppPageHeader
        title="Programme"
        accent="parrainage"
        eyebrow="Avantage diagnostiqueurs"
        description={`Invitez vos confrères avec votre lien personnel. Vous gagnez ${formatCredits(
          REFERRAL_REWARD_EUR_CENTS,
        )} de crédit par filleul à la 1re facture payée.`}
      />

      {/* HERO LIEN AFFILIÉ */}
      {code ? (
        <Card variant="flat" padding="lg" className="space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
              <Link2 className="size-3.5" /> Votre lien affilié tracé
            </div>
            <Badge variant="green">Actif</Badge>
          </div>
          <ReferralLinkHero code={code} shareUrl={shareUrl} referrerDisplayName={referrerName} />
        </Card>
      ) : (
        <Card variant="flat" padding="lg" className="space-y-4">
          <h2 className="font-semibold text-ink">Votre code n'a pas pu être généré</h2>
          <p className="text-[13px] text-ink-mute leading-relaxed">
            {codeError ?? 'Une erreur inattendue est survenue.'}
          </p>
          <p className="text-[12px] text-ink-faint">
            Vérifiez que les migrations DB sont à jour (notamment la policy RLS
            <code className="font-mono mx-1 px-1.5 py-0.5 rounded bg-sage text-[11px]">
              referral_codes: owner insert
            </code>
            ajoutée par la migration <span className="font-mono">20260524210000</span>).
          </p>
        </Card>
      )}

      {/* RÉCOMPENSES — étapes claires */}
      <Card variant="flat" padding="lg" className="space-y-5">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          <Gift className="size-3.5" /> Vos récompenses, étape par étape
        </div>
        <div className="overflow-hidden rounded-lg border border-rule/60">
          <table className="w-full text-[13px]">
            <thead className="bg-sage/60">
              <tr>
                <th className="text-left font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute py-2.5 px-4">
                  Étape filleul
                </th>
                <th className="text-left font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute py-2.5 px-4">
                  Vous gagnez
                </th>
                <th className="text-left font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute py-2.5 px-4">
                  Délai
                </th>
              </tr>
            </thead>
            <tbody className="bg-paper">
              <tr className="border-t border-rule/40">
                <td className="py-3 px-4 text-ink">Inscription via votre lien</td>
                <td className="py-3 px-4 text-ink-mute">Visibilité (suivi clics)</td>
                <td className="py-3 px-4 font-mono text-[12px] text-ink-mute">Immédiat</td>
              </tr>
              <tr className="border-t border-rule/40">
                <td className="py-3 px-4 text-ink">
                  1<sup>er</sup> abonnement payé
                </td>
                <td className="py-3 px-4 font-semibold text-ink">
                  {formatCredits(REFERRAL_REWARD_EUR_CENTS)} de crédit
                </td>
                <td className="py-3 px-4 font-mono text-[12px] text-ink-mute">
                  J+1 après la 1<sup>re</sup> facture honorée
                </td>
              </tr>
              <tr className="border-t border-rule/40">
                <td className="py-3 px-4 text-ink-mute italic">Toujours actif après 3 mois</td>
                <td className="py-3 px-4 text-ink-mute italic">À l'étude — V2</td>
                <td className="py-3 px-4 font-mono text-[12px] text-ink-faint">—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-ink-mute leading-relaxed">
          Le crédit est appliqué automatiquement sur votre prochaine facture KOVAS — vous n'avez
          aucune démarche à faire. Plafond : {REFERRAL_MAX_REWARDED_PER_YEAR} récompenses payantes
          par an glissant.
        </p>
      </Card>

      {/* DASHBOARD LIVE — 4 KPI */}
      <Card variant="flat" padding="lg" className="space-y-5">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          <Users className="size-3.5" /> Tableau de bord
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Filleuls inscrits" value={`${stats?.totalSubscribed ?? 0}`} />
          <Kpi label="Filleuls payants" value={`${stats?.totalPaid ?? 0}`} />
          <Kpi
            label="Crédits gagnés"
            value={formatCredits(stats?.totalEarnedEurCents ?? 0)}
            accent
          />
          <Kpi
            label="Quota annuel"
            value={`${stats?.totalRewarded ?? 0} / ${REFERRAL_MAX_REWARDED_PER_YEAR}`}
            hint={
              (stats?.totalRewarded ?? 0) >= REFERRAL_MAX_REWARDED_PER_YEAR
                ? 'Plafond atteint'
                : 'sur 12 mois glissants'
            }
          />
        </div>
        {credits.balanceEurCents > 0 ? (
          <div className="flex items-start gap-3 rounded-md border border-rule/60 bg-sage/40 px-3 py-2.5">
            <Gift className="size-4 mt-0.5 shrink-0 text-ink-mute" />
            <p className="text-[12px] text-ink leading-relaxed">
              <span className="font-semibold">
                Solde disponible : {formatCredits(credits.balanceEurCents)}
              </span>
              . Déduit automatiquement de votre prochaine facture KOVAS, sans démarche.
            </p>
          </div>
        ) : null}
      </Card>

      {/* TABLEAU DES FILLEULS */}
      <Card variant="flat" padding="lg" className="space-y-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
            <Share2 className="size-3.5" /> Mes filleuls
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">
            {referrals.length} ligne{referrals.length > 1 ? 's' : ''}
          </span>
        </div>
        <ReferralsTable rows={referrals} />
      </Card>

      {/* FAQ */}
      <Card variant="flat" padding="lg" className="space-y-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Questions fréquentes
        </div>
        <dl className="space-y-4">
          <FaqItem
            q="Comment ça marche concrètement ?"
            a="Vous partagez votre lien personnel (par email, WhatsApp, LinkedIn, SMS ou QR code). Quand un confrère clique, le code est enregistré 90 jours. S'il s'inscrit puis paie sa 1re facture, votre crédit de 50 € est appliqué automatiquement sur votre prochaine facture KOVAS."
          />
          <FaqItem
            q="Quel est le délai de versement du crédit ?"
            a="Le crédit est ajouté à votre solde le lendemain du paiement effectif de la 1re facture de votre filleul (post-essai). Il est ensuite déduit de votre prochain prélèvement mensuel."
          />
          <FaqItem
            q="Y a-t-il une limite ?"
            a={`Oui. ${REFERRAL_MAX_REWARDED_PER_YEAR} récompenses payantes maximum par parrain sur 12 mois glissants (soit ${formatCredits(REFERRAL_REWARD_EUR_CENTS * REFERRAL_MAX_REWARDED_PER_YEAR)} maximum/an). Au-delà, votre filleul continue de bénéficier de son mois offert mais aucun crédit supplémentaire ne vous est versé.`}
          />
          <FaqItem
            q="Comment retirer mes crédits ?"
            a="Les crédits sont applicatifs : ils ne se retirent pas en cash, ils se déduisent automatiquement de vos factures KOVAS suivantes. Vous voyez le solde sur cette page et sur chaque facture (ligne « Crédit parrainage »)."
          />
        </dl>
      </Card>

      {/* MENTION LÉGALE */}
      <p className="text-[11px] text-ink-faint leading-relaxed pt-4 border-t border-rule/40">
        Programme conforme à l'article L121-21 du Code de la consommation. La récompense est
        attribuée après le paiement effectif de la 1<sup>re</sup> facture du filleul (post-essai).
        Les données de clics sont conservées 13 mois maximum, IP hashée SHA-256 (RGPD).
      </p>
    </div>
  )
}

function Kpi({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string
  value: string
  hint?: string
  accent?: boolean
}) {
  return (
    <div className="space-y-1">
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">{label}</div>
      <div
        className={
          accent
            ? 'font-serif italic font-normal text-[28px] leading-tight text-ink'
            : 'text-[22px] font-semibold tracking-tight text-ink'
        }
      >
        {value}
      </div>
      {hint ? (
        <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">
          {hint}
        </div>
      ) : null}
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="space-y-1.5">
      <dt className="font-semibold text-[14px] text-ink">{q}</dt>
      <dd className="text-[13px] text-ink-mute leading-relaxed">{a}</dd>
    </div>
  )
}
