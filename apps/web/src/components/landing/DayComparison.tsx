interface TimelineItem {
  time: string
  event: string
  /** Met en relief la ligne dans la timeline (export client final). */
  highlight?: boolean
}

const WITHOUT_KOVAS: TimelineItem[] = [
  { time: '9h00', event: 'Mission 1 — Maison Offranville, relevés + photos sur téléphone' },
  { time: '11h30', event: 'Mission 2 — Appartement Dieppe centre' },
  { time: '14h00', event: 'Mission 3 — Maison Saint-Aubin' },
  { time: '17h00', event: 'Retour bureau, tri des photos par mission' },
  { time: '17h45', event: 'Saisie Liciel mission 1, retour aux notes' },
  { time: '19h15', event: 'Saisie Liciel mission 2, café qui refroidit' },
  { time: '20h30', event: 'Saisie Liciel mission 3, vérification incohérences' },
  { time: '21h45', event: 'Génération du rapport, envoi au client', highlight: true },
]

const WITH_KOVAS: TimelineItem[] = [
  { time: '9h00', event: 'Mission 1 — saisie vocale par pièce, photos auto-classées' },
  { time: '10h30', event: 'Bouton « Partager » → Liciel reçoit mission 1 (30s)' },
  { time: '11h30', event: 'Mission 2, même workflow' },
  { time: '13h15', event: 'Liciel reçoit mission 2, déjeuner sans culpabilité' },
  { time: '14h00', event: 'Mission 3, validation cohérence en temps réel' },
  { time: '15h45', event: 'Liciel reçoit mission 3' },
  { time: '17h00', event: 'Génération du rapport, envoi au client', highlight: true },
  { time: '17h15', event: "Vous fermez l'ordinateur" },
]

/**
 * Section "Une journée type" — 2 colonnes timeline parallèles.
 *
 * Mirror du mockup avec 2 ajouts post-feedback (2026-05-20) :
 *   1. Badge "−4h30 / jour" en haut de la card Avec KOVAS — gain matérialisé
 *      dès le scan visuel sans avoir à lire les timelines en détail
 *   2. Ligne "Génération du rapport, envoi au client" présente dans les DEUX
 *      colonnes (21h45 sans / 17h00 avec) avec highlight visuel — souligne que
 *      l'export client final reste un moment dédié quoi qu'il arrive, KOVAS
 *      ne le supprime pas, il le déplace plus tôt dans la journée.
 *
 * Biais : **representativeness heuristic** — récit chronologique > listes
 * abstraites. **Anchoring** — le badge "−4h30 / jour" donne le résultat avant
 * la preuve, l'utilisateur lit ensuite la timeline avec ce chiffre en tête.
 */
export function DayComparison() {
  return (
    <section className="bg-white border-y border-[#0F1419]/[0.08] px-5 sm:px-12 py-20 sm:py-32 md:py-40">
      <div className="max-w-[1240px] mx-auto">
        <div className="text-center max-w-[800px] mx-auto mb-[60px]">
          <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-medium mb-4">
            Une journée type
          </p>
          <h2 className="text-[40px] sm:text-[56px] md:text-[72px] font-semibold leading-[1.02] tracking-[-0.03em] mb-6">
            Mardi, 3 missions DPE.
          </h2>
          <p className="text-[17px] sm:text-[20px] text-[#0F1419]/72 leading-relaxed">
            La même journée. Avec KOVAS et sans. Voici à quoi ressemble ton soir.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Sans KOVAS */}
          <article className="bg-[#F5F7F4] rounded-[32px] p-10 relative">
            <h3 className="text-2xl font-semibold tracking-[-0.01em] mb-2 text-[#0F1419]">
              Sans KOVAS
            </h3>
            <p className="text-sm text-[#0F1419]/55 mb-8">
              Workflow Liciel seul, notes papier sur le terrain
            </p>
            <ul>
              {WITHOUT_KOVAS.map((item, idx) => (
                <TimelineRow key={item.time} item={item} dark={false} first={idx === 0} />
              ))}
            </ul>
            <div className="mt-8 pt-8 border-t border-[#0F1419]/[0.08] text-base font-medium text-[#0F1419]/55">
              Rapport envoyé au client
              <span className="block font-serif italic font-normal text-[56px] tracking-[-0.02em] mt-2 text-[#0F1419] leading-none">
                21h45
              </span>
            </div>
          </article>

          {/* Avec KOVAS */}
          <article className="bg-[#0F1419] text-white rounded-[32px] p-10 relative">
            {/* Badge gain — anchoring du résultat avant la preuve */}
            <span className="absolute top-6 right-6 bg-chartreuse text-[#0F1419] font-mono text-[11px] uppercase tracking-[0.14em] font-bold px-3 py-1.5 rounded-full">
              −4h30 / jour
            </span>
            <h3 className="text-2xl font-semibold tracking-[-0.01em] mb-2 text-white">
              Avec KOVAS
            </h3>
            <p className="text-sm text-white/60 mb-8">
              Saisie vocale terrain, export logiciel automatique
            </p>
            <ul>
              {WITH_KOVAS.map((item, idx) => (
                <TimelineRow key={item.time} item={item} dark first={idx === 0} />
              ))}
            </ul>
            <div className="mt-8 pt-8 border-t border-white/15 text-base font-medium text-white/60">
              Rapport envoyé au client
              <span className="block font-serif italic font-normal text-[56px] tracking-[-0.02em] mt-2 text-chartreuse leading-none">
                17h00
              </span>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

function TimelineRow({
  item,
  dark,
  first,
}: {
  item: TimelineItem
  dark: boolean
  first: boolean
}) {
  const baseBorder = first
    ? ''
    : dark
      ? 'border-t border-white/15'
      : 'border-t border-[#0F1419]/[0.08]'

  // Lignes highlight = "Génération du rapport, envoi au client" → fond chartreuse
  // subtil (10% sur dark, 8% sur sage) + bordure latérale chartreuse en accent.
  const highlightWrapClass = item.highlight
    ? dark
      ? 'bg-chartreuse/10 -mx-3 px-3 rounded-[8px] border-l-[3px] border-chartreuse'
      : 'bg-chartreuse/15 -mx-3 px-3 rounded-[8px] border-l-[3px] border-[#95B11A]'
    : ''

  return (
    <li className={`${baseBorder} ${highlightWrapClass} flex gap-5 py-4 text-[15px]`.trim()}>
      <span
        className={`font-semibold tabular-nums shrink-0 w-14 ${
          dark ? 'text-chartreuse' : 'text-[#0F1419]/55'
        }`}
      >
        {item.time}
      </span>
      <span
        className={
          dark
            ? `${item.highlight ? 'text-white font-medium' : 'text-white/90'} leading-[1.45]`
            : `${item.highlight ? 'text-[#0F1419] font-medium' : 'text-[#0F1419]'} leading-[1.45]`
        }
      >
        {item.event}
      </span>
    </li>
  )
}
