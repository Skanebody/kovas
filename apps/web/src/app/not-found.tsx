import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6 bg-fluid-light">
      <div className="text-center space-y-6 max-w-md glass-opaque rounded-xl p-10 border border-rule/80">
        <div className="font-display font-light text-display-l tracking-tight text-ink">404</div>
        <h1 className="text-lg font-semibold text-ink">Page introuvable</h1>
        <p className="text-[13px] text-ink-mute">
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>
        <Button asChild variant="warm">
          <Link href="/">
            <ArrowLeft className="size-4" /> Retour à l&apos;accueil
          </Link>
        </Button>
      </div>
    </div>
  )
}
