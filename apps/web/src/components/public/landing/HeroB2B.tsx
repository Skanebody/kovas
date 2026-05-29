import { Button } from '@/components/ui/button'
import { ArrowRight, CheckCircle2, PlayCircle } from 'lucide-react'
import Link from 'next/link'

/**
 * Hero B2B — SaaS diagnostiqueurs. Design system v5 sage + chartreuse.
 * H1 dramatisé serif italique sur "1h30", 2 CTAs (Essai chartreuse + Démo ghost).
 */
export function HeroB2B() {
  return (
    <section className="relative px-6 py-20 md:py-28 overflow-hidden bg-sage">
      <div className="relative mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
          {/* Texte gauche */}
          <div className="space-y-7">
            <span className="inline-flex items-center gap-2 rounded-pill border border-ink/10 bg-paper/70 px-3 py-1 text-xs font-mono uppercase tracking-wider text-ink-mute">
              Logiciel terrain diagnostiqueurs
            </span>

            <h1 className="font-display font-light text-[40px] sm:text-[52px] md:text-[64px] leading-[1.02] tracking-tight text-[#0F1419]">
              Le logiciel terrain qui fait gagner{' '}
              <span className="font-serif italic font-normal">1h30</span> par mission.
            </h1>

            <p className="text-base sm:text-lg text-ink-soft max-w-xl leading-relaxed">
              Saisie vocale, exports universels, conformité ADEME. Pensé par et pour les
              diagnostiqueurs immobiliers indépendants.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Button size="lg" variant="accent" asChild>
                <Link href="/pricing/checkout?plan=pro&billing=monthly">
                  Démarrer mon essai 30 jours
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <Link href="#video-demo">
                  <PlayCircle className="size-4" />
                  Voir une démo 5 min
                </Link>
              </Button>
            </div>

            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-mute pt-1">
              {[
                '30 jours gratuits',
                'Débit auto après essai',
                'Résiliable à tout moment',
                'Compatible Liciel · OBBC · AnalysImmo',
              ].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-chartreuse-deep" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Visuel app à droite — placeholder stylisé (à remplacer en prod par screenshot réel) */}
          <div
            className="relative aspect-[4/3] rounded-xl bg-[#0F1419] overflow-hidden shadow-lg"
            aria-label="Capture d'écran de l'application KOVAS — placeholder"
          >
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(135deg, #0F1419 0%, #1A2330 60%, #0F1419 100%)',
              }}
            />
            <div className="relative h-full p-6 flex flex-col justify-between">
              {/* Mini "topbar" mock */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#FF5F57]" />
                  <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
                  <span className="size-2.5 rounded-full bg-[#28C840]" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-paper/40">
                  KOVAS · app.kovas.fr
                </span>
              </div>

              {/* "KPI" hero stylé serif italic */}
              <div className="space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-paper/40">
                  Gains du mois
                </p>
                <p className="text-paper">
                  <span className="font-serif italic text-[80px] sm:text-[100px] leading-none text-chartreuse">
                    23h
                  </span>
                  <span className="font-serif italic text-[40px] text-chartreuse/80">
                    {' '}
                    47min
                  </span>
                </p>
                <p className="text-sm text-paper/60">économisées sur 14 missions</p>
              </div>

              {/* Mini "rows" mock pour donner sensation produit */}
              <div className="space-y-2">
                {[
                  { label: 'DPE · 12 rue de Rivoli', time: '14h30', tag: 'En cours' },
                  { label: 'Amiante · 8 av Foch', time: '16h00', tag: 'À démarrer' },
                  { label: 'Carrez · 45 bd Voltaire', time: '17h45', tag: 'Planifié' },
                ].map((r) => (
                  <div
                    key={r.label}
                    className="flex items-center gap-3 rounded-md bg-paper/5 border border-paper/10 px-3 py-2"
                  >
                    <span className="font-mono text-xs text-paper/60 w-12">{r.time}</span>
                    <span className="flex-1 text-xs text-paper/90 truncate">{r.label}</span>
                    <span className="text-[10px] text-chartreuse/80 font-mono uppercase tracking-wider">
                      {r.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
