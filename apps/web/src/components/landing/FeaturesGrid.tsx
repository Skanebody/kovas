import {
  Camera,
  CheckCircle2,
  FileText,
  type LucideIcon,
  Mic,
  ShieldCheck,
  Upload,
} from 'lucide-react'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    icon: Mic,
    title: 'Saisie vocale terrain',
    description:
      "Décrivez l'état d'une pièce à voix haute. KOVAS structure les données automatiquement, en arrière-plan, pendant que vous continuez le relevé.",
  },
  {
    icon: Camera,
    title: 'Photos géolocalisées',
    description:
      'Équipements, défauts, étiquettes énergétiques. Géolocalisation EXIF préservée, annotations basiques intégrées, organisation par pièce automatique.',
  },
  {
    icon: CheckCircle2,
    title: 'Validation cohérence',
    description:
      'Règles métier intégrées. KOVAS détecte les incohérences avant export : « Surface 100 m² + chaudière 5 kW = à vérifier ». Avant export, pas après.',
  },
  {
    icon: Upload,
    title: 'Bouton Partager',
    description:
      "Trois modes vers votre logiciel principal : email, sync Google Drive automatique, téléchargement direct. 30 secondes au lieu d'1h30 de re-saisie.",
  },
  {
    icon: FileText,
    title: 'Exports universels',
    description:
      'PDF, Word, CSV, JSON, ZIP Liciel. Aucune dépendance à un éditeur unique. Vos données vous appartiennent et restent exportables sans condition.',
  },
  {
    icon: ShieldCheck,
    title: 'RGPD & hébergement EU',
    description:
      'Supabase Paris (eu-west-3), Vercel Europe, chiffrement bout-en-bout. Conformité européenne dès le démarrage, pas une option payante.',
  },
]

/**
 * Grille 6 features cœur — section "Le terrain plus rapide".
 *
 * Mirror du mockup avec icônes lucide-react (au lieu des SVG inline). Chaque card
 * porte un point chartreuse en exposant de l'icône (signal d'activité visuelle).
 */
export function FeaturesGrid() {
  return (
    <section id="features" className="px-5 sm:px-12 py-20 sm:py-32 md:py-40 max-w-[1240px] mx-auto">
      <div className="text-center max-w-[800px] mx-auto mb-20">
        <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-medium mb-4">
          Les 6 fonctions cœur
        </p>
        <h2 className="text-[40px] sm:text-[56px] md:text-[72px] font-semibold leading-[1.02] tracking-[-0.03em] mb-6">
          Le terrain plus rapide.{' '}
          <span className="text-[#0F1419]/35">Le retour bureau quasi inutile.</span>
        </h2>
        <p className="text-[17px] sm:text-[20px] text-[#0F1419]/72 leading-relaxed">
          KOVAS ne remplace pas votre logiciel principal. Il élimine la friction terrain, valide vos
          données avant export, et envoie vers Liciel, AnalysImmo ou tout autre outil en un bouton.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {FEATURES.map((feature) => {
          const Icon = feature.icon
          return (
            <article
              key={feature.title}
              className="bg-white border border-[#0F1419]/[0.08] rounded-[24px] p-10 px-8 hover:border-[#0F1419]/35 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="size-11 bg-[#0F1419] rounded-[12px] flex items-center justify-center mb-6 relative">
                <span
                  aria-hidden
                  className="absolute -top-[3px] -right-[3px] size-2 bg-chartreuse rounded-full"
                />
                <Icon className="size-[22px] text-white" strokeWidth={2} />
              </div>
              <h3 className="text-[22px] font-semibold tracking-[-0.01em] mb-3 text-[#0F1419]">
                {feature.title}
              </h3>
              <p className="text-base text-[#0F1419]/72 leading-[1.55]">{feature.description}</p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
