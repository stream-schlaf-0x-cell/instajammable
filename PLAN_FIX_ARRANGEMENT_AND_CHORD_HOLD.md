# Technical Self-Prompt: Fix Arrangement "OFF" Lock & True Single-Chord Hold ("Hold A")

> **Scope & Constraint**: Preserve all existing functionality, audio smoothness, MIDI routing (`Ch 1–8 + 10`), octave switchers, and `v2.0-stable-fallback`. Ensure `npm run typecheck`, `npm test`, `npm run test:legacy`, and `npm run build` stay 100% green after execution.

---

## Issue 1: Arrangement Menu Forces Sequencer Back to "ON" When Selecting a Mode

### Root Cause
1. `src/engine/jam/JamEngine.ts:1658-1659` (`jumpToSequenceBlock`) and `1683-1684` (`applySequenceTemplate`) still hardcode `this.arrangement.sequencerEnabled = true; this.state.sequencerEnabled = true;`.
2. `src/App.tsx:440-441` computes `isOn: session.sequencerEnabled ?? true`, while `onToggle` runs `!session.sequencerEnabled` (`!undefined === true` if `sequencerEnabled` was omitted before initialization).
3. `src/engine/jam/scenes.ts:682` (`createSession`) omits `sequencerEnabled` (leaving `state.sequencerEnabled` `undefined` until constructed in `JamEngine`).
4. `src/engine/jam/JamEngine.ts:415` (`getPosition`) always sets `sequencer.currentSection = activeBlock ? activeBlock.section : this.arrangement.current`, even when `sequencerEnabled === false`, so switching manual energy highlights the paused block instead of `this.arrangement.current`.
5. `src/components/jam/ArrangementHub.tsx:314` (`SequencerDeck`) lacks a dedicated manual energy bar (`High / Up / Flow / Down / Low`) in its header for direct manual switching while `SEQUENCER: OFF`, and its helper copy still says clicking any arrow activates the sequencer. Also check `ArrangementHub.tsx:425-466` vs `EssentialMasterBar.tsx:1098-1152` so users can tweak manual sound OR block templates cleanly without unexpectedly flipping `SEQUENCER: OFF` -> `ON`.

### Required Code Changes
1. **`src/engine/jam/scenes.ts`**:
   - In `createSession()` (around line 682), explicitly initialize `sequencerEnabled: true` on the returned `JamSession`.
2. **`src/engine/jam/JamEngine.ts`**:
   - Remove `this.arrangement.sequencerEnabled = true; this.state.sequencerEnabled = true;` from `jumpToSequenceBlock()` (`1658-1659`) and `applySequenceTemplate()` (`1683-1684`). Only `toggleSequencer(enabled)` may mutate `sequencerEnabled`. (Update any test in `src/test/arrangement.test.ts` only if it implicitly relied on `applySequenceTemplate` enabling an explicitly disabled sequencer — verify exact assertions first.)
   - Ensure `this.state.sequencerEnabled = this.arrangement.sequencerEnabled;` is kept synchronized in `validateSession()` (`2462`), `restore()` (`1398`), `loadSession()` (`2342`), and `updateSequenceBlock()` (`1615`).
   - In `getPosition()` (`415`), change:
     ```ts
     currentSection: this.arrangement.sequencerEnabled && activeBlock ? activeBlock.section : this.arrangement.current,
     ```
     so UI highlights in `EssentialMasterBar` and `SequencerDeck` reflect manual changes immediately when `SEQUENCER` is `OFF`.
   - Update `setManualArrangementByEnergy(energy)` so it logs cleanly and updates `this.state.arrangement` + `this.arrangement.current` + `this.state.macros` without modifying `sequencerEnabled` (`remains false`).
3. **`src/App.tsx`**:
   - Lines `440-441`: use `const isSeqOn = session.sequencerEnabled ?? true;` (via `isOn: session.sequencerEnabled ?? true, onToggle: () => engine.toggleSequencer(!(session.sequencerEnabled ?? true))`) so the drawer switch never evaluates `!undefined` as `true`.
