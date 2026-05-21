import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface CtaBannerProps {
  eyebrow: string
  title: string
  description?: string
  ctaLabel: string
  ctaHref: string
}

/**
 * Banner CTA final urgence (offre Founder). Fond dark + chartreuse signature v5.
 */
export function CtaBanner({ eyebrow, title, description, ctaLabel, ctaHref }: CtaBannerProps) {
  return (
    <section className="px-6 py-20 md:py-24 bg-sage">
      <div className="mx-auto max-w-5xl">
        <div className="relative rounded-xl bg-[#0F1419] text-paper overflow-hidden p-10 sm:p-14 text-center space-y-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(212,245,66,0.18), transparent 60%)',
            }}
          />
          <p className="relative text-xs font-mono uppercase tracking-wider text-chartreuse">
            {eyebrow}
          </p>
          <h2 className="relative text-3xl sm:text-4xl font-bold tracking-tight">{title}</h2>
          {description && (
            <p className="relative text-base text-paper/70 max-w-2xl mx-auto leading-relaxed">
              {description}
            </p>
          )}
          <div className="relative pt-2">
            <Button size="lg" variant="accent" asChild>
              <Link href={ctaHref}>
                {ctaLabel}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
