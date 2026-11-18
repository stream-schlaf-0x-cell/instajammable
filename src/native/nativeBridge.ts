// Native bridge for JUCE 8 WKWebView VST3 Plugin + Standalone App hosting

export interface HostTransportState {
  playing: boolean;
  recording: boolean;
  bpm: number;
  ppqPosition: number;
  bar: number;
}

export interface HostMidiEvent {
  status: number;
  data1: number;
  data2: number;
  channel?: number;
}

interface JuceBackend {
  emitEvent?: (eventId: string, payload: unknown) => void;
}

interface NativeWindow extends Window {
  __INSTAJAMMABLE_NATIVE__?: boolean;
  __INSTAJAMMABLE_IS_VST3__?: boolean;
  __JUCE__?: { backend?: JuceBackend };
  webkit?: {
    messageHandlers?: {
      instajammable?: { postMessage: (payload: unknown) => void };
    };
  };
  __instajammableOnHostTransport?: (state: HostTransportState) => void;
  __instajammableOnHostMidi?: (events: HostMidiEvent[] | string) => void;
  __instajammableOnHostLoadState?: (json: string) => void;
  __instajammableRequestState?: () => string | null;
}

const getNativeWindow = (): NativeWindow | undefined =>
  typeof window !== 'undefined' ? (window as NativeWindow) : undefined;

export function isNativePlugin(): boolean {
  const win = getNativeWindow();
  return Boolean(win && (win.__INSTAJAMMABLE_NATIVE__ || win.__JUCE__));
}

export function isVst3Plugin(): boolean {
  const win = getNativeWindow();
  return Boolean(win && win.__INSTAJAMMABLE_IS_VST3__);
}

function emitNativeEvent(eventId: string, payload: unknown): void {
  const win = getNativeWindow();
  if (!win) return;
  try {
    if (win.__JUCE__?.backend?.emitEvent) {
      win.__JUCE__.backend.emitEvent(eventId, payload);
      return;
    }
    win.webkit?.messageHandlers?.instajammable?.postMessage({
      eventId,
      payload,
    });
  } catch {
    // Ignore bridge errors in headless/test environments
  }
}

export function sendNativeMidi(portId: string, bytes: number[], delayMs = 0): void {
  if (!isNativePlugin() || !bytes.length) return;
  emitNativeEvent('__instajammable_midi_out', {
    portId: portId || 'all-native',
    bytes,
    delayMs: Math.max(0, Number.isFinite(delayMs) ? delayMs : 0),
  });
}

let stateSaveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingStateJson: string | null = null;
let pendingStateProducer: string | (() => string) | null = null;

export function sendNativeSessionState(jsonOrProvider: string | (() => string)): void {
  if (!isNativePlugin()) return;
  pendingStateProducer = jsonOrProvider;
  if (typeof jsonOrProvider === 'string') {
    pendingStateJson = jsonOrProvider;
  }
  if (stateSaveTimer !== null) return;
  stateSaveTimer = setTimeout(() => {
    stateSaveTimer = null;
    const producer = pendingStateProducer;
    if (!producer) return;
    try {
      const json = typeof producer === 'function' ? producer() : producer;
      pendingStateJson = json;
      emitNativeEvent('__instajammable_state_save', { json });
    } catch {
      // Ignore serialization error during teardown
    }
  }, 1200);
}

export function sendNativeAudioPcm(_base64Float32: string, _frames: number, _sampleRate: number): void {
  // No-op: WebKit outputs directly via macOS CoreAudio for glitch-free realtime playback
}

type TransportCb = (state: HostTransportState) => void;
type MidiInCb = (events: HostMidiEvent[]) => void;
type LoadStateCb = (json: string) => void;

const transportListeners = new Set<TransportCb>();
const midiInListeners = new Set<MidiInCb>();
const loadStateListeners = new Set<LoadStateCb>();

let latestSessionJsonProvider: (() => string) | null = null;

export function registerSessionStateProvider(provider: () => string): void {
  latestSessionJsonProvider = provider;
  ensureGlobalCallbacks();
}

function ensureGlobalCallbacks(): void {
  const win = getNativeWindow();
  if (!win) return;

  if (!win.__instajammableOnHostTransport) {
    win.__instajammableOnHostTransport = (state: HostTransportState) => {
      if (!state || typeof state !== 'object') return;
      for (const cb of transportListeners) cb(state);
    };
  }

  if (!win.__instajammableOnHostMidi) {
    win.__instajammableOnHostMidi = (raw: HostMidiEvent[] | string) => {
      let events: HostMidiEvent[] = [];
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) events = parsed;
        } catch {
          events = [];
        }
      } else if (Array.isArray(raw)) {
        events = raw;
      }
      if (!events.length) return;
      for (const cb of midiInListeners) cb(events);
    };
  }

  if (!win.__instajammableOnHostLoadState) {
    win.__instajammableOnHostLoadState = (json: string) => {
      if (typeof json !== 'string' || !json.trim()) return;
      for (const cb of loadStateListeners) cb(json);
    };
  }

  if (!win.__instajammableRequestState) {
    win.__instajammableRequestState = () =>
      latestSessionJsonProvider ? latestSessionJsonProvider() : pendingStateJson;
  }
}

export function onHostTransport(cb: TransportCb): () => void {
  ensureGlobalCallbacks();
  transportListeners.add(cb);
  return () => transportListeners.delete(cb);
}

export function onHostMidiIn(cb: MidiInCb): () => void {
  ensureGlobalCallbacks();
  midiInListeners.add(cb);
  return () => midiInListeners.delete(cb);
}

export function onHostLoadState(cb: LoadStateCb): () => void {
  ensureGlobalCallbacks();
  loadStateListeners.add(cb);
  return () => loadStateListeners.delete(cb);
}

ensureGlobalCallbacks();
