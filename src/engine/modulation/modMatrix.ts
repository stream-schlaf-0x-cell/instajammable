// Inter-Engine Cross-Modulation Matrix

import { ModulationRoute } from '../../types';

export interface ModulationSources {
  drumDensity: number;       // 0 to 1 based on recent triggers
  rhythmicAccent: number;    // 0 to 1 instantaneous transient accent
  ambientBrightness: number; // 0 to 1 based on filter cutoff & active notes
  globalChaos: number;       // 0 to 1 current mutation intensity
}

export interface ModulationOffsets {
  ambientCutoffOffset: number;    // Hz offset
  delayFeedbackOffset: number;    // feedback offset
  reverbMixOffset: number;        // mix offset
  drumProbabilityOffset: number;  // probability offset
  accentLikelihoodOffset: number; // accent offset
}

export class ModulationMatrix {
  private routes: ModulationRoute[] = [];

  constructor(initialRoutes?: ModulationRoute[]) {
    this.routes = initialRoutes || [
      {
        id: 'mod_1',
        source: 'drumDensity',
        destination: 'ambientCutoff',
        depth: 0.65,
        enabled: true,
      },
      {
        id: 'mod_2',
        source: 'rhythmicAccent',
        destination: 'reverbMix',
        depth: 0.45,
        enabled: true,
      },
      {
        id: 'mod_3',
        source: 'ambientBrightness',
        destination: 'drumProbability',
        depth: 0.35,
        enabled: true,
      },
      {
        id: 'mod_4',
        source: 'globalChaos',
        destination: 'delayFeedback',
        depth: 0.5,
        enabled: true,
      },
    ];
  }

  public getRoutes(): ModulationRoute[] {
    return this.routes;
  }

  public setRoutes(routes: ModulationRoute[]): void {
    this.routes = routes;
  }

  public updateRoute(id: string, updates: Partial<ModulationRoute>): void {
    const route = this.routes.find((r) => r.id === id);
    if (route) {
      Object.assign(route, updates);
    }
  }

  // Calculates offsets to apply to destinations given current real-time source signals
  public process(sources: ModulationSources): ModulationOffsets {
    const offsets: ModulationOffsets = {
      ambientCutoffOffset: 0,
      delayFeedbackOffset: 0,
      reverbMixOffset: 0,
      drumProbabilityOffset: 0,
      accentLikelihoodOffset: 0,
    };

    this.routes.forEach((route) => {
      if (!route.enabled) return;

      const sourceVal = sources[route.source] || 0;
      const modSignal = sourceVal * route.depth;

      switch (route.destination) {
        case 'ambientCutoff':
          offsets.ambientCutoffOffset += modSignal * 3000; // up to +/- 3000 Hz sweep
          break;
        case 'delayFeedback':
          offsets.delayFeedbackOffset += modSignal * 0.35;
          break;
        case 'reverbMix':
          offsets.reverbMixOffset += modSignal * 0.3;
          break;
        case 'drumProbability':
          offsets.drumProbabilityOffset += modSignal * 0.3;
          break;
        case 'accentLikelihood':
          offsets.accentLikelihoodOffset += modSignal * 0.4;
          break;
      }
    });

    return offsets;
  }
}
