// Ableton Live 12 & Hardware Integration Guide Modal

import React from 'react';
import { X, CheckCircle2, Cable, Sliders, Cpu } from 'lucide-react';
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
                ABLETON LIVE 12 & HARDWARE INTEGRATION
              </h2>
              <p className="text-xs font-mono text-stone-400">
                macOS IAC Virtual MIDI, VST Plugin routing, and Behringer DeepMind 6 configuration
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

        {/* Step 1: Enable macOS IAC Driver */}
        <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-5 space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            STEP 1: ENABLE macOS IAC VIRTUAL MIDI DRIVER
          </div>
          <p className="text-stone-300 leading-relaxed font-sans">
            macOS includes a built-in virtual MIDI bus that routes notes directly between ECHO GARDEN in Chrome and Ableton Live without latency or cables:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-stone-400">
            <li>Open macOS <strong>Spotlight (Cmd + Space)</strong> and type <code className="text-emerald-300 bg-stone-900 px-1 py-0.5 rounded">Audio MIDI Setup</code>.</li>
            <li>Press <code className="text-emerald-300 bg-stone-900 px-1 py-0.5 rounded">Cmd + 2</code> (or Window → Show MIDI Studio).</li>
            <li>Double-click the red <strong>IAC Driver</strong> icon.</li>
            <li>Check the box <strong>"Device is online"</strong>.</li>
            <li>Ensure at least one port is named <strong>"Bus 1"</strong> and click Apply.</li>
            <li>In ECHO GARDEN's header dropdown, select <strong>"IAC Driver Bus 1"</strong>.</li>
          </ol>
        </div>

        {/* Step 2: Ableton Live 12 Configuration */}
        <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-5 space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            STEP 2: ABLETON LIVE 12 STANDARD MIDI SETUP
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-stone-900/60 rounded border border-stone-800 space-y-1.5">
              <span className="font-bold text-stone-200">1. Ableton Preferences (Cmd + ,)</span>
              <p className="text-stone-400 text-[11px] leading-relaxed">
                Go to the <strong>Link / Tempo / MIDI</strong> tab. Find <strong>Input: IAC Driver (Bus 1)</strong> and enable <strong>Track = ON</strong> and <strong>Remote = ON</strong>.
              </p>
            </div>
            <div className="p-3 bg-stone-900/60 rounded border border-stone-800 space-y-1.5">
              <span className="font-bold text-stone-200">2. Track Input & Monitor</span>
              <p className="text-stone-400 text-[11px] leading-relaxed">
                On each Ableton MIDI track, set <strong>MIDI From</strong> to <strong>IAC Driver</strong>, select the layer's channel (e.g. Ch 10 for drums, Ch 1 for Drone), and set <strong>Monitor to "In"</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Step 3: VST Plugins Setup (Xpand!2, Essential Keyboards, Hype, Supermassive) */}
        <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-5 space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Sliders className="w-4 h-4" />
            STEP 3: RECOMMENDED INSTRUMENT & EFFECT ROUTINGS
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-stone-400 text-[11px]">
            <div className="p-3 bg-stone-900/60 rounded border border-stone-800">
              <span className="text-emerald-400 font-bold block mb-1">AIR Xpand!2 / Drum Rack (Ch 10)</span>
              Receive Kick, Snare, Hi-Hats, and Percussion. In Xpand!2, choose electronic drum kits or perc patches.
            </div>
            <div className="p-3 bg-stone-900/60 rounded border border-stone-800">
              <span className="text-emerald-400 font-bold block mb-1">AIR Essential Keyboards (Ch 2)</span>
              Route generative chord progressions and harmonic voicings into Rhodes, Wurlitzer, or FM tines.
            </div>
            <div className="p-3 bg-stone-900/60 rounded border border-stone-800">
              <span className="text-emerald-400 font-bold block mb-1">AIR Hype (Ch 1 / Ch 3)</span>
              Load evolving wavetable pads, deep ambient textures, or modern analog style bass drones.
            </div>
            <div className="p-3 bg-stone-900/60 rounded border border-stone-800">
              <span className="text-cyan-400 font-bold block mb-1">Valhalla Supermassive (Return A / B)</span>
              Audio Effect: Insert on Return Track. Feed drum percussions and ambient pads for enormous, shimmering cinematic tails.
            </div>
          </div>
        </div>

        {/* Step 4: Behringer DeepMind 6 Hardware */}
        <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-5 space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <Cpu className="w-4 h-4" />
            BEHRINGER DEEPMIND 6 DIRECT HARDWARE INTEGRATION
          </div>
          <p className="text-stone-300 leading-relaxed font-sans">
            Connect your DeepMind 6 via USB or Scarlett MIDI Out. ECHO GARDEN transmits polyphonic drone chords and can modulate analog filter parameters via standard MIDI CC:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
            {DEEPMIND_6_PROFILE.controls.slice(0, 8).map((ctl) => (
              <div key={ctl.cc} className="p-2 bg-stone-900 rounded border border-stone-800">
                <span className="text-stone-200 font-bold block">{ctl.name}</span>
                <span className="text-emerald-400">CC {ctl.cc}</span>
              </div>
            ))}
          </div>
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
