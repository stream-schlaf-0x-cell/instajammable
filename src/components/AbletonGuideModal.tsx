// Ableton Live 12 Standard & Hardware Integration Guide Modal

import React from 'react';
import { X, CheckCircle2, Cable, Sliders, Cpu, AlertCircle, Info } from 'lucide-react';
import { DEEPMIND_6_PROFILE } from '../engine/midi/hardwareProfiles';

interface AbletonGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AbletonGuideModal: React.FC<AbletonGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Cable className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-100 uppercase font-mono">
                ABLETON LIVE 12 STANDARD & HARDWARE SETUP GUIDE
              </h2>
              <p className="text-xs font-mono text-stone-400">
                macOS IAC Virtual MIDI routing, Scarlett audio routing, and Behringer DeepMind 6 configuration
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

        {/* Technical Architecture Notice */}
        <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-4 font-mono text-xs flex gap-3">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-300">DAW & Plugin Architecture Note:</span>
            <p className="text-stone-300 leading-relaxed font-sans text-[11px]">
              Browsers cannot directly load or execute third-party VST/AU plugins (such as Xpand!2, Hype, or Valhalla Supermassive). Instead, ECHO GARDEN operates as a true generative sequencer: it produces native synthesized audio standalone in the browser, while simultaneously streaming low-latency MIDI into Ableton Live 12 Standard via the macOS IAC Driver, triggering your plugins and hardware synths seamlessly.
            </p>
          </div>
        </div>

        {/* Step 1: Enable macOS IAC Driver */}
        <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-5 space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            STEP 1: ENABLE macOS IAC VIRTUAL MIDI DRIVER
          </div>
          <p className="text-stone-300 leading-relaxed font-sans">
            macOS includes a zero-latency system virtual MIDI bus built into CoreAudio:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-stone-400">
            <li>Open macOS <strong>Spotlight (Cmd + Space)</strong> and launch <code className="text-emerald-300 bg-stone-900 px-1 py-0.5 rounded">Audio MIDI Setup</code>.</li>
            <li>Press <code className="text-emerald-300 bg-stone-900 px-1 py-0.5 rounded">Cmd + 2</code> (or menu: <em>Window → Show MIDI Studio</em>).</li>
            <li>Double-click the red <strong>IAC Driver</strong> icon.</li>
            <li>Check the box <strong>"Device is online"</strong>.</li>
            <li>Ensure at least one port is named <strong>"Bus 1"</strong> and click <strong>Apply</strong>.</li>
            <li>In ECHO GARDEN's header dropdown, select <strong>"IAC Driver Bus 1"</strong> (available in Chrome).</li>
          </ol>
        </div>

        {/* Step 2: Ableton Live 12 Configuration */}
        <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-5 space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            STEP 2: ABLETON LIVE 12 STANDARD MIDI PREFERENCES
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 bg-stone-900/60 rounded border border-stone-800 space-y-2">
              <span className="font-bold text-stone-200">1. Ableton Preferences (Cmd + ,)</span>
              <p className="text-stone-400 text-[11px] leading-relaxed">
                Go to the <strong>Link / Tempo / MIDI</strong> tab. Find <strong>Input: IAC Driver (Bus 1)</strong>:
              </p>
              <ul className="space-y-1 text-stone-300 text-[11px]">
                <li>• <strong>Track = ON:</strong> Allows routing notes to armed MIDI tracks.</li>
                <li>• <strong>Remote = ON:</strong> Allows mapping CC automation to plugins/controls.</li>
                <li>• <strong>Sync = OFF:</strong> Keep OFF. ECHO GARDEN free-runs with high-precision Web Audio clock to preserve microtiming and humanization. Match Ableton's BPM to ECHO GARDEN.</li>
              </ul>
            </div>
            <div className="p-3.5 bg-stone-900/60 rounded border border-stone-800 space-y-2">
              <span className="font-bold text-stone-200">2. Track Input & Monitor Routing</span>
              <p className="text-stone-400 text-[11px] leading-relaxed">
                On each Ableton MIDI track:
              </p>
              <ul className="space-y-1 text-stone-300 text-[11px]">
                <li>• Set <strong>MIDI From</strong> to <strong>IAC Driver (Bus 1)</strong>.</li>
                <li>• Set Channel to the corresponding layer (e.g. <strong>Ch 10</strong> for Drums, <strong>Ch 1</strong> for Ambient Drone).</li>
                <li>• Set <strong>Monitor</strong> to <strong>"In"</strong> so incoming notes play live without needing to record-arm.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Step 3: VST Plugins Setup (Xpand!2, Essential Keyboards, Hype, Supermassive) */}
        <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-5 space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Sliders className="w-4 h-4" />
            STEP 3: RECOMMENDED PLUGIN TRACK TEMPLATE
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-stone-400 text-[11px]">
            <div className="p-3 bg-stone-900/60 rounded border border-stone-800 space-y-1">
              <span className="text-emerald-400 font-bold block">Track 1: AIR Xpand!2 / Drum Rack (Ch 10)</span>
              <p>Receives Kick (C1/36), Snare (D1/38), Hi-Hat (F#1/42), and Percussion (D#1/39). Load electronic kit or hybrid industrial percussion.</p>
            </div>
            <div className="p-3 bg-stone-900/60 rounded border border-stone-800 space-y-1">
              <span className="text-emerald-400 font-bold block">Track 2: AIR Essential Keyboards (Ch 2)</span>
              <p>Receives polyphonic chord voicings. Load Suitcase Rhodes or Wurli with tape saturation for warm minimalist harmonic beds.</p>
            </div>
            <div className="p-3 bg-stone-900/60 rounded border border-stone-800 space-y-1">
              <span className="text-emerald-400 font-bold block">Track 3: AIR Hype (Ch 1)</span>
              <p>Receives sustained harmonic drone notes. Select evolving wavetable or analog pad presets with slow filter sweep modulation.</p>
            </div>
            <div className="p-3 bg-stone-900/60 rounded border border-stone-800 space-y-1">
              <span className="text-cyan-400 font-bold block">Return A: Valhalla Supermassive</span>
              <p>Insert on Return Track. Feed drum percussion sends and drone sends for enormous shimmering interstellar reverbs and delays.</p>
            </div>
          </div>
        </div>

        {/* Step 4: Focusrite Scarlett 2i2 & Behringer DeepMind 6 Hardware */}
        <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-5 space-y-4 font-mono text-xs">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <Cpu className="w-4 h-4" />
            STEP 4: FOCUSRITE SCARLETT & BEHRINGER DEEPMIND 6 HARDWARE
          </div>

          <div className="space-y-2 text-stone-300 font-sans text-[11px] leading-relaxed">
            <p>
              <strong>Focusrite Scarlett 2i2 Clarification:</strong> The Scarlett 2i2 audio interface does not have 5-pin DIN MIDI ports. Connect your Behringer DeepMind 6 <strong>directly via USB</strong> to your Mac (it is class-compliant USB MIDI). Connect the DeepMind's 1/4" audio outputs (L/MONO and R) into inputs 1 and 2 of your Scarlett 2i2 interface to monitor the analog audio.
            </p>
            <p>
              In ECHO GARDEN's MIDI output selector, select <strong>"DeepMind 6"</strong> directly, or route through Ableton Live using an External Instrument device.
            </p>
          </div>

          {/* DeepMind 6 Verified CC Table */}
          <div className="space-y-1.5">
            <span className="text-stone-400 text-[10px] uppercase font-mono tracking-wider block">
              Verified DeepMind 6 Parameter CC Mappings (Manual pp. 132–133):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
              {DEEPMIND_6_PROFILE.controls.map((ctl) => (
                <div key={ctl.cc} className="p-2 bg-stone-900 rounded border border-stone-800">
                  <span className="text-stone-200 font-bold block">{ctl.name}</span>
                  <span className="text-emerald-400 font-mono">CC {ctl.cc} ({ctl.min}–{ctl.max})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Step 5: Browser Compatibility (Chrome vs Firefox) */}
        <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-4 font-mono text-xs space-y-2">
          <div className="flex items-center gap-2 text-stone-300 font-bold">
            <AlertCircle className="w-4 h-4 text-emerald-400" />
            BROWSER COMPATIBILITY
          </div>
          <p className="text-stone-400 text-[11px] leading-relaxed font-sans">
            • <strong>Chrome:</strong> Full Web MIDI API support enabled by default. Directly routes to macOS IAC Bus and DeepMind 6.<br />
            • <strong>Firefox:</strong> Web MIDI is disabled by default in standard Firefox builds. ECHO GARDEN detects this gracefully and provides 100% of its native polyphonic synthesis, rhythmic drum synthesis, DSP effects rack, parameter mutations, and uncompressed 16-bit PCM WAV recording without errors.
          </p>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 font-mono text-xs rounded-lg transition-all"
          >
            Close Guide
          </button>
        </div>

      </div>
    </div>
  );
};
