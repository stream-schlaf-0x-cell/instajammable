// PCM capture taps the audible graph, never MediaStreamAudioDestinationNode
// (which has zero outputs). Worklet capture remains independent of UI timers.
import { WavEncoder } from './wavEncoder';
export interface RecorderState { isRecording: boolean; durationSec: number; lastError: string | null; mimeType: string }
const PCM_WORKLET = `class InstajammableRecorder extends AudioWorkletProcessor {
  constructor() { super(); this.left = new Float32Array(4096); this.right = new Float32Array(4096); this.fill = 0;
    this.port.onmessage = e => { if (e.data === 'flush') { this.flush(); this.port.postMessage({flushed:true}); } }; }
  flush() { if (!this.fill) return; const l = this.left.slice(0,this.fill), r = this.right.slice(0,this.fill);
    this.port.postMessage({left:l,right:r}, [l.buffer,r.buffer]); this.fill = 0; }
  process(inputs, outputs) { const input = inputs[0]; if (input && input[0]) { const l = input[0], r = input[1] || l;
    for (let i=0;i<l.length;i++) { this.left[this.fill]=l[i]; this.right[this.fill++]=r[i]; if(this.fill===4096)this.flush(); } }
    for (const out of outputs) for (const channel of out) channel.fill(0); return true; }
} registerProcessor('instajammable-pcm-recorder', InstajammableRecorder);`;

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recording = false;
  private startTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners: ((state: RecorderState) => void)[] = [];
  private error: string | null = null;
  private mimeType = '';
  private processor: ScriptProcessorNode | AudioWorkletNode | null = null;
  private tapNode: AudioNode | null = null;
  private silentNode: GainNode | null = null;
  private leftChunks: Float32Array[] = [];
  private rightChunks: Float32Array[] = [];
  private sampleCount = 0;
  private session = 0;
  private maxFrames = 0;
  private modulePromise: Promise<void> | null = null;
  private flushing: (() => void) | null = null;
  private stopping: Promise<{ webmBlob: Blob | null; wavBytes: Uint8Array | null }> | null = null;
  constructor(private getStreamNode: () => MediaStreamAudioDestinationNode | null,
    private getAudioContext: () => AudioContext | null,
    private getTapNode?: () => AudioNode | null) {}
  public isCurrentlyRecording(): boolean { return this.recording; }
  public getState(): RecorderState {
    return { isRecording: this.recording, durationSec: this.recording ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      lastError: this.error, mimeType: this.mimeType };
  }
  public subscribe(listener: (state: RecorderState) => void): () => void {
    this.listeners.push(listener); listener(this.getState());
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }
  private notify(): void { const state = this.getState(); this.listeners.forEach(l => l(state)); }
  private append(left: Float32Array, right: Float32Array): void {
    const remaining = this.maxFrames - this.sampleCount;
    if (remaining <= 0) return;
    const size = Math.min(left.length, remaining);
    this.leftChunks.push(left.slice(0, size)); this.rightChunks.push(right.slice(0, size)); this.sampleCount += size;
    if (this.sampleCount >= this.maxFrames) {
      this.error = 'Five-minute PCM limit reached. Stop recording to save the captured audio.'; this.notify();
    }
  }
  private connectProcessor(ctx: AudioContext, processor: ScriptProcessorNode | AudioWorkletNode): void {
    if (!this.tapNode || this.tapNode.numberOfOutputs === 0) throw new Error('PCM capture requires an audible graph node with an output.');
    this.processor = processor;
    this.silentNode = ctx.createGain(); this.silentNode.gain.setValueAtTime(0, ctx.currentTime);
    this.tapNode.connect(processor); processor.connect(this.silentNode); this.silentNode.connect(ctx.destination);
    this.mimeType = 'audio/wav';
  }
  private setupFallback(ctx: AudioContext, token: number): void {
    if (!this.recording || token !== this.session) return;
    const node = ctx.createScriptProcessor(4096, 2, 2);
    node.onaudioprocess = event => {
      if (!this.recording || token !== this.session) return;
      const left = event.inputBuffer.getChannelData(0);
      this.append(left, event.inputBuffer.numberOfChannels > 1 ? event.inputBuffer.getChannelData(1) : left);
    };
    this.connectProcessor(ctx, node);
  }
  private async setupWorklet(ctx: AudioContext, token: number): Promise<void> {
    try {
      if (!this.modulePromise) {
        const url = URL.createObjectURL(new Blob([PCM_WORKLET], { type: 'text/javascript' }));
        this.modulePromise = ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
      }
      await this.modulePromise;
      if (!this.recording || token !== this.session) return;
      const node = new AudioWorkletNode(ctx, 'instajammable-pcm-recorder', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      node.port.onmessage = event => {
        if (token !== this.session) return;
        if (event.data.flushed) { this.flushing?.(); return; }
        if (event.data.left && event.data.right) this.append(event.data.left, event.data.right);
      };
      this.connectProcessor(ctx, node); this.notify();
    } catch (error) {
      this.modulePromise = null;
      try { this.setupFallback(ctx, token); }
      catch (fallbackError) {
        this.error = `PCM recording unavailable: ${fallbackError instanceof Error ? fallbackError.message : String(error)}`;
        this.notify();
      }
    }
  }
  public start(): boolean {
    if (this.recording || this.stopping) return false;
    const ctx = this.getAudioContext();
    const streamNode = this.getStreamNode();
    if (!ctx || ctx.state === 'closed') { this.error = 'Start audio before recording.'; this.notify(); return false; }
    this.error = null; this.recordedChunks = []; this.leftChunks = []; this.rightChunks = [];
    this.sampleCount = 0; this.maxFrames = Math.floor(ctx.sampleRate * 300);
    this.tapNode = this.getTapNode?.() ?? null;
    this.mimeType = '';
    const token = ++this.session;
    try {
      // Optional compressed fallback. Its actual mimeType always determines the extension.
      if (streamNode && typeof MediaRecorder !== 'undefined') {
        const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'].find(value => MediaRecorder.isTypeSupported(value));
        this.mediaRecorder = new MediaRecorder(streamNode.stream, mime ? { mimeType: mime } : undefined);
        this.mimeType = this.mediaRecorder.mimeType || mime || '';
        this.mediaRecorder.ondataavailable = event => { if (token === this.session && event.data.size && Date.now() - this.startTime <= 300_250) this.recordedChunks.push(event.data); };
        this.mediaRecorder.onerror = event => { this.error = (event as Event & {error?: Error}).error?.message ?? 'Compressed recorder error.'; this.notify(); };
        this.mediaRecorder.start(250);
      }
      this.recording = true; this.startTime = Date.now();
      if (this.tapNode && this.tapNode.numberOfOutputs !== 0) {
        if (ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
          this.mimeType = 'audio/wav'; void this.setupWorklet(ctx, token);
        } else this.setupFallback(ctx, token);
      } else {
        if (!this.mediaRecorder) throw new Error('No PCM audio tap or supported compressed recorder is available.');
        this.error = 'Only compressed recording is available: the PCM audio tap is missing.';
      }
      this.timer = setInterval(() => {
        this.notify();
        if (Date.now() - this.startTime >= 300_000 && !this.error) { this.error = 'Five-minute recording limit reached. Stop to save.'; this.notify(); }
      }, 500);
      this.notify(); return true;
    } catch (error) {
      this.recording = false; this.error = error instanceof Error ? error.message : 'Audio recording could not start.';
      if (this.mediaRecorder?.state === 'recording') { try { this.mediaRecorder.stop(); } catch { /* failed start */ } }
      this.disconnect(); this.notify(); return false;
    }
  }
  private disconnect(): void {
    if (this.tapNode && this.processor) { try { this.tapNode.disconnect(this.processor); } catch { /* already disconnected */ } }
    if (this.processor) {
      if ('onaudioprocess' in this.processor) this.processor.onaudioprocess = null;
      else { this.processor.port.onmessage = null; this.processor.port.close(); }
      this.processor.disconnect();
    }
    this.silentNode?.disconnect(); this.processor = null; this.silentNode = null; this.tapNode = null;
  }
  public stop(): Promise<{ webmBlob: Blob | null; wavBytes: Uint8Array | null }> {
    if (this.stopping) return this.stopping;
    if (!this.recording) return Promise.resolve({ webmBlob: null, wavBytes: null });
    if (this.timer) clearInterval(this.timer);
    this.timer = null; this.recording = false; this.notify();
    this.stopping = (async () => {
      const node = this.processor;
      if (node && !('onaudioprocess' in node)) {
        await new Promise<void>(resolve => {
          const timeout = setTimeout(() => { this.flushing = null; resolve(); }, 250);
          this.flushing = () => { clearTimeout(timeout); this.flushing = null; resolve(); };
          node.port.postMessage('flush');
        });
      }
      this.disconnect();
      let webmBlob: Blob | null = null;
      const recorder = this.mediaRecorder;
      if (recorder && recorder.state !== 'inactive') {
        await new Promise<void>(resolve => {
          const timeout = setTimeout(resolve, 1500);
          recorder.onstop = () => { clearTimeout(timeout); resolve(); };
          try { recorder.stop(); } catch { clearTimeout(timeout); resolve(); }
        });
      }
      if (this.recordedChunks.length) webmBlob = new Blob(this.recordedChunks, { type: recorder?.mimeType || 'audio/webm' });
      let wavBytes: Uint8Array | null = null;
      const ctx = this.getAudioContext();
      if (this.sampleCount && ctx) {
        const left = new Float32Array(this.sampleCount), right = new Float32Array(this.sampleCount);
        let position = 0;
        for (let i = 0; i < this.leftChunks.length; i++) { left.set(this.leftChunks[i], position); right.set(this.rightChunks[i], position); position += this.leftChunks[i].length; }
        wavBytes = WavEncoder.encodeFloat32Channels(left, right, ctx.sampleRate);
      } else if (!this.error) this.error = 'No PCM samples were captured. Record after audio starts; compressed export may still be available.';
      this.leftChunks = []; this.rightChunks = []; this.recordedChunks = []; this.mediaRecorder = null;
      this.notify(); return { webmBlob, wavBytes };
    })().finally(() => { this.stopping = null; });
    return this.stopping;
  }
}
