import { describe, expect, it } from 'vitest'
import { extractSnapshot } from './snapshot-extractor'

const FETCHED_AT = '2026-05-27T08:00:00.000Z'
const HASH = 'hash-fixture-001'

const FIXTURE_LICIEL = `<!doctype html>
<html lang="fr">
<head>
  <title>Liciel — Logiciel de diagnostic immobilier</title>
  <meta name="description" content="Le leader français du logiciel de diagnostic immobilier. DPE, amiante, plomb, gaz, électricité, termites.">
</head>
<body>
  <header><nav>...</nav></header>
  <h1>Le logiciel n°1 du diagnostic immobilier</h1>
  <section>
    <h2>Tous les diagnostics couverts</h2>
    <p>DPE, Amiante, Plomb, Gaz, Électricité, Termites, Carrez, Boutin. ADEME certifié, Cofrac compatible.</p>
  </section>
  <section>
    <h2>Tarifs simples et transparents</h2>
    <p>À partir de 49 €/mois. Pack Pro à 89€/mois. Premium 149,90 € /mois.</p>
    <button>Essayer gratuitement</button>
    <a href="/signup" class="btn-primary">Commencer maintenant</a>
  </section>
  <section>
    <h2>Ils nous font confiance</h2>
    <p>Plus de 5000 diagnostiqueurs nous font confiance chaque jour.</p>
  </section>
  <script>const x = 42;</script>
</body>
</html>`

const FIXTURE_MINIMAL =
  '<html><head><title>Petit éditeur</title></head><body><h1>Bienvenue</h1></body></html>'

const FIXTURE_NO_META = `<html>
<head><title>Test sans meta</title></head>
<body>
  <h1>Header principal</h1>
  <h2>Section A</h2>
  <h2>Section B</h2>
  <h2>Section C</h2>
  <a class="cta-link" href="/x">Découvrir</a>
  <button>OK</button>
</body>
</html>`

describe('extractSnapshot — fixture Liciel-like complète', () => {
  const snap = extractSnapshot(FIXTURE_LICIEL, 'https://www.liciel.com', FETCHED_AT, HASH)

  it('garde url, fetched_at et content_hash tels que passés', () => {
    expect(snap.url).toBe('https://www.liciel.com')
    expect(snap.fetched_at).toBe(FETCHED_AT)
    expect(snap.content_hash).toBe(HASH)
  })

  it('extrait le title', () => {
    expect(snap.title).toBe('Liciel — Logiciel de diagnostic immobilier')
  })

  it('extrait la meta description', () => {
    expect(snap.meta_description).toContain('leader français')
    expect(snap.meta_description).toContain('DPE')
  })

  it('extrait le premier H1', () => {
    expect(snap.h1).toBe('Le logiciel n°1 du diagnostic immobilier')
  })

  it('extrait tous les H2 dans l ordre', () => {
    expect(snap.h2_list).toEqual([
      'Tous les diagnostics couverts',
      'Tarifs simples et transparents',
      'Ils nous font confiance',
    ])
  })

  it('détecte les prix EUR (49, 89, 149) dédupliqués et triés', () => {
    expect(snap.prices_eur_detected).toContain(49)
    expect(snap.prices_eur_detected).toContain(89)
    expect(snap.prices_eur_detected).toContain(149)
    // Vérif tri ascendant
    const sorted = [...snap.prices_eur_detected].sort((a, b) => a - b)
    expect(snap.prices_eur_detected).toEqual(sorted)
  })

  it('extrait les CTA principaux (button + a.btn)', () => {
    expect(snap.cta_texts).toContain('Essayer gratuitement')
    expect(snap.cta_texts).toContain('Commencer maintenant')
  })

  it('détecte les feature keywords métier', () => {
    expect(snap.feature_keywords).toContain('dpe')
    expect(snap.feature_keywords).toContain('amiante')
    expect(snap.feature_keywords).toContain('plomb')
    expect(snap.feature_keywords).toContain('cofrac')
    expect(snap.feature_keywords).toContain('ademe')
  })

  it('détecte 5000 diagnostiqueurs comme social proof', () => {
    expect(snap.social_proof_count).toBe(5000)
  })

  it('a un raw_text_length > 0', () => {
    expect(snap.raw_text_length).toBeGreaterThan(50)
  })

  it('strip les balises <script> et <style>', () => {
    // Le 'const x = 42;' du script ne doit pas se retrouver
    // dans la longueur de texte effective (heuristique)
    expect(snap.raw_text_length).toBeLessThan(FIXTURE_LICIEL.length)
  })
})

