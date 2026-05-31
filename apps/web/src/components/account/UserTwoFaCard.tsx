'use client'

/**
 * UserTwoFaCard — Double authentification (TOTP) OPTIONNELLE pour le compte
 * diagnostiqueur (refonte 2026-05-31).
 *
 * Distincte de la carte 2FA ADMIN (`AdminTwoFaCard` dans
 * account-settings-client.tsx) : cette carte protège le compte du
 * diagnostiqueur lui-même via la MFA native Supabase, pas l'espace admin.
 *
 * CONTRAINTE DE SÉCURITÉ N°1 : la 2FA est strictement OPT-IN. Tant que le
 * diagnostiqueur ne l'active pas explicitement (enrôlement + 1er code validé),
 * AUCUN enforcement ne s'applique (cf. garde fail-open dans dashboard/layout.tsx).
 *
 * Tout est client-side : `supabase.auth.mfa.*` n'existe que côté navigateur.
 *
 * Flux d'enrôlement :
 *   1. mfa.enroll({ factorType: 'totp' })  → QR (SVG data-url) + secret + factorId
 *   2. mfa.challenge({ factorId })         → challengeId
 *   3. mfa.verify({ factorId, challengeId, code }) → facteur vérifié (status verified)
 * Désactivation :
 *   - mfa.unenroll({ factorId }) sur le facteur vérifié (après confirmation).
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { createClient } from '@/lib/supabase/client'
import { Loader2, ShieldCheck, ShieldOff, X } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { type ReactNode, useCallback, useEffect, useState } from 'react'

/** Facteur TOTP vérifié minimal (id + libellé) pour l'affichage « Activée ». */
interface VerifiedFactor {
  id: string
  friendlyName: string | null
}

/** Données d'un enrôlement TOTP en cours (avant validation du 1er code). */
interface PendingEnrollment {
  factorId: string
  qrCode: string
  secret: string
}

type CardState =
  | { kind: 'loading' }
  | { kind: 'idle'; verified: VerifiedFactor | null }
  | { kind: 'enrolling'; enrollment: PendingEnrollment }

/**
 * Préfixe à ajouter au champ `qr_code` renvoyé par Supabase quand il s'agit
 * d'un SVG brut (et non déjà d'une data-url). Supabase renvoie en général une
 * data-url complète ; on gère les deux cas par sécurité.
 */
function toQrSrc(qrCode: string): string {
  if (qrCode.startsWith('data:')) return qrCode
  return `data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`
}

