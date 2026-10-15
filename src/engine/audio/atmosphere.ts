// Background atmosphere: generated noise beds (tape, air, vinyl, rain) or a loop the user loads locally.
//
// Adding a new generated texture only needs one entry in ATMOSPHERE_SOURCES (plus the kind name in
// ATMOSPHERE_KINDS in types/jam.ts). Nothing is downloaded: generated beds are synthesized into a
// short looped buffer, and samples come from a file the user chooses.
import type { AtmosphereSettings } from '../../types/jam';

type Generated = Exclude<AtmosphereSettings['kind'], 'off' | 'sample'>;
interface SourceDefinition {
  label: string; description: string;
  /** Mono loop buffer, roughly peak-normalised to 0.5. */
  make: (ctx: BaseAudioContext, random: () => number) => AudioBuffer;
  /** Low-pass range driven by the tone control (Hz). */
  lowpass: readonly [number, number]; highpass: number; gain: number;
}
const LOOP_SECONDS = 8; const SEAM_SECONDS = 0.6;

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function finish(buffer: AudioBuffer, seam = true): AudioBuffer {
  const data = buffer.getChannelData(0); const n = data.length;
  if (seam) { // equal-power crossfade of the tail into the head makes the loop point inaudible
    const length = Math.min(Math.floor(SEAM_SECONDS * buffer.sampleRate), n >> 2);
    for (let i = 0; i < length; i++) { const t = i / length; data[i] = data[i] * Math.sin(t * Math.PI / 2) + data[n - length + i] * Math.cos(t * Math.PI / 2); }
  }
  const out = buffer.getChannelData(0); let peak = 0.0001; for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  for (let i = 0; i < out.length; i++) out[i] *= 0.5 / peak;
  return buffer;
}
function pinkNoise(data: Float32Array, random: () => number): void {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; // Paul Kellet's economy pink filter
  for (let i = 0; i < data.length; i++) {
    const white = random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179; b1 = 0.99332 * b1 + white * 0.0750759; b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856; b4 = 0.55 * b4 + white * 0.5329522; b5 = -0.7616 * b5 - white * 0.016898;
    data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362; b6 = white * 0.115926;
  }
}
function pops(data: Float32Array, sampleRate: number, random: () => number, perSecond: number, loud: number, lengthMs: [number, number]): void {
  const count = Math.round(perSecond * data.length / sampleRate);
  for (let k = 0; k < count; k++) {
    const start = Math.floor(random() * (data.length - 400)); const amp = (random() < 0.12 ? loud : loud * 0.25) * (0.3 + random() * 0.7) * (random() < 0.5 ? -1 : 1);
    const length = Math.floor((lengthMs[0] + random() * (lengthMs[1] - lengthMs[0])) / 1000 * sampleRate);
    for (let i = 0; i < length; i++) data[start + i] += amp * Math.exp(-i / (length * 0.28));
  }
}
function buffer(ctx: BaseAudioContext): AudioBuffer { return ctx.createBuffer(1, Math.floor(ctx.sampleRate * LOOP_SECONDS), ctx.sampleRate); }

