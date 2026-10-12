// Weighted Probabilistic Rhythm Generator

import { StepContext, ParameterBoundary } from '../../../types';
import { IGenerator, GeneratedEvent } from '../types';
import { PRNG } from '../../prng';

export interface ProbabilisticSettings {
  stepProbabilities: number[]; // 16 step weights (0.0 to 1.0)
  density: number;             // global density scale (0.0 to 1.0)
  accentProbability: number;   // chance of accent on trigger (0.0 to 1.0)
  ghostProbability: number;    // chance of soft ghost note (0.0 to 1.0)
  velocity: number;            // 1-127
  accentVelocity: number;      // 1-127
  humanizeJitter: number;      // seconds (microtiming variation)
}

export class ProbabilisticGenerator implements IGenerator {
  public id: string;
  public name: string = 'Probabilistic Sequencer';
  public description: string =
    'Weights each individual step with probability values, microtiming humanization, and dynamic ghost/accent distributions for controlled unpredictability.';
  private prng: PRNG;
  private settings: ProbabilisticSettings;

  constructor(id: string, initialSettings?: Partial<ProbabilisticSettings>, seed?: number) {
    this.id = id;
    this.prng = new PRNG(seed || Date.now());
    this.settings = {
      stepProbabilities: [
        1.0, 0.05, 0.3, 0.1,  // beats 1, 1e, 1+, 1a
        0.8, 0.1, 0.4, 0.15, // beats 2
        0.9, 0.05, 0.5, 0.1,  // beats 3
        0.7, 0.2, 0.35, 0.25, // beats 4
      ],
      density: 0.85,
      accentProbability: 0.25,
      ghostProbability: 0.2,
      velocity: 95,
      accentVelocity: 124,
      humanizeJitter: 0.006, // up to 6ms human microtiming
      ...initialSettings,
    };
  }

  public generateStep(context: StepContext): GeneratedEvent[] {
    const stepIdx = context.step % this.settings.stepProbabilities.length;
    const baseProb = this.settings.stepProbabilities[stepIdx] || 0;
    const effectiveProb = baseProb * this.settings.density;

    if (!this.prng.chance(effectiveProb)) {
      return [];
    }

    let vel = this.settings.velocity;
    if (this.prng.chance(this.settings.accentProbability)) {
      vel = this.settings.accentVelocity;
    } else if (this.prng.chance(this.settings.ghostProbability)) {
      vel = Math.max(30, Math.round(this.settings.velocity * 0.45));
    } else {
      vel = Math.max(1, Math.min(127, Math.round(vel + this.prng.gaussian(0, 5))));
    }

    const microOffset = this.settings.humanizeJitter > 0
      ? this.prng.gaussian(0, this.settings.humanizeJitter)
      : 0;

    return [
      {
        type: 'drum',
        midiNote: 38,
        velocity: vel,
        duration: 0.08,
        probability: effectiveProb,
        microOffset,
      },
    ];
  }

  public mutate(boundaries: Record<string, ParameterBoundary>, intensity: number): void {
    // Mutate density
    if (boundaries.density && boundaries.density.allowMutation && !boundaries.density.locked) {
      if (this.prng.chance(boundaries.density.mutationProbability)) {
        const delta = (this.prng.next() * 2 - 1) * 0.2 * intensity;
        this.settings.density = Math.max(
          boundaries.density.min,
          Math.min(boundaries.density.max, this.settings.density + delta)
        );
      }
    }

    // Mutate individual step weights
    const newProbs = [...this.settings.stepProbabilities];
    for (let i = 0; i < newProbs.length; i++) {
      if (this.prng.chance(0.25 * intensity)) {
        const shift = (this.prng.next() * 2 - 1) * 0.3 * intensity;
        newProbs[i] = Math.max(0, Math.min(1.0, newProbs[i] + shift));
      }
    }
    this.settings.stepProbabilities = newProbs;
  }

  public regenerate(): void {
    this.settings.stepProbabilities = Array.from({ length: 16 }, (_, idx) => {
      // Keep beat downbeats slightly higher by default for musical anchor
      const isDownbeat = idx % 4 === 0;
      return isDownbeat ? this.prng.range(0.6, 1.0) : this.prng.range(0.0, 0.6);
    });
  }

  public getSettings(): ProbabilisticSettings {
    return { ...this.settings };
  }

  public setSettings(settings: Partial<ProbabilisticSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }
}
