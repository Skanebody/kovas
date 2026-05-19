import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6 bg-fluid-light">
      <div className="text-center space-y-6 max-w-md glass-opaque rounded-xl p-10 border border-rule/80">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">Erreur 404</p>
        <h1 className="font-serif italic font-normal text-5xl md:text-6xl tracking-tight text-ink leading-[1.05]">
          Page introuvable.
        </h1>
        <p className="text-[14px] text-ink-mute">
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>
        <Button asChild variant="accent">
          <Link href="/">
            <ArrowLeft className="size-4" /> Retour à l&apos;accueil
          </Link>
        </Button>
      </div>
    </div>
  )
}
