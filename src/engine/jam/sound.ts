import type { AmbientSynthParams, DrumVoiceParams, EffectsParams, ModulationRoute } from '../../types';
import { ATMOSPHERE_KINDS, type AtmosphereSettings, type FlowSettings, type DrumVoice, type JamSession, type LayerAudioPatch } from '../../types/jam';

export const OSC_WAVES = ['sine', 'triangle', 'sawtooth', 'square'] as const;
export const AUDIO_PATCH_RANGES = {
  detuneSpread: [0, 50], subLevel: [0, 1], filterCutoff: [20, 18000], filterResonance: [0.5, 15], filterEnvAmount: [0, 1],
  attack: [0.005, 8], decay: [0.01, 10], sustain: [0, 1], release: [0.05, 12],
  lfoRate: [0, 10], lfoDepth: [0, 1], driftAmount: [0, 1], voiceSpread: [0, 1], volume: [0, 1],
} as const;
export const DRUM_PATCH_RANGES = { pitch: [20, 1200], decay: [0.03, 2], tone: [0, 1], drive: [0, 1], volume: [0, 1], pan: [-1, 1], midiNote: [0, 127] } as const;
export const EFFECT_PATCH_RANGES = {
  delayTime: [0.04, 2], delayFeedback: [0, 0.92], delayMix: [0, 1], delayFlutter: [0, 1],
  reverbSize: [0, 1], reverbDecay: [0.2, 14], reverbMix: [0, 1], masterDrive: [0, 1], reverbDamping: [0, 1], delayTone: [0, 1],
  eqLow: [-14, 14], eqMid: [-14, 14], eqMidFreq: [200, 6000], eqMidQ: [0.3, 4.0], eqHigh: [-14, 14], eqHighpass: [20, 400],
} as const;
export const MOD_SOURCES: ModulationRoute['source'][] = ['drumDensity', 'rhythmicAccent', 'ambientBrightness', 'globalChaos'];
export const MOD_DESTINATIONS: ModulationRoute['destination'][] = ['ambientCutoff', 'delayFeedback', 'reverbMix', 'drumProbability', 'accentLikelihood'];

