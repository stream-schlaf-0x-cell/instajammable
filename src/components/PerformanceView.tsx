// Performance View: Customizable Macro Controls & Layer Channel Strips

import React from 'react';
import {
  Volume2,
  Lock,
  Unlock,
  Snowflake,
  RotateCcw,
  Sparkles,
  Sliders,
  Radio,
  Undo2,
  Redo2,
} from 'lucide-react';
import { ProjectState } from '../types';
import { EngineFacade } from '../engine/engineFacade';
import { Visualizer } from './Visualizer';

interface PerformanceViewProps {
  state: ProjectState;
  currentStep: number;
}

export const PerformanceView: React.FC<PerformanceViewProps> = ({ state, currentStep }) => {
  const engine = EngineFacade.getInstance();

  return (
    <div className="space-y-6">
      
      {/* Visualizer Banner */}
      <Visualizer currentStep={currentStep} bpm={state.bpm} />

      {/* Customizable Macro Knobs Section */}
      <div className="bg-stone-900/40 border border-stone-800/80 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold tracking-wider text-stone-200 uppercase font-mono">
              PERFORMANCE MACRO CONTROL MATRIX
            </h2>
          </div>
          <span className="text-[11px] font-mono text-stone-400">
            Multi-parameter mapped expressions
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {state.macros.map((macro) => (
            <div
              key={macro.id}
              className="bg-stone-950/70 border border-stone-800/90 rounded-xl p-4 flex flex-col justify-between hover:border-emerald-500/40 transition-all shadow-inner group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-stone-200 uppercase font-mono">
                  {macro.name}
                </span>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {Math.round(macro.value * 100)}%
                </span>
              </div>

              {/* Smooth Macro Slider */}
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={macro.value}
                onChange={(e) => engine.setMacroValue(macro.id, Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-2 bg-stone-800 rounded-lg"
              />

              {/* Mapped Targets details */}
              <div className="mt-3 pt-2 border-t border-stone-900 text-[10px] font-mono text-stone-400 flex flex-col gap-0.5">
                {macro.mappings.map((m, idx) => (
                  <span key={idx} className="truncate">
                    • {m.target} ({Math.round(m.min)} → {Math.round(m.max)})
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Layer Strips & Quick Controls */}
      <div className="bg-stone-900/40 border border-stone-800/80 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold tracking-wider text-stone-200 uppercase font-mono">
              GENERATIVE LAYER MATRIX & CHANNEL STRIPS
            </h2>
          </div>

          {/* Quick Undo / Redo / Re-roll */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => engine.undo()}
              className="px-2.5 py-1 bg-stone-950 border border-stone-800 text-stone-400 hover:text-stone-100 rounded-lg text-xs font-mono flex items-center gap-1 transition-all"
              title="Undo last mutation"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo
            </button>
            <button
              onClick={() => engine.redo()}
              className="px-2.5 py-1 bg-stone-950 border border-stone-800 text-stone-400 hover:text-stone-100 rounded-lg text-xs font-mono flex items-center gap-1 transition-all"
              title="Redo mutation"
            >
              <Redo2 className="w-3.5 h-3.5" />
              Redo
            </button>
            <button
              onClick={() => engine.regenerate()}
              className="px-2.5 py-1 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50 rounded-lg text-xs font-mono flex items-center gap-1 transition-all"
              title="Regenerate all layers with new algorithmic seeds"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Regenerate All
            </button>
          </div>
        </div>

        {/* Strips List */}
        <div className="space-y-3">
          {state.layers.map((layer) => {
            const isFlashing = currentStep % 4 === 0 && !layer.muted;

            return (
              <div
                key={layer.id}
                className={`flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border transition-all ${
                  layer.muted
                    ? 'bg-stone-950/40 border-stone-900 opacity-60'
                    : 'bg-stone-950/80 border-stone-800 hover:border-stone-700'
                }`}
              >
                {/* Voice Identity */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div
                    className={`w-3 h-3 rounded-full transition-all ${
                      layer.muted
                        ? 'bg-stone-800'
                        : isFlashing
                        ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                        : 'bg-emerald-600'
                    }`}
                  ></div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-stone-100 uppercase tracking-wide">
                        {layer.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-400">
                        CH {layer.midiChannel}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400/90 capitalize">
                      {layer.algorithmType}
                    </span>
                  </div>
                </div>

                {/* Layer Volume Slider */}
                <div className="flex items-center gap-2 min-w-[150px]">
                  <Volume2 className="w-3.5 h-3.5 text-stone-500" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={layer.volume}
                    onChange={(e) => {
                      layer.volume = Number(e.target.value);
                      engine.mutate(0); // trigger update
                    }}
                    className="w-24 accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded"
                  />
                  <span className="text-[10px] font-mono text-stone-400 w-8 text-right">
                    {Math.round(layer.volume * 100)}%
                  </span>
                </div>

                {/* Layer Control Buttons (Mute, Solo, Freeze, Lock, Mutate) */}
                <div className="flex items-center gap-1.5">
                  {/* Mute */}
                  <button
                    onClick={() => engine.toggleLayerMute(layer.id)}
                    className={`w-8 h-8 rounded-lg font-mono text-xs font-bold transition-all border ${
                      layer.muted
                        ? 'bg-red-950/60 border-red-800 text-red-300'
                        : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                    title="Mute Layer"
                  >
                    M
                  </button>

                  {/* Solo */}
                  <button
                    onClick={() => engine.toggleLayerSolo(layer.id)}
                    className={`w-8 h-8 rounded-lg font-mono text-xs font-bold transition-all border ${
                      layer.solo
                        ? 'bg-amber-500 text-stone-950 border-amber-600 font-extrabold shadow-md'
                        : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                    title="Solo Layer"
                  >
                    S
                  </button>

                  {/* Freeze */}
                  <button
                    onClick={() => engine.toggleLayerFreeze(layer.id)}
                    className={`p-2 rounded-lg transition-all border ${
                      layer.frozen
                        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                        : 'bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300'
                    }`}
                    title={layer.frozen ? 'Layer Frozen (Protected from changes)' : 'Freeze Layer'}
                  >
                    <Snowflake className="w-3.5 h-3.5" />
                  </button>

                  {/* Lock */}
                  <button
                    onClick={() => engine.toggleLayerLock(layer.id)}
                    className={`p-2 rounded-lg transition-all border ${
                      layer.locked
                        ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                        : 'bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300'
                    }`}
                    title={layer.locked ? 'Layer Locked' : 'Lock Layer Parameters'}
                  >
                    {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>

                  {/* Regenerate this layer */}
                  <button
                    onClick={() => engine.regenerateLayer(layer.id)}
                    className="p-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-emerald-400 hover:border-emerald-500/40 transition-all"
                    title="Regenerate this specific layer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
