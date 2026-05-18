import Link from 'next/link'

/**
 * KOVAS — Landing page marketing (kovas.fr/)
 * À enrichir Sprint MVP J2 avec composants Glassmorphism Premium Soft UI.
 */
export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-cta" aria-hidden />
            <span className="text-xl font-semibold tracking-tight">KOVAS</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition"
            >
              Se connecter
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-cta px-4 py-2 text-sm font-medium text-cta-foreground hover:bg-cta-hover transition"
            >
              Essai gratuit 14j
            </Link>
          </div>
        </nav>
      </header>

      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            L'app iPad qui transforme 3h de DPE en 30 minutes.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
            KOVAS est l'app moderne pour les 13 000 diagnostiqueurs immobiliers français.
            <br />
            Saisie vocale, photos, exports universels vers votre logiciel actuel.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="rounded-md bg-cta px-6 py-3 text-base font-medium text-cta-foreground hover:bg-cta-hover transition"
            >
              Essayer 14 jours gratuitement
            </Link>
            <Link
              href="/pourquoi-kovas"
              className="text-base font-medium text-muted-foreground hover:text-foreground transition"
            >
              Pourquoi KOVAS →
            </Link>
          </div>
          <p className="mt-4 text-sm text-subtle-foreground">
            Sans carte bancaire · 8 diagnostics couverts · Exports universels
          </p>
        </div>
      </section>

      <footer className="container mx-auto px-4 py-12 border-t border-border">
        <div className="flex flex-col items-center gap-4 text-sm text-subtle-foreground md:flex-row md:justify-between">
          <p>
            © 2026 SASU Nexus 1993 · 66 Av Champs Elysées, 75008 Paris · SIREN 982 786 154
          </p>
          <div className="flex gap-6">
            <Link href="/mentions-legales" className="hover:text-foreground transition">
              Mentions légales
            </Link>
            <Link href="/cgu" className="hover:text-foreground transition">
              CGU
            </Link>
            <Link href="/confidentialite" className="hover:text-foreground transition">
              Confidentialité
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
