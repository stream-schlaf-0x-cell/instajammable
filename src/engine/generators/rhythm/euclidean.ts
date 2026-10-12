// Euclidean Rhythm Generator (Bjorklund Algorithm)

import { StepContext, ParameterBoundary } from '../../../types';
import { IGenerator, GeneratedEvent } from '../types';
import { PRNG } from '../../prng';

export interface EuclideanSettings {
  steps: number;        // Total steps in pattern (e.g. 16, 12, 8)
  pulses: number;       // Number of active hits (e.g. 5, 7)
  rotation: number;     // Step shift / phase rotation
  velocity: number;     // 1-127
  accentVelocity: number;
  accentSteps: number[]; // which pulse indices receive accent
  density: number;      // 0 to 1 scaling
  probability: number;  // 0 to 1 trigger chance
}

export class EuclideanGenerator implements IGenerator {
  public id: string;
  public name: string = 'Euclidean Rhythm';
  public description: string =
    'Distributes pulses as evenly as possible across steps using the Bjorklund Euclidean algorithm, producing organic Afro-Cuban, Balkan, and polyrhythmic grooves.';
  private prng: PRNG;
  private settings: EuclideanSettings;
  private patternCache: boolean[] = [];

  constructor(id: string, initialSettings?: Partial<EuclideanSettings>, seed?: number) {
    this.id = id;
    this.prng = new PRNG(seed || Date.now());
    this.settings = {
      steps: 16,
      pulses: 5,
      rotation: 0,
      velocity: 100,
      accentVelocity: 120,
      accentSteps: [0],
      density: 1.0,
      probability: 0.95,
      ...initialSettings,
    };
    this.rebuildPattern();
  }

  // Classic Bjorklund Algorithm
  public static bjorklund(steps: number, pulses: number): boolean[] {
    const s = Math.max(1, Math.round(steps));
    const p = Math.max(0, Math.min(s, Math.round(pulses)));
    if (p === 0) return new Array(s).fill(false);
    if (p === s) return new Array(s).fill(true);

    let pattern: number[][] = [];
    const counts: number[] = [];
    const remainders: number[] = [];
    let divisor = s - p;
    remainders.push(p);

    let level = 0;
    while (true) {
      counts.push(Math.floor(divisor / remainders[level]));
      remainders.push(divisor % remainders[level]);
      divisor = remainders[level];
      level++;
      if (remainders[level] <= 1) break;
    }

    counts.push(divisor);

    const build = (lvl: number): void => {
      if (lvl === -1) {
        pattern.push([0]);
      } else if (lvl === -2) {
        pattern.push([1]);
      } else {
        for (let i = 0; i < counts[lvl]; i++) {
          build(lvl - 1);
        }
        if (remainders[lvl] !== 0) {
          build(lvl - 2);
        }
      }
    };

    build(level);
    const flattened = pattern.flat();
    const result = flattened.slice(0, s).map((val) => val === 1);
    return result;
  }

  public rebuildPattern(): void {
    const raw = EuclideanGenerator.bjorklund(this.settings.steps, this.settings.pulses);
    const rot = ((this.settings.rotation % this.settings.steps) + this.settings.steps) % this.settings.steps;
    
    // Rotate pattern
    this.patternCache = raw.slice(rot).concat(raw.slice(0, rot));
  }

  public generateStep(context: StepContext): GeneratedEvent[] {
    const stepIdx = context.step % this.settings.steps;
    const isHit = this.patternCache[stepIdx];

    if (!isHit) return [];

    // Probability & density check
    if (!this.prng.chance(this.settings.probability * this.settings.density)) {
      return [];
    }

    const isAccent = stepIdx === 0 || this.settings.accentSteps.includes(stepIdx);
    const baseVel = isAccent ? this.settings.accentVelocity : this.settings.velocity;
    const vel = Math.max(1, Math.min(127, Math.round(baseVel + this.prng.gaussian(0, 4))));

    return [
      {
        type: 'drum',
        midiNote: 36, // assigned by layer
        velocity: vel,
        duration: 0.1,
        probability: this.settings.probability,
        microOffset: 0,
      },
    ];
  }

  public mutate(boundaries: Record<string, ParameterBoundary>, intensity: number): void {
    // Mutate Pulses
    if (boundaries.pulses && boundaries.pulses.allowMutation && !boundaries.pulses.locked) {
      if (this.prng.chance(boundaries.pulses.mutationProbability)) {
        const delta = this.prng.chance(0.5) ? 1 : -1;
        const newPulses = Math.max(
          boundaries.pulses.min,
          Math.min(boundaries.pulses.max, this.settings.pulses + delta * Math.ceil(intensity * 2))
        );
        this.settings.pulses = newPulses;
      }
    }

    // Mutate Rotation
    if (boundaries.rotation && boundaries.rotation.allowMutation && !boundaries.rotation.locked) {
      if (this.prng.chance(boundaries.rotation.mutationProbability)) {
        const delta = this.prng.chance(0.5) ? 1 : -1;
        this.settings.rotation = Math.max(
          boundaries.rotation.min,
          Math.min(boundaries.rotation.max, this.settings.rotation + delta)
        );
      }
    }

    // Mutate Density
    if (boundaries.density && boundaries.density.allowMutation && !boundaries.density.locked) {
      if (this.prng.chance(boundaries.density.mutationProbability)) {
        const delta = (this.prng.next() * 2 - 1) * 0.15 * intensity;
        this.settings.density = Math.max(
          boundaries.density.min,
          Math.min(boundaries.density.max, this.settings.density + delta)
        );
      }
    }

    this.rebuildPattern();
  }

  public regenerate(): void {
    this.settings.pulses = this.prng.rangeInt(2, Math.max(3, this.settings.steps - 2));
    this.settings.rotation = this.prng.rangeInt(0, this.settings.steps - 1);
    this.rebuildPattern();
  }

  public getSettings(): EuclideanSettings {
    return { ...this.settings };
  }

  public setSettings(settings: Partial<EuclideanSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.rebuildPattern();
  }
}
