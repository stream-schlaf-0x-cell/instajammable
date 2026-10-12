// Polymetric & Polyrhythmic Generator (Odd Meter & Phase Displaced Phrasing)

import { StepContext, ParameterBoundary } from '../../../types';
import { IGenerator, GeneratedEvent } from '../types';
import { PRNG } from '../../prng';

export interface PolymetricSettings {
  loopLength: number;     // e.g. 5, 7, 9, 11, 13 steps (odd meter loop against 16th grid)
  activeHits: number[];   // step indices active inside the loop (e.g. [0, 2, 4] in 7-step loop)
  phaseOffset: number;    // phase shift
  velocity: number;
  accentVelocity: number;
  density: number;
}

export class PolymetricGenerator implements IGenerator {
  public id: string;
  public name: string = 'Polymetric Shifter';
  public description: string =
    'Operates on independent loop lengths (e.g. 5, 7, 11 steps), steadily displacing against the 4/4 grid to create hypnotic phase patterns that evolve over minutes.';
  private prng: PRNG;
  private settings: PolymetricSettings;

  constructor(id: string, initialSettings?: Partial<PolymetricSettings>, seed?: number) {
    this.id = id;
    this.prng = new PRNG(seed || Date.now());
    this.settings = {
      loopLength: 7,
      activeHits: [0, 2, 4],
      phaseOffset: 0,
      velocity: 96,
      accentVelocity: 122,
      density: 0.9,
      ...initialSettings,
    };
  }

  public generateStep(context: StepContext): GeneratedEvent[] {
    const loopStep = (context.step + this.settings.phaseOffset) % this.settings.loopLength;
    const isHit = this.settings.activeHits.includes(loopStep);

    if (!isHit) return [];

    if (!this.prng.chance(this.settings.density)) return [];

    const isAccent = loopStep === 0;
    const vel = isAccent ? this.settings.accentVelocity : this.settings.velocity;

    return [
      {
        type: 'drum',
        midiNote: 42,
        velocity: Math.max(1, Math.min(127, Math.round(vel + this.prng.gaussian(0, 4)))),
        duration: 0.06,
        probability: this.settings.density,
        microOffset: 0,
      },
    ];
  }

  public mutate(boundaries: Record<string, ParameterBoundary>, intensity: number): void {
    if (boundaries.loopLength && boundaries.loopLength.allowMutation && !boundaries.loopLength.locked) {
      if (this.prng.chance(boundaries.loopLength.mutationProbability)) {
        const oddLengths = [3, 5, 7, 9, 11, 13, 15];
        this.settings.loopLength = this.prng.pick(oddLengths);
        this.regenerateHits();
      }
    }

    if (boundaries.density && boundaries.density.allowMutation && !boundaries.density.locked) {
      if (this.prng.chance(boundaries.density.mutationProbability)) {
        const delta = (this.prng.next() * 2 - 1) * 0.2 * intensity;
        this.settings.density = Math.max(
          boundaries.density.min,
          Math.min(boundaries.density.max, this.settings.density + delta)
        );
      }
    }
  }

  public regenerate(): void {
    const oddLengths = [5, 7, 9, 11];
    this.settings.loopLength = this.prng.pick(oddLengths);
    this.regenerateHits();
  }

  private regenerateHits(): void {
    const hits: number[] = [0]; // always keep loop start
    const numHits = Math.max(1, Math.floor(this.settings.loopLength * 0.45));
    for (let i = 1; i < this.settings.loopLength; i++) {
      if (hits.length < numHits && this.prng.chance(0.5)) {
        hits.push(i);
      }
    }
    this.settings.activeHits = hits;
  }

  public getSettings(): PolymetricSettings {
    return { ...this.settings };
  }

  public setSettings(settings: Partial<PolymetricSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }
}