export function UserTwoFaCard(): ReactNode {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [state, setState] = useState<CardState>({ kind: 'loading' })
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  /** Recharge la liste des facteurs et calcule l'état « Activée / Désactivée ». */
  const refreshFactors = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error || !data) {
      // Fail-soft : on retombe sur "désactivée" plutôt que de bloquer l'UI.
      setState({ kind: 'idle', verified: null })
      return
    }
    const verifiedTotp = data.totp.find((f) => f.status === 'verified')
    setState({
      kind: 'idle',
      verified: verifiedTotp
        ? { id: verifiedTotp.id, friendlyName: verifiedTotp.friendly_name ?? null }
        : null,
    })
  }, [supabase])

  useEffect(() => {
    void refreshFactors()
  }, [refreshFactors])

  /**
   * Lance un nouvel enrôlement TOTP. Nettoie d'abord d'éventuels facteurs
   * `unverified` orphelins (enrôlements abandonnés) qui empêcheraient un
   * nouvel enroll côté Supabase.
   */
  const handleStartEnroll = useCallback(async () => {
    setBusy(true)
    try {
      const { data: list } = await supabase.auth.mfa.listFactors()
      if (list) {
        const orphans = list.all.filter((f) => f.status === 'unverified')
        for (const orphan of orphans) {
          await supabase.auth.mfa.unenroll({ factorId: orphan.id })
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
      if (error || !data) {
        toast.error("Impossible de démarrer l'activation. Réessaie dans quelques instants.")
        return
      }
      setCode('')
      setState({
        kind: 'enrolling',
        enrollment: {
          factorId: data.id,
          qrCode: data.totp.qr_code,
          secret: data.totp.secret,
        },
      })
    } catch {
      toast.error('Erreur réseau. Réessaie dans quelques instants.')
    } finally {
      setBusy(false)
    }
  }, [supabase])

  /** Annule l'enrôlement en cours (supprime le facteur unverified créé). */
  const handleCancelEnroll = useCallback(
    async (factorId: string) => {
      setBusy(true)
      try {
        await supabase.auth.mfa.unenroll({ factorId })
      } catch {
        // best-effort : même en cas d'échec, on revient à l'état idle.
      } finally {
        setCode('')
        setBusy(false)
        await refreshFactors()
      }
    },
    [supabase, refreshFactors],
  )

  /** Valide le 1er code TOTP → marque le facteur comme vérifié. */
  const handleVerify = useCallback(
    async (factorId: string) => {
      const cleaned = code.replace(/\D/g, '')
      if (cleaned.length !== 6) {
        toast.error('Saisis le code à 6 chiffres affiché dans ton application.')
        return
      }
      setBusy(true)
      try {
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId,
        })
        if (challengeError || !challenge) {
          toast.error('Erreur lors de la vérification. Réessaie.')
          return
        }
        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId,
          challengeId: challenge.id,
          code: cleaned,
        })
        if (verifyError) {
          toast.error('Code incorrect ou expiré. Vérifie l’heure de ton téléphone et réessaie.')
          return
        }
        toast.success('Double authentification activée.')
        setCode('')
        await refreshFactors()
        // Rafraîchit le layout serveur (la session passe AAL2 immédiatement).
        router.refresh()
      } catch {
        toast.error('Erreur réseau. Réessaie dans quelques instants.')
      } finally {
        setBusy(false)
      }
    },
    [code, supabase, refreshFactors, router],
  )

  /** Désactive la 2FA (supprime le facteur vérifié) après confirmation. */
  const handleDisable = useCallback(
    async (factorId: string) => {
      if (
        !window.confirm(
          'Désactiver la double authentification de ton compte ? Tu pourras la réactiver à tout moment.',
        )
      ) {
        return
      }
      setBusy(true)
      try {
        const { error } = await supabase.auth.mfa.unenroll({ factorId })
        if (error) {
          toast.error('Erreur lors de la désactivation. Réessaie.')
          return
        }
        toast.success('Double authentification désactivée.')
        await refreshFactors()
        router.refresh()
      } catch {
        toast.error('Erreur réseau. Réessaie dans quelques instants.')
      } finally {
        setBusy(false)
      }
    },
    [supabase, refreshFactors, router],
  )

  return (
    <Card variant="opaque" padding="default" className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="size-8 rounded-md flex items-center justify-center shrink-0"
          style={{
            backgroundColor: state.kind === 'idle' && state.verified ? '#34C759' : '#0F1419',
          }}
        >
          <ShieldCheck className="size-4 text-white" />
        </span>
        <h2 className="font-sans text-[15px] font-semibold text-[#0F1419]">
          Double authentification
        </h2>
      </div>

      <p className="text-[13px] text-[#0F1419]/65 leading-relaxed">
        Ajoute un code à usage unique généré par ton application d'authentification (Google
        Authenticator, Authy, 1Password…) en plus de ton mot de passe. C'est facultatif : tu peux
        l'activer ou la désactiver quand tu veux.
      </p>

      {state.kind === 'loading' && (
        <div className="flex items-center gap-2 text-[12px] text-[#0F1419]/55">
          <Loader2 className="size-4 animate-spin" /> Chargement…
        </div>
      )}

      {/* ── État ACTIVÉE ───────────────────────────────────────────── */}
      {state.kind === 'idle' && state.verified && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="green" className="text-[10px]">
              Activée
            </Badge>
            <span className="text-[12px] text-[#0F1419]/55">
              Un code à 6 chiffres te sera demandé à chaque nouvelle connexion.
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => state.verified && handleDisable(state.verified.id)}
              disabled={busy}
            >
              <ShieldOff className="size-4" />
              {busy ? 'Désactivation…' : 'Désactiver'}
            </Button>
          </div>
        </>
      )}

      {/* ── État DÉSACTIVÉE ────────────────────────────────────────── */}
      {state.kind === 'idle' && !state.verified && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="muted" className="text-[10px]">
              Désactivée
            </Badge>
            <span className="text-[12px] text-[#0F1419]/55">
              Recommandée pour renforcer la sécurité de ton compte.
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="default"
              size="default"
              onClick={handleStartEnroll}
              disabled={busy}
            >
              <ShieldCheck className="size-4" />
              {busy ? 'Préparation…' : 'Activer'}
            </Button>
          </div>
        </>
      )}

      {/* ── État ENRÔLEMENT (scan QR + validation 1er code) ────────── */}
      {state.kind === 'enrolling' && (
        <div className="space-y-4">
          <ol className="space-y-2 text-[13px] text-[#0F1419]/72 leading-relaxed list-decimal pl-5">
            <li>Ouvre ton application d'authentification.</li>
            <li>Scanne le QR code ci-dessous (ou saisis la clé manuelle).</li>
            <li>Saisis le code à 6 chiffres généré pour confirmer.</li>
          </ol>

          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="rounded-[12px] border border-[#0F1419]/[0.08] bg-white p-3 shrink-0">
              <Image
                src={toQrSrc(state.enrollment.qrCode)}
                alt="QR code de configuration de la double authentification"
                width={160}
                height={160}
                unoptimized
                className="size-40"
              />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#0F1419]/55">
                Clé manuelle (si tu ne peux pas scanner)
              </p>
              <code className="block break-all rounded-md bg-[#F5F7F4] px-3 py-2 font-mono text-[12px] text-[#0F1419] border border-[#0F1419]/[0.08]">
                {state.enrollment.secret}
              </code>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="user-2fa-code" className="block text-[12px] font-medium text-[#0F1419]">
              Code de vérification
            </label>
            <Input
              id="user-2fa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && state.kind === 'enrolling') {
                  e.preventDefault()
                  void handleVerify(state.enrollment.factorId)
                }
              }}
              className="max-w-[180px] font-mono tracking-[0.3em] text-center text-[16px]"
              disabled={busy}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="default"
              size="default"
              onClick={() => handleVerify(state.enrollment.factorId)}
              disabled={busy || code.length !== 6}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              {busy ? 'Vérification…' : 'Valider maintenant'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="default"
              onClick={() => handleCancelEnroll(state.enrollment.factorId)}
              disabled={busy}
            >
              <X className="size-4" /> Annuler
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
