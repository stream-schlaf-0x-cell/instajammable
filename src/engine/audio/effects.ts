// Ambient effects rack: tape-style ping-pong delay and a dark, stereo, damped-comb reverb.
//
// Click-safety rules for this file:
//  * No delay-line length is ever automated by a control. Moving a reverb "size" slider used to
//    stretch the comb delays in real time, which produces a click on every slider step. Size now
//    scales the decay time (feedback gain) instead, which is smooth.
//  * Every continuous parameter is approached with a long setTargetAtTime constant.
//  * Wet graph replacement on Panic discards delay buffers immediately while preserving the
//    public input for connected synths.
import type { EffectsParams } from '../../types';
import type { EffectChainMode } from '../../types/jam';
import { MasterAudio } from './audioContext';

const SMOOTH = 0.12;
// BiquadFilter Q is in decibels for low-pass and high-pass. The default (+1 dB) puts a resonant bump into every feedback
// loop, and a loop gain of 0.97 times a 1.1x peak is unstable: the tail then grows without bound. -3.01 dB is a flat
// Butterworth response, so the loop gain can never exceed the feedback gain.
const FLAT_Q = -3.01;
const REVERB_BANK_LEFT = [0.0297, 0.0371, 0.0411, 0.0437, 0.0503, 0.0571];
const REVERB_BANK_RIGHT = [0.0313, 0.0389, 0.0433, 0.0461, 0.0527, 0.0599];