export function drumPatchRanges(voice: DrumVoice): Record<keyof DrumVoiceParams, readonly [number, number]> {
  const pitch: Record<DrumVoice, readonly [number, number]> = { kick: [25, 160], snare: [100, 800], hihat: [20, 120], perc: [20, 300] };
  return { ...DRUM_PATCH_RANGES, pitch: pitch[voice], decay: voice === 'kick' || voice === 'snare' ? [0.06, 2] : voice === 'hihat' ? [0.03, 1] : [0.03, 2] };
}
function object(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Klangparameter müssen ein Objekt sein.');
  return raw as Record<string, unknown>;
}
function number(value: unknown, key: string, range: readonly [number, number]): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Ungültiger Klangparameter: ${key}.`);
  return Math.max(range[0], Math.min(range[1], value));
}
export function sanitizeAudioPatch(raw: unknown): LayerAudioPatch {
  const patch: LayerAudioPatch = {};
  for (const [key, value] of Object.entries(object(raw))) {
    if (['osc1Wave', 'osc2Wave', 'osc3Wave'].includes(key)) {
      if (!(OSC_WAVES as readonly unknown[]).includes(value)) throw new Error(`Ungültige Wellenform: ${key}.`);
      patch[key as 'osc1Wave' | 'osc2Wave' | 'osc3Wave'] = value as OscillatorType;
    } else if (Object.hasOwn(AUDIO_PATCH_RANGES, key)) (patch as Record<string, unknown>)[key] = number(value, key, AUDIO_PATCH_RANGES[key as keyof typeof AUDIO_PATCH_RANGES]);
    else throw new Error(`Unbekannter Klangparameter: ${key}.`);
  }
  return patch;
}
export function sanitizeDrumPatch(raw: unknown, voice: DrumVoice): Partial<DrumVoiceParams> {
  const patch: Partial<DrumVoiceParams> = {}; const ranges = drumPatchRanges(voice);
  for (const [key, value] of Object.entries(object(raw))) {
    if (!(Object.hasOwn(ranges, key))) throw new Error(`Unbekannter Drumparameter: ${key}.`);
    const parsed = number(value, key, ranges[key as keyof DrumVoiceParams]);
    patch[key as keyof DrumVoiceParams] = key === 'midiNote' ? Math.round(parsed) : parsed;
  }
  return patch;
}
export function sanitizeEffectsPatch(raw: unknown): Partial<EffectsParams> {
  const patch: Partial<EffectsParams> = {};
  for (const [key, value] of Object.entries(object(raw))) {
    if (!(Object.hasOwn(EFFECT_PATCH_RANGES, key))) throw new Error(`Unbekannter Effektparameter: ${key}.`);
    patch[key as keyof EffectsParams] = number(value, key, EFFECT_PATCH_RANGES[key as keyof EffectsParams]);
  }
  return patch;
}
export const DEFAULT_ATMOSPHERE: AtmosphereSettings = { kind: 'off', level: 0.08, tone: 0.5, movement: 0.4 };
export function sanitizeAtmosphere(raw: unknown): AtmosphereSettings {
  const value = object(raw); const kind = value.kind;
  if (!(ATMOSPHERE_KINDS as readonly unknown[]).includes(kind)) throw new Error('Unbekannte Atmosphäre.');
  const maxLevel = 0.10;
  const parsedLevel = number(value.level ?? DEFAULT_ATMOSPHERE.level, 'Atmosphäre-Pegel', [0, 0.10]);
  const result: AtmosphereSettings = { kind: kind as AtmosphereSettings['kind'], level: Math.min(maxLevel, parsedLevel),
    tone: number(value.tone ?? DEFAULT_ATMOSPHERE.tone, 'Atmosphäre-Klang', [0, 1]), movement: number(value.movement ?? DEFAULT_ATMOSPHERE.movement, 'Atmosphäre-Bewegung', [0, 1]) };
  if (typeof value.sampleName === 'string') result.sampleName = value.sampleName.slice(0, 120);
  return result;
}
export function sanitizeFlow(raw: unknown): FlowSettings {
  const value = object(raw); if (typeof value.enabled !== 'boolean') throw new Error('Ungültiger Flow-Schalter.');
  return { enabled: value.enabled, bars: Math.round(number(value.bars ?? 16, 'Flow-Länge', [4, 64])), depth: number(value.depth ?? 0.5, 'Flow-Tiefe', [0, 1]) };
}
export function sanitizeModRoutes(raw: unknown): ModulationRoute[] {
  if (!Array.isArray(raw) || raw.length > 16) throw new Error('Maximal 16 Modulationsrouten sind möglich.');
  const ids = new Set<string>();
  return raw.map(value => {
    const route = object(value);
    if (typeof route.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(route.id) || ids.has(route.id)) throw new Error('Ungültige Modulationsroute.');
    ids.add(route.id);
    if (!MOD_SOURCES.includes(route.source as ModulationRoute['source']) || !MOD_DESTINATIONS.includes(route.destination as ModulationRoute['destination']) || typeof route.enabled !== 'boolean') throw new Error('Unbekannte Modulationsquelle oder Ziel.');
    return { id: route.id, source: route.source as ModulationRoute['source'], destination: route.destination as ModulationRoute['destination'], enabled: route.enabled, depth: number(route.depth, 'Modulationstiefe', [-1, 1]) };
  });
}
export function sanitizePinnedParams(raw: unknown, session: Pick<JamSession, 'layers'>): string[] {
  if (!Array.isArray(raw) || raw.length > 64 || !raw.every(value => typeof value === 'string')) throw new Error('Ungültige Auswahl angehefteter Parameter.');
  const valid = new Set<string>();
  for (const layer of session.layers) {
    const ranges = layer.role === 'drum' ? Object.keys(DRUM_PATCH_RANGES) : [...Object.keys(AUDIO_PATCH_RANGES), 'osc1Wave', 'osc2Wave', 'osc3Wave'];
    for (const key of ranges) valid.add(`${layer.role === 'drum' ? 'drum' : 'sound'}:${layer.id}:${key}`);
  }
  for (const key of Object.keys(EFFECT_PATCH_RANGES)) valid.add(`fx:${key}`);
  return [...new Set(raw.filter(value => valid.has(value)))];
}
export function mergeAudioPatch(base: AmbientSynthParams, patch: LayerAudioPatch | undefined): AmbientSynthParams {
  return patch ? { ...base, ...sanitizeAudioPatch(patch) } : base;
}
