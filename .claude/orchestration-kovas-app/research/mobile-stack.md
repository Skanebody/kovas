# Mobile Stack (React Native + Expo) — Research

**Wave**: First
**Researcher**: First-wave research agent — React Native + Expo mobile stack, iPad-first offline field app
**Date**: 2026-05-13
**Status**: Complete (delivered inline by subagent — file write was blocked in agent sandbox; persisted by parent orchestrator)

> **Environment limitation**: WebSearch, WebFetch, Write, and Bash were all denied in the subagent session. Findings rest on training knowledge (cutoff Jan 2026, which covers the full Expo SDK 52 cycle and into SDK 53). Items requiring live verification are tagged **[VERIFY]**. The strategic recommendations (library choices, build-vs-buy, architecture pattern) are stable.

## Summary

The locked stack (Expo SDK 52, TS strict, NativeWind 4, Skia, Reanimated 3, Zustand, TanStack Query) is production-grade for an iPad-first field app. Three real architectural decisions beyond the lock: (1) **op-sqlite + Drizzle ORM + custom 2-week sync layer** over WatermelonDB — WatermelonDB's reactive ORM fights TanStack Query and Supabase Realtime, and op-sqlite is materially faster (2-10x on writes). (2) **`react-native-vision-camera@4` instead of `expo-camera`** — Vision Camera supports frame processors (live equipment recognition overlay), RAW, and fine-grained exposure control; works in Expo via config plugin in a dev client. (3) **`@shopify/react-native-skia` for diagnostic sketches, not a PencilKit wrapper** — no maintained PencilKit-for-RN library exists and PKDrawing's binary format doesn't round-trip cleanly to a Supabase/web target. **LiDAR room scanning via RoomPlan is feasible but requires a custom Swift Turbo Module (~2-3 weeks); ship photo-based croquis P0, LiDAR Phase 1.5.**

## Key Findings

### 1. Expo SDK 52 capabilities and roadmap

- **SDK 52**: Released **Nov 12, 2024**. Stable, widely deployed in production. iOS 15.1+ minimum, Xcode 16+.
- **SDK 53**: Released **Apr 30, 2025**. React Native 0.79, React 19, new architecture default-on.
- **SDK 54**: Expected late 2025 / early 2026. **[VERIFY]** what's current at project start.

**Practical advice**: PRD locks SDK 52, but by Q2 2026 SDK 53 (or 54) will be the current LTS-equivalent. Start on the latest SDK at project kickoff. Expo supports the last ~3 SDKs; staying current avoids forced migrations mid-beta.

**New architecture (Fabric + TurboModules)**:
- Opt-in in SDK 52, default-on in SDK 53.
- All PRD-locked libs (Reanimated 3.16+, Skia 1.5+, NativeWind 4, expo-blur, react-native-svg 15+) have shipped New Arch support by SDK 52.
- **Action**: Set `"newArchEnabled": true` in `app.json` from day 1.

**Media APIs (SDK 52)**:
- `expo-camera@16.x`: Full Camera2/AVFoundation rewrite. HEIF on iOS, EXIF preserved. **No frame processor pipeline.**
- `expo-audio@0.4.x`: **New, replaces `expo-av` audio.** `expo-av` is deprecated for audio. Split into `expo-audio` + `expo-video`.
- `expo-video@2.x`: video playback.
- `expo-image@2.x`: fast image display with caching, blurhash, transitions.

**Apple Pencil 2 support**:
- Basic touch from Pencil arrives as regular touches.
- Pressure (`force`) does come through on iOS via `event.nativeEvent.force` in `PanResponder` / `Gesture.Pan()` (undocumented in RN core) and via `TouchInfo.force` in Skia (documented).
- Tilt (`altitudeAngle`, `azimuthAngle`) and **Pencil hover** (iPad Pro M2+) require a **custom native Turbo Module**. No off-the-shelf Expo-friendly lib exposes them at training cutoff. **[VERIFY]**.

**iPad-specific**:
- **Stage Manager / multi-window**: Set `UIRequiresFullScreen=false`. Use `useWindowDimensions`, not `Dimensions.get('screen')`.
- **Pencil hover** (M2/M4 iPad Pro): native `UIHoverGestureRecognizer` + `pencilHoverPose` — not in RN core; ~80 LOC Turbo Module.
- **Split View / Slide Over**: works automatically with responsive layout.
- **Keyboard shortcuts** (Cmd+key): `react-native-keycommands` or ~50 LOC custom module.

