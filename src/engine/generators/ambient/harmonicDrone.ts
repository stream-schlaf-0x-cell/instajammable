// Generative Harmonic Drone with Voice-Leading Smooth Transitions & Multi-Bar Sustains

import { StepContext, MusicalScale, ParameterBoundary } from '../../../types';
import { IGenerator, GeneratedEvent } from '../types';
import { PRNG } from '../../prng';

export const SCALE_INTERVALS: Record<MusicalScale, number[]> = {
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  hirajoshi: [0, 2, 3, 7, 8],
  microtonal: [0, 2, 3.5, 5, 7, 8.5, 10],
};

export interface HarmonicDroneSettings {
  rootNote: number;            // MIDI note (e.g. 36 = C2, 48 = C3)
  scale: MusicalScale;
  chordDegree: number;         // 0 to scale length - 1
  voiceSpread: number;         // 1 to 3 octaves
  density: number;             // note trigger likelihood
  holdBars: number;            // bars before shifting chord degree
  inversion: number;           // 0, 1, 2
  velocity: number;
}

export class HarmonicDroneGenerator implements IGenerator {
  public id: string;
  public name: string = 'Harmonic Drone & Voice Leading';
  public description: string =
    'Generates sustained modal chord soundscapes with smooth voice leading (minimizing pitch jumps between chord changes) and hold durations spanning multiple bars.';
  private prng: PRNG;
  private settings: HarmonicDroneSettings;
  private lastTriggeredBarIndex: number = -1;
  private activeVoicing: number[] = [];

  constructor(id: string, initialSettings?: Partial<HarmonicDroneSettings>, seed?: number) {
    this.id = id;
    this.prng = new PRNG(seed !== undefined ? seed : 42);
    this.settings = {
      rootNote: 36, // C2 deep analog bass
      scale: 'dorian',
      chordDegree: 0,
      voiceSpread: 2,
      density: 0.85,
      holdBars: 4, // holds chord for 4 full bars before voice-led shift
      inversion: 0,
      velocity: 86,
      ...initialSettings,
    };
    this.rebuildVoicing();
  }

  // Quantizes scale degree to MIDI note
  public quantizeDegreeToMidi(degreeIndex: number, octaveOffset: number = 0): number {
    const scale = SCALE_INTERVALS[this.settings.scale] || SCALE_INTERVALS.dorian;
    const len = scale.length;
    const normDegree = ((degreeIndex % len) + len) % len;
    const octaves = Math.floor(degreeIndex / len) + octaveOffset;
    return this.settings.rootNote + octaves * 12 + scale[normDegree];
  }

  // Build chord voicing using voice-leading principles (minimize jump distances from previous chord)
  public rebuildVoicing(): void {
    const rootDeg = this.settings.chordDegree;
    const rawTargetNotes = [
      this.quantizeDegreeToMidi(rootDeg, 0),         // Bass root
      this.quantizeDegreeToMidi(rootDeg + 2, 1),     // 3rd
      this.quantizeDegreeToMidi(rootDeg + 4, 1),     // 5th
      this.quantizeDegreeToMidi(rootDeg + 6, 2),     // 7th or 9th extension
    ];

    if (this.activeVoicing.length === 0) {
      this.activeVoicing = rawTargetNotes;
      return;
    }

    // Voice leading: for upper voices (index 1, 2, 3), find the octave that minimizes distance to the previous voice
    const voiceLed = [rawTargetNotes[0]]; // keep bass in root register
    for (let i = 1; i < rawTargetNotes.length; i++) {
      const prevNote = this.activeVoicing[i] || rawTargetNotes[i];
      let candidate = rawTargetNotes[i];
      let bestNote = candidate;
      let minDistance = Math.abs(candidate - prevNote);

      // Check octave above and below
      for (const octShift of [-12, 12]) {
        const shifted = candidate + octShift;
        if (shifted >= 36 && shifted <= 84) {
          const dist = Math.abs(shifted - prevNote);
          if (dist < minDistance) {
            minDistance = dist;
            bestNote = shifted;
          }
        }
      }
      voiceLed.push(bestNote);
    }

    this.activeVoicing = voiceLed;
  }

