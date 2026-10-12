// Bounded Randomness & Mutation System

import { ProjectState, LayerState, ParameterBoundary } from '../../types';
import { PRNG } from '../prng';

export class BoundarySystem {
  private prng: PRNG;

  constructor(seed: number = Date.now()) {
    this.prng = new PRNG(seed);
  }

  public setSeed(seed: number): void {
    this.prng.setSeed(seed);
  }

  // Mutates a single numeric value bounded by its ParameterBoundary
  public mutateValue(current: number, boundary: ParameterBoundary, intensity: number = 0.5): number {
    if (!boundary.allowMutation || boundary.locked) {
      return current;
    }

    if (!this.prng.chance(boundary.mutationProbability)) {
      return current;
    }

    const range = boundary.max - boundary.min;
    const maxDelta = range * boundary.mutationMagnitude * intensity;
    const delta = (this.prng.next() * 2 - 1) * maxDelta;
    const candidate = current + delta;

    return Math.max(boundary.min, Math.min(boundary.max, candidate));
  }

  // Apply discrete mutation to an entire project state
  public mutateProject(state: ProjectState, intensity: number = 0.5): ProjectState {
    const nextState: ProjectState = JSON.parse(JSON.stringify(state));

    // Mutate ambient synth parameters
    const amb = nextState.ambientParams;
    const ambBoundaries: Record<string, ParameterBoundary> = {
      filterCutoff: { min: 60, max: 8000, allowMutation: true, mutationProbability: 0.6, mutationMagnitude: 0.25, speed: 1, locked: false },
      filterResonance: { min: 0.5, max: 9.0, allowMutation: true, mutationProbability: 0.4, mutationMagnitude: 0.2, speed: 1, locked: false },
      detuneSpread: { min: 2, max: 35, allowMutation: true, mutationProbability: 0.5, mutationMagnitude: 0.2, speed: 1, locked: false },
      attack: { min: 0.1, max: 4.0, allowMutation: true, mutationProbability: 0.3, mutationMagnitude: 0.25, speed: 1, locked: false },
    };

    amb.filterCutoff = this.mutateValue(amb.filterCutoff, ambBoundaries.filterCutoff, intensity);
    amb.filterResonance = this.mutateValue(amb.filterResonance, ambBoundaries.filterResonance, intensity);
    amb.detuneSpread = this.mutateValue(amb.detuneSpread, ambBoundaries.detuneSpread, intensity);
    amb.attack = this.mutateValue(amb.attack, ambBoundaries.attack, intensity);

    // Mutate effects parameters
    const fx = nextState.effectsParams;
    const fxBoundaries: Record<string, ParameterBoundary> = {
      delayFeedback: { min: 0.1, max: 0.85, allowMutation: true, mutationProbability: 0.4, mutationMagnitude: 0.15, speed: 1, locked: false },
      delayMix: { min: 0.1, max: 0.6, allowMutation: true, mutationProbability: 0.3, mutationMagnitude: 0.2, speed: 1, locked: false },
      reverbMix: { min: 0.15, max: 0.7, allowMutation: true, mutationProbability: 0.4, mutationMagnitude: 0.2, speed: 1, locked: false },
    };

    fx.delayFeedback = this.mutateValue(fx.delayFeedback, fxBoundaries.delayFeedback, intensity);
    fx.delayMix = this.mutateValue(fx.delayMix, fxBoundaries.delayMix, intensity);
    fx.reverbMix = this.mutateValue(fx.reverbMix, fxBoundaries.reverbMix, intensity);

    // Mutate individual layers that are not frozen or locked
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

  // Gradual evolution step (called periodically over bars when 'evolve' is active)
  public evolveStep(state: ProjectState, evolveRate: number = 0.2): ProjectState {
    return this.mutateProject(state, evolveRate * 0.4);
  }

  // Freeze layer
  public setLayerFrozen(layer: LayerState, frozen: boolean): void {
    layer.frozen = frozen;
  }

  // Lock layer
  public setLayerLocked(layer: LayerState, locked: boolean): void {
    layer.locked = locked;
  }
}
