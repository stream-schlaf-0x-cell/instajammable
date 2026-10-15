import type { MusicalScale } from '../../types';
import type { ClipNote, JamLayer, JamSession, MidiClip, ChordPattern, ChordPace } from '../../types/jam';
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
  if (pace === 'dynamic') return 2;
  return style === 'lofi' ? 2 : 4;
};
/** Scale-degree offsets above the chord root. Add a row to introduce a new voicing; weights favour the lush ones. */
export const VOICINGS: ReadonlyArray<{ offsets: number[]; weight: number; minMovement: number }> = [
  { offsets: [0, 2, 4, 6], weight: 3, minMovement: 0 },       // seventh chord
  { offsets: [0, 2, 6, 8], weight: 3, minMovement: 0 },       // root, third, seventh, ninth: the classic min9 shell
  { offsets: [0, 4, 6, 8], weight: 2, minMovement: 0.15 },    // open ninth without the third
  { offsets: [0, 2, 4, 6, 8], weight: 2, minMovement: 0.3 },  // full ninth chord
  { offsets: [0, 1, 4, 6], weight: 1.5, minMovement: 0.25 },  // suspended second with a seventh
  { offsets: [0, 3, 4, 6], weight: 1.2, minMovement: 0.35 },  // suspended fourth
];
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
export interface PlannedNote { layerId: string; note: number; velocity: number; durationBeats: number; microMs: number; offsetBeats?: number; channel?: number; /** Entered mid-phrase by an Evolve transition: use a short attack so it crossfades in. */ soft?: boolean }
interface ComposerRuntime { epoch: number; harmonyIndex: number; harmony: Harmony; previousVoicing: number[]; frozen: Record<string, ClipNote[]>; frozenStarts: Record<string, number>; }
/** Deterministic musical decisions; audio and MIDI both consume the returned notes. */
export class JamComposer {
  private epoch = 0; private harmonyIndex = -1;
  private harmony: Harmony = { degree: 0, name: 'Dm', notes: [50, 57, 65], root: 50, index: 0 };
  private previousVoicing: number[] = []; private lastHarmonyKey = '';
  private plans = new Map<string, { key: string; notes: Array<PlannedNote & { step: number }> }>();
  private frozen: Record<string, ClipNote[]> = {}; private frozenStarts: Record<string, number> = {};
  getHarmony(): Harmony { return { ...this.harmony, notes: [...this.harmony.notes] }; }
  vary(): void { this.epoch++; this.plans.clear(); }
  reset(): void { this.epoch = 0; this.harmonyIndex = -1; this.previousVoicing = []; this.plans.clear(); this.lastHarmonyKey = ''; this.frozen = {}; this.frozenStarts = {}; }
  getRuntime(): ComposerRuntime { return { epoch: this.epoch, harmonyIndex: this.harmonyIndex, harmony: this.getHarmony(), previousVoicing: [...this.previousVoicing], frozen: structuredClone(this.frozen), frozenStarts: { ...this.frozenStarts } }; }
  restore(raw: unknown): void {
    if (raw === undefined || raw === null) return;
    if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Ungültiger Generatorzustand.');
    const s = raw as Partial<ComposerRuntime>;
    const finite = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
    if (s.epoch !== undefined && !finite(s.epoch, 0, 1e9)) throw new Error('Ungültiger Variationszustand.');
    if (s.harmonyIndex !== undefined && !finite(s.harmonyIndex, -1, 1e9)) throw new Error('Ungültige Harmonieposition.');
    this.epoch = Math.floor(s.epoch || 0); this.harmonyIndex = Math.floor(s.harmonyIndex ?? -1);
    if (s.harmony !== undefined) {
      const h = s.harmony;
      if (!h || typeof h !== 'object' || !Array.isArray(h.notes) || h.notes.length > 8 || !h.notes.every(n => finite(n, 0, 127)) || !finite(h.root, 0, 127) || !finite(h.degree, 0, 12) || !finite(h.index, 0, 1e9) || typeof h.name !== 'string') throw new Error('Ungültiger Harmoniezustand.');
      this.harmony = { ...h, name: h.name.slice(0, 30), notes: h.notes.map(Math.round) };
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
    const holdBars = holdBarsFor(session.style, chordLayer?.settings?.chordPace);
    const index = Math.floor(step / (holdBars * 16));
    // Evolve changes the progression, but a locked or frozen chord layer keeps the original one.
    const epoch = chordLayer?.locked || chordLayer?.frozen ? 0 : this.epoch;
    const paceKey = chordLayer?.settings?.chordPace || 'def';
    const key = `${session.root}:${session.scale}:${session.style}:${session.seed}:${index}:${epoch}:${paceKey}`;
    if (key === this.lastHarmonyKey) return this.getHarmony();
    const scale = SCALE_INTERVALS[session.scale] || SCALE_INTERVALS.dorian;
    const templates = session.style === 'lofi' ? [
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
        [0, 1, 4, 5], // i - II - v - VI (Phrygian / exotic)
        [0, 3, 2, 4], // i - iv - III - v
      ];
    const rng = new PRNG(streamSeed(session.seed, 'harmony', Math.floor(index / 4) + epoch * 131));
    // Diverse harmonic movement: epoch 0 deterministically maps seed to a moving progression; Evolve explores freely.
    const templateIndex = epoch === 0
      ? (Math.abs(session.seed) % templates.length)
      : rng.rangeInt(0, templates.length - 1);
    const template = templates[templateIndex];
    const degree = template[index % 4] % scale.length;
    const root = scaleNote(session.root, session.scale, degree);
    let offsets = session.style === 'lofi' && scale.length >= 7 ? [0, 2, 4, 6] : [0, 4, 2];
    if (session.style !== 'lofi' && scale.length >= 7) {
      // Lush ninth / suspended voicings for ambient and techno; richer ones appear as Bewegung rises.
      const voice = new PRNG(streamSeed(session.seed, 'voicing', index + epoch * 977)); const movement = session.macros.movement;
      const pool = VOICINGS.filter(v => movement >= v.minMovement); const total = pool.reduce((sum, v) => sum + v.weight, 0); let pick = voice.next() * total;
      offsets = (pool.find(v => (pick -= v.weight) < 0) || pool[0]).offsets;
    }
    const layer = session.layers.find(l => l.role === 'chords');
    const notes = voiceLead(offsets.map(n => scaleNote(session.root, session.scale, degree + n)), this.previousVoicing, layer?.settings.minNote ?? session.root, layer?.settings.maxNote ?? session.root + 25);
    const intervals = offsets.map(n => scaleNote(session.root, session.scale, degree + n) - root);
    this.harmony = { degree, root, notes, index, name: `${PC_NAMES[((root % 12) + 12) % 12]}${chordSuffix(intervals)}` };
    this.previousVoicing = notes; this.harmonyIndex = index; this.lastHarmonyKey = key; return this.getHarmony();
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
    this.plans.clear();
    this.lastHarmonyKey = `manual-trans-${semitones}-${Date.now()}`;
    return this.getHarmony();
  }
  /** Name of the harmony after the current one, computed without disturbing voice-leading state. */
  peekNext(step: number, session: JamSession): Harmony {
    const chordLayer = session.layers.find(l => l.role === 'chords');
    const hold = holdBarsFor(session.style, chordLayer?.settings?.chordPace) * 16;
    const nextStep = (Math.floor(step / hold) + 1) * hold;
    const saved = { harmony: this.harmony, previous: [...this.previousVoicing], index: this.harmonyIndex, key: this.lastHarmonyKey };
    const next = this.harmonyAt(nextStep, session);
    this.harmony = saved.harmony; this.previousVoicing = saved.previous; this.harmonyIndex = saved.index; this.lastHarmonyKey = saved.key;
    return next;
  }
  planStep(step: number, session: JamSession): PlannedNote[] {
    const harmony = this.harmonyAt(step, session); const result: PlannedNote[] = []; const anySolo = session.layers.some(l => l.solo);
    for (const layer of session.layers) {
      if (layer.muted || (anySolo && !layer.solo) || layer.volume <= 0) continue;
      if (layer.frozen && this.frozen[layer.id]) {
        if (step / 4 < this.frozenStarts[layer.id]) continue;
        const phase = (((step / 4 - this.frozenStarts[layer.id]) % 16) + 16) % 16;
        for (const n of this.frozen[layer.id]) if (Math.abs(Math.floor(n.startBeat * 4) / 4 - phase) < 0.00001) result.push({ layerId: layer.id, note: n.note, velocity: n.velocity, durationBeats: n.durationBeats, microMs: 0, offsetBeats: n.startBeat - phase });
        continue;
      }
      const phraseSteps = layer.settings.phraseBars * 16; const phraseIndex = Math.floor(step / phraseSteps); const localStep = step % phraseSteps;
      const epoch = layer.locked ? 0 : this.epoch + (session.evolving ? Math.floor(step / 128) : 0);
      const signature = `${session.seed}:${session.root}:${session.scale}:${session.style}:${harmony.index}:${harmony.name}:${phraseIndex}:${epoch}:${JSON.stringify(layer.settings)}:${session.macros.density}:${session.macros.movement}`;
      let plan = this.plans.get(layer.id);
      if (!plan || plan.key !== signature) { plan = { key: signature, notes: this.makePlan(layer, session, harmony, layer.locked || !session.evolving ? 0 : phraseIndex, epoch) }; this.plans.set(layer.id, plan); }
      result.push(...plan.notes.filter(n => n.step === localStep));
    }
    return result;
  }
  heldNotesAtStep(step: number, session: JamSession): PlannedNote[] {
    const copy = new JamComposer(); copy.restore(this.getRuntime()); const active = new Map<string, PlannedNote>(); const beat = step / 4;
    const historySteps = Math.max(16, ...session.layers.map(l => l.settings.phraseBars * 16));
    for (let cursor = Math.max(0, step - historySteps); cursor < step; cursor++) for (const note of copy.planStep(cursor, session)) {
      const layer = session.layers.find(l => l.id === note.layerId)!; if (layer.role === 'drum') continue;
      const onset = cursor / 4 + (note.offsetBeats !== undefined ? note.offsetBeats : (cursor % 2 ? session.swing * 0.1 : 0) + note.microMs * session.bpm / 60000);
      const remaining = onset + note.durationBeats - beat;
      if (remaining > 0.02) active.set(`${layer.id}:${note.note}:${note.channel || layer.channel}`, { ...note, durationBeats: remaining, microMs: 0, offsetBeats: undefined });
    }
    return [...active.values()];
  }
  private makePlan(layer: JamLayer, session: JamSession, harmony: Harmony, phraseIndex: number, epoch: number): Array<PlannedNote & { step: number }> {
    const s = layer.settings; const lofi = session.style === 'lofi'; const techno = session.style === 'techno'; const length = s.phraseBars * 16;
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
        for (let step = 0; step < length; step++) if (rng.chance(density * 0.24)) { const degree = harmony.degree + rng.pick([0, 0, 2, 4, 6]); add(step, fit(scaleNote(session.root, session.scale, degree)), rng.pick([0.5, 0.75, 1.25, 2]), 0.2 + rng.next() * 0.2); }
      } else if (density > 0 && (phraseIndex === 0 || rng.chance(Math.max(0.5, density)))) { add(0, fit(session.root - 12), s.phraseBars * 4 - 0.15, 0.32, false); if (density > 0.65) add(0, fit(session.root - 5), s.phraseBars * 4 - 0.3, 0.18, false); }
    } else if (layer.role === 'chords') {
      const pattern: ChordPattern | undefined = s.chordPattern;
      const roll = lofi ? rng.range(6, 28) : rng.range(35, 95);
      const chordHoldBars = holdBarsFor(session.style, s.chordPace);
      const chordStride = Math.max(16, chordHoldBars * 16);

      if (pattern === 'pulse') {
        // CBL / Jon Hopkins syncopated 3/16 and dotted-8th rhythmic pulses with velocity breathing
        const pulseRhythms = [
          [0, 3, 6, 8, 11, 14],
          [0, 3, 6, 9, 12, 14],
          [0, 2, 6, 8, 10, 14],
          [0, 4, 6, 10, 12, 14],
        ];
        // Ensure step 0 has rolled chord foundation
        harmony.notes.forEach((pitch, i) => add(0, fit(pitch), 1.8, 0.54 - i * 0.03, false, i * roll));
        for (let bar = 0; bar < s.phraseBars; bar++) {
          if (density <= 0 || (phraseIndex !== 0 && !rng.chance(Math.max(0.45, density)))) continue;
          const positions = pulseRhythms[(bar + Math.floor(phraseIndex)) % pulseRhythms.length];
          for (let pi = 0; pi < positions.length; pi++) {
            const pos = positions[pi];
            if (bar === 0 && pos === 0) continue; // already added step 0
            if (!rng.chance(Math.min(1, 0.4 + density * 0.7))) continue;
            const isDownbeat = pos === 0;
            const breath = 0.38 + 0.22 * Math.sin((pos / 16) * Math.PI);
            const vel = (isDownbeat ? 0.56 : breath) * (0.85 + rng.range(0, 0.25));
            const duration = isDownbeat ? 1.8 : 0.85 + rng.range(0, 0.4);
            const voicing = isDownbeat || rng.chance(0.65) ? harmony.notes : harmony.notes.slice(-3);
            voicing.forEach((pitch, i) => {
              add(bar * 16 + pos, fit(pitch), duration, Math.max(0.15, vel - i * 0.03), false, i * (isDownbeat ? roll : Math.round(roll * 0.4)));
            });
          }
        }
      } else if (pattern === 'broken') {
        // Neo-Classical / Nils Frahm broken arpeggiated voicings: rolling bottom-up and top-down figures
        harmony.notes.forEach((pitch, i) => add(0, fit(pitch), 3.2, 0.48 - i * 0.03, false, i * roll));
        for (let bar = 0; bar < s.phraseBars; bar++) {
          if (density <= 0 || (phraseIndex !== 0 && !rng.chance(Math.max(0.45, density)))) continue;
          const stepSlots = [0, 2, 4, 6, 8, 10, 12, 14];
          const count = harmony.notes.length;
          const voiceSeq = bar % 2 === 0
            ? [0, 1, 2, Math.min(3, count - 1), Math.max(0, count - 2), 1, 0, 2]
            : [0, 2, 1, Math.min(3, count - 1), 0, 1, 2, Math.max(0, count - 1)];
          stepSlots.forEach((slot, si) => {
            if (bar === 0 && slot === 0) return;
            if (!rng.chance(Math.min(1, 0.4 + density * 0.7))) return;
            const voiceIdx = voiceSeq[si % voiceSeq.length] % count;
            const pitch = harmony.notes[voiceIdx];
            const octaveOffset = (si >= 4 && rng.chance(0.35)) ? 12 : 0;
            const vel = 0.36 + rng.range(0, 0.2) + (slot % 4 === 0 ? 0.08 : 0);
            add(bar * 16 + slot, fit(pitch + octaveOffset), 2.2 + rng.range(0, 0.8), vel, false, rng.range(5, 20));
          });
        }
      } else if (pattern === 'syncopated' || (techno && !pattern)) {
        // Dub-techno / funk off-beat stabs with ghost hits
        const compPatterns = [
          [2, 6, 10, 14],
          [3, 6, 11, 14],
          [4, 10],
          [2, 6, 11],
          [6, 9, 14],
          [6, 14],
          [3, 10],
        ];
        harmony.notes.forEach((pitch, i) => add(0, fit(pitch), 2.5, 0.5 - i * 0.04, false, i * roll));
        for (let bar = 0; bar < s.phraseBars; bar++) {
          if (density <= 0 || (phraseIndex !== 0 && !rng.chance(Math.max(0.5, density)))) continue;
          const positions = compPatterns[(bar + Math.floor(phraseIndex)) % compPatterns.length];
          const voicing = rng.chance(0.4) ? harmony.notes.slice(-3) : harmony.notes;
          for (const pos of positions) {
            if (bar === 0 && pos === 0) continue;
            if (!rng.chance(Math.min(1, 0.45 + density * 0.65))) continue;
            const duration = 0.5 + rng.range(0, 0.4);
            const vel = (pos === 6 || pos === 14 ? 0.54 : 0.4) + rng.range(0, 0.1);
            voicing.forEach((pitch, i) => add(bar * 16 + pos, fit(pitch), duration, Math.max(0.15, vel - i * 0.04), false, rng.chance(0.4) ? i * rng.range(4, 14) : 0));
          }
        }
      } else if (pattern === 'euclidean') {
        // Algorithmic Euclidean pulses
        const k = density > 0.7 ? 5 : density > 0.4 ? 4 : 3;
        const euclideanSteps: number[] = [];
        for (let i = 0; i < 16; i++) {
          if (Math.floor((i * k) / 16) !== Math.floor(((i - 1) * k) / 16)) {
            euclideanSteps.push(i);
          }
        }
        for (let bar = 0; bar < s.phraseBars; bar++) {
          if (density <= 0 || (phraseIndex !== 0 && !rng.chance(Math.max(0.45, density)))) continue;
          euclideanSteps.forEach((stepPos, si) => {
            if (bar === 0 && stepPos === 0) {
              harmony.notes.forEach((pitch, i) => add(0, fit(pitch), 2.2, 0.5 - i * 0.04, false, i * roll));
              return;
            }
            if (!rng.chance(Math.min(1, 0.5 + density * 0.6))) return;
            const isAccent = si === 0 || stepPos === 0;
            const vel = (isAccent ? 0.52 : 0.38) + rng.range(0, 0.14);
            const voicing = isAccent || rng.chance(0.5) ? harmony.notes : harmony.notes.slice(-3);
            voicing.forEach((pitch, i) => add(bar * 16 + stepPos, fit(pitch), 1.4 + rng.range(0, 0.6), Math.max(0.15, vel - i * 0.03), false, i * Math.round(roll * 0.5)));
          });
        }
      } else if (pattern === 'wave') {
        // Cascading oceanic swell: staggered voice entrances creating undulating harmonic waves
        for (let bar = 0; bar < s.phraseBars; bar += 2) {
          if (density <= 0 || (phraseIndex !== 0 && !rng.chance(Math.max(0.45, density)))) continue;
          if (bar === 0) {
            harmony.notes.forEach((pitch, i) => add(0, fit(pitch), 3.8, 0.48 - i * 0.03, false, i * roll));
          } else {
            harmony.notes.forEach((pitch, i) => {
              const voiceDelaySteps = (i * 3) % 16;
              add(bar * 16 + voiceDelaySteps, fit(pitch), 6.5, 0.44 - i * 0.03, false, rng.range(10, 40));
            });
          }
        }
      } else if (pattern === 'cluster') {
        // Shimmering polyrhythmic tapestry: individual chord tones pulse at independent prime rates
        harmony.notes.forEach((pitch, i) => {
          add(0, fit(pitch), 3.4, 0.46 - i * 0.03, false, i * roll);
          const intervalSteps = [6, 8, 10, 12][i % 4];
          for (let step = intervalSteps; step < length; step += intervalSteps) {
            if (!rng.chance(Math.min(1, 0.4 + density * 0.7))) continue;
            const vel = 0.32 + rng.range(0, 0.18);
            add(step, fit(pitch), 2.8 + rng.range(0, 0.8), vel, false, rng.range(10, 50));
          }
        });
      } else {
        // 'pad' (Living atmospheric pad) or default lo-fi / ambient
        const stride = lofi ? 16 : chordStride;
        for (let step = 0; step < length; step += stride) {
          if (density <= 0 || (phraseIndex !== 0 && !rng.chance(Math.max(0.5, density)))) continue;
          const restab = lofi && density > 0.75 && rng.chance(movement * 0.5);
          harmony.notes.forEach((pitch, i) => add(step, fit(pitch), lofi ? (restab ? 2.8 : 3.25 + rng.range(0, 0.45)) : Math.max(1, chordHoldBars * 4 - 0.3), 0.5 - i * 0.04, false, i * roll));
          if (restab) harmony.notes.forEach(p => add(step + 12, fit(p), 0.7, 0.25));
          if (!lofi) {
            // Mid-phrase response: upper notes or complementary harmonic tones answer
            if (s.phraseBars >= 2 && rng.chance(0.35 + movement * 0.45)) {
              const upper = rng.chance(0.5) ? harmony.notes.slice(-3) : harmony.notes.slice(1, 4);
              const at = step + Math.min(16, stride / 2);
              if (at < length) {
                upper.forEach((pitch, i) => add(at, fit(pitch + (rng.chance(0.35) ? 12 : 0)), Math.max(1, (stride - (at - step)) / 4 - 0.3), 0.32 - i * 0.03, false, i * rng.range(30, 90)));
              }
            }
          }
        }
      }

      if (s.chordTexture && s.chordTexture !== 'off') {
        const baseChordNotes = notes.filter(n => n.layerId === layer.id);
        for (const cn of baseChordNotes) {
          let interval = 12;
          let velMult = 0.50;
          let durMult = 1.3;
          let microOffset = 18;
          if (s.chordTexture === 'shimmer') {
            interval = 12;
            velMult = 0.48;
            durMult = 1.4;
            microOffset = 22;
          } else if (s.chordTexture === 'octave') {
            interval = 12;
            velMult = 0.62;
            durMult = 1.0;
            microOffset = 10;
          } else if (s.chordTexture === 'sub5th') {
            interval = 7;
            velMult = 0.52;
            durMult = 1.15;
            microOffset = 14;
          }
          const texturePitch = fit(cn.note + interval);
          if (Number.isFinite(texturePitch) && texturePitch <= 127) {
            notes.push({
              step: cn.step,
              layerId: layer.id,
              note: texturePitch,
              durationBeats: Math.max(0.06, cn.durationBeats * durMult),
              velocity: Math.max(1, Math.round(cn.velocity * velMult)),
              microMs: cn.microMs + microOffset,
            });
          }
        }
      }
    } else if (layer.role === 'bass' && techno) {
      // Rolling off-beat sub between the kicks, the way a slow deep-techno bassline sits.
      for (let step = 0; step < length; step++) {
        const pos = step % 16; if (![2, 6, 10, 14].includes(pos) || density <= 0 || !rng.chance(Math.min(1, 0.35 + density * 0.65))) continue;
        const pitch = rng.chance(0.78) ? harmony.root : rng.chance(0.5) ? scaleNote(session.root, session.scale, harmony.degree + 4) : harmony.root + 12;
        add(step, fit(pitch), 0.42 + rng.range(0, 0.18), pos === 2 ? 0.7 : 0.5, false);
      }
    } else if (layer.role === 'bass' && lofi) {
      // Real jazz bass / neo-soul / lo-fi hip hop bassline:
      // - Grounded root on beat 1 locking with kick
      // - Syncopated pushes on beat 2-and (step 6) or beat 3-and (step 10)
      // - Leaves space on beat 2 (step 4) and beat 4 (step 12) so snare / rim lowkey slaps
      // - Soulful chromatic approach tone on step 14 or 15 leading into the next chord
      // - Laid-back pocket timing (+8..+20 ms micro-delay)
      // - Occasional dead-string ghost notes
      for (let bar = 0; bar < s.phraseBars; bar++) {
        if (density <= 0 || (phraseIndex !== 0 && !rng.chance(Math.max(0.45, density)))) continue;
        const barStep = bar * 16;
        const rootPitch = fit(harmony.root);

        // 1. Beat 1 (Step 0): Strong downbeat anchor
        add(barStep, rootPitch, 1.8, 0.78, false, rng.range(6, 16));

        // 2. Syncopated groove choices:
        const barChoice = (bar + Math.floor(phraseIndex)) % 3;

        if (barChoice === 0 && density > 0.35) {
          // Syncopated push on step 6 (Beat 2-and)
          const pushPitch = rng.chance(0.6) ? fit(harmony.root - 12) : fit(scaleNote(session.root, session.scale, harmony.degree + 4));
          add(barStep + 6, pushPitch, 1.2, 0.58, false, rng.range(10, 22));
          // Ghost note on step 10 or 11
          if (rng.chance(0.45)) {
            add(barStep + 10, rootPitch, 0.25, 0.22, false, rng.range(8, 18));
          }
        } else if (barChoice === 1 && density > 0.4) {
          // Mid-bar response on step 8 (Beat 3)
          const midPitch = rng.chance(0.55) ? fit(scaleNote(session.root, session.scale, harmony.degree + 4)) : fit(scaleNote(session.root, session.scale, harmony.degree + 2));
          add(barStep + 8, midPitch, 1.4, 0.62, false, rng.range(10, 22));
          // Soft ghost pickup on step 11
          if (rng.chance(0.5)) {
            add(barStep + 11, fit(harmony.root), 0.25, 0.24, false, rng.range(12, 24));
          }
        } else if (barChoice === 2 && density > 0.5) {
          // Walking step-wise response on step 6 and 8
          const stepNote = fit(scaleNote(session.root, session.scale, harmony.degree + 2));
          add(barStep + 6, stepNote, 0.9, 0.52, false, rng.range(10, 20));
          const fifthNote = fit(scaleNote(session.root, session.scale, harmony.degree + 4));
          add(barStep + 8, fifthNote, 1.1, 0.56, false, rng.range(10, 20));
        }

        // 3. Beat 4-and (Step 14 or 15): Diatonic/scale walking approach note into the next root!
        if (density > 0.38 && rng.chance(0.75 + movement * 0.2)) {
          const approachOffset = rng.chance(0.65) ? -1 : 1;
          const approachPitch = fit(scaleNote(session.root, session.scale, harmony.degree + approachOffset));
          const approachStep = rng.chance(0.7) ? 14 : 15;
          add(barStep + approachStep, approachPitch, 0.45, 0.48, false, rng.range(12, 24));
        }
      }
    } else if (layer.role === 'bass') {
      const stride = 32;
      for (let step = 0; step < length; step += stride) {
        if (density <= 0 || (step % 16 !== 0 && !rng.chance(density))) continue;
        const pitch = step % 16 === 0 ? harmony.root : rng.chance(0.68) ? harmony.root : scaleNote(session.root, session.scale, harmony.degree + 4);
        add(step, fit(pitch), Math.min(7.6, length / 4), step % 16 === 0 ? 0.72 : 0.45, false);
      }
    } else if (layer.role === 'melody') {
      // Each phrase picks one of several melodic characters. Evolve re-rolls the choice, so the same scene keeps finding new lines.
      const rhythms = techno ? [[0, 3, 6, 10, 12], [0, 3, 7, 10, 14], [2, 5, 8, 11, 14], [0, 4, 6, 10, 13], [3, 6, 11], [0, 6, 10, 15]]
        : lofi ? [[2, 6, 10, 14], [2, 5, 10, 13], [0, 3, 6, 10], [3, 7, 11, 14], [2, 10], [4, 6, 12, 14], [1, 6, 9, 14]]
        : [[0, 6, 12], [0, 10], [4, 12], [0, 3, 8, 14], [2, 9], [0, 7, 10, 14], [0], [0, 8], [3, 11], [0, 5, 8, 13]];
      const mode = rng.pick(techno ? ['arp', 'pedal', 'walk', 'arp'] : lofi ? ['walk', 'call', 'sparse', 'arp', 'call'] : ['walk', 'call', 'arp', 'pedal', 'sparse', 'run', 'call']);
      const tones = [0, 2, 4, 6]; const octave = rng.pick([0, 0, 0, 7]); const anchor = harmony.degree + octave; let cursor = anchor + rng.pick(tones); let previous: number[] = [];
      const arpOrder = rng.pick([[0, 1, 2, 3], [3, 2, 1, 0], [0, 2, 1, 3], [0, 1, 2, 1]]); const pedal = anchor + rng.pick([0, 0, 4]);
      for (let bar = 0; bar < s.phraseBars; bar++) {
        const last = bar === s.phraseBars - 1; const answer = bar % 2 === 1 && previous.length > 0;
        const positions = mode === 'sparse' ? rng.pick(rhythms.filter(r => r.length <= 2)) : answer && mode !== 'arp' ? rhythms[(Math.floor(phraseIndex / 2) + bar) % rhythms.length] : rng.pick(rhythms);
        const degrees: number[] = []; const chance = clamp(density * (techno ? 1.05 : lofi ? 1 : 1.2) * (bar % 2 ? 0.8 : 1), 0, 1);
        positions.forEach((pos, i) => {
          let degree: number;
          if (mode === 'arp') degree = anchor + tones[arpOrder[(i + bar) % arpOrder.length]] + (i + bar >= 4 ? 7 : 0);
          else if (mode === 'pedal') degree = i % 2 === 0 ? pedal : pedal + rng.pick([-1, 1, 2]);
          else if (mode === 'sparse') degree = anchor + rng.pick([0, 2, 4, 4, 7, 9]);
          else if (mode === 'call' && answer && previous[i] !== undefined) degree = 2 * anchor - previous[i] + rng.pick([0, 0, 1]); // the answer mirrors the call
          else if (i === 0) degree = anchor + rng.pick(tones);
          else { degree = cursor + rng.pick([-2, -1, -1, 1, 1, 2, 3, -3]); degree = Math.max(anchor - 3, Math.min(anchor + 9, degree)); }
          cursor = degree; degrees.push(degree);
          if (!rng.chance(chance)) return;
          const next = positions[i + 1] ?? 16; const gap = (next - pos) / 4;
          const duration = mode === 'sparse' ? Math.min(7, gap + rng.pick([1, 2, 3.5])) : techno ? rng.pick([0.2, 0.3, 0.45, 0.75, 1.1]) : lofi ? rng.pick([0.45, 0.8, 1.4]) : Math.min(5, gap * 0.92 + rng.pick([0.4, 0.8, 1.4]));
          add(bar * 16 + pos, fit(scaleNote(session.root + 12, session.scale, degree)), duration, (i === 0 ? 0.52 : 0.34) + rng.next() * 0.12);
        });
        if (mode === 'run' && last && rng.chance(Math.max(0.5, chance))) { // closing scale run into the next phrase
          const up = rng.chance(0.5); const count = rng.rangeInt(4, 6); const startPos = 16 - count;
          for (let k = 0; k < count; k++) add(bar * 16 + startPos + k, fit(scaleNote(session.root + 12, session.scale, cursor + (up ? k + 1 : -(k + 1)))), 0.3, 0.3 + k * 0.04);
        }
        previous = degrees;
      }
    } else {
      const drum = layer.drumVoice || 'perc'; const midi = s.drumPatch?.midiNote !== undefined ? Math.round(clamp(s.drumPatch.midiNote, 0, 127)) : Math.round(clamp({ kick: 36, snare: 38, hihat: 42, perc: 37 }[drum], s.minNote, s.maxNote));
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
            probability = pos % 2 === 0 ? 0.95 : density * (0.3 + movement * 0.45);
            accent = pos === 2 || pos === 10 ? 0.72 : pos % 4 === 2 ? 0.65 : 0.28;
          }
          if (drum === 'perc') {
            // Organic polyrhythmic micro-percussion
            probability = [2, 5, 7, 10, 13, 15].includes(pos) ? density * 0.75 : 0;
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
    for (const n of notes) { const key = `${n.step}:${n.note}`; const old = unique.get(key); if (!old || n.durationBeats > old.durationBeats) unique.set(key, n); }
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
