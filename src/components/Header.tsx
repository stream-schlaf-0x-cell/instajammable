// Header Bar: Transport, Master Mutations, Views, MIDI & Recording

import React, { useState, useEffect } from 'react';
import {
  Play,
  Square,
  Sparkles,
  RefreshCw,
  AlertOctagon,
  Mic,
  Disc3,
  Sliders,
  Cpu,
  Bookmark,
  HelpCircle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { EngineView, ProjectState } from '../types';
import { EngineFacade } from '../engine/engineFacade';
import { MidiDeviceOption } from '../engine/midi/webMidi';

interface HeaderProps {
  currentView: EngineView;
  onViewChange: (view: EngineView) => void;
  state: ProjectState;
  onOpenAbletonGuide: () => void;
  onOpenMemoryModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  state,
  onOpenAbletonGuide,
  onOpenMemoryModal,
}) => {
  const engine = EngineFacade.getInstance();
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordDuration, setRecordDuration] = useState<number>(0);
  const [midiDevices, setMidiDevices] = useState<MidiDeviceOption[]>([]);
  const [selectedMidiId, setSelectedMidiId] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  useEffect(() => {
    // Check initial play state
    setIsPlaying(engine.clock ? engine.clock.getIsRunning() : false);

    // Watch MIDI devices
    engine.midiManager.setCallbacks((devices) => {
      setMidiDevices([...devices]);
      const selId = engine.midiManager.getSelectedOutputId();
      if (selId) setSelectedMidiId(selId);
    });
    setMidiDevices(engine.midiManager.getAvailableOutputs());
    const initialSel = engine.midiManager.getSelectedOutputId();
    if (initialSel) setSelectedMidiId(initialSel);

    // Watch Audio Recording
    if (engine.recorder) {
      engine.recorder.setCallback((rec, duration) => {
        setIsRecording(rec);
        setRecordDuration(duration);
      });
    }
  }, []);

  const handleTogglePlay = async () => {
    await engine.init();
    const playing = engine.togglePlay();
    setIsPlaying(playing);
  };

  const handleStop = () => {
    engine.stop();
    setIsPlaying(false);
  };

  const handleMidiSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedMidiId(id);
    engine.midiManager.selectOutput(id);
  };

  const handleToggleRecord = async () => {
    await engine.init();
    if (isRecording) {
      const blob = await engine.recorder.stop();
      if (blob) {
        engine.recorder.downloadRecording(blob, `echo-garden-${Date.now()}.webm`);
      }
    } else {
      engine.recorder.start();
    }
  };

  const handleToggleMute = () => {
    const muted = engine.masterAudio.toggleMute();
    setIsMuted(muted);
  };

  return (
    <header className="border-b border-stone-800 bg-stone-950/90 backdrop-blur-lg sticky top-0 z-30 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-lg shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            EG
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-wide text-stone-100 uppercase">ECHO GARDEN</h1>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                v1.0 Lab
              </span>
            </div>
            <p className="text-[11px] font-mono text-stone-400">Autonomous Generative Music Laboratory</p>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-stone-900/90 p-1 rounded-lg border border-stone-800 text-xs font-mono">
          <button
            onClick={() => onViewChange('performance')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              currentView === 'performance'
                ? 'bg-emerald-600 text-white font-medium shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Performance
          </button>
          <button
            onClick={() => onViewChange('deepEdit')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              currentView === 'deepEdit'
                ? 'bg-emerald-600 text-white font-medium shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Deep Edit
          </button>
          <button
            onClick={() => onViewChange('playground')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              currentView === 'playground'
                ? 'bg-emerald-600 text-white font-medium shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Disc3 className="w-3.5 h-3.5" />
            Playground
          </button>
        </div>

        {/* Transport & Tempo */}
        <div className="flex items-center gap-2 bg-stone-900/80 px-3 py-1.5 rounded-lg border border-stone-800">
          <button
            onClick={handleTogglePlay}
            className={`p-2 rounded-md transition-all ${
              isPlaying
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-500 text-stone-950 font-bold hover:bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
            }`}
            title={isPlaying ? 'Pause' : 'Start Engine'}
          >
            <Play className={`w-4 h-4 ${isPlaying ? 'fill-amber-300' : 'fill-stone-950'}`} />
          </button>

          <button
            onClick={handleStop}
            className="p-2 rounded-md bg-stone-800/80 text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-all"
            title="Stop & Reset to Step 1"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>

          <div className="h-6 w-px bg-stone-800 mx-1"></div>

          {/* BPM */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-stone-500 uppercase text-[10px]">BPM</span>
            <input
              type="number"
              min="30"
              max="240"
              value={state.bpm}
              onChange={(e) => engine.setBpm(Number(e.target.value))}
              className="w-14 bg-stone-950 border border-stone-800 rounded px-1.5 py-0.5 text-center text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Swing */}
          <div className="flex items-center gap-1.5 font-mono text-xs ml-1">
            <span className="text-stone-500 uppercase text-[10px]">SWG</span>
            <input
              type="range"
              min="0"
              max="0.75"
              step="0.05"
              value={state.swing}
              onChange={(e) => engine.setSwing(Number(e.target.value))}
              className="w-16 accent-emerald-500 cursor-pointer"
              title={`Swing: ${Math.round(state.swing * 100)}%`}
            />
            <span className="text-[10px] text-stone-400 w-6 text-right">
              {Math.round(state.swing * 100)}%
            </span>
          </div>

          <button
            onClick={handleToggleMute}
            className={`p-1.5 rounded transition-all ${
              isMuted ? 'text-red-400 bg-red-950/40 border border-red-800' : 'text-stone-400 hover:text-stone-200'
            }`}
            title="Mute Master Output"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Generative Mutation Controls */}
        <div className="flex items-center gap-2">
          {/* Mutate Now */}
          <button
            onClick={() => engine.mutate(0.4)}
            className="px-3 py-1.5 bg-purple-950/40 border border-purple-500/40 text-purple-300 hover:bg-purple-900/50 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all hover:scale-[1.02]"
            title="Mutate unlocked parameters within defined boundaries"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Mutate
          </button>

          {/* Evolve Toggle */}
          <button
            onClick={() => {
              engine.state.globalEvolveActive = !engine.state.globalEvolveActive;
              engine.mutate(0.1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 border transition-all ${
              state.globalEvolveActive
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 animate-pulse'
                : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
            }`}
            title="Continuously evolve system every 2 bars"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${state.globalEvolveActive ? 'animate-spin' : ''}`} />
            Evolve {state.globalEvolveActive ? 'ON' : 'OFF'}
          </button>

          {/* Emergency Panic */}
          <button
            onClick={() => engine.midiManager.emergencyPanic()}
            className="p-1.5 rounded-lg bg-red-950/30 border border-red-800/40 text-red-400 hover:bg-red-900/40 transition-all"
            title="Emergency Panic: All Notes Off & All Sound Off"
          >
            <AlertOctagon className="w-4 h-4" />
          </button>
        </div>

        {/* Integration, Memory & Recording */}
        <div className="flex items-center gap-2">
          {/* Web MIDI Output Selector */}
          <div className="flex items-center gap-1 bg-stone-900 px-2 py-1 rounded-lg border border-stone-800 text-xs font-mono">
            <span className="text-[10px] text-stone-500 uppercase">MIDI:</span>
            <select
              value={selectedMidiId}
              onChange={handleMidiSelect}
              className="bg-transparent text-stone-300 text-xs focus:outline-none max-w-[130px] truncate"
            >
              {midiDevices.length === 0 ? (
                <option value="">No MIDI Ports</option>
              ) : (
                midiDevices.map((d) => (
                  <option key={d.id} value={d.id} className="bg-stone-900 text-stone-100">
                    {d.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Audio Record Button */}
          <button
            onClick={handleToggleRecord}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 border transition-all ${
              isRecording
                ? 'bg-red-500 text-white border-red-600 animate-pulse font-bold'
                : 'bg-stone-900 border-stone-800 text-stone-300 hover:text-white'
            }`}
            title={isRecording ? 'Stop & Download Recording' : 'Record Session to Audio File'}
          >
            <Mic className="w-3.5 h-3.5" />
            {isRecording ? `${Math.floor(recordDuration / 60)}:${(recordDuration % 60).toString().padStart(2, '0')}` : 'Rec'}
          </button>

          {/* Memory / Presets */}
          <button
            onClick={onOpenMemoryModal}
            className="p-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700 transition-all"
            title="Musical Memory, Presets & MIDI Export"
          >
            <Bookmark className="w-4 h-4" />
          </button>

          {/* Ableton Guide Modal */}
          <button
            onClick={onOpenAbletonGuide}
            className="p-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700 transition-all"
            title="Ableton Live 12 & Hardware Setup Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
