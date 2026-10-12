// Density & Stochastic Burst Rhythm Generator (IDM & Organic Droplets)

import { StepContext, ParameterBoundary } from '../../../types';
import { IGenerator, GeneratedEvent } from '../types';
import { PRNG } from '../../prng';

export interface DensityBurstSettings {
  baseDensity: number;       // 0 to 1 average event frequency
  burstChance: number;       // chance of rapid 2-3 event micro-burst
  burstDecay: number;        // velocity decay through the burst
  restLikelihood: number;    // intentional space / silence
  velocity: number;
}

export class DensityBurstGenerator implements IGenerator {
  public id: string;
  public name: string = 'Density & Burst Engine';
  public description: string =
    'Generates stochastic event clusters, organic micro-bursts, and spacious silence inspired by IDM, experimental electronica, and natural percussion droplets.';
  private prng: PRNG;
  private settings: DensityBurstSettings;
  private burstRemaining: number = 0;

  constructor(id: string, initialSettings?: Partial<DensityBurstSettings>, seed?: number) {
    this.id = id;
    this.prng = new PRNG(seed || Date.now());
    this.settings = {
      baseDensity: 0.35,
      burstChance: 0.25,
      burstDecay: 0.8,
      restLikelihood: 0.4,
      velocity: 92,
      ...initialSettings,
    };
  }

  public generateStep(_context: StepContext): GeneratedEvent[] {
    // If currently in a burst sequence
    if (this.burstRemaining > 0) {
      this.burstRemaining--;
      const burstVel = Math.round(this.settings.velocity * Math.pow(this.settings.burstDecay, 3 - this.burstRemaining));
      return [
        {
          type: 'drum',
          midiNote: 37,
          velocity: Math.max(20, burstVel),
          duration: 0.05,
          probability: 1.0,
          microOffset: this.prng.range(0.005, 0.02),
        },
      ];
    }

    // Check rest likelihood
    if (this.prng.chance(this.settings.restLikelihood)) {
      return [];
    }

    // Check trigger against base density
    if (!this.prng.chance(this.settings.baseDensity)) {
      return [];
    }

    // Check if triggering a new burst
    if (this.prng.chance(this.settings.burstChance)) {
      this.burstRemaining = this.prng.rangeInt(1, 3);
    }

    return [
      {
        type: 'drum',
        midiNote: 37,
        velocity: Math.max(1, Math.min(127, Math.round(this.settings.velocity + this.prng.gaussian(0, 6)))),
        duration: 0.07,
        probability: this.settings.baseDensity,
        microOffset: 0,
      },
    ];
  }

  public mutate(boundaries: Record<string, ParameterBoundary>, intensity: number): void {
    if (boundaries.baseDensity && boundaries.baseDensity.allowMutation && !boundaries.baseDensity.locked) {
      if (this.prng.chance(boundaries.baseDensity.mutationProbability)) {
        const delta = (this.prng.next() * 2 - 1) * 0.15 * intensity;
        this.settings.baseDensity = Math.max(
          boundaries.baseDensity.min,
          Math.min(boundaries.baseDensity.max, this.settings.baseDensity + delta)
        );
      }
    }
  }

  public regenerate(): void {
    this.burstRemaining = 0;
    this.settings.baseDensity = this.prng.range(0.2, 0.6);
    this.settings.burstChance = this.prng.range(0.15, 0.45);
  }

  public getSettings(): DensityBurstSettings {
    return { ...this.settings };
  }

  public setSettings(settings: Partial<DensityBurstSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }
}
