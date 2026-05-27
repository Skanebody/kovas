import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'

/**
 * Page publique « Politique de divulgation responsable » (Responsible Disclosure).
 *
 * Référencée par `apps/web/public/.well-known/security.txt` (RFC 9116).
 *
 * Volontairement self-contained (pas un `LegalDocument` markdown) : le contenu est
 * court, technique et amené à évoluer indépendamment du pack juridique commercial.
 * Le visuel reprend toutefois la grille du `LegalRouteShell` (header sticky sage,
 * Instrument Serif italic pour le H1, Manrope corps, JetBrains Mono labels) pour
 * rester cohérent avec /cgu, /cgv, /mentions-legales.
 *
 * Ton : tutoiement (avatar KOVAS), DS v5, sobre, vocabulaire métier sécurité.
 */
export const metadata: Metadata = {
  title: 'Politique de divulgation responsable',
  description:
    'Politique de divulgation responsable (responsible disclosure) KOVAS — comment signaler une vulnérabilité de sécurité, périmètre couvert, délais de réponse et Hall of Fame des chercheurs.',
  alternates: { canonical: '/security-policy' },
  robots: { index: true, follow: true },
}

const SECURITY_CONTACT = 'contact@kovas.fr'
const SECURITY_SUBJECT_PREFIX = '[SECURITY]'
const COORDINATED_DISCLOSURE_DAYS = 90

const TOC_ITEMS = [
  { anchor: 'engagement', text: '1. Notre engagement' },
  { anchor: 'perimetre', text: '2. Périmètre' },
  { anchor: 'signalement', text: '3. Comment signaler' },
  { anchor: 'recompenses', text: '4. Reconnaissance et récompenses' },
  { anchor: 'disclosure', text: '5. Divulgation coordonnée (90 jours)' },
  { anchor: 'acceptes', text: '6. Comportements acceptés' },
  { anchor: 'interdits', text: '7. Comportements interdits' },
  { anchor: 'safe-harbor', text: '8. Safe Harbor juridique' },
  { anchor: 'sla', text: '9. Délais de réponse (SLA)' },
] as const

