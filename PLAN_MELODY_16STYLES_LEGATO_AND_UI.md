# Technical Self-Prompt: Continuous Melody Stream, 2x Instrument Styles (16 Bass), Seamless Legato & Synesthesia UI Fix

> **Scope & Constraint**: Treat Instajammable first as a continuous generative ambient/melodic streaming instrument while preserving all existing presets, audio safety, MIDI routing (`Ch 1–8 + 10`), and tests (`npm run typecheck`, `npm test`, `npm run test:legacy`, `npm run build`). Execute only when approved.

---

## Part 1: Constant, Present Melody Stream (Stop Melody Dropouts)

### Root Cause
1. `src/engine/jam/music.ts:906` returns early (`if (session.evolving && !layer.locked && !layer.frozen && s.density <= 0.40 && phraseIndex % 3 === 2) return notes;`), dropping the entire melody silent every 3rd phrase (`4` bars).
2. `src/engine/jam/music.ts:973-977` sets `phraseForm = ['A', 'rest', 'Ap', 'rest']` (`bellDrops`) or `['A', 'Ap', 'B', 'rest']` (`density < 0.72`), silencing 25%–50% of every 4-bar phrase even when Melody is unmuted and playing.
3. `src/engine/jam/music.ts:994-996` strips all notes after step 11 (`barEvents = barEvents.filter(e => e.pos <= 11)`) every 4th bar.
4. `src/engine/jam/JamEngine.ts:1475` (`buildup`) and `1487` (`breakdown`) automatically mute the `melody` layer unless locked/frozen.

### Required Changes
1. **`src/engine/jam/music.ts`**:
   - Remove the `phraseIndex % 3 === 2` early silence return (`906`).
   - Change `phraseForm` (`973-977`) so **every bar plays continuously** (`['A', 'Ap', 'B', 'App']`) with organic melodic density rather than full-bar silence (`'rest'`). *(Only `bellDrops` / explicit low-density modes below `density < 0.15` may leave sparse gaps — or keep `['A', 'Ap', 'B', 'App']` consistently whenever `density > 0` and `mStyle !== 'off'`.)*
   - Remove or soften the forced bar-4 cutoff (`994-996`) so beat 4 keeps melodic notes available.
   - Enrich `cellPool` (`933-941`) so active bars generate 4–8 well-spaced scale/chord tones (scaled smoothly by `density` & `movement`), and extend note duration (`1016-1022`) to `gapBeats * 1.02` in ambient/legato modes so the melody sings continuously for live modulation/key-finding.
   - Keep `bass` / `melody` density clamps above 0 in continuous styles unless user turns `density === 0` or `mStyle === 'off'`.
