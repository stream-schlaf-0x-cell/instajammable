// High-Precision Web Audio Lookahead Musical Clock with Metric Duration Preservation & Stall Protection

import { StepContext } from '../types';

export class MusicalClock {
  private audioCtx: AudioContext;
  private isRunning: boolean = false;
  private bpm: number = 108;
  private swing: number = 0.0; // 0.0 (straight) to 0.75 (heavy shuffle)
  private currentStep: number = 0;
  private nextStepTime: number = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  // Lookahead parameters
  private readonly lookaheadMs: number = 25;       // frequency of scheduler checks (25ms)
  private readonly scheduleAheadTime: number = 0.1; // how far ahead to schedule Web Audio events (100ms)

  // Max scheduling catch-up threshold to prevent audio machine-gun bursts after background-tab throttle
  private readonly maxCatchupThresholdSec: number = 0.35;

  private onStepCallback?: (context: StepContext) => void;
  private onTickCallback?: (currentStep: number, bar: number) => void;

  constructor(audioCtx: AudioContext) {
    this.audioCtx = audioCtx;
  }

  public setCallbacks(
    onStep: (context: StepContext) => void,
    onTick?: (currentStep: number, bar: number) => void
  ): void {
    this.onStepCallback = onStep;
    this.onTickCallback = onTick;
  }

  public setBpm(newBpm: number): void {
    this.bpm = Math.max(20, Math.min(300, newBpm));
  }

  public getBpm(): number {
    return this.bpm;
  }

  public setSwing(newSwing: number): void {
    this.swing = Math.max(0, Math.min(0.75, newSwing));
  }

  public getSwing(): number {
    return this.swing;
  }

  public start(): void {
    if (this.isRunning) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    this.isRunning = true;
    this.nextStepTime = this.audioCtx.currentTime + 0.05; // start 50ms in future
    this.timerInterval = setInterval(() => this.schedulerLoop(), this.lookaheadMs);
  }

  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public reset(): void {
    this.currentStep = 0;
    if (this.audioCtx) {
      this.nextStepTime = this.audioCtx.currentTime;
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getCurrentStep(): number {
    return this.currentStep;
  }

  // Lookahead Scheduler Loop
  public schedulerLoop(): void {
    if (!this.isRunning) return;

    const currentTime = this.audioCtx.currentTime;

    // Detect if main thread stalled or background tab throttled
    const stallLag = currentTime - this.nextStepTime;
    if (stallLag > this.maxCatchupThresholdSec) {
      // Avoid machine-gun burst of events: advance clock smoothly to now
      const secondsPer16th = (60.0 / this.bpm) / 4.0;
      const skippedSteps = Math.floor(stallLag / secondsPer16th);
      this.currentStep += skippedSteps;
      this.nextStepTime = currentTime + 0.02;
    }

    // While notes need scheduling before the next lookahead window
    while (this.nextStepTime < currentTime + this.scheduleAheadTime) {
      const scheduledTime = this.nextStepTime;
      const stepToSchedule = this.currentStep;

      // Calculate step durations preserving paired subdivision durations:
      // Even step (on-beat): T + delta (delayed off-beat)
      // Odd step (off-beat): T - delta
      // Total for the pair: (T + delta) + (T - delta) = 2T (exact beat & bar duration preserved)
      const base16thSec = (60.0 / this.bpm) / 4.0;
      const swingDelta = this.swing * (base16thSec * 0.4); // max ~40% shift at 0.75 swing

      const isEven = stepToSchedule % 2 === 0;
      const stepDuration = isEven ? base16thSec + swingDelta : base16thSec - swingDelta;
      const swingOffset = isEven ? 0 : swingDelta;

      this.scheduleStep(stepToSchedule, scheduledTime, swingOffset);

      this.nextStepTime += stepDuration;
      this.currentStep++;
    }
  }

  private scheduleStep(step: number, time: number, swingOffset: number): void {
    const beat = Math.floor((step % 16) / 4);
    const bar = Math.floor(step / 16);
    const subStep = step % 16;

    // Compute corresponding performance.now() timestamp in milliseconds
    const currentTime = this.audioCtx.currentTime;
    const currentPerfNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const perfTime = currentPerfNow + (time - currentTime) * 1000;

    const ctx: StepContext = {
      step,
      subStep,
      beat,
      bar,
      time,
      perfTime,
      bpm: this.bpm,
      swing: this.swing,
      swingOffset,
    };

    if (this.onStepCallback) {
      this.onStepCallback(ctx);
    }

    if (this.onTickCallback) {
      this.onTickCallback(step, bar);
    }
  }
}
