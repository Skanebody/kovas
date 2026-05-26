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
        description={`Invite tes confrères avec ton lien personnel. Tu gagnes ${formatCredits(
          REFERRAL_REWARD_EUR_CENTS,
        )} de crédit par filleul à la 1re facture payée.`}
      />

      {/* HERO LIEN AFFILIÉ */}
      {code ? (
        <Card variant="flat" padding="lg" className="space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[#0F1419]/72">
              <Link2 className="size-3.5" /> Ton lien affilié tracé
            </div>
            <Badge variant="green">Actif</Badge>
          </div>
          <ReferralLinkHero code={code} shareUrl={shareUrl} referrerDisplayName={referrerName} />
        </Card>
      ) : (
        <Card variant="flat" padding="lg" className="space-y-4">
          <h2 className="font-semibold text-[#0F1419]">Ton code n'a pas pu être généré</h2>
          <p className="text-[13px] text-[#0F1419]/72 leading-relaxed">
            {codeError ?? 'Une erreur inattendue est survenue.'}
          </p>
          <p className="text-[12px] text-[#0F1419]/55">
            Vérifie que les migrations DB sont à jour (notamment la policy RLS
            <code className="font-mono mx-1 px-1.5 py-0.5 rounded bg-sage text-[11px]">
              referral_codes: owner insert
            </code>
            ajoutée par la migration <span className="font-mono">20260524210000</span>).
          </p>
        </Card>
      )}

      {/* RÉCOMPENSES — étapes claires */}
      <Card variant="flat" padding="lg" className="space-y-5">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[#0F1419]/72">
          <Gift className="size-3.5" /> Tes récompenses, étape par étape
        </div>
        <div className="overflow-hidden rounded-lg border border-[#0F1419]/[0.08]">
          <table className="w-full text-[13px]">
            <thead className="bg-sage/60">
              <tr>
                <th className="text-left font-mono text-[10px] uppercase tracking-[0.08em] text-[#0F1419]/72 py-2.5 px-4">
                  Étape filleul
                </th>
                <th className="text-left font-mono text-[10px] uppercase tracking-[0.08em] text-[#0F1419]/72 py-2.5 px-4">
                  Tu gagnes
                </th>
                <th className="text-left font-mono text-[10px] uppercase tracking-[0.08em] text-[#0F1419]/72 py-2.5 px-4">
                  Délai
                </th>
              </tr>
            </thead>
            <tbody className="bg-paper">
              <tr className="border-t border-[#0F1419]/[0.08]">
                <td className="py-3 px-4 text-[#0F1419]">Inscription via ton lien</td>
                <td className="py-3 px-4 text-[#0F1419]/72">Visibilité (suivi clics)</td>
                <td className="py-3 px-4 font-mono text-[12px] text-[#0F1419]/72">Immédiat</td>
              </tr>
              <tr className="border-t border-[#0F1419]/[0.08]">
                <td className="py-3 px-4 text-[#0F1419]">
                  1<sup>er</sup> abonnement payé
                </td>
                <td className="py-3 px-4 font-semibold text-[#0F1419]">
                  {formatCredits(REFERRAL_REWARD_EUR_CENTS)} de crédit
                </td>
                <td className="py-3 px-4 font-mono text-[12px] text-[#0F1419]/72">
                  J+1 après la 1<sup>re</sup> facture honorée
                </td>
              </tr>
              <tr className="border-t border-[#0F1419]/[0.08]">
                <td className="py-3 px-4 text-[#0F1419]/72 italic">Toujours actif après 3 mois</td>
                <td className="py-3 px-4 text-[#0F1419]/72 italic">À l'étude — V2</td>
                <td className="py-3 px-4 font-mono text-[12px] text-[#0F1419]/55">—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-[#0F1419]/72 leading-relaxed">
          Le crédit est appliqué automatiquement sur ta prochaine facture KOVAS — tu n'as aucune
          démarche à faire. Plafond : {REFERRAL_MAX_REWARDED_PER_YEAR} récompenses payantes par an
          glissant.
        </p>
      </Card>

      {/* DASHBOARD LIVE — 4 KPI */}
      <Card variant="flat" padding="lg" className="space-y-5">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[#0F1419]/72">
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
          <div className="flex items-start gap-3 rounded-md border border-[#0F1419]/[0.08] bg-sage/40 px-3 py-2.5">
            <Gift className="size-4 mt-0.5 shrink-0 text-[#0F1419]/72" />
            <p className="text-[12px] text-[#0F1419] leading-relaxed">
              <span className="font-semibold">
                Solde disponible : {formatCredits(credits.balanceEurCents)}
              </span>
              . Déduit automatiquement de ta prochaine facture KOVAS, sans démarche.
            </p>
          </div>
        ) : null}
      </Card>

      {/* TABLEAU DES FILLEULS */}
      <Card variant="flat" padding="lg" className="space-y-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[#0F1419]/72">
            <Share2 className="size-3.5" /> Mes filleuls
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/55">
            {referrals.length} ligne{referrals.length > 1 ? 's' : ''}
          </span>
        </div>
        <ReferralsTable rows={referrals} />
      </Card>

      {/* FAQ */}
      <Card variant="flat" padding="lg" className="space-y-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#0F1419]/72">
          Questions fréquentes
        </div>
        <dl className="space-y-4">
          <FaqItem
            q="Comment ça marche concrètement ?"
            a="Tu partages ton lien personnel (par email, WhatsApp, LinkedIn, SMS ou QR code). Quand un confrère clique, le code est enregistré 90 jours. S'il s'inscrit puis paie sa 1re facture, ton crédit de 50 € est appliqué automatiquement sur ta prochaine facture KOVAS."
          />
          <FaqItem
            q="Quel est le délai de versement du crédit ?"
            a="Le crédit est ajouté à ton solde le lendemain du paiement effectif de la 1re facture de ton filleul (post-essai). Il est ensuite déduit de ton prochain prélèvement mensuel."
          />
          <FaqItem
            q="Y a-t-il une limite ?"
            a={`Oui. ${REFERRAL_MAX_REWARDED_PER_YEAR} récompenses payantes maximum par parrain sur 12 mois glissants (soit ${formatCredits(REFERRAL_REWARD_EUR_CENTS * REFERRAL_MAX_REWARDED_PER_YEAR)} maximum/an). Au-delà, ton filleul continue de bénéficier de son mois offert mais aucun crédit supplémentaire ne t'est versé.`}
          />
          <FaqItem
            q="Comment retirer mes crédits ?"
            a="Les crédits sont applicatifs : ils ne se retirent pas en cash, ils se déduisent automatiquement de tes factures KOVAS suivantes. Tu vois le solde sur cette page et sur chaque facture (ligne « Crédit parrainage »)."
          />
        </dl>
      </Card>

      {/* MENTION LÉGALE */}
      <p className="text-[11px] text-[#0F1419]/55 leading-relaxed pt-4 border-t border-[#0F1419]/[0.08]">
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
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#0F1419]/72">
        {label}
      </div>
      <div
        className={
          accent
            ? 'font-serif italic font-normal text-[28px] leading-tight text-[#0F1419]'
            : 'text-[22px] font-semibold tracking-tight text-[#0F1419]'
        }
      >
        {value}
      </div>
      {hint ? (
        <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/55">
          {hint}
        </div>
      ) : null}
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="space-y-1.5">
      <dt className="font-semibold text-[14px] text-[#0F1419]">{q}</dt>
      <dd className="text-[13px] text-[#0F1419]/72 leading-relaxed">{a}</dd>
    </div>
  )
}
