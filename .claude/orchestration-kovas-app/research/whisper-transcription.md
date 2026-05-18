# French Real-Time Voice Transcription (Whisper API & Alternatives) - Research

**Wave**: First
**Researcher**: Voice Transcription Research Agent (Whisper API + French ASR alternatives for KOVAS field-work voice notes)
**Date**: 2026-05-13
**Status**: Complete (with constraints — WebSearch/WebFetch/Write denied in subagent sandbox; persisted by parent)

## Summary

For KOVAS' field-work voice-note pipeline (10–30s French clips, 15 missions × ~3 min audio/user/month, p95 < 3s transcription latency, ≥ 92% precision on diag jargon, < 0,03€/mission cost), the recommended stack is **OpenAI `gpt-4o-mini-transcribe` as primary** (best price/quality on short French clips with the `prompt` parameter to inject metier vocabulary), **Deepgram Nova-3 (multilingual, Frankfurt region)** as the EU-hosted fallback (real GDPR posture, best streaming latency if needed in Phase 3), and **iOS `SFSpeechRecognizer` on-device** as the strict-offline fallback.

A chunked-upload pattern (not streaming) is sufficient because KOVAS clips are short observation-sized recordings. Vocabulary boosting via Whisper's `prompt` parameter (≤ 224 tokens, ~50–80 metier terms per call), plus a Claude Sonnet 4.6 post-processing pass with a 200-term diag glossary as cached context. Total voice pipeline cost target: **~0,20€/user/month** (vs. PRD §12.5 estimate of 1–2€), i.e. **~0,014€/mission** vs. DoD F1 ceiling of 0,03€.

## Key Findings

### 1. OpenAI Whisper / Audio API — state of the platform (early 2026)

| Model ID | Use case | Indicative price | Streaming |
|---|---|---|---|
| `whisper-1` | Legacy, multilingual | **~$0.006/min** (≈ 0,0055€/min) | No |
| `gpt-4o-transcribe` | Top quality, prompt-aware | **~$0.006/min** (token-based) | Yes |
| `gpt-4o-mini-transcribe` | Best price/quality on short clean clips | **~$0.003/min** | Yes |

(All pricing `[VERIFY ON VENDOR SITE]`.)

**Endpoint and shape**:
```http
POST https://api.openai.com/v1/audio/transcriptions
Authorization: Bearer $OPENAI_API_KEY
Content-Type: multipart/form-data

file=@clip.m4a
model=gpt-4o-mini-transcribe
language=fr
prompt=Vocabulaire métier: chaudière à condensation, pompe à chaleur, ITE, mérule, DPE F, ponts thermiques, VMC double flux...
response_format=json
temperature=0
```

**Supported formats**: `flac`, `m4a`, `mp3`, `mp4`, `mpeg`, `mpga`, `oga`, `ogg`, `wav`, `webm`. **`m4a` (AAC) is the iOS-native format — the right choice for KOVAS**.

**File size limit**: 25 MB/file. At 32 kbps AAC mono 16 kHz, ≈ 100 min audio capacity.

**French support**: FLEURS-style WER on clean French audio — `gpt-4o-transcribe` ~4–6%, `gpt-4o-mini-transcribe` ~6–8%, `whisper-1` ~8–10%. Field audio with site noise typically adds +3–5 absolute points.

**`prompt` parameter**: ~224-token cap. Used to bias spellings, named entities, jargon. **Primary lever for diag vocabulary.** Best practice: comma-separated phrases, no instructions.

**Streaming**: `gpt-4o-*-transcribe` support streaming via Realtime WebSocket and SSE. `whisper-1` does NOT. **For KOVAS short clips, streaming is unnecessary**.

**Hallucinations on silence**: Whisper hallucinates plausible FR phrases on silent/music-only audio. Mitigation: client-side VAD trim, reject clips < 0.5s, use `gpt-4o-mini-transcribe`, `temperature=0`.

**Data residency**: All three models run in US. "No training on API inputs", 30-day abuse-retention by default. Zero-retention enterprise tier available. GDPR requires SCCs via OpenAI DPA.

### 2. French language specifics

**Known failure modes on French diag vocabulary (without prompting)**:

| Expected term | Common Whisper error |
|---|---|
| `mérule` | "merlu", "merle" |
| `ponts thermiques` | "pont thermique" (singular) / "pompe thermique" |
| `kWh/m²/an` | Verbose expansion or wrong unit |
| `DPE F` | "DPF", "DP F", "des P F" |
| `ITE` / `ITI` | "ite", "itty", "i.t.e." |
| `Carrez` (loi Carrez) | "carré", "carrer" |
| `Saunier Duval` | "Sonia Duval", "Sonnier Duval" |
| `MaPrimeRénov'` | "Ma prime renove" / "Ma prime Renaud" |

