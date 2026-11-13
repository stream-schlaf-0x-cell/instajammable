// Master Web Audio Graph & Context Manager with Concurrency Lock & Analog Soft-Saturation

export class MasterAudio {
  private static instance: MasterAudio | null = null;
  public ctx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  public preDriveGain: GainNode | null = null;
  public glueComp: DynamicsCompressorNode | null = null;
  public makeupGain: GainNode | null = null;
  public waveShaper: WaveShaperNode | null = null;
  public masterLimiter: DynamicsCompressorNode | null = null;
  public analyser: AnalyserNode | null = null;
  public streamDest: MediaStreamAudioDestinationNode | null = null;
  private isMuted: boolean = false;
  private currentVolume: number = 0.9;
  private initPromise: Promise<AudioContext> | null = null;
  private peakBuffer: Float32Array<ArrayBuffer> | null = null;

  private constructor() {}

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

      // Master Gain (perceptual curve mapped from currentVolume)
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(MasterAudio.volumeToGain(this.currentVolume), this.ctx.currentTime);

      // Pre-Drive Gain (controlled by masterDrive parameter)
      this.preDriveGain = this.ctx.createGain();
      this.preDriveGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

      // Gentle Bus Glue Compressor
      this.glueComp = this.ctx.createDynamicsCompressor();
      this.glueComp.threshold.setValueAtTime(-20.0, this.ctx.currentTime);
      this.glueComp.knee.setValueAtTime(10.0, this.ctx.currentTime);
      this.glueComp.ratio.setValueAtTime(2.2, this.ctx.currentTime);
      this.glueComp.attack.setValueAtTime(0.025, this.ctx.currentTime);
      this.glueComp.release.setValueAtTime(0.28, this.ctx.currentTime);

      // Makeup Gain after bus glue
      this.makeupGain = this.ctx.createGain();
      this.makeupGain.gain.setValueAtTime(1.9, this.ctx.currentTime);

      // Subtle Analog Soft-Clipping WaveShaper (unity-normalized tanh)
      this.waveShaper = this.ctx.createWaveShaper();
      this.waveShaper.curve = this.makeSoftClipCurve(44100) as any;
      this.waveShaper.oversample = '4x';

      // Transparent Peak Safety Limiter
      this.masterLimiter = this.ctx.createDynamicsCompressor();
      this.masterLimiter.threshold.setValueAtTime(-1.2, this.ctx.currentTime);
      this.masterLimiter.knee.setValueAtTime(1.0, this.ctx.currentTime);
      this.masterLimiter.ratio.setValueAtTime(20.0, this.ctx.currentTime);
      this.masterLimiter.attack.setValueAtTime(0.002, this.ctx.currentTime);
      this.masterLimiter.release.setValueAtTime(0.16, this.ctx.currentTime);

      // Realtime Analyser for Visualizer & Peak LED
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.82;

      // Stream destination for live audio recording
      this.streamDest = this.ctx.createMediaStreamDestination();

      // Routing:
      // masterGain -> preDriveGain -> glueComp -> makeupGain -> waveShaper -> masterLimiter -> analyser -> destination & stream
      this.masterGain.connect(this.preDriveGain);
      this.preDriveGain.connect(this.glueComp);
      this.glueComp.connect(this.makeupGain);
      this.makeupGain.connect(this.waveShaper);
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

  // S-curve tanh approximation for warm tape-style analog saturation (+2.3 dB small-signal gain, 1.0 ceiling)
  private makeSoftClipCurve(samples: number): Float32Array {
    const curve = new Float32Array(samples);
    const norm = Math.tanh(1.0);
    for (let i = 0; i < samples; ++i) {
      const x = (i * 2) / samples - 1;
      curve[i] = Math.tanh(x * 1.0) / norm;
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
      this.masterGain.gain.setTargetAtTime(MasterAudio.volumeToGain(this.currentVolume), this.ctx.currentTime, 0.04);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const target = this.isMuted ? 0 : MasterAudio.volumeToGain(this.currentVolume);
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
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
