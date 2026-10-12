// Master Web Audio Graph & Context Manager

export class MasterAudio {
  private static instance: MasterAudio | null = null;
  public ctx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  public masterLimiter: DynamicsCompressorNode | null = null;
  public waveShaper: WaveShaperNode | null = null;
  public analyser: AnalyserNode | null = null;
  public streamDest: MediaStreamAudioDestinationNode | null = null;
  private isMuted: boolean = false;
  private currentVolume: number = 0.85;

  private constructor() {}

  public static getInstance(): MasterAudio {
    if (!MasterAudio.instance) {
      MasterAudio.instance = new MasterAudio();
    }
    return MasterAudio.instance;
  }

  public init(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass({
        latencyHint: 'interactive',
      });

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);

      // Limiter / Peak Safety Guard (prevents runaway levels / protects ears & speakers)
      this.masterLimiter = this.ctx.createDynamicsCompressor();
      this.masterLimiter.threshold.setValueAtTime(-1.0, this.ctx.currentTime);
      this.masterLimiter.knee.setValueAtTime(0.0, this.ctx.currentTime);
      this.masterLimiter.ratio.setValueAtTime(20.0, this.ctx.currentTime);
      this.masterLimiter.attack.setValueAtTime(0.001, this.ctx.currentTime);
      this.masterLimiter.release.setValueAtTime(0.05, this.ctx.currentTime);

      // Subtle Analog Soft-Clipping WaveShaper
      this.waveShaper = this.ctx.createWaveShaper();
      this.waveShaper.curve = this.makeSoftClipCurve(44100) as any;
      this.waveShaper.oversample = '2x';

      // Realtime Analyser for Visualizer
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.82;

      // Stream destination for recording directly from master output
      this.streamDest = this.ctx.createMediaStreamDestination();

      // Routing: MasterGain -> WaveShaper -> Limiter -> Analyser -> Destination & Stream
      this.masterGain.connect(this.waveShaper);
      this.waveShaper.connect(this.masterLimiter);
      this.masterLimiter.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.analyser.connect(this.streamDest);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    return this.ctx;
  }

  // S-curve tanh approximation for warm tape-style analog saturation
  private makeSoftClipCurve(samples: number): Float32Array {
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; ++i) {
      const x = (i * 2) / samples - 1;
      // Soft saturation transfer function
      curve[i] = ((3 + 1.5) * x * 20 * deg) / (Math.PI + 1.5 * Math.abs(x * 20 * deg));
    }
    return curve;
  }

  public setVolume(vol: number): void {
    this.currentVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.currentVolume, this.ctx.currentTime, 0.02);
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
