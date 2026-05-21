'use client'

import { useMemo, useState } from 'react'

// === Constantes calcul, miroir exact du mockup HTML validé ===
const KOVAS_MINUTES = 10 // re-saisie résiduelle avec KOVAS
const WEEKS = 48 // semaines travaillées par an
const HOURS_PER_DAY = 8
const DAYS_PER_MONTH = 22 // jours ouvrés moyens
const MISSION_HOURS_KOVAS = (60 + KOVAS_MINUTES) / 60 // 1h relevé + 10min saisie
const RATE_NATIONAL = 180 // tarif moyen DPE FR — étude Kiwidiag / Immo Matin (mars 2025)

function fmt(n: number): string {
  return n.toLocaleString('fr-FR')
}

function formatHours(hoursDecimal: number): string {
  const h = Math.floor(hoursDecimal)
  const m = Math.round((hoursDecimal - h) * 60)
  return `${h}h${m < 10 ? '0' : ''}${m}`
}

/**
 * Section dark "Le coût caché" + calculateur de re-saisie interactif.
 *
 * Mirror exact du mockup `docs/design/pricing-mockup.html` (section .hidden-cost) :
 *   - fond `#0F1419` avec eyebrow chartreuse-like grise + h2 strike sur 2e clause
 *   - 2 inputs inline (missions/sem + minutes/mission)
 *   - 2 cartes résultat : temps récupéré (chartreuse featured) + choix vie perso/activité
 *   - source citée explicitement (180€ DPE moyen, Kiwidiag / Immo Matin mars 2025)
 *
 * Biais activés :
 *   - **Endowment effect** : "vous récupérez ce qu'on vous prend" — cadrage perte
 *     évitée plutôt que gain ajouté
 *   - **Mental accounting** : conversion explicite heures → mois de travail → revenu €
 *     en parallèle, l'utilisateur projette dans son propre cadre
 *   - **Loss aversion** : la card temps montre la re-saisie ACTUELLE en premier
 *     (rappel de la perte), KOVAS en deuxième
 */
