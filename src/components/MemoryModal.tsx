// Musical Memory System: Presets, Branch History & MIDI File Exporter

import React, { useState } from 'react';
import { X, Download, Bookmark, GitBranch } from 'lucide-react';
import { EngineFacade } from '../engine/engineFacade';
import { DEFAULT_PRESETS } from '../engine/presets/defaultPresets';
import { MidiFileWriter } from '../engine/midi/midiWriter';

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({ isOpen, onClose }) => {
  const engine = EngineFacade.getInstance();
  const [activeTab, setActiveTab] = useState<'presets' | 'history' | 'export'>('presets');
  const [saveName, setSaveName] = useState('');

  if (!isOpen) return null;

  const historyNodes = engine.historyManager.getAllNodes();
  const currentNodeId = engine.historyManager.getCurrentNodeId();

  const handleExportMultitrackMidi = () => {
    const midiBytes = engine.exportMidiFile();
    MidiFileWriter.downloadMidi(midiBytes, `echo-garden-multitrack-${Date.now()}.mid`);
  };

  const handleExportLayerMidi = (layerId: string, layerName: string) => {
    const midiBytes = engine.exportMidiFile(layerId);
    MidiFileWriter.downloadMidi(midiBytes, `echo-garden-${layerName.toLowerCase().replace(/\s+/g, '-')}.mid`);
  };

  const handleSaveState = () => {
    if (!saveName.trim()) return;
    engine.historyManager.pushState(saveName.trim(), engine.state);
    setSaveName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-100 uppercase font-mono">
                MUSICAL MEMORY & MIDI CAPTURE
              </h2>
              <p className="text-xs font-mono text-stone-400">
                Preserve discoveries, recall states, and export standard MIDI files (.mid) for Ableton
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-stone-800 pb-3 font-mono text-xs">
          <button
            onClick={() => setActiveTab('presets')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'presets' ? 'bg-emerald-600 text-white font-bold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Curated Presets
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'history' ? 'bg-emerald-600 text-white font-bold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Evolution History ({historyNodes.length})
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'export' ? 'bg-emerald-600 text-white font-bold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Standard MIDI File Export
          </button>
        </div>

        {/* 1. CURATED PRESETS */}
        {activeTab === 'presets' && (
          <div className="space-y-4 font-mono text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {DEFAULT_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className="bg-stone-950/70 border border-stone-800 rounded-xl p-4 flex flex-col justify-between hover:border-emerald-500/40 transition-all space-y-3"
                >
                  <div>
                    <h3 className="font-bold text-stone-200 text-sm">{preset.name}</h3>
                    <p className="text-[11px] text-stone-500 mt-1">
                      {preset.bpm} BPM · {preset.layers.length} Layers · {preset.ambientParams.scale}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      engine.loadPreset(preset);
                      onClose();
                    }}
                    className="w-full py-2 bg-stone-800 hover:bg-emerald-600 hover:text-white text-stone-200 rounded-lg text-xs font-bold transition-all"
                  >
                    Load Preset
                  </button>
                </div>
              ))}
            </div>

            {/* Save current state as named snapshot */}
            <div className="mt-4 pt-4 border-t border-stone-800 flex gap-2">
              <input
                type="text"
                placeholder="Name snapshot (e.g. 20min Ambient Discovery)..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="flex-1 bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-stone-200 placeholder-stone-600 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleSaveState}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-all"
              >
                Snapshot State
              </button>
            </div>
          </div>
        )}

        {/* 2. EVOLUTION HISTORY TREE */}
        {activeTab === 'history' && (
          <div className="space-y-3 font-mono text-xs max-h-[50vh] overflow-y-auto">
            <p className="text-stone-400 text-[11px]">
              Every generative mutation and parameter transformation is captured here. Click any node to restore that exact state.
            </p>

            <div className="space-y-2">
              {historyNodes.map((node, idx) => {
                const isCurrent = node.id === currentNodeId;
                const timeStr = new Date(node.timestamp).toLocaleTimeString();

                return (
                  <div
                    key={node.id}
                    onClick={() => {
                      const restored = engine.historyManager.jumpToNode(node.id);
                      if (restored) {
                        engine.state = restored;
                        engine.rebuildGenerators();
                      }
                    }}
                    className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-stone-950 border-stone-800/80 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <GitBranch className="w-3.5 h-3.5 text-stone-500" />
                      <span>
                        #{idx + 1} {node.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-stone-500 text-[11px]">
                      <span>{timeStr}</span>
                      {isCurrent && <span className="text-emerald-400 font-bold">CURRENT</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. STANDARD MIDI FILE EXPORT */}
        {activeTab === 'export' && (
          <div className="space-y-4 font-mono text-xs">
            <div className="p-4 bg-stone-950/80 border border-stone-800 rounded-xl space-y-2">
              <span className="font-bold text-stone-200 text-sm">Full Multitrack Session (.mid)</span>
              <p className="text-stone-400 text-[11px] leading-relaxed">
                Exports all active drum voices and ambient harmonic notes as a Type 1 Multitrack Standard MIDI file with accurate tempo, note length, and velocity metadata. Ready for drag & drop into Ableton Live 12.
              </p>
              <button
                onClick={handleExportMultitrackMidi}
                className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-2 transition-all shadow-md"
              >
                <Download className="w-4 h-4" />
                Download Multitrack MIDI (.mid)
              </button>
            </div>

            {/* Individual stems */}
            <div className="space-y-2">
              <span className="text-stone-400 text-[11px] uppercase tracking-wider block">
                Export Individual Layer Stems:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {engine.state.layers.map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => handleExportLayerMidi(layer.id, layer.name)}
                    className="p-3 bg-stone-950 border border-stone-800 hover:border-stone-700 rounded-lg flex items-center justify-between text-stone-300 hover:text-white transition-all"
                  >
                    <span>{layer.name} (.mid)</span>
                    <Download className="w-3.5 h-3.5 text-stone-500" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
