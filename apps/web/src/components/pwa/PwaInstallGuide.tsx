'use client'

/**
 * KOVAS — Guide d'installation PWA "n'importe qui le fait".
 *
 * Montré à l'onboarding (dès la création du compte) et accessible depuis le
 * centre d'aide (`/dashboard/aide/installer-l-application`).
 *
 * KOVAS est une PWA : pas de store, installation directe depuis le navigateur.
 * Ce composant détecte l'appareil au montage et affiche le bon parcours :
 *   - iOS (Safari)  : étapes illustrées (pas d'install programmatique sur iOS)
 *   - Android       : vrai bouton natif via l'event `beforeinstallprompt`
 *   - Desktop       : QR code à scanner avec le téléphone
 *   - Déjà installée : état de succès
 *
 * Tutoiement strict (cohérence app), ton rassurant et concret.
 * Design system v5 : sage `#F5F7F4`, navy `#0F1419`, accent chartreuse `#D4F542`.
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  CheckCircle2,
  Download,
  Monitor,
  MoreVertical,
  Plus,
  Share,
  Smartphone,
  SquarePlus,
  WifiOff,
} from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Event non encore typé dans lib.dom (Chromium-only). On le déclare ici plutôt
 * que d'utiliser `any`, pour garder TS strict.
 * @see https://developer.mozilla.org/docs/Web/API/BeforeInstallPromptEvent
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt: () => Promise<void>
}

/** `navigator.standalone` est une extension iOS non standard (pas dans lib.dom). */
interface IosNavigator extends Navigator {
  readonly standalone?: boolean
}

type DeviceKind = 'loading' | 'installed' | 'ios-safari' | 'ios-other' | 'android' | 'desktop'

interface PwaInstallGuideProps {
  /** URL de l'app vers laquelle pointe le QR code desktop (ex. https://kovas.fr/dashboard/dashboard). */
  readonly appUrl: string
  /** QR code SVG pré-généré côté serveur (lib `qrcode`). `null` si la génération a échoué. */
  readonly qrSvg: string | null
}

function detectDevice(): DeviceKind {
  if (typeof window === 'undefined') return 'loading'

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as IosNavigator).standalone === true
  if (standalone) return 'installed'

  const ua = window.navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua)
  // iPadOS 13+ se présente comme un Mac : on détecte le tactile pour rattraper.
  const isIpadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1

  if (isIos || isIpadOs) {
    // Sur iOS, seul Safari peut installer (CriOS = Chrome, FxiOS = Firefox,
    // EdgiOS = Edge — tous basés sur WebKit mais sans l'option d'installation).
    const isSafari = !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua)
    return isSafari ? 'ios-safari' : 'ios-other'
  }

  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

export function PwaInstallGuide({ appUrl, qrSvg }: PwaInstallGuideProps) {
  const [device, setDevice] = useState<DeviceKind>('loading')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installState, setInstallState] = useState<'idle' | 'prompting' | 'accepted' | 'dismissed'>(
    'idle',
  )

  useEffect(() => {
    setDevice(detectDevice())

    // Android/Chromium : on capture l'event pour déclencher l'install au clic.
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    // Si l'app vient d'être installée, on bascule sur l'état de succès.
    const onAppInstalled = () => {
      setInstallState('accepted')
      setDevice('installed')
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  async function handleAndroidInstall() {
    if (!deferredPrompt) return
    setInstallState('prompting')
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setInstallState(choice.outcome)
    // L'event ne peut être réutilisé qu'une fois.
    setDeferredPrompt(null)
  }

  return (
    <div className="space-y-5">
      <Reassurance />

      {device === 'loading' ? <SkeletonState /> : null}
      {device === 'installed' ? <InstalledState /> : null}
      {device === 'ios-safari' ? <IosSafariSteps /> : null}
      {device === 'ios-other' ? <IosOtherBrowserWarning /> : null}
      {device === 'android' ? (
        <AndroidGuide
          canInstall={deferredPrompt !== null}
          installState={installState}
          onInstall={handleAndroidInstall}
        />
      ) : null}
      {device === 'desktop' ? <DesktopGuide appUrl={appUrl} qrSvg={qrSvg} /> : null}
    </div>
  )
}

/* ----------------------------- Sous-composants ---------------------------- */

function Reassurance() {
  return (
    <div className="flex flex-wrap gap-2">
      <Pill icon={<Download className="size-3.5" aria-hidden />}>15 secondes</Pill>
      <Pill icon={<CheckCircle2 className="size-3.5" aria-hidden />}>Gratuit</Pill>
      <Pill icon={<Smartphone className="size-3.5" aria-hidden />}>Pas besoin du store</Pill>
      <Pill icon={<WifiOff className="size-3.5" aria-hidden />}>Fonctionne hors-ligne</Pill>
    </div>
  )
}

function Pill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-sage-alt/60 px-3 py-1.5 text-[12px] font-medium text-ink">
      <span className="text-ink/70">{icon}</span>
      {children}
    </span>
  )
}

