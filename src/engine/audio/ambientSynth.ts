// Polyphonic Detuned Ambient Drone & Pad Synthesizer

import { AmbientSynthParams } from '../../types';

interface ActiveVoice {
  id: string;
  midiNote: number;
  oscillators: OscillatorNode[];
  subOsc: OscillatorNode | null;
  filter: BiquadFilterNode;
  gain: GainNode;
  panNode: StereoPannerNode | null;
  startTime: number;
  releaseTime: number;
}

export class AmbientSynth {
  private ctx: AudioContext;
  private outputNode: AudioNode;
  private activeVoices: Map<string, ActiveVoice> = new Map();
  private maxPolyphony: number = 6;
  private voiceIdCounter: number = 0;

  constructor(ctx: AudioContext, outputNode: AudioNode) {
    this.ctx = ctx;
    this.outputNode = outputNode;
  }

  // Convert MIDI note number to Frequency in Hz
  public static midiToFreq(note: number, detuneCents: number = 0): number {
    return 440 * Math.pow(2, (note - 69 + detuneCents / 100) / 12);
  }

  // Trigger polyphonic note event
  public triggerNote(
    time: number,
    midiNote: number,
    velocity: number,
    duration: number,
    params: AmbientSynthParams
  ): string {
    // Enforce polyphony limit with polite voice-stealing (steal oldest voice)
    if (this.activeVoices.size >= this.maxPolyphony) {
      const oldestId = this.activeVoices.keys().next().value;
      if (oldestId) {
        this.releaseVoice(oldestId, time, 0.2);
      }
    }

    const voiceId = `voice_${++this.voiceIdCounter}`;
    const vel = velocity / 127;
    const baseFreq = AmbientSynth.midiToFreq(midiNote);

    // Filter per voice
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const baseCutoff = Math.max(40, Math.min(18000, params.filterCutoff));
    filter.frequency.setValueAtTime(baseCutoff, time);
    filter.Q.setValueAtTime(params.filterResonance, time);

    // Filter envelope sweep
    const envMod = params.filterEnvAmount * (baseCutoff * 2.5);
    filter.frequency.linearRampToValueAtTime(Math.min(18000, baseCutoff + envMod), time + params.attack);
    filter.frequency.setTargetAtTime(baseCutoff, time + params.attack, params.decay || 1.5);

    // Voice Gain Envelope (ADSR)
    const voiceGain = this.ctx.createGain();
    const peakVolume = (params.volume * vel * 0.4) / Math.sqrt(this.activeVoices.size + 1);

    voiceGain.gain.setValueAtTime(0, time);
    // Smooth Attack
    voiceGain.gain.linearRampToValueAtTime(peakVolume, time + Math.max(0.01, params.attack));
    // Decay to Sustain
    const sustainGain = peakVolume * Math.max(0.05, params.sustain);
    voiceGain.gain.setTargetAtTime(sustainGain, time + Math.max(0.01, params.attack), params.decay || 1.0);

    // Multi-Oscillator Array (Osc 1 Center, Osc 2 Detuned Flat, Osc 3 Detuned Sharp)
    const oscillators: OscillatorNode[] = [];
    const detuneOffsets = [
      0,
      -params.detuneSpread,
      params.detuneSpread,
    ];
    const waveTypes = [params.osc1Wave, params.osc2Wave, params.osc3Wave];

    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = waveTypes[i] || 'sawtooth';
      
      // Pitch drift simulation (analog warmth)
      const drift = (Math.random() * 2 - 1) * params.driftAmount * 4;
      osc.frequency.setValueAtTime(baseFreq, time);
      osc.detune.setValueAtTime(detuneOffsets[i] + drift, time);

      osc.connect(filter);
      osc.start(time);
      oscillators.push(osc);
    }

    // Sub-Oscillator (1 octave down sine)
    let subOsc: OscillatorNode | null = null;
    if (params.subLevel > 0.05) {
      subOsc = this.ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(baseFreq * 0.5, time);
      
      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(params.subLevel * 0.6, time);
      subOsc.connect(subGain);
      subGain.connect(filter);
      subOsc.start(time);
    }

    // Stereo Panner (gentle natural spatial spread)
    const panNode = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const panPos = ((midiNote % 12) / 6 - 1) * 0.45; // Spread by pitch class
    if (panNode) {
      panNode.pan.setValueAtTime(panPos, time);
      filter.connect(voiceGain);
      voiceGain.connect(panNode);
      panNode.connect(this.outputNode);
    } else {
      filter.connect(voiceGain);
      voiceGain.connect(this.outputNode);
    }

    const voice: ActiveVoice = {
      id: voiceId,
      midiNote,
      oscillators,
      subOsc,
      filter,
      gain: voiceGain,
      panNode,
      startTime: time,
      releaseTime: time + duration,
    };

    this.activeVoices.set(voiceId, voice);

    // Schedule automatic release at end of duration
    const rel = Math.max(0.1, params.release);
    const stopTime = time + duration + rel;

    voiceGain.gain.setValueAtTime(sustainGain, time + duration);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    // Cleanup nodes after release completes
    oscillators.forEach((osc) => osc.stop(stopTime + 0.1));
    if (subOsc) subOsc.stop(stopTime + 0.1);

    setTimeout(() => {
      this.cleanupVoice(voiceId);
    }, (stopTime - this.ctx.currentTime + 0.2) * 1000);

    return voiceId;
  }

  // Release a voice manually (for note off)
  public releaseVoice(voiceId: string, time: number, releaseDuration: number = 0.5): void {
    const voice = this.activeVoices.get(voiceId);
    if (!voice) return;

    const stopTime = time + releaseDuration;
    voice.gain.gain.cancelScheduledValues(time);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, time);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    voice.oscillators.forEach((osc) => {
      try {
        osc.stop(stopTime + 0.05);
      } catch {
        // already stopped
      }
    });

    if (voice.subOsc) {
      try {
        voice.subOsc.stop(stopTime + 0.05);
      } catch {
        // already stopped
      }
    }

    setTimeout(() => {
      this.cleanupVoice(voiceId);
    }, (releaseDuration + 0.1) * 1000);
  }

  private cleanupVoice(voiceId: string): void {
    const voice = this.activeVoices.get(voiceId);
    if (voice) {
      try {
        voice.gain.disconnect();
        voice.filter.disconnect();
        if (voice.panNode) voice.panNode.disconnect();
      } catch {
        // node disconnection fallback
      }
      this.activeVoices.delete(voiceId);
    }
  }

  public stopAllVoices(): void {
    const now = this.ctx.currentTime;
    this.activeVoices.forEach((voice) => {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(0, now);
      voice.oscillators.forEach((osc) => {
        try {
          osc.stop(now);
        } catch {
          // ignore
        }
      });
      if (voice.subOsc) {
        try {
          voice.subOsc.stop(now);
        } catch {
          // ignore
        }
      }
    });
    this.activeVoices.clear();
  }
}
