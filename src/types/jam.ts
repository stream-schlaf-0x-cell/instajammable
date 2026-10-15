import type { MusicalScale, AmbientSynthParams, DrumVoiceParams, EffectsParams, ModulationRoute } from './index';
export type LayerAudioPatch = Partial<Omit<AmbientSynthParams, 'rootNote' | 'scale'>>;

export type JamStyle = 'ambient' | 'lofi' | 'techno';
export type LayerRole = 'drone' | 'chords' | 'bass' | 'melody' | 'drum';
export type DrumVoice = 'kick' | 'snare' | 'hihat' | 'perc';
export type OutputMode = 'internal' | 'midi' | 'both';
export const TIMBRES = ['warm', 'air', 'keys', 'bell', 'strings', 'wash', 'dub', 'root', 'glass', 'organ', 'solina', 'shimmer', 'celeste'] as const;
export type Timbre = typeof TIMBRES[number];
export const ATMOSPHERE_KINDS = ['off', 'tape', 'air', 'vinyl', 'rain', 'sample'] as const;
export type AtmosphereKind = typeof ATMOSPHERE_KINDS[number];
/** Continuous background texture: generated noise beds or a loop the user loaded locally. */
export interface AtmosphereSettings { kind: AtmosphereKind; level: number; tone: number; movement: number; sampleName?: string }
/** Gentle automatic section changes: macros drift and drums breathe in and out. Never touches key or tempo. */
export interface FlowSettings { enabled: boolean; bars: 4 | 8 | 16 | 32 | number; depth: number }
export type MacroName = 'movement' | 'density' | 'warmth' | 'space';
export type ChordPattern = 'pad' | 'pulse' | 'broken' | 'syncopated' | 'euclidean' | 'wave' | 'cluster';
export const CHORD_PATTERNS: readonly ChordPattern[] = ['pad', 'pulse', 'broken', 'syncopated', 'euclidean', 'wave', 'cluster'] as const;
export type ChordPace = '1-bar' | '2-bars' | '4-bars' | 'dynamic';
export const CHORD_PACES: readonly ChordPace[] = ['1-bar', '2-bars', '4-bars', 'dynamic'] as const;
export type ChordTexture = 'off' | 'shimmer' | 'octave' | 'sub5th';
export const CHORD_TEXTURES: readonly ChordTexture[] = ['off', 'shimmer', 'octave', 'sub5th'] as const;

export interface LayerSettings {
  density: number;
  audioPatch?: LayerAudioPatch;
  drumPatch?: Partial<DrumVoiceParams>;
  ambientAlgorithm?: 'harmonicDrone' | 'granularDrift';
  rhythmAlgorithm?: 'composed' | 'euclidean' | 'probabilistic' | 'polymetric' | 'markov' | 'densityBurst';
  chordPattern?: ChordPattern;
  chordPace?: ChordPace;
  chordTexture?: ChordTexture;
  mutationDensityMin?: number;
  mutationDensityMax?: number;
  minNote: number;
  maxNote: number;
  phraseBars: number;
  humanizeMs: number;
  velocityMin: number;
  velocityMax: number;
  timbre: Timbre;
}
export interface JamLayer {
  id: string;
  name: string;
  role: LayerRole;
  drumVoice?: DrumVoice;
  color: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  frozen: boolean;
  channel: number;
  outputId: string | null;
  settings: LayerSettings;
}
export interface ClipNote {
  id: string;
  layerId: string;
  note: number;
  velocity: number;
  channel: number;
  startBeat: number;
  durationBeats: number;
}
export interface ClipTempo { beat: number; bpm: number }
export interface ClipRawEvent { layerId: string; beat: number; bytes: number[] }
export interface MidiClip {
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  style: JamStyle;
  root: number;
  scale: MusicalScale;
  bpm: number;
  lengthBeats: number;
  notes: ClipNote[];
  tempos: ClipTempo[];
  extraEvents: ClipRawEvent[];
  tracks: { id: string; name: string; channel: number; color: string }[];
  warnings?: string[];
}
export interface JamEvent extends ClipNote {
  audioTime: number;
  performanceTime: number;
  bpm: number;
}
export interface JamSession {
  version: 2;
  id: string;
  name: string;
  sceneId: string;
  style: JamStyle;
  root: number;
  scale: MusicalScale;
  bpm: number;
  swing: number;
  seed: number;
  evolving: boolean;
  outputMode: OutputMode;
  globalOutputId?: string | null;
  effectsPatch?: Partial<EffectsParams>;
  modRoutes?: ModulationRoute[];
  pinnedParams?: string[];
  volume: number;
  lowResource: boolean;
  deepMindEnabled: boolean;
  deepMindChannel: number;
  pinned: MacroName[];
  atmosphere?: AtmosphereSettings;
  /** Kick-triggered ducking of pads and atmosphere, 0..1. */
  pump?: number;
  flow?: FlowSettings;
  macros: Record<MacroName, number>;
  layers: JamLayer[];
  changes: { id: string; beat: number; label: string }[];
  arrangement?: ArrangementSection;
  sequence?: SequenceBlock[];
  sequencerEnabled?: boolean;
  customMacros?: CustomMacro[];
  effectChain?: EffectChainSettings;
  workspaceModules?: string[];
  runtime?: Record<string, unknown>;
}
export type ArrangementSection = 'groove' | 'chorus' | 'breakdown' | 'buildup' | 'silent';

