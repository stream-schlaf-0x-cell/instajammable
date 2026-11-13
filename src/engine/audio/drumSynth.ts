// Native Drum Synthesis Engine (Kick, Snare, Hi-Hat, Perc) with Audible Layer Volume & Diverse Drum Models

import type { DrumVoiceParams } from '../../types';
import type { DrumModel } from '../../types/jam';

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

    // Pitch Envelope: 3-stage warm analog punch drop from beater snap -> chest-thump -> sub fundamental
    osc.type = 'sine';
    const startFreq = baseFreq * (2.75 + (params.drive ?? 0) * 1.45);
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.26, time + 0.022);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.02, time + Math.min(decay * 0.45, 0.075));
    osc.frequency.exponentialRampToValueAtTime(Math.max(22, baseFreq * 0.88), time + decay);

    // Amplitude Envelope with layerVolume scaling (+3 dB kick headroom boost)
    const peakGain = (params.volume ?? 0.8) * layerVolume * vel * 1.35;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    // Warm Felt / Wooden Beater Transient (avoids harsh high-frequency digital beep)
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(baseFreq * 2.35, time);
    clickOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.95, time + 0.015);
    clickGain.gain.setValueAtTime(peakGain * (0.20 + (params.tone ?? 0.5) * 0.34), time);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.015);

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
  public triggerSnare(time: number, velocity: number, params: DrumVoiceParams, layerVolume: number = 1.0, model?: DrumModel): void {
    if (params.volume <= 0 || layerVolume <= 0 || velocity <= 0) return;
    const vel = velocity / 127.0;
    const basePitch = Math.max(100, params.pitch ?? 185);
    const decay = Math.max(0.06, params.decay ?? 0.22);
    const peakGain = (params.volume ?? 0.8) * layerVolume * vel * 0.85;
    const tone = params.tone ?? 0.5;

    if (model === 'clap') {
      const clapDecay = Math.max(0.12, decay);
      const noiseBuffer = this.generateWhiteNoiseBuffer(clapDecay + 0.08);
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1400 + tone * 500, time);
      bp.Q.setValueAtTime(1.1, time);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, time);
      for (const offset of [0, 0.010, 0.022, 0.034]) {
        gain.gain.setValueAtTime(peakGain * (offset === 0.034 ? 0.95 : 0.72), time + offset);
        gain.gain.exponentialRampToValueAtTime(peakGain * 0.14, time + offset + 0.008);
      }
      gain.gain.exponentialRampToValueAtTime(0.0001, time + clapDecay);
      noiseSource.connect(bp);
      bp.connect(gain);
      const drive = this.saturate(gain, params.drive);
      const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      if (panner) { panner.pan.setValueAtTime(Math.max(-1, Math.min(1, params.pan ?? 0)), time); drive.output.connect(panner); panner.connect(this.outputNode); }
      else drive.output.connect(this.outputNode);
      noiseSource.start(time);
      noiseSource.stop(time + clapDecay + 0.05);
      this.track([noiseSource], [bp, gain, ...drive.nodes, ...(panner ? [panner] : [])], noiseSource, 'snare');
      return;
    }

    if (model === 'rim') {
      this.triggerPerc(time, velocity, { ...params, pitch: 58, decay: Math.min(0.05, decay * 0.4) }, layerVolume, 'rim');
      return;
    }

    if (model === 'brush') {
      const brushDecay = Math.max(0.14, decay);
      const noiseBuffer = this.generateWhiteNoiseBuffer(brushDecay + 0.05);
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2200 + tone * 2400, time);
      bp.Q.setValueAtTime(0.7, time);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(peakGain * 0.75, time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + brushDecay);
      noiseSource.connect(bp);
      bp.connect(gain);
      const drive = this.saturate(gain, params.drive);
      const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      if (panner) { panner.pan.setValueAtTime(Math.max(-1, Math.min(1, params.pan ?? 0)), time); drive.output.connect(panner); panner.connect(this.outputNode); }
      else drive.output.connect(this.outputNode);
      noiseSource.start(time);
      noiseSource.stop(time + brushDecay + 0.05);
      this.track([noiseSource], [bp, gain, ...drive.nodes, ...(panner ? [panner] : [])], noiseSource, 'snare');
      return;
    }

    // 1. Warm Dual-Oscillator Woody Tonal Body (Fundamental Shell + Acoustic 1.58x Rim Overtone)
    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(basePitch * 1.48, time);
    bodyOsc.frequency.exponentialRampToValueAtTime(basePitch, time + 0.036);

    bodyGain.gain.setValueAtTime(peakGain * (0.88 - tone * 0.30), time);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + decay * 0.72);

    const rimOsc = this.ctx.createOscillator();
    const rimGain = this.ctx.createGain();
    rimOsc.type = 'sine';
    rimOsc.frequency.setValueAtTime(basePitch * 2.12, time);
    rimOsc.frequency.exponentialRampToValueAtTime(basePitch * 1.58, time + 0.024);
    const rimDecay = Math.min(decay * 0.55, 0.065);
    rimGain.gain.setValueAtTime(peakGain * (0.28 + tone * 0.32), time);
    rimGain.gain.exponentialRampToValueAtTime(0.0001, time + rimDecay);

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
    rimOsc.connect(rimGain);
    rimGain.connect(masterSnareGain);
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
    rimOsc.start(time);
    noiseSource.start(time);
    bodyOsc.stop(time + decay + 0.05);
    rimOsc.stop(time + rimDecay + 0.02);
    noiseSource.stop(time + decay + 0.05);
    this.track([bodyOsc, rimOsc, noiseSource], [bodyGain, rimGain, noiseFilter, noiseLowpass, noiseGain, masterSnareGain, ...snareDrive.nodes, ...(panner ? [panner] : [])], noiseSource, 'snare');
  }

  // Trigger synthesized Hi-Hat
  public triggerHiHat(time: number, velocity: number, params: DrumVoiceParams, layerVolume: number = 1.0, model: DrumModel = 'closedHat'): void {
    if (params.volume <= 0 || layerVolume <= 0 || velocity <= 0) return;
    const vel = velocity / 127.0;
    const decay = Math.max(0.03, params.decay ?? 0.07);
    const peakGain = (params.volume ?? 0.75) * layerVolume * vel * 0.72;
    const pitchVal = params.pitch ?? 40;
    const toneVal = params.tone ?? 0.1;

    if (model === 'shakerHat') {
      const shDecay = Math.max(0.055, decay * 1.45);
      const noiseBuffer = this.generateWhiteNoiseBuffer(shDecay + 0.05);
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(6200 + (pitchVal - 36) * 140, time);
      bp.Q.setValueAtTime(1.15, time);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(peakGain * 0.85, time + 0.009);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + shDecay);
      noiseSource.connect(bp);
      bp.connect(gain);
      const hatDrive = this.saturate(gain, params.drive);
      const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      if (panner) { panner.pan.setValueAtTime(Math.max(-1, Math.min(1, params.pan ?? 0.2)), time); hatDrive.output.connect(panner); panner.connect(this.outputNode); }
      else hatDrive.output.connect(this.outputNode);
      noiseSource.start(time);
      noiseSource.stop(time + shDecay + 0.05);
      this.track([noiseSource], [bp, gain, ...hatDrive.nodes, ...(panner ? [panner] : [])], noiseSource, 'hihat');
      return;
    }

    const noiseBuffer = this.generateWhiteNoiseBuffer(decay + 0.05);
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    // Dual-Oscillator Metallic Cymbal Shimmer Partials (subtle 808/909/cymbal sheen blended with organic shaker noise)
    const metalOsc1 = this.ctx.createOscillator();
    const metalOsc2 = this.ctx.createOscillator();
    const metalGain = this.ctx.createGain();
    metalOsc1.type = 'square';
    metalOsc2.type = 'triangle';
    metalOsc1.frequency.setValueAtTime(2950 + pitchVal * 32, time);
    metalOsc2.frequency.setValueAtTime(4410 + pitchVal * 48, time);
    metalGain.gain.setValueAtTime(peakGain * (0.05 + toneVal * 0.22), time);
    metalGain.gain.exponentialRampToValueAtTime(0.0001, time + decay * 0.75);

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(5000 + toneVal * 4000, time);

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    const centerFreq = 7600 + (pitchVal - 60) * 110;
    bandpass.frequency.setValueAtTime(Math.max(2200, Math.min(14500, centerFreq)), time);
    bandpass.Q.setValueAtTime(1.65, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    metalOsc1.connect(metalGain);
    metalOsc2.connect(metalGain);
    metalGain.connect(highpass);
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
    metalOsc1.start(time);
    metalOsc2.start(time);
    noiseSource.stop(time + decay + 0.05);
    metalOsc1.stop(time + decay + 0.03);
    metalOsc2.stop(time + decay + 0.03);
    this.track([noiseSource, metalOsc1, metalOsc2], [metalGain, highpass, bandpass, gain, ...hatDrive.nodes, ...(panner ? [panner] : [])], noiseSource, 'hihat');
  }

  // Trigger Percussion with distinct acoustic/electronic synthesis models
  public triggerPerc(time: number, velocity: number, params: DrumVoiceParams, layerVolume: number = 1.0, model: DrumModel = 'woodblock'): void {
    if (params.volume <= 0 || layerVolume <= 0 || velocity <= 0) return;
    const vel = velocity / 127.0;
    const baseFreq = params.pitch ? params.pitch * 6.5 : 420;
    const decay = Math.max(0.03, params.decay ?? 0.12);
    const peakGain = (params.volume ?? 0.8) * layerVolume * vel * 0.8;
    const toneVal = params.tone ?? 0.25;

    const routePerc = (out: AudioNode, sources: AudioScheduledSourceNode[], nodes: AudioNode[], last: AudioScheduledSourceNode) => {
      const percDrive = this.saturate(out, params.drive);
      const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      if (panner) {
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, params.pan ?? -0.2)), time);
        percDrive.output.connect(panner);
        panner.connect(this.outputNode);
      } else {
        percDrive.output.connect(this.outputNode);
      }
      this.track(sources, [...nodes, ...percDrive.nodes, ...(panner ? [panner] : [])], last, 'perc');
    };

    switch (model) {
      case 'shaker': {
        const shDecay = Math.max(0.06, Math.min(0.11, decay));
        const buf = this.generateWhiteNoiseBuffer(shDecay + 0.05);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(6000 + toneVal * 3000, time);
        bp.Q.setValueAtTime(1.2, time);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(peakGain * 0.8, time + 0.008);
        gain.gain.setValueAtTime(peakGain * 0.8 * 0.35, time + 0.012);
        gain.gain.linearRampToValueAtTime(peakGain * 0.28, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + shDecay);
        src.connect(bp); bp.connect(gain);
        src.start(time); src.stop(time + shDecay + 0.04);
        routePerc(gain, [src], [bp, gain], src);
        return;
      }
      case 'rim': {
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc1.type = 'sine'; osc2.type = 'sine';
        osc1.frequency.setValueAtTime(1700, time);
        osc2.frequency.setValueAtTime(470, time);
        oscGain.gain.setValueAtTime(peakGain * 0.9, time);
        oscGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
        const clickBuf = this.generateWhiteNoiseBuffer(0.015);
        const clickSrc = this.ctx.createBufferSource();
        clickSrc.buffer = clickBuf;
        const clickGain = this.ctx.createGain();
        clickGain.gain.setValueAtTime(peakGain * 0.65, time);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.004);
        const sum = this.ctx.createGain();
        osc1.connect(oscGain); osc2.connect(oscGain); oscGain.connect(sum);
        clickSrc.connect(clickGain); clickGain.connect(sum);
        osc1.start(time); osc2.start(time); clickSrc.start(time);
        osc1.stop(time + 0.05); osc2.stop(time + 0.05); clickSrc.stop(time + 0.012);
        routePerc(sum, [osc1, osc2, clickSrc], [oscGain, clickGain, sum], osc1);
        return;
      }
      case 'conga': {
        const cDecay = Math.max(0.18, Math.min(0.26, decay * 1.4));
        const osc = this.ctx.createOscillator();
        const bp = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const cFreq = Math.max(150, Math.min(340, baseFreq * 0.65));
        osc.frequency.setValueAtTime(cFreq * 1.35, time);
        osc.frequency.exponentialRampToValueAtTime(cFreq, time + 0.03);
        bp.type = 'bandpass'; bp.frequency.setValueAtTime(cFreq * 1.4, time); bp.Q.setValueAtTime(0.9, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(peakGain * 0.95, time + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + cDecay);
        osc.connect(bp); bp.connect(gain);
        osc.start(time); osc.stop(time + cDecay + 0.04);
        routePerc(gain, [osc], [bp, gain], osc);
        return;
      }
      case 'clave': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2500, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(peakGain * 0.72, time + 0.0015);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
        osc.connect(gain);
        osc.start(time); osc.stop(time + 0.06);
        routePerc(gain, [osc], [gain], osc);
        return;
      }
      case 'glassDrop': {
        const gDecay = Math.max(0.32, Math.min(0.45, decay * 2.4));
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const g1 = this.ctx.createGain();
        const g2 = this.ctx.createGain();
        const sum = this.ctx.createGain();
        const f = Math.max(520, baseFreq * 1.8);
        osc1.type = 'sine'; osc2.type = 'sine';
        osc1.frequency.setValueAtTime(f, time);
        osc2.frequency.setValueAtTime(f * 2.76, time);
        g1.gain.setValueAtTime(0, time);
        g1.gain.linearRampToValueAtTime(peakGain * 0.45, time + 0.003);
        g1.gain.exponentialRampToValueAtTime(0.0001, time + gDecay);
        g2.gain.setValueAtTime(0, time);
        g2.gain.linearRampToValueAtTime(peakGain * 0.22, time + 0.002);
        g2.gain.exponentialRampToValueAtTime(0.0001, time + gDecay * 0.55);
        osc1.connect(g1); osc2.connect(g2); g1.connect(sum); g2.connect(sum);
        osc1.start(time); osc2.start(time);
        osc1.stop(time + gDecay + 0.04); osc2.stop(time + gDecay * 0.6);
        routePerc(sum, [osc1, osc2], [g1, g2, sum], osc1);
        return;
      }
      case 'tablaTick': {
        const tDecay = 0.12;
        const osc = this.ctx.createOscillator();
        const bp = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        const f = Math.max(220, Math.min(480, baseFreq * 0.9));
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, time);
        osc.frequency.exponentialRampToValueAtTime(f * 1.3, time + 0.035);
        bp.type = 'bandpass'; bp.frequency.setValueAtTime(900, time); bp.Q.setValueAtTime(1.5, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(peakGain * 0.85, time + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + tDecay);
        osc.connect(bp); bp.connect(gain);
        osc.start(time); osc.stop(time + tDecay + 0.03);
        routePerc(gain, [osc], [bp, gain], osc);
        return;
      }
      case 'vinylTick': {
        const buf = this.generateWhiteNoiseBuffer(0.015);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.setValueAtTime(3000, time);
        const gain = this.ctx.createGain();
        const randScale = 0.35 + this.random.next() * 0.65;
        gain.gain.setValueAtTime(peakGain * 0.32 * randScale, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.003);
        src.connect(hp); hp.connect(gain);
        src.start(time); src.stop(time + 0.012);
        routePerc(gain, [src], [hp, gain], src);
        return;
      }
      case 'tick808': {
        const osc = this.ctx.createOscillator();
        const bp = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1250 + toneVal * 800, time);
        bp.type = 'bandpass'; bp.frequency.setValueAtTime(3500, time); bp.Q.setValueAtTime(2.0, time);
        gain.gain.setValueAtTime(peakGain * 0.68, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.014);
        osc.connect(bp); bp.connect(gain);
        osc.start(time); osc.stop(time + 0.02);
        routePerc(gain, [osc], [bp, gain], osc);
        return;
      }
      case 'woodblock':
      default:
        break;
    }

    const carrier = this.ctx.createOscillator();
    const modulator = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const percFilter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(baseFreq, time);
    carrier.frequency.exponentialRampToValueAtTime(baseFreq * 0.89, time + decay);

    modulator.type = 'triangle';
    modulator.frequency.setValueAtTime(baseFreq * 1.48, time);

    const modIndex = baseFreq * (0.75 + toneVal * 1.45);
    modGain.gain.setValueAtTime(modIndex, time);
    modGain.gain.exponentialRampToValueAtTime(1, time + decay * 0.5);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    // Warm resonant cavity filter for natural wood/conga/drop body
    percFilter.type = 'lowpass';
    percFilter.frequency.setValueAtTime(Math.min(12000, baseFreq * (2.6 + toneVal * 4.2)), time);
    percFilter.Q.setValueAtTime(1.2, time);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    carrier.connect(percFilter);
    percFilter.connect(gain);
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
    this.track([carrier, modulator], [modGain, percFilter, gain, ...percDrive.nodes, ...(panner ? [panner] : [])], carrier, 'perc');
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