export default function SecurityPolicyPage() {
  return (
    <div className="flex flex-col min-h-dvh">
      <header className="sticky top-0 z-30 bg-[#F5F7F4]/[0.86] backdrop-blur-xl border-b border-[#0F1419]/[0.08]">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-[0.22em] text-[15px] text-[#0F1419]">
            KOVAS
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" className="text-[13px]">
              <ArrowLeft className="size-4" aria-hidden="true" /> Accueil
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[1240px] px-5 sm:px-8 py-10 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-10">
          {/* TOC sticky desktop / repliable mobile */}
          <aside className="md:sticky md:top-24 md:self-start order-2 md:order-1">
            <details className="md:open:contents" open>
              <summary className="md:hidden cursor-pointer font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-2">
                Table des matières
              </summary>
              <nav aria-label="Table des matières">
                <p className="hidden md:block font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-3">
                  Sommaire
                </p>
                <ol className="space-y-1.5 text-[13px] leading-snug">
                  {TOC_ITEMS.map((entry) => (
                    <li key={entry.anchor}>
                      <a
                        href={`#${entry.anchor}`}
                        className="text-[#0F1419]/70 hover:text-[#0F1419] hover:underline underline-offset-4 transition-colors"
                      >
                        {entry.text}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </details>
          </aside>

          {/* Corps du document */}
          <article className="order-1 md:order-2 max-w-3xl">
            <header className="mb-8 space-y-3">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Sécurité KOVAS · responsible disclosure · v1.0
              </p>
              <h1 className="font-serif italic text-4xl md:text-5xl tracking-tight leading-[1.1] text-[#0F1419]">
                politique de divulgation responsable.
              </h1>
              <p className="text-[15px] leading-relaxed text-[#0F1419]/75 max-w-2xl">
                La sécurité de la plateforme et des données de diagnostic immobilier que tu nous
                confies est une priorité non négociable. Si tu identifies une vulnérabilité, on veut
                en discuter sereinement avec toi.
              </p>
            </header>

            <div className="space-y-10 text-[15px] leading-relaxed text-[#0F1419]/85">
              <section id="engagement">
                <h2 className="font-sans font-bold text-2xl text-[#0F1419] mb-3">
                  1. Notre engagement
                </h2>
                <p>
                  KOVAS est édité par SASU {COMPANY_IDENTITY.legalName} (SIREN{' '}
                  {COMPANY_IDENTITY.sirenFormatted}). Nous traitons les rapports de sécurité avec
                  sérieux et confidentialité. Tu ne seras jamais poursuivi pour une démarche de
                  recherche de bonne foi qui respecte cette politique.
                </p>
              </section>

              <section id="perimetre">
                <h2 className="font-sans font-bold text-2xl text-[#0F1419] mb-3">2. Périmètre</h2>
                <p className="mb-3">Sont couverts par cette politique :</p>
                <ul className="list-disc pl-6 space-y-1.5">
                  <li>
                    <code className="font-mono text-[13px] bg-[#0F1419]/[0.05] px-1.5 py-0.5 rounded-sm">
                      kovas.fr
                    </code>{' '}
                    et tous ses sous-domaines (incluant{' '}
                    <code className="font-mono text-[13px] bg-[#0F1419]/[0.05] px-1.5 py-0.5 rounded-sm">
                      app.kovas.fr
                    </code>
                    )
                  </li>
                  <li>L&apos;application web (PWA) accessible depuis ces domaines</li>
                  <li>Les API publiques documentées sur /api-publique</li>
                  <li>Les emails transactionnels envoyés depuis @kovas.fr</li>
                </ul>
                <p className="mt-3">
                  Sont <strong>hors périmètre</strong> : les services tiers (Stripe, Supabase,
                  Vercel, Sentry…), les domaines partenaires, et les versions de dépendances dont
                  une CVE publique est déjà signalée et en cours de patch.
                </p>
              </section>

              <section id="signalement">
                <h2 className="font-sans font-bold text-2xl text-[#0F1419] mb-3">
                  3. Comment signaler
                </h2>
                <p className="mb-3">
                  Envoie un email à{' '}
                  <a
                    href={`mailto:${SECURITY_CONTACT}?subject=${encodeURIComponent(`${SECURITY_SUBJECT_PREFIX} Vulnérabilité`)}`}
                    className="font-mono text-[14px] underline underline-offset-4 hover:text-[#0F1419]"
                  >
                    {SECURITY_CONTACT}
                  </a>{' '}
                  avec le préfixe{' '}
                  <code className="font-mono text-[13px] bg-[#0F1419]/[0.05] px-1.5 py-0.5 rounded-sm">
                    {SECURITY_SUBJECT_PREFIX}
                  </code>{' '}
                  dans le sujet. Inclus :
                </p>
                <ul className="list-disc pl-6 space-y-1.5">
                  <li>Description précise de la vulnérabilité</li>
                  <li>Étapes de reproduction (PoC reproductible &lt; 5 min idéalement)</li>
                  <li>
                    Impact estimé (confidentialité, intégrité, disponibilité, conformité RGPD)
                  </li>
                  <li>Captures, logs, requêtes HTTP utiles</li>
                  <li>Pseudonyme ou nom réel pour le Hall of Fame (optionnel)</li>
                </ul>
                <p className="mt-3 text-[13px] text-[#0F1419]/60">
                  Une clé PGP pourra être publiée sur{' '}
                  <code className="font-mono">/.well-known/pgp-key.asc</code> à la demande.
                </p>
              </section>

              <section id="recompenses">
                <h2 className="font-sans font-bold text-2xl text-[#0F1419] mb-3">
                  4. Reconnaissance et récompenses
                </h2>
                <p>
                  KOVAS n&apos;exploite pas encore de programme bug bounty rémunéré. Les chercheurs
                  qui contribuent significativement bénéficient toutefois de :
                </p>
                <ul className="list-disc pl-6 mt-3 space-y-1.5">
                  <li>
                    Une mention publique dans notre{' '}
                    <Link
                      href="/security/thanks"
                      className="underline underline-offset-4 hover:text-[#0F1419]"
                    >
                      Hall of Fame /security/thanks
                    </Link>{' '}
                    (avec ton accord)
                  </li>
                  <li>Une lettre de référence signée par le fondateur</li>
                  <li>
                    Un abonnement KOVAS Pro offert 12 mois si tu es diagnostiqueur certifié ou en
                    formation
                  </li>
                  <li>
                    Un programme bug bounty rémunéré est envisagé à partir de M18 (cf. roadmap
                    sécurité)
                  </li>
                </ul>
              </section>

              <section id="disclosure">
                <h2 className="font-sans font-bold text-2xl text-[#0F1419] mb-3">
                  5. Divulgation coordonnée ({COORDINATED_DISCLOSURE_DAYS} jours)
                </h2>
                <p>
                  Nous appliquons une fenêtre de divulgation coordonnée par défaut de{' '}
                  <strong>{COORDINATED_DISCLOSURE_DAYS} jours</strong> à compter de l&apos;accusé de
                  réception du rapport. Cette durée peut être :
                </p>
                <ul className="list-disc pl-6 mt-3 space-y-1.5">
                  <li>
                    <strong>Raccourcie</strong> si nous avons publié un patch et confirmé la
                    correction avant l&apos;échéance
                  </li>
                  <li>
                    <strong>Prolongée</strong> d&apos;un commun accord pour les vulnérabilités
                    profondes (cryptographie, supply chain) nécessitant un travail conjoint avec un
                    upstream
                  </li>
                </ul>
                <p className="mt-3">
                  Tu es libre de publier ton compte-rendu après l&apos;échéance, en mentionnant
                  KOVAS comme partenaire si tu le souhaites.
                </p>
              </section>

              <section id="acceptes">
                <h2 className="font-sans font-bold text-2xl text-[#0F1419] mb-3">
                  6. Comportements acceptés
                </h2>
                <ul className="list-disc pl-6 space-y-1.5">
                  <li>Recherche de vulnérabilités OWASP Top 10 (injection, SSRF, IDOR, XSS…)</li>
                  <li>
                    Test de fuites de données personnelles (RGPD), de bypass d&apos;authentification
                    ou d&apos;autorisation, de tenant cross-leak
                  </li>
                  <li>
                    Tests sur des comptes de test que tu créés toi-même (avec ton propre SIRET ou un
                    SIRET de test)
                  </li>
                  <li>
                    Analyse statique du code public (JS bundles, source maps publiées
                    accidentellement, etc.)
                  </li>
                  <li>
                    Analyse des en-têtes HTTP, CSP, CORS, cookies, configurations TLS/DNS, mauvaise
                    configuration cloud
                  </li>
                </ul>
              </section>

              <section id="interdits">
                <h2 className="font-sans font-bold text-2xl text-[#0F1419] mb-3">
                  7. Comportements interdits
                </h2>
                <p className="mb-3">
                  Pour préserver l&apos;intégrité du service et la sécurité des autres utilisateurs,
                  les comportements suivants sont strictement interdits :
                </p>
                <ul className="list-disc pl-6 space-y-1.5">
                  <li>
                    Tests intrusifs sur la production sans permission écrite préalable (scan
                    automatisé agressif, fuzzing brutal, brute-force)
                  </li>
                  <li>
                    <strong>Social engineering</strong> du support, du fondateur, de partenaires ou
                    d&apos;utilisateurs (phishing, vishing, smishing)
                  </li>
                  <li>
                    <strong>Attaques DDoS</strong> ou tests de charge non coordonnés
                  </li>
                  <li>
                    Accès, lecture, modification ou copie de données appartenant à des utilisateurs
                    tiers (diagnostiqueurs, propriétaires, ADEME, etc.)
                  </li>
                  <li>
                    Exploitation de la vulnérabilité au-delà de la preuve de concept strictement
                    nécessaire
                  </li>
                  <li>Publication publique de la vulnérabilité avant la fenêtre coordonnée</li>
                  <li>Demande de rançon ou extorsion</li>
                </ul>
              </section>

              <section id="safe-harbor">
                <h2 className="font-sans font-bold text-2xl text-[#0F1419] mb-3">
                  8. Safe Harbor juridique
                </h2>
                <p>
                  KOVAS s&apos;engage à ne pas engager d&apos;action en justice (civile ou pénale)
                  ni à coopérer activement avec des poursuites tierces, contre tout chercheur qui
                  respecte intégralement cette politique. Cette clause vaut renonciation spécifique
                  aux articles 323-1 à 323-3 du Code pénal pour les actes accomplis de bonne foi
                  dans le cadre du périmètre déclaré.
                </p>
                <p className="mt-3 text-[13px] text-[#0F1419]/60">
                  Cette renonciation ne s&apos;étend ni aux comportements interdits listés
                  ci-dessus, ni aux atteintes aux données d&apos;utilisateurs tiers.
                </p>
              </section>

              <section id="sla">
                <h2 className="font-sans font-bold text-2xl text-[#0F1419] mb-3">
                  9. Délais de réponse (SLA)
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-[14px] border-collapse">
                    <thead>
                      <tr className="border-b border-[#0F1419]/15">
                        <th className="text-left font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 py-2 pr-4">
                          Sévérité
                        </th>
                        <th className="text-left font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 py-2 pr-4">
                          Accusé de réception
                        </th>
                        <th className="text-left font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 py-2">
                          Patch ou mitigation
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-[#0F1419]/10">
                        <td className="py-2.5 pr-4 font-semibold">Critique (RCE, leak massif)</td>
                        <td className="py-2.5 pr-4">&lt; 24h</td>
                        <td className="py-2.5">&lt; 7 jours</td>
                      </tr>
                      <tr className="border-b border-[#0F1419]/10">
                        <td className="py-2.5 pr-4 font-semibold">Élevée (IDOR, auth bypass)</td>
                        <td className="py-2.5 pr-4">&lt; 48h</td>
                        <td className="py-2.5">&lt; 30 jours</td>
                      </tr>
                      <tr className="border-b border-[#0F1419]/10">
                        <td className="py-2.5 pr-4 font-semibold">Moyenne (XSS reflété, CSRF)</td>
                        <td className="py-2.5 pr-4">&lt; 5 jours</td>
                        <td className="py-2.5">&lt; 60 jours</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-semibold">Faible / Informationnel</td>
                        <td className="py-2.5 pr-4">&lt; 10 jours</td>
                        <td className="py-2.5">Best effort</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </article>
        </div>
      </main>

      <footer className="border-t border-[#0F1419]/[0.08] px-5 sm:px-8 py-8 text-[12px] text-[#0F1419]/55 bg-[#F5F7F4]">
        <div className="mx-auto max-w-[1240px] flex flex-col md:flex-row md:justify-between gap-3">
          <p>
            Politique de divulgation responsable v1.0 — applicable depuis le 27 mai 2026. © 2026
            SASU {COMPANY_IDENTITY.legalName} · SIREN {COMPANY_IDENTITY.sirenFormatted}.
          </p>
          <nav aria-label="Navigation sécurité" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/mentions-legales" className="hover:text-[#0F1419] transition-colors">
              Mentions
            </Link>
            <Link
              href="/politique-confidentialite"
              className="hover:text-[#0F1419] transition-colors"
            >
              Confidentialité
            </Link>
            <Link href="/contact" className="hover:text-[#0F1419] transition-colors">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
