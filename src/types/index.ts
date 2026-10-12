// Core types for ECHO GARDEN

export type EngineView = 'performance' | 'deepEdit' | 'playground';

export type RhythmAlgorithmType = 'euclidean' | 'probabilistic' | 'polymetric' | 'markov' | 'densityBurst';
export type AmbientAlgorithmType = 'harmonicDrone' | 'granularDrift';

export type MusicalScale = 
  | 'dorian' 
  | 'phrygian' 
  | 'lydian' 
  | 'aeolian' 
  | 'majorPentatonic' 
  | 'minorPentatonic' 
  | 'hirajoshi' 
  | 'microtonal';

export interface StepContext {
  step: number;        // Current 16th step (0-indexed)
  subStep: number;     // Micro step if applicable
  beat: number;        // Current quarter beat
  bar: number;         // Current bar (0-indexed)
  time: number;        // Scheduled AudioContext time (seconds)
  bpm: number;
}

export interface MusicalEvent {
  id: string;
  layerId: string;
  type: 'drum' | 'note';
  drumType?: 'kick' | 'snare' | 'hihat' | 'perc';
  midiNote: number;
  frequency: number;
  velocity: number;    // 0 to 127
  duration: number;    // duration in seconds
  time: number;        // audio context execution time in seconds
  channel: number;     // MIDI channel 1-16
}

export interface ParameterBoundary {
  min: number;
  max: number;
  allowMutation: boolean;
  mutationProbability: number; // 0 to 1
  mutationMagnitude: number;   // normalized 0 to 1 step fraction
  speed: number;               // rate of evolution
  locked: boolean;
}

export interface DrumVoiceParams {
  pitch: number;           // base pitch / frequency
  decay: number;           // seconds
  tone: number;            // brightness / filter / noise balance (0-1)
  drive: number;           // saturation / punch (0-1)
  volume: number;          // 0 to 1
  pan: number;             // -1 to 1
  midiNote: number;        // default MIDI note (e.g. 36 Kick, 38 Snare, 42 Hat, 37 Rim)
}

export interface AmbientSynthParams {
  rootNote: number;        // MIDI note number (e.g. 36 = C2, 48 = C3)
  scale: MusicalScale;
  osc1Wave: OscillatorType;
  osc2Wave: OscillatorType;
  osc3Wave: OscillatorType;
  detuneSpread: number;    // cents (0 to 50)
  subLevel: number;        // 0 to 1
  filterCutoff: number;    // Hz (20 to 18000)
  filterResonance: number; // Q (0.5 to 15)
  filterEnvAmount: number; // 0 to 1
  attack: number;          // seconds
  decay: number;           // seconds
  sustain: number;         // 0 to 1
  release: number;         // seconds
  lfoRate: number;         // Hz (0.01 to 5)
  lfoDepth: number;        // 0 to 1
  driftAmount: number;     // microtonal drift (0 to 1)
  volume: number;
}

export interface EffectsParams {
  delayTime: number;       // seconds or beat division
  delayFeedback: number;   // 0 to 0.95
  delayMix: number;        // 0 to 1
  delayFlutter: number;    // tape wobble (0 to 1)
  reverbSize: number;      // 0 to 1
  reverbDecay: number;     // seconds
  reverbMix: number;       // 0 to 1
  masterDrive: number;     // warmth / soft-clipping (0 to 1)
}

export interface ModulationRoute {
  id: string;
  source: 'drumDensity' | 'rhythmicAccent' | 'ambientBrightness' | 'globalChaos';
  destination: 'ambientCutoff' | 'delayFeedback' | 'reverbMix' | 'drumProbability' | 'accentLikelihood';
  depth: number;           // -1 to +1
  enabled: boolean;
}

export interface MacroControl {
  id: string;
  name: string;
  value: number;           // 0 to 1
  mappings: {
    target: string;        // e.g. 'ambient.filterCutoff'
    min: number;
    max: number;
  }[];
}

export interface LayerState {
  id: string;
  name: string;
  type: 'drum' | 'ambient';
  drumVoice?: 'kick' | 'snare' | 'hihat' | 'perc';
  muted: boolean;
  solo: boolean;
  volume: number;
  midiChannel: number;
  algorithmType: RhythmAlgorithmType | AmbientAlgorithmType;
  settings: Record<string, any>;
  boundaries: Record<string, ParameterBoundary>;
  locked: boolean;
  frozen: boolean;
}

export interface ProjectState {
  id: string;
  name: string;
  bpm: number;
  swing: number;           // 0 to 0.75
  seed: number;
  drumParams: Record<'kick' | 'snare' | 'hihat' | 'perc', DrumVoiceParams>;
  ambientParams: AmbientSynthParams;
  effectsParams: EffectsParams;
  layers: LayerState[];
  modRoutes: ModulationRoute[];
  macros: MacroControl[];
  globalEvolveActive: boolean;
  globalEvolveRate: number;
}

export interface RecordedMidiEvent {
  timestamp: number;       // relative milliseconds from session start
  type: 'noteOn' | 'noteOff';
  channel: number;
  note: number;
  velocity: number;
  durationMs?: number;
  layerId: string;
}
