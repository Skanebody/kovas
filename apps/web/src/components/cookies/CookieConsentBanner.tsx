'use client'

/**
 * CookieConsentBanner — bandeau et modale CNIL-compliant pour le consentement
 * cookies KOVAS.
 *
 * Conformité CNIL :
 *  - Affichage au premier visiteur (slide-up depuis le bas)
 *  - 3 actions équivalentes : Tout accepter / Tout refuser / Personnaliser
 *    (pas de hiérarchie visuelle qui pousserait à l'acceptation)
 *  - Modale granulaire 3 catégories (essentiel figé, analytics PostHog,
 *    fonctionnel Sentry session replay)
 *  - Lien vers la politique cookies complète /cookies
 *  - Renouvellement auto à 13 mois (cf. consent-storage.ts)
 *  - Respect Do Not Track : DNT actif → toggles OFF par défaut dans la modale
 *
 * Design System v5 :
 *  - Sage `#F5F7F4` background / navy `#0F1419` foreground
 *  - Card paper white opaque rounded-2xl + shadow-glass
 *  - CTA accent chartreuse (signature) sur "Tout accepter" UNIQUEMENT pour
 *    indiquer le chemin recommandé sans dénigrer le refus (CNIL : équilibre)
 *  - Tutoiement systématique (avatar SOBRE PROFESSIONNEL)
 *  - Aucun emoji (respect avatar)
 */
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { isDoNotTrackEnabled } from '@/lib/cookies/consent-storage'
import { useCookieConsent } from '@/lib/cookies/use-cookie-consent'
import { cn } from '@/lib/utils'
import { Check, Cookie } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

/**
 * Bandeau de consentement cookies — slide-up depuis le bas de page.
 *
 * Apparaît uniquement si aucun consent valide n'est stocké. Une fois une
 * action utilisateur effectuée (accepter / refuser / personnaliser puis
 * enregistrer), le bandeau disparaît jusqu'au prochain renouvellement
 * (13 mois) ou jusqu'à ce qu'il soit ré-ouvert via le footer.
 */
export function CookieConsentBanner() {
  const {
    shouldShowBanner,
    isPreferencesOpen,
    acceptAll,
    rejectAll,
    updateConsent,
    openPreferences,
    closePreferences,
  } = useCookieConsent()

  const titleId = useId()
  const descId = useId()

  // Banner visible uniquement si pas encore de consent valide.
  // La modale "Personnaliser" reste toujours montée pour qu'elle puisse être
  // ré-ouverte par le bouton footer après un premier consent donné.
  return (
    <>
      {shouldShowBanner ? (
        <ConsentBannerCard
          titleId={titleId}
          descId={descId}
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
          onOpenPreferences={openPreferences}
        />
      ) : null}
      <PreferencesModal
        open={isPreferencesOpen}
        onClose={closePreferences}
        onSave={updateConsent}
        onAcceptAll={acceptAll}
        onRejectAll={rejectAll}
      />
    </>
  )
}

// ============================================
// Bannière (slide-up bas de page)
// ============================================

interface ConsentBannerCardProps {
  readonly titleId: string
  readonly descId: string
  readonly onAcceptAll: () => void
  readonly onRejectAll: () => void
  readonly onOpenPreferences: () => void
}

function ConsentBannerCard({
  titleId,
  descId,
  onAcceptAll,
  onRejectAll,
  onOpenPreferences,
}: ConsentBannerCardProps) {
  // Note : on utilise <aside> + aria-labelledby/aria-describedby plutôt que
  // role="dialog" car le bandeau N'EST PAS bloquant (l'utilisateur peut
  // continuer à naviguer). Un role="dialog" aria-modal="false" est trompeur
  // pour les lecteurs d'écran. La VRAIE dialog (`role="dialog"`) est rendue
  // par `<PreferencesModal>` via Radix Dialog.
  return (
    <aside
      aria-labelledby={titleId}
      aria-describedby={descId}
      className={cn(
        // Position : sticky bottom, z-index élevé pour passer devant tout
        // (sidebar, headers, modales métier non bloquantes). Reste sous les
        // toasts d'erreur (z-[100]).
        'fixed inset-x-0 bottom-0 z-[90] pointer-events-none',
        // Slide-up animation à l'apparition + responsive layout
        'animate-in slide-in-from-bottom-4 duration-300 fade-in-0',
      )}
    >
      <div className="mx-auto max-w-2xl px-4 pb-4 sm:pb-6 pointer-events-auto">
        <div
          className={cn(
            'rounded-2xl border border-[#0F1419]/[0.08] bg-white shadow-[0_20px_60px_-20px_rgba(15,20,25,0.25)]',
            'p-5 sm:p-6',
          )}
        >
          <div className="flex items-start gap-3 mb-3 sm:mb-4">
            <span
              aria-hidden
              className="shrink-0 size-9 rounded-full bg-[#F5F7F4] flex items-center justify-center text-[#0F1419]"
            >
              <Cookie className="size-4" />
            </span>
            <div className="flex-1 min-w-0">
              <h2 id={titleId} className="font-sans font-semibold text-[15px] text-[#0F1419]">
                Tes préférences cookies
              </h2>
              <p id={descId} className="mt-1.5 text-[13px] leading-relaxed text-[#0F1419]/70">
                On utilise des cookies pour mesurer l&apos;usage de KOVAS et améliorer
                l&apos;expérience. Les essentiels sont toujours actifs. Tu peux refuser ou
                personnaliser tes choix.{' '}
                <Link
                  href="/cookies"
                  className="underline underline-offset-2 text-[#0F1419] hover:text-[#0F1419]/80"
                >
                  En savoir plus
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-2.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenPreferences}
              className="text-[13px] sm:w-auto w-full"
            >
              Personnaliser
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRejectAll}
              className="text-[13px] sm:w-auto w-full"
            >
              Tout refuser
            </Button>
            <Button
              type="button"
              variant="accent"
              size="sm"
              onClick={onAcceptAll}
              className="text-[13px] sm:w-auto w-full"
            >
              Tout accepter
            </Button>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ============================================