**expo-router 3+ vs legacy**:
- `expo-router@4.x` ships with SDK 52. File-based, typed routes, deep linking.
- **Strongly recommended for KOVAS**. Many screens (mission list/detail/capture flows/settings); typed routes prevent runtime errors. TanStack Query integrates fine.

**Verdict**: SDK 52 production-ready. Two non-obvious effort items: ~1 week Pencil hover/tilt Turbo Module (defer to Phase 1.5), ~1 week proper multi-window layout.

### 2. Offline-first architecture patterns

**Option comparison** (versions at training cutoff):

| Library | Version | Engine | API style | Encryption | FTS5 | Best for |
|---|---|---|---|---|---|---|
| **op-sqlite** | 11.x | SQLCipher-capable, JSI | Raw SQL + types | Yes | Yes | High-perf custom layer |
| WatermelonDB | 0.27+ | SQLite (LokiJS web) | ORM, observable | Indirect | No native | Complex local-only logic, huge rowcounts |
| expo-sqlite | 15.x (SDK 52) | SQLite, JSI | Raw SQL + helpers | Limited | Yes | Minimal deps |
| **Drizzle ORM + op-sqlite** | drizzle 0.30+ | op-sqlite | TypeSafe SQL builder | Inherits | Inherits | **Recommended** |
| PowerSync | 1.x | SQLite + managed sync | SQL + sync engine | Yes | Yes | Drop-in PG sync, paid, opinionated |

**Recommendation: op-sqlite + Drizzle ORM**.
- KOVAS missions: ~50-200 records/user/month + ~10-50 photos each. Small for any DB. **Bottleneck is photo files, not row counts.**
- op-sqlite's headroom enables FTS later (search across missions/notes).
- Drizzle: TypeScript safety end-to-end, integrates with `drizzle-kit` for migrations versioned alongside `supabase/migrations/`.
- WatermelonDB rejected: model+observer pattern fights TanStack Query + Supabase Realtime.

**Sync architecture (custom layer, ~2 weeks effort)**:

```
Local op-sqlite tables mirror Supabase tables: mission, client, photo, voice_note, sketch
+ outbox table: pending mutations (op, table, row_id, payload, created_at, retries)
+ tombstones table: deletes to propagate
```

Flow:
1. Write locally (Zustand action) → insert into target table + insert into `outbox`.
2. TanStack Query optimistic update → UI shows write immediately.
3. Sync worker (singleton in `useEffect` at app root + `expo-network` for connectivity) drains outbox via Supabase REST/Realtime with exponential backoff.
4. On reconnect: Supabase Realtime channel re-subscribes, pulls deltas since last `synced_at` watermark.

**Conflict resolution**:
- **Last-write-wins by server `updated_at`**: default for 95% of fields.
- **Field-level merge** for mission status, free-text notes: keep both versions with `conflict_pending` flag, surface in UI when both sides modified within sync window.
- **CRDT (Yjs/Automerge) rejected**: overkill; mobile is single-user-per-mission, web admin rarely concurrent on same mission. Saves ~3 weeks.
- **Tombstone retention**: 30 days, then GC.

**Photo storage offline**:
- Originals to `${FileSystem.documentDirectory}missions/{missionId}/photos/{photoId}.heic`.
- Store `local_uri`, `remote_url`, `sync_state` in `photo` row.
- On sync: Supabase Storage resumable upload (TUS) via `@supabase/storage-js@2.x` with `upsert`.
- **Keep local file 90 days** (configurable) for offline re-view, then delete file/keep row.
- Generate 1024px JPEG preview (~100KB) via `expo-image-manipulator@13.x` at capture; sync preview first on cellular, original on Wi-Fi.

**Sync queue + retry**:
- Hand-rolled (50 LOC) or `p-retry@6.x`.
- Backoff: 1s, 2s, 4s, 8s, 16s, 60s, 5min, 30min, 1h. Cap 1h.
- **Don't rely on `expo-task-manager` + `expo-background-fetch`**: iOS fires them every ~15min and unreliably. Sync on foreground or explicit user action. Push notification from a server-driven check is the reliable trigger.

**TanStack Query offline persistence**:
- `@tanstack/query-async-storage-persister` + **`react-native-mmkv@2.x`** (30x faster than AsyncStorage, works with new arch).
- `expo-secure-store` only for tokens.

