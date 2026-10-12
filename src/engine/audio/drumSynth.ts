// Native Drum Synthesis Engine (Kick, Snare, Hi-Hat, Perc)

import { DrumVoiceParams } from '../../types';

export class DrumSynth {
  private ctx: AudioContext;
  private outputNode: AudioNode;

  constructor(ctx: AudioContext, outputNode: AudioNode) {
    this.ctx = ctx;
    this.outputNode = outputNode;
  }

  // Trigger synthesized kick drum
  public triggerKick(time: number, velocity: number, params: DrumVoiceParams): void {
    const vel = velocity / 127;
    const baseFreq = params.pitch || 55;
    const decay = Math.max(0.08, params.decay || 0.35);

    // Sub/Body Oscillator
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

    // Pitch Envelope: Punch drop from high frequency down to base sub
    osc.type = 'sine';
    const startFreq = baseFreq * (3.5 + params.drive * 1.5);
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, time + 0.045);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, baseFreq * 0.8), time + decay);

    // Amplitude Envelope
    const peakGain = params.volume * vel * 0.95;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

    // Click / Transient noise for top-end attack
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(startFreq * 2.5, time);
    clickGain.gain.setValueAtTime(peakGain * (0.4 + params.tone * 0.4), time);
    clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.012);

    clickOsc.connect(clickGain);
    clickGain.connect(gain);

    // Routing
    if (panner) {
      panner.pan.setValueAtTime(params.pan || 0, time);
      gain.connect(panner);
      panner.connect(this.outputNode);
    } else {
      gain.connect(this.outputNode);
    }

    osc.connect(gain);
    osc.start(time);
    clickOsc.start(time);
    osc.stop(time + decay + 0.05);
    clickOsc.stop(time + 0.02);
  }

  // Trigger synthesized snare drum
  public triggerSnare(time: number, velocity: number, params: DrumVoiceParams): void {
    const vel = velocity / 127;
    const basePitch = params.pitch || 185;
    const decay = Math.max(0.08, params.decay || 0.22);
    const peakGain = params.volume * vel * 0.8;

    // 1. Tonal Body (dual tone)
    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(basePitch * 1.6, time);
    bodyOsc.frequency.exponentialRampToValueAtTime(basePitch, time + 0.04);

    bodyGain.gain.setValueAtTime(peakGain * (1 - params.tone * 0.5), time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + decay * 0.7);

    // 2. Snappy Noise Component
    const noiseBuffer = this.generateWhiteNoiseBuffer(decay);
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(800 + params.tone * 2000, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(peakGain * (0.6 + params.tone * 0.6), time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + decay);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);

    const masterSnareGain = this.ctx.createGain();
    bodyOsc.connect(bodyGain);
    bodyGain.connect(masterSnareGain);
    noiseGain.connect(masterSnareGain);

    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.setValueAtTime(params.pan || 0, time);
      masterSnareGain.connect(panner);
      panner.connect(this.outputNode);
    } else {
      masterSnareGain.connect(this.outputNode);
    }

    bodyOsc.start(time);
    noiseSource.start(time);
    bodyOsc.stop(time + decay + 0.05);
    noiseSource.stop(time + decay + 0.05);
  }

  // Trigger synthesized Hi-Hat
  public triggerHiHat(time: number, velocity: number, params: DrumVoiceParams): void {
    const vel = velocity / 127;
    const decay = Math.max(0.03, params.decay || 0.07);
    const peakGain = params.volume * vel * 0.7;

    // Metallic cluster using filtered noise + highpass band
    const noiseBuffer = this.generateWhiteNoiseBuffer(decay + 0.05);
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(6500 + params.tone * 3500, time);

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(9500 + (params.pitch - 60) * 100, time);
    bandpass.Q.setValueAtTime(2.5, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0005, time + decay);

    noiseSource.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(gain);

    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.setValueAtTime(params.pan || 0.25, time);
      gain.connect(panner);
      panner.connect(this.outputNode);
    } else {
      gain.connect(this.outputNode);
    }

    noiseSource.start(time);
    noiseSource.stop(time + decay + 0.05);
  }

  // Trigger Percussion / Organic Woodblock / Rim / FM Click
  public triggerPerc(time: number, velocity: number, params: DrumVoiceParams): void {
    const vel = velocity / 127;
    const baseFreq = params.pitch ? params.pitch * 6.5 : 420;
    const decay = Math.max(0.03, params.decay || 0.12);
    const peakGain = params.volume * vel * 0.75;

    // FM Pair: Modulator -> Carrier
    const carrier = this.ctx.createOscillator();
    const modulator = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(baseFreq, time);
    carrier.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, time + decay);

    modulator.type = 'triangle';
    modulator.frequency.setValueAtTime(baseFreq * 1.48, time); // Inharmonic metallic ratio

    const modIndex = baseFreq * (0.8 + params.tone * 1.5);
    modGain.gain.setValueAtTime(modIndex, time);
    modGain.gain.exponentialRampToValueAtTime(1, time + decay * 0.5);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

    carrier.connect(gain);

    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.setValueAtTime(params.pan || -0.3, time);
      gain.connect(panner);
      panner.connect(this.outputNode);
    } else {
      gain.connect(this.outputNode);
    }

    carrier.start(time);
    modulator.start(time);
    carrier.stop(time + decay + 0.05);
    modulator.stop(time + decay + 0.05);
  }

  // Helper: In-memory white noise buffer generator
  private generateWhiteNoiseBuffer(duration: number): AudioBuffer {
    const length = Math.ceil(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}