2. **`src/engine/jam/JamEngine.ts`**:
   - In `applyArrangement()` (`1475` and `1487`), remove automatic `muted: true` on `layer.role === 'melody'` during `buildup` and `breakdown` (instead adjust filter/velocity gently so user-enabled melody never disappears behind the user's back; only `silent` drops drums + sparse space).
3. **Tests to check/update**:
   - Check `src/test/arrangement.test.ts` and `src/test/bugfixRegressions.test.ts` line `215` (`applyArrangement orchestrates melody mute/unmute across sections`) and update expectations cleanly if `breakdown` / `buildup` switches to gentle attenuation rather than hard-muting `melody`, OR add a user-explicit `melodyPresence` / keep `applyArrangement` test alignment explicit during execution!

---

## Part 2: Double Style / Pattern Library for Every Instrument (16 Bass, 14 Chords, 12 Melody, 10 Texture, 12 Drums)

### Exact Target Lists
1. **`src/types/jam.ts`** (extend exported union types & tuple arrays):
   - **`BASS_STYLES` (8 → 16)**:
     - Existing 8: `'pedal' | 'breathingSub' | 'dubOffbeat' | 'jazzWalk' | 'syncopatedGroove' | 'minimalArp' | 'pulse8' | 'psyRoll'`
     - New 8: `'infiniteDrone' | 'fifthPendulum' | 'octaveGlide' | 'berlinSequence' | 'tresilloSub' | 'acidLine' | 'ukGarageSub' | 'poly5Bass'`
   - **`CHORD_PATTERNS` (7 → 14)**:
     - Existing 7: `'pad' | 'wave' | 'broken' | 'pulse' | 'syncopated' | 'euclidean' | 'cluster'`
     - New 7: `'eternalDrone' | 'risingArp' | 'fallingArp' | 'pendulumArp' | 'offbeatEcho' | 'tripletFlow' | 'cathedralChoir'`
   - **`MELODY_STYLES` (6 → 12)**:
     - Existing 6: `'motif' | 'ostinato' | 'bellDrops' | 'neoclassical' | 'lofiHook' | 'off'`
     - New 6: `'endlessStream' | 'arpCascade' | 'callResponse' | 'pentatonicFlow' | 'berlinLead' | 'cinematicArc'`
   - **`DRONE_STYLES` (5 → 10)**:
     - Existing 5: `'rootFifth' | 'rootOctave' | 'pedalTonic' | 'shiftingFifth' | 'cluster'`
     - New 5: `'infiniteRibbon' | 'angelicTriad' | 'subCatharsis' | 'quartalStack' | 'binauralBreath'`
   - **`RhythmAlgorithm` (6 → 12)**:
     - Existing 6: `'composed' | 'euclidean' | 'probabilistic' | 'polymetric' | 'markov' | 'densityBurst'`
     - New 6: `'fourOnFloor' | 'twoStep' | 'halftime' | 'tribalPoly' | 'minimalClick' | 'rolling16'`
2. **`src/engine/jam/music.ts`** (`makePlan`):
   - Implement distinct musical pattern generators for every new `bassStyle`, `chordPattern`, `melodyStyle`, `droneStyle`, and `rhythmAlgorithm`.
   - Ensure `randomizeLayerRhythm` (`JamEngine.ts`) picks across all 16/14/12/10/12 styles cleanly.
3. **`src/components/layouts/LayoutShared.tsx` (`getLayerRhythmOptions`) & `src/engine/jam/minimalCatalog.ts`**:
   - List all 16 bass, 14 chord, 12 melody, 10 drone, and 12 drum options in `getLayerRhythmOptions(layer, min)` with concise EN/DE labels so they immediately appear in every track dropdown across all 8 views + Mixer + SoundscapeDeck.

---

## Part 3: 100% Seamless Legato Bass & Ambient Notes (Zero Gap Before Next Note)

### Root Cause
1. In `src/engine/jam/music.ts`:
   - `pedal` (`line 896`): `const noteDur = Math.min(7.6, stride / 4 - 0.15, length / 4);` cuts off `0.15` beats (~75–110ms) early before beat 1 of the next chord/bar, leaving a noticeable silence gap!
   - `breathingSub` (`line 812`): `2.8` beats out of `4.0` beats stops 1.2 beats early!
   - `drone` (`line 396`) and `pad` (`line 592`): subtract `- 0.12` / `- 0.15` beats unnecessarily before the next note.
2. In `src/engine/jam/JamEngine.ts:654`:
   - `gateMult = midiOnly && layer.role !== 'drum' ? clamp(0.30 + session.macros.space * 0.70, 0.25, 1.0) : 1;` shrinks MIDI durations when `space` < `1.0`, chopping legato bass & pad notes short in Ableton!
3. In `src/engine/midi/webMidi.ts` (`scheduleNote`):
   - When the same `(channel, note)` re-triggers cleanly at beat boundaries, any overlapping pending `Note Off` must flush just before the new `Note On` (~2ms earlier) rather than truncating early with a gap OR dropping the new note via stale off-timers.

### Required Changes
1. **`src/engine/jam/music.ts`**:
   - Define `SEAMLESS_BASS_STYLES = new Set(['pedal', 'infiniteDrone', 'breathingSub', 'fifthPendulum', 'octaveGlide'])` and use full exact beat durations (`stride / 4`, or `4.0` / `length / 4 + 0.04` in `infiniteDrone` / `breathingSub`: `hasPickup ? 3.5 : 4.0` + `0.5` pickup) — removing `- 0.15` / `7.6` premature cutoffs!
   - Use full bar/phrase durations (`s.phraseBars * 4` for `drone`, `chordHoldBars * 4` for `pad` / `eternalDrone` / `cathedralChoir` / `wave`).
2. **`src/engine/jam/JamEngine.ts`**:
   - At line `654`, set `gateMult = 1` when `layer.role !== 'drum'` and the active style is a sustained/legato style (`pedal`, `infiniteDrone`, `breathingSub`, `fifthPendulum`, `octaveGlide`, `pad`, `eternalDrone`, `wave`, `cathedralChoir`, `drone`), so the **Note Gate** macro only gates rhythmic/plucked patterns without tearing gaps into seamless ambient bass/pads.
3. **`src/engine/midi/webMidi.ts`**:
   - Track active pending `Note Off` timers per `${output.id}:${channel}:${note}`; if a new `Note On` schedules at `startTime` while an older `Note Off` for that same key is pending near/after `startTime`, send that older `Note Off` immediately before (or 1–2ms prior to) the new `Note On` and replace the timer cleanly — zero dead gap and zero stuck notes in Ableton.

---

## Part 4: UI Bugfix — Synesthesia (and Compact Card) Octave Switcher Overflow (from Screenshot)

### Root Cause (Observed in Attached Screenshot)
In Synesthesia bottom cards (especially Drum `Percus...` card on narrow viewports), `.track-midi-bar.is-compact` overflows horizontally beyond `.syn-totem-card`'s right border so the `+` button protrudes past the card edge:
1. `.syn-totem-card` (`src/index.css:7075`) lacks `min-width: 0; overflow: hidden;` so grid track children push wider than their `minmax(120px, 1fr)` track.
2. For drum tracks, `TrackOctaveControls` renders `${noteName(minNote)} (${minNote})` (`e.g. "C#1 (37)"`) which is wide, AND `.mini-oct-btn` + `.track-midi-ch-field select` have generous horizontal padding + non-shrinking flexbox sizing (`flex-shrink: 0` / wide `min-width`).

### Required Changes
1. **`src/components/layouts/LayoutShared.tsx` (`TrackOctaveControls`)**:
   - When `compact` is `true` and `isDrum` is `true`, format `rangeLabel` compactly as `${noteName(minNote)}·${minNote}` (saves 3 characters + parens, e.g. `C♯1·37` instead of `C♯1 (37)`).
2. **`src/index.css`**:
   - Add `min-width: 0; overflow: hidden; box-sizing: border-box;` on `.syn-totem-card`, `.compact-track-pill`, and `.mixer-channel-strip`.
   - Tighten compact octave/MIDI bar layout:
     ```css
     .track-midi-bar.is-compact,
     .track-octave-controls.is-compact {
       width: 100%;
       max-width: 100%;
       box-sizing: border-box;
       gap: 3px;
       overflow: hidden;
     }
     .track-midi-bar.is-compact .track-midi-ch-field select {
       width: 34px;
       padding: 1px 2px;
       font-size: 10px;
     }
     .track-midi-oct-group {
       flex: 1 1 auto;
       min-width: 0;
       justify-content: flex-end;
       gap: 2px;
     }
     .mini-oct-btn {
       flex: 0 0 18px;
       width: 18px;
       min-width: 18px;
       height: 18px;
       padding: 0;
     }
     .track-midi-range-tag {
       flex: 1 1 auto;
       min-width: 0;
       overflow: hidden;
       text-overflow: ellipsis;
       text-align: center;
       font-size: 9.5px;
       padding: 0 1px;
     }
     ```
   - On `.syn-totem-strip` (`7067`), consider `grid-template-columns: repeat(8, minmax(132px, 1fr));` with horizontal scroll container protection so cards always fit cleanly without clipping `+`.

---

## Verification Plan
- Add unit tests in `src/test/` verifying:
  1. Continuous melody emits active notes in every bar of an 8-bar evolving span (zero dropped bars).
  2. All 16 bass, 14 chord, 12 melody, 10 drone, and 12 drum style enum values generate valid notes/events across `makePlan`.
  3. Seamless bass (`pedal`, `infiniteDrone`, `breathingSub`) & `pad` cover full step spans (`>= 4.0` beats / gap-free step-to-step scheduling in `WebMidiManager`).
- Run `npm run typecheck && npm test && npm run test:legacy && npm run build`.