### 3. Apple Pencil + LiDAR integration

**Apple Pencil 2 in Expo**:
- **No production-ready PencilKit-for-RN library** (training cutoff). PencilKit produces `PKDrawing` (Apple binary), not round-trip-friendly to Supabase JSONB or to a web canvas.
- **Recommended**: Skia canvas + manual stroke capture, JSON-serializable strokes.

Sketch with `@shopify/react-native-skia@1.7+`:
```tsx
const path = useSharedValue(Skia.Path.Make());
const strokes = useSharedValue<Stroke[]>([]);

const gesture = Gesture.Pan()
  .onBegin((e) => {
    path.value.moveTo(e.x, e.y);
    // e.force is pressure on iOS (0-1)
  })
  .onUpdate((e) => {
    path.value.lineTo(e.x, e.y);
    // capture {x, y, force, timestamp}
  })
  .onEnd(() => {
    strokes.value = [...strokes.value, { points: [...] }];
  });
```

For **tilt and azimuth** (Pencil 2 native): small Swift Turbo Module wrapping `UITouch.altitudeAngle` / `UITouch.azimuthAngle`. ~80 LOC. Only worth it if variable line width from tilt is a Phase 1 differentiator — likely not.

**Existing drawing libs**:

| Library | State | Verdict |
|---|---|---|
| `react-native-sketch-canvas` | Unmaintained since 2022, Bridge arch | **Reject** |
| `@benjeau/react-native-draw` | Older API | Reject (Skia better) |
| `react-native-signature-canvas` | WebView signature pad | Use only for **eIDAS signature step** |
| `@shopify/react-native-skia` | First-class New Arch, active | **Recommended primary** |

**LiDAR / RoomPlan reality (2026)**:
- **RoomPlan** (iOS 16+, iPad Pro 2020+/iPhone Pro 12+): ~30s guided scan, ±1-2cm wall accuracy. Output `CapturedRoom` (walls/doors/windows/openings + furniture). 30-90s scan time per room.
- **No first-class Expo/RN plugin** at cutoff. Required: custom Swift Turbo Module wrapping `RoomCaptureSession`. **Effort: 2-3 weeks** for a Swift+RN-bridge-comfortable developer.
- `react-native-arkit` is **abandoned**.
- Output mapping: serialize `CapturedRoom.walls` → JSON, render in Skia 2D for editing.
- Practical precision: ±2-5cm on standard rooms; degrades with reflective/glass/dark surfaces. Struggles with cluttered/historic Parisian apartments.

**Build vs buy — LiDAR**:
- **Phase 1 (P0)**: Photo-based croquis via Claude Vision + manual Skia edits. Ship this first.
- **Phase 1.5 / Phase 2**: Build the RoomPlan native module — 3 weeks. Unique differentiator for high-end persona.

### 4. Bluetooth LE for distance meters

**Hardware target reality**:
- **Bosch GLM 50 C / 100-25 C / etc.**: BLE-enabled, "MeasureOn" app protocol. **No public Bosch SDK**. Community has reverse-engineered BLE characteristic UUIDs/frame format.
- **Leica DISTO X3 / X4 / X6**: Bluetooth Smart. **Official DISTO transfer protocol** published in Leica developer kit (on request). Community libs exist. X6 has image-aided targeting.
- **Stabila LD 520**: BLE, less common in FR market.
- **Cheap Chinese clones**: proprietary apps, undocumented BLE.

**Recommendation**: **Phase 1 = Leica DISTO X3/X4 only** (best documentation, most common in pro market). Bosch GLM 50C Phase 1.5 after reverse-engineering against real hardware. Cheap clones Phase 2+.

**RN libraries**:

| Library | Status | Verdict |
|---|---|---|
| **`react-native-ble-plx@3.x`** | Maintained (Dotintent), JSI, used in production, Expo plugin available | **Recommended** |
| `react-native-ble-manager` | Maintained, older callback API | Alternative, less idiomatic |
| `react-native-bluetooth-classic` | Classic BT only | Reject (not BLE) |

**iOS background BLE limitations**:
- `bluetooth-central` in `UIBackgroundModes` required.
- In background, scan must specify target service UUID (not empty filter).
- iOS throttles to ~1Hz vs 10Hz foreground.
- For KOVAS field tool (foregrounded during measurement), **foreground-only is fine Phase 1**.

