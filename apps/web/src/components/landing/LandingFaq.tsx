'use client'

import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useState } from 'react'

interface FaqItem {
  id: string
  question: string
  answer: string
}

/**
 * FAQ home — 5 questions essentielles avant l'essai.
 *
 * Mirror du mockup : 5 items accordéon, ton sec et factuel, renvoi vers /faq pour
 * la liste complète. Q4 chevauche avec PricingFaq (dépassement quota) — c'est
 * **assumé** : la home doit être autonome, l'utilisateur ne devrait pas avoir à
 * cliquer vers /pricing juste pour comprendre le surplus.
 *
 * Biais : **zero-risk bias** (Q1 sortie + Q3 offline + Q5 preuve) — toutes les
 * réponses désamorcent une peur spécifique sans hedging.
 */
const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'data-ownership',
    question: "Mes données restent-elles à moi si j'arrête KOVAS ?",
    answer:
      "Oui, sans condition. Export complet en PDF, Word, CSV, JSON ou ZIP Liciel à tout moment, depuis ton tableau de bord. Après résiliation, ton abonnement reste actif jusqu'à la fin de la période en cours, puis ton compte bascule 90 jours en mode lecture et export pour reprendre tes dossiers à ton rythme. Au-delà, tes données opérationnelles sont supprimées ; tes factures restent conservées 10 ans (obligation légale comptable). Une demande explicite d'effacement RGPD via contact@kovas.fr est traitée sous 30 jours. Aucun verrou éditeur, aucune négociation de sortie.",
  },
  {
    id: 'compat',
    question: 'Quels logiciels métier sont vraiment compatibles ?',
    answer:
      "Liciel (versions 2024 et 2025 testées en priorité, c'est l'export natif), AnalysImmo via CSV structuré, WinDiagnostics, GestionDiag, Im'Diag, ORIS, Argos (Ithaque) et DPEWin (Perrenoud). Pour tout autre logiciel, l'export Word et PDF couvre 100 % des cas en import manuel. La compatibilité Liciel est notre engagement de niveau 1, contractuellement maintenue à chaque release du logiciel.",
  },
  {
    id: 'offline',
    question: "Et si je n'ai pas de connexion sur le terrain ?",
    answer:
      "KOVAS fonctionne hors ligne intégralement. Saisie vocale traitée localement sur l'appareil, photos stockées en local, validation cohérence en local. La synchronisation se déclenche dès que tu retrouves du réseau, sans intervention de ta part. Aucune mission perdue, aucune saisie à refaire.",
  },
  {
    id: 'quota-overflow',
    question: 'Que se passe-t-il si je dépasse mon quota de missions ?',
    answer:
      "Surplus facturé à l'usage à 2 € / mission au-delà du quota de ton forfait (Essential 10, Découverte 25, Pro 60). All Inclusive et Cabinet : missions illimitées, pas de surplus. Tu peux activer un plafond mensuel auto-protecteur : au-delà du seuil que tu fixes, le compte bascule en mode lecture pour le reste du mois. Aucune surprise sur la facture, jamais.",
  },
  {
    id: 'proof-1h30',
    question: 'Pourquoi nous croire sur les 1h30 gagnées par mission ?',
    answer:
      'Parce que le calcul est mécanique : un DPE T3 demande en moyenne 50 minutes de relevé terrain et 90 minutes de re-saisie bureau (sources : enquête métier 2024, benchmark sur missions test). KOVAS structure la saisie pendant le relevé, ce qui réduit la re-saisie à 0–10 minutes selon la complexité. Le gain médian observé sur les bêta-tests est de 1h27 par DPE individuel.',
  },
]

export function LandingFaq() {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <section id="faq" className="px-5 sm:px-12 py-20 sm:py-32 md:py-40 max-w-[880px] mx-auto">
      <div className="text-center max-w-[720px] mx-auto">
        <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-medium mb-4">
          FAQ
        </p>
        <h2 className="text-[40px] sm:text-[56px] md:text-[72px] font-semibold leading-[1.02] tracking-[-0.03em] mb-6">
          Les questions essentielles.
        </h2>
        <p className="text-[17px] sm:text-[20px] text-[#0F1419]/72 leading-relaxed">
          Cinq réponses avant de démarrer. La FAQ complète vit sur{' '}
          <Link
            href="/faq"
            className="border-b border-current text-[#0F1419] hover:text-[#0F1419]/72"
          >
            kovas.fr/faq
          </Link>
          .
        </p>
      </div>

      <div className="mt-[60px]">
        {FAQ_ITEMS.map((item, idx) => {
          const open = openId === item.id
          return (
            <div
              key={item.id}
              className={cn(
                'border-t border-[#0F1419]/15 py-6',
                idx === FAQ_ITEMS.length - 1 && 'border-b',
              )}
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : item.id)}
                aria-expanded={open}
                aria-controls={`landing-faq-${item.id}`}
                className="w-full text-left flex items-center justify-between gap-4 text-[17px] md:text-[20px] font-medium text-[#0F1419] tracking-[-0.005em]"
              >
                <span className="flex-1">{item.question}</span>
                <span
                  aria-hidden
                  className={cn(
                    'text-2xl text-[#0F1419]/55 leading-none shrink-0 transition-transform duration-200',
                    open && 'rotate-45',
                  )}
                >
                  +
                </span>
              </button>
              <section
                id={`landing-faq-${item.id}`}
                aria-label="Réponse"
                className={cn(
                  'overflow-hidden transition-[max-height,padding] duration-300 ease-in-out text-base text-[#0F1419]/72 leading-[1.6]',
                  open ? 'max-h-[800px] pt-4' : 'max-h-0',
                )}
              >
                {item.answer}
              </section>
            </div>
          )
        })}
      </div>
    </section>
  )
}
