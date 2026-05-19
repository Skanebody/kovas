'use client'

import { useEffect, useState } from 'react'

/**
 * Composant client one-shot — désinstalle tous les SW + vide tous les caches
 * + redirige vers /. Aucune action utilisateur, automatique.
 *
 * Pourquoi : un SW serwist d'un build prod antérieur restait actif et
 * servait l'ancien HTML/CSS/JS depuis Cache Storage. Cette page n'avait
 * jamais été cachée donc force un fetch network → exécute ce script →
 * propre.
 */
export function ClearSwClient() {
  const [step, setStep] = useState('Initialisation…')

  useEffect(() => {
    async function clearEverything() {
      try {
        // 1. Désinscrire tous les Service Workers
        if ('serviceWorker' in navigator) {
          setStep('Désinstallation Service Worker…')
          const registrations = await navigator.serviceWorker.getRegistrations()
          await Promise.all(registrations.map((reg) => reg.unregister()))
        }

        // 2. Vider tous les caches storage
        if ('caches' in window) {
          setStep('Purge du cache…')
          const keys = await caches.keys()
          await Promise.all(keys.map((key) => caches.delete(key)))
        }

        // 3. Note : on garde localStorage et IndexedDB (data utilisateur)
        // L'IndexedDB Dexie du sync queue contient des mutations en attente
        // qu'il ne faut PAS supprimer.

        setStep('Redirection…')

        // 4. Redirige avec force reload (bypass cache)
        setTimeout(() => {
          window.location.replace(`${window.location.origin}/?_=${Date.now()}`)
        }, 800)
      } catch (err) {
        setStep(`Erreur : ${err instanceof Error ? err.message : 'inconnue'}`)
      }
    }

    void clearEverything()
  }, [])

  return (
    <p className="font-mono text-xs text-[#5A6B78] mt-4" aria-live="polite">
      {step}
    </p>
  )
}
