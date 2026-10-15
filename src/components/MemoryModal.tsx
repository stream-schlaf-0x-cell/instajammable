// Musical Memory System: Presets, Branch History, WAV & MIDI Capture

import React, { useState, useEffect } from 'react';
import { X, Download, Bookmark, GitBranch, Radio, Check, Disc } from 'lucide-react';
import { EngineFacade } from '../engine/engineFacade';
import { DEFAULT_PRESETS } from '../engine/presets/defaultPresets';
import { MidiFileWriter } from '../engine/midi/midiWriter';
import { RecorderState } from '../engine/audio/recorder';

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({ isOpen, onClose }) => {
  const engine = EngineFacade.getInstance();
  const [activeTab, setActiveTab] = useState<'presets' | 'history' | 'export'>('export');
  const [saveName, setSaveName] = useState('');
  const [barRange, setBarRange] = useState<number | undefined>(undefined); // undefined = all
  const [recorderState, setRecorderState] = useState<RecorderState>(engine.recorder.getState());
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  useEffect(() => {
    const unsub = engine.recorder.subscribe((st) => setRecorderState(st));
    return () => unsub();
  }, [engine]);

  if (!isOpen) return null;

  const historyNodes = engine.historyManager.getAllNodes();
  const currentNodeId = engine.historyManager.getCurrentNodeId();
  const capturedEvents = engine.getCapturedEvents();
  const totalCapturedBars = capturedEvents.length > 0 
    ? Math.max(1, Math.max(...capturedEvents.map((e) => e.bar)) - Math.min(...capturedEvents.map((e) => e.bar)) + 1)
    : 0;

  const showNotification = (msg: string) => {
    setDownloadNotice(msg);
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  const handleExportMultitrackMidi = () => {
    const midiBytes = engine.exportMidiFile(undefined, barRange);
    const rangeSuffix = barRange ? `-${barRange}bars` : '-full';
    MidiFileWriter.downloadMidi(midiBytes, `echo-garden-session${rangeSuffix}-${Date.now()}.mid`);
    showNotification('Exported Multitrack Type 1 MIDI with common origin alignment');
  };

  const handleExportLayerMidi = (layerId: string, layerName: string) => {
    const midiBytes = engine.exportMidiFile(layerId, barRange);
    const rangeSuffix = barRange ? `-${barRange}bars` : '';
    const safeName = layerName.toLowerCase().replace(/\s+/g, '-');
    MidiFileWriter.downloadMidi(midiBytes, `echo-garden-${safeName}${rangeSuffix}.mid`);
    showNotification(`Exported ${layerName} stem`);
  };

  const handleToggleRecord = async () => {
    if (recorderState.isRecording) {
      const { wavBytes } = await engine.recorder.stop();
      if (wavBytes) {
        const blob = new Blob([wavBytes as any], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `echo-garden-live-take-${Date.now()}.wav`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification('Downloaded 16-bit Linear PCM Master WAV');
      }
    } else {
      if (!engine.isAudioInitialized) {
        await engine.init(false);
      }
      engine.recorder.start();
      showNotification('Recording started (16-bit linear PCM)');
    }
  };

  const handleSaveState = () => {
    if (!saveName.trim()) return;
    engine.historyManager.pushState(saveName.trim(), engine.state);
    setSaveName('');
    showNotification(`Saved snapshot: "${saveName.trim()}"`);
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
                MUSICAL MEMORY & STEM EXPORTER
              </h2>
              <p className="text-xs font-mono text-stone-400">
                Common-origin Multitrack MIDI (.mid), 16-bit Linear PCM WAV, and state recall
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
            onClick={() => setActiveTab('export')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'export' ? 'bg-emerald-600 text-white font-bold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            MIDI & Audio Capture
          </button>
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
        </div>

        {/* Notification Toast */}
        {downloadNotice && (
          <div className="bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 font-mono text-xs px-3.5 py-2 rounded-lg flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            {downloadNotice}
          </div>
        )}

        {/* 1. MIDI & AUDIO EXPORT TAB */}
        {activeTab === 'export' && (
          <div className="space-y-5 font-mono text-xs">
            
            {/* Capture Telemetry & Range Selector */}
            <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-stone-200 uppercase tracking-wider">
                  CAPTURE SESSION BUFFER: {capturedEvents.length} EVENTS ({totalCapturedBars} BARS)
                </span>
                <button
                  onClick={() => {
                    engine.clearCapture();
                    showNotification('Capture buffer cleared for fresh take');
                  }}
                  className="text-[10px] text-stone-500 hover:text-stone-300 underline"
                >
                  Clear Buffer
                </button>
              </div>

              {/* Bar Range Picker */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-stone-400 text-[11px]">EXPORT RANGE:</span>
                <div className="flex gap-1.5">
                  {[
                    { label: 'All Takes', val: undefined },
                    { label: 'Last 4 Bars', val: 4 },
                    { label: 'Last 8 Bars', val: 8 },
                    { label: 'Last 16 Bars', val: 16 },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setBarRange(opt.val)}
                      className={`px-2.5 py-1 rounded text-[11px] transition-all border ${
                        barRange === opt.val
                          ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold'
                          : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Multitrack Type 1 MIDI File */}
            <div className="p-4 bg-stone-950/80 border border-stone-800 rounded-xl space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-bold text-stone-200 text-sm">Full Multitrack Session (.mid)</span>
                  <p className="text-stone-400 text-[11px] leading-relaxed mt-1">
                    Standard MIDI File Type 1 with dedicated tempo track and synchronized tracks for all active layers. Aligned to tick 0 common origin with preserved swing and microtiming.
                  </p>
                </div>
                <button
                  onClick={handleExportMultitrackMidi}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-2 transition-all shadow-md shrink-0 ml-4"
                >
                  <Download className="w-4 h-4" />
                  Download Multitrack MIDI
                </button>
              </div>
            </div>

            {/* Individual Layer Stems (.mid) */}
            <div className="space-y-2">
              <span className="text-stone-400 text-[11px] uppercase tracking-wider block">
                Export Isolated Layer Stems (.mid):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {engine.state.layers.map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => handleExportLayerMidi(layer.id, layer.name)}
                    className="p-3 bg-stone-950 border border-stone-800 hover:border-stone-700 rounded-lg flex items-center justify-between text-stone-300 hover:text-white transition-all text-left"
                  >
                    <div>
                      <span className="font-bold block">{layer.name}</span>
                      <span className="text-[10px] text-stone-500">Ch {layer.midiChannel} · {layer.algorithmType}</span>
                    </div>
                    <Download className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* 16-Bit Linear PCM WAV Master Capture */}
            <div className="p-4 bg-stone-950/80 border border-stone-800 rounded-xl flex items-center justify-between">
              <div>
                <span className="font-bold text-stone-200 text-sm flex items-center gap-2">
                  <Radio className={`w-4 h-4 ${recorderState.isRecording ? 'text-rose-500 animate-pulse' : 'text-stone-500'}`} />
                  16-Bit Linear PCM Audio Recording (WAV)
                </span>
                <p className="text-stone-400 text-[11px] mt-0.5">
                  Direct master bus recording. Uncompressed 44.1/48kHz 16-bit linear stereo PCM WAV.
                  {recorderState.isRecording && (
                    <span className="text-rose-400 ml-2 font-bold">
                      RECORDING IN PROGRESS ({recorderState.durationSec}s)
                    </span>
                  )}
                </p>
              </div>

              <button
                onClick={handleToggleRecord}
                className={`px-4 py-2 font-bold rounded-lg flex items-center gap-2 transition-all shadow-md shrink-0 ml-4 ${
                  recorderState.isRecording
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-stone-800 hover:bg-stone-700 text-emerald-300'
                }`}
              >
                <Disc className="w-4 h-4" />
                {recorderState.isRecording ? 'Stop & Download WAV' : 'Start WAV Recording'}
              </button>
            </div>

          </div>
        )}

        {/* 2. CURATED PRESETS */}
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
                      showNotification(`Loaded preset: ${preset.name}`);
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

        {/* 3. EVOLUTION HISTORY TREE */}
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
                        showNotification(`Restored: #${idx + 1} ${node.label}`);
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

      </div>
    </div>
  );
};
