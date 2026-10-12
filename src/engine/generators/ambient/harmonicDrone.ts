// Generative Harmonic Drone & Chord Voicing Generator

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
    'Generates slowly evolving modal chord voicings with voice-leading constraints, long sustained textures, and harmonic tension shifts.';
  private prng: PRNG;
  private settings: HarmonicDroneSettings;
  private lastBarTriggered: number = -1;
  private activeVoicing: number[] = [];

  constructor(id: string, initialSettings?: Partial<HarmonicDroneSettings>, seed?: number) {
    this.id = id;
    this.prng = new PRNG(seed || Date.now());
    this.settings = {
      rootNote: 36, // C2 deep analog bass
      scale: 'dorian',
      chordDegree: 0,
      voiceSpread: 2,
      density: 0.8,
      holdBars: 4, // holds chord for 4 bars before gentle shift
      inversion: 0,
      velocity: 88,
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

  public rebuildVoicing(): void {
    const rootDeg = this.settings.chordDegree;
    // Build root + 3rd/4th + 5th + 7th/9th cluster
    const notes: number[] = [
      this.quantizeDegreeToMidi(rootDeg, 0),         // Root bass
      this.quantizeDegreeToMidi(rootDeg + 2, 1),     // 3rd
      this.quantizeDegreeToMidi(rootDeg + 4, 1),     // 5th
      this.quantizeDegreeToMidi(rootDeg + 6, 2),     // 7th / extension
    ];

    // Apply inversion if requested
    if (this.settings.inversion === 1) {
      notes[1] -= 12;
    } else if (this.settings.inversion === 2) {
      notes[2] -= 12;
    }

    this.activeVoicing = notes;
  }

  public generateStep(context: StepContext): GeneratedEvent[] {
    // Only trigger on start of bar or chord transition interval
    const isBarStart = context.step % 16 === 0;
    if (!isBarStart) return [];

    const barNumber = Math.floor(context.step / 16);
    
    // Check if it's time to shift chord degree
    if (barNumber % this.settings.holdBars === 0 && barNumber !== this.lastBarTriggered) {
      this.lastBarTriggered = barNumber;
      // Step to neighboring harmonic degree (voice leading rule)
      const scaleLen = SCALE_INTERVALS[this.settings.scale].length;
      const stepDelta = this.prng.pick([-1, 1, 2, -2]);
      this.settings.chordDegree = ((this.settings.chordDegree + stepDelta) % scaleLen + scaleLen) % scaleLen;
      this.rebuildVoicing();
    } else if (barNumber === this.lastBarTriggered) {
      return [];
    }

    this.lastBarTriggered = barNumber;

    if (!this.prng.chance(this.settings.density)) return [];

    // Duration equals holdBars in seconds
    const secondsPerBeat = 60 / context.bpm;
    const duration = secondsPerBeat * 4 * this.settings.holdBars;

    // Return polyphonic chord events
    return this.activeVoicing.map((midiNote) => ({
      type: 'note',
      midiNote,
      velocity: Math.max(1, Math.min(127, Math.round(this.settings.velocity + this.prng.gaussian(0, 4)))),
      duration,
      probability: 1.0,
      microOffset: 0,
    }));
  }

  public mutate(boundaries: Record<string, ParameterBoundary>, _intensity: number): void {
    if (boundaries.rootNote && boundaries.rootNote.allowMutation && !boundaries.rootNote.locked) {
      if (this.prng.chance(boundaries.rootNote.mutationProbability)) {
        const rootDelta = this.prng.pick([-2, 2, 5, -5, 7]);
        this.settings.rootNote = Math.max(
          boundaries.rootNote.min,
          Math.min(boundaries.rootNote.max, this.settings.rootNote + rootDelta)
        );
      }
    }

    if (boundaries.scale && boundaries.scale.allowMutation && !boundaries.scale.locked) {
      if (this.prng.chance(boundaries.scale.mutationProbability * 0.5)) {
        const scales: MusicalScale[] = ['dorian', 'phrygian', 'lydian', 'aeolian', 'minorPentatonic', 'hirajoshi'];
        this.settings.scale = this.prng.pick(scales);
      }
    }

    this.rebuildVoicing();
  }

  public regenerate(): void {
    const scales: MusicalScale[] = ['dorian', 'phrygian', 'lydian', 'aeolian', 'minorPentatonic', 'hirajoshi'];
    this.settings.scale = this.prng.pick(scales);
    this.settings.chordDegree = this.prng.rangeInt(0, 6);
    this.settings.inversion = this.prng.rangeInt(0, 2);
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
