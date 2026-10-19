// Native Drum Synthesis Engine (Kick, Snare, Hi-Hat, Perc) with Audible Layer Volume

import { DrumVoiceParams } from '../../types';

export class DrumSynth {
  private ctx: AudioContext;
  private outputNode: AudioNode;
  private random: { next(): number };
  private voices = new Set<{ sources: AudioScheduledSourceNode[]; nodes: AudioNode[]; kind: 'kick' | 'snare' | 'hihat' | 'perc' }>();

  constructor(ctx: AudioContext, outputNode: AudioNode, random: { next(): number } = { next: Math.random }) {
    this.ctx = ctx;
    this.outputNode = outputNode;
    this.random = random;
  }

  // Trigger synthesized kick drum
  public triggerKick(time: number, velocity: number, params: DrumVoiceParams, layerVolume: number = 1.0): void {
    if (params.volume <= 0 || layerVolume <= 0 || velocity <= 0) return;
    const vel = velocity / 127.0;
    const baseFreq = Math.max(25, params.pitch ?? 55);
    const decay = Math.max(0.06, params.decay ?? 0.35);

    // Sub/Body Oscillator
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

    // Pitch Envelope: Warm analog punch drop from chest-thump down to sub fundamental
    osc.type = 'sine';
    const startFreq = baseFreq * (2.6 + (params.drive ?? 0) * 1.4);
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.18, time + 0.032);
    osc.frequency.exponentialRampToValueAtTime(Math.max(22, baseFreq * 0.88), time + decay);

