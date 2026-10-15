import type { CustomMacro, EffectModuleConfig, MacroTargetParam } from '../../types/jam';

export interface ParamOption {
  param: MacroTargetParam;
  label: string;
  category: 'Effekte' | 'Makros' | 'Atmosphäre' | 'Spuren';
  defaultMin: number;
  defaultMax: number;
  step: number;
  unit?: string;
  percent?: boolean;
}

export const TARGET_PARAM_OPTIONS: ParamOption[] = [
  // Effekte
  { param: 'fx:reverbMix', label: 'Hall-Anteil (Reverb Mix)', category: 'Effekte', defaultMin: 0, defaultMax: 0.8, step: 0.01, percent: true },
  { param: 'fx:reverbSize', label: 'Raumgröße (Reverb Size)', category: 'Effekte', defaultMin: 0.2, defaultMax: 1, step: 0.01, percent: true },
  { param: 'fx:reverbDecay', label: 'Nachhallzeit (Decay)', category: 'Effekte', defaultMin: 1.5, defaultMax: 9.5, step: 0.1, unit: 's' },
  { param: 'fx:delayMix', label: 'Echo-Anteil (Delay Mix)', category: 'Effekte', defaultMin: 0, defaultMax: 0.7, step: 0.01, percent: true },
  { param: 'fx:delayFeedback', label: 'Echo-Feedback (Wiederholungen)', category: 'Effekte', defaultMin: 0.1, defaultMax: 0.85, step: 0.01, percent: true },
  { param: 'fx:delayFlutter', label: 'Tape Flutter (Bandleiern)', category: 'Effekte', defaultMin: 0, defaultMax: 0.8, step: 0.01, percent: true },
  { param: 'fx:masterDrive', label: 'Wärme & Bandsättigung (Drive)', category: 'Effekte', defaultMin: 0, defaultMax: 0.45, step: 0.01, percent: true },
  { param: 'fx:eqLow', label: 'Studio EQ: Bass / Low (dB)', category: 'Effekte', defaultMin: -8, defaultMax: 8, step: 0.5, unit: 'dB' },
  { param: 'fx:eqMid', label: 'Studio EQ: Mitten / Mid (dB)', category: 'Effekte', defaultMin: -8, defaultMax: 8, step: 0.5, unit: 'dB' },
  { param: 'fx:eqHigh', label: 'Studio EQ: Höhen / Treble (dB)', category: 'Effekte', defaultMin: -8, defaultMax: 8, step: 0.5, unit: 'dB' },
  { param: 'fx:eqHighpass', label: 'Studio EQ: Low-Cut (Hz)', category: 'Effekte', defaultMin: 20, defaultMax: 300, step: 5, unit: 'Hz' },

  // Makros
  { param: 'macro:space', label: 'Makro: Raum (Space)', category: 'Makros', defaultMin: 0, defaultMax: 1, step: 0.01, percent: true },
  { param: 'macro:warmth', label: 'Makro: Wärme (Warmth)', category: 'Makros', defaultMin: 0, defaultMax: 1, step: 0.01, percent: true },
  { param: 'macro:density', label: 'Makro: Dichte (Density)', category: 'Makros', defaultMin: 0, defaultMax: 1, step: 0.01, percent: true },
  { param: 'macro:movement', label: 'Makro: Bewegung (Movement)', category: 'Makros', defaultMin: 0, defaultMax: 1, step: 0.01, percent: true },

  // Atmosphäre & Pump
  { param: 'atmo:level', label: 'Atmosphäre-Pegel (max 20%)', category: 'Atmosphäre', defaultMin: 0, defaultMax: 0.20, step: 0.005, percent: true },
  { param: 'pump', label: 'Kick-Atmung (Pump Ducking)', category: 'Atmosphäre', defaultMin: 0, defaultMax: 0.8, step: 0.01, percent: true },

  // Spuren
  { param: 'layer:kick:volume', label: 'Kick-Lautstärke', category: 'Spuren', defaultMin: 0, defaultMax: 1, step: 0.01, percent: true },
  { param: 'layer:snare:volume', label: 'Snare-Lautstärke', category: 'Spuren', defaultMin: 0, defaultMax: 1, step: 0.01, percent: true },
  { param: 'layer:chords:volume', label: 'Akkorde-Lautstärke', category: 'Spuren', defaultMin: 0, defaultMax: 1, step: 0.01, percent: true },
  { param: 'layer:melody:volume', label: 'Melodie-Lautstärke', category: 'Spuren', defaultMin: 0, defaultMax: 1, step: 0.01, percent: true },
  { param: 'layer:bass:volume', label: 'Bass-Lautstärke', category: 'Spuren', defaultMin: 0, defaultMax: 1, step: 0.01, percent: true },
  { param: 'layer:drone:volume', label: 'Drone-Lautstärke', category: 'Spuren', defaultMin: 0, defaultMax: 1, step: 0.01, percent: true },
];

export function findParamOption(paramKey: string): ParamOption {
  return TARGET_PARAM_OPTIONS.find(o => o.param === paramKey) || {
    param: paramKey as MacroTargetParam,
    label: paramKey,
    category: 'Effekte',
    defaultMin: 0,
    defaultMax: 1,
    step: 0.01,
  };
}

