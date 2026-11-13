// Solina / BBD-Style Stereo Ensemble Chorus for lush, wide pads without oscillator detune beating

export class StereoEnsemble {
  public readonly input: GainNode;
  public readonly output: GainNode;
  private ctx: AudioContext;
  private dryGain: GainNode;
  private wetGain: GainNode;
  private oscs: OscillatorNode[] = [];
  private nodes: AudioNode[] = [];
  private amount = 0.6;
  private bypassed = false;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    const now = ctx.currentTime;
    if (!ctx.createDelay || !ctx.createOscillator || !ctx.createStereoPanner) {
      this.bypassed = true;
      this.input.connect(this.output);
      return;
    }

    this.dryGain.gain.setValueAtTime(0.7, now);
    this.wetGain.gain.setValueAtTime(0.55 * this.amount, now);
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.wetGain.connect(this.output);
    this.nodes.push(this.dryGain, this.wetGain);

    const baseDelays = [0.009, 0.012, 0.015];
    const pans = [-0.8, 0, 0.8];
    const phases = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];

    baseDelays.forEach((baseDelay, i) => {
      const delay = ctx.createDelay(0.05);
      delay.delayTime.setValueAtTime(baseDelay, now);
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(pans[i], now);
      const voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(1 / 3, now);

      this.input.connect(delay);
      delay.connect(voiceGain);
      voiceGain.connect(panner);
      panner.connect(this.wetGain);
      this.nodes.push(delay, panner, voiceGain);

      const phi = phases[i];
      const lfoSlow = ctx.createOscillator();
      const lfoFast = ctx.createOscillator();
      if (typeof ctx.createPeriodicWave === 'function') {
        const real = new Float32Array([0, Math.cos(phi)]);
        const imag = new Float32Array([0, Math.sin(phi)]);
        const wave = ctx.createPeriodicWave(real, imag);
        lfoSlow.setPeriodicWave(wave);
        lfoFast.setPeriodicWave(wave);
      } else {
        lfoSlow.type = 'sine';
        lfoFast.type = 'sine';
      }

      lfoSlow.frequency.setValueAtTime(0.63, now);
      lfoFast.frequency.setValueAtTime(5.3, now);

      const depthSlow = ctx.createGain();
      depthSlow.gain.setValueAtTime(0.0016, now);
      const depthFast = ctx.createGain();
      depthFast.gain.setValueAtTime(0.00018, now);

      lfoSlow.connect(depthSlow);
      lfoFast.connect(depthFast);
      depthSlow.connect(delay.delayTime);
      depthFast.connect(delay.delayTime);

      lfoSlow.start(now);
      lfoFast.start(now);
      this.oscs.push(lfoSlow, lfoFast);
      this.nodes.push(depthSlow, depthFast);
    });
  }

  public setAmount(amount: number): void {
    this.amount = Math.max(0, Math.min(1, Number.isFinite(amount) ? amount : 0.6));
    if (this.bypassed) return;
    const now = this.ctx.currentTime;
    this.wetGain.gain.setTargetAtTime(0.55 * this.amount, now, 0.06);
  }

  public destroy(): void {
    for (const osc of this.oscs) {
      try { osc.stop(); } catch {}
      try { osc.disconnect(); } catch {}
    }
    for (const node of this.nodes) {
      try { node.disconnect(); } catch {}
    }
    try { this.input.disconnect(); } catch {}
    try { this.output.disconnect(); } catch {}
    this.oscs = [];
    this.nodes = [];
  }
}