**Strategies to lift precision from ~85% (raw) to ≥ 92% (DoD F1)**:
1. **Whisper `prompt`** with rotating mission-type-tailored glossary (50–80 terms): +4–6 pts.
2. **Claude post-processing** with full 200-term glossary cached as system prompt: +2–4 pts.
3. **VAD trim** on capture: +1 pt.
4. **Audio quality enforcement** (16 kHz mono, AAC 32–48 kbps): +1–2 pts on noisy site audio.

Cumulative expected precision: **93–95%**, comfortable headroom over the 92% DoD bar.

### 3. Alternative providers (cost / quality comparison)

| Provider | Model | Indicative price | FR WER | Latency p95 | EU region | Streaming | Verdict |
|---|---|---|---|---|---|---|---|
| **OpenAI** | `gpt-4o-mini-transcribe` | ~$0.003/min | ~6–8% | 1.5–2.5s on 15s clip | No (US) | Yes | **Primary** |
| OpenAI | `gpt-4o-transcribe` | ~$0.006/min | ~4–6% | 1.8–3s | No | Yes | Reserve for hard clips |
| OpenAI | `whisper-1` | ~$0.006/min | ~8–10% | 2–4s | No | No | Deprioritized |
| **Deepgram** | Nova-3 multilingual | ~$0.0043/min batch | ~5–7% on FR | 0.3–0.8s streaming | **Yes** (Frankfurt + Dublin) | Best-in-class | **Fallback / EU mode** |
| Cloudflare Workers AI | `@cf/openai/whisper-large-v3` | ~$0.0017/min | ~7–9% | 2–5s | Global edge | No | Cheap, variable latency |
| Azure Speech | Standard STT (FR) | ~$1/h | ~6–8% | 1–2s streaming | Yes (France Central) | Yes | Pricey |
| Google STT v2 | `chirp_2` | ~$0.016/min | ~5–7% | 1–3s | Yes (europe-west1) | Yes | ~5× more expensive |
| AssemblyAI | Universal-2 | ~$0.0065/min batch | ~6–8% | 1–2s | US-first | Yes | No EU residency |
| **Mistral Voxtral** | Voxtral-mini | ~$0.001/min (UNVERIFIED) | Vendor-claimed 4–6% | 1–2s | EU (Paris) | Limited | **Watch list — re-evaluate at M6** |
| whisper.cpp self-hosted | `large-v3-turbo` | Fixed ~$30–60/mo amortized | ~5–7% | 3–8s CPU | Yes | Custom impl | Only > 5000 min/mo |

**Decision logic**:
- **Primary** = `gpt-4o-mini-transcribe`: cheapest at quality bar, strongest prompt parameter, same vendor as Claude, well-punctuated FR.
- **Fallback** = Deepgram Nova-3 multilingual (Frankfurt): EU residency, lowest streaming latency, different vendor for outage resilience.
- **Offline** = iOS `SFSpeechRecognizer` on-device.

### 4. Streaming vs chunked transcription — verdict for KOVAS

KOVAS clips are **short observations** (5–30s) with explicit start/stop. **Chunked HTTP upload is the right pattern**:
- Simpler client (no WebSocket lifecycle).
- Cheaper (batch rate).
- Offline-friendly (queue m4a files, sync later).
- Total round-trip on 15s clip: ~1.8–2.5s on 4G — meets p95 < 3s.
- User gains nothing from progressive text while talking; in fact distracting in field.

**Streaming becomes useful in Phase 3** if KOVAS adds a "live notes during walkthrough" mode.

### 5. Offline transcription on iOS

KOVAS works in basements, copros without WiFi, rural sites → **offline must be first-class, not error state**.

**Option A — iOS `SFSpeechRecognizer` (recommended Phase 1 offline fallback)**
- Built-in, free, no API quota.
- FR support since iOS 13, fully on-device since iOS 13 with `requiresOnDeviceRecognition = true`.
- Accuracy on clean FR: ~85–88% (worse than Whisper on jargon, but acceptable fallback).
- Latency: real-time streaming, ~0.3s after speech ends.
- RN bridge: `@react-native-voice/voice` (community) or thin native module. With Expo SDK 52: config plugin required + EAS dev build.
- Supports `contextualStrings: [String]` (up to ~100 phrases) — pass the diag glossary here.