export const ATMOSPHERE_SOURCES: Record<Generated, SourceDefinition> = {
  tape: { label: 'Tape-Rauschen', description: 'Warmes, weiches Bandrauschen unter allem.', lowpass: [900, 7000], highpass: 70, gain: 0.34,
    make: (ctx, random) => { const b = buffer(ctx); pinkNoise(b.getChannelData(0), random); return finish(b); } },
  air: { label: 'Luft / Wind', description: 'Langsam atmende Luftbewegung, ohne Rhythmus.', lowpass: [500, 5000], highpass: 90, gain: 0.5,
    make: (ctx, random) => { const b = buffer(ctx); const d = b.getChannelData(0); pinkNoise(d, random); let slow = 0; for (let i = 0; i < d.length; i++) { slow += (random() * 2 - 1 - slow) * 0.00004; d[i] *= 0.6 + 0.4 * Math.tanh(slow * 90); } return finish(b); } },
  vinyl: { label: 'Vinyl-Knistern', description: 'Leises Rauschen mit seltenen Knacksern, typisch Lo-Fi.', lowpass: [2500, 9000], highpass: 120, gain: 0.26,
    make: (ctx, random) => { const b = buffer(ctx); const d = b.getChannelData(0); pinkNoise(d, random); for (let i = 0; i < d.length; i++) d[i] *= 0.25; pops(d, ctx.sampleRate, random, 5, 1.4, [1.5, 7]); return finish(b); } },
  rain: { label: 'Regen', description: 'Dichter, gleichmäßiger Regen am Fenster.', lowpass: [2200, 11000], highpass: 600, gain: 0.34,
    make: (ctx, random) => { const b = buffer(ctx); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (random() * 2 - 1) * 0.35; pops(d, ctx.sampleRate, random, 190, 1.1, [0.8, 3.2]); return finish(b); } },
};
export const ATMOSPHERE_LABELS: Record<AtmosphereSettings['kind'], string> = { off: 'Aus', sample: 'Eigenes Sample', ...Object.fromEntries(Object.entries(ATMOSPHERE_SOURCES).map(([k, v]) => [k, v.label])) } as Record<AtmosphereSettings['kind'], string>;

interface Running { kind: AtmosphereSettings['kind']; source: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode; nodes: AudioNode[]; lfo: OscillatorNode | null; lfoFilter: GainNode | null; lfoLevel: GainNode | null; base: number }

