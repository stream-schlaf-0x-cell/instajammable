// Algorithm Playground: A/B Comparison, Auditioning & Algorithmic Discovery

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ProjectState, RhythmAlgorithmType, AmbientAlgorithmType, StepContext } from '../types';
import { EngineFacade } from '../engine/engineFacade';
import { Disc3, Check, Volume2, Square, Shuffle, GitCompare } from 'lucide-react';
import { GeneratedEvent } from '../engine/generators/types';

interface PlaygroundViewProps {
  state: ProjectState;
}

type AlgorithmCandidateType = RhythmAlgorithmType | AmbientAlgorithmType;

export const PlaygroundView: React.FC<PlaygroundViewProps> = ({ state }) => {
  const engine = EngineFacade.getInstance();
  const [selectedLayerId, setSelectedLayerId] = useState<string>(state.layers[0]?.id || '');
  const [auditionAlgo, setAuditionAlgo] = useState<AlgorithmCandidateType>('euclidean');
  const [previewSeed, setPreviewSeed] = useState<number>(42);
  const [isPlayingAudition, setIsPlayingAudition] = useState<boolean>(false);
  const [auditionStepIdx, setAuditionStepIdx] = useState<number>(-1);
  const [appliedNotification, setAppliedNotification] = useState<string | null>(null);

  const auditionTimersRef = useRef<number[]>([]);

  const selectedLayer = state.layers.find((l) => l.id === selectedLayerId) || state.layers[0];

  // Param overrides for the candidate algorithm before committing
  const [candidateParams, setCandidateParams] = useState<Record<string, any>>({
    steps: 16,
    pulses: 5,
    rotation: 0,
    density: 0.8,
    loopLength: 7,
    accentProbability: 0.3,
    ghostProbability: 0.2,
    holdBars: 2,
  });

  const rhythmAlgorithms: { type: RhythmAlgorithmType; name: string; description: string; math: string }[] = [
    {
      type: 'euclidean',
      name: 'Euclidean Algorithm (Bjorklund)',
      description:
        'Evenly distributes k pulses over n discrete time intervals. Found in traditional Afro-Cuban, West African, and Balkan rhythmic structures.',
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
        'Uses an odd-length loop (e.g. 5, 7, 11 steps) running against the 4/4 bar grid, creating continuous phase displacement.',
      math: '(step + phase) mod loopLength',
    },
    {
      type: 'markov',
      name: 'Markov Transition Matrix',
      description:
        'Models transitions between 4 states (Rest, Hit, Accent, Ghost) conditioned on history and metric downbeats.',
      math: 'P(S_t | S_{t-1}) transition matrix',
    },
    {
      type: 'densityBurst',
      name: 'Stochastic Density & Burst (IDM)',
      description:
        'Spawns clustered micro-bursts and spacious rests using Poisson-style stochastic event distributions. Ideal for IDM glitches.',
      math: 'Poisson clusters + exponential decay',
    },
  ];

  // Stop audition audio on unmount
  useEffect(() => {
    return () => {
      auditionTimersRef.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // Compute 16-step candidate events deterministically using the real generator
  const candidateStepEvents = useMemo(() => {
    const gen = engine.createGenerator('preview_candidate', auditionAlgo, candidateParams, previewSeed);
    if (!gen) return [];

    const events: { step: number; hasHit: boolean; velocity: number; microOffset: number; event?: GeneratedEvent }[] = [];
    const baseCtx: StepContext = {
      step: 0,
      subStep: 0,
      beat: 0,
      bar: 0,
      time: 0,
      perfTime: 0,
      bpm: state.bpm,
      swing: state.swing,
      swingOffset: 0,
    };

    for (let s = 0; s < 16; s++) {
      const ctx: StepContext = { ...baseCtx, step: s, subStep: s, beat: Math.floor(s / 4) };
      const generated = gen.generateStep(ctx);
      if (generated.length > 0) {
        events.push({
          step: s,
          hasHit: true,
          velocity: generated[0].velocity,
          microOffset: generated[0].microOffset || 0,
          event: generated[0],
        });
      } else {
        events.push({
          step: s,
          hasHit: false,
          velocity: 0,
          microOffset: 0,
        });
      }
    }
    return events;
  }, [auditionAlgo, candidateParams, previewSeed, state.bpm, state.swing]);

  // Compute 16-step pattern for the CURRENT layer to compare against
  const currentLayerEvents = useMemo(() => {
    if (!selectedLayer) return [];
    const gen = engine.createGenerator('preview_current', selectedLayer.algorithmType, selectedLayer.settings, 1337);
    if (!gen) return [];

    const events: { step: number; hasHit: boolean; velocity: number }[] = [];
    const baseCtx: StepContext = {
      step: 0,
      subStep: 0,
      beat: 0,
      bar: 0,
      time: 0,
      perfTime: 0,
      bpm: state.bpm,
      swing: state.swing,
      swingOffset: 0,
    };

    for (let s = 0; s < 16; s++) {
      const ctx: StepContext = { ...baseCtx, step: s, subStep: s, beat: Math.floor(s / 4) };
      const generated = gen.generateStep(ctx);
      events.push({
        step: s,
        hasHit: generated.length > 0,
        velocity: generated.length > 0 ? generated[0].velocity : 0,
      });
    }
    return events;
  }, [selectedLayer, state.bpm, state.swing]);

  // Metric stats
  const candidateHitsCount = candidateStepEvents.filter((e) => e.hasHit).length;
  const currentHitsCount = currentLayerEvents.filter((e) => e.hasHit).length;

  const handleAuditionPlay = () => {
    if (isPlayingAudition) {
      auditionTimersRef.current.forEach((t) => window.clearTimeout(t));
      auditionTimersRef.current = [];
      setIsPlayingAudition(false);
      setAuditionStepIdx(-1);
      return;
    }

    setIsPlayingAudition(true);
    const stepDurationMs = (60000 / state.bpm / 4);

    candidateStepEvents.forEach((ev, idx) => {
      const timer = window.setTimeout(() => {
        setAuditionStepIdx(idx);
        if (ev.hasHit) {
          const drumVoice = selectedLayer?.drumVoice || 'kick';
          engine.auditionSound('drum', drumVoice, ev.velocity);
        }

        if (idx === 15) {
          const endTimer = window.setTimeout(() => {
            setIsPlayingAudition(false);
            setAuditionStepIdx(-1);
          }, stepDurationMs);
          auditionTimersRef.current.push(endTimer);
        }
      }, idx * stepDurationMs + ev.microOffset * 1000);

      auditionTimersRef.current.push(timer);
    });
  };

  const handleApplyToLayer = () => {
    if (!selectedLayer) return;
    engine.setLayerAlgorithm(selectedLayer.id, auditionAlgo as RhythmAlgorithmType);
    // Apply tuned settings
    Object.keys(candidateParams).forEach((k) => {
      engine.setLayerSetting(selectedLayer.id, k, candidateParams[k]);
    });
    setAppliedNotification(`Assigned ${auditionAlgo.toUpperCase()} to ${selectedLayer.name}`);
    setTimeout(() => setAppliedNotification(null), 3000);
  };

  return (
    <div className="bg-stone-900/40 border border-stone-800/80 rounded-2xl p-6 backdrop-blur-md space-y-6">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-800 pb-4">
        <div className="flex items-center gap-2">
          <Disc3 className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-base font-semibold tracking-wider text-stone-100 uppercase font-mono">
              ALGORITHM PLAYGROUND & AUDITION LAB
            </h2>
            <p className="text-xs font-mono text-stone-400">
              Isolated generator auditioning with deterministic PRNG seeds and real Web Audio synthesis
            </p>
          </div>
        </div>

        {/* Target Layer Selector */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-stone-400">TARGET LAYER:</span>
          <select
            value={selectedLayerId}
            onChange={(e) => setSelectedLayerId(e.target.value)}
            className="bg-stone-950 border border-stone-800 text-emerald-300 rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            {state.layers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} [{l.algorithmType}]
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Algorithm Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs">
        {rhythmAlgorithms.map((algo) => {
          const isSelected = auditionAlgo === algo.type;
          const isCurrentlyActiveOnLayer = selectedLayer?.algorithmType === algo.type;

          return (
            <div
              key={algo.type}
              onClick={() => setAuditionAlgo(algo.type)}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-stone-950 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/50'
                  : 'bg-stone-950/60 border-stone-800 hover:border-stone-700'
              }`}
            >
              <div className="space-y-1.5">
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

              <div className="mt-3 pt-2.5 border-t border-stone-900 flex items-center justify-between">
                <span className="text-[10px] text-stone-500">{algo.math}</span>
                <span className={`text-[10px] font-bold ${isSelected ? 'text-emerald-400' : 'text-stone-600'}`}>
                  {isSelected ? 'AUDITIONING' : 'SELECT'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Candidate Tuner Controls */}
      <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-4 font-mono text-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-stone-300 uppercase tracking-wider text-[11px]">
            TUNE CANDIDATE PARAMETERS ({auditionAlgo.toUpperCase()})
          </span>
          <div className="flex items-center gap-2">
            <span className="text-stone-500 text-[10px]">Deterministic Seed: #{previewSeed}</span>
            <button
              onClick={() => setPreviewSeed(Math.floor(Math.random() * 10000))}
              className="p-1 px-2 bg-stone-900 hover:bg-stone-800 border border-stone-800 rounded text-stone-300 flex items-center gap-1 text-[10px] transition-all"
              title="Re-roll PRNG Seed"
            >
              <Shuffle className="w-3 h-3 text-emerald-400" />
              Re-roll
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {auditionAlgo === 'euclidean' && (
            <>
              <div>
                <label className="text-[10px] text-stone-500 block mb-1">Pulses ({candidateParams.pulses})</label>
                <input
                  type="range"
                  min="1"
                  max="16"
                  value={candidateParams.pulses || 5}
                  onChange={(e) => setCandidateParams({ ...candidateParams, pulses: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-stone-500 block mb-1">Steps ({candidateParams.steps})</label>
                <input
                  type="range"
                  min="4"
                  max="16"
                  value={candidateParams.steps || 16}
                  onChange={(e) => setCandidateParams({ ...candidateParams, steps: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-stone-500 block mb-1">Rotation ({candidateParams.rotation})</label>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={candidateParams.rotation || 0}
                  onChange={(e) => setCandidateParams({ ...candidateParams, rotation: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
              </div>
            </>
          )}

          {auditionAlgo === 'polymetric' && (
            <>
              <div>
                <label className="text-[10px] text-stone-500 block mb-1">Loop Length ({candidateParams.loopLength})</label>
                <select
                  value={candidateParams.loopLength || 7}
                  onChange={(e) => setCandidateParams({ ...candidateParams, loopLength: parseInt(e.target.value) })}
                  className="bg-stone-900 border border-stone-800 text-emerald-400 rounded px-2 py-1 w-full"
                >
                  {[3, 5, 7, 9, 11, 13, 15].map((len) => (
                    <option key={len} value={len}>
                      {len} steps
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {auditionAlgo === 'probabilistic' && (
            <>
              <div>
                <label className="text-[10px] text-stone-500 block mb-1">
                  Density ({Math.round((candidateParams.density || 0.8) * 100)}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={candidateParams.density || 0.8}
                  onChange={(e) => setCandidateParams({ ...candidateParams, density: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-stone-500 block mb-1">
                  Accents ({Math.round((candidateParams.accentProbability || 0.3) * 100)}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={candidateParams.accentProbability || 0.3}
                  onChange={(e) => setCandidateParams({ ...candidateParams, accentProbability: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
              </div>
            </>
          )}

          {auditionAlgo === 'densityBurst' && (
            <>
              <div>
                <label className="text-[10px] text-stone-500 block mb-1">
                  Cluster Density ({Math.round((candidateParams.density || 0.7) * 100)}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={candidateParams.density || 0.7}
                  onChange={(e) => setCandidateParams({ ...candidateParams, density: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Side-by-Side Pattern & Metric Comparison */}
      <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-5 space-y-4 font-mono text-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-stone-200">
              A/B COMPARISON: CURRENT [{selectedLayer?.algorithmType.toUpperCase()}] vs CANDIDATE [{auditionAlgo.toUpperCase()}]
            </span>
          </div>

          <div className="flex items-center gap-2">
            {appliedNotification && (
              <span className="text-[11px] text-emerald-400 bg-emerald-950/50 border border-emerald-500/40 px-2.5 py-1 rounded">
                {appliedNotification}
              </span>
            )}
            <button
              onClick={handleAuditionPlay}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all ${
                isPlayingAudition
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/50'
                  : 'bg-stone-800 hover:bg-stone-700 text-emerald-300'
              }`}
            >
              {isPlayingAudition ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {isPlayingAudition ? 'Stop Audition' : 'Audition (1 Bar)'}
            </button>

            <button
              onClick={handleApplyToLayer}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-md transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              Commit to {selectedLayer?.name}
            </button>
          </div>
        </div>

        {/* 1. Candidate Pattern Visualizer */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-stone-400">
            <span>Candidate: {auditionAlgo.toUpperCase()}</span>
            <span>{candidateHitsCount} hits / 16 steps ({Math.round((candidateHitsCount / 16) * 100)}% density)</span>
          </div>
          <div className="grid grid-cols-16 gap-1 bg-stone-900/80 p-2.5 rounded-lg border border-stone-800">
            {candidateStepEvents.map((ev, idx) => {
              const isCurrentPlayingStep = auditionStepIdx === idx;
              const heightPct = ev.hasHit ? Math.max(25, Math.round((ev.velocity / 127) * 100)) : 10;

              return (
                <div
                  key={idx}
                  className={`h-12 rounded flex flex-col items-center justify-end p-1 transition-all border ${
                    isCurrentPlayingStep
                      ? 'border-amber-400 bg-amber-500/30'
                      : ev.hasHit
                      ? 'border-emerald-500/80 bg-emerald-950/40 text-emerald-300'
                      : 'border-stone-800 bg-stone-950/60 text-stone-600'
                  }`}
                >
                  <div
                    className={`w-full rounded-xs transition-all ${
                      ev.hasHit ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]' : 'bg-transparent'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[8px] mt-1 text-stone-500">{idx + 1}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Current Layer Active Pattern Visualizer */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between text-[11px] text-stone-400">
            <span>Current: {selectedLayer?.name} ({selectedLayer?.algorithmType.toUpperCase()})</span>
            <span>{currentHitsCount} hits / 16 steps ({Math.round((currentHitsCount / 16) * 100)}% density)</span>
          </div>
          <div className="grid grid-cols-16 gap-1 bg-stone-950/40 p-2 rounded-lg border border-stone-800/60">
            {currentLayerEvents.map((ev, idx) => {
              const heightPct = ev.hasHit ? Math.max(25, Math.round((ev.velocity / 127) * 100)) : 10;
              return (
                <div
                  key={idx}
                  className={`h-9 rounded flex flex-col items-center justify-end p-0.5 border ${
                    ev.hasHit ? 'border-cyan-500/50 bg-cyan-950/30 text-cyan-300' : 'border-stone-900 bg-stone-950/30 text-stone-700'
                  }`}
                >
                  <div
                    className={`w-full rounded-xs ${ev.hasHit ? 'bg-cyan-400' : 'bg-transparent'}`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[7px] mt-0.5 text-stone-600">{idx + 1}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
