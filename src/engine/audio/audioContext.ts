// Master Web Audio Graph & Context Manager with Concurrency Lock & Analog Soft-Saturation

export class MasterAudio {
  private static instance: MasterAudio | null = null;
  public ctx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  public preDriveGain: GainNode | null = null;
  public glueComp: DynamicsCompressorNode | null = null;
  public makeupGain: GainNode | null = null;
  public shaperPreGain: GainNode | null = null;
  public waveShaper: WaveShaperNode | null = null;
  public masterLimiter: DynamicsCompressorNode | null = null;
  public outputGain: GainNode | null = null;
  public safetyCeiling: DynamicsCompressorNode | null = null;
  public analyser: AnalyserNode | null = null;
  public streamDest: MediaStreamAudioDestinationNode | null = null;
  private isMuted: boolean = false;
  private currentVolume: number = 0.9;
  private initPromise: Promise<AudioContext> | null = null;
  private peakBuffer: Float32Array<ArrayBuffer> | null = null;

  private constructor() {}

  /**
   * Builds a symmetrical, unity-slope wide-headroom soft-clip curve mapped over `[-headroom, +headroom]`.
   * Pair with a `1 / headroom` pre-gain so hot transients never hit Web Audio's `[-1, 1]` flat wall.
   */
  public static createWideSoftClipCurve(samples = 4097, headroom = 4.0, saturation = 0.42): Float32Array {
    const count = samples % 2 === 1 ? samples : samples + 1;
    const curve = new Float32Array(count);
    const sat = Math.max(0.05, saturation);
    for (let i = 0; i < count; ++i) {
      const x = (i * 2) / (count - 1) - 1;
      const u = x * headroom;
      curve[i] = Math.tanh(u * sat) / sat;
    }
    return curve;
  }

  public static volumeToGain(vol: number): number {
    const v = Math.max(0, Math.min(1, Number.isFinite(vol) ? vol : 0));
    return v === 0 ? 0 : Math.pow(v, 1.6) * 1.25;
  }

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

      // Master Bus Input (unity gain; downstream outputGain owns monitoring loudness post-limiting)
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

      // Pre-Drive Gain (controlled gently by masterDrive parameter)
      this.preDriveGain = this.ctx.createGain();
      this.preDriveGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

      // Transparent Bus Glue Compressor (8ms attack catches stacked transients cleanly)
      this.glueComp = this.ctx.createDynamicsCompressor();
      this.glueComp.threshold.setValueAtTime(-16.0, this.ctx.currentTime);
      this.glueComp.knee.setValueAtTime(8.0, this.ctx.currentTime);
      this.glueComp.ratio.setValueAtTime(2.4, this.ctx.currentTime);
      this.glueComp.attack.setValueAtTime(0.008, this.ctx.currentTime);
      this.glueComp.release.setValueAtTime(0.20, this.ctx.currentTime);

      // Gentle Makeup Gain before wide-headroom analog saturator
      this.makeupGain = this.ctx.createGain();
      this.makeupGain.gain.setValueAtTime(1.42, this.ctx.currentTime);

      // Pre-attenuate by 1/4 before WaveShaper so [-4.0, +4.0] maps inside [-1, +1] with zero flat-clipping
      this.shaperPreGain = this.ctx.createGain();
      this.shaperPreGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

      // Smooth Wide-Headroom Analog Saturation WaveShaper
      this.waveShaper = this.ctx.createWaveShaper();
      this.waveShaper.curve = MasterAudio.createWideSoftClipCurve(44101, 4.0, 0.42) as any;
      this.waveShaper.oversample = '4x';

      // Transparent Peak Mastering Limiter
      this.masterLimiter = this.ctx.createDynamicsCompressor();
      this.masterLimiter.threshold.setValueAtTime(-2.2, this.ctx.currentTime);
      this.masterLimiter.knee.setValueAtTime(1.5, this.ctx.currentTime);
      this.masterLimiter.ratio.setValueAtTime(16.0, this.ctx.currentTime);
      this.masterLimiter.attack.setValueAtTime(0.0015, this.ctx.currentTime);
      this.masterLimiter.release.setValueAtTime(0.12, this.ctx.currentTime);

      // Post-limiter user Volume fader so output gain never drives saturation into clipping
      this.outputGain = this.ctx.createGain();
      this.outputGain.gain.setValueAtTime(
        this.isMuted ? 0 : MasterAudio.volumeToGain(this.currentVolume),
        this.ctx.currentTime
      );

      // Final DAC Brickwall Ceiling (-0.4 dBFS) prevents hardware clipping even at 100% volume
      this.safetyCeiling = this.ctx.createDynamicsCompressor();
      this.safetyCeiling.threshold.setValueAtTime(-0.4, this.ctx.currentTime);
      this.safetyCeiling.knee.setValueAtTime(0.5, this.ctx.currentTime);
      this.safetyCeiling.ratio.setValueAtTime(20.0, this.ctx.currentTime);
      this.safetyCeiling.attack.setValueAtTime(0.001, this.ctx.currentTime);
      this.safetyCeiling.release.setValueAtTime(0.06, this.ctx.currentTime);

      // Realtime Analyser for Visualizer & Peak LED
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.82;

      // Stream destination for live audio recording
      this.streamDest = this.ctx.createMediaStreamDestination();

      // Routing:
      // masterGain -> preDriveGain -> glueComp -> makeupGain -> shaperPreGain -> waveShaper -> masterLimiter -> outputGain -> safetyCeiling -> analyser -> destination & stream
      this.masterGain.connect(this.preDriveGain);
      this.preDriveGain.connect(this.glueComp);
      this.glueComp.connect(this.makeupGain);
      this.makeupGain.connect(this.shaperPreGain);
      this.shaperPreGain.connect(this.waveShaper);
      this.waveShaper.connect(this.masterLimiter);
      this.masterLimiter.connect(this.outputGain);
      this.outputGain.connect(this.safetyCeiling);
      this.safetyCeiling.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.analyser.connect(this.streamDest);

      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      return this.ctx;
    })();

    return this.initPromise;
  }

  // Update analog warmth / master drive parameter without driving the shaper into harsh flat clipping
  public setDrive(drive: number): void {
    if (!this.preDriveGain || !this.ctx) return;
    const clampedDrive = Math.max(0, Math.min(1, Number.isFinite(drive) ? drive : 0));
    const preGain = 1.0 + clampedDrive * 0.75;
    this.preDriveGain.gain.setTargetAtTime(preGain, this.ctx.currentTime, 0.05);
  }

  public setVolume(vol: number): void {
    this.currentVolume = Math.max(0, Math.min(1, vol));
    if (this.outputGain && this.ctx && !this.isMuted) {
      this.outputGain.gain.setTargetAtTime(MasterAudio.volumeToGain(this.currentVolume), this.ctx.currentTime, 0.04);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.outputGain && this.ctx) {
      const target = this.isMuted ? 0 : MasterAudio.volumeToGain(this.currentVolume);
      this.outputGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
    }
    return this.isMuted;
  }

  public getPeakDb(): number {
    if (!this.analyser) return -96;
    if (!this.peakBuffer || this.peakBuffer.length !== this.analyser.fftSize) {
      this.peakBuffer = new Float32Array(this.analyser.fftSize);
    }
    this.analyser.getFloatTimeDomainData(this.peakBuffer);
    let max = 0;
    for (let i = 0; i < this.peakBuffer.length; i++) {
      const abs = Math.abs(this.peakBuffer[i]);
      if (abs > max) max = abs;
    }
    if (max <= 0.00001) return -96;
    return 20 * Math.log10(max);
  }

  public getTime(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }
}
