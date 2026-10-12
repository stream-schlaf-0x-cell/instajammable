// Effects Rack: Stereo Ping-Pong Delay + Algorithmic Diffusion Reverb

import { EffectsParams } from '../../types';

export class EffectsRack {
  private ctx: AudioContext;
  public inputNode: GainNode;
  public dryNode: GainNode;
  
  // Delay nodes
  public delayInput: GainNode;
  public delayLeft: DelayNode;
  public delayRight: DelayNode;
  public delayFeedbackLeft: GainNode;
  public delayFeedbackRight: GainNode;
  public delayFilter: BiquadFilterNode;
  public delayWet: GainNode;
  private delayFlutterOsc: OscillatorNode | null = null;
  private delayFlutterGain: GainNode | null = null;

  // Reverb nodes (Algorithmic 4-comb + 2-allpass diffusion network)
  public reverbInput: GainNode;
  public reverbWet: GainNode;
  private combFilters: { delay: DelayNode; feedback: GainNode; filter: BiquadFilterNode }[] = [];
  private allpassFilters: { delay: DelayNode; gain1: GainNode; gain2: GainNode }[] = [];

  constructor(ctx: AudioContext, destinationNode: AudioNode) {
    this.ctx = ctx;

    // Master input for all audio elements
    this.inputNode = ctx.createGain();
    this.dryNode = ctx.createGain();
    this.dryNode.gain.setValueAtTime(1.0, ctx.currentTime);
    this.dryNode.connect(destinationNode);

    // --- Stereo Ping-Pong Delay Setup ---
    this.delayInput = ctx.createGain();
    this.delayWet = ctx.createGain();
    this.delayLeft = ctx.createDelay(2.0);
    this.delayRight = ctx.createDelay(2.0);
    this.delayFeedbackLeft = ctx.createGain();
    this.delayFeedbackRight = ctx.createGain();
    this.delayFilter = ctx.createBiquadFilter();
    this.delayFilter.type = 'lowpass';
    this.delayFilter.frequency.setValueAtTime(3200, ctx.currentTime);

    // Initial delay values
    this.delayLeft.delayTime.setValueAtTime(0.375, ctx.currentTime);  // e.g. dotted 8th
    this.delayRight.delayTime.setValueAtTime(0.5, ctx.currentTime);   // e.g. quarter note
    this.delayFeedbackLeft.gain.setValueAtTime(0.45, ctx.currentTime);
    this.delayFeedbackRight.gain.setValueAtTime(0.45, ctx.currentTime);
    this.delayWet.gain.setValueAtTime(0.3, ctx.currentTime);

    // Cross-feedback ping-pong routing
    this.inputNode.connect(this.delayInput);
    this.inputNode.connect(this.dryNode);

    this.delayInput.connect(this.delayLeft);
    this.delayLeft.connect(this.delayFilter);
    this.delayFilter.connect(this.delayFeedbackLeft);
    this.delayFeedbackLeft.connect(this.delayRight);

    this.delayRight.connect(this.delayFeedbackRight);
    this.delayFeedbackRight.connect(this.delayLeft);

    // Stereo panning for delay taps
    const pannerL = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const pannerR = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    if (pannerL && pannerR) {
      pannerL.pan.setValueAtTime(-0.7, ctx.currentTime);
      pannerR.pan.setValueAtTime(0.7, ctx.currentTime);
      this.delayLeft.connect(pannerL);
      this.delayRight.connect(pannerR);
      pannerL.connect(this.delayWet);
      pannerR.connect(this.delayWet);
    } else {
      this.delayLeft.connect(this.delayWet);
      this.delayRight.connect(this.delayWet);
    }

    this.delayWet.connect(destinationNode);

    // Subtle tape flutter LFO on delay
    try {
      this.delayFlutterOsc = ctx.createOscillator();
      this.delayFlutterGain = ctx.createGain();
      this.delayFlutterOsc.frequency.setValueAtTime(0.4, ctx.currentTime); // slow tape drift
      this.delayFlutterGain.gain.setValueAtTime(0.0015, ctx.currentTime);  // subtle drift
      this.delayFlutterOsc.connect(this.delayFlutterGain);
      this.delayFlutterGain.connect(this.delayLeft.delayTime);
      this.delayFlutterOsc.start();
    } catch {
      // AudioContext flutter start fallback
    }

    // --- Algorithmic Diffuser Reverb Setup ---
    this.reverbInput = ctx.createGain();
    this.reverbWet = ctx.createGain();
    this.reverbWet.gain.setValueAtTime(0.35, ctx.currentTime);

    this.inputNode.connect(this.reverbInput);
    this.setupDiffuserReverb();
    this.reverbWet.connect(destinationNode);
  }

