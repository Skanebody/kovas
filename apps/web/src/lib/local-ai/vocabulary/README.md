# Lexique métier — diagnostic immobilier français

Module unique : `diagnostic-jargon.ts`

## Pourquoi

Whisper (et Claude dans une moindre mesure) butent sur le jargon métier :
MPCA, calorifugeage, hespérophane, AGCP, Cep, Ubat, ψ psi, BAR-TH-104, etc.

Solution : embarquer un lexique structuré (~600 termes) et l'injecter :

- **Whisper** → `prompt` initial (boost reconnaissance, cap 224 tokens)
- **Claude** → `system` prompt (compréhension, structuration JSON)

## API

```ts
import {
  DIAGNOSTIC_JARGON,
  buildWhisperPrompt,
  buildClaudeContextVocabulary,
} from '@/lib/local-ai/vocabulary/diagnostic-jargon'

// 10 sections : dpe, amiante, plomb, gaz, electricite, termites,
//               mesurage, erp, batiment, marques, administratif
DIAGNOSTIC_JARGON.dpe.chauffage // ['chaudière', 'PAC air-eau', 'COP', ...]

// Whisper : 50-80 termes les plus distinctifs, <= 224 tokens
const wp = buildWhisperPrompt(['dpe_vente', 'amiante_vente'])
// → "Diagnostic immobilier français : 3CL-DPE-2021, kWhEP/m².an, ..."

// Claude : bloc structuré pour system prompt
const cv = buildClaudeContextVocabulary(['dpe_vente', 'amiante_vente'])
// → "VOCABULAIRE MÉTIER À CONNAÎTRE :\n--- DPE ---\nmethode: 3CL, ..."
```

L'entrée accepte indifféremment :
- les mission types DB (`dpe_vente`, `amiante_avant_travaux`, `plomb_crep`...)
- les sections logiques (`dpe`, `amiante`, `plomb`...)

Sections transverses (`mesurage`, `batiment`, `marques`, `administratif`) sont
toujours injectées : surfaces, structures, marques d'équipement et acteurs
administratifs sont rencontrés sur toute mission terrain.

## Intégrations existantes

| Endpoint | Usage |
|---|---|
| `apps/web/src/app/api/transcribe/route.ts` | `formData.append('prompt', buildWhisperPrompt(missionTypes))` |
| `apps/web/src/lib/claude-structurer.ts` | `system` prompt enrichi via `buildClaudeContextVocabulary(diagnostics)` |
| `apps/web/src/app/api/structure/route.ts` | Récupère les mission types depuis le dossier et les passe à `structureWithClaude` |

Si une nouvelle Edge Function Supabase (ex. `transcribe-audio`, `extract-canonical`)
est créée par la suite, importer le même module et procéder de la même façon.

## Conventions

- Identifiants TS en anglais.
- Termes du lexique en français (orthographe métier officielle FR).
- Arrays `readonly`, lexique immuable.
- TypeScript strict, zéro `any`.

## Limites Whisper

OpenAI Whisper `prompt` est tronqué à ~224 tokens. La sélection se fait sur la
table `HIGH_SIGNAL_TERMS` (acronymes, termes rares à forte valeur ajoutée).
Les ~600 termes complets ne servent qu'à Claude.