4. **`src/components/jam/ArrangementHub.tsx`**:
   - In `SequencerDeck` (`305-360`), update helper copy (`314`) to reflect that manual controls work while `SEQUENCER: OFF`.
   - Render a **Manual Arrangement Bar** (`↑ High | ↗ Up | ➔ Flow | ↘ Down | ↓ Low` + `🎲 Spontane Wendung`) directly inside `SequencerDeck` header/subheader wired to `engine.setManualArrangementByEnergy(...)` and highlighting `position.arrangementSection` (active when `sequencerEnabled === false` or anytime).
   - Clarify `applySequenceTemplate` / `jumpToSequenceBlock` tooltips: editing or picking templates keeps the current `ON/OFF` state unless the user clicks the `SEQUENCER ON/OFF` switch.
5. **`src/test/`**:
   - Verify `arrangement.test.ts`, `notesAndArrangementSteppers.test.ts`, and `midiModeAndChannels.test.ts`: add regression assertions testing `toggleSequencer(false)` -> `applySequenceTemplate(...)` / `jumpToSequenceBlock(...)` / `setBlockSectionByEnergy(...)` / `setManualArrangementByEnergy(...)` all preserve `sequencerEnabled === false` AND update `position.arrangementSection` & `position.sequencer.currentSection`.

---

## Issue 2: True Single-Chord Hold ("Hold A" — Jam on One Chord Without Harmonic Drift)

### Root Cause
1. **`latchedHarmony` missing in `JamComposer` & `JamSession`**:
   - In `src/engine/jam/music.ts:192-273` (`harmonyAt`), even when `session.chordLoopMode === 'A'`, calling `harmonyAt(step, session)` recomputes voicings using `slot.index` or `epoch` whenever `epoch` increments (`Flow` move at `JamEngine.ts:725` or `Evolve`) or when `paceKey` changes, or when `session.manualHarmonyDegree` was `undefined` in templates.
   - `setHarmonyDegree` (`music.ts:301`) sets `this.lastHarmonyKey = 'manual-deg-...'`, which gets overwritten as soon as `step` enters the next harmonic slot (`slot.index` changes), resetting voicings and chord intervals.
2. **Bass & Drone harmonic jumps still fire on bar 2/3/4 during `'A'`**:
   - `bass` (`breathingSub` line `778`, `pedal` line `862`) and `drone` (`shiftingFifth` line `406`, and `melody` phrase turns) occasionally substitute `harmony.degree + 4` (5th) or re-voice against changing `harmony.index`. While octave/root pedal stays on the chord, switching `Hold A` needs bass/drone to anchor rock-solid on the held chord's root/voicing instead of drifting onto V/IV intervals.
3. **Layer B & Pad Mid-Phrase Harmonic Drift**:
   - In `music.ts` (`makePlan` chords branch), `pad` mid-phrase dyad & Layer B upper spread re-seed via `rng` when `phraseIndex` (`= layerSlot.index`) changes on every bar/hold boundary, subtly altering the held chord's color even though `A` should stay latched.
4. **UI discoverability across all 8 views**:
   - `A | AB | ABC | ABCD` controls exist only in `EssentialMasterBar`, `HarmonyHeroCard`, and `SoundscapeDeck`, missing from `OrbitLayout`, `PatchbayLayout`, `SynesthesiaLayout`, and `DistanceStageHUD`.

### Required Code Changes
1. **`src/types/jam.ts`**:
   - Add optional `latchedHarmony?: { degree: number; root: number; notes: number[]; name: string } | null;` to `JamSession`.