  public generateStep(context: StepContext): GeneratedEvent[] {
    const currentBar = context.bar;
    const hold = Math.max(1, Math.round(this.settings.holdBars));

    // A new chord is only triggered on step 0 of the hold boundary bar!
    const isHoldStartBar = (currentBar % hold === 0);
    const isStep0 = (context.subStep === 0);

    if (!isHoldStartBar || !isStep0) {
      // During held bars, sustain existing chord: do not retrigger new notes
      return [];
    }

    // Prevent re-triggering if already triggered for this hold block
    const holdBlockIndex = Math.floor(currentBar / hold);
    if (holdBlockIndex === this.lastTriggeredBarIndex) {
      return [];
    }
    this.lastTriggeredBarIndex = holdBlockIndex;

    // Density check: if chord is skipped, let ambient space breathe
    if (!this.prng.chance(this.settings.density)) {
      return [];
    }

    // Advance harmonic degree smoothly by stepwise motion (voice leading)
    const scaleLen = (SCALE_INTERVALS[this.settings.scale] || SCALE_INTERVALS.dorian).length;
    const stepDelta = this.prng.pick([-1, 1, 2, -2]);
    this.settings.chordDegree = ((this.settings.chordDegree + stepDelta) % scaleLen + scaleLen) % scaleLen;
    this.rebuildVoicing();

    // Duration covers the full hold period (seconds) with generous release overlap
    const secondsPerBeat = 60.0 / context.bpm;
    const holdDurationSec = secondsPerBeat * 4.0 * hold;

    return this.activeVoicing.map((midiNote) => ({
      type: 'note',
      midiNote,
      velocity: Math.max(1, Math.min(127, Math.round(this.settings.velocity + this.prng.gaussian(0, 3)))),
      duration: holdDurationSec,
      probability: 1.0,
      microOffset: 0,
    }));
  }

  public mutate(boundaries: Record<string, ParameterBoundary>, intensity: number): void {
    if (boundaries.rootNote && boundaries.rootNote.allowMutation && !boundaries.rootNote.locked) {
      if (this.prng.chance(boundaries.rootNote.mutationProbability)) {
        const rootDelta = this.prng.pick([-2, 2, 5, -5, 7]);
        this.settings.rootNote = Math.max(
          boundaries.rootNote.min,
          Math.min(boundaries.rootNote.max, Math.round(this.settings.rootNote + rootDelta * intensity))
        );
      }
    }

    if (boundaries.scale && boundaries.scale.allowMutation && !boundaries.scale.locked) {
      if (this.prng.chance(boundaries.scale.mutationProbability * 0.4)) {
        const scales: MusicalScale[] = ['dorian', 'phrygian', 'lydian', 'aeolian', 'minorPentatonic', 'hirajoshi'];
        this.settings.scale = this.prng.pick(scales);
      }
    }

    if (boundaries.holdBars && boundaries.holdBars.allowMutation && !boundaries.holdBars.locked) {
      if (this.prng.chance(boundaries.holdBars.mutationProbability)) {
        const delta = this.prng.pick([-1, 1]);
        this.settings.holdBars = Math.max(1, Math.min(16, Math.round(this.settings.holdBars + delta)));
      }
    }

    this.rebuildVoicing();
  }

  public regenerate(): void {
    const scales: MusicalScale[] = ['dorian', 'phrygian', 'lydian', 'aeolian', 'minorPentatonic', 'hirajoshi'];
    this.settings.scale = this.prng.pick(scales);
    this.settings.chordDegree = this.prng.rangeInt(0, 6);
    this.lastTriggeredBarIndex = -1;
    this.rebuildVoicing();
  }

  public getSettings(): HarmonicDroneSettings {
    return { ...this.settings };
  }

  public setSettings(settings: Partial<HarmonicDroneSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.rebuildVoicing();
  }
}
