import type { MusicalScale } from '../../types';
import type { ClipNote, JamLayer, JamSession, MidiClip, ChordPattern, ChordPace, ChordLoopMode, VoicingFamily, DroneStyle, MelodyStyle, BassStyle, RhythmAlgorithm } from '../../types/jam';
import { PRNG } from '../prng';
import { EuclideanGenerator } from '../generators/rhythm/euclidean';
import { ProbabilisticGenerator } from '../generators/rhythm/probabilistic';
import { PolymetricGenerator } from '../generators/rhythm/polymetric';
import { MarkovGenerator } from '../generators/rhythm/markov';
import { DensityBurstGenerator } from '../generators/rhythm/densityBurst';
import type { IGenerator } from '../generators/types';
export const SCALE_INTERVALS: Record<MusicalScale, number[]> = {
  dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
  aeolian: [0, 2, 3, 5, 7, 8, 10], majorPentatonic: [0, 2, 4, 7, 9], minorPentatonic: [0, 3, 5, 7, 10],
  hirajoshi: [0, 2, 3, 7, 8], microtonal: [0, 2, 3, 5, 7, 9, 10],
};
export const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
export function streamSeed(seed: number, name: string, epoch = 0): number {
  let hash = (seed ^ Math.imul(epoch + 1, 0x9e3779b9)) >>> 0;
  for (const char of name) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}
export function scaleNote(root: number, scale: MusicalScale, degree: number): number {
  const intervals = SCALE_INTERVALS[scale] || SCALE_INTERVALS.dorian;
  return root + intervals[((degree % intervals.length) + intervals.length) % intervals.length] + Math.floor(degree / intervals.length) * 12;
}
export function fitNote(note: number, min: number, max: number): number {
  let fitted = Math.round(note); while (fitted < min) fitted += 12; while (fitted > max && fitted - 12 >= min) fitted -= 12;
  return Math.round(clamp(fitted, min, max));
}
export function voiceLead(pitches: number[], previous: number[], min: number, max: number): number[] {
  const candidates = pitches.map(p => { const notes: number[] = []; for (let n = p - 48; n <= p + 48; n += 12) if (n >= min && n <= max) notes.push(n); return notes; });
  const allowed = [...new Set(candidates.flat())]; if (!allowed.length) return [];
  for (let i = 0; i < candidates.length; i++) if (!candidates[i].length) candidates[i] = allowed;
  let best: number[] = []; let bestCost = Infinity;
  const search = (chosen: number[], index: number) => {
    if (index === candidates.length) {
      const ordered = [...chosen].sort((a, b) => a - b); if (new Set(ordered).size !== ordered.length) return;
      const span = ordered.at(-1)! - ordered[0]; let cost = span < 7 ? 25 : span > 24 ? (span - 24) * 2 : 0;
      ordered.forEach((n, i) => { cost += Math.abs(n - (previous[i] ?? (min + 4 + i * 5))); });
      if (cost < bestCost) { bestCost = cost; best = ordered; } return;
    }
    for (const n of candidates[index]) search([...chosen, n], index + 1);
  };
  search([], 0); return best.length ? best : allowed.sort((a, b) => a - b);
}
/** Bars each chord is held. Techno and ambient breathe slowly; lo-fi changes twice as often. Pace can override. */
export const holdBarsFor = (style: JamSession['style'], pace?: ChordPace): number => {
  if (pace === '1-bar') return 1;
  if (pace === '2-bars') return 2;
  if (pace === '4-bars') return 4;
  if (pace === '8-bars') return 8;
  if (pace === 'dynamic') return 2;
  return style === 'lofi' ? 2 : 4;
};

export interface HarmonySlotInfo {
  index: number;
  holdBars: number;
  barsLeft: number;
  slotStartStep: number;
}

const DYNAMIC_PACE_BARS = [1, 2, 1, 4] as const;

export function harmonySlotAt(
  beatOrStep: number,
  style: JamSession['style'],
  pace?: ChordPace,
  isBeat = false,
): HarmonySlotInfo {
  const beat = Math.max(0, isBeat ? beatOrStep : beatOrStep / 4);
  if (pace === 'dynamic') {
    const bar = beat / 4;
    const cycleIdx = Math.floor(bar / 8);
    const barInCycle = bar - cycleIdx * 8;
    let slot = 3;
    let holdBars = 4;
    let slotStartBar = 4;
    if (barInCycle < 1) {
      slot = 0; holdBars = DYNAMIC_PACE_BARS[0]; slotStartBar = 0;
    } else if (barInCycle < 3) {
      slot = 1; holdBars = DYNAMIC_PACE_BARS[1]; slotStartBar = 1;
    } else if (barInCycle < 4) {
      slot = 2; holdBars = DYNAMIC_PACE_BARS[2]; slotStartBar = 3;
    }
    const barsLeft = clamp(slotStartBar + holdBars - barInCycle, 0, holdBars);
    const slotStartStep = Math.round((cycleIdx * 8 + slotStartBar) * 16);
    return { index: cycleIdx * 4 + slot, holdBars, barsLeft, slotStartStep };
  }
  const holdBars = holdBarsFor(style, pace);
  const index = Math.floor(beat / (holdBars * 4));
  const barsLeft = clamp(((index + 1) * holdBars * 4 - beat) / 4, 0, holdBars);
  return { index, holdBars, barsLeft, slotStartStep: index * holdBars * 16 };
}
/** Scale-degree offsets above the chord root. Ambient & Techno favour pure triads, sus2/sus4 and open add9 (non-jazzy). */
export const VOICINGS: ReadonlyArray<{ offsets: number[]; weight: number; minMovement: number }> = [
  { offsets: [0, 2, 4], weight: 3.4, minMovement: 0 },        // pure open triad (minor / major - timeless, zero jazz clutter)
  { offsets: [0, 1, 4], weight: 3.0, minMovement: 0 },        // pure sus2 (open fifth + second, CBL / S1gns Of L1fe signature)
  { offsets: [0, 2, 4, 8], weight: 2.8, minMovement: 0 },     // open add9 without seventh (wide cinematic triad + 9th)
  { offsets: [0, 3, 4], weight: 2.2, minMovement: 0.12 },     // pure sus4 (cathedral / Asura suspension)
  { offsets: [0, 4, 6, 8], weight: 1.6, minMovement: 0.22 },  // open fifth + seventh + ninth (no third)
  { offsets: [0, 2, 6, 8], weight: 1.2, minMovement: 0.35 },  // lush ninth shell at higher movement
];

