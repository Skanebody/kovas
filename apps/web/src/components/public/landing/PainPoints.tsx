interface PainPoint {
  emphasis: string
  rest: string
}

const PAIN_POINTS: PainPoint[] = [
  {
    emphasis: '3h par mission gaspillées',
    rest: 'à re-saisir les mêmes données dans plusieurs logiciels.',
  },
  {
    emphasis: 'Stress amende ADEME',
    rest: 'à chaque DPE F/G, à chaque écart de cohérence non détecté.',
  },
  {
    emphasis: 'Factures variables imprévisibles',
    rest: 'avec ton logiciel actuel — tu ne sais jamais ce que tu vas payer.',
  },
]

/**
 * Pain points B2B — loss aversion neuromarketing.
 * 3 cards border-left rouge subtil.
 */
export function PainPoints() {
  return (
    <section className="px-6 py-20 md:py-24 bg-sage">
      <div className="mx-auto max-w-5xl space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-wider text-ink-faint">
            01 · Le constat
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            Tu te reconnais dans ce quotidien&nbsp;?
          </h2>
        </div>

        <ul className="space-y-4">
          {PAIN_POINTS.map((p) => (
            <li
              key={p.emphasis}
              className="bg-paper rounded-xl border border-rule/60 border-l-4 border-l-danger/70 px-6 py-5 shadow-sm"
            >
              <p className="text-base text-ink-soft leading-relaxed">
                <span className="font-bold text-ink">{p.emphasis}</span> {p.rest}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