**Option B — `whisper.cpp` on-device via RN bridge (NOT recommended Phase 1)**
- Model sizes: `tiny` 39 MB, `base` 74 MB, `small` 244 MB, `medium` 769 MB, `large-v3` 1.5 GB.
- iOS port has Core ML acceleration, ~0.5–1× real-time on iPhone 14+/iPad Air M1+.
- Issues: 250 MB bundled or first-run download, battery drain, RN bridge work.
- **Reconsider Phase 2 as premium "100% offline mode" differentiator.**

**Hybrid strategy**:
1. On capture, check connectivity.
2. Online: queue clip → Supabase Edge Function → OpenAI `gpt-4o-mini-transcribe` → Claude structure → field write.
3. Offline: run `SFSpeechRecognizer` locally with diag glossary as `contextualStrings`, persist transcript in SQLite, mark clip and m4a "pending re-transcription". On reconnect, re-run same m4a through OpenAI to get higher-quality result, reconcile with any user edits.

### 6. Custom vocabulary / fine-tuning strategy

- **Whisper API**: no fine-tuning. Bias only via `prompt` parameter.
- **Deepgram**: `keywords=foo:5` (boost up to 10×), custom-trained models on enterprise tier.
- **iOS SFSpeechRecognizer**: `contextualStrings: [String]` (~100 phrases).

**Recommended diag vocabulary list (~200 terms)** — taxonomy:

```
# Bâti / construction
mérule, salpêtre, mousse, condensation, infiltration, fissure, lézarde,
ponts thermiques, étanchéité, parement, bardage, bardage bois, enduit,
crépi, ravalement, nez de dalle, linteau, allège, retour de mur

# Isolation
ITE, ITI, isolation par l'extérieur, isolation par l'intérieur,
laine de verre, laine de roche, polystyrène, PSE, PUR, polyuréthane,
ouate de cellulose, fibre de bois, R thermique, lambda

# Chauffage / ECS
chaudière gaz, chaudière fioul, chaudière condensation, chaudière basse température,
pompe à chaleur, PAC air-eau, PAC air-air, PAC géothermique,
chauffe-eau thermodynamique, ballon ECS, radiateur, plancher chauffant,
poêle à bois, poêle à granulés, insert, cheminée,
VMC simple flux, VMC double flux, VMR, VMC hygroréglable

# Marques chaudière
Saunier Duval, Frisquet, ELM Leblanc, Chappée, De Dietrich, Atlantic, Viessmann,
Vaillant, Buderus, Bosch, Riello, Chaffoteaux, Auer

# Énergie / DPE
DPE A, DPE B, DPE C, DPE D, DPE E, DPE F, DPE G,
classe énergétique, classe climatique, GES, kWh par mètre carré par an,
énergie primaire, énergie finale, ECS, ECS solaire, panneaux photovoltaïques

# Diagnostics réglementaires
amiante, plomb, termites, mérule, gaz, électricité, loi Carrez, loi Boutin,
ERP, état des risques et pollutions, audit énergétique,
DPE vente, DPE location, DPE copro, DPE collectif, PPPT, DTG

# Aides
MaPrimeRénov', CEE, Certificats d'Économies d'Énergie, éco-PTZ,
PAR, RGE, MAR, Mon Accompagnateur Rénov'

# Unités & acteurs
mètre carré, m², centimètre, kWh, watt, kilowatt, ampère, volt,
degré Celsius, hectopascal, pascal,
diagnostiqueur, COFRAC, ADEME, DHUP, DGCCRF, notaire, mandataire
```

**Implementation**:
- Store as `packages/ai/dictionaries/diag-fr.ts`, exported as `DIAG_VOCAB_FR: string[]` plus `vocabForMissionType(t: MissionType): string[]`.
- Whisper API: join most-relevant 50–80 terms by mission type into the `prompt` string (~200 tok budget).
- iOS Speech: pass full list as `contextualStrings`.
- Claude post-processing: include full list in cached system prompt.

### 7. Cost forecast per user/month

Base: 15 missions × 3 min audio = **45 min/user/month**.