export const VOICING_FAMILIES: Record<VoicingFamily, ReadonlyArray<{ offsets: number[]; weight: number; minMovement: number }>> = {
  triad: [
    { offsets: [0, 2, 4], weight: 3.0, minMovement: 0 },
    { offsets: [0, 4, 7], weight: 2.0, minMovement: 0.1 },
  ],
  sus: [
    { offsets: [0, 1, 4], weight: 3.0, minMovement: 0 },
    { offsets: [0, 3, 4], weight: 2.2, minMovement: 0.1 },
  ],
  open9: [
    { offsets: [0, 4, 8], weight: 2.4, minMovement: 0 },
    { offsets: [0, 2, 4, 8], weight: 3.0, minMovement: 0 },
  ],
  quartal: [
    { offsets: [0, 3, 6], weight: 2.8, minMovement: 0 },
    { offsets: [0, 3, 6, 9], weight: 1.8, minMovement: 0.15 },
  ],
  power: [
    { offsets: [0, 4], weight: 2.8, minMovement: 0 },
    { offsets: [0, 4, 7], weight: 2.0, minMovement: 0.08 },
  ],
  jazz: [
    { offsets: [0, 2, 4, 6], weight: 2.8, minMovement: 0 },
    { offsets: [0, 2, 4, 6, 8], weight: 2.0, minMovement: 0.45 },
    { offsets: [0, 2, 6, 8], weight: 1.8, minMovement: 0.45 },
  ],
};
const PC_NAMES = NOTE_NAMES;
/** Chord symbol from the semitone intervals of the chord above its root. */
export function chordSuffix(intervals: number[]): string {
  const iv = new Set(intervals.map(n => ((n % 12) + 12) % 12)); const minor = iv.has(3), major = iv.has(4);
  const seventh = iv.has(10) ? 10 : iv.has(11) ? 11 : 0; const ninth = iv.has(2) || iv.has(1);
  if (!minor && !major) {
    if (iv.has(2) && !iv.has(5)) return `${seventh ? '7' : ''}sus2`; if (iv.has(5)) return `${seventh ? '7' : ''}sus4`;
    return seventh ? `${ninth ? '9' : '7'}(no3)` : '5';
  }
  const flat5 = iv.has(6) && !iv.has(7), sharp5 = iv.has(8) && !iv.has(7);
  let base: string;
  if (minor && flat5) base = seventh ? (iv.has(9) ? 'dim7' : 'm7♭5') : 'dim';
  else if (major && sharp5) base = seventh === 11 ? 'maj7♯5' : seventh ? '7♯5' : 'aug';
  else if (minor) base = seventh === 11 ? 'mMaj7' : seventh ? 'm7' : 'm';
  else base = seventh === 11 ? 'maj7' : seventh ? '7' : '';
  if (seventh && ninth && !flat5 && !sharp5) return base.replace('7', iv.has(1) ? '7♭9' : '9');
  if (!seventh && ninth) return `${base}add${iv.has(1) ? '♭9' : '9'}`;
  return base;
}
export interface Harmony { degree: number; name: string; notes: number[]; root: number; index: number }
export interface PlannedNote { layerId: string; note: number; velocity: number; durationBeats: number; microMs: number; offsetBeats?: number; channel?: number; /** Entered mid-phrase by an Evolve transition: use a short attack so it crossfades in. */ soft?: boolean; /** Secondary Dual-Chord voice routed to Chord B synth & mixer. */ subLayer?: 'chords_b' }
interface ComposerRuntime { epoch: number; harmonyIndex: number; chordStepOffset?: number; harmony: Harmony; latchedHarmony?: Harmony | null; previousVoicing: number[]; frozen: Record<string, ClipNote[]>; frozenStarts: Record<string, number>; }
/** Deterministic musical decisions; audio and MIDI both consume the returned notes. */
export class JamComposer {
  private epoch = 0; private harmonyIndex = -1; private chordStepOffset = 0;
  private harmony: Harmony = { degree: 0, name: 'Dm', notes: [50, 57, 65], root: 50, index: 0 };
  private latchedHarmony: Harmony | null = null;
  private previousVoicing: number[] = []; private lastHarmonyKey = '';
  private plans = new Map<string, { key: string; notes: Array<PlannedNote & { step: number }> }>();
  private frozen: Record<string, ClipNote[]> = {}; private frozenStarts: Record<string, number> = {};
  getHarmony(): Harmony { return { ...this.harmony, notes: [...this.harmony.notes] }; }
  setLatchedHarmony(h: Harmony | null): void { this.latchedHarmony = h ? { ...h, notes: [...h.notes] } : null; this.plans.clear(); this.lastHarmonyKey = ''; }
  clearPlans(): void { this.plans.clear(); this.lastHarmonyKey = ''; }
  vary(): void { this.epoch++; this.chordStepOffset = 0; this.plans.clear(); this.lastHarmonyKey = ''; }
  reset(): void { this.epoch = 0; this.harmonyIndex = -1; this.chordStepOffset = 0; this.latchedHarmony = null; this.previousVoicing = []; this.plans.clear(); this.lastHarmonyKey = ''; this.frozen = {}; this.frozenStarts = {}; }
  getRuntime(): ComposerRuntime { return { epoch: this.epoch, harmonyIndex: this.harmonyIndex, chordStepOffset: this.chordStepOffset, harmony: this.getHarmony(), latchedHarmony: this.latchedHarmony ? { ...this.latchedHarmony, notes: [...this.latchedHarmony.notes] } : null, previousVoicing: [...this.previousVoicing], frozen: structuredClone(this.frozen), frozenStarts: { ...this.frozenStarts } }; }
  restore(raw: unknown): void {
    if (raw === undefined || raw === null) return;
    if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Ungültiger Generatorzustand.');
    const s = raw as Partial<ComposerRuntime>;
    const finite = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
    if (s.epoch !== undefined && !finite(s.epoch, 0, 1e9)) throw new Error('Ungültiger Variationszustand.');
    if (s.harmonyIndex !== undefined && !finite(s.harmonyIndex, -1, 1e9)) throw new Error('Ungültige Harmonieposition.');
    this.epoch = Math.floor(s.epoch || 0); this.harmonyIndex = Math.floor(s.harmonyIndex ?? -1); this.chordStepOffset = Math.floor(typeof s.chordStepOffset === 'number' && Number.isFinite(s.chordStepOffset) ? s.chordStepOffset : 0);
    if (s.harmony !== undefined) {
      const h = s.harmony;
      if (!h || typeof h !== 'object' || !Array.isArray(h.notes) || h.notes.length > 8 || !h.notes.every(n => finite(n, 0, 127)) || !finite(h.root, 0, 127) || !finite(h.degree, 0, 12) || !finite(h.index, 0, 1e9) || typeof h.name !== 'string') throw new Error('Ungültiger Harmoniezustand.');
      this.harmony = { ...h, name: h.name.slice(0, 30), notes: h.notes.map(Math.round) };
    }
    this.latchedHarmony = null;
    if (s.latchedHarmony && typeof s.latchedHarmony === 'object' && Array.isArray(s.latchedHarmony.notes) && s.latchedHarmony.notes.length > 0 && s.latchedHarmony.notes.length <= 8 && s.latchedHarmony.notes.every(n => finite(n, 0, 127)) && finite(s.latchedHarmony.root, 0, 127) && finite(s.latchedHarmony.degree, 0, 12) && typeof s.latchedHarmony.name === 'string') {
      this.latchedHarmony = { degree: s.latchedHarmony.degree, root: s.latchedHarmony.root, notes: s.latchedHarmony.notes.map(Math.round), index: finite(s.latchedHarmony.index, 0, 1e9) ? s.latchedHarmony.index : 0, name: s.latchedHarmony.name.slice(0, 30) };
    }
    if (s.previousVoicing !== undefined && (!Array.isArray(s.previousVoicing) || s.previousVoicing.length > 8 || !s.previousVoicing.every(n => finite(n, 0, 127)))) throw new Error('Ungültige Stimmführung.');
    this.previousVoicing = (s.previousVoicing || []).map(Math.round); this.frozen = {}; this.frozenStarts = {};
    if (s.frozen !== undefined && (!s.frozen || typeof s.frozen !== 'object' || Array.isArray(s.frozen))) throw new Error('Ungültige Freeze-Phrasen.');
    for (const [layerId, notes] of Object.entries(s.frozen || {})) {
      if (!['drone', 'chords', 'bass', 'melody', 'kick', 'snare', 'hihat', 'perc'].includes(layerId) || !Array.isArray(notes) || notes.length > 1024) throw new Error('Ungültige Freeze-Phrase.');
      if (!notes.every(n => n && typeof n === 'object' && finite(n.note, 0, 127) && finite(n.velocity, 1, 127) && finite(n.startBeat, 0, 16) && finite(n.durationBeats, 0.001, 16) && finite(n.channel, 1, 16))) throw new Error('Ungültige Note in Freeze-Phrase.');
      this.frozen[layerId] = notes.map(n => ({ ...n, layerId, note: Math.round(n.note), velocity: Math.round(n.velocity), channel: Math.round(n.channel) }));
      const start = s.frozenStarts?.[layerId]; if (!finite(start, 0, 1e9)) throw new Error('Ungültige Freeze-Position.'); this.frozenStarts[layerId] = start;
    }
    this.plans.clear(); this.lastHarmonyKey = '';
  }
  setFrozen(layerId: string, notes: ClipNote[], startBeat: number): void { this.frozen[layerId] = structuredClone(notes); this.frozenStarts[layerId] = startBeat; }
  clearFrozen(layerId: string): void { delete this.frozen[layerId]; delete this.frozenStarts[layerId]; }
  harmonyAt(step: number, session: JamSession): Harmony {
    const chordLayer = session.layers.find(l => l.role === 'chords');
    const slot = harmonySlotAt(step, session.style, chordLayer?.settings?.chordPace, false);
    const index = slot.index;
    const loopMode: ChordLoopMode = session.chordLoopMode || 'ABCD';
    const loopLen = loopMode === 'A' ? 1 : loopMode === 'AB' ? 2 : loopMode === 'ABC' ? 3 : 4;
    // Evolve changes the progression, but a locked or frozen chord layer keeps the original one.
    const epoch = chordLayer?.locked || chordLayer?.frozen ? 0 : this.epoch;
    const paceKey = chordLayer?.settings?.chordPace || 'def';
    const manualDegKey = loopMode === 'A' && typeof session.manualHarmonyDegree === 'number' ? session.manualHarmonyDegree : 'auto';
    const latchedSource = loopMode === 'A' ? (session.latchedHarmony || this.latchedHarmony) : null;
    const latchedKey = latchedSource && latchedSource.notes?.length ? `${latchedSource.degree}:${latchedSource.root}:${latchedSource.notes.join(',')}` : 'none';
    const progKey = session.progressions?.length ? session.progressions.map(p => p.join(',')).join('|') : 'def';
    const key = `${session.sceneId}:${session.root}:${session.scale}:${session.style}:${session.seed}:${index}:${epoch}:${paceKey}:${loopMode}:${manualDegKey}:${latchedKey}:${this.chordStepOffset}:${session.voicingFamily || 'def'}:${progKey}`;
    if (key === this.lastHarmonyKey) return this.getHarmony();

    if (loopMode === 'A' && latchedSource && Array.isArray(latchedSource.notes) && latchedSource.notes.length > 0) {
      this.harmony = {
        degree: latchedSource.degree,
        root: latchedSource.root,
        notes: [...latchedSource.notes],
        index,
        name: latchedSource.name,
      };
      this.previousVoicing = [...latchedSource.notes];
      this.harmonyIndex = index;
      this.lastHarmonyKey = key;
      return this.getHarmony();
    }
    const scale = SCALE_INTERVALS[session.scale] || SCALE_INTERVALS.dorian;
    const defaultTemplates = session.style === 'lofi' ? [
        [0, 3, 1, 4], [0, 5, 3, 4], [0, 2, 5, 3], [0, 3, 5, 4],
        [0, 3, 2, 4], [0, 5, 1, 4], [0, 2, 3, 5], [0, 4, 3, 1]
      ]
      : session.style === 'techno' ? [
        [0, 3, 5, 2], [0, 2, 3, 5], [0, 5, 3, 4], [0, 3, 5, 4],
        [0, 2, 5, 3], [0, 5, 2, 4], [0, 4, 3, 5], [0, 3, 2, 5]
      ]
      : [
        [0, 5, 3, 4], // i - VI - iv - v (emotive classic)
        [0, 2, 5, 4], // i - III - VI - v (CBL / Carbon Based Lifeforms)
        [0, 3, 6, 5], // i - iv - VII - VI (Jon Hopkins / floating)
        [0, 4, 2, 5], // i - v - III - VI (Olafur Arnalds / Neo-classical)
        [0, 2, 3, 5], // i - III - iv - VI (cinematic journey)
        [0, 5, 2, 6], // i - VI - III - VII (melodic deep space)
        [0, 3, 5, 4], // i - iv - VI - v (mystical atmospheric)
        [0, 6, 5, 3], // i - VII - VI - iv (descending melancholic)
        [0, 4, 3, 5], // i - v - iv - VI
        [0, 5, 4, 2], // i - VI - v - III
        [0, 5, 2, 4], // i - VI - III - v (pure consonant minor/major degrees)
        [0, 3, 2, 4], // i - iv - III - v
      ];
    const templates = session.progressions?.length ? session.progressions : defaultTemplates;
    const rngIndex = loopMode === 'A' ? 0 : index;
    const rng = new PRNG(streamSeed(session.seed, 'harmony', Math.floor(rngIndex / 4) + epoch * 131));
    // Diverse harmonic movement: epoch 0 deterministically maps seed+sceneId to a progression; Evolve explores freely.
    const templateIndex = epoch === 0
      ? (streamSeed(session.seed, `prog-${session.sceneId}`, 0) % templates.length)
      : rng.rangeInt(0, templates.length - 1);
    const template = templates[templateIndex];
    let degree: number;
    if (loopMode === 'A') {
      const rawDeg = typeof session.manualHarmonyDegree === 'number'
        ? session.manualHarmonyDegree
        : template[((this.chordStepOffset % template.length) + template.length) % template.length];
      degree = ((rawDeg % scale.length) + scale.length) % scale.length;
    } else {
      const activeTemplate = template.slice(0, Math.min(template.length, loopLen));
      const posInTemplate = ((index + this.chordStepOffset) % activeTemplate.length + activeTemplate.length) % activeTemplate.length;
      degree = activeTemplate[posInTemplate] % scale.length;
    }
    const root = scaleNote(session.root, session.scale, degree);
    const voiceSlot = loopMode === 'A' ? 0 : index;
    let offsets = session.style === 'lofi' && scale.length >= 7 ? [0, 2, 4, 6] : [0, 4, 2];
    if (scale.length >= 7) {
      const familyPool = session.voicingFamily ? VOICING_FAMILIES[session.voicingFamily] : null;
      if (familyPool) {
        const voice = new PRNG(streamSeed(session.seed, 'voicing', voiceSlot + epoch * 977));
        const movement = session.macros.movement;
        const activePool = epoch > 0 && session.style !== 'lofi' ? [...familyPool, ...VOICINGS] : familyPool;
        const filtered = activePool.filter(v => movement >= v.minMovement);
        const pool = filtered.length ? filtered : activePool;
        const total = pool.reduce((sum, v) => sum + v.weight, 0);
        let pick = voice.next() * total;
        offsets = (pool.find(v => (pick -= v.weight) < 0) || pool[0]).offsets;
      } else if (session.style !== 'lofi') {
        // Lush ninth / suspended voicings for ambient and techno; richer ones appear as Bewegung rises.
        const voice = new PRNG(streamSeed(session.seed, 'voicing', voiceSlot + epoch * 977)); const movement = session.macros.movement;
        const pool = VOICINGS.filter(v => movement >= v.minMovement); const total = pool.reduce((sum, v) => sum + v.weight, 0); let pick = voice.next() * total;
        offsets = (pool.find(v => (pick -= v.weight) < 0) || pool[0]).offsets;
      }
    }
    const layer = session.layers.find(l => l.role === 'chords');
    const notes = voiceLead(offsets.map(n => scaleNote(session.root, session.scale, degree + n)), this.previousVoicing, layer?.settings.minNote ?? session.root, layer?.settings.maxNote ?? session.root + 25);
    const intervals = offsets.map(n => scaleNote(session.root, session.scale, degree + n) - root);
    this.harmony = { degree, root, notes, index, name: `${PC_NAMES[((root % 12) + 12) % 12]}${chordSuffix(intervals)}` };
    if (loopMode === 'A' && !this.latchedHarmony && !session.latchedHarmony) {
      this.latchedHarmony = { degree, root, notes: [...notes], index: 0, name: this.harmony.name };
    }
    this.previousVoicing = notes; this.harmonyIndex = index; this.lastHarmonyKey = key; return this.getHarmony();
  }
  /** Advance or rewind one chord within the progression loop without reverting on the next step. */
  stepChord(direction: 1 | -1, step: number, session: JamSession): Harmony {
    if (session.chordLoopMode === 'A') {
      const scaleLen = (SCALE_INTERVALS[session.scale] || SCALE_INTERVALS.dorian).length;
      const nextDeg = ((this.harmony.degree + direction) % scaleLen + scaleLen) % scaleLen;
      const updated = this.setHarmonyDegree(nextDeg, session);
      this.latchedHarmony = { ...updated, notes: [...updated.notes] };
      return updated;
    }
    this.chordStepOffset += direction;
    this.plans.clear();
    this.lastHarmonyKey = '';
    return this.harmonyAt(step, session);
  }
  /** Nudge an individual note in the current chord voicing on the fly by a given semitone offset. */
  nudgeChordNote(index: number, semitones: number): Harmony {
    if (index >= 0 && index < this.harmony.notes.length) {
      const nextNote = Math.max(0, Math.min(127, Math.round(this.harmony.notes[index] + semitones)));
      this.harmony.notes[index] = nextNote;
      const root = this.harmony.root;
      const intervals = this.harmony.notes.map(n => n - root);
      this.harmony.name = `${PC_NAMES[((root % 12) + 12) % 12]}${chordSuffix(intervals)}`;
      this.previousVoicing = [...this.harmony.notes];
      if (this.latchedHarmony) {
        this.latchedHarmony = { ...this.harmony, notes: [...this.harmony.notes] };
      }
      this.plans.clear();
      this.lastHarmonyKey = `manual-${Date.now()}-${index}-${nextNote}`;
    }
    return this.getHarmony();
  }
  /** Cycle or manually jump to a harmonic scale degree on the fly. */
  setHarmonyDegree(degree: number, session: JamSession): Harmony {
    const scale = SCALE_INTERVALS[session.scale] || SCALE_INTERVALS.dorian;
    const normDegree = ((degree % scale.length) + scale.length) % scale.length;
    const root = scaleNote(session.root, session.scale, normDegree);
    let offsets = session.style === 'lofi' && scale.length >= 7 ? [0, 2, 4, 6] : [0, 4, 2];
    if (session.style !== 'lofi' && scale.length >= 7) {
      const pool = VOICINGS.filter(v => session.macros.movement >= v.minMovement);
      offsets = pool.length ? pool[0].offsets : [0, 4, 2];
    }
    const layer = session.layers.find(l => l.role === 'chords');
    const notes = voiceLead(offsets.map(n => scaleNote(session.root, session.scale, normDegree + n)), this.previousVoicing, layer?.settings.minNote ?? session.root, layer?.settings.maxNote ?? session.root + 25);
    const intervals = offsets.map(n => scaleNote(session.root, session.scale, normDegree + n) - root);
    this.harmony = { degree: normDegree, root, notes, index: this.harmony.index, name: `${PC_NAMES[((root % 12) + 12) % 12]}${chordSuffix(intervals)}` };
    this.previousVoicing = notes;
    if (session.chordLoopMode === 'A' || this.latchedHarmony) {
      this.latchedHarmony = { ...this.harmony, notes: [...notes] };
    }
    this.plans.clear();
    this.lastHarmonyKey = `manual-deg-${normDegree}-${Date.now()}`;
    return this.getHarmony();
  }
  /** Transpose all current chord voicing notes by semitones on the fly. */
  transposeVoicing(semitones: number): Harmony {
    this.harmony.notes = this.harmony.notes.map(n => Math.max(0, Math.min(127, n + semitones)));
    this.harmony.root = Math.max(0, Math.min(127, this.harmony.root + semitones));
    const root = this.harmony.root;
    const intervals = this.harmony.notes.map(n => n - root);
    this.harmony.name = `${PC_NAMES[((root % 12) + 12) % 12]}${chordSuffix(intervals)}`;
    this.previousVoicing = [...this.harmony.notes];
    if (this.latchedHarmony) {
      this.latchedHarmony = { ...this.harmony, notes: [...this.harmony.notes] };
    }
    this.plans.clear();
    this.lastHarmonyKey = `manual-trans-${semitones}-${Date.now()}`;
    return this.getHarmony();
  }
  /** Name of the harmony after the current one, computed without disturbing voice-leading state. */
  peekNext(step: number, session: JamSession): Harmony {
    const chordLayer = session.layers.find(l => l.role === 'chords');
    const slot = harmonySlotAt(step, session.style, chordLayer?.settings?.chordPace, false);
    const nextStep = slot.slotStartStep + slot.holdBars * 16;
    const saved = { harmony: this.harmony, previous: [...this.previousVoicing], index: this.harmonyIndex, key: this.lastHarmonyKey };
    const next = this.harmonyAt(nextStep, session);
    this.harmony = saved.harmony; this.previousVoicing = saved.previous; this.harmonyIndex = saved.index; this.lastHarmonyKey = saved.key;
    return next;
  }
  planStep(step: number, session: JamSession): PlannedNote[] {
    const harmony = this.harmonyAt(step, session); const result: PlannedNote[] = []; const anySolo = session.layers.some(l => l.solo);
    const chordLayer = session.layers.find(l => l.role === 'chords');
    const activeChordSlot = harmonySlotAt(step, session.style, chordLayer?.settings?.chordPace, false);
    for (const layer of session.layers) {
      if (layer.muted || (anySolo && !layer.solo) || layer.volume <= 0) continue;
      if (layer.frozen && this.frozen[layer.id]) {
        if (step / 4 < this.frozenStarts[layer.id]) continue;
        const phase = (((step / 4 - this.frozenStarts[layer.id]) % 16) + 16) % 16;
        for (const n of this.frozen[layer.id]) if (Math.abs(Math.floor(n.startBeat * 4) / 4 - phase) < 0.00001) result.push({ layerId: layer.id, note: n.note, velocity: n.velocity, durationBeats: n.durationBeats, microMs: 0, offsetBeats: n.startBeat - phase });
        continue;
      }
      const isChordLayer = layer.role === 'chords';
      const layerSlot = isChordLayer ? harmonySlotAt(step, session.style, layer.settings.chordPace, false) : null;
      const effectivePhraseBars = layerSlot ? layerSlot.holdBars : layer.settings.phraseBars;
      const phraseSteps = effectivePhraseBars * 16;
      const phraseIndex = layerSlot ? layerSlot.index : Math.floor(step / phraseSteps);
      const localStep = layerSlot ? step - layerSlot.slotStartStep : step % phraseSteps;
      const epoch = layer.locked ? 0 : this.epoch + (session.evolving ? Math.floor(step / 128) : 0);
      const paceSig = isChordLayer || layer.role === 'bass'
        ? `${chordLayer?.settings?.chordPace || 'def'}:${activeChordSlot.holdBars}:${session.chordLoopMode || 'ABCD'}:${session.manualHarmonyDegree ?? 'a'}`
        : layer.role === 'melody' && session.customMotifNotes?.length
          ? `cm:${session.customMotifNotes.map(n => `${n.pos},${n.degreeOffset}`).join(';')}`
          : '';
      const signature = `${session.seed}:${session.root}:${session.scale}:${session.style}:${harmony.index}:${harmony.name}:${phraseIndex}:${effectivePhraseBars}:${paceSig}:${epoch}:${JSON.stringify(layer.settings)}:${session.macros.density}:${session.macros.movement}`;
      let plan = this.plans.get(layer.id);
      if (!plan || plan.key !== signature) {
        plan = {
          key: signature,
          notes: this.makePlan(layer, session, harmony, layer.locked || !session.evolving ? 0 : phraseIndex, epoch, effectivePhraseBars, activeChordSlot.holdBars),
        };
        this.plans.set(layer.id, plan);
      }
      result.push(...plan.notes.filter(n => n.step === localStep));
    }
    return result;
  }
  heldNotesAtStep(step: number, session: JamSession): PlannedNote[] {
    const copy = new JamComposer(); copy.restore(this.getRuntime()); const active = new Map<string, PlannedNote>(); const beat = step / 4;
    const historySteps = Math.max(16, ...session.layers.map(l => (l.role === 'chords' ? Math.max(l.settings.phraseBars, holdBarsFor(session.style, l.settings.chordPace)) : l.settings.phraseBars) * 16));
    for (let cursor = Math.max(0, step - historySteps); cursor < step; cursor++) for (const note of copy.planStep(cursor, session)) {
      const layer = session.layers.find(l => l.id === note.layerId)!; if (layer.role === 'drum') continue;
      const onset = cursor / 4 + (note.offsetBeats !== undefined ? note.offsetBeats : (cursor % 2 ? session.swing * 0.1 : 0) + note.microMs * session.bpm / 60000);
      const remaining = onset + note.durationBeats - beat;
      if (remaining > 0.02) active.set(`${layer.id}:${note.note}:${note.channel || layer.channel}`, { ...note, durationBeats: remaining, microMs: 0, offsetBeats: undefined });
    }
    return [...active.values()];
  }
  private makePlan(layer: JamLayer, session: JamSession, harmony: Harmony, phraseIndex: number, epoch: number, effectivePhraseBars?: number, chordSlotHoldBars?: number): Array<PlannedNote & { step: number }> {
    const s = layer.settings; const lofi = session.style === 'lofi'; const techno = session.style === 'techno';
    const holdSingleChord = session.chordLoopMode === 'A';
    const phraseBars = effectivePhraseBars ?? s.phraseBars;
    const length = phraseBars * 16;
    const rng = new PRNG(streamSeed(session.seed, layer.id, Math.floor(phraseIndex / 2) + epoch * 31));
    const notes: Array<PlannedNote & { step: number }> = [];
    const density = clamp(s.density * (0.48 + session.macros.density * 1.1), s.mutationDensityMin ?? 0, s.mutationDensityMax ?? 1); const movement = session.macros.movement;
    const add = (step: number, note: number, duration: number, accent = 0.5, jitter = true, micro?: number) => {
      if (!Number.isFinite(note)) return;
      notes.push({ step, layerId: layer.id, note: Math.round(clamp(note, 0, 127)), durationBeats: Math.max(0.04, duration),
        velocity: Math.round(clamp(s.velocityMin + (s.velocityMax - s.velocityMin) * clamp(accent + rng.range(-0.08, 0.08), 0, 1), 1, 127)), microMs: micro ?? (jitter ? rng.range(-s.humanizeMs, s.humanizeMs) : 0) });
    };
    const fit = (note: number) => {
      const allowed: number[] = []; const scale = SCALE_INTERVALS[session.scale] || SCALE_INTERVALS.dorian;
      for (let n = s.minNote; n <= s.maxNote; n++) if (scale.includes(((n - session.root) % 12 + 12) % 12)) allowed.push(n);
      const samePitch = allowed.filter(n => ((n - note) % 12 + 12) % 12 === 0); const choices = samePitch.length ? samePitch : allowed;
      return choices.sort((a, b) => Math.abs(a - note) - Math.abs(b - note))[0] ?? NaN;
    };
    if (layer.role === 'drone') {
      if (s.ambientAlgorithm === 'granularDrift') {
        for (let step = 0; step < length; step++) {
          if (rng.chance(density * 0.22)) {
            const degree = harmony.degree + rng.pick([0, 0, 2, 4, 4, 6]);
            add(step, fit(scaleNote(session.root, session.scale, degree)), rng.pick([0.75, 1.25, 1.75, 2.0]), 0.24 + rng.next() * 0.22);
          }
        }
      } else if (density > 0 && (phraseIndex === 0 || rng.chance(Math.max(0.55, density)))) {
        const dur = s.phraseBars * 4;
        const style: DroneStyle = s.droneStyle ?? 'rootFifth';
        if (style === 'pedalTonic') {
          add(0, fit(session.root - 12), dur, 0.42, false, 0);
        } else if (style === 'rootOctave') {
          const rootNote = fit(session.root - 12);
          const octNote = fit(session.root);
          add(0, rootNote, dur, 0.40, false, 0);
          if (octNote !== rootNote && density > 0.3) add(0, octNote, dur, 0.25, false, 0);
        } else if (style === 'shiftingFifth') {
          const anchor = harmony.root;
          const rootNote = fit(anchor - 12);
          const fifthNote = fit(anchor - 5);
          add(0, rootNote, dur, 0.40, false, 0);
          if (fifthNote !== rootNote && density > 0.32) add(0, fifthNote, dur, 0.26, false, 0);
        } else if (style === 'cluster') {
          const rootNote = fit(session.root - 12);
          const secNote = fit(scaleNote(session.root, session.scale, 1) - 12);
          const fifthNote = fit(session.root - 5);
          add(0, rootNote, dur, 0.24, false, 0);
          if (secNote !== rootNote) add(0, secNote, dur, 0.14, false, 0);
          if (fifthNote !== rootNote && fifthNote !== secNote) add(0, fifthNote, dur, 0.18, false, 0);
        } else if (style === 'infiniteRibbon') {
          const rootNote = fit(session.root - 12);
          const fifthNote = fit(session.root - 5);
          const octNote = fit(session.root);
          add(0, rootNote, dur + 0.15, 0.42, false, 0);
          if (fifthNote !== rootNote) add(0, fifthNote, dur, 0.24, false, 18);
          if (octNote !== rootNote && length >= 32) add(Math.floor(length / 2), octNote, dur / 2 + 0.15, 0.26, false, 24);
        } else if (style === 'angelicTriad') {
          const tones = harmony.notes.slice(0, 3);
          tones.forEach((p, idx) => add(0, fit(p + 12), dur, 0.36 - idx * 0.04, false, idx * 28));
        } else if (style === 'subCatharsis') {
          const rootNote = fit(session.root - 12);
          const fifthNote = fit(session.root - 5);
          const ninthNote = fit(scaleNote(session.root, session.scale, 8));
          add(0, rootNote, dur, 0.44, false, 0);
          if (fifthNote !== rootNote) add(0, fifthNote, dur, 0.26, false, 12);
          if (ninthNote !== rootNote && ninthNote !== fifthNote) add(0, ninthNote, dur, 0.18, false, 36);
        } else if (style === 'quartalStack') {
          [0, 3, 6].forEach((degOff, idx) => {
            add(0, fit(scaleNote(session.root - 12, session.scale, harmony.degree + degOff)), dur, 0.34 - idx * 0.05, false, idx * 22);
          });
        } else if (style === 'binauralBreath') {
          const halfSteps = Math.max(16, Math.floor(length / 2));
          for (let step = 0; step < length; step += halfSteps) {
            const p = step % (halfSteps * 2) === 0 ? fit(session.root - 12) : fit(session.root - 5);
            add(step, p, halfSteps / 4, 0.38, false, 12);
          }
        } else {
          // rootFifth: Deep sub-fundamental anchor + harmonic fifth
          const rootNote = fit(session.root - 12);
          add(0, rootNote, dur, 0.42, false, 0);
          const fifthNote = fit(session.root - 5);
          if (density > 0.42 && fifthNote !== rootNote) {
            add(0, fifthNote, dur, 0.28, false, 0);
          }
        }
      }
    } else if (layer.role === 'chords') {
      const pattern: ChordPattern | undefined = s.chordPattern;
      const roll = lofi ? rng.range(12, 34) : rng.range(35, 95);
      const chordHoldBars = effectivePhraseBars ?? holdBarsFor(session.style, s.chordPace);
      const chordStride = Math.max(16, chordHoldBars * 16);
      const maxChordDur = Math.max(1.8, chordHoldBars * 4);
      const capDur = (stepPos: number, desired: number) => Math.max(0.18, Math.min(desired, (length - stepPos) / 4));

      if (pattern === 'pulse') {
        // CBL / Ultimae floating harmonic pad foundation with gentle dotted-8th upper-voice pulses (never choppy block stabs)
        const pulseRhythms = [
          [0, 6, 12],
          [0, 6, 10, 14],
          [0, 4, 10],
          [0, 6, 14],
        ];
        // Step 0 lays a long, continuous rolled pad bed so the chord never sounds chopped or wooden
        harmony.notes.forEach((pitch, i) => add(0, fit(pitch), Math.min(maxChordDur, Math.max(3.6, chordHoldBars * 2)), 0.50 - i * 0.03, false, i * roll));
        for (let bar = 0; bar < phraseBars; bar++) {
          if (density <= 0 || (phraseIndex !== 0 && !rng.chance(Math.max(0.45, density)))) continue;
          const positions = pulseRhythms[(bar + Math.floor(phraseIndex)) % pulseRhythms.length];
          for (let pi = 0; pi < positions.length; pi++) {
            const pos = positions[pi];
            if (bar === 0 && pos === 0) continue; // already added step 0
            if (!rng.chance(Math.min(1, 0.4 + density * 0.65))) continue;
            const isDownbeat = pos === 0;
            const breath = 0.34 + 0.16 * Math.sin((pos / 16) * Math.PI);
            const vel = (isDownbeat ? 0.48 : breath) * (0.85 + rng.range(0, 0.2));
            const stepPos = bar * 16 + pos;
            const duration = capDur(stepPos, isDownbeat ? 3.6 : 1.9 + rng.range(0, 0.8));
            const voicing = isDownbeat ? harmony.notes : harmony.notes.slice(-2);
            voicing.forEach((pitch, i) => {
              add(stepPos, fit(pitch), duration, Math.max(0.15, vel - i * 0.03), false, i * (isDownbeat ? roll : Math.round(roll * 0.5)));
            });
          }
        }
      } else if (pattern === 'broken') {
        // Neo-Classical / Nils Frahm pedal-held arpeggiated voicings: long overlapping sustain
        harmony.notes.forEach((pitch, i) => add(0, fit(pitch), Math.min(maxChordDur, 3.8), 0.46 - i * 0.03, false, i * roll));
        for (let bar = 0; bar < phraseBars; bar++) {
          if (density <= 0 || (phraseIndex !== 0 && !rng.chance(Math.max(0.45, density)))) continue;
          const stepSlots = lofi ? [0, 3, 6, 10, 12, 14] : [0, 4, 8, 12];
          const count = harmony.notes.length;
          const voiceSeq = bar % 2 === 0
            ? [0, 1, 2, Math.min(3, count - 1), Math.max(0, count - 2), 1]
            : [0, 2, 1, Math.min(3, count - 1), 0, 2];
          stepSlots.forEach((slot, si) => {
            if (bar === 0 && slot === 0) return;
            if (!rng.chance(Math.min(1, 0.42 + density * 0.65))) return;
            const voiceIdx = voiceSeq[si % voiceSeq.length] % count;
            const pitch = harmony.notes[voiceIdx];
            const octaveOffset = (si >= 3 && rng.chance(0.3)) ? 12 : 0;
            const vel = 0.34 + rng.range(0, 0.16) + (slot % 4 === 0 ? 0.06 : 0);
            const stepPos = bar * 16 + slot;
            add(stepPos, fit(pitch + octaveOffset), capDur(stepPos, 3.0 + rng.range(0, 1.2)), vel, false, rng.range(8, 28));
          });
        }
      } else if (pattern === 'syncopated' || (techno && !pattern)) {
        // Dub-techno / funk off-beat stabs with space for tape echoes
        const compPatterns = [
          [6, 14],
          [3, 12],
          [6, 11],
          [2, 10],
          [4, 14],
        ];
        harmony.notes.forEach((pitch, i) => add(0, fit(pitch), techno ? 0.65 : Math.min(maxChordDur, 1.8), 0.48 - i * 0.04, false, i * roll));
        for (let bar = 0; bar < phraseBars; bar++) {
          if (density <= 0 || (phraseIndex !== 0 && !rng.chance(Math.max(0.5, density)))) continue;
          const positions = compPatterns[(bar + Math.floor(phraseIndex)) % compPatterns.length];
          const voicing = rng.chance(0.5) ? harmony.notes.slice(-3) : harmony.notes;
          for (const pos of positions) {
            if (bar === 0 && pos === 0) continue;
            if (!rng.chance(Math.min(1, 0.45 + density * 0.6))) continue;
            const stepPos = bar * 16 + pos;
            const duration = capDur(stepPos, techno ? 0.45 + rng.range(0, 0.35) : 0.9 + rng.range(0, 0.6));
            const vel = (pos === 6 || pos === 14 ? 0.50 : 0.38) + rng.range(0, 0.08);
            voicing.forEach((pitch, i) => add(stepPos, fit(pitch), duration, Math.max(0.15, vel - i * 0.04), false, rng.chance(0.4) ? i * rng.range(6, 16) : 0));
          }
        }
      } else if (pattern === 'euclidean') {
        // Algorithmic Euclidean pulses with warm sustain
        const k = density > 0.65 ? 4 : 3;
        const euclideanSteps: number[] = [];
        for (let i = 0; i < 16; i++) {
          if (Math.floor((i * k) / 16) !== Math.floor(((i - 1) * k) / 16)) {
            euclideanSteps.push(i);
          }
        }
        for (let bar = 0; bar < phraseBars; bar++) {
          if (density <= 0 || (phraseIndex !== 0 && !rng.chance(Math.max(0.45, density)))) continue;
          euclideanSteps.forEach((stepPos, si) => {
            if (bar === 0 && stepPos === 0) {
              harmony.notes.forEach((pitch, i) => add(0, fit(pitch), Math.min(maxChordDur, 3.2), 0.48 - i * 0.04, false, i * roll));
              return;
            }
            if (!rng.chance(Math.min(1, 0.48 + density * 0.55))) return;
            const isAccent = si === 0 || stepPos === 0;
            const vel = (isAccent ? 0.48 : 0.34) + rng.range(0, 0.12);
            const voicing = isAccent ? harmony.notes : harmony.notes.slice(-2);
            const absStep = bar * 16 + stepPos;
            const dur = capDur(absStep, 2.2 + rng.range(0, 0.8));
            voicing.forEach((pitch, i) => add(absStep, fit(pitch), dur, Math.max(0.15, vel - i * 0.03), false, i * Math.round(roll * 0.5)));
          });
        }
      } else if (pattern === 'wave') {
        // Cascading oceanic swell: long, overlapping legato waves
        for (let bar = 0; bar < phraseBars; bar += 2) {
          if (density <= 0 || (phraseIndex !== 0 && !rng.chance(Math.max(0.45, density)))) continue;
          if (bar === 0) {
            harmony.notes.forEach((pitch, i) => add(0, fit(pitch), Math.min(maxChordDur, Math.max(3.6, chordHoldBars * 3.6)), 0.46 - i * 0.03, false, i * roll));
          } else {
            harmony.notes.forEach((pitch, i) => {
              const voiceDelaySteps = (i * 4) % 16;
              const absStep = bar * 16 + voiceDelaySteps;
              if (absStep < length) {
                add(absStep, fit(pitch), capDur(absStep, 7.5), 0.40 - i * 0.03, false, rng.range(15, 50));
              }
            });
          }
        }
      } else if (pattern === 'cluster') {
        // Shimmering polyrhythmic tapestry: slow independent voice breathing
        harmony.notes.forEach((pitch, i) => {
          add(0, fit(pitch), Math.min(maxChordDur, 5.5), 0.44 - i * 0.03, false, i * roll);
          const intervalSteps = [8, 12, 16, 20][i % 4];
          for (let step = intervalSteps; step < length; step += intervalSteps) {
            if (!rng.chance(Math.min(1, 0.38 + density * 0.6))) continue;
            const vel = 0.30 + rng.range(0, 0.14);
            add(step, fit(pitch), capDur(step, 4.2 + rng.range(0, 1.2)), vel, false, rng.range(15, 60));
          }
        });
      } else if (pattern === 'eternalDrone') {
        harmony.notes.forEach((pitch, i) => add(0, fit(pitch), chordHoldBars * 4 + 0.08, 0.50 - i * 0.03, false, i * 18));
      } else if (pattern === 'risingArp') {
        const arpPool = [...harmony.notes, ...harmony.notes.slice(0, 2).map(n => n + 12)];
        for (let bar = 0; bar < phraseBars; bar++) {
          for (let slot = 0; slot < 8; slot++) {
            const absStep = bar * 16 + slot * 2;
            const pitch = arpPool[slot % arpPool.length];
            add(absStep, fit(pitch), capDur(absStep, 0.95), slot === 0 ? 0.52 : 0.36 + (slot % 4) * 0.03, false, rng.range(2, 10));
          }
        }
      } else if (pattern === 'fallingArp') {
        const arpPool = [...harmony.notes, ...harmony.notes.slice(0, 2).map(n => n + 12)].reverse();
        for (let bar = 0; bar < phraseBars; bar++) {
          for (let slot = 0; slot < 8; slot++) {
            const absStep = bar * 16 + slot * 2;
            const pitch = arpPool[slot % arpPool.length];
            add(absStep, fit(pitch), capDur(absStep, 0.95), slot === 0 ? 0.52 : 0.36 + ((7 - slot) % 4) * 0.03, false, rng.range(2, 10));
          }
        }
      } else if (pattern === 'pendulumArp') {
        const up = harmony.notes;
        const seq = up.length >= 2 ? [...up, ...up.slice(1, -1).reverse()] : up;
        for (let bar = 0; bar < phraseBars; bar++) {
          for (let slot = 0; slot < 8; slot++) {
            const absStep = bar * 16 + slot * 2;
            const pitch = seq[(bar * 8 + slot) % seq.length];
            add(absStep, fit(pitch), capDur(absStep, 0.85), slot % 4 === 0 ? 0.48 : 0.36, false, rng.range(2, 10));
          }
        }
      } else if (pattern === 'offbeatEcho') {
        harmony.notes.forEach((pitch, i) => add(0, fit(pitch), capDur(0, 2.0), 0.48 - i * 0.03, false, i * roll));
        for (let bar = 0; bar < phraseBars; bar++) {
          for (const pos of [2, 6, 10, 14]) {
            const absStep = bar * 16 + pos;
            harmony.notes.slice(-3).forEach((pitch, i) => add(absStep, fit(pitch), capDur(absStep, 0.9), 0.36 - i * 0.03, false, i * 8));
          }
        }
      } else if (pattern === 'tripletFlow') {
        for (let bar = 0; bar < phraseBars; bar++) {
          [0, 3, 6, 9, 12, 14].forEach((pos, idx) => {
            const absStep = bar * 16 + pos;
            const pitch = harmony.notes[idx % harmony.notes.length];
            add(absStep, fit(pitch), capDur(absStep, 1.25), pos === 0 ? 0.50 : 0.38, false, rng.range(4, 14));
          });
        }
      } else if (pattern === 'cathedralChoir') {
        harmony.notes.forEach((pitch, i) => add(0, fit(pitch), maxChordDur, 0.46 - i * 0.03, false, i * 28));
        if (length >= 16) {
          harmony.notes.slice(-2).forEach((pitch, i) => {
            const enterStep = 4 + i * 4;
            if (enterStep < length) add(enterStep, fit(pitch + 12), (length - enterStep) / 4, 0.30, false, 20 + i * 18);
          });
        }
      } else {
        // 'pad' (Living atmospheric pad) or default lo-fi / ambient
        const stride = lofi ? 16 : chordStride;
        for (let step = 0; step < length; step += stride) {
          if (density <= 0 || (phraseIndex !== 0 && !rng.chance(Math.max(0.5, density)))) continue;
          if (lofi) {
            const barIdx = Math.floor(step / 16);
            const lateComp = density >= 0.5 && barIdx % 2 === 0 && rng.chance(0.45 + movement * 0.35);
            const compStep = step + rng.pick([10, 12]);
            harmony.notes.forEach((pitch, i) => add(step, fit(pitch), lateComp ? 2.4 : 4.0, 0.48 - i * 0.04, false, i * roll));
            if (lateComp && compStep < length) {
              harmony.notes.slice(-3).forEach((p, i) => add(compStep, fit(p), 0.85, 0.22 + rng.range(0, 0.08), false, i * 10));
            }
          } else {
            harmony.notes.forEach((pitch, i) => add(step, fit(pitch), Math.max(4.0, chordHoldBars * 4), 0.48 - i * 0.04, false, i * roll));
            // Mid-phrase response: delicate upper dyad blooms smoothly halfway through the hold (disabled in single-chord Hold A)
            if (!holdSingleChord && phraseBars >= 2 && rng.chance(0.32 + movement * 0.38)) {
              const upper = harmony.notes.slice(-2);
              const at = step + Math.min(16, stride / 2);
              if (at < length) {
                upper.forEach((pitch, i) => add(at, fit(pitch + (rng.chance(0.3) ? 12 : 0)), Math.max(2.5, (stride - (at - step)) / 4), 0.28 - i * 0.03, false, i * rng.range(35, 95)));
              }
            }
          }
        }
      }

      if (s.chordTexture && s.chordTexture !== 'off') {
        // Only add companion texture voices on bar downbeats (up to 2 upper tones per bar) to prevent voice-stealing & mud
        const byStep = new Map<number, Array<PlannedNote & { step: number }>>();
        for (const n of notes) {
          if (n.layerId === layer.id && !n.subLayer && n.step % 16 === 0) {
            const arr = byStep.get(n.step) || [];
            arr.push(n);
            byStep.set(n.step, arr);
          }
        }
        for (const barNotes of byStep.values()) {
          for (const cn of barNotes.slice(0, 2)) {
            let interval = 12;
            let velMult = 0.46;
            let durMult = 1.25;
            let microOffset = 20;
            if (s.chordTexture === 'shimmer') {
              interval = 12;
              velMult = 0.45;
              durMult = 1.35;
              microOffset = 22;
            } else if (s.chordTexture === 'octave') {
              interval = 12;
              velMult = 0.56;
              durMult = 1.05;
              microOffset = 14;
            } else if (s.chordTexture === 'sub5th') {
              interval = 7;
              velMult = 0.48;
              durMult = 1.15;
              microOffset = 16;
            }
            const texturePitch = fit(cn.note + interval);
            if (Number.isFinite(texturePitch)) {
              notes.push({
                step: cn.step,
                layerId: layer.id,
                note: texturePitch,
                durationBeats: Math.max(0.06, Math.min(cn.durationBeats * durMult, (length - cn.step) / 4 - 0.08)),
                velocity: Math.max(1, Math.min(62, Math.round(cn.velocity * velMult))),
                microMs: cn.microMs + microOffset,
              });
            }
          }
        }
      }

      // Dual-Chord Engine (Layer B): Harmonically locked to the exact same chord (`harmony.notes`),
      // voiced in an open spread inversion with slow, floating counter-swells so it blends seamlessly.
      if (s.secondaryEnabled && (s.secondaryVolume ?? 0.55) > 0.01 && density > 0 && harmony.notes.length >= 2) {
        const addSecondary = (step: number, note: number, duration: number, accent = 0.38, micro = 28) => {
          if (!Number.isFinite(note) || step <= 0 || step >= length) return;
          notes.push({
            step,
            layerId: layer.id,
            subLayer: 'chords_b',
            note: Math.round(clamp(note, 0, 127)),
            durationBeats: Math.max(0.12, Math.min(duration, (length - step) / 4 - 0.08)),
            velocity: Math.round(clamp(s.velocityMin + (s.velocityMax - s.velocityMin) * clamp(accent + rng.range(-0.05, 0.05), 0, 1), 1, 127)),
            microMs: micro,
          });
        };

        // Build complementary open-spread voicing from harmony.notes (upper extensions + inverted root/5th)
        const hn = harmony.notes;
        // Layer B uses an upper inversion / octave-lifted sparse voicing (2-3 tones), never identical to Layer A.
        const upperShift = s.secondaryTimbre === 'root' || s.secondaryTimbre === 'warm' ? 0 : 12;
        const spreadCandidates = [
          fit((hn[1] ?? hn[0]) + upperShift),
          fit((hn[2] ?? hn[hn.length - 1] ?? hn[0]) + 12),
          fit(hn[0] + 12),
        ].filter(Number.isFinite);
        let secVoicing = [...new Set(spreadCandidates)].slice(0, 3);
        if (secVoicing.length === hn.length && secVoicing.every((n, idx) => n === hn[idx])) {
          secVoicing = secVoicing.length > 1 ? secVoicing.slice(1) : [fit((hn[0] ?? session.root) + 12)];
        }
        const secPattern: ChordPattern = s.secondaryPattern || (pattern === 'pad' ? 'wave' : pattern === 'wave' ? 'pad' : 'wave');

        if (secPattern === 'wave') {
          // Ethereal cascading counter-swell entering gently across the phrase
          for (let bar = 0; bar < phraseBars; bar += 2) {
            secVoicing.forEach((pitch, idx) => {
              const stepPos = bar * 16 + ((idx + 1) * 4) % 16;
              if (stepPos === 0) return;
              addSecondary(stepPos, pitch, lofi ? 3.4 : 6.2 + rng.range(0, 1.5), 0.38 - idx * 0.03, 26 + idx * 20);
            });
          }
        } else if (secPattern === 'pad') {
          // Antiphonal counter-pad: blooms smoothly on beat 3 (step 8) bridging the harmonic space
          for (let bar = 0; bar < phraseBars; bar += Math.max(2, Math.min(4, chordHoldBars))) {
            const enterStep = bar * 16 + 8;
            secVoicing.forEach((pitch, idx) => {
              addSecondary(enterStep, pitch, Math.max(3.6, chordHoldBars * 3.6), 0.40 - idx * 0.03, 30 + idx * 24);
            });
          }
        } else if (secPattern === 'broken') {
          // Delicate sparse celesta / felt-piano / glass notes in the upper register
          const slots = [4, 12];
          for (let bar = 0; bar < phraseBars; bar++) {
            slots.forEach((slot, si) => {
              if (!rng.chance(Math.min(1, 0.48 + density * 0.45))) return;
              const pitch = secVoicing[(bar + si) % secVoicing.length];
              addSecondary(bar * 16 + slot, pitch, 3.0 + rng.range(0, 1.0), 0.34, 20 + si * 12);
            });
          }
        } else if (secPattern === 'pulse' || secPattern === 'syncopated' || secPattern === 'euclidean') {
          // Gentle interlocking stereo counter-pulses on beat 2.5 and 4 (steps 6, 12)
          const counterSlots = [6, 12];
          for (let bar = 0; bar < phraseBars; bar += 2) {
            counterSlots.forEach(slot => {
              secVoicing.slice(0, 2).forEach((pitch, idx) => {
                addSecondary(bar * 16 + slot, pitch, 2.6 + rng.range(0, 0.8), 0.36 - idx * 0.03, 18 + idx * 14);
              });
            });
          }
        } else {
          // 'cluster': Slow shimmering upper-register halo
          secVoicing.forEach((pitch, idx) => {
            const strideSteps = [8, 12, 16][idx % 3];
            for (let stepPos = strideSteps; stepPos < length; stepPos += strideSteps * 2) {
              addSecondary(stepPos, pitch, 4.2 + rng.range(0, 1.2), 0.34, 24 + idx * 18);
            }
          });
        }
      }
    } else if (layer.role === 'bass') {
      const bassStyle: BassStyle = s.bassStyle ?? (lofi ? 'jazzWalk' : techno ? 'dubOffbeat' : 'pedal');
      if (bassStyle === 'dubOffbeat') {
        // Off-beat dub techno bass: steps 2, 6, 10, 14 anchored deeply on root (test invariant)
        for (let step = 0; step < length; step++) {
          const pos = step % 16;
          if (![2, 6, 10, 14].includes(pos) || density <= 0) continue;
          const barIdx = Math.floor(step / 16);
          if (techno) {
            if (pos !== 2 && pos !== 10 && !rng.chance(Math.min(1, 0.45 + density * 0.6))) continue;
          } else if (pos !== 2 && pos !== 10 && !rng.chance(density)) continue;
          const isTurnaroundFifth = pos === 14 && barIdx % 2 === 1 && rng.chance(0.35 + movement * 0.3);
          const pitch = isTurnaroundFifth ? scaleNote(session.root, session.scale, harmony.degree + 4) : harmony.root;
          add(step, fit(pitch), 0.42 + rng.range(0, 0.16), pos === 2 ? 0.72 : 0.52, false);
        }
      } else if (bassStyle === 'jazzWalk') {
        for (let bar = 0; bar < s.phraseBars; bar++) {
          if (density <= 0 || (phraseIndex !== 0 && !rng.chance(Math.max(0.45, density)))) continue;
          const barStep = bar * 16;
          const rootPitch = fit(harmony.root);
          add(barStep, rootPitch, 1.8, 0.78, false, rng.range(6, 16));
          const barChoice = (bar + Math.floor(phraseIndex)) % 3;
          if (barChoice === 0 && density > 0.35) {
            const pushPitch = rng.chance(0.6) ? fit(harmony.root - 12) : fit(scaleNote(session.root, session.scale, harmony.degree + 4));
            add(barStep + 6, pushPitch, 1.2, 0.58, false, rng.range(10, 22));
            if (rng.chance(0.45)) add(barStep + 10, rootPitch, 0.25, 0.22, false, rng.range(8, 18));
          } else if (barChoice === 1 && density > 0.4) {
            const midPitch = rng.chance(0.55) ? fit(scaleNote(session.root, session.scale, harmony.degree + 4)) : fit(scaleNote(session.root, session.scale, harmony.degree + 2));
            add(barStep + 8, midPitch, 1.4, 0.62, false, rng.range(10, 22));
            if (rng.chance(0.5)) add(barStep + 11, fit(harmony.root), 0.25, 0.24, false, rng.range(12, 24));
          } else if (barChoice === 2 && density > 0.5) {
            const stepNote = fit(scaleNote(session.root, session.scale, harmony.degree + 2));
            add(barStep + 6, stepNote, 0.9, 0.52, false, rng.range(10, 20));
            const fifthNote = fit(scaleNote(session.root, session.scale, harmony.degree + 4));
            add(barStep + 8, fifthNote, 1.1, 0.56, false, rng.range(10, 20));
          }
          if (density > 0.38 && rng.chance(0.75 + movement * 0.2)) {
            const approachOffset = rng.chance(0.65) ? -1 : 1;
            const approachPitch = fit(scaleNote(session.root, session.scale, harmony.degree + approachOffset));
            const approachStep = rng.chance(0.7) ? 14 : 15;
            add(barStep + approachStep, approachPitch, 0.45, 0.48, false, rng.range(12, 24));
          }
        }
      } else if (bassStyle === 'breathingSub') {
        if (density > 0) {
          const singleBarHold = (chordSlotHoldBars ?? 2) === 1;
          for (let step = 0; step < length; step += 16) {
            if (step % 32 !== 0 && !singleBarHold && !holdSingleChord && !rng.chance(Math.min(0.95, density * 1.15))) continue;
            const anchorPitch = (holdSingleChord || singleBarHold || step % 32 === 0) ? harmony.root : rng.chance(0.55) ? harmony.root : scaleNote(session.root, session.scale, harmony.degree + 4);
            const hasPickup = density >= 0.32 && rng.chance(clamp(density * 0.75 + movement * 0.25, 0, 0.92));
            add(step, fit(anchorPitch), hasPickup ? 3.5 : 4.0, (holdSingleChord || singleBarHold || step % 32 === 0) ? 0.74 : 0.52, true);
            if (hasPickup) {
              const pickupPitch = holdSingleChord ? harmony.root : (movement > 0.45 ? scaleNote(session.root, session.scale, harmony.degree + 2) : scaleNote(session.root, session.scale, harmony.degree + 4));
              add(step + 14, fit(pickupPitch), 0.5, 0.44, true);
            }
          }
        }
      } else if (bassStyle === 'syncopatedGroove') {
        if (density > 0) {
          const grooveHits = [0, 3, 6, 10, 12, 14];
          for (let bar = 0; bar < length; bar += 16) {
            for (const offset of grooveHits) {
              const step = bar + offset;
              const mandatory = offset === 0 || offset === 6 || offset === 10;
              if (!mandatory && !rng.chance(clamp(density * 0.9 + movement * 0.25, 0.12, 0.95))) continue;
              const pitch = offset === 0
                ? harmony.root
                : offset === 10
                  ? scaleNote(session.root, session.scale, harmony.degree + (movement > 0.5 ? 4 : 2))
                  : offset === 14
                    ? harmony.root + (movement > 0.35 ? 12 : 0)
                    : rng.chance(0.6)
                      ? harmony.root
                      : scaleNote(session.root, session.scale, harmony.degree + 4);
              const dur = offset === 0 ? 0.68 : offset === 6 || offset === 10 ? 0.42 : 0.28;
              add(step, fit(pitch), dur, offset === 0 ? 0.78 : offset === 10 ? 0.62 : 0.48, true);
            }
          }
        }
      } else if (bassStyle === 'minimalArp') {
        if (density > 0) {
          const arpDegrees = [0, 4, 7, 2];
          const stride = density < 0.35 ? 6 : 3;
          for (let step = 0, idx = 0; step < length; step += stride, idx++) {
            if (step % 16 !== 0 && !rng.chance(clamp(density + 0.25, 0.3, 0.96))) continue;
            const degOffset = arpDegrees[idx % arpDegrees.length];
            const pitch = degOffset === 7
              ? harmony.root + 12
              : scaleNote(session.root, session.scale, harmony.degree + degOffset);
            add(step, fit(pitch), stride === 6 ? 0.65 : 0.36, idx % 4 === 0 ? 0.7 : 0.46, true);
          }
        }
      } else if (bassStyle === 'pulse8') {
        if (density > 0) {
          let noteIdx = 0;
          for (let step = 0; step < length; step += 2) {
            if (step % 4 !== 0 && density < 0.55 && !rng.chance(clamp(density * 1.4, 0.25, 1))) {
              noteIdx++;
              continue;
            }
            const isFourth = noteIdx % 4 === 3;
            const isEighthTurn = noteIdx % 8 === 7;
            const pitch = isEighthTurn && movement > 0.35
              ? harmony.root + 12
              : isFourth
                ? scaleNote(session.root, session.scale, harmony.degree + 4)
                : (movement > 0.6 && noteIdx % 4 === 2)
                  ? scaleNote(session.root, session.scale, harmony.degree + 2)
                  : harmony.root;
            add(step, fit(pitch), 0.30, step % 16 === 0 ? 0.74 : isFourth ? 0.58 : 0.46, false);
            noteIdx++;
          }
        }
      } else if (bassStyle === 'psyRoll') {
        if (density > 0) {
          const rootPitch = fit(harmony.root);
          const fifthPitch = fit(scaleNote(session.root, session.scale, harmony.degree + 4));
          for (let step = 0; step < length; step++) {
            const beatSub = step % 4;
            if (beatSub === 0) continue; // leave kick on 0 free
            if (density < 0.4 && beatSub === 1 && !rng.chance(density * 1.8)) continue;
            const pitch = movement > 0.55 && step % 16 === 15 ? fifthPitch : rootPitch;
            const accent = beatSub === 1 ? 0.46 : beatSub === 2 ? 0.54 : 0.60;
            add(step, pitch, 0.08, accent, false);
          }
        }
      } else if (bassStyle === 'infiniteDrone') {
        if (density > 0) {
          add(0, fit(harmony.root), length / 4 + 0.05, 0.76, false);
        }
      } else if (bassStyle === 'fifthPendulum') {
        if (density > 0) {
          const rootPitch = fit(harmony.root);
          const fifthPitch = holdSingleChord ? rootPitch : fit(scaleNote(session.root, session.scale, harmony.degree + 4));
          for (let step = 0; step < length; step += 8) {
            add(step, step % 16 === 0 ? rootPitch : fifthPitch, 2.0, step % 16 === 0 ? 0.74 : 0.54, false);
          }
        }
      } else if (bassStyle === 'octaveGlide') {
        if (density > 0) {
          const lowPitch = fit(harmony.root);
          const octPitch = fit(harmony.root + 12);
          for (let step = 0; step < length; step += 8) {
            add(step, step % 16 === 0 ? lowPitch : octPitch, 2.0, step % 16 === 0 ? 0.76 : 0.58, false);
          }
        }
      } else if (bassStyle === 'berlinSequence') {
        if (density > 0) {
          const degSeq = [0, 0, 4, 2, 0, 4, 2, 1];
          for (let step = 0, idx = 0; step < length; step += 2, idx++) {
            const off = holdSingleChord ? (idx % 4 === 2 ? 4 : 0) : degSeq[idx % degSeq.length];
            const pitch = off === 0 ? harmony.root : scaleNote(session.root, session.scale, harmony.degree + off);
            add(step, fit(pitch), 0.48, step % 16 === 0 ? 0.78 : idx % 2 === 0 ? 0.62 : 0.46, false);
          }
        }
      } else if (bassStyle === 'tresilloSub') {
        if (density > 0) {
          const rootPitch = fit(harmony.root);
          const fifthPitch = holdSingleChord ? rootPitch : fit(scaleNote(session.root, session.scale, harmony.degree + 4));
          for (let bar = 0; bar < length; bar += 16) {
            add(bar + 0, rootPitch, 1.5, 0.80, false);
            add(bar + 6, rootPitch, 1.5, 0.62, false);
            add(bar + 12, fifthPitch, 1.0, 0.58, false);
          }
        }
      } else if (bassStyle === 'acidLine') {
        if (density > 0) {
          const rootPitch = fit(harmony.root);
          const octPitch = fit(harmony.root + 12);
          const fifthPitch = fit(scaleNote(session.root, session.scale, harmony.degree + 4));
          const stepsMask = [0, 3, 4, 6, 8, 10, 11, 14, 15];
          for (let bar = 0; bar < length; bar += 16) {
            stepsMask.forEach((pos, idx) => {
              const p = pos === 6 || pos === 14 ? octPitch : pos === 11 ? fifthPitch : rootPitch;
              add(bar + pos, p, 0.24, idx === 0 ? 0.85 : pos === 11 ? 0.76 : 0.52, false);
            });
          }
        }
      } else if (bassStyle === 'ukGarageSub') {
        if (density > 0) {
          const rootPitch = fit(harmony.root);
          const thirdPitch = holdSingleChord ? rootPitch : fit(scaleNote(session.root, session.scale, harmony.degree + 2));
          for (let bar = 0; bar < length; bar += 16) {
            add(bar + 0, rootPitch, 0.75, 0.82, false);
            add(bar + 3, rootPitch, 1.75, 0.66, false);
            add(bar + 10, thirdPitch, 1.0, 0.62, false);
            add(bar + 14, rootPitch, 0.5, 0.56, false);
          }
        }
      } else if (bassStyle === 'poly5Bass') {
        if (density > 0) {
          const degs = [0, 0, 4, 7, 2];
          for (let step = 0, idx = 0; step < length; step += 5, idx++) {
            const off = degs[idx % degs.length];
            const pitch = off === 7 ? harmony.root + 12 : scaleNote(session.root, session.scale, harmony.degree + off);
            add(step, fit(pitch), Math.min(1.25, (length - step) / 4), idx % 3 === 0 ? 0.76 : 0.52, false);
          }
        }
      } else {
        // pedal: 100% seamless legato note per hold (zero gap before next note)
        const holdSteps = Math.max(16, (chordSlotHoldBars ?? 2) * 16);
        const stride = Math.min(32, holdSteps);
        const noteDur = Math.min(stride / 4, length / 4);
        for (let step = 0; step < length; step += stride) {
          if (density <= 0 || (step % 16 !== 0 && !rng.chance(density))) continue;
          const pitch = (holdSingleChord || step % stride === 0 || step % 16 === 0) ? harmony.root : rng.chance(0.68) ? harmony.root : scaleNote(session.root, session.scale, harmony.degree + 4);
          add(step, fit(pitch), noteDur, step % 16 === 0 ? 0.72 : 0.45, false);
        }
      }
    } else if (layer.role === 'melody') {
      const mStyle: MelodyStyle = s.melodyStyle ?? (lofi ? 'lofiHook' : 'motif');
      if (mStyle === 'off' || density <= 0) return notes;
      const hasCustomMotif = Boolean(session.customMotifNotes && session.customMotifNotes.length > 0);

      if (!hasCustomMotif && (mStyle === 'endlessStream' || mStyle === 'arpCascade' || mStyle === 'pentatonicFlow' || mStyle === 'berlinLead' || mStyle === 'cinematicArc' || mStyle === 'callResponse')) {
        const sRng = new PRNG(streamSeed(session.seed, `mel-stream-${mStyle}-${session.sceneId}`, epoch + phraseIndex));
        const activeScale = mStyle === 'pentatonicFlow' ? 'minorPentatonic' : session.scale;
        const positions = mStyle === 'cinematicArc'
          ? [0, 6, 10, 14]
          : mStyle === 'pentatonicFlow'
            ? [0, 3, 6, 8, 10, 12, 14]
            : mStyle === 'berlinLead'
              ? [0, 3, 6, 8, 11, 12, 14]
              : mStyle === 'arpCascade' && density > 0.55
                ? [0, 2, 4, 6, 7, 8, 10, 12, 14, 15]
                : [0, 2, 4, 6, 8, 10, 12, 14];
        const offsets = mStyle === 'arpCascade'
          ? [0, 2, 4, 7, 4, 2, 6, 4]
          : mStyle === 'callResponse'
            ? [4, 5, 4, 2, 0, 2, 1, 0]
            : mStyle === 'berlinLead'
              ? [0, 4, 2, 7, 4, 5, 2, 0]
              : [0, 1, 2, 4, 3, 2, 4, 5];
        for (let bar = 0; bar < s.phraseBars; bar++) {
          positions.forEach((pos, idx) => {
            if (idx > 0 && density < 0.25 && idx % 2 === 1) return;
            const gapBeats = Math.max(0.25, ((positions[idx + 1] ?? 16) - pos) / 4);
            const dur = mStyle === 'cinematicArc' ? gapBeats * 1.02 : mStyle === 'pentatonicFlow' ? gapBeats * 0.96 : gapBeats * 0.88;
            const deg = harmony.degree + offsets[(idx + bar + Math.floor(sRng.next() * 3)) % offsets.length];
            const pitch = fit(scaleNote(session.root + 12, activeScale, deg));
            const accent = pos === 0 || pos === 8 ? 0.72 : 0.48 + 0.14 * Math.sin(idx);
            add(bar * 16 + pos, pitch, dur, accent, true);
          });
        }
        return notes;
      }

      if (!hasCustomMotif && mStyle === 'ostinato') {
        const cycle16 = Math.floor(phraseIndex / 4);
        const ostRng = new PRNG(streamSeed(session.seed, `ost-${session.sceneId}`, epoch + (epoch === 0 ? 0 : cycle16)));
        const use16 = session.sceneId === 'solar-fields-orbit' || (density > 0.62 && movement > 0.48);
        const positions = use16 ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] : [0, 2, 4, 6, 8, 10, 12, 14];
        const presets8 = [[0, 2, 1, 3, 0, 2, 1, 4], [0, 1, 2, 0, 3, 2, 1, 2], [0, 2, 4, 2, 1, 3, 2, 0]];
        const presets16 = [[0, 2, 1, 3, 0, 2, 4, 2, 0, 1, 2, 3, 4, 2, 1, 0], [0, 1, 2, 4, 2, 1, 0, 2, 3, 2, 1, 0, 2, 4, 2, 1]];
        const pool = use16 ? presets16 : presets8;
        const pattern = pool[Math.floor(ostRng.next() * pool.length) % pool.length];
        const chordDegreeOffsets = [0, 2, 4, 6, 7];
        const stepBeats = use16 ? 0.25 : 0.5;
        const gate = 0.35 + (movement * 0.25);
        for (let bar = 0; bar < s.phraseBars; bar++) {
          positions.forEach((pos, idx) => {
            const toneIdx = pattern[idx % pattern.length];
            const deg = harmony.degree + chordDegreeOffsets[toneIdx % chordDegreeOffsets.length];
            const accent = idx % 3 === 0 ? 0.82 : 0.46; // polymetric 3-against-4 feel
            add(bar * 16 + pos, fit(scaleNote(session.root + 12, session.scale, deg)), stepBeats * gate, accent, false);
          });
        }
        return notes;
      }

      // Motif Engine ('motif' | 'bellDrops' | 'neoclassical' | 'lofiHook') - continuous singing stream
      const mRng = new PRNG(streamSeed(session.seed, `motif-${session.sceneId}`, epoch));
      const cellPool = mStyle === 'bellDrops'
        ? [[0, 4, 8, 12], [0, 6, 10, 14], [2, 6, 10, 14], [0, 3, 8, 12], [0, 4, 10, 12], [1, 6, 9, 14], [0, 5, 9, 13], [0, 4, 7, 11, 14]]
        : mStyle === 'lofiHook'
          ? [[0, 4, 6, 10, 14], [0, 3, 6, 8, 12], [0, 3, 8, 10, 14], [0, 6, 9, 10, 14], [0, 4, 8, 9, 12], [2, 6, 8, 11, 14], [0, 4, 7, 10, 14], [0, 5, 8, 11, 14]]
          : mStyle === 'neoclassical'
            ? [[0, 2, 4, 8, 10, 12], [0, 4, 6, 8, 12, 14], [0, 2, 4, 6, 8, 12], [0, 3, 6, 8, 10, 12, 14]]
            : techno
              ? [[0, 3, 6, 10, 12, 14], [0, 3, 7, 10, 12, 15], [0, 4, 6, 10, 12, 14]]
              : [[0, 4, 8, 12], [0, 4, 10, 14], [0, 6, 10, 14], [0, 3, 6, 10, 12], [0, 4, 8, 10, 14], [0, 6, 8, 12, 14], [0, 2, 6, 10, 14]];
      const cell = cellPool[Math.floor(mRng.next() * cellPool.length) % cellPool.length];
      let jumped = false;
      let prevOff = mRng.pick([0, 2, 4]);
      const baseMotif: Array<{ pos: number; degreeOffset: number }> = (session.customMotifNotes && session.customMotifNotes.length > 0)
        ? [...session.customMotifNotes]
            .slice(-8)
            .sort((a, b) => a.pos - b.pos)
            .filter((ev, idx, arr) => idx === 0 || ev.pos !== arr[idx - 1].pos)
            .map(ev => ({ pos: Math.max(0, Math.min(15, Math.round(ev.pos))), degreeOffset: Math.round(clamp(ev.degreeOffset, -7, 14)) }))
        : cell.map((pos, idx) => {
            if (idx === 0) return { pos, degreeOffset: prevOff };
            let stepMove = mRng.pick([-2, -1, 1, 2, -1, 1]);
            if (!jumped && mRng.chance(0.35)) {
              stepMove = mRng.pick([-4, -3, 3, 4]);
              jumped = true;
            } else if (jumped && Math.abs(prevOff) > 4) {
              stepMove = -Math.sign(prevOff);
            }
            const nextOff = Math.round(clamp(prevOff + stepMove, -2, 8));
            prevOff = nextOff;
            return { pos, degreeOffset: nextOff };
          });

      const chordPcs = new Set(harmony.notes.map(n => ((n % 12) + 12) % 12));
      const snapToChord = (targetMidi: number): number => {
        const scale = SCALE_INTERVALS[session.scale] || SCALE_INTERVALS.dorian;
        const candidates: number[] = [];
        for (let n = s.minNote; n <= s.maxNote; n++) {
          const pc = ((n % 12) + 12) % 12;
          if (chordPcs.has(pc) && scale.includes(((n - session.root) % 12 + 12) % 12)) candidates.push(n);
        }
        if (!candidates.length) return fit(targetMidi);
        return candidates.sort((a, b) => Math.abs(a - targetMidi) - Math.abs(b - targetMidi))[0];
      };

      const cycle16 = Math.floor(phraseIndex / 4);
      const octaveLift = epoch === 0 && cycle16 % 2 === 1 ? 7 : 0;
      const phraseForm: Array<'A' | 'Ap' | 'B' | 'App'> = ['A', 'Ap', 'B', 'App'];

      const maxBaseOff = Math.max(...baseMotif.map(e => e.degreeOffset));

      for (let bar = 0; bar < s.phraseBars; bar++) {
        const section = phraseForm[bar % phraseForm.length];

        let barEvents = baseMotif.map((ev, i) => {
          let off = ev.degreeOffset + octaveLift;
          if (section === 'Ap' && i === baseMotif.length - 1) off += (ev.degreeOffset >= 2 ? -1 : 2);
          else if (section === 'B') off = 2 * baseMotif[0].degreeOffset - ev.degreeOffset + 1 + octaveLift;
          else if (section === 'App' && i === baseMotif.length - 1) off = (i % 2 === 0 ? 0 : 2) + octaveLift;
          return { pos: ev.pos, degreeOffset: off };
        });

        // Climax: once per 8 bars allow highest note +2 degrees
        const isClimaxBar = phraseIndex % 2 === 1 && bar === Math.min(2, s.phraseBars - 1);
        let climaxApplied = false;

        barEvents.forEach((ev, i) => {
          let deg = harmony.degree + ev.degreeOffset;
          if (isClimaxBar && !climaxApplied && ev.degreeOffset === maxBaseOff + octaveLift) {
            deg += 2;
            climaxApplied = true;
          }
          const rawMidi = scaleNote(session.root + 12, session.scale, deg);
          const isStrongBeat = ev.pos === 0 || ev.pos === 8 || (mStyle === 'lofiHook' && (ev.pos === 4 || ev.pos === 12));
          const finalNote = isStrongBeat ? snapToChord(rawMidi) : fit(rawMidi);

          const nextPos = barEvents[i + 1]?.pos ?? 16;
          const gapBeats = Math.max(0.25, (nextPos - ev.pos) / 4);
          const isAmbientLegato = session.style === 'ambient' && mStyle !== 'bellDrops';
          const isPhraseEnd = bar === s.phraseBars - 1 && i === barEvents.length - 1;
          const dur = isAmbientLegato
            ? Math.min(6, gapBeats * 1.05)
            : mStyle === 'bellDrops'
              ? Math.min(6, gapBeats + 1.5)
              : isPhraseEnd
                ? Math.min(5, gapBeats * 1.15)
                : Math.min(4, gapBeats * 0.92);

          // Velocity contour: rises toward middle of phrase, falls toward end
          const phraseProgress = (bar * 16 + ev.pos) / Math.max(16, length);
          const contour = 0.46 + Math.sin(phraseProgress * Math.PI) * 0.34;
          const accent = isPhraseEnd ? contour * 0.92 : contour;
          add(bar * 16 + ev.pos, finalNote, dur, accent, true, lofi ? rng.range(8, 20) : undefined);
        });
      }
    } else {
      const drum = layer.drumVoice || 'perc'; const midi = s.drumPatch?.midiNote !== undefined ? Math.round(clamp(s.drumPatch.midiNote, 0, 127)) : Math.round(clamp({ kick: 36, snare: 38, hihat: 42, perc: 37 }[drum], s.minNote, s.maxNote));
      const drumAlgo: RhythmAlgorithm = s.rhythmAlgorithm || 'composed';
      if (['fourOnFloor', 'twoStep', 'halftime', 'tribalPoly', 'minimalClick', 'rolling16'].includes(drumAlgo)) {
        if (density <= 0) return notes;
        for (let bar = 0; bar < s.phraseBars; bar++) {
          for (let pos = 0; pos < 16; pos++) {
            let hit = false;
            let acc = 0.55;
            if (drumAlgo === 'fourOnFloor') {
              hit = (drum === 'kick' && pos % 4 === 0) || (drum === 'snare' && (pos === 4 || pos === 12)) || (drum === 'hihat' && pos % 2 === 0) || (drum === 'perc' && [3, 11, 14].includes(pos));
              acc = pos % 4 === 0 ? 0.85 : 0.52;
            } else if (drumAlgo === 'twoStep') {
              hit = (drum === 'kick' && [0, 10].includes(pos)) || (drum === 'snare' && [4, 12].includes(pos)) || (drum === 'hihat' && [2, 6, 8, 14].includes(pos)) || (drum === 'perc' && [3, 9, 15].includes(pos));
              acc = pos === 0 || pos === 4 || pos === 12 ? 0.82 : 0.48;
            } else if (drumAlgo === 'halftime') {
              hit = (drum === 'kick' && (pos === 0 || (pos === 10 && bar % 2 === 1))) || (drum === 'snare' && pos === 8) || (drum === 'hihat' && pos % 2 === 0) || (drum === 'perc' && [6, 14].includes(pos));
              acc = pos === 0 || pos === 8 ? 0.88 : 0.44;
            } else if (drumAlgo === 'tribalPoly') {
              hit = (drum === 'kick' && [0, 6, 12].includes(pos)) || (drum === 'snare' && [5, 11].includes(pos)) || (drum === 'hihat' && (bar * 16 + pos) % 3 === 0) || (drum === 'perc' && [2, 7, 10, 14].includes(pos));
              acc = pos === 0 ? 0.8 : 0.54;
            } else if (drumAlgo === 'minimalClick') {
              hit = (drum === 'kick' && pos === 0) || (drum === 'snare' && pos === 12) || (drum === 'hihat' && [2, 10].includes(pos)) || (drum === 'perc' && [6, 15].includes(pos));
              acc = 0.52;
            } else {
              hit = (drum === 'kick' && pos % 4 === 0) || (drum === 'snare' && [4, 12].includes(pos)) || drum === 'hihat' || (drum === 'perc' && pos % 2 === 1);
              acc = pos % 4 === 0 ? 0.82 : pos % 2 === 0 ? 0.48 : 0.30;
            }
            if (hit && (pos === 0 || rng.chance(Math.min(1, 0.45 + density * 0.65)))) {
              add(bar * 16 + pos, midi, drum === 'hihat' ? 0.12 : 0.22, acc);
            }
          }
        }
        return notes;
      }
      if (s.rhythmAlgorithm && s.rhythmAlgorithm !== 'composed') {
        const seed = streamSeed(session.seed, `${layer.id}-algorithm`, Math.floor(phraseIndex / 2) + epoch * 31) || 1;
        const velocity = Math.round((s.velocityMin + s.velocityMax) / 2); const common = { velocity, accentVelocity: s.velocityMax, density }; let generator: IGenerator;
        if (s.rhythmAlgorithm === 'euclidean') generator = new EuclideanGenerator(layer.id, { ...common, steps: 16, pulses: Math.max(1, Math.round(({ kick: 4, snare: 2, hihat: 8, perc: 5 }[drum]) * (0.5 + density))), probability: 1 }, seed);
        else if (s.rhythmAlgorithm === 'polymetric') generator = new PolymetricGenerator(layer.id, { ...common, loopLength: drum === 'hihat' ? 7 : 5, activeHits: drum === 'kick' ? [0, 3] : [0, 2, 4] }, seed);
        else if (s.rhythmAlgorithm === 'markov') generator = new MarkovGenerator(layer.id, { velocity, downbeatBias: 0.55, matrix: { rest: [1 - density * 0.7, density * 0.5, density * 0.1, density * 0.1], hit: [0.55, 0.3, 0.08, 0.07], accent: [0.7, 0.15, 0.05, 0.1], ghost: [0.5, 0.32, 0.08, 0.1] } }, seed);
        else if (s.rhythmAlgorithm === 'densityBurst') generator = new DensityBurstGenerator(layer.id, { baseDensity: density * 0.65, burstChance: movement * 0.5, burstDecay: 0.72, restLikelihood: 0.25, velocity }, seed);
        else generator = new ProbabilisticGenerator(layer.id, { ...common, stepProbabilities: Array.from({ length: 16 }, (_, i) => drum === 'snare' ? [4, 12].includes(i) ? 1 : i % 2 ? 0.12 : 0.04 : drum === 'kick' ? i % 8 === 0 ? 1 : i % 4 === 2 ? 0.3 : 0.04 : i % 2 === 0 ? 0.85 : 0.2, ), humanizeJitter: s.humanizeMs / 1000, accentProbability: 0.2, ghostProbability: 0.2 }, seed);
        if (density === 0) return notes;
        for (let step = 0; step < length; step++) {
          const context = { step, subStep: step % 16, beat: Math.floor((step % 16) / 4), bar: Math.floor(step / 16), time: step * 60 / session.bpm / 4, perfTime: 0, bpm: session.bpm, swing: session.swing, swingOffset: 0 };
          for (const event of generator.generateStep(context)) notes.push({ step, layerId: layer.id, note: midi, velocity: Math.round(clamp(event.velocity, s.velocityMin, s.velocityMax)), durationBeats: Math.max(0.04, event.duration * session.bpm / 60), microMs: clamp(event.microOffset * 1000, -s.humanizeMs, s.humanizeMs) });
        }
        return notes;
      }
      for (let bar = 0; bar < s.phraseBars; bar++) for (let pos = 0; pos < 16; pos++) {
        let probability = 0; let accent = 0.45;
        if (techno) {
          const bassBar = bar % 2 === 1;
          const isFillBar = bar === s.phraseBars - 1;
          if (drum === 'kick') {
            probability = pos % 4 === 0 ? (pos === 0 ? 1 : 0.65 + density * 0.35) : (pos === 14 && bassBar ? density * movement * 0.35 : (isFillBar && pos === 15 && density > 0.6 ? 0.45 : 0));
            accent = pos === 0 ? 0.95 : pos === 14 ? 0.45 : 0.78;
          }
          if (drum === 'snare') {
            probability = pos === 12 ? density * 0.75 : pos === 4 ? density * 0.35 : (isFillBar && [14, 15].includes(pos) ? density * movement * 0.4 : 0);
            accent = pos === 12 ? 0.45 : 0.25;
          }
          if (drum === 'hihat') {
            probability = [2, 6, 10, 14].includes(pos) ? 0.95 : density * (0.35 + movement * 0.45);
            accent = [6, 14].includes(pos) ? 0.58 : pos % 2 === 0 ? 0.35 : 0.18;
          }
          if (drum === 'perc') {
            probability = [3, 7, 11, 14].includes(pos) ? density * 0.68 : (isFillBar && [13, 15].includes(pos) ? density * 0.4 : 0);
            accent = pos === 11 ? 0.55 : 0.3;
          }
        } else if (lofi) {
          const isFillBar = bar === s.phraseBars - 1;
          if (drum === 'kick') {
            probability = pos === 0 ? 1 : pos === 8 ? 0.88 : [6, 10, 14].includes(pos) ? density * (0.35 + movement * 0.3) : 0;
            accent = pos === 0 ? 0.92 : pos === 8 ? 0.75 : 0.48;
          }
          if (drum === 'snare') {
            // Structural anchor on 4 and 12, plus organic ghost notes on off-beats
            probability = [4, 12].includes(pos) ? 1 : [3, 7, 10, 15].includes(pos) ? density * (0.2 + movement * 0.35) : (isFillBar && pos === 14 ? 0.45 : 0);
            accent = [4, 12].includes(pos) ? 0.85 : 0.24; // Subtle ghost hit velocity
          }
          if (drum === 'hihat') {
            probability = pos % 2 === 0 ? 0.92 : density * (0.14 + movement * 0.28);
            accent = pos === 2 || pos === 10 ? 0.72 : pos % 4 === 2 ? 0.65 : 0.28;
          }
          if (drum === 'perc') {
            // Tasteful syncopated micro-percussion pocket without clutter
            probability = [2, 7, 11, 15].includes(pos) ? density * 0.52 : 0;
            accent = pos === 7 || pos === 15 ? 0.45 : 0.32;
          }
        } else {
          const isFillBar = bar === s.phraseBars - 1;
          if (drum === 'kick') {
            probability = pos === 0 ? 1 : pos === 8 ? density * 0.75 : [6, 10, 14].includes(pos) ? density * movement * 0.45 : 0;
            accent = pos === 0 ? 0.7 : 0.42;
          }
          if (drum === 'snare') {
            probability = pos === 12 ? density * 0.82 : pos === 4 ? density * 0.58 : (isFillBar && pos >= 14 ? density * 0.3 : 0);
            accent = pos === 12 ? 0.38 : 0.26;
          }
          if (drum === 'hihat') {
            probability = [2, 6, 10, 14].includes(pos) ? density * 0.92 : density * movement * 0.35;
            accent = pos === 6 ? 0.42 : 0.22;
          }
          if (drum === 'perc') {
            probability = [0, 3, 6, 10, 13].includes(pos) ? density * 0.88 : (isFillBar && pos === 15 ? 0.4 : 0);
            accent = pos === 0 ? 0.65 : 0.28;
          }
        }
        if (bar === s.phraseBars - 1 && pos >= 14 && drum !== 'kick') probability += density * movement * 0.2;
        if (density > 0 && rng.chance(probability)) {
          // Tasteful pitch accent variation on percussion
          let notePitch = midi;
          if (drum === 'perc' && rng.chance(0.28)) {
            notePitch = clamp(midi + (rng.chance(0.5) ? 2 : -2), s.minNote, s.maxNote);
          }
          add(bar * 16 + pos, notePitch, drum === 'hihat' ? 0.12 : 0.22, accent);
        }
      }
    }
    const unique = new Map<string, PlannedNote & { step: number }>();
    for (const n of notes) { const key = `${n.step}:${n.note}:${n.subLayer || 'a'}`; const old = unique.get(key); if (!old || n.durationBeats > old.durationBeats) unique.set(key, n); }
    return [...unique.values()];
  }
}
/** Clip the already performed timeline; never run a generator during capture. */
export function captureNotes(events: ClipNote[], startBeat: number, endBeat: number): ClipNote[] {
  return events.filter(n => n.startBeat < endBeat && n.startBeat + n.durationBeats > startBeat)
    .map(n => ({ ...n, startBeat: Math.max(0, n.startBeat - startBeat), durationBeats: Math.max(0, Math.min(endBeat, n.startBeat + n.durationBeats) - Math.max(startBeat, n.startBeat)) }))
    .filter(n => n.durationBeats > 0).sort((a, b) => a.startBeat - b.startBeat || a.note - b.note);
}
export function clipEventsAtStep(clip: MidiClip, originBeat: number, stepBeat: number): Array<PlannedNote & { offsetBeats: number }> {
  const length = Math.max(0.25, clip.lengthBeats); const relative = Math.max(0, stepBeat - originBeat); const cycle = Math.floor(relative / length);
  const result: Array<PlannedNote & { offsetBeats: number }> = [];
  for (const index of [cycle, cycle + 1]) for (const n of clip.notes) {
    const onset = index * length + n.startBeat;
    if (onset < relative - 0.00001 || onset >= relative + 0.25 - 0.00001) continue;
    result.push({ layerId: n.layerId, note: n.note, velocity: n.velocity, durationBeats: Math.min(n.durationBeats, length - n.startBeat), microMs: 0, offsetBeats: onset - relative, channel: n.channel });
  }
  return result;
}