export class EffectsRack {
  public inputNode: GainNode;
  public dryNode: GainNode;
  public delayInput!: GainNode;
  public delayLeft!: DelayNode;
  public delayRight!: DelayNode;
  public delayFeedbackLeft!: GainNode;
  public delayFeedbackRight!: GainNode;
  public delayFilter!: BiquadFilterNode;
  public delayWet!: GainNode;
  public reverbInput!: GainNode;
  public reverbWet!: GainNode;
  public delayToReverbGain!: GainNode;
  public reverbToDelayGain!: GainNode;
  public eqHighpass!: BiquadFilterNode;
  public eqLow!: BiquadFilterNode;
  public eqMid!: BiquadFilterNode;
  public eqHigh!: BiquadFilterNode;
  public eqMasterBus!: GainNode;
  private routingMode: EffectChainMode = 'parallel';
  private bypassedEffects: Set<string> = new Set();
  private delayFlutterOsc: OscillatorNode | null = null;
  private delayFlutterGain: GainNode | null = null;
  private reverbLfo: OscillatorNode | null = null;
  private combFilters: { delay: DelayNode; feedback: GainNode; damping: BiquadFilterNode; baseDelay: number }[] = [];
  private wetNodes: AudioNode[] = [];
  private params: EffectsParams | null = null;
  constructor(private ctx: AudioContext, destinationNode: AudioNode,
    private onDrive: (value: number) => void = value => MasterAudio.getInstance().setDrive(value)) {
    const now = ctx.currentTime;
    this.eqMasterBus = ctx.createGain();
    this.eqHighpass = ctx.createBiquadFilter();
    this.eqHighpass.type = 'highpass';
    this.eqHighpass.frequency.setValueAtTime(20, now);
    this.eqHighpass.Q.setValueAtTime(FLAT_Q, now);

    this.eqLow = ctx.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.setValueAtTime(85, now);
    this.eqLow.gain.setValueAtTime(0, now);

    this.eqMid = ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.setValueAtTime(1000, now);
    this.eqMid.Q.setValueAtTime(1.0, now);
    this.eqMid.gain.setValueAtTime(0, now);

    this.eqHigh = ctx.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.setValueAtTime(7500, now);
    this.eqHigh.gain.setValueAtTime(0, now);

    this.eqMasterBus.connect(this.eqHighpass);
    this.eqHighpass.connect(this.eqLow);
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(destinationNode);

    this.inputNode = ctx.createGain(); this.dryNode = ctx.createGain();
    this.dryNode.gain.setValueAtTime(1, ctx.currentTime);
    this.inputNode.connect(this.dryNode); this.dryNode.connect(this.eqMasterBus);
    this.createWetGraph();
  }
  private keep<T extends AudioNode>(node: T): T { this.wetNodes.push(node); return node; }
  private createWetGraph(): void {
    const ctx = this.ctx, now = ctx.currentTime;
    this.delayInput = this.keep(ctx.createGain());
    this.delayWet = this.keep(ctx.createGain());
    this.delayLeft = this.keep(ctx.createDelay(2.5)); this.delayRight = this.keep(ctx.createDelay(2.5));
    this.delayFeedbackLeft = this.keep(ctx.createGain()); this.delayFeedbackRight = this.keep(ctx.createGain());
    this.delayFilter = this.keep(ctx.createBiquadFilter());
    this.delayFilter.type = 'lowpass'; this.delayFilter.frequency.setValueAtTime(2600, now); this.delayFilter.Q.setValueAtTime(FLAT_Q, now);
    const delayHighpass = this.keep(ctx.createBiquadFilter());
    delayHighpass.type = 'highpass'; delayHighpass.frequency.setValueAtTime(190, now); delayHighpass.Q.setValueAtTime(FLAT_Q, now);
    this.delayLeft.delayTime.setValueAtTime(0.375, now); this.delayRight.delayTime.setValueAtTime(0.5, now);
    this.delayFeedbackLeft.gain.setValueAtTime(0.45, now); this.delayFeedbackRight.gain.setValueAtTime(0.45, now);
    this.delayWet.gain.setValueAtTime(0.3, now);
    this.inputNode.connect(this.delayInput); this.delayInput.connect(this.delayLeft);
    // Feedback path: low-pass (tape darkening) -> high-pass (keeps repeats out of the low end) ->
    // optional soft saturation (repeats get warmer, not louder).
    this.delayLeft.connect(this.delayFilter); this.delayFilter.connect(delayHighpass);
    let loop: AudioNode = delayHighpass;
    if (ctx.createWaveShaper) {
      const shaper = this.keep(ctx.createWaveShaper()); const curve = new Float32Array(257);
      for (let i = 0; i < curve.length; i++) { const x = i * 2 / (curve.length - 1) - 1; curve[i] = Math.tanh(x * 1.6) / 1.6; } // unity slope at zero, so the saturator never adds loop gain
      shaper.curve = curve; loop.connect(shaper); loop = shaper;
    }
    loop.connect(this.delayFeedbackLeft);
    this.delayFeedbackLeft.connect(this.delayRight); this.delayRight.connect(this.delayFeedbackRight);
    this.delayFeedbackRight.connect(this.delayLeft);
    if (ctx.createStereoPanner) {
      const left = this.keep(ctx.createStereoPanner()), right = this.keep(ctx.createStereoPanner());
      left.pan.setValueAtTime(-0.7, now); right.pan.setValueAtTime(0.7, now);
      this.delayLeft.connect(left); this.delayRight.connect(right); left.connect(this.delayWet); right.connect(this.delayWet);
    } else { this.delayLeft.connect(this.delayWet); this.delayRight.connect(this.delayWet); }
    this.delayWet.connect(this.eqMasterBus);
    if (ctx.createOscillator) {
      this.delayFlutterOsc = this.keep(ctx.createOscillator()); this.delayFlutterGain = this.keep(ctx.createGain());
      this.delayFlutterOsc.frequency.setValueAtTime(0.4, now); this.delayFlutterGain.gain.setValueAtTime(0.0015, now);
      this.delayFlutterOsc.connect(this.delayFlutterGain); this.delayFlutterGain.connect(this.delayLeft.delayTime); this.delayFlutterOsc.start();
    }
    this.reverbInput = this.keep(ctx.createGain()); this.reverbWet = this.keep(ctx.createGain());
    this.reverbWet.gain.setValueAtTime(0.35, now);
    this.inputNode.connect(this.reverbInput);

    // Dynamic inter-effect routing nodes
    this.delayToReverbGain = this.keep(ctx.createGain());
    this.delayToReverbGain.gain.setValueAtTime(0, now);
    this.delayWet.connect(this.delayToReverbGain);
    this.delayToReverbGain.connect(this.reverbInput);

    this.reverbToDelayGain = this.keep(ctx.createGain());
    this.reverbToDelayGain.gain.setValueAtTime(0, now);
    this.reverbWet.connect(this.reverbToDelayGain);
    this.reverbToDelayGain.connect(this.delayInput);

    this.setupReverb(); this.reverbWet.connect(this.eqMasterBus);
  }
  private setupReverb(): void {
    const ctx = this.ctx, now = ctx.currentTime;
    // Pre-delay separates the dry attack from the wash; the high-pass keeps low-end mud out of the tail.
    const preDelay = this.keep(ctx.createDelay(0.2)); preDelay.delayTime.setValueAtTime(0.032, now);
    const highpass = this.keep(ctx.createBiquadFilter()); highpass.type = 'highpass'; highpass.frequency.setValueAtTime(150, now); highpass.Q.setValueAtTime(FLAT_Q, now);
    this.reverbInput.connect(preDelay); preDelay.connect(highpass);
    if (ctx.createOscillator) {
      this.reverbLfo = this.keep(ctx.createOscillator()); this.reverbLfo.frequency.setValueAtTime(0.13, now); this.reverbLfo.start();
    }
    const bank = (delays: number[]): GainNode => {
      const output = this.keep(ctx.createGain()); output.gain.setValueAtTime(1 / Math.sqrt(delays.length) * 0.42, now);
      for (const baseDelay of delays) {
        const delay = this.keep(ctx.createDelay(0.25)); delay.delayTime.setValueAtTime(baseDelay, now);
        const damping = this.keep(ctx.createBiquadFilter()); damping.type = 'lowpass'; damping.frequency.setValueAtTime(3300, now); damping.Q.setValueAtTime(FLAT_Q, now);
        const feedback = this.keep(ctx.createGain()); feedback.gain.setValueAtTime(0.8, now);
        highpass.connect(delay); delay.connect(damping); damping.connect(feedback); feedback.connect(delay); delay.connect(output);
        // A very slow, sub-millisecond wobble keeps the tail from ringing metallically. It is constant, never user-driven.
        if (this.reverbLfo) { const wobble = this.keep(ctx.createGain()); wobble.gain.setValueAtTime(0.0003 * (1 + baseDelay * 8), now); this.reverbLfo.connect(wobble); wobble.connect(delay.delayTime); }
        this.combFilters.push({ delay, feedback, damping, baseDelay });
      }
      return output;
    };
    const left = bank(REVERB_BANK_LEFT), right = bank(REVERB_BANK_RIGHT);
    // Diffusion is applied to the summed banks; the raw banks are additionally spread left/right.
    const sum = this.keep(ctx.createGain()); left.connect(sum); right.connect(sum);
    let previous: AudioNode = sum;
    for (const time of [0.0051, 0.0017]) {
      const mix = this.keep(ctx.createGain()), output = this.keep(ctx.createGain());
      const delay = this.keep(ctx.createDelay(0.1)); delay.delayTime.setValueAtTime(time, now);
      const feedback = this.keep(ctx.createGain()), feedforward = this.keep(ctx.createGain());
      feedback.gain.setValueAtTime(0.7, now); feedforward.gain.setValueAtTime(-0.7, now);
      // H(z) = (z^-D - g) / (1 - g z^-D): genuine allpass, not two FIR taps.
      previous.connect(mix); mix.connect(delay); mix.connect(feedforward); feedforward.connect(output);
      delay.connect(output); delay.connect(feedback); feedback.connect(mix);
      previous = output;
    }
    const diffuse = this.keep(ctx.createGain()); diffuse.gain.setValueAtTime(0.5, now); previous.connect(diffuse);
    if (ctx.createStereoPanner) {
      const panLeft = this.keep(ctx.createStereoPanner()), panRight = this.keep(ctx.createStereoPanner());
      panLeft.pan.setValueAtTime(-0.85, now); panRight.pan.setValueAtTime(0.85, now);
      left.connect(panLeft); right.connect(panRight); panLeft.connect(this.reverbWet); panRight.connect(this.reverbWet);
    } else { left.connect(this.reverbWet); right.connect(this.reverbWet); }
    diffuse.connect(this.reverbWet);
  }
  public updateParams(params: EffectsParams): void {
    this.params = { ...params };
    const now = this.ctx.currentTime;
    const bounded = (value: number, low: number, high: number) => Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : low;

    const delayBypassed = this.bypassedEffects.has('delay');
    const reverbBypassed = this.bypassedEffects.has('reverb');
    const flutterBypassed = this.bypassedEffects.has('flutter');
    const warmthBypassed = this.bypassedEffects.has('warmth');
    const eqBypassed = this.bypassedEffects.has('eq');

    // Delay time glides like a tape head: a slow time constant means a tempo change slides instead of clicking.
    this.delayLeft.delayTime.setTargetAtTime(bounded(params.delayTime * 0.75, 0.04, 2), now, 0.3);
    this.delayRight.delayTime.setTargetAtTime(bounded(params.delayTime, 0.04, 2), now, 0.3);
    this.delayFeedbackLeft.gain.setTargetAtTime(bounded(params.delayFeedback, 0, 0.9), now, SMOOTH);
    this.delayFeedbackRight.gain.setTargetAtTime(bounded(params.delayFeedback, 0, 0.9), now, SMOOTH);
    this.delayWet.gain.setTargetAtTime(delayBypassed ? 0 : bounded(params.delayMix, 0, 0.8), now, SMOOTH);
    this.delayFlutterGain?.gain.setTargetAtTime(flutterBypassed ? 0 : bounded(params.delayFlutter, 0, 1) * 0.004, now, SMOOTH);
    const tone = bounded(params.delayTone ?? 0.45, 0, 1);
    this.delayFilter.frequency.setTargetAtTime(700 * Math.pow(9, tone), now, 0.2);
    // RT60 mapping: with a loop delay d and decay T, g = 10^(-3d/T) falls exactly 60 dB after T seconds.
    const size = bounded(params.reverbSize ?? 0.8, 0, 1);
    const decay = bounded(params.reverbDecay * (0.6 + size * 0.8), 0.2, 16);
    const damping = bounded(params.reverbDamping ?? 0.55, 0, 1);
    for (const comb of this.combFilters) {
      comb.feedback.gain.setTargetAtTime(bounded(Math.pow(10, -3 * comb.baseDelay / decay), 0.2, 0.96), now, SMOOTH);
      comb.damping.frequency.setTargetAtTime(1000 + (1 - damping) * 7000, now, 0.2);
    }
    this.reverbWet.gain.setTargetAtTime(reverbBypassed ? 0 : bounded(params.reverbMix, 0, 0.8), now, SMOOTH);
    if (params.masterDrive !== undefined) this.onDrive(warmthBypassed ? 0 : params.masterDrive);

    // Apply inter-effect routing gains
    const d2r = !delayBypassed && !reverbBypassed && this.routingMode === 'delay-into-reverb' ? 0.65 : 0;
    const r2d = !delayBypassed && !reverbBypassed && this.routingMode === 'reverb-into-delay' ? 0.65 : 0;
    this.delayToReverbGain?.gain.setTargetAtTime(d2r, now, SMOOTH);
    this.reverbToDelayGain?.gain.setTargetAtTime(r2d, now, SMOOTH);

    // Master Studio EQ automation
    const eqLow = eqBypassed ? 0 : bounded(params.eqLow ?? 0, -14, 14);
    const eqMid = eqBypassed ? 0 : bounded(params.eqMid ?? 0, -14, 14);
    const eqMidFreq = bounded(params.eqMidFreq ?? 1000, 200, 6000);
    const eqMidQ = bounded(params.eqMidQ ?? 1.0, 0.3, 4.0);
    const eqHigh = eqBypassed ? 0 : bounded(params.eqHigh ?? 0, -14, 14);
    const eqHighpass = eqBypassed ? 20 : bounded(params.eqHighpass ?? 20, 20, 400);

    this.eqLow.gain.setTargetAtTime(eqLow, now, SMOOTH);
    this.eqMid.gain.setTargetAtTime(eqMid, now, SMOOTH);
    this.eqMid.frequency.setTargetAtTime(eqMidFreq, now, SMOOTH);
    this.eqMid.Q.setTargetAtTime(eqMidQ, now, SMOOTH);
    this.eqHigh.gain.setTargetAtTime(eqHigh, now, SMOOTH);
    this.eqHighpass.frequency.setTargetAtTime(eqHighpass, now, SMOOTH);
  }
  public getFrequencyResponse(frequencies: Float32Array): Float32Array {
    const n = frequencies.length;
    const magTotal = new Float32Array(n).fill(1.0);
    const mag = new Float32Array(n);
    const phase = new Float32Array(n);

    const filters = [this.eqHighpass, this.eqLow, this.eqMid, this.eqHigh];
    for (const f of filters) {
      if (f && typeof f.getFrequencyResponse === 'function') {
        f.getFrequencyResponse(
          frequencies as unknown as Float32Array<ArrayBuffer>,
          mag as unknown as Float32Array<ArrayBuffer>,
          phase as unknown as Float32Array<ArrayBuffer>,
        );
        for (let i = 0; i < n; i++) magTotal[i] *= mag[i];
      }
    }

    const db = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      db[i] = 20 * Math.log10(Math.max(1e-4, magTotal[i]));
    }
    return db;
  }
  public setRoutingMode(mode: EffectChainMode): void {
    this.routingMode = mode;
    if (this.params) this.updateParams(this.params);
  }
  public getRoutingMode(): EffectChainMode { return this.routingMode; }
  public setBypass(effect: string, bypassed: boolean): void {
    if (bypassed) this.bypassedEffects.add(effect);
    else this.bypassedEffects.delete(effect);
    if (this.params) this.updateParams(this.params);
  }
  public isBypassed(effect: string): boolean {
    return this.bypassedEffects.has(effect);
  }
  public killTail(): void {
    try { this.inputNode.disconnect(this.delayInput); } catch { /* detached */ }
    try { this.inputNode.disconnect(this.reverbInput); } catch { /* detached */ }
    try { this.delayFlutterOsc?.stop(); } catch { /* stopped */ }
    try { this.reverbLfo?.stop(); } catch { /* stopped */ }
    for (const node of this.wetNodes) node.disconnect();
    this.wetNodes = []; this.combFilters = []; this.delayFlutterOsc = null; this.delayFlutterGain = null; this.reverbLfo = null;
    this.createWetGraph();
    if (this.params) this.updateParams(this.params);
  }
}
