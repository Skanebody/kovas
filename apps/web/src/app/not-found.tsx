import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-7xl font-bold tracking-tight">404</div>
        <h1 className="text-xl font-semibold">Page introuvable</h1>
        <p className="text-muted-foreground">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
        <Button asChild>
          <Link href="/">
            <ArrowLeft className="size-4" /> Retour à l'accueil
          </Link>
        </Button>
      </div>
    </div>
  )
}
