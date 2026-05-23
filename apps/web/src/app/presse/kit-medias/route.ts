/**
 * KOVAS — Route handler /presse/kit-medias
 *
 * V2 (lot FIX-I KIT-MEDIA) : genere a la volee un ZIP contenant tous les
 * assets du dossier `public/press-kit/` :
 *   - logo-kovas-navy.svg + logo-kovas-white.svg + kovas-icon-512.svg
 *   - kovas-screenshot-dashboard.svg + kovas-screenshot-mobile.svg
 *   - fact-sheet-kovas-mai-2026.pdf + charte-graphique-kovas.pdf
 *   - bio-benjamin-bel.md + README.txt (mode d'emploi rapide)
 *
 * Lit directement les fichiers depuis le disque server-side via `node:fs`
 * + relative path resolution (Vercel + local OK). Aucune dependance reseau.
 *
 * Retourne `application/zip` avec Content-Disposition attachment. Le nom du
 * fichier integre le mois courant (kovas-press-kit-mai-2026.zip).
 *
 * Contact presse public : `contact@kovas.fr`.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import JSZip from 'jszip'
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // requis pour node:fs

/** Fichiers a inclure dans le ZIP (ordre alphabetique stable). */
const PRESS_KIT_FILES: ReadonlyArray<string> = [
  'bio-benjamin-bel.md',
  'charte-graphique-kovas.pdf',
  'fact-sheet-kovas-mai-2026.pdf',
  'kovas-icon-512.svg',
  'kovas-screenshot-dashboard.svg',
  'kovas-screenshot-mobile.svg',
  'logo-kovas-navy.svg',
  'logo-kovas-white.svg',
]

const README_CONTENT = `KOVAS — Kit medias presse
==========================

Editeur     : SASU Nexus 1993
Marque      : KOVAS (depot INPI classes 9 + 42)
Fondateur   : Benjamin Bel
Domaine     : kovas.fr
Contact     : contact@kovas.fr
Version     : Mai 2026

Contenu de ce ZIP
-----------------
- logo-kovas-navy.svg      : logo navy sur fond transparent (impression)
- logo-kovas-white.svg     : logo blanc sur fond transparent dark
- kovas-icon-512.svg       : icone application 512x512
- kovas-screenshot-dashboard.svg : capture dashboard 1920x1080 indicative
- kovas-screenshot-mobile.svg    : capture PWA mobile 390x844 indicative
- fact-sheet-kovas-mai-2026.pdf  : fiche de presentation 1 page A4
- charte-graphique-kovas.pdf     : palette + typo + principes DS v5
- bio-benjamin-bel.md      : biographie fondateur (200 mots, ton sobre)

Droits d'usage
--------------
Usage editorial autorise pour la presse, les blogs metier diagnostic
immobilier et les conferences. Citation obligatoire :
  KOVAS — SASU Nexus 1993, kovas.fr

Pour usage commercial ou modification : contact@kovas.fr.

Plus de visuels / interview
---------------------------
Demande a : contact@kovas.fr (reponse < 48h ouvrees).
`

/**
 * Genere le fichier ZIP et le sert en streaming binaire.
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const zip = new JSZip()

    // Repertoire racine en build/runtime : process.cwd() = apps/web/
    const baseDir = join(process.cwd(), 'public', 'press-kit')

    // Ajoute README a la racine du ZIP
    zip.file('README.txt', README_CONTENT)

    // Lecture parallele de tous les fichiers du press-kit
    const filesContent = await Promise.all(
      PRESS_KIT_FILES.map(async (name) => {
        try {
          const buf = await readFile(join(baseDir, name))
          return { name, buf }
        } catch (err) {
          // Fichier absent : on log mais on continue (degrade plutot que crash)
          console.warn(`[/presse/kit-medias] fichier manquant : ${name}`, err)
          return null
        }
      }),
    )

    for (const entry of filesContent) {
      if (entry) {
        zip.file(entry.name, entry.buf)
      }
    }

    // Generation du buffer ZIP (arraybuffer compatible BodyInit Web standard)
    const zipArrayBuffer = await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })

    const filename = 'kovas-press-kit-mai-2026.zip'

    return new NextResponse(zipArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zipArrayBuffer.byteLength),
        // Cache 1h cote CDN (les assets bougent rarement)
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (err) {
    console.error('[/presse/kit-medias] echec generation ZIP', err)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Generation du kit medias indisponible. Contactez contact@kovas.fr.',
      },
      { status: 500 },
    )
  }
}
