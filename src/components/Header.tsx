// Header Bar: Transport, Unified Panic, Real-time Observability, Dual Audio Recording & MIDI Port Routing

import React, { useState, useEffect } from 'react';
import {
  Play,
  Square,
  Sparkles,
  RefreshCw,
  AlertOctagon,
  Mic,
  Sliders,
  Cpu,
  Bookmark,
  HelpCircle,
  Volume2,
  VolumeX,
  Disc3,
  X,
} from 'lucide-react';
import { EngineView, ProjectState } from '../types';
import { EngineFacade } from '../engine/engineFacade';
import { MidiDeviceOption } from '../engine/midi/webMidi';
import { RecorderState } from '../engine/audio/recorder';
import { WavEncoder } from '../engine/audio/wavEncoder';

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
  const [recorderState, setRecorderState] = useState<RecorderState>({
    isRecording: false,
    durationSec: 0,
    lastError: null,
    mimeType: '',
  });
  const [midiDevices, setMidiDevices] = useState<MidiDeviceOption[]>([]);
  const [selectedMidiId, setSelectedMidiId] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [midiStatus, setMidiStatus] = useState<string>('uninitialized');
  const [showFirefoxMidiModal, setShowFirefoxMidiModal] = useState<boolean>(false);
  const [testNotice, setTestNotice] = useState<string | null>(null);

  useEffect(() => {
    setIsPlaying(engine.clock ? engine.clock.getIsRunning() : false);

    // Eagerly subscribe to recorder state (always accessible, even prior to first Play click)
    const unsubRecorder = engine.recorder.subscribe((recState) => {
      setRecorderState(recState);
    });

    // MIDI Devices & Status callback
    engine.midiManager.setCallbacks(
      (devices) => {
        setMidiDevices([...devices]);
        const selId = engine.midiManager.getSelectedOutputId();
        if (selId) setSelectedMidiId(selId);
      },
      (status) => {
        setMidiStatus(status);
      }
    );

    setMidiDevices(engine.midiManager.getAvailableOutputs());
    const initialSel = engine.midiManager.getSelectedOutputId();
    if (initialSel) setSelectedMidiId(initialSel);
    setMidiStatus(engine.midiManager.getStatus());

    // Eagerly initialize Web MIDI permissions & port enumeration on load
    engine.midiManager.init().then(() => {
      setMidiDevices(engine.midiManager.getAvailableOutputs());
      const sel = engine.midiManager.getSelectedOutputId();
      if (sel) setSelectedMidiId(sel);
      setMidiStatus(engine.midiManager.getStatus());
    }).catch(() => {});

    return () => {
      unsubRecorder();
    };
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

  const handleUnifiedPanic = () => {
    engine.panic();
    setIsPlaying(false);
  };

  const handleMidiSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedMidiId(id);
    engine.midiManager.selectOutput(id);
  };

  const handleRefreshMidi = () => {
    engine.midiManager.init().then(() => {
      setMidiDevices(engine.midiManager.getAvailableOutputs());
      const sel = engine.midiManager.getSelectedOutputId();
      if (sel) setSelectedMidiId(sel);
      setMidiStatus(engine.midiManager.getStatus());
    }).catch(() => {});
  };

  const handleSendTest = () => {
    const res = engine.midiManager.sendTestNote();
    if (res.success) {
      setTestNotice(`✓ Test-Note an "${res.portName}" gesendet!`);
    } else {
      setTestNotice(`✗ ${res.error}`);
    }
    setTimeout(() => setTestNotice(null), 3000);
  };

  const handleToggleRecord = async () => {
    await engine.init();
    if (recorderState.isRecording) {
      const result = await engine.recorder.stop();
      if (result.wavBytes) {
        // Automatically download genuine 16-bit PCM WAV for Ableton Live
        WavEncoder.downloadWav(result.wavBytes, `echo-garden-${Date.now()}.wav`);
      } else if (result.webmBlob) {
        // Fallback to webm preview if PCM decoding failed
        const url = URL.createObjectURL(result.webmBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `echo-garden-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
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
    <header className="border-b border-stone-800 bg-stone-950/95 backdrop-blur-lg sticky top-0 z-30 px-4 py-3">
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
                v1.1 Lab
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
            title={isPlaying ? 'Pause' : 'Start Engine (Space)'}
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
              min="20"
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
              title={`Metric-Preserving Swing: ${Math.round(state.swing * 100)}%`}
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
              engine.evolve();
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

          {/* Unified Panic */}
          <button
            onClick={handleUnifiedPanic}
            className="px-2.5 py-1.5 rounded-lg bg-red-950/40 border border-red-800 text-red-300 hover:bg-red-900/50 transition-all font-mono text-xs flex items-center gap-1 font-bold"
            title="Unified Panic: Silence native voices, cancel scheduled MIDI notes, send All Notes Off, kill delay/reverb feedback"
          >
            <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
            PANIC
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
                <option value="">
                  {midiStatus === 'unsupported' ? 'No Web MIDI (Firefox)' : 'No MIDI Ports'}
                </option>
              ) : (
                midiDevices.map((d) => (
                  <option key={d.id} value={d.id} className="bg-stone-900 text-stone-100">
                    {d.name}
                  </option>
                ))
              )}
            </select>
            {/* Test Note Ping Button */}
            <button
              onClick={handleSendTest}
              className="text-[10px] bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-600/50 px-1.5 py-0.5 rounded transition-all font-mono font-bold shrink-0 ml-1"
              title="Sendet sofort eine Test-Note (C3 auf Ch 1 und Kick auf Ch 10) an Ableton / den ausgewählten Port"
            >
              Test
            </button>
            <button
              onClick={handleRefreshMidi}
              className="text-[10px] bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 px-1 py-0.5 rounded transition-all font-mono shrink-0 ml-0.5"
              title="MIDI-Ports neu scannen"
            >
              Scan
            </button>

            {(midiStatus === 'unsupported' || midiStatus === 'denied' || midiDevices.length === 0) && (
              <button
                onClick={() => setShowFirefoxMidiModal(true)}
                className="text-[10px] bg-amber-950/70 border border-amber-600/60 text-amber-300 hover:bg-amber-900 px-1.5 py-0.5 rounded transition-all font-bold shrink-0 ml-1"
                title="Firefox MIDI-Berechtigung aktivieren"
              >
                FF Hilfe
              </button>
            )}
          </div>

          {/* Test Notice Toast */}
          {testNotice && (
            <div className="fixed top-16 right-6 z-50 bg-stone-950 border border-emerald-500/70 text-emerald-300 text-xs px-3.5 py-2 rounded-lg shadow-2xl font-mono flex items-center gap-2">
              <span>{testNotice}</span>
            </div>
          )}

          {/* Genuine PCM WAV / WebM Audio Record Button */}
          <button
            onClick={handleToggleRecord}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 border transition-all ${
              recorderState.isRecording
                ? 'bg-red-500 text-white border-red-600 animate-pulse font-bold shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                : 'bg-stone-900 border-stone-800 text-stone-300 hover:text-white'
            }`}
            title={recorderState.isRecording ? 'Stop & Download 16-bit PCM WAV Recording' : 'Record Master Audio to PCM WAV File'}
          >
            <Mic className="w-3.5 h-3.5" />
            {recorderState.isRecording
              ? `${Math.floor(recorderState.durationSec / 60)}:${(recorderState.durationSec % 60).toString().padStart(2, '0')}`
              : 'WAV Rec'}
          </button>

          {/* Memory / Presets & MIDI Export */}
          <button
            onClick={onOpenMemoryModal}
            className="p-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700 transition-all"
            title="Musical Memory, Presets & Standard MIDI (.mid) Export"
          >
            <Bookmark className="w-4 h-4" />
          </button>

          {/* Ableton Guide Modal */}
          <button
            onClick={onOpenAbletonGuide}
            className="p-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700 transition-all"
            title="Ableton Live 12 Standard & DeepMind 6 Setup Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Firefox Web MIDI Setup Modal */}
      {showFirefoxMidiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <span className="font-bold text-amber-300 uppercase tracking-wider text-sm flex items-center gap-2">
                🦊 Enable Web MIDI in Firefox (10 Seconds)
              </span>
              <button
                onClick={() => setShowFirefoxMidiModal(false)}
                className="p-1 rounded text-stone-400 hover:text-white hover:bg-stone-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-stone-300 font-sans text-xs leading-relaxed">
              <p>
                Mozilla includes native Web MIDI support in Firefox for macOS, but keeps it disabled by default. You can enable it in 4 quick steps:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-stone-400 font-mono text-[11px] bg-stone-950 p-4 rounded-xl border border-stone-800">
                <li>Open a new Firefox tab and type <span className="text-amber-400 font-bold">about:config</span> in the address bar.</li>
                <li>Click <span className="text-stone-200">"Accept the Risk and Continue"</span>.</li>
                <li>Search for: <span className="text-emerald-400 font-bold">dom.webmidi.enabled</span></li>
                <li>Toggle it from <span className="text-rose-400">false</span> to <span className="text-emerald-400 font-bold">true</span>.</li>
                <li>Return here and click <strong>"Connect MIDI Now"</strong> below!</li>
              </ol>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                onClick={() => setShowFirefoxMidiModal(false)}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const ok = await engine.midiManager.init();
                  if (ok) {
                    setMidiDevices(engine.midiManager.getAvailableOutputs());
                    setMidiStatus(engine.midiManager.getStatus());
                    setShowFirefoxMidiModal(false);
                  }
                }}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-all shadow-md"
              >
                Connect MIDI Now
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