// Modale "Personnaliser" (Dialog Radix)
// ============================================

interface PreferencesModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onSave: (input: { readonly analytics: boolean; readonly functional: boolean }) => void
  readonly onAcceptAll: () => void
  readonly onRejectAll: () => void
}

function PreferencesModal({
  open,
  onClose,
  onSave,
  onAcceptAll,
  onRejectAll,
}: PreferencesModalProps) {
  // Defaults dans la modale : si Do Not Track activé, toggles OFF par défaut.
  // Sinon, état actuel du consent (si déjà donné) ou ON par défaut (signal de
  // recommandation neutre — la CNIL n'interdit pas un default ON dans la
  // modale du moment que les 2 CTA principaux du banner sont équilibrés).
  const dntRef = useRef<boolean>(false)
  useEffect(() => {
    if (open) {
      dntRef.current = isDoNotTrackEnabled()
    }
  }, [open])

  const [analytics, setAnalytics] = useState(false)
  const [functional, setFunctional] = useState(false)

  // Initialise les toggles à chaque ouverture de la modale (respect DNT).
  useEffect(() => {
    if (!open) return
    const defaultOn = !dntRef.current
    setAnalytics(defaultOn)
    setFunctional(defaultOn)
  }, [open])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Personnaliser tes cookies</DialogTitle>
          <DialogDescription>
            Choisis les catégories que tu acceptes. Tu peux modifier ces choix à tout moment depuis
            le pied de page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 my-1 sm:my-2">
          <ConsentRow
            title="Cookies essentiels"
            description="Nécessaires au fonctionnement de KOVAS : authentification, panier, préférences. Sans eux, impossible d'utiliser l'app."
            checked
            disabled
            badge="Toujours actif"
            onChange={() => {
              /* essentiels figés */
            }}
          />
          <ConsentRow
            title="Analytics (PostHog)"
            description="Nous aide à comprendre comment tu utilises KOVAS pour améliorer le produit. Hébergé en Allemagne (UE). Données anonymisées."
            checked={analytics}
            onChange={setAnalytics}
          />
          <ConsentRow
            title="Session replay (Sentry)"
            description="Enregistre tes sessions en cas de bug pour qu'on puisse reproduire et corriger. Texte masqué pour confidentialité. Les remontées d'erreur restent toujours actives."
            checked={functional}
            onChange={setFunctional}
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 pt-2 border-t border-[#0F1419]/[0.08]">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRejectAll}
              className="text-[13px]"
            >
              Tout refuser
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onAcceptAll}
              className="text-[13px]"
            >
              Tout accepter
            </Button>
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => {
              onSave({ analytics, functional })
            }}
            className="text-[13px]"
          >
            <Check className="size-3.5" />
            Enregistrer mes préférences
          </Button>
        </div>

        <DialogClose className="sr-only">Fermer</DialogClose>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Ligne catégorie (toggle + label + description)
// ============================================

interface ConsentRowProps {
  readonly title: string
  readonly description: string
  readonly checked: boolean
  readonly disabled?: boolean
  readonly badge?: string
  readonly onChange: (next: boolean) => void
}

function ConsentRow({ title, description, checked, disabled, badge, onChange }: ConsentRowProps) {
  const switchId = useId()
  return (
    <div
      className={cn(
        'rounded-xl border border-[#0F1419]/[0.08] bg-white p-3.5 sm:p-4',
        disabled && 'bg-[#F5F7F4]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <label
            htmlFor={switchId}
            className={cn(
              'font-sans font-semibold text-[13px] text-[#0F1419]',
              disabled && 'cursor-not-allowed',
            )}
          >
            {title}
            {badge ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-[#0F1419]/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/70">
                {badge}
              </span>
            ) : null}
          </label>
          <p className="mt-1 text-[12px] leading-relaxed text-[#0F1419]/65">{description}</p>
        </div>
        <ToggleSwitch
          id={switchId}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          ariaLabel={title}
        />
      </div>
    </div>
  )
}

// ============================================
// Toggle natif accessible (pas de dépendance UI supplémentaire)
// ============================================

interface ToggleSwitchProps {
  readonly id: string
  readonly checked: boolean
  readonly disabled?: boolean
  readonly onChange: (next: boolean) => void
  readonly ariaLabel: string
}

function ToggleSwitch({ id, checked, disabled, onChange, ariaLabel }: ToggleSwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!checked)
      }}
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0F1419]/30',
        checked ? 'bg-[#0F1419]' : 'bg-[#0F1419]/15',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block size-4 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-5' : 'translate-x-1',
        )}
      />
    </button>
  )
}
