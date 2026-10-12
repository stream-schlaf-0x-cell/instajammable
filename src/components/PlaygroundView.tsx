// Algorithm Playground: A/B Comparison, Auditioning & Algorithmic Discovery

import React, { useState } from 'react';
import { ProjectState, RhythmAlgorithmType } from '../types';
import { EngineFacade } from '../engine/engineFacade';
import { EuclideanGenerator } from '../engine/generators/rhythm/euclidean';
import { Disc3, Check } from 'lucide-react';

interface PlaygroundViewProps {
  state: ProjectState;
}

export const PlaygroundView: React.FC<PlaygroundViewProps> = ({ state }) => {
  const engine = EngineFacade.getInstance();
  const [selectedLayerId, setSelectedLayerId] = useState<string>(state.layers[0]?.id || '');
  const [auditionAlgo, setAuditionAlgo] = useState<RhythmAlgorithmType>('euclidean');

  const selectedLayer = state.layers.find((l) => l.id === selectedLayerId) || state.layers[0];

  const algorithms: { type: RhythmAlgorithmType; name: string; description: string; math: string }[] = [
    {
      type: 'euclidean',
      name: 'Euclidean Algorithm (Bjorklund)',
      description:
        'Evenly distributes k pulses over n discrete time intervals. Originates in atomic physics and found in traditional Afro-Cuban, West African, and Balkan rhythmic structures.',
      math: 'bjorklund(steps, pulses) + rotation',
    },
    {
      type: 'probabilistic',
      name: 'Weighted Probabilistic Sequencer',
      description:
        'Assigns probability weights to every step on the grid, with independent accent, ghost note, and micro-timing humanization distributions.',
      math: 'P(step) * density + N(0, σ) jitter',
    },
    {
      type: 'polymetric',
      name: 'Polymetric Phasing Engine',
      description:
        'Uses an odd-length loop (e.g. 5, 7, 11 steps) running against the 4/4 bar grid, creating a continuous phase displacement that only aligns after LCM intervals.',
      math: '(step + phase) mod loopLength',
    },
    {
      type: 'markov',
      name: 'Markov Transition Matrix',
      description:
        'Models transitions between 4 states (Rest, Hit, Accent, Ghost) conditioned on history and metric accents, simulating organic drummer memory.',
      math: 'P(S_t | S_{t-1}) transition matrix',
    },
    {
      type: 'densityBurst',
      name: 'Stochastic Density & Burst (IDM)',
      description:
        'Spawns clustered micro-bursts and spacious rests using Poisson-style stochastic event distributions. Ideal for IDM glitches and natural water droplets.',
      math: 'Poisson clusters + exponential decay',
    },
  ];

  const handleApplyToLayer = () => {
    if (selectedLayer) {
      engine.setLayerAlgorithm(selectedLayer.id, auditionAlgo);
    }
  };

  // Preview 16-step pattern representation
  const renderPatternPreview = () => {
    let hits: boolean[] = new Array(16).fill(false);

    if (auditionAlgo === 'euclidean') {
      hits = EuclideanGenerator.bjorklund(16, 5);
    } else if (auditionAlgo === 'probabilistic') {
      hits = [true, false, false, false, true, false, true, false, true, false, false, false, true, false, false, false];
    } else if (auditionAlgo === 'polymetric') {
      hits = Array.from({ length: 16 }, (_, i) => [0, 2, 4].includes(i % 7));
    } else if (auditionAlgo === 'markov') {
      hits = [true, false, true, false, true, false, false, true, true, false, true, false, false, true, false, false];
    } else if (auditionAlgo === 'densityBurst') {
      hits = [true, true, true, false, false, false, true, false, false, false, false, true, true, false, false, false];
    }

    return (
      <div className="grid grid-cols-16 gap-1 bg-stone-950 p-3 rounded-lg border border-stone-800">
        {hits.map((hit, idx) => (
          <div
            key={idx}
            className={`h-9 rounded flex flex-col items-center justify-center font-mono text-[9px] border transition-all ${
              hit
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                : 'bg-stone-900 border-stone-800/80 text-stone-600'
            }`}
          >
            {idx + 1}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-stone-900/40 border border-stone-800/80 rounded-2xl p-6 backdrop-blur-md space-y-6">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-800 pb-4">
        <div className="flex items-center gap-2">
          <Disc3 className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-base font-semibold tracking-wider text-stone-100 uppercase font-mono">
              EXPERIMENTAL ALGORITHM PLAYGROUND
            </h2>
            <p className="text-xs font-mono text-stone-400">
              Audition, compare, and hot-swap generative methods without rebuilding instruments
            </p>
          </div>
        </div>

        {/* Target Layer Selector */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-stone-400">TARGET LAYER:</span>
          <select
            value={selectedLayerId}
            onChange={(e) => setSelectedLayerId(e.target.value)}
            className="bg-stone-950 border border-stone-800 text-emerald-300 rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            {state.layers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.algorithmType})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Algorithm Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
        {algorithms.map((algo) => {
          const isSelected = auditionAlgo === algo.type;
          const isCurrentlyActiveOnLayer = selectedLayer?.algorithmType === algo.type;

          return (
            <div
              key={algo.type}
              onClick={() => setAuditionAlgo(algo.type)}
              className={`p-5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-stone-950 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/50'
                  : 'bg-stone-950/60 border-stone-800 hover:border-stone-700'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-stone-200 text-sm">{algo.name}</h3>
                  {isCurrentlyActiveOnLayer && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500 text-emerald-400">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-stone-400 text-[11px] leading-relaxed font-sans">{algo.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-900 flex items-center justify-between">
                <span className="text-[10px] text-stone-500">{algo.math}</span>
                <span className={`text-[10px] font-bold ${isSelected ? 'text-emerald-400' : 'text-stone-600'}`}>
                  {isSelected ? 'SELECTED FOR AUDITION' : 'CLICK TO AUDITION'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pattern Visualization & Commit Action */}
      <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-stone-300 font-bold">
              Pattern Preview: {auditionAlgo.toUpperCase()}
            </span>
            <p className="text-[11px] font-mono text-stone-400">
              Metric 16-step activation snapshot for the selected algorithm
            </p>
          </div>

          <button
            onClick={handleApplyToLayer}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold rounded-lg flex items-center gap-2 shadow-lg transition-all"
          >
            <Check className="w-4 h-4" />
            Assign {auditionAlgo} to {selectedLayer?.name}
          </button>
        </div>

        {renderPatternPreview()}
      </div>

    </div>
  );
};
