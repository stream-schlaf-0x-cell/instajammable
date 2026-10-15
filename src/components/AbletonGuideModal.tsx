import React from 'react';
import { X, CheckCircle2, Cable, Sliders, Cpu, AlertCircle, Info, Download } from 'lucide-react';
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
                ABLETON LIVE 12 STANDARD & INSTAJAMMABLE TEMPLATE
              </h2>
              <p className="text-xs font-mono text-stone-400">
                macOS IAC Virtual MIDI Routing, DS Kick, Xpand!2 Pads, Scarlett 2i2 & Behringer DeepMind 6
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

        {/* 1-Click Template Download Banner */}
        <div className="bg-gradient-to-r from-emerald-950/60 to-cyan-950/60 border border-emerald-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
              <Download className="w-4 h-4 text-emerald-400" />
              <span>FERTIGE ABLETON VORLAGE: InstaJammable_Studio_Catch.als</span>
            </div>
            <p className="text-stone-300 font-sans text-xs leading-relaxed">
              Enthält alle 6 Spuren vorkonfiguriert mit <strong>Monitor: In</strong> auf IAC Bus 1 (Ch 10 für DS Kick, Ch 1 für Xpand!2 Pads & Drone, Ch 2 Melody, Ch 3 Bass).
              Bereits in deinen Vorlagen unter <code className="text-emerald-300 bg-stone-900/80 px-1 py-0.5 rounded">Ableton User Library/Templates</code> und auf deinem Desktop abgelegt!
            </p>
          </div>
          <a
            href="./templates/InstaJammable_Studio_Catch.als"
            download="InstaJammable_Studio_Catch.als"
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold rounded-lg transition-all shadow-lg"
          >
            <Download className="w-4 h-4" />
            <span>Template (.als) laden</span>
          </a>
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

        {/* Step 3: VST Plugins & Instruments Setup (DS Kick, Xpand!2, Supermassive) */}
        <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-5 space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Sliders className="w-4 h-4" />
            STEP 3: DAS STANDARD-INSTRUMENTEN-SET IN ABLETON
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-stone-400 text-[11px]">
            <div className="p-3 bg-stone-900/60 rounded border border-stone-800 space-y-1.5">
              <span className="text-amber-400 font-bold block flex items-center justify-between">
                <span>Spur 1: Ableton Drum Rack (Ch 10)</span>
                <span className="text-[10px] bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded">DS Kick inside</span>
              </span>
              <p className="leading-relaxed">
                Empfängt 4 GM-Schlagwerk-Noten:
              </p>
              <ul className="space-y-0.5 text-stone-300 text-[10px]">
                <li>• <strong>Pad C1 (MIDI 36):</strong> <code className="text-amber-300">DS Kick</code> (Tuning ~52 Hz, Decay 320ms, Drive 15% für fetten Lo-Fi Sub-Punch).</li>
                <li>• <strong>Pad D1 (MIDI 38):</strong> <code className="text-amber-300">DS Snare</code> / Rimshot (kurzer Snap für Backbeat).</li>
                <li>• <strong>Pad F#1 (MIDI 42):</strong> <code className="text-amber-300">DS HH</code> (Tight Closed 16tel Hi-Hat).</li>
                <li>• <strong>Pad C#1 (MIDI 37):</strong> <code className="text-amber-300">DS Perc</code> / Clave / Shaker.</li>
              </ul>
            </div>

            <div className="p-3 bg-stone-900/60 rounded border border-stone-800 space-y-1.5">
              <span className="text-cyan-400 font-bold block flex items-center justify-between">
                <span>Spur 2: AIR Xpand!2 – Pads & Chords (Ch 1)</span>
                <span className="text-[10px] bg-cyan-500/10 text-cyan-300 px-1.5 py-0.5 rounded">Lush Voicings</span>
              </span>
              <p className="leading-relaxed">
                Empfängt polyphone 7th/9th/11th Akkorde:
              </p>
              <ul className="space-y-0.5 text-stone-300 text-[10px]">
                <li>• <strong>Preset-Tipp A:</strong> <code className="text-cyan-300">04 Soft Pads → Warm Silk Pad</code> oder <code className="text-cyan-300">Analog Pad</code>.</li>
                <li>• <strong>Preset-Tipp B:</strong> <code className="text-cyan-300">02 Electric Pianos → Suitcase Soft EP</code> für Lo-Fi Rhodes.</li>
                <li>• <strong>Hüllkurve:</strong> Attack ~40ms, Release ~1.8s (verhindert Knackser bei Chord-Wechseln).</li>
              </ul>
            </div>

            <div className="p-3 bg-stone-900/60 rounded border border-stone-800 space-y-1.5">
              <span className="text-blue-400 font-bold block flex items-center justify-between">
                <span>Spur 3: AIR Xpand!2 – Texture & Drone (Ch 1)</span>
                <span className="text-[10px] bg-blue-500/10 text-blue-300 px-1.5 py-0.5 rounded">Ambient Floor</span>
              </span>
              <p className="leading-relaxed">
                Empfängt anhaltende Grundtöne/Quint-Fundamente:
              </p>
              <ul className="space-y-0.5 text-stone-300 text-[10px]">
                <li>• <strong>Preset-Tipp:</strong> <code className="text-blue-300">05 Action Pads → Dark Atmosphere</code> oder Ableton <code className="text-blue-300">Drift</code> (Saw + Sub, 24dB Tiefpass bei 380Hz).</li>
              </ul>
            </div>

            <div className="p-3 bg-stone-900/60 rounded border border-stone-800 space-y-1.5">
              <span className="text-yellow-400 font-bold block flex items-center justify-between">
                <span>Spur 4: Bass (Ch 3) & Spur 5: Melody (Ch 2)</span>
                <span className="text-[10px] bg-yellow-500/10 text-yellow-300 px-1.5 py-0.5 rounded">Foundation & Top</span>
              </span>
              <ul className="space-y-0.5 text-stone-300 text-[10px]">
                <li>• <strong>Bass (Ch 3):</strong> Ableton <code className="text-yellow-300">Drift</code> (Bass Sub), Operator oder Xpand!2 <code className="text-yellow-300">07 Electric Basses → Finger Bass</code>.</li>
                <li>• <strong>Melody (Ch 2):</strong> Xpand!2 <code className="text-emerald-300">03 Bell & Mallets → Warm Vibraphone</code> oder <code className="text-emerald-300">01 Poly Synth → Pluck</code>.</li>
              </ul>
            </div>

            <div className="p-3 bg-stone-900/60 rounded border border-stone-800 space-y-1 md:col-span-2">
              <span className="text-purple-400 font-bold block">Return A: Valhalla Supermassive (oder Ableton Reverb)</span>
              <p className="text-stone-300 text-[11px] leading-relaxed">
                Modus: <code className="text-purple-300">Great Annihilator</code> oder <code className="text-purple-300">Sagittarius</code>, High-Cut bei 4.5 kHz. Drums und Pads dezent einspeisen für weite, schimmernde Räume.
              </p>
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