2. **`src/engine/jam/music.ts`**:
   - Store `private latchedHarmony: Harmony | null = null;` inside `JamComposer` (serialize/restore in `getRuntime()` / `restore()` / clear in `reset()`).
   - Add `setLatchedHarmony(h: Harmony | null): void`.
   - In `harmonyAt(step, session)` (`192-273`):
     - Calculate `slot = harmonySlotAt(...)` so `slot.index` still advances cleanly for rhythmic retriggering (`planStep`).
     - If `session.chordLoopMode === 'A'`:
       - Resolve `latched = session.latchedHarmony || this.latchedHarmony`.
       - If present, preserve its exact `degree`, `root`, `notes`, and `name`, updating ONLY `index: slot.index` on `this.harmony` and returning immediately (zero re-voicing, zero progression advance, immune to `epoch`/`Flow` changes).
       - If not yet latched, compute the base chord once (`slot = 0`), store into `this.latchedHarmony`, and return it with `index: slot.index`.
   - In `stepChord(direction, step, session)` (`275-285`):
     - When `chordLoopMode === 'A'`, compute the new chord via `setHarmonyDegree`, AND update `this.latchedHarmony = this.getHarmony()` so `◀ / ▶` buttons cleanly step the held chord to a new degree.
   - Also update `this.latchedHarmony` whenever `nudgeChordNote()` or `transposeVoicing()` runs while `latchedHarmony` is active.
   - In `makePlan()` (`music.ts`):
     - Pass `const holdSingleChord = session.chordLoopMode === 'A';`
     - When `holdSingleChord` is `true`, anchor `bass` (`pedal`, `breathingSub`) and `drone` strictly to `harmony.root` / `harmony.notes` (no unrequested `degree + 4` turnaround bars), keeping rhythmic patterns (`pulse8`, `syncopatedGroove`, etc.) alive on the single latched chord's tones.
3. **`src/engine/jam/JamEngine.ts`**:
   - In `setChordLoopMode(mode)` (`1776`):
     - Capture current sounding chord: `const current = this.currentAnchor()?.harmony || this.composer.getHarmony();`
     - When `mode === 'A'`: set `this.state.manualHarmonyDegree = current.degree;`, `this.state.latchedHarmony = { degree: current.degree, root: current.root, notes: [...current.notes], name: current.name };`, and `this.composer.setLatchedHarmony(current);`.
     - When `mode !== 'A'`: clear `this.state.manualHarmonyDegree = null; this.state.latchedHarmony = null; this.composer.setLatchedHarmony(null);`.
   - Clear or update `this.state.latchedHarmony` inside `setRoot()`, `updateSession({ scale })`, `cycleChord()`, `nudgeChordNote()`, and `shiftLayerOctave('chords', ...)` so changing key/scale/manual chord always re-latches cleanly to the requested pitch.
   - Preserve `latchedHarmony` in `validateSession()` (`2456`).
4. **Shared UI Control Across All 8 Views**:
   - Export a compact `<ChordLoopControls session={session} edition={edition} showHoldButton />` component from `src/components/layouts/LayoutShared.tsx` rendering a prominent **`Hold` (`A`)** toggle button + `AB | ABC | ABCD` segmented pills.
   - Embed `<ChordLoopControls>` cleanly in:
     - `EssentialMasterBar.tsx`
     - `HarmonyHeroCard` (`LayoutShared.tsx` — covers Split, Stage, Grid, Groovebox)
     - `SoundscapeDeck` (`ArrangementHub.tsx`)
     - `OrbitLayout.tsx` (Harmonic Core footer/header)
     - `PatchbayLayout.tsx` (Brain/Clock node)
     - `SynesthesiaLayout.tsx` (Bottom glass harmony dock)
     - `DistanceStageHUD.tsx` (Chord card)
5. **Verification**:
   - Add unit test in `src/test/midiModeAndChannels.test.ts` verifying that `setChordLoopMode('A')` locks exact `harmony.notes`, `harmony.root`, and `harmony.name` across 32+ bars, survives `composer.vary()` (`Flow`/`Evolve` epochs), updates only on explicit `cycleChord` / `nudgeChordNote` / `setRoot`, and keeps `bass` `pedal`/`breathingSub` on the latched root.
   - Run `npm run typecheck && npm test && npm run test:legacy && npm run build`.
