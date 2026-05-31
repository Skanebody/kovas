'use client'

/**
 * Verify2faClient — challenge 2FA TOTP (MFA native Supabase).
 *
 * Flux :
 *   1. mfa.listFactors() → si aucun facteur vérifié, rien à vérifier → on
 *      renvoie vers le dashboard (cas dégradé / facteur supprimé entre-temps).
 *   2. mfa.challenge({ factorId }) sur le 1er facteur TOTP vérifié.
 *   3. mfa.verify({ factorId, challengeId, code }) → la session passe AAL2.
 *   4. router.push('/dashboard/dashboard') (la garde du layout laisse alors
 *      passer puisque currentLevel === nextLevel).
 *
 * Tout est client-side (supabase.auth.mfa.* navigateur uniquement). Un lien
 * « Se déconnecter » est fourni en secours (anti-lockout).
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { createClient } from '@/lib/supabase/client'
import { Loader2, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type ReactNode, useCallback, useEffect, useState } from 'react'

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'ready'; factorId: string }
  | { kind: 'redirecting' }

export function Verify2faClient({
  onLogout,
}: {
  onLogout: () => Promise<void>
}): ReactNode {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [state, setState] = useState<ScreenState>({ kind: 'loading' })
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  // Détermine le facteur TOTP vérifié à challenger (sinon redirige).
  useEffect(() => {
    let alive = true
    void (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (!alive) return
      const verified = data?.totp.find((f) => f.status === 'verified')
      if (error || !verified) {
        // Rien à vérifier → on laisse l'utilisateur entrer.
        setState({ kind: 'redirecting' })
        router.replace('/dashboard/dashboard')
        return
      }
      setState({ kind: 'ready', factorId: verified.id })
    })()
    return () => {
      alive = false
    }
  }, [supabase, router])

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
        setState({ kind: 'redirecting' })
        router.push('/dashboard/dashboard')
      } catch {
        toast.error('Erreur réseau. Réessaie dans quelques instants.')
      } finally {
        setBusy(false)
      }
    },
    [code, supabase, router],
  )

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 animate-fade-in">
      <Card variant="opaque" padding="default" className="w-full max-w-md space-y-5">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="size-9 rounded-md bg-[#0F1419] flex items-center justify-center shrink-0"
          >
            <ShieldCheck className="size-5 text-white" />
          </span>
          <div>
            <h1 className="font-sans text-[18px] font-semibold text-[#0F1419] leading-tight">
              Vérification en deux étapes
            </h1>
            <p className="text-[12px] text-[#0F1419]/55">Confirme ton identité pour continuer.</p>
          </div>
        </div>

        {state.kind === 'loading' && (
          <div className="flex items-center gap-2 text-[13px] text-[#0F1419]/55 py-4">
            <Loader2 className="size-4 animate-spin" /> Préparation…
          </div>
        )}

        {state.kind === 'redirecting' && (
          <div className="flex items-center gap-2 text-[13px] text-[#0F1419]/55 py-4">
            <Loader2 className="size-4 animate-spin" /> Redirection…
          </div>
        )}

        {state.kind === 'ready' && (
          <>
            <p className="text-[13px] text-[#0F1419]/65 leading-relaxed">
              Ouvre ton application d'authentification et saisis le code à 6 chiffres généré pour
              KOVAS.
            </p>

            <div className="space-y-2">
              <label
                htmlFor="verify-2fa-code"
                className="block text-[12px] font-medium text-[#0F1419]"
              >
                Code de vérification
              </label>
              <Input
                id="verify-2fa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && state.kind === 'ready') {
                    e.preventDefault()
                    void handleVerify(state.factorId)
                  }
                }}
                className="font-mono tracking-[0.3em] text-center text-[18px]"
                disabled={busy}
              />
            </div>

            <Button
              type="button"
              variant="default"
              size="lg"
              className="w-full"
              onClick={() => handleVerify(state.factorId)}
              disabled={busy || code.length !== 6}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              {busy ? 'Vérification…' : 'Vérifier'}
            </Button>
          </>
        )}

        <form action={onLogout} className="pt-2 border-t border-[#0F1419]/[0.08]">
          <button
            type="submit"
            className="text-[12px] text-[#0F1419]/55 hover:text-[#0F1419] underline underline-offset-2 transition-colors"
          >
            Se déconnecter
          </button>
        </form>
      </Card>
    </div>
  )
}
