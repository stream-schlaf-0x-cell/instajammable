// High-Precision Web Audio Lookahead Musical Clock

import { StepContext } from '../types';

export class MusicalClock {
  private audioCtx: AudioContext;
  private isRunning: boolean = false;
  private bpm: number = 108;
  private swing: number = 0.0; // 0.0 (straight) to 0.75 (heavy shuffle)
  private currentStep: number = 0;
  private nextStepTime: number = 0;
  private timerInterval: any = null;

  // Lookahead parameters
  private readonly lookaheadMs: number = 25;       // frequency of scheduler checks (25ms)
  private readonly scheduleAheadTime: number = 0.1; // how far ahead to schedule Web Audio events (100ms)

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
  private schedulerLoop(): void {
    if (!this.isRunning) return;

    // While there are notes that will need to play before the next interval
    while (this.nextStepTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }
  }

  private advanceStep(): void {
    const secondsPer16th = (60.0 / this.bpm) / 4.0;
    
    // Apply swing delay to odd 16th notes
    let stepDuration = secondsPer16th;
    if (this.currentStep % 2 === 1 && this.swing > 0) {
      // Swing pushes odd steps slightly later
      const swingOffset = secondsPer16th * (this.swing * 0.35);
      stepDuration += swingOffset;
    }

    this.nextStepTime += stepDuration;
    this.currentStep++;
  }

  private scheduleStep(step: number, time: number): void {
    const beat = Math.floor(step / 4);
    const bar = Math.floor(step / 16);
    const subStep = step % 16;

    const ctx: StepContext = {
      step,
      subStep,
      beat,
      bar,
      time,
      bpm: this.bpm,
    };

    if (this.onStepCallback) {
      this.onStepCallback(ctx);
    }

    if (this.onTickCallback) {
      // Dispatch visual tick
      this.onTickCallback(step, bar);
    }
  }
}
