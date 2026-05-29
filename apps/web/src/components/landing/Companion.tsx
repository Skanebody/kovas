/**
 * Sections "Compagnon, pas remplaçant" + "3 étapes Workflow".
 *
 * Mirror du mockup : workflow diagram à 3 nodes (Terrain → KOVAS → Votre logiciel)
 * avec node KOVAS sur fond dark + accent chartreuse top border, suivi de 3 étapes
 * numérotées en Instrument Serif italic chartreuse-dark.
 *
 * Décision : combiné en 1 seul composant car les 2 sections forment ensemble la
 * narration "comment ça s'insère" — pas de raison de les séparer côté code.
 */
export function Companion() {
  return (
    <>
      {/* === SECTION 1 : Workflow diagram === */}
      <section className="px-5 sm:px-12 py-20 sm:py-32 md:py-40 max-w-[1240px] mx-auto text-center">
        <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-medium mb-4">
          Compagnon, pas remplaçant
        </p>
        <h2 className="text-[40px] sm:text-[56px] md:text-[72px] font-semibold leading-[1.02] tracking-[-0.03em] mb-6 max-w-[900px] mx-auto">
          KOVAS ne remplace pas ton logiciel.
          <br />
          <span className="text-[#0F1419]/35">Il enlève la friction qui t'épuisait.</span>
        </h2>
        <p className="text-[17px] sm:text-[20px] text-[#0F1419]/72 max-w-[720px] mx-auto leading-relaxed mb-20">
          Ton logiciel principal reste le même : Liciel, OBBC ou AnalysImmo. KOVAS s'intercale entre
          toi et lui sur le seul moment où la double saisie te fait perdre de l'argent.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-6 items-center max-w-[1000px] mx-auto">
          <WorkflowNode
            label="Sur place"
            title="Terrain"
            desc="Toi, iPad ou iPhone en main, relevés à voix haute"
          />
          <WorkflowArrow />
          <WorkflowNode
            label="Compagnon"
            title="KOVAS"
            desc="Structuration, validation, géolocalisation, export"
            kovas
          />
          <WorkflowArrow />
          <WorkflowNode
            label="Rapport officiel"
            title="Ton logiciel"
            desc="Import en 30 secondes, génération du DPE réglementaire"
          />
        </div>
      </section>

      {/* === SECTION 2 : Steps Workflow 3 étapes === */}
      <section
        id="how-it-works"
        className="px-5 sm:px-12 py-20 sm:py-32 md:py-40 max-w-[1240px] mx-auto"
      >
        <div className="text-center max-w-[800px] mx-auto mb-[60px]">
          <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-medium mb-4">
            Workflow
          </p>
          <h2 className="text-[36px] sm:text-[56px] md:text-[72px] font-semibold leading-[1.02] tracking-[-0.03em] whitespace-nowrap">
            Trois étapes. Zéro re-saisie.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Step
            n="01"
            title="Sur place"
            desc="Démarre une mission depuis l'iPad ou l'iPhone. Saisie vocale par pièce, photos automatiquement géolocalisées, templates T2 / T3 / T4 pré-remplis."
          />
          <Step
            n="02"
            title="Validation"
            desc="KOVAS détecte les incohérences et les oublis avant la fin de mission. « Tu n'as pas saisi la VMC, volontaire ? » Tu corriges sur le palier, pas le soir."
          />
          <Step
            n="03"
            title="Export & partage"
            desc="Un bouton, trois modes : email automatique, sync Google Drive, téléchargement direct. Import dans ton logiciel en 30 secondes, génération du rapport officiel."
          />
        </div>
      </section>
    </>
  )
}

function WorkflowNode({
  label,
  title,
  desc,
  kovas = false,
}: {
  label: string
  title: string
  desc: string
  kovas?: boolean
}) {
  return (
    <div
      className={
        kovas
          ? 'bg-[#0F1419] text-white border border-[#0F1419] rounded-[24px] p-8 px-6 text-center relative'
          : 'bg-white border border-[#0F1419]/15 rounded-[24px] p-8 px-6 text-center'
      }
    >
      {kovas && (
        <span
          aria-hidden
          className="absolute top-[-1px] left-6 right-6 h-[3px] bg-chartreuse rounded-[2px]"
        />
      )}
      <p
        className={
          kovas
            ? 'font-mono text-[11px] uppercase tracking-[0.18em] text-chartreuse font-semibold mb-3'
            : 'font-mono text-[11px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-semibold mb-3'
        }
      >
        {label}
      </p>
      <p className="text-[20px] font-semibold tracking-[-0.01em] mb-2">{title}</p>
      <p
        className={
          kovas ? 'text-sm text-white/90 leading-[1.4]' : 'text-sm text-[#0F1419]/72 leading-[1.4]'
        }
      >
        {desc}
      </p>
    </div>
  )
}

function WorkflowArrow() {
  return (
    <span
      aria-hidden
      className="text-[#0F1419]/35 text-2xl font-light text-center md:rotate-0 rotate-90"
    >
      →
    </span>
  )
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <article>
      <p className="font-serif italic font-normal text-5xl text-[#95B11A] leading-none mb-4">{n}</p>
      <h3 className="text-2xl font-semibold tracking-[-0.01em] mb-3 text-[#0F1419]">{title}</h3>
      <p className="text-base text-[#0F1419]/72 leading-[1.55]">{desc}</p>
    </article>
  )
}