export type MacroTargetParam =
  | 'fx:reverbMix'
  | 'fx:reverbSize'
  | 'fx:reverbDecay'
  | 'fx:delayMix'
  | 'fx:delayFeedback'
  | 'fx:delayFlutter'
  | 'fx:masterDrive'
  | 'fx:eqLow'
  | 'fx:eqMid'
  | 'fx:eqHigh'
  | 'fx:eqHighpass'
  | 'macro:space'
  | 'macro:warmth'
  | 'macro:density'
  | 'macro:movement'
  | 'atmo:level'
  | 'pump'
  | 'layer:kick:volume'
  | 'layer:snare:volume'
  | 'layer:chords:volume'
  | 'layer:melody:volume'
  | 'layer:bass:volume'
  | 'layer:drone:volume';

export interface CustomMacroTarget {
  id: string;
  param: MacroTargetParam | string;
  label?: string;
  min: number;
  max: number;
  inverted?: boolean;
}

export interface CustomMacro {
  id: string;
  name: string;
  color: string;
  value: number; // 0..1
  targets: CustomMacroTarget[];
}

export type EffectChainMode = 'parallel' | 'delay-into-reverb' | 'reverb-into-delay';
export type EffectModuleId = 'eq' | 'warmth' | 'flutter' | 'delay' | 'reverb' | 'pump';

export interface EffectModuleConfig {
  id: EffectModuleId;
  name: string;
  bypassed: boolean;
}

export interface EffectChainSettings {
  mode: EffectChainMode;
  modules: EffectModuleConfig[];
}

export type WorkspaceModuleId =
  | 'pianoroll'
  | 'soundscape'
  | 'sequencer'
  | 'fxchain'
  | 'eq'
  | 'chaos'
  | 'custommacros'
  | 'atmosphere'
  | 'rhythms'
  | 'scenes';

export interface SequenceBlock {
  id: string;
  section: ArrangementSection;
  bars: number;
  label?: string;
  macroTargets?: Partial<Record<MacroName, number>>;
}

export interface SequencerPosition {
  enabled: boolean;
  activeBlockIndex: number;
  totalBlocks: number;
  blockBarProgress: number;
  totalBlockBars: number;
  currentSection: ArrangementSection;
  currentBlockLabel?: string;
  nextSection?: ArrangementSection;
  nextBlockLabel?: string;
  barsUntilNextBlock: number;
}

export interface JamPosition {
  beat: number;
  bar: number;
  playing: boolean;
  chord: string;
  chordNotes: number[];
  voices: number;
  capturedBars: number;
  clipOverride: boolean;
  /** Tonic of the sounding chord (MIDI), for the chord stage and piano-roll tint. */
  chordRoot: number;
  chordHoldBars: number;
  /** Bars (fractional) until the harmony changes. */
  chordBarsLeft: number;
  nextChord: string;
  arrangementSection?: ArrangementSection;
  buildupCountdown?: number;
  autoArrangement?: boolean;
  sequencer?: SequencerPosition;
}
export interface SceneDefinition {
  id: string;
  name: string;
  description: string;
  style: JamStyle;
  bpm: number;
  root: number;
  scale: MusicalScale;
  mood?: string;
}
