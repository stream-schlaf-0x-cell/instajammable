// Deep Edit View: Full Parameter Access, Synth Architectures, Effects & Boundary Tuning

import React, { useState } from 'react';
import { ProjectState, MusicalScale } from '../types';
import { EngineFacade } from '../engine/engineFacade';
import { Sliders, Activity, Disc, Sparkles, Layers } from 'lucide-react';

interface DeepEditViewProps {
  state: ProjectState;
}

export const DeepEditView: React.FC<DeepEditViewProps> = ({ state }) => {
  const engine = EngineFacade.getInstance();
  const [activeTab, setActiveTab] = useState<'drums' | 'ambient' | 'effects' | 'modulation' | 'boundaries'>('drums');

  const updateDrum = (voice: 'kick' | 'snare' | 'hihat' | 'perc', param: string, val: number) => {
    (state.drumParams[voice] as any)[param] = val;
    engine.mutate(0);
  };

  const updateAmbient = (param: string, val: any) => {
    (state.ambientParams as any)[param] = val;
    engine.mutate(0);
  };

  const updateEffects = (param: string, val: number) => {
    (state.effectsParams as any)[param] = val;
    engine.effectsRack.updateParams(state.effectsParams);
    engine.mutate(0);
  };

  const scales: MusicalScale[] = [
    'dorian',
    'phrygian',
    'lydian',
    'aeolian',
    'majorPentatonic',
    'minorPentatonic',
    'hirajoshi',
    'microtonal',
  ];

  return (
    <div className="bg-stone-900/40 border border-stone-800/80 rounded-2xl p-6 backdrop-blur-md space-y-6">
      
      {/* Sub-Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-800 pb-4 font-mono text-xs">
        <button
          onClick={() => setActiveTab('drums')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
            activeTab === 'drums' ? 'bg-emerald-600 text-white font-semibold' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Disc className="w-3.5 h-3.5" />
          Drum Synthesis
        </button>
        <button
          onClick={() => setActiveTab('ambient')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
            activeTab === 'ambient' ? 'bg-emerald-600 text-white font-semibold' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Ambient Synthesis
        </button>
        <button
          onClick={() => setActiveTab('effects')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
            activeTab === 'effects' ? 'bg-emerald-600 text-white font-semibold' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Effects Rack
        </button>
        <button
          onClick={() => setActiveTab('modulation')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
            activeTab === 'modulation' ? 'bg-emerald-600 text-white font-semibold' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Modulation Matrix
        </button>
        <button
          onClick={() => setActiveTab('boundaries')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
            activeTab === 'boundaries' ? 'bg-emerald-600 text-white font-semibold' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Mutation Boundaries
        </button>
      </div>

      {/* 1. DRUMS SYNTHESIS TAB */}
      {activeTab === 'drums' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 font-mono text-xs">
          {(['kick', 'snare', 'hihat', 'perc'] as const).map((voice) => {
            const p = state.drumParams[voice];
            return (
              <div key={voice} className="bg-stone-950/70 border border-stone-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                  <h3 className="font-bold text-stone-200 uppercase tracking-wider">{voice} Voice</h3>
                  <span className="text-[10px] text-emerald-400">MIDI {p.midiNote}</span>
                </div>

                {/* Pitch */}
                <div className="space-y-1">
                  <div className="flex justify-between text-stone-400 text-[11px]">
                    <span>PITCH (FREQ)</span>
                    <span className="text-stone-200 font-bold">{Math.round(p.pitch)} Hz</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max={voice === 'hihat' ? 120 : 350}
                    value={p.pitch}
                    onChange={(e) => updateDrum(voice, 'pitch', Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
                  />
                </div>

                {/* Decay */}
                <div className="space-y-1">
                  <div className="flex justify-between text-stone-400 text-[11px]">
                    <span>DECAY TIME</span>
                    <span className="text-stone-200 font-bold">{p.decay.toFixed(2)}s</span>
                  </div>
                  <input
                    type="range"
                    min="0.03"
                    max="1.5"
                    step="0.01"
                    value={p.decay}
                    onChange={(e) => updateDrum(voice, 'decay', Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
                  />
                </div>

                {/* Tone */}
                <div className="space-y-1">
                  <div className="flex justify-between text-stone-400 text-[11px]">
                    <span>TONE / BRIGHTNESS</span>
                    <span className="text-stone-200 font-bold">{Math.round(p.tone * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={p.tone}
                    onChange={(e) => updateDrum(voice, 'tone', Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
                  />
                </div>

                {/* Drive */}
                <div className="space-y-1">
                  <div className="flex justify-between text-stone-400 text-[11px]">
                    <span>PUNCH / DRIVE</span>
                    <span className="text-stone-200 font-bold">{Math.round(p.drive * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={p.drive}
                    onChange={(e) => updateDrum(voice, 'drive', Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. AMBIENT SYNTHESIS TAB */}
      {activeTab === 'ambient' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
          
          {/* Harmonic & Pitch Tuning */}
          <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-stone-200 uppercase tracking-wider border-b border-stone-800 pb-2">
              Harmonic Framework
            </h3>

            <div className="space-y-1">
              <label className="text-stone-400 text-[11px] block">MUSICAL SCALE</label>
              <select
                value={state.ambientParams.scale}
                onChange={(e) => updateAmbient('scale', e.target.value as MusicalScale)}
                className="w-full bg-stone-900 border border-stone-800 rounded px-2.5 py-1.5 text-emerald-300 capitalize focus:outline-none focus:border-emerald-500"
              >
                {scales.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-stone-400 text-[11px]">
                <span>ROOT MIDI NOTE</span>
                <span className="text-stone-200 font-bold">{state.ambientParams.rootNote}</span>
              </div>
              <input
                type="range"
                min="24"
                max="60"
                value={state.ambientParams.rootNote}
                onChange={(e) => updateAmbient('rootNote', Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-stone-400 text-[11px]">
                <span>DETUNE SPREAD (CENTS)</span>
                <span className="text-stone-200 font-bold">{state.ambientParams.detuneSpread}¢</span>
              </div>
              <input
                type="range"
                min="0"
                max="45"
                value={state.ambientParams.detuneSpread}
                onChange={(e) => updateAmbient('detuneSpread', Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-stone-400 text-[11px]">
                <span>ANALOG DRIFT / WANDER</span>
                <span className="text-stone-200 font-bold">
                  {Math.round(state.ambientParams.driftAmount * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={state.ambientParams.driftAmount}
                onChange={(e) => updateAmbient('driftAmount', Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
              />
            </div>
          </div>

          {/* Filter Section */}
          <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-stone-200 uppercase tracking-wider border-b border-stone-800 pb-2">
              Resonant Lowpass Filter
            </h3>

            <div className="space-y-1">
              <div className="flex justify-between text-stone-400 text-[11px]">
                <span>CUTOFF FREQUENCY</span>
                <span className="text-stone-200 font-bold">
                  {Math.round(state.ambientParams.filterCutoff)} Hz
                </span>
              </div>
              <input
                type="range"
                min="60"
                max="12000"
                value={state.ambientParams.filterCutoff}
                onChange={(e) => updateAmbient('filterCutoff', Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-stone-400 text-[11px]">
                <span>RESONANCE (Q)</span>
                <span className="text-stone-200 font-bold">{state.ambientParams.filterResonance.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="12"
                step="0.2"
                value={state.ambientParams.filterResonance}
                onChange={(e) => updateAmbient('filterResonance', Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-stone-400 text-[11px]">
                <span>ENV MODULATION AMOUNT</span>
                <span className="text-stone-200 font-bold">
                  {Math.round(state.ambientParams.filterEnvAmount * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={state.ambientParams.filterEnvAmount}
                onChange={(e) => updateAmbient('filterEnvAmount', Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-stone-400 text-[11px]">
                <span>SUB-BASS OSC LEVEL</span>
                <span className="text-stone-200 font-bold">
                  {Math.round(state.ambientParams.subLevel * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={state.ambientParams.subLevel}
                onChange={(e) => updateAmbient('subLevel', Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
              />
            </div>
          </div>

          {/* ADSR Amplitude Envelope */}
          <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-stone-200 uppercase tracking-wider border-b border-stone-800 pb-2">
              ADSR Envelope
            </h3>

            <div className="space-y-1">
              <div className="flex justify-between text-stone-400 text-[11px]">
                <span>ATTACK (SLOW FADE-IN)</span>
                <span className="text-stone-200 font-bold">{state.ambientParams.attack.toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="6.0"
                step="0.05"
                value={state.ambientParams.attack}
                onChange={(e) => updateAmbient('attack', Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-stone-400 text-[11px]">
                <span>SUSTAIN LEVEL</span>
                <span className="text-stone-200 font-bold">
                  {Math.round(state.ambientParams.sustain * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={state.ambientParams.sustain}
                onChange={(e) => updateAmbient('sustain', Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-stone-400 text-[11px]">
                <span>RELEASE TAIL</span>
                <span className="text-stone-200 font-bold">{state.ambientParams.release.toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="10.0"
                step="0.1"
                value={state.ambientParams.release}
                onChange={(e) => updateAmbient('release', Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
              />
            </div>
          </div>

        </div>
      )}

      {/* 3. EFFECTS RACK TAB */}
      {activeTab === 'effects' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
          {/* Stereo Ping Pong Delay */}
          <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-stone-200 uppercase tracking-wider border-b border-stone-800 pb-2">
              Stereo Ping-Pong Tape Delay
            </h3>

            <div className="space-y-1">
              <div className="flex justify-between text-stone-400 text-[11px]">
                <span>DELAY TIME</span>
                <span className="text-stone-200 font-bold">{state.effectsParams.delayTime.toFixed(3)}s</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.2"
                step="0.01"
                value={state.effectsParams.delayTime}
                onChange={(e) => updateEffects('delayTime', Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-stone-400 text-[11px]">
                <span>DELAY FEEDBACK</span>
                <span className="text-stone-200 font-bold">
                  {Math.round(state.effectsParams.delayFeedback * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.9"
                step="0.02"
                value={state.effectsParams.delayFeedback}
                onChange={(e) => updateEffects('delayFeedback', Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-stone-400 text-[11px]">
                <span>WET MIX</span>
                <span className="text-stone-200 font-bold">
                  {Math.round(state.effectsParams.delayMix * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={state.effectsParams.delayMix}
                onChange={(e) => updateEffects('delayMix', Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-stone-400 text-[11px]">
                <span>TAPE FLUTTER / DRIFT</span>
                <span className="text-stone-200 font-bold">
                  {Math.round(state.effectsParams.delayFlutter * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={state.effectsParams.delayFlutter}
                onChange={(e) => updateEffects('delayFlutter', Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
              />
            </div>
          </div>

          {/* Diffusion Reverb */}
          <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-stone-200 uppercase tracking-wider border-b border-stone-800 pb-2">
              Algorithmic Diffusion Reverb
            </h3>

            <div className="space-y-1">
              <div className="flex justify-between text-stone-400 text-[11px]">
                <span>REVERB DECAY TIME</span>
                <span className="text-stone-200 font-bold">{state.effectsParams.reverbDecay.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="12.0"
                step="0.2"
                value={state.effectsParams.reverbDecay}
                onChange={(e) => updateEffects('reverbDecay', Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-stone-400 text-[11px]">
                <span>WET MIX</span>
                <span className="text-stone-200 font-bold">
                  {Math.round(state.effectsParams.reverbMix * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={state.effectsParams.reverbMix}
                onChange={(e) => updateEffects('reverbMix', Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-stone-400 text-[11px]">
                <span>MASTER ANALOG WARMTH / DRIVE</span>
                <span className="text-stone-200 font-bold">
                  {Math.round(state.effectsParams.masterDrive * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={state.effectsParams.masterDrive}
                onChange={(e) => updateEffects('masterDrive', Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. MODULATION MATRIX TAB */}
      {activeTab === 'modulation' && (
        <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-5 space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2">
            <h3 className="font-bold text-stone-200 uppercase tracking-wider">
              Cross-Engine Inter-Modulation Matrix
            </h3>
            <span className="text-stone-400 text-[11px]">4 Active Dynamic Routes</span>
          </div>

          <div className="space-y-3">
            {state.modRoutes.map((route) => (
              <div
                key={route.id}
                className="flex flex-wrap items-center justify-between gap-4 p-3 bg-stone-900/60 border border-stone-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={route.enabled}
                    onChange={(e) => {
                      route.enabled = e.target.checked;
                      engine.modMatrix.updateRoute(route.id, { enabled: route.enabled });
                      engine.mutate(0);
                    }}
                    className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-emerald-400 font-bold">{route.source}</span>
                    <span className="text-stone-500 mx-2">──►</span>
                    <span className="text-cyan-400 font-bold">{route.destination}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 min-w-[200px]">
                  <span className="text-stone-400 text-[11px]">DEPTH:</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={route.depth}
                    onChange={(e) => {
                      route.depth = Number(e.target.value);
                      engine.modMatrix.updateRoute(route.id, { depth: route.depth });
                      engine.mutate(0);
                    }}
                    className="w-28 accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
                  />
                  <span className="text-stone-200 w-10 text-right font-bold">
                    {Math.round(route.depth * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. MUTATION BOUNDARIES TAB */}
      {activeTab === 'boundaries' && (
        <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-5 space-y-4 font-mono text-xs">
          <div className="border-b border-stone-800 pb-2">
            <h3 className="font-bold text-stone-200 uppercase tracking-wider">
              Layer Mutation Boundaries & Constraints
            </h3>
            <p className="text-stone-400 text-[11px] mt-1">
              Define the exploratory boundaries of randomness. Parameters mutate only within permitted ranges.
            </p>
          </div>

          <div className="space-y-4">
            {state.layers.map((layer) => (
              <div key={layer.id} className="p-4 bg-stone-900/60 border border-stone-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-100 uppercase">{layer.name} Boundaries</span>
                  <span className="text-[10px] text-stone-400 capitalize">{layer.algorithmType}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Object.entries(layer.boundaries).map(([paramName, b]) => (
                    <div key={paramName} className="p-3 bg-stone-950 rounded border border-stone-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-emerald-400 font-bold uppercase text-[10px]">{paramName}</span>
                        <label className="flex items-center gap-1 text-[10px] text-stone-400">
                          <input
                            type="checkbox"
                            checked={b.allowMutation}
                            onChange={(e) => {
                              b.allowMutation = e.target.checked;
                              engine.mutate(0);
                            }}
                            className="accent-emerald-500"
                          />
                          Allow
                        </label>
                      </div>

                      <div className="flex justify-between text-[10px] text-stone-400">
                        <span>Range: [{b.min} — {b.max}]</span>
                        <span>Prob: {Math.round(b.mutationProbability * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
