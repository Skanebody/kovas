'use client'

import { Card } from '@/components/ui/card'
import type { ClaimSnapshot } from '@/lib/claim/types'
import { CheckCircle2, Clock } from 'lucide-react'

/**
 * Card de confirmation finale (refonte Doctolib 2026-05-27).
 *
 * Affichée quand les 3 étapes sont validées et que le claim est en attente
 * de revue humaine (SLA 24-48h) ou déjà tranché.
 */
interface Props {
  snapshot: ClaimSnapshot
}

export function StepConfirmation({ snapshot }: Props) {
  const isRejected = snapshot.kycDecision === 'rejected' || snapshot.status === 'rejected'
  const isApproved = snapshot.kycDecision === 'approved' || snapshot.status === 'approved'

  if (isRejected) {
    return (
      <Card variant="flat" padding="lg" className="border-l-4 border-l-danger">
        <h2 className="text-[20px] font-semibold text-ink mb-2">Demande non validée</h2>
        <p className="text-[14px] text-ink-mute leading-relaxed">
          Nos équipes n&apos;ont pas pu valider ta demande de réclamation. Tu vas recevoir un email
          détaillant la raison du refus et les actions possibles.
        </p>
        <p className="text-[13px] text-ink-mute mt-4">
          Tu peux nous contacter directement à{' '}
          <a href="mailto:contact@kovas.fr" className="underline font-medium text-ink">
            contact@kovas.fr
          </a>{' '}
          pour clarifier.
        </p>
      </Card>
    )
  }

  if (isApproved) {
    return (
      <Card variant="flat" padding="lg" className="border-l-4 border-l-[#D4F542]">
        <CheckCircle2 className="size-8 text-[#0F1419] mb-3" aria-hidden />
        <h2 className="text-[20px] font-semibold text-ink mb-2">Fiche validée</h2>
        <p className="text-[14px] text-ink-mute leading-relaxed">
          Ta réclamation a été approuvée. Tu peux maintenant créer ton compte KOVAS et reprendre la
          main sur ta fiche professionnelle.
        </p>
        <a
          href={`/signup?claim_id=${snapshot.claimId ?? ''}`}
          className="mt-5 inline-flex items-center gap-2 bg-cta text-cta-foreground rounded-pill px-6 py-3 text-[14px] font-semibold hover:bg-cta-hover transition-colors"
        >
          Créer mon compte KOVAS
        </a>
      </Card>
    )
  }

  return (
    <Card variant="flat" padding="lg" className="border-l-4 border-l-[#0F1419]">
      <Clock className="size-7 text-ink mb-3" aria-hidden />
      <h2 className="text-[20px] font-semibold text-ink mb-2">
        Demande envoyée — décision sous 24 à 48&nbsp;heures
      </h2>
      <p className="text-[14px] text-ink-mute leading-relaxed">
        Tes documents sont en cours de vérification. Tu recevras un email dès que la décision est
        prise.
      </p>

      {/* Timeline */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3 text-[12px]">
        <TimelineItem state="done" label="01 · SIRET" />
        <TimelineItem state="done" label="02 · SMS" />
        <TimelineItem state="done" label="03 · Identité" />
        <TimelineItem state="active" label="Revue humaine" />
      </div>

      <p className="text-[11px] font-mono uppercase tracking-wider text-ink-mute mt-6">
        Tu recevras un email à la décision finale.
      </p>
    </Card>
  )
}

function TimelineItem({ state, label }: { state: 'done' | 'active'; label: string }) {
  const isDone = state === 'done'
  return (
    <div className="flex items-center gap-2">
      <span
        className={
          isDone
            ? 'size-2 rounded-full bg-[#D4F542]'
            : 'size-2 rounded-full bg-[#0F1419] animate-pulse-soft'
        }
        aria-hidden
      />
      <span className={isDone ? 'text-ink' : 'text-ink font-medium'}>{label}</span>
    </div>
  )
}
