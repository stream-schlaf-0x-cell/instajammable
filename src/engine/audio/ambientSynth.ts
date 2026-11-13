import type { AmbientSynthParams } from '../../types';
import { MasterAudio } from './audioContext';

interface Voice {
  id: string; note: number; start: number; releaseAt: number; end: number; sources: OscillatorNode[];
  nodes: AudioNode[]; gain: GainNode; level: GainNode; layerVolume: number; pan: StereoPannerNode | null; driftUnits: number[]; osc3IntervalCents: number; subGain: GainNode | null; filters: BiquadFilterNode[]; lfo: OscillatorNode | null; lfoGain: GainNode | null; fading?: boolean;
  attackEnd: number; attackPeak: number; decayTau: number; sustain: number; releaseStart: number; origReleaseEnd: number;
  fadeStart?: number; fadeFrom?: number; fadeTau?: number;
}
/** Native bounded polyphony. Oscillator onended owns graph cleanup; no per-note timers. */
export class AmbientSynth {
  private voices = new Map<string, Voice>(); private counter = 0;
  private static analogCurve: Float32Array | null = null;
  private static getAnalogCurve(): Float32Array {
    if (!this.analogCurve) {
      this.analogCurve = MasterAudio.createWideSoftClipCurve(4097, 4.0, 0.52);
    }
    return this.analogCurve;
  }
  constructor(private ctx: AudioContext, private outputNode: AudioNode,
    private maxSoundingVoices = 6, private maxReleasingVoices = 6,
    private random: { next(): number } = { next: Math.random }) {}
  static midiToFreq(note: number, detuneCents = 0): number { return 440 * Math.pow(2, (note - 69 + detuneCents / 100) / 12); }
  private static computeOsc3IntervalCents(params: AmbientSynthParams): number {
    const isBass = params.filterCutoff < 980 && params.subLevel >= 0.25 && params.attack < 0.1;
    if (isBass) {
      // Fretless / Funk / Moog upper harmonic presence when filter is open
      return params.filterCutoff >= 620 && params.filterEnvAmount >= 0.24 ? 1200 : 0;
    }
    // Powerful drone / deep root foundation: pure fifth (+702 cents)
    if (params.subLevel >= 0.22 && params.attack >= 1.2) return 702;
    // Bright crystal bell pluck: octave + 5th harmonic tine overtone (+1902 cents)
    if (params.attack <= 0.08 && params.filterCutoff >= 3300) {
      return 1902;
    }
    // Warm Rhodes / felt celesta pluck: pure octave overtone (+1200 cents) without fifth-clash on 7th/9th chords
    if (params.attack <= 0.08 && params.filterCutoff >= 900) {
      return 1200;
    }
    // Ethereal shimmer / glass / air / Solina / strings ensemble: octave halo (+1200 cents)
    if (
      (params.osc1Wave === 'sine' && params.osc3Wave === 'sawtooth') ||
      (params.osc1Wave === 'sawtooth' && params.osc2Wave === 'sawtooth' && params.attack >= 0.6) ||
      (params.filterCutoff >= 2400 && params.attack >= 0.45)
    ) {
      return 1200;
    }
    return 0;
  }
  getActiveVoiceCount(): { sounding: number; releasing: number } {
    let sounding = 0; let releasing = 0; const time = this.ctx.currentTime;
    for (const voice of this.voices.values()) { if (time < voice.start) continue; if (time >= voice.end) { this.kill(voice.id); continue; } if (voice.fading) continue; if (time >= voice.releaseAt) releasing++; else sounding++; }
    return { sounding, releasing };
  }
  setVoiceBudget(sounding: number, releasing: number): void {
    this.maxSoundingVoices = Math.max(1, Math.round(sounding)); this.maxReleasingVoices = Math.max(0, Math.round(releasing));
    const now = this.ctx.currentTime;
    const active = [...this.voices.values()].filter(v => v.releaseAt > now).sort((a, b) => a.start - b.start);
    while (active.length > this.maxSoundingVoices) this.release(active.shift()!, now, 0.04);
    const tails = [...this.voices.values()].filter(v => v.releaseAt <= now && !v.fading).sort((a, b) => a.start - b.start);
    while (tails.length > this.maxReleasingVoices) this.fade(tails.shift()!);
  }
  triggerNote(time: number, note: number, velocity: number, duration: number, params: AmbientSynthParams, layerVolume = 1): string {
    time = Math.max(this.ctx.currentTime, time); duration = Math.max(0.04, duration);
    if (params.volume <= 0 || layerVolume <= 0 || velocity <= 0) return `silent-${++this.counter}`;
    const sounding = [...this.voices.values()].filter(v => v.releaseAt > time && !v.fading).sort((a, b) => a.start - b.start);
    if (sounding.length >= this.maxSoundingVoices) this.release(sounding[0], time, 0.045);
    const releasing = [...this.voices.values()].filter(v => v.releaseAt <= time && !v.fading).sort((a, b) => a.start - b.start);
    while (releasing.length > this.maxReleasingVoices) this.fade(releasing.shift()!);
    const id = `voice-${++this.counter}`; const nodes: AudioNode[] = [];
    const filter1 = this.ctx.createBiquadFilter(); const filter2 = this.ctx.createBiquadFilter(); nodes.push(filter1, filter2);
    const velNorm = Math.max(0, Math.min(127, velocity)) / 127;
    const velFilterScale = 0.74 + 0.26 * velNorm;
    const keyTrack = Math.pow(2, Math.max(-0.32, Math.min(0.32, (note - 60) / 54)));
    const baseCutoff = Math.max(20, Math.min(18000, params.filterCutoff * velFilterScale * keyTrack));
    const requestedAttack = Math.max(0.006, params.attack); const attack = Math.min(duration, requestedAttack); const attackFraction = Math.min(1, duration / requestedAttack);
    const userRes = Math.max(0.5, Math.min(15, params.filterResonance));
    const isBass = params.filterCutoff < 980 && params.subLevel >= 0.25 && params.attack < 0.1;
    const filter2Ratio = isBass ? 1.05 : 0.78;
    filter1.type = 'lowpass'; filter1.frequency.setValueAtTime(baseCutoff, time);
    filter1.Q.setValueAtTime(isBass ? Math.min(2.2, userRes * 0.58) : Math.min(1.25, userRes * 0.45), time);
    filter1.frequency.linearRampToValueAtTime(Math.min(18000, baseCutoff * (1 + params.filterEnvAmount * (isBass ? 1.25 : 0.75) * attackFraction)), time + attack);
    filter1.frequency.setTargetAtTime(baseCutoff, time + attack, Math.max(0.18, params.decay));

    filter2.type = 'lowpass'; filter2.frequency.setValueAtTime(baseCutoff * filter2Ratio, time);
    filter2.Q.setValueAtTime(0.48, time); // Critically damped 2nd stage: warm 24dB/oct analog roll-off without nasal reed formants
    filter2.frequency.linearRampToValueAtTime(Math.min(18000, baseCutoff * filter2Ratio * (1 + params.filterEnvAmount * (isBass ? 1.15 : 0.65) * attackFraction)), time + attack);
    filter2.frequency.setTargetAtTime(baseCutoff * filter2Ratio, time + attack, Math.max(0.18, params.decay));
    if (this.ctx.createWaveShaper && isBass) {
      const shaperPre = this.ctx.createGain();
      shaperPre.gain.setValueAtTime(0.25, time);
      const shaper = this.ctx.createWaveShaper();
      shaper.curve = AmbientSynth.getAnalogCurve() as Float32Array<ArrayBuffer>;
      if ('oversample' in shaper) shaper.oversample = 'none';
      nodes.push(shaperPre, shaper);
      filter1.connect(shaperPre);
      shaperPre.connect(shaper);
      shaper.connect(filter2);
    } else {
      filter1.connect(filter2);
    }
    const gain = this.ctx.createGain(); nodes.push(gain); filter2.connect(gain);
    const voiceNorm = Math.min(7, Math.max(1, this.maxSoundingVoices));
    const peak = Math.max(0.0001, velNorm * 0.82 / Math.sqrt(voiceNorm));
    const attackPeak = Math.max(0.0001, peak * attackFraction);
    const sustain = Math.max(0.0001, duration < requestedAttack ? attackPeak : peak * params.sustain);
    const release = Math.max(0.08, Math.min(12, params.release));
    const end = time + duration + release;
    const decayTau = Math.max(0.08, Math.min(duration * 0.45, params.decay));
    const decayElapsed = Math.max(0, duration - attack);
    // Compute the exact instantaneous envelope value at note-off so transition to release never step-clicks.
    const releaseStart = Math.max(0.0001, sustain + (attackPeak - sustain) * Math.exp(-decayElapsed / decayTau));
    gain.gain.setValueAtTime(0.0001, time); gain.gain.linearRampToValueAtTime(attackPeak, time + attack);
    if (decayElapsed > 0.0005) {
      gain.gain.setTargetAtTime(sustain, time + attack, decayTau);
    }
    gain.gain.setValueAtTime(releaseStart, time + duration); gain.gain.exponentialRampToValueAtTime(0.0001, end);
    const level = this.ctx.createGain(); nodes.push(level); level.gain.setValueAtTime(Math.max(0, params.volume * layerVolume), time); gain.connect(level);
    const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (pan) { nodes.push(pan); pan.pan.setValueAtTime(Math.max(-1, Math.min(1, ((note % 12) / 6 - 1) * params.voiceSpread)), time); level.connect(pan); pan.connect(this.outputNode); } else level.connect(this.outputNode);
    const sources: OscillatorNode[] = []; const driftUnits: number[] = []; const freq = AmbientSynth.midiToFreq(note);
    const osc3IntervalCents = AmbientSynth.computeOsc3IntervalCents(params);
    const isPluckOvertone = !isBass && params.attack <= 0.08 && (osc3IntervalCents === 1902 || osc3IntervalCents === 1200);
    const isDualSawPad = !isBass && params.osc1Wave === 'sawtooth' && params.osc2Wave === 'sawtooth';
    const oscWeights = isDualSawPad
      ? [0.42, 0.20, osc3IntervalCents === 1200 ? 0.16 : 0.20]
      : [0.48, 0.27, isPluckOvertone ? (osc3IntervalCents === 1902 ? 0.13 : 0.10) : osc3IntervalCents === 1200 ? 0.16 : osc3IntervalCents === 702 ? 0.24 : 0.18];
    const effectiveSpread = isBass ? Math.min(1.8, params.detuneSpread * 0.14) : Math.min(3.4, params.detuneSpread * 0.17);
    const effectiveDrift = params.driftAmount * 1.1;
    [params.osc1Wave, params.osc2Wave, params.osc3Wave].forEach((wave, index) => {
      const osc = this.ctx.createOscillator(); osc.type = wave;
      const oscGain = this.ctx.createGain(); nodes.push(oscGain);
      oscGain.gain.setValueAtTime(oscWeights[index], time);
      if (index === 2 && isPluckOvertone) {
        // Gentle tine/celesta harmonic overtone decay into the warm fundamental body
        oscGain.gain.setTargetAtTime(0.014, time + 0.010, 0.11);
      }
      const driftUnit = this.random.next() * 2 - 1; driftUnits.push(driftUnit);
      const intervalCents = index === 2 ? osc3IntervalCents : 0;
      const detuneCents = intervalCents + (index === 1 ? -1 : index === 2 ? 0.82 : -0.12) * effectiveSpread + driftUnit * effectiveDrift;
      osc.frequency.setValueAtTime(freq, time);
      osc.detune.setValueAtTime(detuneCents, time);
      osc.connect(oscGain); oscGain.connect(filter1); osc.start(time); osc.stop(end + 0.03); sources.push(osc);
    });
    let subGain: GainNode | null = null;
    if (params.subLevel > 0.01) { const sub = this.ctx.createOscillator(); subGain = this.ctx.createGain(); nodes.push(subGain);
      sub.type = 'sine'; sub.frequency.setValueAtTime(freq * 0.5, time); subGain.gain.setValueAtTime(params.subLevel * 0.52, time);
      sub.connect(subGain); subGain.connect(filter1); sub.start(time); sub.stop(end + 0.03); sources.push(sub); }
    let lfo: OscillatorNode | null = null; let lfoGain: GainNode | null = null;
    if (params.lfoDepth > 0.001 && params.lfoRate > 0) { lfo = this.ctx.createOscillator(); lfoGain = this.ctx.createGain(); nodes.push(lfoGain);
      lfo.type = 'sine'; lfo.frequency.setValueAtTime(params.lfoRate, time); lfoGain.gain.setValueAtTime(baseCutoff * Math.max(0, Math.min(0.45, params.lfoDepth * 0.65)), time);
      lfo.connect(lfoGain); lfoGain.connect(filter1.frequency); lfoGain.connect(filter2.frequency);
      lfo.start(time); lfo.stop(end + 0.03); sources.push(lfo); }
    const voice: Voice = {
      id, note, start: time, releaseAt: time + duration, end, sources, nodes, gain, level, layerVolume, pan, driftUnits, osc3IntervalCents, subGain, filters: [filter1, filter2], lfo, lfoGain,
      attackEnd: time + attack, attackPeak, decayTau, sustain, releaseStart, origReleaseEnd: end,
    };
    this.voices.set(id, voice); sources[0].onended = () => this.kill(id); return id;
  }
  updateParams(params: AmbientSynthParams, layerVolume?: number): void {
    const now = this.ctx.currentTime;
    const isBass = params.filterCutoff < 980 && params.subLevel >= 0.25 && params.attack < 0.1;
    const filter2Ratio = isBass ? 1.05 : 0.78;
    const effectiveSpread = isBass ? Math.min(1.8, params.detuneSpread * 0.14) : Math.min(3.4, params.detuneSpread * 0.17);
    const effectiveDrift = params.driftAmount * 1.1;
    for (const v of this.voices.values()) {
      if (now >= v.end) continue;
      const paramTime = Math.max(now, v.start);
      const filterTime = Math.max(now, v.attackEnd);
      if (layerVolume !== undefined) v.layerVolume = layerVolume;
      v.level.gain.setTargetAtTime(Math.max(0, params.volume * v.layerVolume), paramTime, 0.09);
      const userRes = Math.max(0.5, Math.min(15, params.filterResonance));
      const keyTrack = Math.pow(2, Math.max(-0.32, Math.min(0.32, (v.note - 60) / 54)));
      const targetCutoff = Math.max(20, Math.min(18000, params.filterCutoff * keyTrack));
      v.filters[0]?.frequency.setTargetAtTime(targetCutoff, filterTime, 0.7);
      v.filters[0]?.Q.setTargetAtTime(isBass ? Math.min(2.2, userRes * 0.58) : Math.min(1.25, userRes * 0.45), paramTime, 0.15);
      v.filters[1]?.frequency.setTargetAtTime(Math.min(18000, targetCutoff * filter2Ratio), filterTime, 0.7);
      v.filters[1]?.Q.setTargetAtTime(0.48, paramTime, 0.15);
      v.pan?.pan.setTargetAtTime(Math.max(-1, Math.min(1, ((v.note % 12) / 6 - 1) * params.voiceSpread)), paramTime, 0.2);
      [params.osc1Wave, params.osc2Wave, params.osc3Wave].forEach((wave, i) => {
        if (now < v.start && v.sources[i].type !== wave) v.sources[i].type = wave; /* re-assigning mid-note rebuilds the wavetable and clicks */
        const intervalCents = i === 2 ? v.osc3IntervalCents : 0;
        v.sources[i].detune.setTargetAtTime(intervalCents + (i === 1 ? -1 : i === 2 ? 0.82 : -0.12) * effectiveSpread + v.driftUnits[i] * effectiveDrift, paramTime, 0.2);
      });
      if (!v.subGain && params.subLevel > 0.01 && paramTime < v.releaseAt) {
        const sub = this.ctx.createOscillator(); v.subGain = this.ctx.createGain(); v.nodes.push(v.subGain); sub.type = 'sine';
        sub.frequency.setValueAtTime(AmbientSynth.midiToFreq(v.note) * 0.5, paramTime); v.subGain.gain.setValueAtTime(0, paramTime); sub.connect(v.subGain); v.subGain.connect(v.filters[0]); sub.start(paramTime); sub.stop(v.end + 0.03); v.sources.push(sub);
      }
      v.subGain?.gain.setTargetAtTime(Math.max(0, params.subLevel) * 0.44, paramTime, 0.1);
      if (!v.lfo && params.lfoDepth > 0.001 && params.lfoRate > 0 && paramTime < v.releaseAt) {
        v.lfo = this.ctx.createOscillator(); v.lfoGain = this.ctx.createGain(); v.nodes.push(v.lfoGain); v.lfo.type = 'sine'; v.lfoGain.gain.setValueAtTime(0, paramTime);
        v.lfo.connect(v.lfoGain); v.lfoGain.connect(v.filters[0].frequency); v.lfoGain.connect(v.filters[1].frequency); v.lfo.start(paramTime); v.lfo.stop(v.end + 0.03); v.sources.push(v.lfo);
      }
      v.lfo?.frequency.setTargetAtTime(Math.max(0.001, Math.min(12, params.lfoRate)), paramTime, 1);
      v.lfoGain?.gain.setTargetAtTime(params.lfoRate <= 0 ? 0 : targetCutoff * Math.max(0, Math.min(0.45, params.lfoDepth * 0.65)), paramTime, 0.7);
    }
  }
  private envelopeAt(v: Voice, t: number): number {
    if (t <= v.start) return 0.0001;
    if (v.fadeStart !== undefined && v.fadeFrom !== undefined && v.fadeTau !== undefined && t >= v.fadeStart) {
      return Math.max(0.0001, 0.0001 + (v.fadeFrom - 0.0001) * Math.exp(-(t - v.fadeStart) / Math.max(0.001, v.fadeTau)));
    }
    if (t < v.attackEnd) {
      const frac = (t - v.start) / Math.max(0.0001, v.attackEnd - v.start);
      return Math.max(0.0001, 0.0001 + (v.attackPeak - 0.0001) * Math.max(0, Math.min(1, frac)));
    }
    if (t < v.releaseAt) {
      const dt = Math.max(0, t - v.attackEnd);
      return Math.max(0.0001, v.sustain + (v.attackPeak - v.sustain) * Math.exp(-dt / Math.max(0.001, v.decayTau)));
    }
    if (t < v.origReleaseEnd) {
      const relDur = Math.max(0.001, v.origReleaseEnd - v.releaseAt);
      const frac = Math.max(0, Math.min(1, (t - v.releaseAt) / relDur));
      return Math.max(0.0001, v.releaseStart * Math.pow(0.0001 / Math.max(0.0001, v.releaseStart), frac));
    }
    return 0.0001;
  }
  /** Cancels pending gain events without ramp-deletion step clicks, then decays smoothly to zero before stopping sources. */
  private scheduleFade(voice: Voice, time: number, tau: number, stopTime: number): void {
    const amp = this.envelopeAt(voice, time);
    const safeTau = Math.max(0.003, tau);
    voice.fadeStart = time;
    voice.fadeFrom = amp;
    voice.fadeTau = safeTau;
    const rampStart = Math.max(time + 0.002, stopTime - 0.014);
    const rampEnd = Math.max(rampStart + 0.002, stopTime - 0.002);
    const tailAmp = Math.max(0.0001, 0.0001 + (amp - 0.0001) * Math.exp(-(rampStart - time) / safeTau));
    try {
      voice.gain.gain.cancelScheduledValues(time);
      voice.gain.gain.setValueAtTime(amp, time);
      voice.gain.gain.setTargetAtTime(0.0001, time, safeTau);
      voice.gain.gain.setValueAtTime(tailAmp, rampStart);
      voice.gain.gain.linearRampToValueAtTime(0, rampEnd);
    } catch { /* already ended */ }
    for (const source of voice.sources) { try { source.stop(stopTime); } catch { /* already ended */ } }
  }
  private release(voice: Voice, time: number, duration: number): void {
    this.scheduleFade(voice, time, duration / 5, time + duration + 0.03);
    voice.releaseAt = time; voice.end = time + duration;
  }
  /**
   * Crossfade support for Evolve: every voice that is already sounding (or scheduled to start before `at`) fades out starting
   * at `at`, so a rearranged phrase can enter at the same moment without a cut. Voices created afterwards are untouched.
   */
  fadeOutAll(at: number, seconds = 0.28): void {
    const time = Math.max(this.ctx.currentTime, at);
    for (const voice of this.voices.values()) {
      if (voice.fading || voice.start > time) continue;
      this.scheduleFade(voice, time, seconds / 4, time + seconds + 0.05);
      voice.fading = true; voice.releaseAt = Math.min(voice.releaseAt, time); voice.end = Math.min(voice.end, time + seconds + 0.05);
    }
  }
  /** Short fade-out for voices that must go early. Cutting a long release tail instantly is audible as a click. */
  private fade(voice: Voice, seconds = 0.06): void {
    if (voice.fading) return;
    const now = this.ctx.currentTime;
    this.scheduleFade(voice, now, seconds / 4, now + seconds + 0.02);
    voice.fading = true; voice.end = Math.min(voice.end, now + seconds);
  }
  private kill(id: string): void {
    const v = this.voices.get(id); if (!v) return; this.voices.delete(id);
    try { v.gain.gain.cancelScheduledValues(this.ctx.currentTime); v.gain.gain.setValueAtTime(0, this.ctx.currentTime); } catch { /* graph ended */ }
    for (const source of v.sources) { source.onended = null; try { source.stop(this.ctx.currentTime); } catch { /* stopped */ } try { source.disconnect(); } catch { /* disconnected */ } }
    for (const node of v.nodes) try { node.disconnect(); } catch { /* disconnected */ }
  }
  stopAllVoices(fade = false): void { for (const [id, voice] of [...this.voices.entries()]) { if (fade) this.fade(voice); else this.kill(id); } }
}
