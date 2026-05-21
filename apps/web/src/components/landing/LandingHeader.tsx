import { cn } from '@/lib/utils'
import Link from 'next/link'

interface LandingHeaderProps {
  /** Section actuelle pour souligner l'item nav courant. */
  current?: 'features' | 'pricing' | 'faq' | null
}

/**
 * Header marketing partagé entre la home et /pricing.
 *
 * Grammaire visuelle stricte du mockup `docs/design/pricing-mockup.html` :
 *   - sticky top, fond sage 86% + backdrop-blur
 *   - logo lettré KOVAS 360 tracking large
 *   - nav 3 items à droite
 *   - CTA "Essai 30j" pillule chartreuse (l'UN seul accent autorisé du header)
 */
export function LandingHeader({ current = null }: LandingHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-[#F5F7F4]/[0.86] backdrop-blur-xl border-b border-[#0F1419]/[0.08]">
      <div className="max-w-[1240px] mx-auto px-5 sm:px-12 h-14 sm:h-16 flex items-center justify-between text-sm">
        <Link
          href="/"
          className="font-semibold tracking-[0.22em] text-[15px] text-[#0F1419]"
        >
          KOVAS 360
        </Link>

        <nav className="hidden sm:flex gap-8" aria-label="Navigation principale">
          <Link
            href="/#features"
            className={cn(
              'transition-colors',
              current === 'features'
                ? 'text-[#0F1419] font-medium'
                : 'text-[#0F1419]/72 hover:text-[#0F1419]',
            )}
          >
            Fonctionnalités
          </Link>
          <Link
            href="/pricing"
            className={cn(
              'transition-colors',
              current === 'pricing'
                ? 'text-[#0F1419] font-medium'
                : 'text-[#0F1419]/72 hover:text-[#0F1419]',
            )}
            aria-current={current === 'pricing' ? 'page' : undefined}
          >
            Tarifs
          </Link>
          <Link
            href="/faq"
            className={cn(
              'transition-colors',
              current === 'faq'
                ? 'text-[#0F1419] font-medium'
                : 'text-[#0F1419]/72 hover:text-[#0F1419]',
            )}
          >
            FAQ
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-[#0F1419]/72 px-3.5 py-2 hover:text-[#0F1419] transition-colors hidden sm:inline-block"
          >
            Se connecter
          </Link>
          <Link
            href="/signup"
            className="bg-chartreuse text-[#0F1419] px-[18px] py-[9px] rounded-full font-semibold hover:bg-chartreuse-deep transition-colors"
          >
            Essai 30j
          </Link>
        </div>
      </div>
    </header>
  )
}
