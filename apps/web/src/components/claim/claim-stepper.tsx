'use client'

import { Card } from '@/components/ui/card'
import {
  type ClaimSnapshot,
  type StepperStage,
  emptyClaimSnapshot,
  stepperStageFromStatus,
} from '@/lib/claim/types'
import { CheckCircle2, Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Step1Siret } from './step-1-siret'
import { Step2Phone } from './step-2-phone'
import { Step3Identity } from './step-3-identity'
import { StepConfirmation } from './step-confirmation'

/**
 * Claim Stepper — refonte Doctolib 2026-05-27.
 *
 * Remplace l'ancien `ClaimMethodTabs` (4 méthodes parallèles "1 seule suffit")
 * par 3 étapes obligatoires séquentielles pour authentification forte :
 *   1. SIRET (match exact INSEE / DHUP)
 *   2. SMS OTP (numéro pro déclaré)
 *   3. KYC pièce d'identité (Claude Vision + review humaine 24-48h)
 *
 * UX : stepper vertical persistant. L'étape en cours est ouverte (card pleine),
 * les étapes complétées affichent un check vert + résumé, les futures sont
 * grisées avec icône cadenas.
 *
 * DS v5 strict : sage `#F5F7F4` + navy `#0F1419` + chartreuse `#D4F542`
 * uniquement pour les checks validés. Tutoiement, ton sobre pro.
 */
interface Props {
  diagnosticianId: string
  diagnosticianFullName: string
  maskedPhone: string | null
  maskedSiret: string | null
}

export function ClaimStepper({
  diagnosticianId,
  diagnosticianFullName,
  maskedPhone,
  maskedSiret,
}: Props) {
  const [snapshot, setSnapshot] = useState<ClaimSnapshot>(emptyClaimSnapshot)
  const stage: StepperStage = useMemo(
    () => stepperStageFromStatus(snapshot.status),
    [snapshot.status],
  )

  function handleStep1Done(claimId: string) {
    setSnapshot((prev) => ({
      ...prev,
      claimId,
      status: 'siret_verified',
      siretVerifiedAt: new Date().toISOString(),
    }))
  }

  function handleStep2Done() {
    setSnapshot((prev) => ({
      ...prev,
      status: 'phone_verified',
      phoneVerifiedAt: new Date().toISOString(),
    }))
  }

  function handleStep3Done() {
    setSnapshot((prev) => ({
      ...prev,
      status: 'identity_uploaded',
      identityUploadedAt: new Date().toISOString(),
    }))
  }

  if (stage === 'submitted') {
    return <StepConfirmation snapshot={snapshot} />
  }

  return (
    <div className="space-y-4">
      {/* Étape 1 — SIRET */}
      <StepCard
        number="01"
        title="Vérification SIRET"
        subtitle="Match INSEE avec le SIRET déclaré sur la fiche"
        state={snapshot.siretVerifiedAt ? 'done' : stage === 'step1_siret' ? 'active' : 'locked'}
        doneSummary={
          snapshot.siretVerifiedAt ? `Vérifié le ${formatDate(snapshot.siretVerifiedAt)}` : null
        }
      >
        {stage === 'step1_siret' && (
          <Step1Siret
            diagnosticianId={diagnosticianId}
            maskedSiret={maskedSiret}
            onDone={handleStep1Done}
          />
        )}
      </StepCard>

      {/* Étape 2 — SMS OTP */}
      <StepCard
        number="02"
        title="Vérification téléphone"
        subtitle="OTP par SMS sur le mobile professionnel déclaré"
        state={snapshot.phoneVerifiedAt ? 'done' : stage === 'step2_phone' ? 'active' : 'locked'}
        doneSummary={
          snapshot.phoneVerifiedAt ? `Vérifié le ${formatDate(snapshot.phoneVerifiedAt)}` : null
        }
      >
        {stage === 'step2_phone' && snapshot.claimId && (
          <Step2Phone
            diagnosticianId={diagnosticianId}
            claimId={snapshot.claimId}
            maskedPhone={maskedPhone}
            onDone={handleStep2Done}
          />
        )}
      </StepCard>

      {/* Étape 3 — KYC */}
      <StepCard
        number="03"
        title="Pièce d'identité (KYC)"
        subtitle="CNI ou passeport — vérification automatique + revue humaine 24-48h"
        state={
          snapshot.identityUploadedAt ? 'done' : stage === 'step3_identity' ? 'active' : 'locked'
        }
        doneSummary={
          snapshot.identityUploadedAt
            ? `Envoyé le ${formatDate(snapshot.identityUploadedAt)}`
            : null
        }
      >
        {stage === 'step3_identity' && snapshot.claimId && (
          <Step3Identity
            diagnosticianId={diagnosticianId}
            claimId={snapshot.claimId}
            diagnosticianFullName={diagnosticianFullName}
            onDone={handleStep3Done}
          />
        )}
      </StepCard>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// StepCard — wrapper visuel d'une étape du stepper
// ────────────────────────────────────────────────────────────────────

interface StepCardProps {
  number: '01' | '02' | '03'
  title: string
  subtitle: string
  state: 'done' | 'active' | 'locked'
  doneSummary: string | null
  children?: React.ReactNode
}

function StepCard({ number, title, subtitle, state, doneSummary, children }: StepCardProps) {
  const isActive = state === 'active'
  const isDone = state === 'done'
  const isLocked = state === 'locked'

  // DS v5 : sage `#F5F7F4` (paper) + navy `#0F1419` (texte/CTA) + chartreuse `#D4F542` (check OK uniquement).
  const containerCls = isLocked
    ? 'opacity-50 grayscale-[0.4]'
    : isDone
      ? 'border-l-4 border-l-[#D4F542]'
      : 'border-l-4 border-l-[#0F1419]'

  return (
    <Card variant="flat" padding={isActive ? 'default' : 'sm'} className={containerCls}>
      <div className="flex items-start gap-4">
        {/* Numéro étape — Instrument Serif italic */}
        <div className="shrink-0">
          <span
            className="font-serif italic text-[40px] leading-none text-[#0F1419]/30 select-none"
            aria-hidden
          >
            {number}
          </span>
        </div>

        {/* Header + content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-ink leading-snug">{title}</h3>
              <p className="text-[12px] text-ink-mute mt-0.5 leading-relaxed">{subtitle}</p>
            </div>
            <div className="shrink-0">
              {isDone && (
                <CheckCircle2 className="size-5 text-[#0F1419]" aria-label="Étape validée" />
              )}
              {isLocked && (
                <Lock className="size-4 text-ink-faint" aria-label="Étape verrouillée" />
              )}
            </div>
          </div>

          {isDone && doneSummary && (
            <p className="mt-2 text-[11px] font-mono uppercase tracking-wider text-ink-mute">
              {doneSummary}
            </p>
          )}

          {isActive && children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </Card>
  )
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}
