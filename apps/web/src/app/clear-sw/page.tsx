import type { Metadata } from 'next'
import { ClearSwClient } from './clear-sw-client'

export const metadata: Metadata = {
  title: 'Nettoyage du cache',
  robots: { index: false, follow: false },
}

/**
 * Page utilitaire one-shot pour forcer la désinstallation du Service Worker
 * legacy et vider tous les caches storage. À supprimer une fois la transition
 * v4→v5 terminée pour tous les users actifs.
 *
 * Accès direct : http://localhost:3000/clear-sw (et https://kovas.fr/clear-sw)
 *
 * Cette URL n'a jamais existé avant — donc le SW legacy n'a pas de version
 * cachée et doit forcément faire un fetch network → reçoit cette page →
 * exécute le script clear-sw-client → reload propre.
 */
export default function ClearSwPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-8 text-center bg-[#F5F7F4]">
      <div className="max-w-md space-y-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#5A6B78]">
          Maintenance
        </div>
        <h1 className="font-serif italic text-4xl text-[#163144]">
          Nettoyage en cours.
        </h1>
        <p className="text-base text-[#5A6B78]">
          Désinstallation du Service Worker et purge du cache navigateur.
          Vous serez redirigé vers KOVAS automatiquement.
        </p>
        <div className="flex justify-center">
          <div className="size-8 border-4 border-[#163144] border-t-transparent rounded-full animate-spin" />
        </div>
        <ClearSwClient />
      </div>
    </div>
  )
}
