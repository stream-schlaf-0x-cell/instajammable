// Authoritative Type Definitions for ECHO GARDEN

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
  step: number;        // Total 16th step from playback start (0-indexed)
  subStep: number;     // 16th step within the current bar (0-15)
  beat: number;        // Quarter beat within current bar (0-3)
  bar: number;         // Current bar index (0-indexed)
  time: number;        // Scheduled AudioContext time in seconds
  perfTime: number;    // Scheduled performance.now() time in milliseconds
  bpm: number;
  swing: number;
  swingOffset: number; // Offset in seconds applied to odd steps
}

// Single Authoritative Musical Event representation
export interface MusicalEvent {
  id: string;
  layerId: string;
  type: 'drum' | 'note';
  drumType?: 'kick' | 'snare' | 'hihat' | 'perc';
  midiNote: number;
  frequency: number;
  velocity: number;        // 1 to 127
  duration: number;        // seconds
  audioTime: number;       // AudioContext.currentTime (seconds)
  performanceTime: number; // performance.now() (milliseconds)
  channel: number;         // MIDI channel 1-16
  step: number;            // Total step index
  subStep: number;         // Step within bar (0-15)
  bar: number;             // Bar index
  swingOffsetSec: number;
  microOffsetSec: number;
}

export interface ParameterBoundary {
  min: number;
  max: number;
  isInteger?: boolean;     // Enforce integer steps/pulses/lengths/notes
  allowMutation: boolean;
  mutationProbability: number; // 0 to 1
  mutationMagnitude: number;   // normalized 0 to 1 step fraction
  speed: number;               // rate of evolution
  locked: boolean;
}

export interface DrumVoiceParams {
  pitch: number;           // base pitch / frequency in Hz
  decay: number;           // seconds
  tone: number;            // brightness / filter / noise balance (0-1)
  drive: number;           // punch / saturation (0-1)
  volume: number;          // 0 to 1
  pan: number;             // -1 to 1
  midiNote: number;        // default MIDI note
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
  lfoRate: number;         // Hz (0.01 to 10)
  lfoDepth: number;        // 0 to 1
  driftAmount: number;     // microtonal drift (0 to 1)
  voiceSpread: number;     // stereo spatial spread (0 to 1)
  volume: number;          // 0 to 1
}

export interface EffectsParams {
  delayTime: number;       // seconds
  delayFeedback: number;   // 0 to 0.95
  delayMix: number;        // 0 to 1
  delayFlutter: number;    // tape wobble (0 to 1)
  reverbSize: number;      // 0 to 1
  reverbDecay: number;     // seconds
  reverbMix: number;       // 0 to 1
  masterDrive: number;     // warmth / soft-clipping saturation (0 to 1)
  reverbDamping?: number;  // 0 bright to 1 dark: high-frequency loss inside the reverb tail
  delayTone?: number;      // 0 dark tape to 1 open: filtering of the delay feedback path
  eqLow?: number;          // Low shelf gain in dB (-14 to +14)
  eqMid?: number;          // Mid peak gain in dB (-14 to +14)
  eqMidFreq?: number;      // Mid frequency in Hz (200 to 6000)
  eqMidQ?: number;         // Mid resonance Q (0.3 to 4.0)
  eqHigh?: number;         // High shelf gain in dB (-14 to +14)
  eqHighpass?: number;     // Highpass (low-cut) frequency in Hz (20 to 400)
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
  ambientBoundaries: Record<string, ParameterBoundary>;
  effectsParams: EffectsParams;
  effectsBoundaries: Record<string, ParameterBoundary>;
  layers: LayerState[];
  modRoutes: ModulationRoute[];
  macros: MacroControl[];
  globalEvolveActive: boolean;
  globalEvolveRate: number;
  lowResourceMode: boolean; // low CPU optimizations for 2014 MacBook Pro
  deepMindEnabled: boolean;
  deepMindChannel: number;
  deepMindCCValues: Record<number, number>;
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