  private setupDiffuserReverb(): void {
    // 4 Parallel Comb Filters with prime delay times to minimize metallic resonance
    const combTimes = [0.0297, 0.0371, 0.0411, 0.0437];
    const combGain = 0.78;

    const combOutput = this.ctx.createGain();

    combTimes.forEach((time) => {
      const delay = this.ctx.createDelay(1.0);
      delay.delayTime.setValueAtTime(time, this.ctx.currentTime);

      const feedback = this.ctx.createGain();
      feedback.gain.setValueAtTime(combGain, this.ctx.currentTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4500, this.ctx.currentTime); // Damping

      this.reverbInput.connect(delay);
      delay.connect(filter);
      filter.connect(feedback);
      feedback.connect(delay);

      delay.connect(combOutput);
      this.combFilters.push({ delay, feedback, filter });
    });

    // 2 Cascaded Allpass Filters for dense diffusion
    const allpassTimes = [0.0051, 0.0017];
    let prevNode: AudioNode = combOutput;

    allpassTimes.forEach((time) => {
      const delay = this.ctx.createDelay(0.1);
      delay.delayTime.setValueAtTime(time, this.ctx.currentTime);

      const gain1 = this.ctx.createGain();
      gain1.gain.setValueAtTime(0.7, this.ctx.currentTime);

      const gain2 = this.ctx.createGain();
      gain2.gain.setValueAtTime(-0.7, this.ctx.currentTime);

      prevNode.connect(delay);
      delay.connect(gain1);
      prevNode.connect(gain2);

      const allpassOut = this.ctx.createGain();
      gain1.connect(allpassOut);
      gain2.connect(allpassOut);

      this.allpassFilters.push({ delay, gain1, gain2 });
      prevNode = allpassOut;
    });

    prevNode.connect(this.reverbWet);
  }

  public updateParams(params: EffectsParams): void {
    const now = this.ctx.currentTime;
    
    // Update Delay
    this.delayLeft.delayTime.setTargetAtTime(Math.max(0.05, Math.min(1.8, params.delayTime * 0.75)), now, 0.05);
    this.delayRight.delayTime.setTargetAtTime(Math.max(0.05, Math.min(1.8, params.delayTime)), now, 0.05);
    this.delayFeedbackLeft.gain.setTargetAtTime(Math.min(0.92, params.delayFeedback), now, 0.05);
    this.delayFeedbackRight.gain.setTargetAtTime(Math.min(0.92, params.delayFeedback), now, 0.05);
    this.delayWet.gain.setTargetAtTime(params.delayMix, now, 0.05);

    if (this.delayFlutterGain) {
      this.delayFlutterGain.gain.setTargetAtTime(params.delayFlutter * 0.004, now, 0.05);
    }

    // Update Reverb
    this.reverbWet.gain.setTargetAtTime(params.reverbMix, now, 0.05);
    const feedbackAmount = Math.min(0.94, 0.6 + params.reverbDecay * 0.04);
    this.combFilters.forEach((comb) => {
      comb.feedback.gain.setTargetAtTime(feedbackAmount, now, 0.05);
    });
  }
}