**Pairing UX pattern**:
- Settings → "Connect a measuring tool" → scan → pick from list → store device UUID+name in user profile → auto-connect on capture screen entry.
- Capture surface shows chip ("DISTO X4 connected — battery 87%") with tap-to-reconnect.
- Save last 3 paired devices for fast switching (teams share devices).

### 5. Voice capture

**Library**: **`expo-audio@0.4.x`** (SDK 52, replaces `expo-av` for audio).
- `useAudioRecorder()` hook, simpler API.
- Output: M4A (AAC) on iOS. **AAC 32-64kbps mono** for speech (~30KB/min, Whisper-friendly).
- `react-native-audio-recorder-player`: works but older callback API; not necessary.

**Whisper strategy**:
- **Chunked upload after recording** = right default Phase 1. Field clips 5-60s; PRD §5.6 budget p95 < 5s end-to-end.
- OpenAI Whisper `/audio/transcriptions` is **file-only** at cutoff (no true streaming).
- For long clips (>60s — full room walkthrough): record in **10s segments**, upload as captured, stitch transcriptions. Keeps p95 reasonable.
- Cost reduction: **on-device VAD** trims silence before upload. Saves ~20-40% Whisper cost.

**Background recording on iOS**:
- Add `audio` to `UIBackgroundModes`. `expo-audio` with `audioActivationMode: "activeWhenInForeground"` or `"all"`.
- iOS may pause if another app plays audio; handle `interruption` events.
- Phone call interruption: `expo-audio` emits event; **PRD §7.2 DoD F1** explicitly requires resume after interruption — write partial blob to FS, resume into new file, concatenate at upload.

### 6. Photo capture and processing

**`expo-camera@16.x` vs `react-native-vision-camera@4.x`**:

| Feature | expo-camera 16 | Vision Camera 4 |
|---|---|---|
| Maintained | Yes (Expo team) | Yes (mrousavy, very active) |
| Expo config plugin | Native | Yes, with `expo-build-properties` |
| **Frame processors (live ML)** | **No** | **Yes, JSI** |
| **RAW/DNG** | No | **Yes** |
| HEIF | Yes | Yes |
| **Exposure control** | Basic | **Fine (ISO, shutter, lens position)** |
| EXIF preservation | Yes (`exif: true`) | Yes |

**Recommendation: Vision Camera 4.** KOVAS needs:
1. **Frame processors** for live "equipment detected" overlay (Claude Vision too slow for live, but a small on-device YOLO/MobileNet via `react-native-fast-tflite` can highlight equipment in viewfinder before full capture).
2. **HEIF right default** (50% smaller than JPEG, lossless to Claude Vision).
3. **Exposure control** matters in poorly-lit basements/attics where boilers live.

Tradeoff: Vision Camera needs `prebuild`/dev client (no Expo Go). Project already needs that for op-sqlite, ble-plx, MMKV, Skia — Expo Go not viable from day 1 anyway. **Use EAS Build dev clients exclusively.**

**Image compression**:
- Capture HEIF at full sensor (12MP back / 8MP front on iPad Pro M2).
- Generate **preview JPEG @ 1024px, quality 0.75** at capture (~80-150 KB) via `expo-image-manipulator@13.x`.
- Sync **preview first** cellular; original HEIF on Wi-Fi.
- Original size: ~1.5-3 MB HEIF. 50-photo mission ≈ 100-150 MB. Adequate for Supabase Storage + cellular over days.

**Geotag + EXIF**:
- Both `expo-camera` and Vision Camera auto-embed GPS in EXIF with Location permission.
- For legal traceability KOVAS needs both **GPS in EXIF** AND **mission_id + timestamp watermark** burned into a corner. Burn after capture via `expo-image-manipulator` or `react-native-image-marker`.

### 7. NativeWind 4 production readiness

- **NativeWind 4.x** is **stable** (training cutoff). v4 is a major rewrite (compile-time + runtime hybrid), much faster than v2.
- Compatible with Expo SDK 52 + Tailwind CSS 3.4.x.
- **Dark mode**: Supported via `dark:` prefix using `useColorScheme()` (system) or manual toggle (`darkMode: 'class'` + NativeWind setter). PRD D307 — recommend **toggle with system default**.