function SkeletonState() {
  return (
    <Card variant="flat" padding="default" aria-busy="true">
      <p className="text-[13px] text-ink-mute">Détection de ton appareil…</p>
    </Card>
  )
}

function InstalledState() {
  return (
    <Card variant="flat" padding="default" className="space-y-2">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-5 text-[#34C759]" aria-hidden />
        <h2 className="text-[16px] font-semibold text-ink">KOVAS est déjà installée</h2>
      </div>
      <p className="text-[13px] text-ink-soft leading-relaxed">
        Tu utilises déjà KOVAS en mode application sur cet appareil. Rien à faire — tu peux la
        retrouver sur ton écran d&apos;accueil, même sans réseau.
      </p>
    </Card>
  )
}

/** Une étape illustrée, grosse et numérotée (lisible sur téléphone). */
function StepRow({
  n,
  icon,
  title,
  children,
}: {
  n: number
  icon?: React.ReactNode
  title: string
  children?: React.ReactNode
}) {
  return (
    <li className="flex gap-4 items-start">
      <span
        className="shrink-0 size-10 rounded-full bg-[#0F1419] text-[#D4F542] flex items-center justify-center text-[16px] font-semibold"
        aria-hidden
      >
        {n}
      </span>
      <div className="flex-1 space-y-1 pt-0.5">
        <div className="flex items-center gap-2">
          {icon ? (
            <span
              className="inline-flex size-7 items-center justify-center rounded-full bg-sage-alt/70 text-ink shrink-0"
              aria-hidden
            >
              {icon}
            </span>
          ) : null}
          <h3 className="text-[15px] font-semibold text-ink leading-snug">{title}</h3>
        </div>
        {children ? <p className="text-[13px] text-ink-soft leading-relaxed">{children}</p> : null}
      </div>
    </li>
  )
}

function IosSafariSteps() {
  return (
    <Card variant="flat" padding="default" className="space-y-5">
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Sur iPhone / iPad
        </p>
        <h2 className="text-[18px] font-semibold text-ink">Ajoute KOVAS en 4 touchers</h2>
      </div>
      <ol className="space-y-5">
        <StepRow n={1} icon={<Share className="size-4" aria-hidden />} title="Appuie sur Partager">
          C&apos;est la petite icône carrée avec une flèche vers le haut, en bas de Safari.
        </StepRow>
        <StepRow
          n={2}
          icon={<SquarePlus className="size-4" aria-hidden />}
          title={'Appuie sur « Sur l’écran d’accueil »'}
        >
          Fais défiler la liste vers le bas si tu ne la vois pas tout de suite.
        </StepRow>
        <StepRow
          n={3}
          icon={<Plus className="size-4" aria-hidden />}
          title={'Appuie sur « Ajouter » en haut à droite'}
        >
          Tu peux laisser le nom « KOVAS » tel quel.
        </StepRow>
        <StepRow
          n={4}
          icon={<CheckCircle2 className="size-4 text-[#34C759]" aria-hidden />}
          title="C'est fait !"
        >
          L&apos;icône KOVAS est sur ton écran d&apos;accueil. Ouvre-la pour travailler comme une
          vraie app, même sans réseau.
        </StepRow>
      </ol>
    </Card>
  )
}

function IosOtherBrowserWarning() {
  return (
    <Card variant="warm" padding="default" className="space-y-2">
      <h2 className="text-[16px] font-semibold text-ink">Ouvre KOVAS dans Safari</h2>
      <p className="text-[13px] text-ink-soft leading-relaxed">
        Sur iPhone et iPad, l&apos;installation ne marche que depuis <strong>Safari</strong> (le
        navigateur d&apos;Apple). Ouvre <strong>kovas.fr</strong> dans Safari, puis reviens sur
        cette page : on t&apos;affichera les 4 touchers à faire.
      </p>
    </Card>
  )
}

function AndroidGuide({
  canInstall,
  installState,
  onInstall,
}: {
  canInstall: boolean
  installState: 'idle' | 'prompting' | 'accepted' | 'dismissed'
  onInstall: () => void
}) {
  if (installState === 'accepted') {
    return <InstalledState />
  }

  return (
    <Card variant="flat" padding="default" className="space-y-5">
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Sur Android
        </p>
        <h2 className="text-[18px] font-semibold text-ink">Installe KOVAS en 1 toucher</h2>
      </div>

      {canInstall ? (
        <>
          <Button
            type="button"
            variant="accent"
            size="lg"
            className="w-full"
            onClick={onInstall}
            disabled={installState === 'prompting'}
          >
            <Download className="size-4" aria-hidden />
            {installState === 'prompting' ? 'Installation…' : 'Installer KOVAS maintenant'}
          </Button>
          {installState === 'dismissed' ? (
            <p className="text-[13px] text-ink-soft leading-relaxed">
              Tu as annulé l&apos;installation. Pas de souci — tu peux réessayer en touchant le
              bouton ci-dessus, ou plus tard depuis le menu de ton navigateur.
            </p>
          ) : (
            <p className="text-[13px] text-ink-soft leading-relaxed">
              Ton téléphone va te demander de confirmer. Touche <strong>Installer</strong> : KOVAS
              apparaît aussitôt sur ton écran d&apos;accueil.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-[13px] text-ink-soft leading-relaxed">
            Si tu ne vois pas de bouton d&apos;installation automatique, fais-le à la main en 2
            touchers :
          </p>
          <ol className="space-y-5">
            <StepRow
              n={1}
              icon={<MoreVertical className="size-4" aria-hidden />}
              title={'Ouvre le menu ⋮'}
            >
              Le menu à trois points, en haut à droite de Chrome ou Edge.
            </StepRow>
            <StepRow
              n={2}
              icon={<Download className="size-4" aria-hidden />}
              title={'Appuie sur « Installer l’application »'}
            >
              Selon ton téléphone, ça peut s&apos;appeler «&nbsp;Ajouter à l&apos;écran
              d&apos;accueil&nbsp;». Confirme, et c&apos;est fait.
            </StepRow>
          </ol>
        </>
      )}
    </Card>
  )
}

function DesktopGuide({ appUrl, qrSvg }: { appUrl: string; qrSvg: string | null }) {
  return (
    <Card variant="flat" padding="default" className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Monitor className="size-4 text-ink/70" aria-hidden />
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
            Tu es sur ordinateur
          </p>
        </div>
        <h2 className="text-[18px] font-semibold text-ink">
          Installe l&apos;app sur ton téléphone
        </h2>
      </div>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-6">
        {qrSvg ? (
          <div
            className="rounded-xl bg-white p-3 border border-[#0F1419]/[0.08] shadow-glass-sm shrink-0 [&>svg]:block [&>svg]:size-[180px]"
            aria-label="QR code vers l'application KOVAS"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG généré côté serveur par la lib qrcode à partir d'une URL maîtrisée (aucune entrée utilisateur), pas de risque XSS.
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        ) : null}
        <div className="space-y-2 text-center sm:text-left">
          <p className="text-[13px] text-ink-soft leading-relaxed">
            Scanne ce QR code avec l&apos;appareil photo de ton téléphone, puis suis les étapes
            d&apos;installation qui s&apos;affichent.
          </p>
          <p className="text-[12px] text-ink-mute leading-relaxed">
            Pas de QR&nbsp;? Ouvre cette adresse sur ton téléphone :
            <br />
            <a
              href={appUrl}
              className="font-mono text-[12px] text-ink underline underline-offset-4 break-all"
            >
              {appUrl}
            </a>
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-sage-alt/40 px-4 py-3">
        <p className="text-[12px] text-ink-soft leading-relaxed">
          Tu peux aussi installer KOVAS sur ce Mac ou ce PC : dans Chrome ou Edge, clique sur
          l&apos;icône d&apos;installation <Download className="inline size-3.5" aria-hidden /> à
          droite de la barre d&apos;adresse.
        </p>
      </div>
    </Card>
  )
}
