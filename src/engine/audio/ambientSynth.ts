import type { AmbientSynthParams } from '../../types';

interface Voice {
  id: string; note: number; start: number; releaseAt: number; end: number; sources: OscillatorNode[];
  nodes: AudioNode[]; gain: GainNode; level: GainNode; layerVolume: number; pan: StereoPannerNode | null; driftUnits: number[]; subGain: GainNode | null; filters: BiquadFilterNode[]; lfo: OscillatorNode | null; lfoGain: GainNode | null; fading?: boolean;
}
/** Native bounded polyphony. Oscillator onended owns graph cleanup; no per-note timers. */
export class AmbientSynth {
  private voices = new Map<string, Voice>(); private counter = 0;
  constructor(private ctx: AudioContext, private outputNode: AudioNode,
    private maxSoundingVoices = 6, private maxReleasingVoices = 6,
    private random: { next(): number } = { next: Math.random }) {}
  static midiToFreq(note: number, detuneCents = 0): number { return 440 * Math.pow(2, (note - 69 + detuneCents / 100) / 12); }
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
    const baseCutoff = Math.max(20, Math.min(18000, params.filterCutoff)); const requestedAttack = Math.max(0.005, params.attack); const attack = Math.min(duration, requestedAttack); const attackFraction = Math.min(1, duration / requestedAttack);
    const userRes = Math.max(0.5, Math.min(15, params.filterResonance));
    filter1.type = 'lowpass'; filter1.frequency.setValueAtTime(baseCutoff, time);
    filter1.Q.setValueAtTime(Math.min(3.5, userRes * 0.707), time);
    filter1.frequency.linearRampToValueAtTime(Math.min(18000, baseCutoff * (1 + params.filterEnvAmount * 1.3 * attackFraction)), time + attack);
    filter1.frequency.setTargetAtTime(baseCutoff, time + attack, Math.max(0.1, params.decay));

