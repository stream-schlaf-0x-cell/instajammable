// Master Web Audio Graph & Context Manager with Concurrency Lock & Analog Soft-Saturation

export class MasterAudio {
  private static instance: MasterAudio | null = null;
  public ctx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  public preDriveGain: GainNode | null = null;
  public waveShaper: WaveShaperNode | null = null;
  public masterLimiter: DynamicsCompressorNode | null = null;
  public analyser: AnalyserNode | null = null;
  public streamDest: MediaStreamAudioDestinationNode | null = null;
  private isMuted: boolean = false;
  private currentVolume: number = 0.85;
  private initPromise: Promise<AudioContext> | null = null;

  private constructor() {}

  public static getInstance(): MasterAudio {
    if (!MasterAudio.instance) {
      MasterAudio.instance = new MasterAudio();
    }
    return MasterAudio.instance;
  }

  // Safe idempotent initialization with concurrency locking
  public async init(): Promise<AudioContext> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return this.ctx;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      // 'playback' trades a little output latency for larger, steadier buffers. On older Intel
      // laptops with Firefox the 'interactive' hint underruns under UI load, which is audible as
      // crackle while sliders move. Note scheduling and MIDI timestamps are lookahead-based, so
      // the extra latency does not affect musical timing.
      this.ctx = new AudioCtxClass({
        latencyHint: 'playback',
      });

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);

      // Pre-Drive Gain (controlled by masterDrive parameter)
      this.preDriveGain = this.ctx.createGain();
      this.preDriveGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

      // Subtle Analog Soft-Clipping WaveShaper
      this.waveShaper = this.ctx.createWaveShaper();
      this.waveShaper.curve = this.makeSoftClipCurve(44100) as any;
      this.waveShaper.oversample = '2x';

      // Safety limiter. A hard knee with a 1 ms attack and 50 ms release modulates the whole mix
      // whenever a level changes and is audible as clicking, so this one is deliberately soft:
      // it only catches runaway peaks and recovers slowly.
      this.masterLimiter = this.ctx.createDynamicsCompressor();
      this.masterLimiter.threshold.setValueAtTime(-3.0, this.ctx.currentTime);
      this.masterLimiter.knee.setValueAtTime(8.0, this.ctx.currentTime);
      this.masterLimiter.ratio.setValueAtTime(6.0, this.ctx.currentTime);
      this.masterLimiter.attack.setValueAtTime(0.006, this.ctx.currentTime);
      this.masterLimiter.release.setValueAtTime(0.25, this.ctx.currentTime);

      // Realtime Analyser for Visualizer
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.82;

      // Stream destination for live audio recording
      this.streamDest = this.ctx.createMediaStreamDestination();

      // Routing:
      // masterGain -> preDriveGain -> waveShaper -> masterLimiter -> analyser -> destination & stream
      this.masterGain.connect(this.preDriveGain);
      this.preDriveGain.connect(this.waveShaper);
      this.waveShaper.connect(this.masterLimiter);
      this.masterLimiter.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.analyser.connect(this.streamDest);

      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      return this.ctx;
    })();

    return this.initPromise;
  }

  // S-curve tanh approximation for warm tape-style analog saturation
  private makeSoftClipCurve(samples: number): Float32Array {
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; ++i) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + 1.5) * x * 20 * deg) / (Math.PI + 1.5 * Math.abs(x * 20 * deg));
    }
    return curve;
  }

  // Update analog warmth / master drive parameter
  public setDrive(drive: number): void {
    if (!this.preDriveGain || !this.ctx) return;
    // Drive from 1.0 (clean) to 2.8 (warm analog saturation)
    const clampedDrive = Math.max(0, Math.min(1, drive));
    const preGain = 1.0 + clampedDrive * 1.8;
    this.preDriveGain.gain.setTargetAtTime(preGain, this.ctx.currentTime, 0.05);
  }

  public setVolume(vol: number): void {
    this.currentVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.currentVolume, this.ctx.currentTime, 0.04);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const target = this.isMuted ? 0 : this.currentVolume;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
    }
    return this.isMuted;
  }

  public getTime(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }
}