export const DEFAULT_EFFECT_MODULES: EffectModuleConfig[] = [
  { id: 'eq', name: 'Studio 3-Band Parametric EQ', bypassed: false },
  { id: 'warmth', name: 'Tape Warmth & Drive', bypassed: false },
  { id: 'flutter', name: 'Analog Flutter & Drift', bypassed: false },
  { id: 'delay', name: 'Stereo Space Delay', bypassed: false },
  { id: 'reverb', name: 'Cathedral Shimmer Reverb', bypassed: false },
  { id: 'pump', name: 'Kick-Pump Sidechain', bypassed: false },
];

export const DEFAULT_WORKSPACE_MODULES = [
  'pianoroll',
  'soundscape',
  'sequencer',
  'fxchain',
  'eq',
  'custommacros',
  'atmosphere',
];

export interface EqPreset {
  id: string;
  name: string;
  subtitle: string;
  highpass: number;
  low: number;
  mid: number;
  midFreq: number;
  midQ: number;
  high: number;
}

export const EQ_PRESETS: EqPreset[] = [
  { id: 'flat', name: 'Flat / Neutral', subtitle: '0 dB linearer Studio-Frequenzgang', highpass: 20, low: 0, mid: 0, midFreq: 1000, midQ: 1.0, high: 0 },
  { id: 'warm-scoop', name: 'Warm Tape Scoop', subtitle: 'Warme Tiefen, sanfter Mitten-Scoop, samtige Höhen', highpass: 25, low: 3.2, mid: -2.0, midFreq: 850, midQ: 0.9, high: 1.8 },
  { id: 'lofi-radio', name: 'Lo-Fi Radio & Transistor', subtitle: 'Highpass-Cut, markante Telefon-Mitten, gedämpfte Höhen', highpass: 320, low: -4.5, mid: 4.8, midFreq: 1800, midQ: 1.8, high: -6.0 },
  { id: 'deep-ambient', name: 'Deep Space Ambient', subtitle: 'Sub-Fundament, weiche Mitten für Hall, glasklare Höhen', highpass: 22, low: 4.0, mid: -1.5, midFreq: 600, midQ: 0.7, high: 2.8 },
  { id: 'club-punch', name: 'Punchy Beat & Bass', subtitle: 'Tiefbass-Punch, aufgeräumte Tiefmitten, präsenter Kick-Snap', highpass: 35, low: 3.8, mid: 1.5, midFreq: 2400, midQ: 1.2, high: 1.2 },
  { id: 'air-shimmer', name: 'Silky Shimmer & Air', subtitle: 'Subtile Tiefen, offene transparente Höhen für Pads & Hall', highpass: 30, low: 1.0, mid: 0, midFreq: 1200, midQ: 1.0, high: 4.5 },
];

export const WORKSPACE_PRESETS: Record<string, { label: string; description: string; modules: string[] }> = {
  minimal: {
    label: '🌱 Minimal Flow',
    description: 'Nur Akkord-Bühne, Pianorolle und Kern-Makros. Perfekt für konzentriertes Spielen.',
    modules: ['pianoroll', 'custommacros'],
  },
  soundscape: {
    label: '🎻 Klangwelt & FX',
    description: 'Streichorchester, Studio-EQ, modulare Effektkette, Chaos-Modulator und Texturen im Fokus.',
    modules: ['soundscape', 'eq', 'fxchain', 'chaos', 'atmosphere'],
  },
  arrangement: {
    label: '⏱️ Arrangement & Flow',
    description: 'Sequencer (4 Takte dies, 4 Takte jenes), Spontan-Pads und Rhythmen.',
    modules: ['sequencer', 'rhythms', 'soundscape'],
  },
  full: {
    label: '🎛️ Volles Studio',
    description: 'Alle Decks und Klangwerkzeuge gleichzeitig geöffnet.',
    modules: ['pianoroll', 'soundscape', 'sequencer', 'eq', 'fxchain', 'chaos', 'custommacros', 'atmosphere', 'rhythms', 'scenes'],
  },
};

export const INITIAL_CUSTOM_MACROS: CustomMacro[] = [
  {
    id: 'macro-psybient-wash',
    name: 'Psybient Shimmer',
    color: '#06b6d4',
    value: 0.45,
    targets: [
      { id: 't1', param: 'fx:delayMix', min: 0.08, max: 0.62 },
      { id: 't2', param: 'fx:reverbMix', min: 0.20, max: 0.75 },
      { id: 't3', param: 'macro:space', min: 0.35, max: 0.92 },
    ],
  },
  {
    id: 'macro-dreck-space',
    name: 'Dreck & Space',
    color: '#f59e0b',
    value: 0.35,
    targets: [
      { id: 't4', param: 'fx:masterDrive', min: 0, max: 0.40 },
      { id: 't5', param: 'fx:delayFlutter', min: 0, max: 0.65 },
      { id: 't6', param: 'fx:reverbSize', min: 0.35, max: 0.95 },
    ],
  },
  {
    id: 'macro-filter-drop',
    name: 'Breakdown Drop',
    color: '#8b5cf6',
    value: 0.20,
    targets: [
      { id: 't7', param: 'macro:warmth', min: 0.20, max: 0.85 },
      { id: 't8', param: 'layer:kick:volume', min: 0.1, max: 0.85, inverted: true },
      { id: 't9', param: 'fx:reverbMix', min: 0.25, max: 0.70 },
    ],
  },
];