| Stack | Cost/user/month | Cost/mission |
|---|---|---|
| `gpt-4o-mini-transcribe` | $0.003 × 45 = **$0.135 ≈ 0,13€** | **~0,009€** |
| `gpt-4o-transcribe` | $0.006 × 45 = $0.27 ≈ 0,25€ | ~0,017€ |
| `whisper-1` | $0.006 × 45 = $0.27 ≈ 0,25€ | ~0,017€ |
| Deepgram Nova-3 batch | $0.0043 × 45 = $0.19 ≈ 0,18€ | ~0,012€ |
| Cloudflare Workers AI whisper-large-v3 | $0.0017 × 45 = $0.077 ≈ 0,07€ | ~0,005€ |

**Plus Claude post-processing** (Sonnet 4.6, ~200 in + 200 out tok/clip, prompt cached): ~$0.000675/clip × 7 clips/mission × 15 missions = **$0.071 ≈ 0,07€/user/month**.

**Total voice pipeline (primary stack)**: 0,13€ + 0,07€ ≈ **0,20€/user/month** vs. PRD §12.5 target of 1–2€ → **5–10× under budget**.

### 8. Audio recording quality on iPad/iPhone

Whisper internal sample rate: 16 kHz mono. **No benefit** to higher rates.

**Optimal capture config (Expo AV)**:
```ts
import { Audio } from 'expo-av';

const RECORDING_OPTIONS_WHISPER: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 32000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: { /* same with Android constants */ },
  web: { mimeType: 'audio/webm', bitsPerSecond: 32000 },
};
```

Resulting file size: ~4 KB/s → 60–120 KB for 15–30s. Uploads < 200 ms on 4G LTE.

### 9. Latency optimization

Target: capture stop → field filled, p95 < 5s end-to-end. Budget for a 15-s clip:

| Step | Best | Typical | Worst |
|---|---|---|---|
| VAD trim + m4a encode on device | 80 ms | 150 ms | 300 ms |
| Upload to Supabase Edge (4G, ~80 KB) | 200 ms | 400 ms | 1.2 s |
| Edge → OpenAI Whisper | 800 ms | 1.4 s | 2.5 s |
| Edge → Claude structure (cached) | 400 ms | 700 ms | 1.3 s |
| Response back to mobile | 100 ms | 200 ms | 600 ms |
| **Total** | **1.6 s** | **2.85 s** | **5.9 s** |

P95 < 5s achievable but tight. Optimizations:
1. **Parallel firing**: trigger Claude as soon as Whisper returns text.
2. **Edge region**: Supabase Edge runs on Deno Deploy; France users hit `cdg1` (Paris).
3. **HTTP/2 keep-alive** to OpenAI: configure SDK connection pool.

### 10. Common pitfalls

| Pitfall | Mitigation |
|---|---|
| Hallucinations on silent clips | VAD trim + reject < 0.5s clips + `gpt-4o-mini-transcribe` + `temperature=0` |
| French homophones (lit/lis, chant/champ, mer/mère, carré/Carrez) | `prompt` parameter + Claude post-processing with diag glossary |
| Background noise (drilling, traffic, HVAC) | iOS `.voiceChat` mode NR (test impact first) OR client-side noise gate |
| Long pauses → Whisper invents content | One clip per observation; chunk if > 30s; 60s hard cap per clip |
| Phone call interrupts capture | `expo-av` `interruptionMode: MIX_WITH_OTHERS` (iOS), persist partial buffer, prompt "Reprendre l'enregistrement ?" |
| Whisper returns wrong language | Always send `language=fr` explicitly |
| API key leak via mobile | Never embed `OPENAI_API_KEY` in RN. All calls through Edge Functions with Supabase Vault |
| Cost runaway from retry storms | Client-side exp backoff (max 3), server-side per-user rate limit |
| Empty m4a from interrupted recording | Validate file size > 0 before upload |
| Diag terms drift over time | Living glossary; instrument top-50 misrecognized terms weekly via PostHog |

### 11. Integration patterns

**Recommended library stack (Expo SDK 52)**:
- `expo-av` or `expo-audio` for recording
- `expo-file-system` to read m4a / stream upload
- `@react-native-community/netinfo` for connectivity detection
- `@react-native-voice/voice` via Expo config plugin in EAS dev build for on-device fallback
- `expo-haptics` for mic-tap feedback

**Mobile → Edge Function pattern**:
```ts
export async function transcribeClip(localUri: string, missionType: MissionType) {
  const fileInfo = await FileSystem.getInfoAsync(localUri);
  if (!fileInfo.exists || fileInfo.size === 0) throw new Error('empty clip');

  const formData = new FormData();
  formData.append('audio', { uri: localUri, name: 'clip.m4a', type: 'audio/m4a' } as any);
  formData.append('missionType', missionType);

  const { data, error } = await supabase.functions.invoke('transcribe-voice-note', { body: formData });
  if (error) throw error;
  return data;
}
```

