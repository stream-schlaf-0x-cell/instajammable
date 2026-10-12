// Markov-Inspired Rhythmic Transition Generator

import { StepContext, ParameterBoundary } from '../../../types';
import { IGenerator, GeneratedEvent } from '../types';
import { PRNG } from '../../prng';

export type RhythmState = 'rest' | 'hit' | 'accent' | 'ghost';

export interface MarkovSettings {
  // Transition probabilities from each state to [rest, hit, accent, ghost]
  matrix: {
    rest: [number, number, number, number];
    hit: [number, number, number, number];
    accent: [number, number, number, number];
    ghost: [number, number, number, number];
  };
  downbeatBias: number; // probability boost on beat 1/2/3/4 downbeats
  velocity: number;
}

export class MarkovGenerator implements IGenerator {
  public id: string;
  public name: string = 'Markov Transition Engine';
  public description: string =
    'Uses a probabilistic transition matrix between states (Rest, Hit, Accent, Ghost) conditioned on history and metric accents, modeling organic drummer state flow.';
  private prng: PRNG;
  private settings: MarkovSettings;
  private currentState: RhythmState = 'rest';

  constructor(id: string, initialSettings?: Partial<MarkovSettings>, seed?: number) {
    this.id = id;
    this.prng = new PRNG(seed || Date.now());
    this.settings = {
      matrix: {
        // [rest, hit, accent, ghost]
        rest: [0.45, 0.35, 0.1, 0.1],
        hit: [0.4, 0.35, 0.15, 0.1],
        accent: [0.65, 0.2, 0.05, 0.1],
        ghost: [0.3, 0.5, 0.1, 0.1],
      },
      downbeatBias: 0.7,
      velocity: 96,
      ...initialSettings,
    };
  }

  public generateStep(context: StepContext): GeneratedEvent[] {
    const isDownbeat = context.step % 4 === 0;

    // Pick next state from transition matrix
    const probs = [...this.settings.matrix[this.currentState]];

    // Boost hit or accent if on a primary metric downbeat
    if (isDownbeat && this.prng.chance(this.settings.downbeatBias)) {
      probs[1] += 0.4; // hit
      probs[2] += 0.3; // accent
      probs[0] = Math.max(0.05, probs[0] - 0.4); // reduce rest
    }

    // Normalize probabilities
    const sum = probs.reduce((a, b) => a + b, 0);
    const r = this.prng.next() * sum;

    const states: RhythmState[] = ['rest', 'hit', 'accent', 'ghost'];
    let accum = 0;
    let nextState: RhythmState = 'rest';

    for (let i = 0; i < states.length; i++) {
      accum += probs[i];
      if (r <= accum) {
        nextState = states[i];
        break;
      }
    }

    this.currentState = nextState;

    if (nextState === 'rest') {
      return [];
    }

    let vel = this.settings.velocity;
    if (nextState === 'accent') {
      vel = 125;
    } else if (nextState === 'ghost') {
      vel = Math.round(this.settings.velocity * 0.45);
    } else {
      vel = Math.max(1, Math.min(127, Math.round(vel + this.prng.gaussian(0, 5))));
    }

    return [
      {
        type: 'drum',
        midiNote: 38,
        velocity: vel,
        duration: 0.08,
        probability: 1.0,
        microOffset: 0,
      },
    ];
  }

  public mutate(boundaries: Record<string, ParameterBoundary>, intensity: number): void {
    if (boundaries.downbeatBias && boundaries.downbeatBias.allowMutation && !boundaries.downbeatBias.locked) {
      if (this.prng.chance(boundaries.downbeatBias.mutationProbability)) {
        const delta = (this.prng.next() * 2 - 1) * 0.2 * intensity;
        this.settings.downbeatBias = Math.max(
          boundaries.downbeatBias.min,
          Math.min(boundaries.downbeatBias.max, this.settings.downbeatBias + delta)
        );
      }
    }
  }

  public regenerate(): void {
    this.currentState = 'rest';
    this.settings.matrix.rest[0] = this.prng.range(0.3, 0.6);
    this.settings.matrix.hit[1] = this.prng.range(0.2, 0.5);
  }

  public getSettings(): MarkovSettings {
    return { ...this.settings };
  }

  public setSettings(settings: Partial<MarkovSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }
}