export function HiddenCostCalculator() {
  const [missions, setMissions] = useState(8)
  const [entryTime, setEntryTime] = useState(90)

  const calc = useMemo(() => {
    const safeMissions = Math.max(0, Number.isFinite(missions) ? missions : 0)
    const safeEntryTime = Math.max(0, Number.isFinite(entryTime) ? entryTime : 0)
    const savedPerMissionMin = Math.max(0, safeEntryTime - KOVAS_MINUTES)

    // Hebdo
    const currentWeekHours = (safeMissions * safeEntryTime) / 60
    const kovasWeekHours = (safeMissions * KOVAS_MINUTES) / 60
    const savedWeekHours = (safeMissions * savedPerMissionMin) / 60

    // Annuel
    const savedYearHours = savedWeekHours * WEEKS
    const daysSaved = Math.round(savedYearHours / HOURS_PER_DAY)
    const monthsSaved = (daysSaved / DAYS_PER_MONTH).toFixed(1).replace('.', ',')

    // Conversion en missions supplémentaires possibles
    const hoursFor1Mission = MISSION_HOURS_KOVAS * WEEKS
    const hoursFor2Missions = hoursFor1Mission * 2

    let businessText: string
    let revenueText: string
    if (savedYearHours >= hoursFor2Missions) {
      businessText = '1 à 2 missions supplémentaires par semaine'
      revenueText = `Soit entre ${fmt(WEEKS * RATE_NATIONAL)} € et ${fmt(
        2 * WEEKS * RATE_NATIONAL,
      )} € de CA additionnel par an, au tarif moyen national.`
    } else if (savedYearHours >= hoursFor1Mission) {
      businessText = '1 mission supplémentaire par semaine'
      revenueText = `Soit ${fmt(
        WEEKS * RATE_NATIONAL,
      )} € de CA additionnel par an, au tarif moyen national.`
    } else if (savedYearHours > 0) {
      const extraMissions = Math.floor(savedYearHours / MISSION_HOURS_KOVAS)
      businessText = `${extraMissions} missions supplémentaires par an`
      revenueText = `Soit ${fmt(
        extraMissions * RATE_NATIONAL,
      )} € de CA additionnel par an, au tarif moyen national.`
    } else {
      businessText = 'Gain marginal de temps'
      revenueText =
        'KOVAS 360 reste utile pour la fiabilité, la conformité et la qualité du rapport.'
    }

    return {
      monthsSaved,
      currentWeekHours,
      kovasWeekHours,
      savedWeekHours,
      savedYearHours,
      daysSaved,
      businessText,
      revenueText,
    }
  }, [missions, entryTime])

  return (
    <section className="bg-[#0F1419] text-white px-5 sm:px-12 py-20 sm:py-32 md:py-40">
      <div className="max-w-[1280px] mx-auto text-center">
        <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-white/60 font-medium mb-8">
          Le coût caché
        </p>
        <h2 className="text-[40px] sm:text-[56px] md:text-[72px] font-semibold leading-[1.02] tracking-[-0.03em] mb-8 text-white">
          Vous ne gagnez pas du temps.
          <br />
          <span className="text-white/60">Vous récupérez ce qu'on vous prend.</span>
        </h2>
        <p className="text-[18px] sm:text-[20px] md:text-[22px] text-white/90 max-w-[720px] mx-auto leading-[1.55] mb-[60px]">
          Ce n'est pas la mission qui vous épuise. C'est ce qui vient après — re-noter chaque
          information dans Liciel ou AnalysImmo le soir, dans le silence du bureau. Cette
          re-saisie est votre friction numéro un. Mesurez-la.
        </p>

        <div className="bg-white/[0.04] border border-white/15 rounded-[32px] p-7 sm:p-12 text-left">
          <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-white/60 font-medium mb-8">
            Votre coût caché de re-saisie
          </p>

          {/*
           * Ligne d'inputs : chaque clause "verbe + input + complément" est rendue
           * insécable via <span className="whitespace-nowrap"> pour éviter qu'un input
           * se retrouve sur une ligne séparée de son contexte textuel.
           * Sur viewport ≥ 1200px, les 2 clauses tiennent sur une seule ligne.
           * En dessous, wrap entre les clauses uniquement.
           */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-3 text-[17px] sm:text-[20px] lg:text-[22px] leading-[1.8]">
            <span className="inline-flex items-center gap-3 whitespace-nowrap">
              <span>Je fais</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                value={missions}
                onChange={(e) => setMissions(Number.parseInt(e.target.value, 10) || 0)}
                aria-label="Missions par semaine"
                className="bg-white text-[#0F1419] border-0 rounded-[12px] px-4 py-2.5 text-[18px] sm:text-[22px] font-semibold w-[92px] text-center focus:outline focus:outline-[3px] focus:outline-chartreuse"
              />
              <span>missions par semaine,</span>
            </span>
            <span className="inline-flex items-center gap-3 whitespace-nowrap">
              <span>je passe</span>
              <input
                type="number"
                inputMode="numeric"
                min={15}
                max={240}
                value={entryTime}
                onChange={(e) => setEntryTime(Number.parseInt(e.target.value, 10) || 0)}
                aria-label="Minutes de re-saisie par mission"
                className="bg-white text-[#0F1419] border-0 rounded-[12px] px-4 py-2.5 text-[18px] sm:text-[22px] font-semibold w-[92px] text-center focus:outline focus:outline-[3px] focus:outline-chartreuse"
              />
              <span>minutes de re-saisie par mission.</span>
            </span>
          </div>

          <div className="mt-7 px-6 py-5 bg-chartreuse/[0.08] border-l-[3px] border-chartreuse rounded-[8px] text-[15px] text-white/90 leading-[1.55]">
            KOVAS 360 structure vos données pendant le relevé terrain. La re-saisie tombe à environ{' '}
            <strong className="text-chartreuse font-semibold">10 minutes par mission</strong>{' '}
            au lieu des {entryTime} actuelles. Voici ce que ça change pour vous.
          </div>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* === CARD 1 : TEMPS RÉCUPÉRÉ (featured chartreuse) === */}
            <article className="bg-chartreuse text-[#0F1419] border border-chartreuse rounded-[24px] p-8">
              <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-[#0F1419]/60 font-semibold mb-5">
                Temps que vous récupérez par an
              </p>
              <div className="font-serif italic font-normal text-[48px] sm:text-[64px] md:text-[80px] leading-[0.95] tracking-[-0.02em] mb-6 text-[#0F1419]">
                {calc.monthsSaved}
                <span className="font-sans not-italic font-medium text-[20px] sm:text-[28px] text-[#0F1419]/60 ml-1.5">
                  mois travaillés
                </span>
              </div>
              <ul className="text-[15px] text-[#0F1419] space-y-0">
                <BreakdownRow
                  label="Re-saisie actuelle par semaine"
                  value={formatHours(calc.currentWeekHours)}
                  first
                />
                <BreakdownRow
                  label="Re-saisie avec KOVAS 360 par semaine"
                  value={formatHours(calc.kovasWeekHours)}
                />
                <BreakdownRow
                  label="Récupéré chaque semaine"
                  value={formatHours(calc.savedWeekHours)}
                />
                <BreakdownRow
                  label="Soit, sur l'année"
                  value={`${fmt(Math.round(calc.savedYearHours))} heures`}
                />
                <BreakdownRow
                  label="Équivalent en jours de 8h"
                  value={`${calc.daysSaved} jours`}
                />
              </ul>
            </article>

            {/* === CARD 2 : CHOIX VIE PERSO / ACTIVITÉ === */}
            <article className="bg-white/[0.06] border border-white/15 rounded-[24px] p-8 text-white">
              <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-white/60 font-semibold mb-5">
                Vous en faites ce que vous voulez
              </p>

              <div className="py-1">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-chartreuse font-bold mb-3.5">
                  Côté vie perso
                </p>
                <p className="text-[19px] text-white leading-snug mb-2">
                  <strong className="font-semibold">
                    {formatHours(calc.savedWeekHours)} chaque semaine pour vous
                  </strong>
                </p>
                <p className="text-sm text-white/60 leading-[1.5]">
                  Plus de soirées au bureau à re-saisir Liciel. Plus de week-ends de rattrapage.
                </p>
              </div>

              <div className="my-7 text-center font-mono text-[11px] tracking-[0.22em] uppercase text-white/35 font-medium relative">
                <span className="absolute left-0 top-1/2 w-[calc(50%-36px)] h-px bg-white/15" />
                — ou —
                <span className="absolute right-0 top-1/2 w-[calc(50%-36px)] h-px bg-white/15" />
              </div>

              <div className="py-1">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-chartreuse font-bold mb-3.5">
                  Côté activité
                </p>
                <p className="text-[19px] text-white leading-snug mb-2">
                  <strong className="font-semibold">{calc.businessText}</strong>
                </p>
                <p className="text-sm text-white/60 leading-[1.5]">{calc.revenueText}</p>
              </div>
            </article>
          </div>

          <p className="mt-6 text-center text-[13px] text-white/35 italic leading-[1.5]">
            Calculs basés sur un tarif moyen DPE de 180 € en France — étude Kiwidiag relayée par
            Immo Matin (mars 2025).
          </p>
        </div>
      </div>
    </section>
  )
}

function BreakdownRow({
  label,
  value,
  first = false,
}: {
  label: string
  value: string
  first?: boolean
}) {
  return (
    <li
      className={
        first
          ? 'flex justify-between gap-4 py-2.5 leading-[1.4]'
          : 'flex justify-between gap-4 py-2.5 leading-[1.4] border-t border-[#0F1419]/20'
      }
    >
      <span>{label}</span>
      <strong className="font-semibold tabular-nums text-[#0F1419]">{value}</strong>
    </li>
  )
}