**Limitations vs web Tailwind**:
- No `backdrop-blur-*` utilities on RN — compose with `expo-blur` `<BlurView>` (already locked in PRD).
- No `grid` utilities (Yoga lacks CSS Grid). Use Flexbox.
- No CSS `transition-*` for layout; use Reanimated 3.

**Verdict**: Correct choice. No risk. Mirror PRD §9.2 palette in `tailwind.config.js` as named tokens (`bg-card`, `text-primary`, `border-subtle`, etc.) so designers + AI agents write consistent classes.

### 8. Apple TestFlight + App Store submission

**Strategy** (iPad primary, iPhone companion):
- Ship as **Universal app** (single bundle, supports both). Apple no longer encourages iPad-only.
- **Minimum iOS 16.0** (covers ~97% iPad Pro users). iOS 17 unlocks more Pencil hover APIs.

**App Store review pitfalls for B2B field apps**:
- **Demo account required** — reviewer must log in. Provide test account + bypass code / magic link.
- **Sign-in with Apple mandatory if you offer any third-party OAuth** (Guideline 4.8). Email+password only = fine. Add Google OAuth (D402) → **Sign in with Apple becomes mandatory** alongside.
- **Permission strings** must explain *why* (Camera, Microphone, Photo Library, Location always vs in-use, Bluetooth). Specific French strings; generic ones get rejected.
- **In-app purchase rule (3.1.1)**: B2B SaaS for business use can use **external payment (Stripe)**. KOVAS qualifies. Link to web checkout. **Do not mention "purchase/subscribe" inside iOS app** — neutral copy ("Manage account").

**TestFlight**:
- Internal: up to **100 testers** (no review).
- External: up to **10,000** (one-time review per build). **[VERIFY]**.
- Builds expire after **90 days** — re-upload monthly during M6-M9 closed beta.

**Apple Developer Program — French SASU**:
- **$99/year** (~95€). **[VERIFY]** 2026 EUR pricing.
- **D-U-N-S number** required for org enrollment (free from Dun & Bradstreet, **5-15 business days** — apply M1).
- SIREN/SIRET match, KBIS extract for verification.
- **Enroll under SASU Nexus 1993 with D-U-N-S**, not personal account — allows team transfer later.

### 9. Expo EAS Build + OTA updates

**Pricing** (training cutoff, **[VERIFY]** May 2026):
- **Free tier**: limited build minutes; OK for early dev (~5 builds/week).
- **Production tier $29/mo per project**: right tier from M3 onward when daily builds happen.
- Higher tiers ($99/$299) for concurrency + priority queues.

**EAS Update (OTA)**:
- Free: 1,000 MAU.
- Production tier bundles Build + Update.
- Use `expo-updates` from day 1.

**OTA decision rule**:
- **OTA-only**: JS-only changes, bug fixes, copy tweaks, small features.
- **Full release**: native module changes (new ble-plx version), permission additions, iOS minimum bump, App Store metadata.

**Channel strategy**: `development` (internal CI), `preview` (TestFlight + closed beta), `production` (App Store). Tied to git branches in CI.

### 10. Performance targets

**Cold start on iPad Pro M2 (PRD <2s target)**:
- **Achievable**. Typical SDK 52 + new arch cold-starts at **0.8-1.5s** on M2 iPad.
- **Risk**: glassmorphism overlays on first screen. `expo-blur` cheap on M2, noticeable on iPad Pro 2018 (A12). **Test on oldest target.**

**Memory with 100+ photos**:
- Decoded HEIF: 12MP ≈ 40 MB in memory. 100 = 4 GB → crash.
- **Mandatory**: lazy loading via `expo-image@2.x` with `recyclingKey` + `cachePolicy: 'memory-disk'`. ~20 visible thumbnails in memory.

**Battery during continuous use**:
- Camera open + BLE scanning + GPS: **~15-20%/hour** on iPad Pro M2.
- Voice recording adds ~5%/hour.
- **Idle camera/BLE** off-capture screen. "Saving battery" indicator if capture held idle >2min.

### 11. Common pitfalls

**iOS provisioning + Expo**:
- Use **`expo credentials:manager`** + EAS managed credentials.
- **Stage Manager**: `UIRequiresFullScreen=false`.

**Native module conflicts**:
- MMKV + JSI + Reanimated 3 + Skia: **coexist** in SDK 52 new arch. Verified.
- **Vision Camera + expo-camera: do NOT install both.** Vision Camera replaces.
- **Audit transitive deps** for `expo-av` — any third-party lib pulling it will conflict with `expo-audio`/`expo-video`.

