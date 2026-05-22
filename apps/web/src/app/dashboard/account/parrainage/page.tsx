import { AppPageHeader } from '@/components/app-page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CopyShareButtons } from '@/components/referral/CopyShareButtons'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ensureReferralCode } from '@/lib/referral/code-generator'
import { formatCredits, getUserCredits } from '@/lib/referral/credits-manager'
import {
  getReferralStats,
  listMyReferrals,
  REFERRAL_REWARD_EUR_CENTS,
} from '@/lib/referral/referral-engine'
import { ArrowLeft, Gift, Share2, Users } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Programme parrainage' }

export default async function ParrainagePage() {
  const { supabase, user } = await getCurrentUser()

  // Garantit un code de parrainage à l'arrivée sur la page
  const code = await ensureReferralCode(supabase, user.id)
  const [stats, credits, referrals] = await Promise.all([
    getReferralStats(supabase, user.id),
    getUserCredits(supabase, user.id),
    listMyReferrals(supabase, user.id),
  ])

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'
  const shareUrl = `${siteUrl}/parrainage/${code}`

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
        description="Invitez vos confrères et gagnez 50 € de crédit applicable sur vos factures KOVAS dès leur 1re facture payée."
      />

      {/* CODE + PARTAGE */}
      <Card variant="flat" padding="lg" className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
              Mon code de parrainage
            </div>
            <div className="font-mono text-[28px] font-semibold tracking-wider text-ink">
              {code}
            </div>
          </div>
          <Badge variant="green">Actif</Badge>
        </div>

        <div className="rounded-md border border-rule/70 bg-sage px-3 py-2.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
            Lien à partager
          </div>
          <div className="font-mono text-[12px] text-ink truncate">{shareUrl}</div>
        </div>

        <CopyShareButtons code={code} shareUrl={shareUrl} />
      </Card>

      {/* STATS */}
      <Card variant="flat" padding="lg" className="space-y-5">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          <Users className="size-3.5" /> Synthèse parrainage
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Filleuls inscrits" value={`${stats.totalSubscribed}`} />
          <Stat label="Filleuls payants" value={`${stats.totalPaid}`} />
          <Stat
            label="Crédits gagnés"
            value={formatCredits(stats.totalEarnedEurCents)}
          />
          <Stat
            label="Solde disponible"
            value={formatCredits(credits.balanceEurCents)}
            accent
          />
        </div>
        {credits.balanceEurCents > 0 ? (
          <p className="text-[12px] text-ink-mute leading-relaxed">
            Ce solde sera déduit automatiquement de votre prochaine facture KOVAS, sans démarche
            de votre part.
          </p>
        ) : null}
      </Card>

      {/* COMMENT ÇA MARCHE */}
      <Card variant="flat" padding="lg" className="space-y-5">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          <Gift className="size-3.5" /> Comment ça fonctionne
        </div>
        <ol className="space-y-4 text-[14px] text-ink">
          <Step
            n={1}
            title="Partagez votre code"
            body="Envoyez votre lien ou votre code à vos confrères diagnostiqueurs."
          />
          <Step
            n={2}
            title="Votre filleul s'inscrit"
            body="Il bénéficie automatiquement de 1 mois offert sur son abonnement, quel que soit le forfait choisi."
          />
          <Step
            n={3}
            title={`Vous gagnez ${formatCredits(REFERRAL_REWARD_EUR_CENTS)}`}
            body="Dès que votre filleul règle sa 1re facture, votre crédit est ajouté à votre solde et déduit de votre prochain prélèvement."
          />
        </ol>
      </Card>

      {/* LISTE FILLEULS */}
      <Card variant="flat" padding="lg" className="space-y-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
            <Share2 className="size-3.5" /> Mes filleuls
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">
            {referrals.length} ligne{referrals.length > 1 ? 's' : ''}
          </span>
        </div>

        {referrals.length === 0 ? (
          <p className="text-[13px] text-ink-mute py-4">
            Aucun filleul pour l'instant. Partagez votre code pour démarrer.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-rule/60">
                  <th className="text-left font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute py-2 pr-3">
                    Filleul
                  </th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute py-2 pr-3">
                    Inscription
                  </th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute py-2 pr-3">
                    Statut
                  </th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute py-2 pl-3">
                    Récompense
                  </th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id} className="border-b border-rule/30 last:border-0">
                    <td className="py-2.5 pr-3 text-ink">{r.maskedName}</td>
                    <td className="py-2.5 pr-3 font-mono text-[12px] text-ink-mute">
                      {r.signedUpAt ? formatDate(r.signedUpAt) : '—'}
                    </td>
                    <td className="py-2.5 pr-3">
                      <ReferralStatusBadge status={r.status} />
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono text-[13px]">
                      {r.rewardEurCents
                        ? formatCredits(r.rewardEurCents)
                        : <span className="text-ink-faint">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* MENTION LÉGALE */}
      <p className="text-[11px] text-ink-faint leading-relaxed pt-4 border-t border-rule/40">
        Programme conforme à l'article L121-21 du Code de la consommation. La récompense est
        attribuée après le paiement effectif de la 1re facture du filleul (post-essai). Limite de
        12 récompenses par parrain sur 12 mois glissants. Au-delà, votre filleul continue de
        bénéficier de son mois offert.
      </p>
    </div>
  )
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
        {label}
      </div>
      <div
        className={
          accent
            ? 'font-serif italic font-normal text-[28px] leading-tight text-ink'
            : 'text-[22px] font-semibold tracking-tight text-ink'
        }
      >
        {value}
      </div>
    </div>
  )
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-paper font-mono text-[11px] font-medium">
        {n}
      </span>
      <div className="space-y-0.5">
        <div className="font-semibold text-ink">{title}</div>
        <p className="text-[13px] text-ink-mute leading-relaxed">{body}</p>
      </div>
    </li>
  )
}

function ReferralStatusBadge({
  status,
}: {
  status: 'pending' | 'subscribed' | 'paid_invoice_1' | 'rewarded' | 'cancelled'
}) {
  switch (status) {
    case 'pending':
      return <Badge variant="muted">En attente</Badge>
    case 'subscribed':
      return <Badge variant="blue">Inscrit</Badge>
    case 'paid_invoice_1':
      return <Badge variant="green">1re facture payée</Badge>
    case 'rewarded':
      return <Badge variant="green">Récompensé</Badge>
    case 'cancelled':
      return <Badge variant="red">Annulé</Badge>
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
