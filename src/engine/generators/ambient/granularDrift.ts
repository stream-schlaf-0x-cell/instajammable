// Granular Harmonic Drift & Texture Cloud Generator

import { StepContext, ParameterBoundary } from '../../../types';
import { IGenerator, GeneratedEvent } from '../types';
import { PRNG } from '../../prng';

export interface GranularDriftSettings {
  centerPitch: number;      // MIDI note (e.g. 60 = C4, 72 = C5)
  pitchSpread: number;      // semitones of spread (+/- 12)
  density: number;          // probability of spawning grain (0 to 1)
  grainDuration: number;    // seconds (0.4 to 4.0s)
  velocity: number;
}

export class GranularDriftGenerator implements IGenerator {
  public id: string;
  public name: string = 'Granular Drift Cloud';
  public description: string =
    'Generates dispersed microtonal harmonic grains, shimmering crystalline cloud clusters, and organic ambient textures floating around a center register.';
  private prng: PRNG;
  private settings: GranularDriftSettings;

  constructor(id: string, initialSettings?: Partial<GranularDriftSettings>, seed?: number) {
    this.id = id;
    this.prng = new PRNG(seed || Date.now());
    this.settings = {
      centerPitch: 67, // G4
      pitchSpread: 9,
      density: 0.35,
      grainDuration: 1.8,
      velocity: 75,
      ...initialSettings,
    };
  }

  public generateStep(_context: StepContext): GeneratedEvent[] {
    if (!this.prng.chance(this.settings.density)) return [];

    const pitchOffset = Math.round(this.prng.gaussian(0, this.settings.pitchSpread / 2));
    const targetNote = Math.max(36, Math.min(96, this.settings.centerPitch + pitchOffset));

    return [
      {
        type: 'note',
        midiNote: targetNote,
        velocity: Math.max(1, Math.min(127, Math.round(this.settings.velocity + this.prng.gaussian(0, 8)))),
        duration: this.settings.grainDuration * this.prng.range(0.8, 1.4),
        probability: this.settings.density,
        microOffset: this.prng.range(0.01, 0.08),
      },
    ];
  }

  public mutate(boundaries: Record<string, ParameterBoundary>, _intensity: number): void {
    if (boundaries.centerPitch && boundaries.centerPitch.allowMutation && !boundaries.centerPitch.locked) {
      if (this.prng.chance(boundaries.centerPitch.mutationProbability)) {
        const delta = this.prng.pick([-2, 2, 3, -3, 5]);
        this.settings.centerPitch = Math.max(
          boundaries.centerPitch.min,
          Math.min(boundaries.centerPitch.max, this.settings.centerPitch + delta)
        );
      }
    }
  }

  public regenerate(): void {
    this.settings.centerPitch = this.prng.rangeInt(55, 75);
    this.settings.pitchSpread = this.prng.rangeInt(5, 14);
  }

  public getSettings(): GranularDriftSettings {
    return { ...this.settings };
  }

  public setSettings(settings: Partial<GranularDriftSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }
}