    // Amplitude Envelope with layerVolume scaling
    const peakGain = (params.volume ?? 0.8) * layerVolume * vel * 0.96;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    // Warm Felt / Vinyl Beater Transient (avoids harsh high-frequency digital beep)
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'sine';
    clickOsc.frequency.setValueAtTime(baseFreq * 2.2, time);
    clickOsc.frequency.exponentialRampToValueAtTime(baseFreq, time + 0.014);
    clickGain.gain.setValueAtTime(peakGain * (0.22 + (params.tone ?? 0.5) * 0.32), time);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.014);

    clickOsc.connect(clickGain);
    clickGain.connect(gain);
    osc.connect(gain);

    // Analog tape/tube saturation on the kick body
    const kickDrive = this.saturate(gain, params.drive ?? 0.12);

    // Routing
    if (panner) {
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, params.pan ?? 0)), time);
      kickDrive.output.connect(panner);
      panner.connect(this.outputNode);
    } else {
      kickDrive.output.connect(this.outputNode);
    }

    osc.start(time);
    clickOsc.start(time);
    osc.stop(time + decay + 0.05);
    clickOsc.stop(time + 0.02);
    this.track([osc, clickOsc], [gain, clickGain, ...kickDrive.nodes, ...(panner ? [panner] : [])], osc, 'kick');
  }

  // Trigger synthesized snare drum
  public triggerSnare(time: number, velocity: number, params: DrumVoiceParams, layerVolume: number = 1.0): void {
    if (params.volume <= 0 || layerVolume <= 0 || velocity <= 0) return;
    const vel = velocity / 127.0;
    const basePitch = Math.max(100, params.pitch ?? 185);
    const decay = Math.max(0.06, params.decay ?? 0.22);
    const peakGain = (params.volume ?? 0.8) * layerVolume * vel * 0.85;
    const tone = params.tone ?? 0.5;

    // 1. Warm Woody Tonal Body (Rim / Shell resonance)
    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(basePitch * 1.48, time);
    bodyOsc.frequency.exponentialRampToValueAtTime(basePitch, time + 0.036);

    bodyGain.gain.setValueAtTime(peakGain * (0.95 - tone * 0.35), time);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + decay * 0.68);

    // 2. Dusty Organic Noise Component (Highpass + Warm Analog Lowpass Roll-Off)
    const noiseBuffer = this.generateWhiteNoiseBuffer(decay + 0.05);
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(520 + tone * 1800, time);

    const noiseLowpass = this.ctx.createBiquadFilter();
    noiseLowpass.type = 'lowpass';
    noiseLowpass.frequency.setValueAtTime(3400 + tone * 4800, time);
    noiseLowpass.Q.setValueAtTime(0.65, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(peakGain * (0.42 + tone * 0.50), time);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseLowpass);
    noiseLowpass.connect(noiseGain);

    const masterSnareGain = this.ctx.createGain();
    const snareDrive = this.saturate(masterSnareGain, params.drive);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(masterSnareGain);
    noiseGain.connect(masterSnareGain);

    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, params.pan ?? 0)), time);
      snareDrive.output.connect(panner);
      panner.connect(this.outputNode);
    } else {
      snareDrive.output.connect(this.outputNode);
    }

    bodyOsc.start(time);
    noiseSource.start(time);
    bodyOsc.stop(time + decay + 0.05);
    noiseSource.stop(time + decay + 0.05);
    this.track([bodyOsc, noiseSource], [bodyGain, noiseFilter, noiseLowpass, noiseGain, masterSnareGain, ...snareDrive.nodes, ...(panner ? [panner] : [])], noiseSource, 'snare');
  }

  // Trigger synthesized Hi-Hat
  public triggerHiHat(time: number, velocity: number, params: DrumVoiceParams, layerVolume: number = 1.0): void {
    if (params.volume <= 0 || layerVolume <= 0 || velocity <= 0) return;
    const vel = velocity / 127.0;
    const decay = Math.max(0.03, params.decay ?? 0.07);
    const peakGain = (params.volume ?? 0.75) * layerVolume * vel * 0.72;

    const noiseBuffer = this.generateWhiteNoiseBuffer(decay + 0.05);
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(5200 + (params.tone ?? 0.5) * 4000, time);

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    const centerFreq = 7600 + ((params.pitch ?? 60) - 60) * 110;
    bandpass.frequency.setValueAtTime(Math.max(2200, Math.min(14500, centerFreq)), time);
    bandpass.Q.setValueAtTime(1.8, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    noiseSource.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(gain);
    const hatDrive = this.saturate(gain, params.drive);

    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, params.pan ?? 0.2)), time);
      hatDrive.output.connect(panner);
      panner.connect(this.outputNode);
    } else {
      hatDrive.output.connect(this.outputNode);
    }

    noiseSource.start(time);
    noiseSource.stop(time + decay + 0.05);
    this.track([noiseSource], [highpass, bandpass, gain, ...hatDrive.nodes, ...(panner ? [panner] : [])], noiseSource, 'hihat');
  }

  // Trigger Percussion / FM Woodblock / Rim
  public triggerPerc(time: number, velocity: number, params: DrumVoiceParams, layerVolume: number = 1.0): void {
    if (params.volume <= 0 || layerVolume <= 0 || velocity <= 0) return;
    const vel = velocity / 127.0;
    const baseFreq = params.pitch ? params.pitch * 6.5 : 420;
    const decay = Math.max(0.03, params.decay ?? 0.12);
    const peakGain = (params.volume ?? 0.8) * layerVolume * vel * 0.8;

    const carrier = this.ctx.createOscillator();
    const modulator = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(baseFreq, time);
    carrier.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, time + decay);

    modulator.type = 'triangle';
    modulator.frequency.setValueAtTime(baseFreq * 1.48, time);

    const modIndex = baseFreq * (0.8 + (params.tone ?? 0.5) * 1.5);
    modGain.gain.setValueAtTime(modIndex, time);
    modGain.gain.exponentialRampToValueAtTime(1, time + decay * 0.5);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    carrier.connect(gain);
    const percDrive = this.saturate(gain, params.drive);

    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, params.pan ?? -0.2)), time);
      percDrive.output.connect(panner);
      panner.connect(this.outputNode);
    } else {
      percDrive.output.connect(this.outputNode);
    }

    carrier.start(time);
    modulator.start(time);
    carrier.stop(time + decay + 0.05);
    modulator.stop(time + decay + 0.05);
    this.track([carrier, modulator], [modGain, gain, ...percDrive.nodes, ...(panner ? [panner] : [])], carrier, 'perc');
  }

  private saturate(input: AudioNode, drive: number): { output: AudioNode; nodes: AudioNode[] } {
    if (!drive || drive <= 0.001 || !this.ctx.createWaveShaper) return { output: input, nodes: [] };
    const shape = this.ctx.createWaveShaper(); const amount = 1 + Math.max(0, Math.min(1, drive)) * 4; const curve = new Float32Array(256);
    for (let i = 0; i < curve.length; i++) { const x = i * 2 / (curve.length - 1) - 1; curve[i] = Math.tanh(x * amount) / Math.tanh(amount); }
    shape.curve = curve; shape.oversample = '2x'; input.connect(shape); return { output: shape, nodes: [shape] };
  }
  private track(sources: AudioScheduledSourceNode[], nodes: AudioNode[], last: AudioScheduledSourceNode, kind: 'kick' | 'snare' | 'hihat' | 'perc'): void {
    const voice = { sources, nodes, kind };
    this.voices.add(voice);
    last.onended = () => this.cleanup(voice);
    if (this.voices.size > 32) this.cleanup(this.voices.values().next().value!);
  }
  private cleanup(voice: { sources: AudioScheduledSourceNode[]; nodes: AudioNode[]; kind: 'kick' | 'snare' | 'hihat' | 'perc' }): void {
    this.voices.delete(voice);
    for (const source of voice.sources) { source.onended = null; try { source.stop(this.ctx.currentTime); } catch {} try { source.disconnect(); } catch {} }
    for (const node of voice.nodes) try { node.disconnect(); } catch {}
  }
  public stopVoiceKind(kind: 'kick' | 'snare' | 'hihat' | 'perc'): void { for (const voice of [...this.voices]) if (voice.kind === kind) this.cleanup(voice); }
  public stopAllVoices(): void { for (const voice of [...this.voices]) this.cleanup(voice); }
  public getActiveVoiceCount(): number { return this.voices.size; }

  private generateWhiteNoiseBuffer(duration: number): AudioBuffer {
    const length = Math.ceil(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = this.random.next() * 2 - 1;
    }
    return buffer;
  }
}