**Glassmorphism + Skia performance on older iPads**:
- **Pitfall**: BlurView over animated Skia canvas → recomposes every frame → 30fps. **Don't blur over Skia surfaces.** Blur static UI, put Skia on top.

**Offline sync edge cases**:
- **User deletes a photo before sync**: delete local file + outbox entry. If mid-upload: `AbortController` cancel + delete.
- **User edits mission offline that was deleted on web**: sync returns 404 → mark "deleted on server", offer restore (upload as new) or discard.
- **Clock skew**: device clock can be wrong. **Server `updated_at` arbitrates LWW**, never client time.
- **Photo upload interrupted at 80%**: Supabase Storage supports **TUS resumable**. Use it with deterministic file path.
- **Storage full on device**: `expo-file-system` exposes free space. Warn <500 MB, hard-stop new captures <100 MB.

## Recommended Approach

1. **Bootstrap with current Expo SDK** (52 if locked, else latest), new arch enabled, **expo-router 4** file-based routing.
2. **EAS Build dev clients from day 1** (no Expo Go) — required native modules exceed Expo Go.
3. **op-sqlite + Drizzle ORM + custom 2-week sync layer** with outbox + tombstones + LWW conflict resolution. Reject WatermelonDB and PowerSync for Phase 1.
4. **MMKV for TanStack Query persistence** (30x faster than AsyncStorage); secure-store only for tokens.
5. **Vision Camera 4 (not expo-camera)** for camera surface — frame processor optionality + RAW/exposure control.
6. **expo-audio + chunked upload + on-device VAD** for voice notes. Streaming Whisper deferred.
7. **Skia for diagnostic sketches**; PencilKit explicitly rejected.
8. **Photo-based croquis P0; LiDAR RoomPlan native module P1** (3-week build).
9. **react-native-ble-plx 3.x** for telemeters; ship **Leica DISTO X3/X4 only** in Phase 1.
10. **Universal iPad+iPhone app, iOS 16.0 minimum**, enroll Apple Developer under **SASU Nexus 1993 with D-U-N-S**.
11. **Sentry + PostHog + EAS Update channels: development/preview/production**.

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **op-sqlite + Drizzle + custom sync** | Fast, typesafe, fits Supabase | ~2 weeks sync work | **Recommended** |
| WatermelonDB | Built-in reactivity, sync framework | Fights TanStack Query, ORM-y, slower writes | Rejected |
| PowerSync | Drop-in PG sync | Vendor lock, $$$, opinionated schema | Rejected (revisit Phase 2) |
| **Vision Camera 4** | Frame processors, RAW, fine controls | Dev-client required | **Recommended** |
| expo-camera 16 | Expo team maintained | No frame processors, weaker controls | Rejected |
| **Skia for sketching** | Open, portable strokes, fast | Pressure-only out of box | **Recommended** |
| PencilKit bridge | Native UX, palm rejection free | No maintained RN lib, PKDrawing not portable | Rejected |
| **react-native-ble-plx 3.x** | Mature, Expo plugin, JSI | None material | **Recommended** |
| **expo-audio** | Modern SDK 52 API | Newer (less battle-tested) | **Recommended** |
| **MMKV** | 30x faster than AsyncStorage | Native dep | **Recommended** |
| **expo-router 4** | Typed routes, file-based, deep linking | Learning curve for nav veterans | **Recommended** |

## Verification Required (for Second Wave)

1. **Latest Expo SDK at project start** (52 → 53 → 54?).
2. **EAS Build + Update pricing** May 2026.
3. **Apple Developer Program fee** EUR for 2026 (~$99 USD).
4. **OpenAI Whisper streaming API** availability.
5. **Anthropic Claude Vision HEIF support** (confirm with claude-api research).
6. **`expo-audio` stability** in SDK 53+.
7. **NativeWind 4 latest minor** + known bugs with Reanimated 3.16+.
8. **react-native-ble-plx v3 latest** + Expo SDK 53 compatibility.
9. **Vision Camera 4 latest** + iPad Pro M4 frame processor stability.
10. **Apple D-U-N-S processing time** for French SASU in 2026.
11. **Bosch GLM BLE protocol** — community reverse-engineering status.
12. **TestFlight tester limits** — still 10,000 external?