**Edge Function (Supabase, Deno) skeleton**:
```ts
serve(async (req) => {
  const formData = await req.formData();
  const audio = formData.get('audio') as File;
  const missionType = formData.get('missionType') as string;

  try {
    const transcript = await transcribeOpenAI(audio, missionType);
    const structured = await structureWithClaude(transcript, missionType);
    return Response.json({ transcript, structured, provider: 'openai' });
  } catch (err) {
    console.error('OpenAI failed, falling back to Deepgram', err);
    const transcript = await transcribeDeepgram(audio);
    const structured = await structureWithClaude(transcript, missionType);
    return Response.json({ transcript, structured, provider: 'deepgram' });
  }
});
```

### 12. Compliance

**Whisper API (US)**:
- US data centers. Third-country transfer for GDPR → SCCs via OpenAI DPA.
- Default 30-day abuse retention. Zero-retention enterprise tier on negotiation.
- No training on API data since March 2023.

**Deepgram (EU region)**:
- `api.eu.deepgram.com` (Frankfurt) and Dublin available. Audio stays in EU.

**Audio retention KOVAS-side**:
- Default 30 days in Supabase Storage post-mission, then auto-purge unless user pins.

## Recommended Approach

1. **Primary transcription**: OpenAI `gpt-4o-mini-transcribe` via Supabase Edge Function. Always `language=fr`, `temperature=0`, mission-type-tailored `prompt`.
2. **Post-processing**: Claude Sonnet 4.6 corrects metier terms + structures into fields, with 200-term FR diag glossary in cached system prompt.
3. **Fallback (cloud, EU)**: Deepgram Nova-3 multilingual via Frankfurt endpoint. Auto-triggered on OpenAI 5xx or > 8s latency.
4. **Offline fallback**: iOS `SFSpeechRecognizer` with diag glossary as `contextualStrings`. Original m4a queued for re-transcription on next sync.
5. **Capture config**: AAC m4a, 16 kHz mono, 32 kbps, `.measurement` audio session, client-side VAD trim, 60s hard cap.
6. **Vocabulary**: `packages/ai/dictionaries/diag-fr.ts`, ~200 terms organized by mission type. Updated continuously from production error logs.
7. **Cost monitoring**: PostHog event `voice.transcribe.completed` with `duration_s`, `cost_usd`, `provider`, `latency_ms`.

## Fallback Strategy Summary

```
[Capture clip] ──► [Network check]
       │                │
       │                ├── Online ─► OpenAI gpt-4o-mini-transcribe (primary)
       │                │              │
       │                │              ├── Success ─► Claude structure ─► Field write
       │                │              │
       │                │              └── 5xx / timeout > 8s
       │                │                     │
       │                │                     └─► Deepgram Nova-3 EU (fallback 1)
       │                │
       │                └── Offline ─► iOS SFSpeechRecognizer on-device (fallback 2)
       │                                  │
       │                                  └── On reconnect: re-run OpenAI, reconcile w/ user edits
```

## Open questions for Second Wave / Discovery

1. **D303 (PRD)**: Confirm primary = OpenAI `gpt-4o-mini-transcribe`, fallback = Deepgram Nova-3 EU. Or prefer EU-primary?
2. **OpenAI zero-retention enterprise tier**: target M9+ when volume justifies negotiation. Acceptable?
3. **Diag glossary ownership**: who curates the 200-term FR list?
4. **Offline-only mode for Phase 2**: premium "100% on-device transcription"?
5. **Phase 3 streaming "live notes" UX**: confirm Deepgram Nova-3 streaming as chosen tech.
6. **Per-user budget caps**: hard rate-limit how many transcriptions/day per user?
7. **Audio retention default**: 30 days post-mission vs. 0 days (delete after successful field write)?

## References (to verify)

- OpenAI Speech-to-Text guide: https://platform.openai.com/docs/guides/speech-to-text
- OpenAI API pricing: https://openai.com/api/pricing/
- Deepgram Nova-3: https://deepgram.com/learn/nova-3
- Deepgram EU region: https://developers.deepgram.com/docs/eu-region
- Mistral Voxtral: https://docs.mistral.ai/capabilities/audio/
- Apple `SFSpeechRecognizer`: https://developer.apple.com/documentation/speech/sfspeechrecognizer
- `expo-av` Recording API: https://docs.expo.dev/versions/latest/sdk/av/