export class AtmosphereBed {
  private running: Running | null = null; private settings: AtmosphereSettings = { kind: 'off', level: 0.08, tone: 0.5, movement: 0.4 };
  private cache = new Map<string, AudioBuffer>(); private sample: { buffer: AudioBuffer; name: string } | null = null; private active = false;
  constructor(private ctx: AudioContext, private output: AudioNode) {}
  static supported(ctx: BaseAudioContext): boolean { return typeof ctx.createBufferSource === 'function' && typeof ctx.createBuffer === 'function'; }
  getSampleName(): string | null { return this.sample?.name ?? null; }
  async loadSample(data: ArrayBuffer, name: string): Promise<void> {
    if (!AtmosphereBed.supported(this.ctx)) throw new Error('Dieser Browser kann keine Samples dekodieren.');
    let buffer: AudioBuffer;
    try { buffer = await this.ctx.decodeAudioData(data.slice(0)); } catch { throw new Error('Die Datei konnte nicht als Audio gelesen werden. Nutze WAV, MP3, OGG oder M4A.'); }
    if (buffer.duration < 0.5) throw new Error('Das Sample ist zu kurz für einen Loop (mindestens 0,5 s).');
    if (buffer.duration > 600) throw new Error('Das Sample ist zu lang (maximal 10 Minuten).');
    this.sample = { buffer, name: name.slice(0, 120) };
    if (this.settings.kind === 'sample') this.rebuild();
  }
  /** Applies settings; the bed only sounds while `active` (the jam is running). */
  configure(settings: AtmosphereSettings): void {
    const kindChanged = settings.kind !== this.settings.kind; this.settings = { ...settings };
    if (!this.active || !AtmosphereBed.supported(this.ctx)) return;
    if (kindChanged || !this.running) this.rebuild(); else this.update();
  }
  setActive(on: boolean): void {
    if (on === this.active) return; this.active = on;
    if (on) this.rebuild(); else this.fadeOut(1.4);
  }
  stopNow(): void { this.active = false; this.fadeOut(0.05); }
  private bufferFor(kind: AtmosphereSettings['kind']): AudioBuffer | null {
    if (kind === 'sample') return this.sample?.buffer ?? null;
    if (kind === 'off') return null;
    let cached = this.cache.get(kind); if (!cached) { cached = ATMOSPHERE_SOURCES[kind].make(this.ctx, mulberry(kind.length * 7919 + 17)); this.cache.set(kind, cached); }
    return cached;
  }
  private fadeOut(seconds: number): void {
    const old = this.running; this.running = null; if (!old) return; const now = this.ctx.currentTime;
    try { old.gain.gain.cancelScheduledValues(now); old.gain.gain.setValueAtTime(old.gain.gain.value, now); old.gain.gain.setTargetAtTime(0, now, seconds / 4); old.source.stop(now + seconds + 0.1); } catch { /* already stopped */ }
    old.source.onended = () => { for (const n of [old.source, ...old.nodes]) { try { n.disconnect(); } catch { /* disconnected */ } } try { old.lfo?.stop(); } catch { /* stopped */ } };
  }
  private targetGain(): number {
    const def = this.settings.kind === 'sample' ? { gain: 0.6 } : ATMOSPHERE_SOURCES[this.settings.kind as Generated];
    const maxLevel = 0.10;
    return (def?.gain ?? 0.3) * Math.min(maxLevel, this.settings.level);
  }
  private filterFrequency(): number {
    const range = this.settings.kind === 'sample' ? [800, 14000] as const : ATMOSPHERE_SOURCES[this.settings.kind as Generated]?.lowpass ?? [800, 8000] as const;
    return range[0] * Math.pow(range[1] / range[0], this.settings.tone);
  }
  private rebuild(): void {
    this.fadeOut(0.5);
    const kind = this.settings.kind; const data = this.bufferFor(kind); if (!data || this.settings.level <= 0 || !this.active) return;
    const ctx = this.ctx; const now = ctx.currentTime; const nodes: AudioNode[] = [];
    const source = ctx.createBufferSource(); source.buffer = data; source.loop = true;
    if (kind !== 'sample') { source.loopStart = 0; source.loopEnd = Math.max(1, data.duration - SEAM_SECONDS); }
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.setValueAtTime(kind === 'sample' ? 40 : ATMOSPHERE_SOURCES[kind as Generated].highpass, now);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.setValueAtTime(this.filterFrequency(), now); filter.Q.setValueAtTime(0.5, now);
    const gain = ctx.createGain(); gain.gain.setValueAtTime(0.0001, now); gain.gain.setTargetAtTime(this.targetGain(), now, 0.7);
    source.connect(hp); hp.connect(filter); filter.connect(gain); gain.connect(this.output); nodes.push(hp, filter, gain);
    let lfo: OscillatorNode | null = null, lfoFilter: GainNode | null = null, lfoLevel: GainNode | null = null;
    if (ctx.createOscillator) {
      lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.setValueAtTime(0.05 + this.settings.movement * 0.12, now);
      lfoFilter = ctx.createGain(); lfoLevel = ctx.createGain(); nodes.push(lfoFilter, lfoLevel);
      lfoFilter.gain.setValueAtTime(this.filterFrequency() * 0.45 * this.settings.movement, now); lfoLevel.gain.setValueAtTime(this.targetGain() * 0.25 * this.settings.movement, now);
      lfo.connect(lfoFilter); lfoFilter.connect(filter.frequency); lfo.connect(lfoLevel); lfoLevel.connect(gain.gain); lfo.start(now);
    }
    source.start(now, kind === 'sample' ? 0 : (now * 3.7) % Math.max(0.5, data.duration - SEAM_SECONDS));
    this.running = { kind, source, gain, filter, nodes, lfo, lfoFilter, lfoLevel, base: this.targetGain() };
  }
  private update(): void {
    const r = this.running; if (!r) return; const now = this.ctx.currentTime;
    r.gain.gain.setTargetAtTime(this.targetGain(), now, 0.25); r.filter.frequency.setTargetAtTime(this.filterFrequency(), now, 0.25);
    r.lfo?.frequency.setTargetAtTime(0.05 + this.settings.movement * 0.12, now, 0.5);
    r.lfoFilter?.gain.setTargetAtTime(this.filterFrequency() * 0.45 * this.settings.movement, now, 0.4); r.lfoLevel?.gain.setTargetAtTime(this.targetGain() * 0.25 * this.settings.movement, now, 0.4);
  }
}