    filter2.type = 'lowpass'; filter2.frequency.setValueAtTime(baseCutoff, time);
    filter2.Q.setValueAtTime(0.54, time); // Critically damped 2nd stage: silky analog roll-off, eliminates metallic chord ringing
    filter2.frequency.linearRampToValueAtTime(Math.min(18000, baseCutoff * (1 + params.filterEnvAmount * 1.3 * attackFraction)), time + attack);
    filter2.frequency.setTargetAtTime(baseCutoff, time + attack, Math.max(0.1, params.decay));
    filter1.connect(filter2);
    const gain = this.ctx.createGain(); nodes.push(gain); filter2.connect(gain);
    const peak = Math.max(0.0001, Math.max(0, Math.min(127, velocity)) / 127 * 0.55 / Math.sqrt(this.maxSoundingVoices));
    const sustain = Math.max(0.0001, duration < requestedAttack ? peak * attackFraction : peak * params.sustain); const release = Math.max(0.05, Math.min(12, params.release));
    const end = time + duration + release;
    gain.gain.setValueAtTime(0.0001, time); gain.gain.linearRampToValueAtTime(peak * attackFraction, time + attack);
    gain.gain.setTargetAtTime(sustain, time + attack, Math.max(0.05, Math.min(duration * 0.3, params.decay)));
    gain.gain.setValueAtTime(sustain, time + duration); gain.gain.exponentialRampToValueAtTime(0.0001, end);
    const level = this.ctx.createGain(); nodes.push(level); level.gain.setValueAtTime(Math.max(0, params.volume * layerVolume), time); gain.connect(level);
    const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (pan) { nodes.push(pan); pan.pan.setValueAtTime(Math.max(-1, Math.min(1, ((note % 12) / 6 - 1) * params.voiceSpread)), time); level.connect(pan); pan.connect(this.outputNode); } else level.connect(this.outputNode);
    const sources: OscillatorNode[] = []; const driftUnits: number[] = []; const freq = AmbientSynth.midiToFreq(note);
    [params.osc1Wave, params.osc2Wave, params.osc3Wave].forEach((wave, index) => {
      const osc = this.ctx.createOscillator(); osc.type = wave;
      const driftUnit = this.random.next() * 2 - 1; driftUnits.push(driftUnit);
      osc.frequency.setValueAtTime(freq, time); osc.detune.setValueAtTime((index === 1 ? -1 : index === 2 ? 1 : 0) * params.detuneSpread + driftUnit * params.driftAmount * 3, time);
      osc.connect(filter1); osc.start(time); osc.stop(end + 0.03); sources.push(osc);
    });
    let subGain: GainNode | null = null;
    if (params.subLevel > 0.01) { const sub = this.ctx.createOscillator(); subGain = this.ctx.createGain(); nodes.push(subGain);
      sub.type = 'sine'; sub.frequency.setValueAtTime(freq * 0.5, time); subGain.gain.setValueAtTime(params.subLevel * 0.4, time);
      sub.connect(subGain); subGain.connect(filter1); sub.start(time); sub.stop(end + 0.03); sources.push(sub); }
    let lfo: OscillatorNode | null = null; let lfoGain: GainNode | null = null;
    if (params.lfoDepth > 0.001 && params.lfoRate > 0) { lfo = this.ctx.createOscillator(); lfoGain = this.ctx.createGain(); nodes.push(lfoGain);
      lfo.type = 'sine'; lfo.frequency.setValueAtTime(params.lfoRate, time); lfoGain.gain.setValueAtTime(baseCutoff * Math.max(0, Math.min(1, params.lfoDepth)), time);
      lfo.connect(lfoGain); lfoGain.connect(filter1.frequency); lfoGain.connect(filter2.frequency); lfo.start(time); lfo.stop(end + 0.03); sources.push(lfo); }
    const voice: Voice = { id, note, start: time, releaseAt: time + duration, end, sources, nodes, gain, level, layerVolume, pan, driftUnits, subGain, filters: [filter1, filter2], lfo, lfoGain };
    this.voices.set(id, voice); sources[0].onended = () => this.kill(id); return id;
  }
  updateParams(params: AmbientSynthParams, layerVolume?: number): void {
    const now = this.ctx.currentTime;
    for (const v of this.voices.values()) {
      if (now >= v.end) continue;
      if (layerVolume !== undefined) v.layerVolume = layerVolume;
      v.level.gain.setTargetAtTime(Math.max(0, params.volume * v.layerVolume), now, 0.09);
      const userRes = Math.max(0.5, Math.min(15, params.filterResonance));
      v.filters[0]?.frequency.setTargetAtTime(Math.max(20, Math.min(18000, params.filterCutoff)), now, 0.7);
      v.filters[0]?.Q.setTargetAtTime(Math.min(3.5, userRes * 0.707), now, 0.15);
      v.filters[1]?.frequency.setTargetAtTime(Math.max(20, Math.min(18000, params.filterCutoff)), now, 0.7);
      v.filters[1]?.Q.setTargetAtTime(0.54, now, 0.15);
      v.pan?.pan.setTargetAtTime(Math.max(-1, Math.min(1, ((v.note % 12) / 6 - 1) * params.voiceSpread)), now, 0.2);
      [params.osc1Wave, params.osc2Wave, params.osc3Wave].forEach((wave, i) => { if (v.sources[i].type !== wave) v.sources[i].type = wave; /* re-assigning an unchanged type rebuilds the wavetable and clicks */ v.sources[i].detune.setTargetAtTime((i === 1 ? -1 : i === 2 ? 1 : 0) * params.detuneSpread + v.driftUnits[i] * params.driftAmount * 3, now, 0.2); });
      if (!v.subGain && params.subLevel > 0.01 && now < v.releaseAt) {
        const sub = this.ctx.createOscillator(); v.subGain = this.ctx.createGain(); v.nodes.push(v.subGain); sub.type = 'sine';
        sub.frequency.setValueAtTime(AmbientSynth.midiToFreq(v.note) * 0.5, now); v.subGain.gain.setValueAtTime(0, now); sub.connect(v.subGain); v.subGain.connect(v.filters[0]); sub.start(now); sub.stop(v.end + 0.03); v.sources.push(sub);
      }
      v.subGain?.gain.setTargetAtTime(Math.max(0, params.subLevel) * 0.4, now, 0.1);
      if (!v.lfo && params.lfoDepth > 0.001 && params.lfoRate > 0 && now < v.releaseAt) {
        v.lfo = this.ctx.createOscillator(); v.lfoGain = this.ctx.createGain(); v.nodes.push(v.lfoGain); v.lfo.type = 'sine'; v.lfoGain.gain.setValueAtTime(0, now);
        v.lfo.connect(v.lfoGain); v.lfoGain.connect(v.filters[0].frequency); v.lfoGain.connect(v.filters[1].frequency); v.lfo.start(now); v.lfo.stop(v.end + 0.03); v.sources.push(v.lfo);
      }
      v.lfo?.frequency.setTargetAtTime(Math.max(0.001, params.lfoRate), now, 1);
      v.lfoGain?.gain.setTargetAtTime(params.lfoRate <= 0 ? 0 : params.filterCutoff * Math.max(0, Math.min(1, params.lfoDepth)), now, 0.7);
    }
  }
  private release(voice: Voice, time: number, duration: number): void {
    voice.releaseAt = time; voice.end = time + duration;
    try { voice.gain.gain.cancelScheduledValues(time); voice.gain.gain.setTargetAtTime(0.0001, time, duration / 5); } catch { /* already ended */ }
    for (const source of voice.sources) { try { source.stop(voice.end + 0.03); } catch { /* already ended */ } }
  }
  /**
   * Crossfade support for Evolve: every voice that is already sounding (or scheduled to start before `at`) fades out starting
   * at `at`, so a rearranged phrase can enter at the same moment without a cut. Voices created afterwards are untouched.
   */
  fadeOutAll(at: number, seconds = 0.28): void {
    const time = Math.max(this.ctx.currentTime, at);
    for (const voice of this.voices.values()) {
      if (voice.fading || voice.start > time) continue;
      voice.fading = true; voice.releaseAt = Math.min(voice.releaseAt, time); voice.end = Math.min(voice.end, time + seconds + 0.05);
      try { voice.gain.gain.cancelScheduledValues(time); voice.gain.gain.setTargetAtTime(0.0001, time, seconds / 4); } catch { /* graph ended */ }
      for (const source of voice.sources) { try { source.stop(time + seconds + 0.05); } catch { /* already ended */ } }
    }
  }
  /** Short fade-out for voices that must go early. Cutting a long release tail instantly is audible as a click. */
  private fade(voice: Voice, seconds = 0.06): void {
    if (voice.fading) return; voice.fading = true; const now = this.ctx.currentTime; voice.end = Math.min(voice.end, now + seconds);
    try { voice.gain.gain.cancelScheduledValues(now); voice.gain.gain.setTargetAtTime(0.0001, now, seconds / 4); } catch { /* graph ended */ }
    for (const source of voice.sources) { try { source.stop(now + seconds + 0.02); } catch { /* already ended */ } }
  }
  private kill(id: string): void {
    const v = this.voices.get(id); if (!v) return; this.voices.delete(id);
    try { v.gain.gain.cancelScheduledValues(this.ctx.currentTime); v.gain.gain.setValueAtTime(0, this.ctx.currentTime); } catch { /* graph ended */ }
    for (const source of v.sources) { source.onended = null; try { source.stop(this.ctx.currentTime); } catch { /* stopped */ } try { source.disconnect(); } catch { /* disconnected */ } }
    for (const node of v.nodes) try { node.disconnect(); } catch { /* disconnected */ }
  }
  stopAllVoices(fade = false): void { for (const [id, voice] of [...this.voices.entries()]) { if (fade) this.fade(voice); else this.kill(id); } }
}