describe('extractSnapshot — fixture minimale', () => {
  const snap = extractSnapshot(FIXTURE_MINIMAL, 'https://example.com', FETCHED_AT, HASH)

  it('extrait title et h1 même sur HTML très court', () => {
    expect(snap.title).toBe('Petit éditeur')
    expect(snap.h1).toBe('Bienvenue')
  })

  it('renvoie tableaux et compteurs vides quand pas de contenu', () => {
    expect(snap.h2_list).toEqual([])
    expect(snap.prices_eur_detected).toEqual([])
    expect(snap.cta_texts).toEqual([])
    expect(snap.feature_keywords).toEqual([])
    expect(snap.social_proof_count).toBe(0)
  })

  it('a meta_description null quand absente', () => {
    expect(snap.meta_description).toBeNull()
  })
})

describe('extractSnapshot — fixture sans meta + CTA via class', () => {
  const snap = extractSnapshot(FIXTURE_NO_META, 'https://example.com', FETCHED_AT, HASH)

  it('détecte plusieurs H2', () => {
    expect(snap.h2_list).toHaveLength(3)
  })

  it('détecte CTA via class="cta-link" ET via button', () => {
    expect(snap.cta_texts).toContain('Découvrir')
    expect(snap.cta_texts).toContain('OK')
  })

  it('a meta_description null', () => {
    expect(snap.meta_description).toBeNull()
  })
})

describe('extractSnapshot — robustesse parsing', () => {
  it('renvoie title null si pas de balise <title>', () => {
    const snap = extractSnapshot('<html><body>vide</body></html>', 'x', FETCHED_AT, HASH)
    expect(snap.title).toBeNull()
  })

  it('plafonne h2_list à 20 éléments', () => {
    const manyH2 = Array.from({ length: 30 }, (_, i) => `<h2>Section ${i}</h2>`).join('')
    const snap = extractSnapshot(`<html><body>${manyH2}</body></html>`, 'x', FETCHED_AT, HASH)
    expect(snap.h2_list).toHaveLength(20)
  })

  it('plafonne cta_texts à 10 éléments', () => {
    const manyBtns = Array.from({ length: 15 }, (_, i) => `<button>CTA ${i}</button>`).join('')
    const snap = extractSnapshot(`<html><body>${manyBtns}</body></html>`, 'x', FETCHED_AT, HASH)
    expect(snap.cta_texts.length).toBeLessThanOrEqual(10)
  })

  it('filtre les prix improbables (>9999€ comme codes postaux)', () => {
    const html =
      '<html><body><p>Code postal 75008</p><p>Prix 29€</p><p>10000 € c est faux</p></body></html>'
    const snap = extractSnapshot(html, 'x', FETCHED_AT, HASH)
    expect(snap.prices_eur_detected).toContain(29)
    expect(snap.prices_eur_detected).not.toContain(10000)
    expect(snap.prices_eur_detected).not.toContain(75008)
  })

  it('détecte social_proof avec séparateurs : "1 200 clients"', () => {
    const html =
      '<html><body><p>Plus de 1 200 clients professionnels nous font confiance.</p></body></html>'
    const snap = extractSnapshot(html, 'x', FETCHED_AT, HASH)
    expect(snap.social_proof_count).toBe(1200)
  })

  it('garde le maximum si plusieurs mentions chiffrées', () => {
    const html =
      '<html><body><p>500 cabinets et 8000 utilisateurs nous font confiance.</p></body></html>'
    const snap = extractSnapshot(html, 'x', FETCHED_AT, HASH)
    expect(snap.social_proof_count).toBe(8000)
  })

  it('garde 0 pour social proof si pas de mention chiffrée', () => {
    const html = '<html><body><p>Nous adorons nos clients.</p></body></html>'
    const snap = extractSnapshot(html, 'x', FETCHED_AT, HASH)
    expect(snap.social_proof_count).toBe(0)
  })

  it('dédoublonne les CTA identiques', () => {
    const html =
      '<html><body><button>Essayer</button><button>Essayer</button><button>Essayer</button></body></html>'
    const snap = extractSnapshot(html, 'x', FETCHED_AT, HASH)
    expect(snap.cta_texts.filter((c) => c === 'Essayer')).toHaveLength(1)
  })

  it('ignore les <a> sans classe "btn|button|cta"', () => {
    const html =
      '<html><body><a class="link" href="/foo">Lien banal</a><a class="cta-x" href="/y">Vrai CTA</a></body></html>'
    const snap = extractSnapshot(html, 'x', FETCHED_AT, HASH)
    expect(snap.cta_texts).toContain('Vrai CTA')
    expect(snap.cta_texts).not.toContain('Lien banal')
  })
})
