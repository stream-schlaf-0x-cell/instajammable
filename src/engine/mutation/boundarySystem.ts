// Bounded Randomness & Mutation System with Typed Parameter Constraints & Boundary Adherence

import { ProjectState, LayerState, ParameterBoundary } from '../../types';
import { PRNG } from '../prng';

export class BoundarySystem {
  private prng: PRNG;

  constructor(seed: number = 42) {
    this.prng = new PRNG(seed);
  }

  public setSeed(seed: number): void {
    this.prng.setSeed(seed);
  }

  // Mutates a numeric value strictly bounded by its ParameterBoundary
  public mutateValue(current: number, boundary: ParameterBoundary, intensity: number = 0.5): number {
    if (!boundary.allowMutation || boundary.locked) {
      return current;
    }

    if (!this.prng.chance(boundary.mutationProbability)) {
      return current;
    }

    const range = boundary.max - boundary.min;
    if (range <= 0) return boundary.min;

    const maxDelta = range * (boundary.mutationMagnitude || 0.2) * Math.max(0.05, Math.min(1.0, intensity));
    const delta = (this.prng.next() * 2.0 - 1.0) * maxDelta;
    let candidate = current + delta;

    candidate = Math.max(boundary.min, Math.min(boundary.max, candidate));

    // Enforce integer constraint for steps, pulses, lengths, MIDI pitches
    if (boundary.isInteger) {
      candidate = Math.round(candidate);
    }

    return candidate;
  }

  // Apply bounded mutation across unlocked ambient, effects, and layer parameters
  public mutateProject(state: ProjectState, intensity: number = 0.5): ProjectState {
    const nextState: ProjectState = JSON.parse(JSON.stringify(state));

    // 1. Mutate Ambient Synth parameters using editable project boundaries
    const amb = nextState.ambientParams;
    const ambBounds = nextState.ambientBoundaries || {};

    Object.entries(ambBounds).forEach(([paramName, boundary]) => {
      if (paramName in amb && typeof (amb as any)[paramName] === 'number') {
        (amb as any)[paramName] = this.mutateValue((amb as any)[paramName], boundary, intensity);
      }
    });

    // 2. Mutate Effects parameters using editable project boundaries
    const fx = nextState.effectsParams;
    const fxBounds = nextState.effectsBoundaries || {};

    Object.entries(fxBounds).forEach(([paramName, boundary]) => {
      if (paramName in fx && typeof (fx as any)[paramName] === 'number') {
        (fx as any)[paramName] = this.mutateValue((fx as any)[paramName], boundary, intensity);
      }
    });

    // 3. Mutate Unfrozen & Unlocked layers
    nextState.layers.forEach((layer) => {
      if (layer.frozen || layer.locked) return;

      Object.entries(layer.boundaries).forEach(([paramName, boundary]) => {
        if (paramName in layer.settings && typeof layer.settings[paramName] === 'number') {
          layer.settings[paramName] = this.mutateValue(layer.settings[paramName], boundary, intensity);
        }
      });
    });

    return nextState;
  }

  // Gradual evolution step
  public evolveStep(state: ProjectState, evolveRate: number = 0.25): ProjectState {
    return this.mutateProject(state, evolveRate * 0.35);
  }

  public setLayerFrozen(layer: LayerState, frozen: boolean): void {
    layer.frozen = frozen;
  }

  public setLayerLocked(layer: LayerState, locked: boolean): void {
    layer.locked = locked;
  }
}
