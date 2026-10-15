import type { AmbientSynthParams, DrumVoiceParams, EffectsParams, StepContext, MusicalScale } from '../../types';
import { TIMBRES, CHORD_PATTERNS, CHORD_PACES, CHORD_TEXTURES, type ChordPattern, type ChordPace, type ChordTexture, type JamEvent, type JamLayer, type JamPosition, type JamSession, type LayerSettings, type MacroName, type MidiClip, type ClipTempo, type ClipRawEvent, type ArrangementSection, type DrumVoice, type SequenceBlock, type SequencerPosition, type Timbre, type CustomMacro, type CustomMacroTarget, type EffectChainMode, type EffectChainSettings, type EffectModuleId, type EffectModuleConfig, type AtmosphereKind, type JamStyle } from '../../types/jam';
import { MasterAudio } from '../audio/audioContext';
import { AmbientSynth } from '../audio/ambientSynth';
import { DrumSynth } from '../audio/drumSynth';
import { EffectsRack } from '../audio/effects';
import { AtmosphereBed } from '../audio/atmosphere';
import { AudioRecorder } from '../audio/recorder';
import { MusicalClock } from '../clock';
import { WebMidiManager } from '../midi/webMidi';
import { PRNG } from '../prng';
import { ModulationMatrix, type ModulationOffsets, type ModulationSources } from '../modulation/modMatrix';
import { mergeAudioPatch, sanitizeAtmosphere, sanitizeAudioPatch, sanitizeDrumPatch, sanitizeEffectsPatch, sanitizeFlow, sanitizeModRoutes, sanitizePinnedParams, EFFECT_PATCH_RANGES } from './sound';
import { createSession } from './scenes';
import { validateClip } from './storage';
import { JamComposer, captureNotes, clamp, clipEventsAtStep, holdBarsFor, SCALE_INTERVALS, streamSeed, type Harmony, type PlannedNote } from './music';
import { findRhythmPreset } from './rhythms';
import { createDefaultSequence, findSequenceTemplate, SEQUENCE_TEMPLATES } from './sequencer';
import { findSoundscapePreset, SOUNDSCAPE_PRESETS } from './soundscapes';
import { DEFAULT_EFFECT_MODULES, DEFAULT_WORKSPACE_MODULES, INITIAL_CUSTOM_MACROS, TARGET_PARAM_OPTIONS, WORKSPACE_PRESETS, findParamOption, EQ_PRESETS } from './customMacros';
import {
  INSTRUMENT_PRESETS,
  getInstrumentPresets,
  getInstrumentPresetById,
  detectActiveInstrumentPreset,
  applyInstrumentPreset as applyPresetToSession,
  cycleInstrumentPreset as cyclePresetInSession,
  randomizeInstrumentPreset as randomizePresetInSession,
  type InstrumentPreset
} from './instrumentPresets';
export { SCENES } from './scenes';
export { SOUNDSCAPE_PRESETS, findSoundscapePreset };
export { SEQUENCE_TEMPLATES, findSequenceTemplate, createDefaultSequence };
export { DEFAULT_EFFECT_MODULES, DEFAULT_WORKSPACE_MODULES, INITIAL_CUSTOM_MACROS, TARGET_PARAM_OPTIONS, WORKSPACE_PRESETS, findParamOption, EQ_PRESETS };
export { INSTRUMENT_PRESETS, getInstrumentPresets, getInstrumentPresetById, detectActiveInstrumentPreset, type InstrumentPreset };

interface TimingAnchor { beat: number; audioTime: number; bpm: number; harmony: Harmony }
const clone = <T>(value: T): T => structuredClone(value);
const nowPerf = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
const drumLayer = (note: number): string => [35, 36].includes(note) ? 'kick' : [38, 40].includes(note) ? 'snare' : [42, 44, 46].includes(note) ? 'hihat' : 'perc';
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const rootPitchName = (midi: number) => NOTE_NAMES[((Math.round(midi) % 12) + 12) % 12];

export function ambientPatch(layer: JamLayer, session: JamSession, beat = 0, cutoffOffset = 0): AmbientSynthParams {
  const timbre = layer.settings.timbre; const bass = layer.role === 'bass'; const pluck = timbre === 'keys' || timbre === 'bell' || timbre === 'celeste';
  const movement = layer.locked || layer.frozen ? 0 : session.macros.movement;
  const drift = session.evolving ? Math.sin(beat / 37 + layer.id.length) * movement : 0;
  const warmth = session.macros.warmth;
  const base: AmbientSynthParams = { rootNote: session.root, scale: session.scale,
    osc1Wave: timbre === 'strings' || timbre === 'solina' ? 'sawtooth' : timbre === 'bell' ? 'sine' : timbre === 'keys' || timbre === 'celeste' ? 'triangle' : 'sine',
    osc2Wave: timbre === 'strings' || timbre === 'solina' ? 'sawtooth' : 'triangle', osc3Wave: timbre === 'air' || timbre === 'bell' || timbre === 'shimmer' ? 'sine' : 'triangle',
    detuneSpread: bass ? 2.5 : timbre === 'strings' || timbre === 'solina' ? 14 : timbre === 'air' || timbre === 'shimmer' ? 10 : 4 + movement * 4,
    subLevel: bass ? 0.35 : timbre === 'warm' ? 0.08 : 0,
    filterCutoff: bass ? 380 : clamp((timbre === 'air' ? 3400 : timbre === 'bell' ? 5200 : timbre === 'shimmer' ? 3800 : 2500) * (1 - warmth * 0.65) * (1 + drift * 0.35), 180, 6000),
    filterResonance: 0.7, filterEnvAmount: pluck ? 0.28 : 0.05,
    attack: bass ? 0.010 : pluck ? 0.015 : timbre === 'air' ? 0.65 : 1.1,
    decay: pluck ? 0.75 : 2.1, sustain: bass ? 0.78 : pluck ? 0.25 : 0.74,
    release: bass ? 0.24 : pluck ? 0.75 : 1.5 + session.macros.space * 1.2,
    lfoRate: bass ? 0.25 : 0.065 + movement * 0.09, lfoDepth: bass ? 0.05 : 0.07 + movement * 0.12,
    driftAmount: bass ? 0.12 : movement * 0.12, voiceSpread: bass ? 0 : layer.role === 'melody' ? 0.35 : 0.55,
    volume: bass ? 0.78 : timbre === 'bell' ? 0.45 : 0.48,
  };

  if (bass) {
    if (session.style === 'lofi') {
      // Real jazz bass / neo-soul / lo-fi: warm triangle fundamental + filtered sawtooth body growl,
      // plump tactile finger attack, woody pickup resonance, organic tape wow and thick sub foundation.
      Object.assign(base, {
        osc1Wave: 'triangle', osc2Wave: 'sawtooth', osc3Wave: 'sine',
        detuneSpread: 2.5, subLevel: 0.40 + warmth * 0.10,
        filterCutoff: clamp(380 * (1 + warmth * 0.22) * (1 + drift * 0.18), 160, 950),
        filterResonance: 1.25, filterEnvAmount: 0.32,
        attack: 0.010, decay: 0.55, sustain: 0.80, release: 0.26,
        lfoRate: 0.30 + movement * 0.15, lfoDepth: 0.06 + movement * 0.05,
        driftAmount: 0.14, voiceSpread: 0, volume: 0.78,
      });
    } else if (session.style === 'techno') {
      Object.assign(base, {
        osc1Wave: 'sawtooth', osc2Wave: 'triangle', osc3Wave: 'sine',
        detuneSpread: 1.8, subLevel: 0.34,
        filterCutoff: clamp(320 * (1 - warmth * 0.25) * (1 + drift * 0.2), 140, 750),
        filterResonance: 1.15, filterEnvAmount: 0.22,
        attack: 0.008, decay: 0.38, sustain: 0.68, release: 0.16,
        lfoRate: 0, lfoDepth: 0, driftAmount: 0.05, voiceSpread: 0, volume: 0.74,
      });
    } else {
      // Ambient / Psybient / Ultimae deep organic sub-bass
      Object.assign(base, {
        osc1Wave: 'sine', osc2Wave: 'triangle', osc3Wave: 'sine',
        detuneSpread: 1.2, subLevel: 0.34,
        filterCutoff: clamp(360 * (1 - warmth * 0.3) * (1 + drift * 0.15), 150, 800),
        filterResonance: 0.85, filterEnvAmount: 0.12,
        attack: 0.024, decay: 1.2, sustain: 0.85, release: 0.45,
        lfoRate: 0.12 + movement * 0.08, lfoDepth: 0.04 + movement * 0.04,
        driftAmount: 0.08, voiceSpread: 0, volume: 0.74,
      });
    }
  } else if (timbre === 'solina') {
    // 70s Solina String Ensemble / Eminent 310 Unique (Cell aesthetic):
    // Sawtooth waveforms, bucket-brigade chorus detune, tape warmth, silky roll-off.
    Object.assign(base, {
      osc1Wave: 'sawtooth', osc2Wave: 'sawtooth', osc3Wave: 'triangle',
      detuneSpread: 16 + movement * 5, subLevel: 0.12,
      filterCutoff: clamp(2200 * (1 - warmth * 0.45) * (1 + drift * 0.20), 380, 4800),
      filterResonance: 0.78, filterEnvAmount: 0.22,
      attack: 1.4, decay: 2.8, sustain: 0.88, release: 4.8 + session.macros.space * 2.8,
      lfoRate: 0.18 + movement * 0.10, lfoDepth: 0.14 + movement * 0.10,
      driftAmount: 0.22 + movement * 0.12, voiceSpread: 0.95, volume: 0.44
    });
  } else if (timbre === 'shimmer') {
    // Upper-register crystalline shimmer pad with wide stereo breath
    Object.assign(base, {
      osc1Wave: 'sine', osc2Wave: 'triangle', osc3Wave: 'sawtooth',
      detuneSpread: 14 + movement * 6, subLevel: 0.03,
      filterCutoff: clamp(3800 * (1 - warmth * 0.35) * (1 + drift * 0.25), 650, 7200),
      filterResonance: 0.75, filterEnvAmount: 0.26,
      attack: 1.2, decay: 2.6, sustain: 0.82, release: 5.6 + session.macros.space * 3.6,
      lfoRate: 0.09 + movement * 0.08, lfoDepth: 0.16 + movement * 0.10,
      driftAmount: 0.25 + movement * 0.15, voiceSpread: 0.96, volume: 0.40
    });
  } else if (timbre === 'celeste') {
    // Warm felt acoustic piano / celesta hybrid: tactile pluck, warm bell sustain
    Object.assign(base, {
      osc1Wave: 'triangle', osc2Wave: 'sine', osc3Wave: 'triangle',
      detuneSpread: 6, subLevel: 0.06,
      filterCutoff: clamp(2600 * (1 - warmth * 0.45) * (1 + drift * 0.20), 450, 4600),
      filterResonance: 0.72, filterEnvAmount: 0.32,
      attack: 0.016, decay: 2.4, sustain: 0.42, release: 4.2 + session.macros.space * 2.4,
      lfoRate: 0.08, lfoDepth: 0.08 + movement * 0.06,
      driftAmount: 0.16, voiceSpread: 0.82, volume: 0.42
    });
  } else if (timbre === 'strings') {
    Object.assign(base, {
      osc1Wave: 'sawtooth', osc2Wave: 'sawtooth', osc3Wave: 'triangle',
      detuneSpread: 18 + movement * 6, subLevel: 0.14,
      filterCutoff: clamp(3000 * (1 - warmth * 0.48) * (1 + drift * 0.22), 400, 5600),
      filterResonance: 0.82, filterEnvAmount: 0.28, attack: 2.2, decay: 3.2, sustain: 0.88,
      release: 5.5 + session.macros.space * 3.5,
      lfoRate: 0.14 + movement * 0.08, lfoDepth: 0.16 + movement * 0.10,
      driftAmount: 0.26 + movement * 0.15, voiceSpread: 0.95, volume: 0.46
    });
  } else if (!bass && timbre === 'wash') Object.assign(base, { osc1Wave: 'sawtooth', osc2Wave: 'sawtooth', osc3Wave: 'triangle', detuneSpread: 10 + movement * 4, subLevel: 0.05,
    filterCutoff: clamp(1700 * (1 - warmth * 0.6) * (1 + drift * 0.25), 280, 4200), filterResonance: 0.72, filterEnvAmount: 0.2, attack: 2.2, decay: 2.5, sustain: 0.82, release: 4.5 + session.macros.space * 2,
    lfoRate: 0.05 + movement * 0.06, lfoDepth: 0.15 + movement * 0.12, driftAmount: 0.18 + movement * 0.12, voiceSpread: 0.85, volume: 0.35 });
  else if (!bass && timbre === 'air') Object.assign(base, {
    osc1Wave: 'sine', osc2Wave: 'triangle', osc3Wave: 'sine', detuneSpread: 10 + movement * 5, subLevel: 0.04,
    filterCutoff: clamp(3100 * (1 - warmth * 0.4) * (1 + drift * 0.25), 450, 5800), filterResonance: 0.74, filterEnvAmount: 0.16, attack: 1.8, decay: 2.8, sustain: 0.80, release: 5.0 + session.macros.space * 3,
    lfoRate: 0.07, lfoDepth: 0.12 + movement * 0.08, driftAmount: 0.18, voiceSpread: 0.88, volume: 0.40
  });
  else if (!bass && timbre === 'dub') Object.assign(base, { osc1Wave: 'sawtooth', osc2Wave: 'sawtooth', osc3Wave: 'triangle', detuneSpread: 8, subLevel: 0.1,
    filterCutoff: clamp(820 * (1 - warmth * 0.4) * (1 + drift * 0.25), 250, 2200), filterResonance: 1.5, filterEnvAmount: 0.75, attack: 0.008, decay: 0.4, sustain: 0.12, release: 2.8 + session.macros.space * 1.5,
    lfoRate: 0, lfoDepth: 0, driftAmount: 0.1, voiceSpread: 0.75, volume: 0.46 });
  else if (!bass && timbre === 'root') Object.assign(base, { osc1Wave: 'sine', osc2Wave: 'triangle', osc3Wave: 'sine', detuneSpread: 3, subLevel: 0.35,
    filterCutoff: clamp(950 * (1 - warmth * 0.35), 250, 2200), filterResonance: 0.65, filterEnvAmount: 0.05, attack: 3, decay: 2, sustain: 0.92, release: 5,
    lfoRate: 0.04, lfoDepth: 0.1 + movement * 0.07, driftAmount: 0.08, voiceSpread: 0.3, volume: 0.5 });
  else if (!bass && timbre === 'glass') Object.assign(base, { osc1Wave: 'sine', osc2Wave: 'triangle', osc3Wave: 'sine', detuneSpread: 11, subLevel: 0,
    filterCutoff: clamp(3200 * (1 - warmth * 0.5) * (1 + drift * 0.25), 650, 5200), filterResonance: 0.76, filterEnvAmount: 0.35, attack: 0.6, decay: 1.6, sustain: 0.55, release: 4.5 + session.macros.space * 2,
    lfoRate: 0.07, lfoDepth: 0.08 + movement * 0.08, driftAmount: 0.2, voiceSpread: 0.8, volume: 0.38 });
  else if (!bass && timbre === 'organ') Object.assign(base, { osc1Wave: 'sine', osc2Wave: 'triangle', osc3Wave: 'square', detuneSpread: 5, subLevel: 0.12,
    filterCutoff: clamp(1500 * (1 - warmth * 0.45) * (1 + drift * 0.2), 350, 4000), filterResonance: 0.8, filterEnvAmount: 0.1, attack: 0.12, decay: 0.3, sustain: 0.85, release: 1.4 + session.macros.space,
    lfoRate: 0.12, lfoDepth: 0.08 + movement * 0.08, driftAmount: 0.15, voiceSpread: 0.5, volume: 0.28 });
  const patch = mergeAudioPatch(base, layer.settings.audioPatch); patch.filterCutoff = clamp(patch.filterCutoff + cutoffOffset, 20, 18000); return patch;
}
/** Which timbres Evolve may rotate a layer through. Layers whose current timbre is not listed here are left as the user set them. */
export const TIMBRE_PALETTES: Record<'chords' | 'melody', Record<JamSession['style'], JamLayer['settings']['timbre'][]>> = {
  chords: {
    ambient: ['wash', 'glass', 'air', 'organ', 'solina', 'shimmer', 'celeste'],
    techno: ['dub', 'wash', 'glass', 'solina'],
    lofi: ['keys', 'organ', 'wash', 'celeste', 'solina']
  },
  melody: {
    ambient: ['bell', 'keys', 'glass', 'air', 'celeste', 'shimmer'],
    techno: ['bell', 'keys', 'glass', 'shimmer'],
    lofi: ['bell', 'keys', 'glass', 'celeste']
  },
};
export function drumPatch(voice: NonNullable<JamLayer['drumVoice']>, session: JamSession, layer?: JamLayer): DrumVoiceParams {
  const warmth = session.macros.warmth; const lofi = session.style === 'lofi'; const techno = session.style === 'techno';
  const values: Record<typeof voice, DrumVoiceParams> = {
    kick: { pitch: lofi ? 48 : techno ? 46 : 44, decay: lofi ? 0.36 : techno ? 0.5 : 0.4, tone: lofi ? 0.12 : 0.17, drive: lofi ? 0.22 : 0.08, volume: lofi ? 0.84 : 0.75, pan: 0, midiNote: 36 },
    snare: { pitch: lofi ? 168 : 175, decay: lofi ? 0.20 : 0.11, tone: lofi ? 0.26 : 0.22, drive: lofi ? 0.14 : 0, volume: lofi ? 0.64 : 0.52, pan: -0.08, midiNote: 38 },
    hihat: { pitch: lofi ? 38 : 40, decay: lofi ? 0.038 : 0.045, tone: lofi ? 0.06 : 0.08, drive: 0, volume: lofi ? 0.28 : 0.25, pan: 0.2, midiNote: 42 },
    perc: { pitch: lofi ? 54 : 57, decay: lofi ? 0.14 : 0.11, tone: lofi ? 0.18 : 0.25, drive: lofi ? 0.10 : 0, volume: lofi ? 0.44 : 0.42, pan: -0.25, midiNote: 37 },
  };
  const patch = values[voice]; patch.tone *= 1 - warmth * 0.45;
  const custom = layer?.settings.drumPatch; return custom ? { ...patch, ...sanitizeDrumPatch(custom, voice) } : patch;
}

export function effectiveEffects(session: JamSession, offsets?: Partial<ModulationOffsets>): EffectsParams {
  const space = session.macros.space, warmth = session.macros.warmth; const techno = session.style === 'techno', ambient = session.style === 'ambient';
  const chordsLayer = session.layers?.find(l => l.role === 'chords');
  const isStrings = chordsLayer?.settings.timbre === 'strings';
  const base: EffectsParams = { delayTime: (60 / session.bpm) * 0.75,
    delayFeedback: techno ? 0.34 + space * 0.34 : ambient ? 0.26 + space * 0.32 : 0.2 + space * 0.3,
    delayMix: space * (techno ? 0.36 : ambient ? 0.24 : 0.14), delayFlutter: warmth * 0.12 + (session.style === 'lofi' ? 0.06 : 0),
    reverbSize: isStrings ? 0.55 + space * 0.42 : 0.4 + space * 0.5,
    reverbDecay: isStrings ? 3.2 + space * 6.5 : (techno ? 2.2 + space * 4.2 : ambient ? 2.4 + space * 5.6 : 1.6 + space * 3.5),
    reverbMix: isStrings ? space * 0.48 : (space * (techno ? 0.3 : ambient ? 0.4 : 0.18)),
    masterDrive: warmth * 0.12 + (session.style === 'lofi' ? 0.04 : 0),
    reverbDamping: isStrings ? 0.45 : (techno ? 0.66 : ambient ? 0.55 : 0.5),
    delayTone: techno ? 0.34 : session.style === 'lofi' ? 0.42 : 0.45 };
  const patch = session.effectsPatch ? { ...base, ...sanitizeEffectsPatch(session.effectsPatch) } : base;
  patch.delayFeedback = clamp(patch.delayFeedback + (offsets?.delayFeedbackOffset || 0), ...EFFECT_PATCH_RANGES.delayFeedback);
  patch.reverbMix = clamp(patch.reverbMix + (offsets?.reverbMixOffset || 0), ...EFFECT_PATCH_RANGES.reverbMix);
  return patch;
}
export function modulationAt(session: JamSession, recent: JamEvent[], beat: number): ModulationOffsets {
  if (!session.modRoutes?.some(route => route.enabled)) return { ambientCutoffOffset: 0, delayFeedbackOffset: 0, reverbMixOffset: 0, drumProbabilityOffset: 0, accentLikelihoodOffset: 0 };
  const drums = recent.filter(e => e.startBeat < beat && e.startBeat >= beat - 4 && session.layers.find(l => l.id === e.layerId)?.role === 'drum');
  const lastDrum = drums.reduce<JamEvent | null>((latest, e) => !latest || e.startBeat > latest.startBeat ? e : latest, null);
  const melodic = session.layers.filter(l => l.role !== 'drum' && !l.muted);
  const soundingNotes = recent.filter(e => e.startBeat <= beat && e.startBeat + e.durationBeats > beat && melodic.some(l => l.id === e.layerId));
  const brightness = melodic.length ? melodic.reduce((sum, layer) => sum + ambientPatch(layer, session, beat).filterCutoff, 0) / melodic.length / 8000 : 0;
  const lastMutation = [...session.changes].reverse().find(c => c.label.startsWith('Variation'));
  const sources: ModulationSources = { drumDensity: clamp(drums.length / 16, 0, 1), rhythmicAccent: lastDrum ? lastDrum.velocity / 127 * Math.exp(-Math.max(0, beat - lastDrum.startBeat) / 0.75) : 0,
    ambientBrightness: clamp(brightness * Math.min(1, soundingNotes.length / 3), 0, 1),
    globalChaos: clamp(Math.max(session.evolving ? session.macros.movement : 0, lastMutation ? Math.exp(-Math.max(0, beat - lastMutation.beat) / 4) : 0), 0, 1) };
  return new ModulationMatrix(session.modRoutes || []).process(sources);
}

/** Sounding / releasing voice limits. Releasing is generous for pads: cutting a long tail early is audible. */
export function voiceBudget(layer: JamLayer, lowResource: boolean): [number, number] {
  const sounding = layer.role === 'chords' ? 6 : layer.role === 'drone' ? 2 : layer.role === 'bass' ? 1 : 3;
  const releasing = layer.role === 'chords' ? 8 : layer.role === 'drone' ? 3 : 4;
  return lowResource ? [Math.min(sounding, layer.role === 'chords' ? 5 : 3), Math.min(releasing, 4)] : [sounding, releasing];
}

/** Runtime coordinating one musical timeline, bounded generators, audio and MIDI. */
export class JamEngine {
  private static instance: JamEngine | null = null;
  static getInstance(): JamEngine { return this.instance ||= new JamEngine(createSession('moss-pulse')); }
  public readonly midi = new WebMidiManager();
  public readonly recorder: AudioRecorder;
  private state: JamSession;
  private audio = MasterAudio.getInstance();
  private clock: MusicalClock | null = null;
  private rack: EffectsRack | null = null;
  private drums: DrumSynth | null = null;
  private padBus: GainNode | null = null; private bed: AtmosphereBed | null = null; private lastAtmosphereKey = '';
  private pendingEvolve = false; private primeLayers: Set<string> | null = null; private primeSoft = false;
  private nextChordCache: { key: string; name: string } | null = null;
  // Flow: runtime-only, never persisted. Offsets are added on top of whatever the user set, then relaxed back.
  private flow = { offset: { movement: 0, density: 0, warmth: 0, space: 0 } as Record<MacroName, number>, target: { movement: 0, density: 0, warmth: 0, space: 0 } as Record<MacroName, number>, drums: 1, drumsTarget: 1, section: -1 };
  private arrangement = {
    current: 'groove' as ArrangementSection,
    auto: false,
    autoBars: 16,
    buildupBarsLeft: 0,
    targetDropBar: 0,
    lastAutoBar: -1,
    sequencerEnabled: false,
    sequencerBlocks: [] as SequenceBlock[],
    sequencerIndex: 0,
    sequencerBarInBlock: 0,
    lastSequencerBar: -1,
  };
  private pads = new Map<string, AmbientSynth>();
  private composer = new JamComposer();
  private events: JamEvent[] = [];
  private tempos: ClipTempo[] = [];
  private controllers: Array<ClipRawEvent & { audioTime: number }> = [];
  private anchors: TimingAnchor[] = [];
  private timeline: TimingAnchor[] = [];
  private eventEnds = new Map<string, number>();
  private listeners = new Set<(state: JamSession) => void>();
  private eventListeners = new Set<(event: JamEvent) => void>();
  private history: JamSession[] = []; private historyIndex = 0;
  private lastHistoryGroup = ''; private lastHistoryAt = 0;
  private running = false; private stoppedBeat = 0; private stepOffset = 0;
  private nextStep = 0; private initialized: Promise<void> | null = null; private startPromise: Promise<void> | null = null;
  private lastNotifySection = -1;
  private override: { clip: MidiClip; originBeat: number } | null = null;
  private pendingOverride: MidiClip | null = null;
  private previewTimer: ReturnType<typeof setInterval> | null = null;
  private previewDrums: DrumSynth | null = null;
  private previewPads = new Map<string, AmbientSynth>();
  private auditionSynth: AmbientSynth | null = null;
  private changeCounter = 0; private transportToken = 0; private primeAtNextStep = false; private resumeNotes: PlannedNote[] = [];

  constructor(initial: JamSession = createSession()) {
    this.state = validateSession(initial); this.composer.harmonyAt(0, this.state);
    this.recorder = new AudioRecorder(() => this.audio.streamDest, () => this.audio.ctx, () => this.audio.analyser);
    if (this.state.sequence && this.state.sequence.length > 0) {
      this.arrangement.sequencerBlocks = clone(this.state.sequence);
    } else {
      this.arrangement.sequencerBlocks = createDefaultSequence();
    }
    this.arrangement.sequencerEnabled = !!this.state.sequencerEnabled;
    this.history = [this.snapshot(false)];
  }
  getState(): JamSession { return clone(this.state); }
  subscribe(listener: (state: JamSession) => void): () => void { this.listeners.add(listener); listener(this.getState()); return () => this.listeners.delete(listener); }
  onEvent(listener: (event: JamEvent) => void): () => void { this.eventListeners.add(listener); return () => this.eventListeners.delete(listener); }
  private notify(): void { const s = this.getState(); for (const listener of this.listeners) listener(s); }
  private addChange(label: string, beat = this.getPosition().beat): void {
    this.state.changes.push({ id: `change-${++this.changeCounter}`, beat, label });
    if (this.state.changes.length > 30) this.state.changes.shift();
  }
  private remember(group = ''): void {
    const now = nowPerf(); const coalesce = group && group === this.lastHistoryGroup && now - this.lastHistoryAt < 400 && this.historyIndex === this.history.length - 1 && this.history.length > 1;
    this.history = this.history.slice(0, this.historyIndex + 1); if (coalesce) this.history[this.historyIndex] = this.snapshot(false); else this.history.push(this.snapshot(false));
    if (this.history.length > 60) this.history.shift(); this.historyIndex = this.history.length - 1; this.lastHistoryGroup = group; this.lastHistoryAt = now;
  }
  private currentAnchor(): TimingAnchor | undefined {
    const time = this.audio.getTime(); let anchor: TimingAnchor | undefined;
    for (const a of this.anchors) if (a.audioTime <= time) anchor = a; else break;
    return anchor;
  }
  getPosition(): JamPosition {
    const anchor = this.currentAnchor(); let beat = this.stoppedBeat;
    if (this.running && anchor) beat = Math.max(this.stoppedBeat, anchor.beat + Math.max(0, this.audio.getTime() - anchor.audioTime) * anchor.bpm / 60);
    const h = anchor?.harmony || this.composer.getHarmony();
    let firstPerformed = Infinity; const now = this.audio.getTime(); for (const e of this.events) if (e.audioTime <= now && e.startBeat <= beat) firstPerformed = Math.min(firstPerformed, e.startBeat);
    let voices = 0; for (const synth of this.pads.values()) { const v = synth.getActiveVoiceCount(); voices += v.sounding + v.releasing; }
    const chordLayer = this.state.layers.find(l => l.role === 'chords');
    const hold = holdBarsFor(this.state.style, chordLayer?.settings?.chordPace);
    const key = `${h.index}:${this.state.root}:${this.state.scale}:${this.state.style}:${this.state.seed}:${chordLayer?.settings?.chordPace || 'def'}`;
    if (this.nextChordCache?.key !== key) this.nextChordCache = { key, name: this.composer.peekNext(h.index * hold * 16, this.state).name };

    const blocks = this.arrangement.sequencerBlocks.length > 0 ? this.arrangement.sequencerBlocks : (this.state.sequence && this.state.sequence.length > 0 ? this.state.sequence : []);
    const activeBlock = blocks[this.arrangement.sequencerIndex] || blocks[0];
    const nextBlock = blocks[(this.arrangement.sequencerIndex + 1) % (blocks.length || 1)];
    const barsUntilNextBlock = Math.max(0, (activeBlock ? activeBlock.bars : 4) - this.arrangement.sequencerBarInBlock);
    const sequencer: SequencerPosition | undefined = this.arrangement.sequencerEnabled ? {
      enabled: true,
      activeBlockIndex: this.arrangement.sequencerIndex,
      totalBlocks: blocks.length,
      blockBarProgress: this.arrangement.sequencerBarInBlock,
      totalBlockBars: activeBlock ? activeBlock.bars : 4,
      currentSection: activeBlock ? activeBlock.section : this.arrangement.current,
      currentBlockLabel: activeBlock?.label,
      nextSection: nextBlock?.section,
      nextBlockLabel: nextBlock?.label,
      barsUntilNextBlock,
    } : undefined;

    return { beat, bar: Math.floor(beat / 4), playing: this.running, chord: h.name, chordNotes: [...h.notes], voices,
      capturedBars: Number.isFinite(firstPerformed) ? Math.min(128, Math.max(0, beat - Math.max(0, firstPerformed)) / 4) : 0, clipOverride: this.override !== null || this.pendingOverride !== null,
      chordRoot: h.root, chordHoldBars: hold, chordBarsLeft: clamp(((h.index + 1) * hold * 4 - beat) / 4, 0, hold), nextChord: this.nextChordCache.name,
      arrangementSection: this.arrangement.current,
      buildupCountdown: this.arrangement.buildupBarsLeft > 0 ? this.arrangement.buildupBarsLeft : undefined,
      autoArrangement: this.arrangement.auto,
      sequencer };
  }
  private beatAtAudio(time: number): number {
    let anchor: TimingAnchor | undefined;
    for (const a of this.timeline) if (a.audioTime <= time) anchor = a; else break;
    return anchor ? anchor.beat + (time - anchor.audioTime) * anchor.bpm / 60 : 0;
  }
  getRecentEvents(lastBeats = 32): JamEvent[] {
    const beat = this.getPosition().beat; const now = this.audio.getTime();
    return this.events.filter(e => e.audioTime <= now && e.startBeat <= beat).map(e => {
      const endAudio = this.eventEnds.get(e.id);
      const durationBeats = endAudio !== undefined && endAudio <= now ? Math.max(0, this.beatAtAudio(endAudio) - e.startBeat) : Math.max(e.durationBeats, beat - e.startBeat);
      return { ...e, durationBeats };
    }).filter(e => e.startBeat + e.durationBeats >= beat - lastBeats);
  }
  private applyRouting(strict = false): void {
    const outputs = this.midi.getAvailableOutputs(); const target = this.state.globalOutputId; const explicit = new Set(this.state.layers.filter(l => l.outputId !== null).map(l => l.id));
    if (target === null) { this.midi.selectOff(explicit); return; }
    if (target !== undefined) {
      if (!outputs.some(port => port.id === target && port.state !== 'disconnected')) { this.midi.selectOutput(target, explicit); if (strict) throw new Error('Der gespeicherte MIDI-Port ist nicht verbunden. Bitte wähle einen verfügbaren Ausgang.'); return; }
      this.midi.selectOutput(target, explicit);
    } else if (!this.midi.getSelectedOutputId() && outputs.length) {
      const candidate = outputs.find(port => port.name.toLowerCase().includes('iac')) || outputs[0]; this.midi.selectOutput(candidate.id, explicit);
    }
    if (target === undefined && this.midi.getSelectedOutputId()) { const selected = this.midi.getSelectedOutputId()!; this.state.globalOutputId = selected; if (strict && !outputs.some(port => port.id === selected && port.state !== 'disconnected')) throw new Error('Der gewählte MIDI-Port ist nicht verbunden. Bitte wähle einen verfügbaren Ausgang.'); }
    if (strict && target === undefined && !outputs.length) throw new Error('Kein MIDI-Ausgang verbunden. Aktiviere den IAC-Treiber oder wähle interne Klänge.');
    if (strict) for (const layer of this.state.layers) if (!layer.muted && layer.outputId && !outputs.some(port => port.id === layer.outputId && port.state !== 'disconnected')) throw new Error(`${layer.name}: Der gespeicherte MIDI-Port ist nicht verbunden.`);
  }
  private async init(): Promise<void> {
    if (this.initialized) return this.initialized;
    this.initialized = (async () => {
      const ctx = await this.audio.init();
      this.rack = new EffectsRack(ctx, this.audio.masterGain!);
      this.padBus = ctx.createGain(); this.padBus.connect(this.rack.inputNode);
      if (AtmosphereBed.supported(ctx)) this.bed = new AtmosphereBed(ctx, this.padBus);
      this.drums = new DrumSynth(ctx, this.rack.inputNode, new PRNG(streamSeed(this.state.seed, 'drum-audio')));
      this.clock = new MusicalClock(ctx); this.clock.setCallbacks(c => this.processStep(c)); this.clock.setBpm(this.state.bpm); this.clock.setSwing(this.state.swing);
      this.applySound();
    })().catch(error => { this.initialized = null; throw error; });
    return this.initialized;
  }
  async start(): Promise<void> {
    if (this.running) return; if (this.startPromise) return this.startPromise;
    const token = ++this.transportToken;
    this.startPromise = (async () => {
      this.stopPreview(); await this.init(); await this.audio.ctx?.resume(); if (token !== this.transportToken) return;
      if (this.state.outputMode !== 'internal' && (this.state.globalOutputId !== null || this.state.layers.some(l => !l.muted && l.outputId !== null))) { const ready = await this.midi.init(); if (token !== this.transportToken) return; if (!ready) throw new Error(this.midi.getErrorMessage() || 'MIDI konnte nicht aktiviert werden. Wähle interne Klänge oder erlaube MIDI im Browser.'); this.applyRouting(true); }
      this.stepOffset = Math.ceil(this.stoppedBeat * 4); this.nextStep = this.stepOffset;
      this.anchors = []; this.clock!.reset(); this.clock!.setBpm(this.state.bpm); this.clock!.setSwing(this.state.swing);
      this.running = true; this.primeAtNextStep = true; this.resetFlow(); this.applySound(); this.clock!.start(); this.notify();
    })().finally(() => { this.startPromise = null; });
    return this.startPromise;
  }
  private remainingNotes(): PlannedNote[] {
    const now = this.audio.getTime(); const remaining = new Map<string, PlannedNote>();
    for (const e of this.events) { const layer = this.state.layers.find(l => l.id === e.layerId); const end = this.eventEnds.get(e.id);
      if (!layer || layer.role === 'drum' || e.audioTime > now || end === undefined || end <= now) continue;
      remaining.set(`${layer.id}:${e.note}:${e.channel}`, { layerId: layer.id, note: e.note, velocity: e.velocity, channel: e.channel, durationBeats: clamp((end - now) * this.state.bpm / 60, 0.01, 64), microMs: 0 });
    }
    return [...remaining.values()];
  }
  private truncatePerformed(layers?: Set<string>): void {
    const now = this.audio.getTime(); const beat = this.getPosition().beat;
    this.events = this.events.filter(e => !layers || layers.has(e.layerId) ? e.audioTime <= now : true).map(e => {
      if (layers && !layers.has(e.layerId)) return e;
      const end = this.eventEnds.get(e.id); if (end !== undefined && end > now) { this.eventEnds.set(e.id, now); return { ...e, durationBeats: Math.max(0, beat - e.startBeat) }; }
      return e;
    });
    this.controllers = this.controllers.filter(c => !layers || layers.has(c.layerId) ? c.audioTime <= now : true);
    const retained = new Set(this.events.map(e => e.id)); for (const eventId of this.eventEnds.keys()) if (!retained.has(eventId)) this.eventEnds.delete(eventId);
  }
  stop(): void {
    this.transportToken++; if (this.running) this.resumeNotes = this.remainingNotes(); this.stoppedBeat = this.getPosition().beat; this.running = false; this.clock?.stop(); this.midi.panic(); this.bed?.setActive(false);
    for (const synth of this.pads.values()) synth.stopAllVoices(true); this.drums?.stopAllVoices();
    // Keep performed material and terminate long notes at the actual stop position.
    const now = this.audio.getTime(); this.controllers = this.controllers.filter(c => c.audioTime <= now); this.events = this.getRecentEvents(512).filter(e => e.audioTime <= now && e.startBeat < this.stoppedBeat)
      .map(e => ({ ...e, durationBeats: Math.min(e.durationBeats, Math.max(0, this.stoppedBeat - e.startBeat)) }));
    for (const e of this.events) this.eventEnds.set(e.id, Math.min(this.eventEnds.get(e.id) ?? now, now));
    this.notify();
  }
  panic(): void { this.stop(); this.bed?.stopNow(); this.stopPreview(); this.auditionSynth?.stopAllVoices(); this.rack?.killTail(); this.addChange('Panic · Stimmen und MIDI gestoppt'); this.notify(); }
  private modulation(): ModulationOffsets { return modulationAt(this.state, this.events, this.getPosition().beat); }
  private applySound(offsets = this.modulation()): void {
    this.audio.setVolume(this.state.volume);
    if (this.bed) { this.bed.setActive(this.running && this.state.outputMode !== 'midi'); const settings = this.state.atmosphere ?? { kind: 'off', level: 0, tone: 0.5, movement: 0 }; const key = JSON.stringify(settings); if (key !== this.lastAtmosphereKey) { this.lastAtmosphereKey = key; this.bed.configure(settings); } }
    if (this.rack && this.state.effectChain) {
      this.rack.setRoutingMode(this.state.effectChain.mode);
      for (const mod of this.state.effectChain.modules) {
        this.rack.setBypass(mod.id, mod.bypassed);
      }
    }
    this.rack?.updateParams(effectiveEffects(this.state, offsets));
    for (const layer of this.state.layers) this.pads.get(layer.id)?.updateParams(ambientPatch(layer, this.state, this.getPosition().beat, offsets.ambientCutoffOffset), layer.volume);
  }
  private synthFor(layer: JamLayer, preview = false): AmbientSynth {
    const map = preview ? this.previewPads : this.pads;
    let synth = map.get(layer.id);
    if (!synth) {
      const [sounding, releasing] = voiceBudget(layer, this.state.lowResource);
      synth = new AmbientSynth(this.audio.ctx!, this.padBus || this.rack!.inputNode, sounding, releasing,
        new PRNG(streamSeed(this.state.seed, `${preview ? 'preview-' : ''}${layer.id}-audio`)));
      map.set(layer.id, synth);
    }
    return synth;
  }
  private playNote(note: PlannedNote, time: number, perfTime: number, session = this.state, preview = false): void {
    const layer = session.layers.find(l => l.id === note.layerId); if (!layer) return;
    const duration = note.durationBeats * 60 / session.bpm;
    if (preview || session.outputMode === 'internal' || session.outputMode === 'both') {
      if (layer.role === 'drum') {
        const voice = layer.drumVoice || 'perc'; const params = drumPatch(voice, session, layer); if (!preview && voice === 'kick') this.duck(time);
        if (preview && !this.previewDrums) this.previewDrums = new DrumSynth(this.audio.ctx!, this.rack!.inputNode, new PRNG(streamSeed(session.seed, 'preview-drums')));
        const drums = preview ? this.previewDrums : this.drums;
        if (voice === 'kick') drums?.triggerKick(time, note.velocity, params, layer.volume);
        else if (voice === 'snare') drums?.triggerSnare(time, note.velocity, params, layer.volume);
        else if (voice === 'hihat') drums?.triggerHiHat(time, note.velocity, params, layer.volume);
        else drums?.triggerPerc(time, note.velocity, params, layer.volume);
      } else { const patch = ambientPatch(layer, session, this.getPosition().beat, preview ? 0 : this.modulation().ambientCutoffOffset); if (note.soft) patch.attack = Math.min(patch.attack, 0.4);
        this.synthFor(layer, preview).triggerNote(time, note.note, note.velocity, duration, patch, layer.volume); }
    }
    if (!preview && (session.outputMode === 'midi' || session.outputMode === 'both')) this.midi.scheduleNote(note.channel ?? layer.channel, note.note, note.velocity, perfTime, duration * 1000, layer.id, layer.outputId ?? undefined);
  }
  private resetFlow(): void {
    this.flow = { offset: { movement: 0, density: 0, warmth: 0, space: 0 }, target: { movement: 0, density: 0, warmth: 0, space: 0 }, drums: 1, drumsTarget: 1, section: -1 };
  }
  /** Kick-triggered ducking of pads and atmosphere. Scheduled on the audio clock; smooth in and out, never a hard gate. */
  private duck(time: number): void {
    const depth = this.state.pump ?? 0; const gain = this.padBus?.gain; if (!gain || depth <= 0) return;
    gain.cancelScheduledValues?.(time); gain.setTargetAtTime(1 - depth * 0.55, time, 0.014); gain.setTargetAtTime(1, time + 0.07, 0.17);
  }
  /**
   * Flow: every N bars choose one gentle move (bloom, darken, brighten, breathe, strip back, return).
   * Each beat the macros approach their targets by a few percent, so changes arrive over several bars.
   */
  private flowTick(step: number, baseBeat: number): void {
    const settings = this.state.flow; const f = this.flow;
    if (!settings?.enabled || this.override) { // relax back to the user's own values when Flow is switched off
      for (const name of Object.keys(f.target) as MacroName[]) f.target[name] = 0; f.drumsTarget = 1;
    } else {
      const bars = Math.max(4, Math.round(settings.bars)); const section = Math.floor(step / 16 / bars);
      if (step % 16 === 0 && section !== f.section) {
        const first = f.section < 0; f.section = section;
        if (!first) this.flowMove(section, settings.depth, baseBeat);
      }
    }
    const ease = step % 4 === 0 ? 0.12 : 0; if (!ease) return;
    let changed = false;
    for (const name of Object.keys(f.offset) as MacroName[]) {
      const diff = f.target[name] - f.offset[name]; if (Math.abs(diff) < 0.002) continue;
      const delta = diff * ease; const before = this.state.macros[name]; this.state.macros[name] = clamp(before + delta, 0, 1); f.offset[name] += this.state.macros[name] - before; changed = true;
    }
    const drumDiff = f.drumsTarget - f.drums; if (Math.abs(drumDiff) > 0.004) { f.drums += drumDiff * 0.25; changed = true; } else if (drumDiff !== 0) { f.drums = f.drumsTarget; changed = true; }
    if (changed) { this.applySound(); if (step % 16 === 0) this.notify(); }
  }
  private flowMove(section: number, depth: number, beat: number): void {
    const f = this.flow; const rng = new PRNG(streamSeed(this.state.seed, 'flow', section)); const d = clamp(depth, 0, 1);
    const set = (offsets: Partial<Record<MacroName, number>>) => { for (const name of Object.keys(f.target) as MacroName[]) f.target[name] = (offsets[name] ?? 0) * d; };
    const hasDrums = this.state.layers.some(l => l.role === 'drum' && !l.muted);
    const stripped = f.drumsTarget < 1;
    let label: string;
    if (stripped) { set({ density: 0.05 }); f.drumsTarget = 1; label = 'Zurück zum vollen Groove'; }
    else {
      const move = rng.pick(['bloom', 'darken', 'brighten', 'breathe', hasDrums ? 'strip' : 'bloom', 'refresh']);
      if (move === 'bloom') { set({ space: 0.22, warmth: 0.05 }); label = 'Raum öffnet sich'; }
      else if (move === 'darken') { set({ warmth: 0.2, space: 0.08, movement: -0.05 }); label = 'Klang wird dunkler'; }
      else if (move === 'brighten') { set({ warmth: -0.18, movement: 0.12 }); label = 'Klang öffnet sich'; }
      else if (move === 'breathe') { set({ density: -0.12, movement: 0.1, space: 0.1 }); label = 'Das Ensemble atmet'; }
      else if (move === 'strip') { set({ density: -0.1, space: 0.18 }); f.drumsTarget = clamp(1 - d * 0.8, 0.15, 1); label = 'Drums treten zurück'; }
      else { set({ movement: 0.1 }); this.composer.vary(); label = 'Neue Motive, gleiche Harmonie'; }
    }
    this.addChange(`Übergang · ${label}`, beat); this.notify();
  }
  private processStep(context: StepContext): void {
    if (!this.running) return;
    const step = context.step + this.stepOffset; this.nextStep = step + 1;
    const baseBeat = step / 4; const bpm = context.bpm; const actualBeat = baseBeat + context.swingOffset * bpm / 60;
    if (step % 16 === 0 && this.pendingOverride) { for (const track of this.pendingOverride.tracks) { this.midi.releaseNotesForLayer(track.id); this.pads.get(track.id)?.stopAllVoices(); } this.override = { clip: this.pendingOverride, originBeat: baseBeat }; this.pendingOverride = null; this.addChange('Bearbeitete Phrase übernommen', baseBeat); this.notify(); }
    const harmony = this.composer.harmonyAt(step, this.state);
    this.flowTick(step, baseBeat);
    if (this.arrangement.buildupBarsLeft > 0 && step % 16 === 0) {
      const currentBar = Math.floor(baseBeat / 4);
      const remaining = Math.max(0, this.arrangement.targetDropBar - currentBar);
      this.arrangement.buildupBarsLeft = remaining;
      if (remaining === 0) {
        this.applyArrangement('groove');
      }
    }
    if (this.arrangement.sequencerEnabled && step % 16 === 0) {
      const currentBar = Math.floor(baseBeat / 4);
      if (currentBar !== this.arrangement.lastSequencerBar) {
        this.arrangement.lastSequencerBar = currentBar;
        const blocks = this.arrangement.sequencerBlocks.length > 0 ? this.arrangement.sequencerBlocks : (this.state.sequence && this.state.sequence.length > 0 ? this.state.sequence : []);
        if (blocks.length > 0) {
          const currentBlock = blocks[this.arrangement.sequencerIndex];
          if (currentBlock) {
            if (this.arrangement.sequencerBarInBlock >= currentBlock.bars) {
              const nextIndex = (this.arrangement.sequencerIndex + 1) % blocks.length;
              this.arrangement.sequencerIndex = nextIndex;
              this.arrangement.sequencerBarInBlock = 0;
              const nextBlock = blocks[nextIndex];
              if (nextBlock) {
                this.applyArrangement(nextBlock.section, false);
                this.addChange(`Sequencer: [${nextBlock.label || nextBlock.section}] (${nextBlock.bars} Takte)`, baseBeat);
              }
            } else {
              // Arrangable macros slow glide ("make it more evolving slowly")
              if (currentBlock.macroTargets) {
                let changedMacros = false;
                for (const [name, targetVal] of Object.entries(currentBlock.macroTargets) as [MacroName, number][]) {
                  if (targetVal !== undefined) {
                    const cur = this.state.macros[name];
                    const diff = targetVal - cur;
                    if (Math.abs(diff) > 0.005) {
                      this.state.macros[name] = clamp(cur + diff * 0.28, 0, 1);
                      changedMacros = true;
                    }
                  }
                }
                if (changedMacros) this.applySound();
              }
              this.arrangement.sequencerBarInBlock++;
            }
          }
        }
      }
    } else if (this.arrangement.auto && step % 16 === 0) {
      const currentBar = Math.floor(baseBeat / 4);
      if (currentBar > 0 && currentBar % this.arrangement.autoBars === 0 && currentBar !== this.arrangement.lastAutoBar) {
        this.arrangement.lastAutoBar = currentBar;
        this.applyArrangement('spontaneous');
      }
    }
    if (this.pendingEvolve) { this.pendingEvolve = false; this.evolveTransition(context.time, actualBeat); }
    const anchor = { beat: actualBeat, audioTime: context.time, bpm, harmony };
    this.anchors.push(anchor);
    if (!this.timeline.length || this.timeline.at(-1)!.bpm !== bpm || context.step === 0) this.timeline.push(anchor);
    if (this.anchors.length > 64) this.anchors.splice(0, this.anchors.length - 64);
    if (!this.tempos.length || this.tempos.at(-1)!.bpm !== bpm) this.tempos.push({ beat: actualBeat, bpm });
    const offsets = modulationAt(this.state, this.events, baseBeat);
    const generationState = offsets.drumProbabilityOffset ? { ...this.state, layers: this.state.layers.map(l => l.role === 'drum' && !l.locked && !l.frozen ? { ...l, settings: { ...l.settings, density: clamp(l.settings.density + offsets.drumProbabilityOffset, l.settings.mutationDensityMin ?? 0, l.settings.mutationDensityMax ?? 1) } } : l) } : this.state;
    const generated = this.composer.planStep(step, generationState).map(n => {
      const layer = this.state.layers.find(l => l.id === n.layerId)!;
      if (layer.role !== 'drum' || layer.locked || layer.frozen || !offsets.accentLikelihoodOffset) return n;
      const rng = new PRNG(streamSeed(this.state.seed, `${layer.id}-accent-mod`, step));
      return rng.chance(Math.abs(offsets.accentLikelihoodOffset)) ? { ...n, velocity: offsets.accentLikelihoodOffset > 0 ? layer.settings.velocityMax : Math.round((layer.settings.velocityMin + layer.settings.velocityMax) / 2) } : n;
    });
    if (this.state.modRoutes?.some(route => route.enabled)) this.applySound(offsets);
    const overrideIds = new Set(this.override?.clip.tracks.map(t => t.id));
    const notes: Array<PlannedNote & { offsetBeats?: number }> = generated.filter(n => !overrideIds.has(n.layerId));
    if (this.override) notes.push(...clipEventsAtStep(this.override.clip, this.override.originBeat, baseBeat));
    if (this.primeAtNextStep) {
      this.primeAtNextStep = false;
      const primed = this.resumeNotes.length ? this.resumeNotes : this.composer.heldNotesAtStep(step, this.state);
      const taken = new Set(notes.map(n => `${n.layerId}:${n.note}:${n.channel || this.state.layers.find(l => l.id === n.layerId)?.channel}`));
      const only = this.primeLayers; const soft = this.primeSoft; this.primeLayers = null; this.primeSoft = false;
      for (const n of primed) if (!overrideIds.has(n.layerId) && (!only || only.has(n.layerId)) && !taken.has(`${n.layerId}:${n.note}:${n.channel || this.state.layers.find(l => l.id === n.layerId)?.channel}`)) notes.push(soft ? { ...n, soft: true } : n);
      if (this.override) {
        const clip = this.override.clip; const length = Math.max(0.25, clip.lengthBeats); const phase = ((baseBeat - this.override.originBeat) % length + length) % length;
        for (const n of clip.notes) if (n.startBeat < phase && n.startBeat + n.durationBeats > phase && !taken.has(`${n.layerId}:${n.note}:${n.channel}`)) notes.push({ ...n, durationBeats: n.startBeat + n.durationBeats - phase, microMs: 0 });
      }
      this.resumeNotes = [];
    }
    if (this.flow.drums < 0.995) { // Flow strip-back: soften drums, and let snare/percussion drop out first. Copies, because planned notes are cached.
      for (let i = notes.length - 1; i >= 0; i--) {
        const drum = this.state.layers.find(l => l.id === notes[i].layerId); if (drum?.role !== 'drum') continue;
        if (this.flow.drums < 0.5 && (drum.drumVoice === 'snare' || drum.drumVoice === 'perc')) notes.splice(i, 1);
        else notes[i] = { ...notes[i], velocity: Math.max(1, Math.round(notes[i].velocity * (0.2 + 0.8 * this.flow.drums))) };
      }
    }
    for (const note of notes) {
      const layer = this.state.layers.find(l => l.id === note.layerId); if (!layer) continue;
      const soloed = this.state.layers.some(l => l.solo); if (layer.muted || (soloed && !layer.solo)) continue;
      const offset = note.offsetBeats !== undefined ? note.offsetBeats * 60 / bpm : note.microMs / 1000;
      const audioTime = Math.max(this.audio.getTime() + 0.001, context.time + offset - (note.offsetBeats !== undefined ? context.swingOffset : 0)); const perfTime = nowPerf() + (audioTime - this.audio.getTime()) * 1000;
      const rawStartBeat = actualBeat + (audioTime - context.time) * bpm / 60;
      const startBeat = this.stoppedBeat > 0 ? Math.max(this.stoppedBeat, rawStartBeat) : Math.max(0, rawStartBeat);
      const event: JamEvent = { id: `${step}-${layer.id}-${note.note}-${this.events.length}`, layerId: layer.id, note: note.note,
        velocity: note.velocity, channel: note.channel ?? layer.channel, startBeat, durationBeats: note.durationBeats, audioTime, performanceTime: perfTime, bpm };
      this.events.push(event); this.eventEnds.set(event.id, audioTime + note.durationBeats * 60 / bpm); this.playNote(note, audioTime, perfTime);
      for (const listener of this.eventListeners) listener(clone(event));
    }
    const keepFrom = baseBeat - 512;
    if (step % 16 === 0) {
      this.events = this.events.filter(e => { const endTime = this.eventEnds.get(e.id); return (endTime !== undefined ? this.beatAtAudio(endTime) : e.startBeat + e.durationBeats) >= keepFrom; });
      const keptIds = new Set(this.events.map(e => e.id)); for (const eventId of this.eventEnds.keys()) if (!keptIds.has(eventId)) this.eventEnds.delete(eventId);
      const oldestAudio = this.events.length ? Math.min(...this.events.map(e => e.audioTime)) : this.audio.getTime();
      const priorAnchor = [...this.timeline].reverse().find(a => a.audioTime <= oldestAudio);
      this.timeline = this.timeline.filter(a => a.audioTime > oldestAudio); if (priorAnchor) this.timeline.unshift(priorAnchor);
      const firstTempo = [...this.tempos].reverse().find(t => t.beat <= keepFrom);
      this.tempos = this.tempos.filter(t => t.beat > keepFrom); if (firstTempo) this.tempos.unshift(firstTempo);
      const priorControllers = new Map<string, ClipRawEvent & { audioTime: number }>(); for (const c of this.controllers) if (c.beat < keepFrom) priorControllers.set(`${c.layerId}:${c.bytes[0]}:${c.bytes[1]}`, c);
      this.controllers = [...priorControllers.values(), ...this.controllers.filter(c => c.beat >= keepFrom)];
      this.applySound();
      if (this.state.deepMindEnabled && this.state.outputMode !== 'internal') {
        const cutoff = Math.round(26 + (1 - this.state.macros.warmth) * 62);
        this.midi.sendCC(this.state.deepMindChannel, 29, cutoff, context.perfTime);
        this.midi.sendCC(this.state.deepMindChannel, 30, 12, context.perfTime);
        this.controllers.push({ layerId: 'chords', beat: actualBeat, audioTime: context.time, bytes: [0xb0 | (this.state.deepMindChannel - 1), 29, cutoff] }, { layerId: 'chords', beat: actualBeat, audioTime: context.time, bytes: [0xb0 | (this.state.deepMindChannel - 1), 30, 12] });
      }
    }
    const section = Math.floor(step / 128);
    if (this.state.evolving && section !== this.lastNotifySection) { this.lastNotifySection = section; if (section > 0) this.addChange(section % 2 ? 'Neue Motivvariation · sanfte Klangbewegung' : 'Neue Phrase · Harmonie und Groove', baseBeat); this.notify(); }
  }
  updateSession(patch: Partial<JamSession>): void {
    const old = this.state; const rootDelta = patch.root !== undefined ? Math.round(patch.root) - old.root : 0;
    const layers = patch.layers || (rootDelta ? old.layers.map(l => l.role === 'drum' || l.locked || l.frozen ? l : { ...l, settings: { ...l.settings, minNote: l.settings.minNote + rootDelta, maxNote: l.settings.maxNote + rootDelta } }) : old.layers);
    this.state = validateSession({ ...old, ...patch, layers, macros: { ...old.macros, ...patch.macros } });
    if (patch.seed !== undefined && patch.seed !== old.seed) this.composer.reset();
    if (patch.root !== undefined || patch.scale !== undefined || patch.seed !== undefined) this.resumeNotes = [];
    if (Object.hasOwn(patch, 'globalOutputId') && patch.globalOutputId !== old.globalOutputId) {
      const defaults = new Set(this.state.layers.filter(l => l.outputId === null).map(l => l.id));
      for (const layerId of defaults) this.midi.releaseNotesForLayer(layerId);
      if (this.state.outputMode === 'midi') this.truncatePerformed(defaults); this.applyRouting();
    }
    if (patch.bpm !== undefined) this.clock?.setBpm(this.state.bpm); if (patch.swing !== undefined) this.clock?.setSwing(this.state.swing);
    if (patch.outputMode && patch.outputMode !== old.outputMode) { this.midi.panic(); if (patch.outputMode === 'midi') { for (const synth of this.pads.values()) synth.stopAllVoices(); this.drums?.stopAllVoices(); this.rack?.killTail(); } }
    const continuous = ['bpm', 'swing', 'volume', 'macros', 'atmosphere', 'pump', 'flow']; const keys = Object.keys(patch);
    let historyGroup = keys.every(k => continuous.includes(k)) ? `session:${keys.join(',')}` : '';
    if (keys.length === 1 && patch.effectsPatch) { const changed = [...new Set([...Object.keys(old.effectsPatch || {}), ...Object.keys(patch.effectsPatch)])].filter(key => (old.effectsPatch as Record<string, number> | undefined)?.[key] !== (patch.effectsPatch as Record<string, number>)[key]); if (changed.length === 1 && Object.hasOwn(patch.effectsPatch, changed[0])) historyGroup = `fx:${changed[0]}`; }
    if (keys.length === 1 && patch.modRoutes && old.modRoutes?.length === patch.modRoutes.length) { const changed = patch.modRoutes.filter(route => JSON.stringify(route) !== JSON.stringify(old.modRoutes!.find(r => r.id === route.id))); if (changed.length === 1) { const route = changed[0]; const prior = old.modRoutes.find(r => r.id === route.id); if (prior && prior.depth !== route.depth && prior.source === route.source && prior.destination === route.destination && prior.enabled === route.enabled) historyGroup = `mod:${route.id}:depth`; } }
    if (patch.lowResource !== undefined) for (const layer of this.state.layers) { const [sounding, releasing] = voiceBudget(layer, this.state.lowResource); this.pads.get(layer.id)?.setVoiceBudget(sounding, releasing); }
    this.applySound(); this.remember(historyGroup); this.notify();
  }
  updateLayer(layerId: string, patch: Partial<JamLayer>): void {
    const layer = this.state.layers.find(l => l.id === layerId); if (!layer) return;
    if ((patch.outputId !== undefined && patch.outputId !== layer.outputId) || (patch.channel !== undefined && patch.channel !== layer.channel) || patch.muted === true) this.midi.releaseNotesForLayer(layerId);
    if (patch.frozen && !layer.frozen) {
      const beat = this.getPosition().beat; const start = Math.max(0, beat - 16);
      const notes = captureNotes(this.getRecentEvents(32).filter(e => e.layerId === layerId), start, beat);
      if (notes.length) this.composer.setFrozen(layerId, notes, Math.ceil(beat / 4) * 4);
      else {
        const preview = this.previewScene(this.state.sceneId, 4); const previewNotes = preview.notes.filter(n => n.layerId === layerId);
        this.composer.setFrozen(layerId, previewNotes, Math.ceil(beat / 4) * 4); this.addChange('Freeze · Vorschauphrase (noch kein gespieltes Material)');
      }
    }
    if (patch.frozen === false) this.composer.clearFrozen(layerId);
    if (patch.muted === true) this.pads.get(layerId)?.stopAllVoices(true);
    if (patch.settings?.minNote !== undefined || patch.settings?.maxNote !== undefined) this.resumeNotes = [];
    this.state.layers = this.state.layers.map(l => l.id === layerId ? normalizeLayer({ ...l, ...patch, settings: { ...l.settings, ...patch.settings } }, l) : l);
    const edited = this.state.layers.find(l => l.id === layerId)!;
    if (edited.role !== 'drum') { let allowed = false; for (let n = edited.settings.minNote; n <= edited.settings.maxNote; n++) if (SCALE_INTERVALS[this.state.scale].includes(((n - this.state.root) % 12 + 12) % 12)) allowed = true; if (!allowed) this.addChange(`${edited.name} · Register enthält keinen Skalenton; Layer bleibt stumm`); }
    const anySolo = this.state.layers.some(l => l.solo); const hidden = new Set(this.state.layers.filter(l => l.muted || (anySolo && !l.solo)).map(l => l.id));
    this.truncatePerformed(hidden);
    for (const l of this.state.layers) if (hidden.has(l.id)) { this.midi.releaseNotesForLayer(l.id); this.pads.get(l.id)?.stopAllVoices(true); if (l.drumVoice) this.drums?.stopVoiceKind(l.drumVoice); }
    this.applySound(); this.remember(patch.volume !== undefined ? `layer:${layerId}:volume` : patch.settings ? layerSettingsGroup(layerId, layer.settings, patch.settings) : ''); this.notify();
  }
  setLayerSettings(layerId: string, settings: Partial<LayerSettings>): void {
    const layer = this.state.layers.find(l => l.id === layerId); if (!layer) return; this.updateLayer(layerId, { settings: { ...layer.settings, ...settings } });
  }
  applyInstrumentPreset(layerId: string, presetId: string): void {
    const nextSession = applyPresetToSession(this.state, layerId, presetId);
    const layer = nextSession.layers.find(l => l.id === layerId);
    if (!layer) return;
    this.updateLayer(layerId, {
      volume: layer.volume,
      settings: layer.settings
    });
    const preset = getInstrumentPresetById(presetId);
    if (preset) {
      this.addChange(`${layer.name} Preset · ${preset.name}`);
    }
  }
  cycleInstrumentPreset(layerId: string, direction: 1 | -1): InstrumentPreset | null {
    const result = cyclePresetInSession(this.state, layerId, direction);
    if (!result) return null;
    const layer = result.session.layers.find(l => l.id === layerId);
    if (!layer) return null;
    this.updateLayer(layerId, {
      volume: layer.volume,
      settings: layer.settings
    });
    this.addChange(`${layer.name} Preset · ${result.preset.name}`);
    return result.preset;
  }
  randomizeInstrumentPreset(layerId: string): InstrumentPreset | null {
    const result = randomizePresetInSession(this.state, layerId);
    if (!result) return null;
    const layer = result.session.layers.find(l => l.id === layerId);
    if (!layer) return null;
    this.updateLayer(layerId, {
      volume: layer.volume,
      settings: layer.settings
    });
    this.addChange(`${layer.name} Zufalls-Sound · ${result.preset.name}`);
    return result.preset;
  }
  setMacro(name: MacroName, value: number): void {
    this.state.macros[name] = clamp(value, 0, 1); this.applySound(); this.remember(`macro:${name}`); this.notify();
  }
  async loadScene(sceneId: string): Promise<void> {
    const wasRunning = this.running; this.panic();
    const previous = this.state; this.state = createSession(sceneId, previous.seed);
    this.state.outputMode = previous.outputMode; this.state.globalOutputId = previous.globalOutputId; this.state.lowResource = previous.lowResource; this.state.pinned = previous.pinned; if (previous.pinnedParams) this.state.pinnedParams = sanitizePinnedParams(previous.pinnedParams, this.state);
    for (const layer of this.state.layers) { const route = previous.layers.find(l => l.id === layer.id); if (route) { layer.outputId = route.outputId; layer.channel = route.channel; } }
    this.composer.reset(); this.composer.harmonyAt(0, this.state); this.events = []; this.controllers = []; this.eventEnds.clear(); this.timeline = []; this.tempos = []; this.anchors = []; this.stoppedBeat = 0; this.nextStep = 0; this.resumeNotes = []; this.override = null; this.pendingOverride = null;
    this.resetFlow(); this.lastAtmosphereKey = ''; this.remember(); this.applySound(); this.notify(); if (wasRunning) await this.start();
  }
  /**
   * Estimates aggregate perceived acoustic energy across sounding layers.
   * Considers timbre spectral density, volume, and generation density.
   */
  calculatePerceivedLoudness(): number {
    const timbreWeights: Record<string, number> = {
      strings: 1.15, dub: 1.25, wash: 0.95, air: 0.85, keys: 1.0,
      bell: 0.9, root: 1.05, glass: 0.92, organ: 0.82, warm: 1.0,
    };
    let energy = 0;
    for (const layer of this.state.layers) {
      if (layer.muted) continue;
      const tw = timbreWeights[layer.settings.timbre] ?? 1.0;
      const densityWeight = 0.45 + 0.55 * clamp(layer.settings.density, 0, 1);
      energy += Math.pow(layer.volume, 1.4) * tw * densityWeight;
    }
    return Math.max(0.05, energy);
  }

  /**
   * Evolve. Re-rolls the composer (progression, voicing, rhythm, melodic character), nudges densities and may rotate the
   * chord and melody timbres. Loudness-Safe normalization stabilizes overall acoustic loudness so the mix never spikes or drops.
   */
  mutate(loudnessSafe = true): void {
    const energyBefore = this.calculatePerceivedLoudness();
    this.composer.vary(); const rng = new PRNG(streamSeed(this.state.seed, 'mutation', this.history.length)); const notes: string[] = [];
    this.state.layers = this.state.layers.map(layer => {
      if (layer.locked || layer.frozen) return layer;
      let timbre = layer.settings.timbre; const palette = layer.role === 'chords' || layer.role === 'melody' ? TIMBRE_PALETTES[layer.role][this.state.style] : undefined;
      if (palette && palette.includes(timbre) && rng.chance(0.55)) { const options = palette.filter(t => t !== timbre); timbre = rng.pick(options); notes.push(`${layer.name}: ${timbre}`); }
      return { ...layer, settings: { ...layer.settings, timbre, density: clamp(layer.settings.density + rng.range(-0.1, 0.1) * this.state.macros.movement, layer.settings.mutationDensityMin ?? 0, layer.settings.mutationDensityMax ?? 1) } };
    });

    if (loudnessSafe) {
      const energyAfter = this.calculatePerceivedLoudness();
      const ratio = energyBefore / Math.max(0.05, energyAfter);
      const compensation = clamp(Math.pow(ratio, 0.65), 0.86, 1.16);
      if (Math.abs(compensation - 1) > 0.015) {
        this.state.layers = this.state.layers.map(l => {
          if (l.locked || l.frozen) return l;
          return { ...l, volume: clamp(Number((l.volume * compensation).toFixed(2)), 0.05, 1) };
        });
      }
    }

    if (this.running) this.pendingEvolve = true;
    this.addChange('Variation · Motive und Groove' + (notes.length ? ` · ${notes.join(', ')}` : '')); this.remember(); this.applySound(); this.notify();
  }

  /** Evolve alias for loud-safe musical mutation. */
  evolve(): void {
    this.mutate(true);
  }

  /**
   * Radical Random. Daring, creative quantum re-composition.
   * Completely randomizes root, scale, BPM, rhythm algorithms, timbres, and effect chains,
   * while keeping loudness safe and within musical constraints (no clipping or harsh ringing).
   * Atmosphere is guaranteed to stay <= 0.20 (and vinyl/tape noise <= 0.10).
   */
  radicalRandomize(options: { keepBpm?: boolean; keepKey?: boolean } = {}): void {
    const energyBefore = this.calculatePerceivedLoudness();
    const rng = new PRNG(Math.floor(nowPerf()) ^ this.state.seed ^ Math.floor(Math.random() * 1000000));
    const notes: string[] = [];

    // 1. Musical Scale & Root
    const roots = [43, 45, 46, 48, 50, 52, 53, 55]; // G1..G2 range (sub-bass / drone sweetspot)
    const scales: MusicalScale[] = ['dorian', 'aeolian', 'lydian', 'phrygian', 'majorPentatonic', 'minorPentatonic', 'hirajoshi'];
    if (!options.keepKey) {
      this.state.root = rng.pick(roots);
      this.state.scale = rng.pick(scales);
      notes.push(`${rootPitchName(this.state.root)} ${this.state.scale}`);
    }

    // 2. Tempo & Swing
    const styles: JamStyle[] = ['ambient', 'lofi', 'techno'];
    const chosenStyle = rng.pick(styles);
    this.state.style = chosenStyle;

    if (!options.keepBpm) {
      const tempos = chosenStyle === 'techno'
        ? [108, 112, 114, 116, 120, 124]
        : chosenStyle === 'lofi'
        ? [68, 72, 74, 78, 82, 86]
        : [54, 60, 66, 72, 78, 84, 88, 94];
      const newBpm = rng.pick(tempos);
      this.state.bpm = newBpm;
      this.clock?.setBpm(newBpm);
      notes.push(`${newBpm} BPM`);
    }

    this.state.swing = chosenStyle === 'lofi' ? rng.range(0.24, 0.42) : rng.chance(0.3) ? rng.range(0.08, 0.18) : 0;
    this.clock?.setSwing(this.state.swing);

    // 3. Reset and vary composer for the new harmonic structure
    this.composer.reset();
    this.composer.vary();

    // 4. Macro Values
    this.state.macros = {
      movement: clamp(rng.range(0.30, 0.72), 0.1, 1),
      density: clamp(rng.range(0.35, 0.75), 0.1, 1),
      warmth: clamp(rng.range(0.48, 0.86), 0.1, 1),
      space: clamp(rng.range(0.50, 0.92), 0.1, 1),
    };

    // 5. Scramble Layers & Instruments (respecting locks and freezes)
    const chordTimbres: Timbre[] = ['strings', 'wash', 'glass', 'dub', 'keys', 'organ', 'warm'];
    const melodyTimbres: Timbre[] = ['bell', 'glass', 'keys', 'strings', 'air'];
    const droneTimbres: Timbre[] = ['root', 'air', 'warm'];
    const bassTimbres: Timbre[] = ['warm', 'dub', 'root'];
    const drumAlgos: JamLayer['settings']['rhythmAlgorithm'][] = [
      'composed', 'euclidean', 'probabilistic', 'polymetric', 'markov', 'densityBurst'
    ];

    let chordPick = '';
    let melodyPick = '';

    this.state.layers = this.state.layers.map(layer => {
      if (layer.locked || layer.frozen) return layer;

      let timbre = layer.settings.timbre;
      let density = layer.settings.density;
      let rhythmAlgorithm = layer.settings.rhythmAlgorithm;
      let drumPatch = layer.settings.drumPatch ? { ...layer.settings.drumPatch } : undefined;

      if (layer.role === 'chords') {
        timbre = rng.pick(chordTimbres);
        chordPick = timbre;
        density = rng.range(0.65, 0.92);
      } else if (layer.role === 'melody') {
        timbre = rng.pick(melodyTimbres);
        melodyPick = timbre;
        density = rng.range(0.25, 0.52);
      } else if (layer.role === 'drone') {
        timbre = rng.pick(droneTimbres);
        density = rng.range(0.70, 0.95);
      } else if (layer.role === 'bass') {
        timbre = rng.pick(bassTimbres);
        density = rng.range(0.40, 0.90);
      } else if (layer.role === 'drum') {
        rhythmAlgorithm = rng.pick(drumAlgos);
        density = rng.range(0.35, 0.78);
        if (layer.id === 'kick') {
          drumPatch = {
            pitch: rng.pick([38, 42, 45, 48]),
            decay: rng.range(0.4, 0.75),
            tone: rng.range(0.05, 0.2),
            drive: rng.range(0.05, 0.22)
          };
        } else if (layer.id === 'snare') {
          drumPatch = {
            decay: rng.range(0.15, 0.35),
            tone: rng.range(0.1, 0.3)
          };
        }
      }

      let muted = layer.muted;
      if (layer.role === 'drum') {
        if (chosenStyle === 'ambient' && rng.chance(0.20)) muted = true;
        else if (layer.muted && rng.chance(0.70)) muted = false;
      }

      const isChords = layer.role === 'chords' && !layer.locked;
      const chordPattern: ChordPattern | undefined = isChords ? rng.pick([...CHORD_PATTERNS]) : layer.settings.chordPattern;
      const chordPace: ChordPace | undefined = isChords ? rng.pick([...CHORD_PACES]) : layer.settings.chordPace;

      return {
        ...layer,
        muted,
        settings: {
          ...layer.settings,
          timbre,
          density: clamp(density, layer.settings.mutationDensityMin ?? 0.1, layer.settings.mutationDensityMax ?? 1),
          rhythmAlgorithm,
          ...(chordPattern ? { chordPattern } : {}),
          ...(chordPace ? { chordPace } : {}),
          ...(drumPatch ? { drumPatch } : {})
        }
      };
    });

    if (chordPick) notes.push(`Chords: ${chordPick}`);
    const chordL = this.state.layers.find(l => l.role === 'chords');
    if (chordL?.settings.chordPattern) notes.push(`Muster: ${chordL.settings.chordPattern}`);
    if (melodyPick) notes.push(`Melody: ${melodyPick}`);

    // 6. Atmosphere Settings (strictly capped at <= 0.10)
    const atmoKinds: AtmosphereKind[] = ['air', 'rain', 'tape', 'vinyl'];
    const chosenAtmoKind = rng.pick(atmoKinds);
    const maxAtmo = 0.10;
    const chosenAtmoLevel = Math.min(maxAtmo, Number(rng.range(0.03, maxAtmo).toFixed(3)));
    this.state.atmosphere = {
      kind: chosenAtmoKind,
      level: chosenAtmoLevel,
      tone: Number(rng.range(0.40, 0.65).toFixed(2)),
      movement: Number(rng.range(0.35, 0.55).toFixed(2)),
    };

    // 7. Dynamic FX Chain & Routing
    const chainModes: EffectChainMode[] = ['parallel', 'delay-into-reverb', 'reverb-into-delay'];
    if (this.state.effectChain) {
      this.state.effectChain.mode = rng.pick(chainModes);
    }
    this.state.effectsPatch = {
      reverbSize: Number(rng.range(0.70, 0.95).toFixed(2)),
      reverbDecay: Number(rng.range(4.0, 8.5).toFixed(1)),
      reverbMix: Number(rng.range(0.30, 0.52).toFixed(2)),
      reverbDamping: Number(rng.range(0.35, 0.60).toFixed(2)),
      delayTime: Number(rng.range(0.28, 0.55).toFixed(2)),
      delayFeedback: Number(rng.range(0.35, 0.62).toFixed(2)),
      delayMix: Number(rng.range(0.20, 0.42).toFixed(2)),
      delayFlutter: Number(rng.range(0.06, 0.28).toFixed(2)),
      masterDrive: Number(rng.range(0.06, 0.18).toFixed(2)),
    };

    // 8. Loudness Safety Normalization
    const energyAfter = this.calculatePerceivedLoudness();
    const ratio = energyBefore / Math.max(0.05, energyAfter);
    const compensation = clamp(Math.pow(ratio, 0.65), 0.80, 1.25);
    if (Math.abs(compensation - 1) > 0.02) {
      this.state.layers = this.state.layers.map(l => {
        if (l.locked || l.frozen) return l;
        return { ...l, volume: clamp(Number((l.volume * compensation).toFixed(2)), 0.08, 1) };
      });
    }

    // 9. Smooth audio crossfade for active voices
    if (this.running) {
      this.pendingEvolve = true;
      this.evolveTransition(this.audio.getTime() + 0.01, this.getPosition().beat);
    }

    this.addChange(`🎲 Radical Random · ${notes.join(' · ')}`);
    this.remember();
    this.applyRouting();
    this.applySound();
    this.notify();
  }
  /**
   * Called at the first step after Evolve. Chords, bass and melody that are still ringing fade out over ~0.3 s starting at this
   * step's time, and the rearranged versions of whatever should be sounding now enter with a short attack at the same instant.
   * The drone stays: it is the root the rest moves around. Locked, frozen and clip-driven layers are never touched.
   */
  private evolveTransition(time: number, beat: number): void {
    const clipTracks = new Set(this.override?.clip.tracks.map(t => t.id));
    const affected = new Set(this.state.layers.filter(l => l.role !== 'drum' && l.role !== 'drone' && !l.locked && !l.frozen && !l.muted && !clipTracks.has(l.id)).map(l => l.id));
    if (!affected.size) return;
    for (const id of affected) { this.pads.get(id)?.fadeOutAll(time, 0.28); this.midi.releaseNotesForLayer(id); }
    for (const e of this.events) {
      if (!affected.has(e.layerId) || e.audioTime > time) continue; const end = this.eventEnds.get(e.id);
      if (end !== undefined && end > time) { this.eventEnds.set(e.id, time); e.durationBeats = Math.max(0, beat - e.startBeat); }
    }
    this.primeAtNextStep = true; this.primeLayers = affected; this.primeSoft = true; this.resumeNotes = [];
  }
  undo(): void { if (this.historyIndex > 0) { this.historyIndex--; this.restore(this.history[this.historyIndex]); } }
  redo(): void { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.restore(this.history[this.historyIndex]); } }
  private restore(session: JamSession): void {
    this.lastHistoryGroup = ''; this.pendingEvolve = false; this.truncatePerformed(); this.midi.panic(); for (const synth of this.pads.values()) synth.stopAllVoices(); this.drums?.stopAllVoices();
    this.state = validateSession(clone({ ...session, runtime: undefined })); this.composer.restore(session.runtime?.composer);
    this.arrangement.current = this.state.arrangement || 'groove';
    this.restoreClipRuntime(session.runtime); this.applyRouting();
    this.clock?.setBpm(this.state.bpm); this.clock?.setSwing(this.state.swing); this.resetFlow(); this.applySound(); this.notify();
  }
  createClip(bars = 8): MidiClip {
    const end = this.getPosition().beat; const start = Math.max(0, end - clamp(Math.round(bars), 1, 128) * 4);
    const notes = captureNotes(this.getRecentEvents(512), start, end);
    const priorTempo = [...this.tempos].reverse().find(t => t.beat <= start);
    const tempos = [{ beat: 0, bpm: priorTempo?.bpm ?? this.state.bpm }, ...this.tempos.filter(t => t.beat > start && t.beat < end).map(t => ({ beat: t.beat - start, bpm: t.bpm }))];
    const ccBefore = new Map<string, ClipRawEvent>();
    for (const c of this.controllers) if (c.audioTime <= this.audio.getTime() && c.beat <= start) ccBefore.set(`${c.layerId}:${c.bytes[0]}:${c.bytes[1]}`, { layerId: c.layerId, beat: 0, bytes: [...c.bytes] });
    const extraEvents: ClipRawEvent[] = [...ccBefore.values(), ...this.controllers.filter(c => c.audioTime <= this.audio.getTime() && c.beat > start && c.beat < end).map(c => ({ layerId: c.layerId, beat: c.beat - start, bytes: [...c.bytes] }))];
    return { version: 1, id: id('clip'), name: `${this.state.name} · ${((end - start) / 4).toFixed(1)} Takte`, createdAt: Date.now(),
      style: this.state.style, root: this.state.root, scale: this.state.scale, bpm: tempos[0].bpm, lengthBeats: end - start, notes, tempos, extraEvents,
      tracks: this.state.layers.map(l => ({ id: l.id, name: l.name, channel: l.channel, color: l.color })) };
  }
  /**
   * Export an Ableton Live ready Multitrack MIDI Clip (Type 1 SMF).
   * If currently playing and captured material exists, exports the live captured take.
   * Otherwise, renders a deterministic, pristine multi-track phrase for the current scene/state.
   */
  exportAbletonClip(bars = 8): MidiClip {
    const isPlaying = this.getPosition().playing;
    const captured = this.getPosition().capturedBars;
    if (isPlaying && captured >= 1) {
      return this.createClip(Math.min(bars, captured));
    }
    return generatePreview(this.saveSession(), bars);
  }
  previewScene(sceneId: string, bars = 8): MidiClip {
    const session = sceneId === this.state.sceneId ? this.saveSession() : createSession(sceneId, this.state.seed); return generatePreview(session, bars);
  }
  setClipOverride(clip: MidiClip): void {
    const copy = validateClip(clip); copy.lengthBeats = Math.max(0.25, copy.lengthBeats);
    // Imported tracks can map by role/name; unknown tracks use the melody layer explicitly.
    const ids = new Set(this.state.layers.map(l => l.id)); const remap = new Map<string, string>();
    copy.tracks.forEach(track => {
      if (ids.has(track.id)) remap.set(track.id, track.id);
      else { const byChannel = this.state.layers.find(l => l.channel === track.channel); const name = track.name.toLowerCase();
        const role = /bass/.test(name) ? 'bass' : /chord|pad/.test(name) ? 'chords' : /drum|kick|snare|hat/.test(name) ? 'drum' : 'melody';
        remap.set(track.id, this.state.layers.find(l => l.role === role)?.id || byChannel?.id || 'melody'); }
    });
    copy.notes = copy.notes.map(n => ({ ...n, layerId: !ids.has(n.layerId) && n.channel === 10 ? drumLayer(n.note) : remap.get(n.layerId) || (ids.has(n.layerId) ? n.layerId : 'melody') }));
    copy.extraEvents = copy.extraEvents.map(e => ({ ...e, layerId: remap.get(e.layerId) || (ids.has(e.layerId) ? e.layerId : 'melody') }));
    copy.tracks = [...new Set([...remap.values(), ...copy.notes.map(n => n.layerId), ...copy.extraEvents.map(e => e.layerId)])].map(layerId => { const l = this.state.layers.find(v => v.id === layerId)!; return { id: l.id, name: l.name, color: l.color, channel: l.channel }; });
    this.pendingOverride = copy; this.remember(); this.notify();
  }
  clearClipOverride(): void { this.override = null; this.pendingOverride = null; this.remember(); this.notify(); }

  applyArrangement(action: ArrangementSection | 'spontaneous', logChange = true): void {
    let target = action;
    if (target === 'spontaneous') {
      const choices: Record<ArrangementSection, ArrangementSection[]> = {
        groove: ['breakdown', 'chorus', 'buildup'],
        chorus: ['breakdown', 'groove'],
        breakdown: ['buildup', 'silent', 'groove'],
        buildup: ['groove', 'chorus'],
        silent: ['buildup', 'breakdown', 'groove'],
      };
      const list = choices[this.arrangement.current] || ['groove', 'breakdown', 'chorus', 'buildup'];
      const rng = new PRNG(Math.floor(nowPerf()) ^ this.state.seed);
      target = rng.pick(list);
    }

    const beat = this.getPosition().beat;
    const currentBar = Math.floor(beat / 4);

    if (target === 'buildup') {
      this.arrangement.current = 'buildup';
      this.arrangement.buildupBarsLeft = 4;
      this.arrangement.targetDropBar = currentBar + 4;
      this.state.layers = this.state.layers.map(l => {
        if (l.role === 'drum') {
          const isHatOrPerc = l.id === 'hihat' || l.id === 'perc';
          return { ...l, muted: false, volume: Math.max(l.volume, 0.4), settings: { ...l.settings, density: clamp(l.settings.density + (isHatOrPerc ? 0.25 : 0.1), 0, 1) } };
        }
        return l;
      });
      this.state.macros.movement = clamp(this.state.macros.movement + 0.15, 0, 1);
      this.state.macros.warmth = clamp(this.state.macros.warmth + 0.1, 0, 1);
      if (logChange) this.addChange('Arrangement: ⚡ Buildup gestartet (Drop in 4 Takten)', beat);
    } else if (target === 'breakdown') {
      this.arrangement.current = 'breakdown';
      this.arrangement.buildupBarsLeft = 0;
      this.state.layers = this.state.layers.map(l => {
        if (l.role === 'drum') return { ...l, muted: true };
        if (l.role === 'chords' || l.role === 'drone') return { ...l, muted: false, volume: Math.max(l.volume, 0.55) };
        return l;
      });
      this.state.macros.space = clamp(this.state.macros.space + 0.2, 0, 1);
      if (logChange) this.addChange('Arrangement: 💥 Breakdown · Drums ausgeblendet, Pad schwebt', beat);
    } else if (target === 'chorus') {
      this.arrangement.current = 'chorus';
      this.arrangement.buildupBarsLeft = 0;
      this.state.layers = this.state.layers.map(l => {
        if (l.role === 'drum') return { ...l, muted: false, volume: Math.max(l.volume, 0.5) };
        if (l.role === 'chords') return { ...l, muted: false, volume: Math.max(l.volume, 0.6), settings: { ...l.settings, density: clamp(l.settings.density + 0.15, 0, 1) } };
        if (l.role === 'melody') return { ...l, muted: false, volume: Math.max(l.volume, 0.45), settings: { ...l.settings, density: clamp(l.settings.density + 0.2, 0, 1) } };
        return { ...l, muted: false };
      });
      this.state.macros.warmth = clamp(this.state.macros.warmth + 0.15, 0, 1);
      this.state.macros.density = clamp(this.state.macros.density + 0.18, 0, 1);
      if (logChange) this.addChange('Arrangement: 🌟 Chorus / Peak · Volle Klangdichte', beat);
    } else if (target === 'silent') {
      this.arrangement.current = 'silent';
      this.arrangement.buildupBarsLeft = 0;
      this.state.layers = this.state.layers.map(l => {
        if (l.role === 'drum') return { ...l, muted: true };
        if (l.role === 'melody') return { ...l, settings: { ...l.settings, density: clamp(l.settings.density * 0.4, 0.1, 0.25) } };
        if (l.role === 'bass') return { ...l, volume: clamp(l.volume * 0.6, 0.2, 0.5) };
        return l;
      });
      this.state.macros.density = clamp(this.state.macros.density - 0.2, 0.1, 0.4);
      this.state.macros.space = clamp(this.state.macros.space + 0.15, 0, 1);
      if (logChange) this.addChange('Arrangement: 🤫 Stille · Intimer Ambient-Teil', beat);
    } else {
      this.arrangement.current = 'groove';
      this.arrangement.buildupBarsLeft = 0;
      this.state.layers = this.state.layers.map(l => {
        if (l.role === 'drum') return { ...l, muted: false, volume: l.id === 'kick' ? Math.max(l.volume, 0.8) : Math.max(l.volume, 0.35) };
        return { ...l, muted: false };
      });
      if (logChange) this.addChange('Arrangement: 🌊 Voller Beat (Drop In)', beat);
    }

    this.state.arrangement = target;
    this.applySound();
    this.remember('arrangement');
    this.notify();
  }

  applyRhythmPreset(presetId: string): void {
    const preset = findRhythmPreset(presetId);
    if (!preset) return;
    this.state.layers = this.state.layers.map(layer => {
      if (layer.role !== 'drum' || layer.locked || layer.frozen) return layer;
      const voice = layer.drumVoice || (layer.id as DrumVoice);
      const conf = preset.drumLayers[voice];
      if (!conf) return layer;
      const { muted, volume, ...settingsPatch } = conf;
      return {
        ...layer,
        ...(muted !== undefined ? { muted } : {}),
        ...(volume !== undefined ? { volume } : {}),
        settings: { ...layer.settings, ...settingsPatch },
      };
    });
    if (preset.swing !== undefined) {
      this.state.swing = preset.swing;
      this.clock?.setSwing(preset.swing);
    }
    this.addChange(`Rhythmus: ${preset.name} (${preset.artistInspiration})`);
    this.remember('rhythm');
    this.notify();
  }

  toggleAutoArrangement(enabled?: boolean, autoBars = 16): void {
    this.arrangement.auto = enabled ?? !this.arrangement.auto;
    this.arrangement.autoBars = autoBars;
    this.addChange(this.arrangement.auto ? `Spontanes Arrangement: Aktiv (alle ${autoBars} Takte)` : 'Spontanes Arrangement: Deaktiviert');
    this.notify();
  }

  getArrangementState(): { current: ArrangementSection; auto: boolean; autoBars: number; buildupBarsLeft: number } {
    return { ...this.arrangement };
  }

  toggleSequencer(enabled?: boolean): void {
    const next = enabled !== undefined ? enabled : !this.arrangement.sequencerEnabled;
    this.arrangement.sequencerEnabled = next;
    this.state.sequencerEnabled = next;
    if (next) {
      this.arrangement.auto = false;
      this.state.sequence = clone(this.arrangement.sequencerBlocks);
      const currentBlock = this.arrangement.sequencerBlocks[this.arrangement.sequencerIndex] || this.arrangement.sequencerBlocks[0];
      if (currentBlock) {
        this.applyArrangement(currentBlock.section, false);
      }
    }
    this.addChange(next ? 'Arrangement-Sequencer: Aktiviert' : 'Arrangement-Sequencer: Deaktiviert');
    this.remember('sequencer:toggle');
    this.notify();
  }

  getSequencerState(): { enabled: boolean; blocks: SequenceBlock[]; activeIndex: number; barInBlock: number } {
    return {
      enabled: this.arrangement.sequencerEnabled,
      blocks: clone(this.arrangement.sequencerBlocks),
      activeIndex: this.arrangement.sequencerIndex,
      barInBlock: this.arrangement.sequencerBarInBlock,
    };
  }

  setSequence(blocks: SequenceBlock[]): void {
    if (!blocks.length) return;
    this.arrangement.sequencerBlocks = clone(blocks);
    this.state.sequence = clone(blocks);
    if (this.arrangement.sequencerIndex >= blocks.length) {
      this.arrangement.sequencerIndex = 0;
      this.arrangement.sequencerBarInBlock = 0;
    }
    this.remember('sequencer:blocks');
    this.notify();
  }

  updateSequenceBlock(blockId: string, patch: Partial<SequenceBlock>): void {
    this.arrangement.sequencerBlocks = this.arrangement.sequencerBlocks.map(b => b.id === blockId ? { ...b, ...patch } : b);
    this.state.sequence = clone(this.arrangement.sequencerBlocks);
    this.remember('sequencer:blockEdit');
    this.notify();
  }

  addSequenceBlock(section: ArrangementSection = 'groove', bars = 4): void {
    const newBlock: SequenceBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      section,
      bars,
      label: `${bars}T ${section === 'chorus' ? 'Chorus' : section === 'breakdown' ? 'Breakdown' : section === 'buildup' ? 'Buildup' : section === 'silent' ? 'Stille' : 'Beat'}`,
      macroTargets: {
        space: section === 'breakdown' || section === 'silent' ? 0.85 : 0.55,
        warmth: 0.68,
        density: section === 'silent' ? 0.22 : section === 'chorus' ? 0.80 : 0.50,
        movement: section === 'buildup' ? 0.65 : 0.35,
      }
    };
    this.arrangement.sequencerBlocks.push(newBlock);
    this.state.sequence = clone(this.arrangement.sequencerBlocks);
    this.remember('sequencer:add');
    this.notify();
  }

  removeSequenceBlock(blockId: string): void {
    if (this.arrangement.sequencerBlocks.length <= 1) return;
    this.arrangement.sequencerBlocks = this.arrangement.sequencerBlocks.filter(b => b.id !== blockId);
    this.state.sequence = clone(this.arrangement.sequencerBlocks);
    if (this.arrangement.sequencerIndex >= this.arrangement.sequencerBlocks.length) {
      this.arrangement.sequencerIndex = 0;
      this.arrangement.sequencerBarInBlock = 0;
    }
    this.remember('sequencer:remove');
    this.notify();
  }

  jumpToSequenceBlock(index: number): void {
    const blocks = this.arrangement.sequencerBlocks;
    if (index < 0 || index >= blocks.length) return;
    this.arrangement.sequencerIndex = index;
    this.arrangement.sequencerBarInBlock = 0;
    const block = blocks[index];
    this.applyArrangement(block.section, false);
    if (block.macroTargets) {
      for (const [name, targetVal] of Object.entries(block.macroTargets) as [MacroName, number][]) {
        if (targetVal !== undefined) this.state.macros[name] = clamp(targetVal, 0, 1);
      }
      this.applySound();
    }
    this.addChange(`Sequencer: Zu [${block.label || block.section}] gesprungen`, this.getPosition().beat);
    this.notify();
  }

  applySequenceTemplate(templateId: string): void {
    const template = findSequenceTemplate(templateId);
    if (!template) return;
    const blocks: SequenceBlock[] = template.blocks.map((b, i) => ({
      id: `block-${Date.now()}-${i + 1}`,
      ...b,
    }));
    this.setSequence(blocks);
    this.addChange(`Sequencer-Vorlage: ${template.name}`, this.getPosition().beat);
  }

  /** Transpose the session root on the fly by a semitone delta (e.g. -1 or +1). */
  transposeRoot(semitones: number): void {
    const nextRoot = Math.max(24, Math.min(84, this.state.root + semitones));
    this.updateSession({ root: nextRoot });
    this.addChange(`Grundton: ${rootPitchName(nextRoot)} (${semitones > 0 ? '+' : ''}${semitones})`, this.getPosition().beat);
  }

  /** Set the session root directly to a specific MIDI note (clamped 24-84). */
  setRoot(root: number): void {
    const nextRoot = Math.max(24, Math.min(84, Math.round(root)));
    this.updateSession({ root: nextRoot });
    this.addChange(`Grundton: ${rootPitchName(nextRoot)}`, this.getPosition().beat);
  }

  /** Nudge an individual sounding chord tone up or down by semitones on the fly. */
  nudgeChordNote(index: number, semitones: number): void {
    const h = this.composer.nudgeChordNote(index, semitones);
    const nudged = h.notes[index];
    if (nudged !== undefined) {
      void this.auditionNote(nudged);
      this.addChange(`Akkordnote #${index + 1}: ${rootPitchName(nudged)} (${semitones > 0 ? '+' : ''}${semitones})`, this.getPosition().beat);
    }
    this.notify();
  }

  /** Cycle current chord degree backward (-1) or forward (+1) on the fly. */
  cycleChord(direction: 1 | -1): void {
    const currentDeg = this.composer.getHarmony().degree;
    const h = this.composer.setHarmonyDegree(currentDeg + direction, this.state);
    void this.auditionNote(h.root + 12);
    this.addChange(`Akkord gewechselt: ${h.name}`, this.getPosition().beat);
    this.notify();
  }

  /** Set generative chord pattern ('pad' | 'pulse' | 'broken' | 'syncopated' | 'euclidean' | 'wave' | 'cluster'). */
  setChordPattern(pattern: ChordPattern): void {
    const chordLayer = this.state.layers.find(l => l.role === 'chords');
    if (!chordLayer) return;
    this.setLayerSettings(chordLayer.id, { chordPattern: pattern });
    this.addChange(`Akkordmuster: ${pattern}`, this.getPosition().beat);
    this.remember('chordPattern');
    this.notify();
  }

  /** Set chord harmonic pace ('1-bar' | '2-bars' | '4-bars' | 'dynamic'). */
  setChordPace(pace: ChordPace): void {
    const chordLayer = this.state.layers.find(l => l.role === 'chords');
    if (!chordLayer) return;
    this.setLayerSettings(chordLayer.id, { chordPace: pace });
    this.composer.reset();
    this.composer.harmonyAt(Math.floor(this.getPosition().beat * 4), this.state);
    this.addChange(`Harmoniewechsel: ${pace}`, this.getPosition().beat);
    this.remember('chordPace');
    this.notify();
  }

  /** Set companion chord texture voice ('off' | 'shimmer' | 'octave' | 'sub5th'). */
  setChordTexture(texture: ChordTexture): void {
    const chordLayer = this.state.layers.find(l => l.role === 'chords');
    if (!chordLayer) return;
    this.setLayerSettings(chordLayer.id, { chordTexture: texture });
    this.addChange(`Akkord-Begleittextur: ${texture}`, this.getPosition().beat);
    this.remember('chordTexture');
    this.notify();
  }

  /** Move a sequence block left/earlier or right/later in the arrangement order. */
  moveSequenceBlock(blockId: string, direction: 'left' | 'right' | 'up' | 'down'): void {
    const blocks = [...this.arrangement.sequencerBlocks];
    const idx = blocks.findIndex(b => b.id === blockId);
    if (idx === -1) return;
    const targetIdx = (direction === 'left' || direction === 'up') ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= blocks.length) return;
    const [moved] = blocks.splice(idx, 1);
    blocks.splice(targetIdx, 0, moved);
    this.setSequence(blocks);
    this.addChange(`Sequenz: Block #${idx + 1} verschoben nach #${targetIdx + 1}`, this.getPosition().beat);
  }

  /** Step duration of a sequence block like tempo settings (2, 4, 8, 16, 32 bars). */
  stepBlockBars(blockId: string, delta: number): void {
    const block = this.arrangement.sequencerBlocks.find(b => b.id === blockId);
    if (!block) return;
    const BARS = [2, 4, 8, 16, 32];
    const curIdx = BARS.indexOf(block.bars);
    let nextBars = block.bars;
    if (curIdx !== -1) {
      const nextIdx = Math.max(0, Math.min(BARS.length - 1, curIdx + delta));
      nextBars = BARS[nextIdx];
    } else {
      nextBars = Math.max(1, Math.min(64, block.bars + (delta > 0 ? 4 : -4)));
    }
    this.updateSequenceBlock(blockId, { bars: nextBars, label: `${nextBars}T ${block.section.toUpperCase()}` });
    this.addChange(`Sequenz: Block-Dauer auf ${nextBars} Takte geändert`, this.getPosition().beat);
  }

  /** Set a sequence block's arrangement energy and macro profile referencing arrows (High, Up, Flow, Down, Low). */
  setBlockSectionByEnergy(blockId: string, energy: 'high' | 'up' | 'groove' | 'down' | 'low'): void {
    const map: Record<'high' | 'up' | 'groove' | 'down' | 'low', { section: ArrangementSection; label: string; space: number; density: number; movement: number }> = {
      high: { section: 'chorus', label: 'Chorus (Peak)', space: 0.72, density: 0.85, movement: 0.55 },
      up: { section: 'buildup', label: 'Buildup (Spannung)', space: 0.60, density: 0.75, movement: 0.70 },
      groove: { section: 'groove', label: 'Voller Groove', space: 0.55, density: 0.55, movement: 0.38 },
      down: { section: 'breakdown', label: 'Breakdown (Drums aus)', space: 0.86, density: 0.30, movement: 0.25 },
      low: { section: 'silent', label: 'Stille (Minimal)', space: 0.90, density: 0.20, movement: 0.20 },
    };
    const target = map[energy];
    if (!target) return;
    const block = this.arrangement.sequencerBlocks.find(b => b.id === blockId);
    const bars = block?.bars || 4;
    this.updateSequenceBlock(blockId, {
      section: target.section,
      label: `${bars}T ${target.label}`,
      macroTargets: {
        space: target.space,
        warmth: 0.68,
        density: target.density,
        movement: target.movement,
      }
    });
    this.addChange(`Sequenz: Block auf [${target.label}] (${energy.toUpperCase()}) gesetzt`, this.getPosition().beat);
  }

  applySoundscapePreset(presetId: string): void {
    const preset = findSoundscapePreset(presetId);
    if (!preset) return;
    const chordsLayer = this.state.layers.find(l => l.role === 'chords');
    if (chordsLayer) {
      chordsLayer.settings.timbre = preset.chordTimbre;
    }
    this.state.atmosphere = { ...preset.atmosphere, level: Math.min(0.20, preset.atmosphere.level) };
    if (preset.macros) {
      for (const [k, v] of Object.entries(preset.macros) as [MacroName, number][]) {
        if (v !== undefined) this.state.macros[k] = clamp(v, 0, 1);
      }
    }
    if (preset.effects) {
      this.state.effectsPatch = { ...(this.state.effectsPatch || {}), ...preset.effects };
    }
    this.addChange(`Klangwelt: 🎻 ${preset.name} (${preset.subtitle})`, this.getPosition().beat);
    this.applySound();
    this.remember('soundscape');
    this.notify();
  }

  setChordTimbre(timbre: Timbre, matchAtmosphere = true): void {
    const chordsLayer = this.state.layers.find(l => l.role === 'chords');
    if (!chordsLayer) return;
    chordsLayer.settings.timbre = timbre;
    if (matchAtmosphere) {
      if (timbre === 'strings') {
        this.state.atmosphere = { kind: 'air', level: 0.16, tone: 0.58, movement: 0.48 };
        this.state.macros.space = Math.max(this.state.macros.space, 0.84);
        this.state.macros.warmth = Math.max(this.state.macros.warmth, 0.68);
      } else if (timbre === 'wash') {
        this.state.atmosphere = { kind: 'tape', level: 0.14, tone: 0.50, movement: 0.45 };
        this.state.macros.space = Math.max(this.state.macros.space, 0.78);
      } else if (timbre === 'glass') {
        this.state.atmosphere = { kind: 'air', level: 0.15, tone: 0.68, movement: 0.40 };
        this.state.macros.space = Math.max(this.state.macros.space, 0.82);
      } else if (timbre === 'keys') {
        this.state.atmosphere = { kind: 'rain', level: 0.18, tone: 0.52, movement: 0.35 };
        this.state.macros.space = 0.50;
      } else if (timbre === 'dub') {
        this.state.atmosphere = { kind: 'tape', level: 0.16, tone: 0.38, movement: 0.42 };
      }
    }
    this.addChange(`Akkord-Klang: ${timbre === 'strings' ? 'Großes Streichorchester' : timbre}`);
    this.applySound();
    this.remember('chordTimbre');
    this.notify();
  }

  setChordHall(hallAmount: number): void {
    const space = clamp(hallAmount, 0, 1);
    this.state.macros.space = space;
    this.state.effectsPatch = {
      ...(this.state.effectsPatch || {}),
      reverbSize: clamp(0.4 + space * 0.55, 0, 1),
      reverbDecay: clamp(1.8 + space * 8.2, 0.2, 14),
      reverbMix: clamp(space * 0.55, 0, 1),
    };
    this.applySound();
    this.notify();
  }

  getCustomMacros(): CustomMacro[] {
    return this.state.customMacros || [];
  }

  setCustomMacro(macroId: string, value: number): void {
    const macros = this.state.customMacros || [];
    const macro = macros.find(m => m.id === macroId);
    if (!macro) return;
    const v = clamp(value, 0, 1);
    macro.value = v;

    for (const target of macro.targets) {
      const targetVal = target.inverted
        ? target.max - v * (target.max - target.min)
        : target.min + v * (target.max - target.min);

      if (target.param.startsWith('macro:')) {
        const name = target.param.slice(6) as MacroName;
        if (['space', 'warmth', 'density', 'movement'].includes(name)) {
          this.state.macros[name] = clamp(targetVal, 0, 1);
        }
      } else if (target.param.startsWith('fx:')) {
        const key = target.param.slice(3) as keyof EffectsParams;
        this.state.effectsPatch = { ...(this.state.effectsPatch || {}), [key]: targetVal };
      } else if (target.param === 'atmo:level') {
        const level = Math.min(0.20, Math.max(0, targetVal));
        this.state.atmosphere = { ...(this.state.atmosphere || { kind: 'off', level: 0.18, tone: 0.5, movement: 0.4 }), level };
      } else if (target.param === 'pump') {
        this.state.pump = clamp(targetVal, 0, 1);
      } else if (target.param.startsWith('layer:')) {
        const parts = target.param.split(':');
        const layerId = parts[1];
        const prop = parts[2];
        const layer = this.state.layers.find(l => l.id === layerId);
        if (layer) {
          if (prop === 'volume') layer.volume = clamp(targetVal, 0, 1);
          else if (prop === 'density') layer.settings.density = clamp(targetVal, 0, 1);
        }
      }
    }

    this.applySound();
    this.remember(`customMacro:${macro.name}`);
    this.notify();
  }

  addCustomMacro(macro: CustomMacro): void {
    const current = this.state.customMacros || [];
    this.state.customMacros = [...current, macro];
    this.setCustomMacro(macro.id, macro.value);
    this.addChange(`Neues Makro erstellt: ${macro.name}`);
    this.remember('customMacro:add');
    this.notify();
  }

  updateCustomMacro(macroId: string, patch: Partial<CustomMacro>): void {
    const current = this.state.customMacros || [];
    this.state.customMacros = current.map(m => m.id === macroId ? { ...m, ...patch } : m);
    if (patch.value !== undefined) {
      this.setCustomMacro(macroId, patch.value);
    } else {
      this.remember('customMacro:edit');
      this.notify();
    }
  }

  deleteCustomMacro(macroId: string): void {
    const current = this.state.customMacros || [];
    this.state.customMacros = current.filter(m => m.id !== macroId);
    this.remember('customMacro:delete');
    this.notify();
  }

  getEffectChain(): EffectChainSettings {
    return this.state.effectChain || { mode: 'parallel', modules: DEFAULT_EFFECT_MODULES };
  }

  setEffectChainMode(mode: EffectChainMode): void {
    const current = this.getEffectChain();
    this.state.effectChain = { ...current, mode };
    this.addChange(`Effekt-Kette: Modus ${mode === 'delay-into-reverb' ? 'Delay ➔ Reverb (Psybient Wash)' : mode === 'reverb-into-delay' ? 'Reverb ➔ Delay (Echo-Wash)' : 'Parallel'}`);
    this.applySound();
    this.remember('effectChain:mode');
    this.notify();
  }

  toggleEffectBypass(effectId: EffectModuleId): void {
    const current = this.getEffectChain();
    const modules = current.modules.map(mod => mod.id === effectId ? { ...mod, bypassed: !mod.bypassed } : mod);
    this.state.effectChain = { ...current, modules };
    this.applySound();
    this.remember(`effectChain:bypass:${effectId}`);
    this.notify();
  }

  reorderEffectChain(newOrder: EffectModuleId[]): void {
    const current = this.getEffectChain();
    const map = new Map(current.modules.map(m => [m.id, m]));
    const reordered: EffectModuleConfig[] = [];
    for (const id of newOrder) {
      const found = map.get(id);
      if (found) reordered.push(found);
    }
    for (const m of current.modules) {
      if (!reordered.some(r => r.id === m.id)) reordered.push(m);
    }
    this.state.effectChain = { ...current, modules: reordered };
    this.applySound();
    this.remember('effectChain:reorder');
    this.notify();
  }

  setEq(patch: { low?: number; mid?: number; midFreq?: number; midQ?: number; high?: number; highpass?: number }): void {
    const cur = this.state.effectsPatch || {};
    this.state.effectsPatch = {
      ...cur,
      ...(patch.low !== undefined ? { eqLow: clamp(patch.low, -14, 14) } : {}),
      ...(patch.mid !== undefined ? { eqMid: clamp(patch.mid, -14, 14) } : {}),
      ...(patch.midFreq !== undefined ? { eqMidFreq: clamp(patch.midFreq, 200, 6000) } : {}),
      ...(patch.midQ !== undefined ? { eqMidQ: clamp(patch.midQ, 0.3, 4.0) } : {}),
      ...(patch.high !== undefined ? { eqHigh: clamp(patch.high, -14, 14) } : {}),
      ...(patch.highpass !== undefined ? { eqHighpass: clamp(patch.highpass, 20, 400) } : {}),
    };
    this.applySound();
    this.remember('eq');
    this.notify();
  }

  getWorkspaceModules(): string[] {
    return this.state.workspaceModules || DEFAULT_WORKSPACE_MODULES;
  }

  setWorkspaceModules(modules: string[]): void {
    this.state.workspaceModules = [...modules];
    this.notify();
  }

  toggleWorkspaceModule(moduleId: string): void {
    const current = this.getWorkspaceModules();
    if (current.includes(moduleId)) {
      this.state.workspaceModules = current.filter(id => id !== moduleId);
    } else {
      this.state.workspaceModules = [...current, moduleId];
    }
    this.notify();
  }

  applyChaosImpulse(): void {
    const deltaX = (Math.random() - 0.5) * 0.25;
    const deltaY = (Math.random() - 0.5) * 0.25;
    this.state.macros.movement = clamp(this.state.macros.movement + deltaX, 0.1, 0.9);
    this.state.macros.space = clamp(this.state.macros.space + deltaY, 0.2, 0.95);
    this.addChange('⚡ Chaotischer Impuls (Organischer Timbre-Drift)', this.getPosition().beat);
    this.applySound();
    this.notify();
  }

  setChaosDrift(x: number, y: number): void {
    this.state.macros.movement = clamp(x, 0, 1);
    this.state.macros.space = clamp(y, 0, 1);
    this.applySound();
  }
  async previewClip(clip: MidiClip): Promise<void> {
    this.stopPreview(); await this.init(); await this.audio.ctx?.resume();
    const session = clone(this.state); session.bpm = clip.bpm; session.root = clip.root; session.scale = clip.scale;
    const origin = this.audio.getTime() + 0.04;
    const secondsAt = (beat: number) => {
      const tempos = [...clip.tempos].sort((a, b) => a.beat - b.beat); let seconds = 0; let cursor = 0; let bpm = clip.bpm;
      for (const t of tempos) { if (t.beat > beat) break; seconds += Math.max(0, t.beat - cursor) * 60 / bpm; cursor = t.beat; bpm = t.bpm; }
      return seconds + (beat - cursor) * 60 / bpm;
    };
    // Only a 100ms window is scheduled: a large imported clip does not create one timer per note.
    const scheduled = clip.notes.map(note => ({ note, at: origin + secondsAt(note.startBeat), durationSec: secondsAt(note.startBeat + note.durationBeats) - secondsAt(note.startBeat) })).sort((a, b) => a.at - b.at);
    let cursor = 0;
    const tick = () => {
      const now = this.audio.getTime();
      while (cursor < scheduled.length && scheduled[cursor].at < now + 0.1) {
        const { note, at, durationSec } = scheduled[cursor++];
        if (at + durationSec < now) continue; // Suspended/backgrounded audition does not produce a catch-up burst.
        const layerId = session.layers.some(l => l.id === note.layerId) ? note.layerId : note.channel === 10 ? drumLayer(note.note) : 'melody';
        this.playNote({ ...note, layerId, microMs: 0, durationBeats: durationSec * session.bpm / 60 }, Math.max(at, now + 0.001), nowPerf(), session, true);
      }
      if (cursor >= scheduled.length && this.previewTimer) { clearInterval(this.previewTimer); this.previewTimer = null; }
    };
    tick(); if (cursor < scheduled.length) this.previewTimer = setInterval(tick, 25);
  }
  stopPreview(): void {
    if (this.previewTimer) clearInterval(this.previewTimer); this.previewTimer = null;
    for (const synth of this.previewPads.values()) synth.stopAllVoices(); this.previewPads.clear(); this.previewDrums?.stopAllVoices(); this.previewDrums = null;
  }
  async auditionNote(note: number, velocity = 90): Promise<void> {
    if (typeof window === 'undefined') return;
    await this.init(); await this.audio.ctx?.resume(); const layer = this.state.layers.find(l => l.role === 'melody')!;
    if (!this.auditionSynth) this.auditionSynth = new AmbientSynth(this.audio.ctx!, this.padBus || this.rack!.inputNode, 3, 3, new PRNG(streamSeed(this.state.seed, 'audition')));
    this.auditionSynth.triggerNote(this.audio.getTime() + 0.005, Math.round(clamp(note, 0, 127)), velocity, 0.7, ambientPatch(layer, this.state), 0.75);
  }
  private snapshot(detachedClip: boolean): JamSession {
    return { ...this.getState(), sequence: clone(this.arrangement.sequencerBlocks), sequencerEnabled: this.arrangement.sequencerEnabled, runtime: { composer: this.composer.getRuntime(), step: this.nextStep, positionBeat: this.getPosition().beat, resumeNotes: this.running ? this.remainingNotes() : clone(this.resumeNotes),
      ...(this.override ? { clipOverride: detachedClip ? clone(this.override) : this.override } : {}),
      ...(this.pendingOverride ? { pendingOverride: detachedClip ? clone(this.pendingOverride) : this.pendingOverride } : {}) } };
  }
  saveSession(): JamSession { return this.snapshot(true); }
  private restoreClipRuntime(runtime: JamSession['runtime']): void {
    this.resumeNotes = Array.isArray(runtime?.resumeNotes) ? (runtime.resumeNotes as PlannedNote[]).map(n => ({ layerId: n.layerId, note: n.note, velocity: n.velocity, channel: n.channel, durationBeats: n.durationBeats, microMs: 0 })) : [];
    const override = runtime?.clipOverride as { clip: MidiClip; originBeat: number } | undefined;
    this.override = override ? { clip: clone(override.clip), originBeat: override.originBeat } : null;
    this.pendingOverride = runtime?.pendingOverride ? clone(runtime.pendingOverride as MidiClip) : null;
  }
  loadSession(raw: unknown): void {
    const session = migrateSession(raw); this.panic(); this.state = session; this.composer.reset(); this.composer.restore(session.runtime?.composer);
    this.stoppedBeat = typeof session.runtime?.positionBeat === 'number' ? Math.max(0, session.runtime.positionBeat) : 0;
    this.nextStep = typeof session.runtime?.step === 'number' ? Math.floor(session.runtime.step) : Math.ceil(this.stoppedBeat * 4);
    if (session.sequence && session.sequence.length > 0) this.arrangement.sequencerBlocks = clone(session.sequence);
    this.arrangement.sequencerEnabled = !!session.sequencerEnabled;
    this.events = []; this.controllers = []; this.eventEnds.clear(); this.timeline = []; this.tempos = []; this.anchors = []; this.restoreClipRuntime(session.runtime); this.applyRouting();
    this.clock?.setBpm(this.state.bpm); this.clock?.setSwing(this.state.swing);
    this.resetFlow(); this.applySound(); this.remember(); this.notify();
  }
  /** Decodes a user-chosen audio file into the atmosphere loop. Runs entirely in the browser; the file is not stored. */
  async loadAtmosphereSample(data: ArrayBuffer, name: string): Promise<void> {
    await this.init(); await this.audio.ctx?.resume(); if (!this.bed) throw new Error('Dieser Browser kann keine Samples dekodieren.');
    await this.bed.loadSample(data, name); const current = this.state.atmosphere ?? { kind: 'sample' as const, level: 0.18, tone: 0.6, movement: 0.3 };
    this.updateSession({ atmosphere: { ...current, kind: 'sample', sampleName: name.slice(0, 120), level: current.kind === 'off' ? 0.18 : Math.min(0.2, current.level) } });
  }
  getAtmosphereSampleName(): string | null { return this.bed?.getSampleName() ?? null; }
}

export function generatePreview(session: JamSession, bars = 8): MidiClip {
  const composer = new JamComposer();
  if (session.runtime?.composer) { const runtime = clone(session.runtime.composer) as { frozenStarts?: Record<string, number> }; if (runtime.frozenStarts) for (const key of Object.keys(runtime.frozenStarts)) runtime.frozenStarts[key] = 0; composer.restore(runtime); }
  const length = Math.max(1, Math.min(128, Math.round(bars))) * 4; const notes: MidiClip['notes'] = []; const noteIds = new Map<string, number>();
  for (let step = 0; step < length * 4; step++) {
    const swingBeats = step % 2 ? session.swing * 0.1 : 0;
    for (const n of composer.planStep(step, session)) { const l = session.layers.find(layer => layer.id === n.layerId)!;
      const startBeat = Math.max(0, step / 4 + swingBeats + n.microMs * session.bpm / 60000);
      const baseId = `preview-${step}-${n.layerId}-${n.note}`; const ordinal = noteIds.get(baseId) || 0; noteIds.set(baseId, ordinal + 1);
      notes.push({ id: `${baseId}-${ordinal}`, layerId: n.layerId, note: n.note, velocity: n.velocity, channel: l.channel, startBeat,
        durationBeats: Math.min(n.durationBeats, length - startBeat) });
    }
  }
  return { version: 1, id: `preview-${session.sceneId}-${session.seed}`, name: `${session.name} · Vorschau`, createdAt: 0, style: session.style,
    root: session.root, scale: session.scale, bpm: session.bpm, lengthBeats: length, notes, tempos: [{ beat: 0, bpm: session.bpm }], extraEvents: [],
    tracks: session.layers.map(l => ({ id: l.id, name: l.name, channel: l.channel, color: l.color })) };
}

function layerSettingsGroup(layerId: string, old: LayerSettings, requested: LayerSettings): string {
  const keys = Object.keys(requested).filter(key => JSON.stringify((old as unknown as Record<string, unknown>)[key]) !== JSON.stringify((requested as unknown as Record<string, unknown>)[key]));
  if (keys.length !== 1) return '';
  const key = keys[0];
  if (key === 'audioPatch' || key === 'drumPatch') {
    const patch = requested[key] as Record<string, unknown> | undefined; const previous = old[key] as Record<string, unknown> | undefined;
    if (!patch) return '';
    const changes = [...new Set([...Object.keys(previous || {}), ...Object.keys(patch)])].filter(k => previous?.[k] !== patch[k]);
    return changes.length === 1 && typeof patch[changes[0]] === 'number' ? `${key}:${layerId}:${changes[0]}` : '';
  }
  return typeof (requested as unknown as Record<string, unknown>)[key] === 'number' ? `settings:${layerId}:${key}` : '';
}
function normalizeLayer(raw: JamLayer, fallback: JamLayer): JamLayer {
  if (raw.name !== undefined && (typeof raw.name !== 'string' || raw.name.length > 80)) throw new Error('Ungültiger Layername.');
  for (const key of ['muted', 'solo', 'locked', 'frozen'] as const) if (raw[key] !== undefined && typeof raw[key] !== 'boolean') throw new Error('Ungültiger Layer-Schalter.');
  const s = { ...fallback.settings, ...raw.settings }; const min = Math.round(clamp(s.minNote, 0, 126));
  const max = Math.round(clamp(s.maxNote, min, 127));
  const densityMin = clamp(s.mutationDensityMin ?? 0, 0, 1); const densityMax = clamp(s.mutationDensityMax ?? 1, densityMin, 1);
  const velocityMin = Math.round(clamp(s.velocityMin, 1, 127)); const velocityMax = Math.round(clamp(s.velocityMax, velocityMin, 127));
  return { ...fallback, ...raw, id: fallback.id, role: fallback.role, drumVoice: fallback.drumVoice,
    name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : fallback.name, color: /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : fallback.color,
    volume: clamp(raw.volume ?? fallback.volume, 0, 1), channel: Math.round(clamp(raw.channel ?? fallback.channel, 1, 16)), outputId: typeof raw.outputId === 'string' ? raw.outputId : null,
    muted: !!raw.muted, solo: !!raw.solo, locked: !!raw.locked, frozen: !!raw.frozen,
    settings: { ...s, density: clamp(s.density, densityMin, densityMax), mutationDensityMin: densityMin, mutationDensityMax: densityMax,
      ...(s.audioPatch !== undefined ? { audioPatch: sanitizeAudioPatch(s.audioPatch) } : {}), ...(s.drumPatch !== undefined ? { drumPatch: sanitizeDrumPatch(s.drumPatch, fallback.drumVoice || 'perc') } : {}),
      ...(s.ambientAlgorithm !== undefined ? { ambientAlgorithm: s.ambientAlgorithm === 'granularDrift' ? 'granularDrift' : 'harmonicDrone' } : {}),
      rhythmAlgorithm: ['composed', 'euclidean', 'probabilistic', 'polymetric', 'markov', 'densityBurst'].includes(s.rhythmAlgorithm || '') ? s.rhythmAlgorithm : 'composed', minNote: min, maxNote: max, phraseBars: Math.round(clamp(s.phraseBars, 1, 16)),
      humanizeMs: clamp(s.humanizeMs, 0, 30), velocityMin, velocityMax,
      ...(s.chordPattern !== undefined && (CHORD_PATTERNS as readonly string[]).includes(s.chordPattern) ? { chordPattern: s.chordPattern } : {}),
      ...(s.chordPace !== undefined && (CHORD_PACES as readonly string[]).includes(s.chordPace) ? { chordPace: s.chordPace } : {}),
      ...(s.chordTexture !== undefined && (CHORD_TEXTURES as readonly string[]).includes(s.chordTexture) ? { chordTexture: s.chordTexture } : {}),
      timbre: (TIMBRES as readonly string[]).includes(s.timbre) ? s.timbre : 'warm' } };
}
export function validateSession(raw: JamSession): JamSession {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Ungültige Session.');
  for (const key of ['name', 'id', 'sceneId'] as const) if (raw[key] !== undefined && (typeof raw[key] !== 'string' || raw[key].length > 120)) throw new Error('Ungültige Session-Beschriftung.');
  for (const key of ['evolving', 'lowResource', 'deepMindEnabled'] as const) if (raw[key] !== undefined && typeof raw[key] !== 'boolean') throw new Error('Ungültiger Session-Schalter.');
  if (raw.layers !== undefined && (!Array.isArray(raw.layers) || raw.layers.length > 32 || !raw.layers.every(l => l && typeof l === 'object' && typeof l.id === 'string' && (!l.settings || (typeof l.settings === 'object' && !Array.isArray(l.settings)))))) throw new Error('Ungültige Layer in Session.');
  if (raw.macros !== undefined && (!raw.macros || typeof raw.macros !== 'object' || Array.isArray(raw.macros))) throw new Error('Ungültige Jam-Regler.');
  if (raw.runtime !== undefined) {
    if (!raw.runtime || typeof raw.runtime !== 'object' || Array.isArray(raw.runtime)) throw new Error('Ungültiger Wiedergabezustand.');
    for (const name of ['step', 'positionBeat']) { const value = raw.runtime[name]; if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e9)) throw new Error('Ungültige Wiedergabeposition.'); }
    const composer = new JamComposer(); composer.restore(raw.runtime.composer);
    if (raw.runtime.resumeNotes !== undefined) { const notes = raw.runtime.resumeNotes; if (!Array.isArray(notes) || notes.length > 64 || !notes.every(n => n && typeof n === 'object' && ['drone', 'chords', 'bass', 'melody'].includes(n.layerId) && Number.isInteger(n.note) && n.note >= 0 && n.note <= 127 && Number.isInteger(n.velocity) && n.velocity >= 1 && n.velocity <= 127 && typeof n.durationBeats === 'number' && Number.isFinite(n.durationBeats) && n.durationBeats > 0 && n.durationBeats <= 64 && (n.channel === undefined || Number.isInteger(n.channel) && n.channel >= 1 && n.channel <= 16))) throw new Error('Ungültige gehaltene Noten.'); }
    if (raw.runtime.clipOverride !== undefined) { const override = raw.runtime.clipOverride as { clip?: unknown; originBeat?: unknown }; if (!override || typeof override !== 'object' || typeof override.originBeat !== 'number' || !Number.isFinite(override.originBeat) || override.originBeat < 0 || override.originBeat > 1e9) throw new Error('Ungültige Clip-Position.'); validateClip(override.clip); }
    if (raw.runtime.pendingOverride !== undefined) validateClip(raw.runtime.pendingOverride);
  }
  const sceneId = typeof raw.sceneId === 'string' ? raw.sceneId : 'dorian-dawn';
  const base = createSession(sceneId, raw.seed); const macros = { ...base.macros };
  for (const name of Object.keys(macros) as MacroName[]) macros[name] = clamp(raw.macros?.[name] ?? macros[name], 0, 1);
  return { ...base, ...raw, version: 2, id: typeof raw.id === 'string' ? raw.id.slice(0, 100) : base.id,
    name: typeof raw.name === 'string' ? raw.name.slice(0, 120) : base.name, sceneId,
    style: raw.style === 'lofi' || raw.style === 'techno' ? raw.style : 'ambient', bpm: clamp(raw.bpm ?? base.bpm, 40, 180), swing: clamp(raw.swing ?? base.swing, 0, 0.75),
    root: Math.round(clamp(raw.root ?? base.root, 24, 84)), scale: typeof raw.scale === 'string' && Object.hasOwn(SCALE_INTERVALS, raw.scale) && raw.scale !== 'microtonal' ? raw.scale : 'dorian', seed: Number.isFinite(raw.seed) ? raw.seed >>> 0 : base.seed,
    evolving: typeof raw.evolving === 'boolean' ? raw.evolving : base.evolving, lowResource: !!raw.lowResource, deepMindEnabled: !!raw.deepMindEnabled,
    ...(raw.atmosphere !== undefined ? { atmosphere: sanitizeAtmosphere(raw.atmosphere) } : base.atmosphere ? { atmosphere: base.atmosphere } : {}),
    ...(raw.flow !== undefined ? { flow: sanitizeFlow(raw.flow) } : base.flow ? { flow: base.flow } : {}),
    ...(raw.pump !== undefined ? { pump: clamp(Number(raw.pump), 0, 1) } : base.pump !== undefined ? { pump: base.pump } : {}),
    ...(raw.effectsPatch !== undefined ? { effectsPatch: sanitizeEffectsPatch(raw.effectsPatch) } : {}),
    ...(raw.modRoutes !== undefined ? { modRoutes: sanitizeModRoutes(raw.modRoutes) } : {}),
    ...(raw.pinnedParams !== undefined ? { pinnedParams: sanitizePinnedParams(raw.pinnedParams, base) } : {}),
    ...(raw.globalOutputId !== undefined ? { globalOutputId: raw.globalOutputId === null ? null : typeof raw.globalOutputId === 'string' && raw.globalOutputId.length <= 512 ? raw.globalOutputId : (() => { throw new Error('Ungültiger globaler MIDI-Port.'); })() } : {}),
    volume: clamp(raw.volume ?? base.volume, 0, 1), outputMode: ['internal', 'midi', 'both'].includes(raw.outputMode) ? raw.outputMode : 'internal',
    pinned: Array.isArray(raw.pinned) ? [...new Set(raw.pinned.filter(p => ['movement', 'density', 'warmth', 'space'].includes(p)))] : base.pinned,
    ...(raw.arrangement !== undefined && ['groove', 'chorus', 'breakdown', 'buildup', 'silent'].includes(raw.arrangement) ? { arrangement: raw.arrangement } : {}),
    ...(Array.isArray(raw.sequence) ? { sequence: raw.sequence.map((b, i) => ({ id: typeof b.id === 'string' ? b.id : `seq-${i}`, section: ['groove', 'chorus', 'breakdown', 'buildup', 'silent'].includes(b.section) ? b.section : 'groove', bars: Math.round(clamp(b.bars ?? 4, 1, 64)), label: typeof b.label === 'string' ? b.label.slice(0, 80) : undefined, ...(b.macroTargets && typeof b.macroTargets === 'object' ? { macroTargets: b.macroTargets } : {}) })) } : {}),
    ...(raw.sequencerEnabled !== undefined ? { sequencerEnabled: !!raw.sequencerEnabled } : {}),
    ...(Array.isArray(raw.customMacros) ? {
      customMacros: raw.customMacros.map(m => ({
        id: typeof m.id === 'string' ? m.id : `macro-${Date.now()}`,
        name: typeof m.name === 'string' ? m.name.slice(0, 50) : 'Neues Makro',
        color: typeof m.color === 'string' && /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#f59e0b',
        value: clamp(Number(m.value ?? 0.5), 0, 1),
        targets: Array.isArray(m.targets) ? m.targets.map(t => {
          const targetObj: CustomMacroTarget = {
            id: typeof t.id === 'string' ? t.id : `t-${Date.now()}`,
            param: typeof t.param === 'string' ? t.param : 'macro:space',
            min: clamp(Number(t.min ?? 0), -100, 100),
            max: clamp(Number(t.max ?? 1), -100, 100),
          };
          if (typeof t.label === 'string' && t.label.trim()) {
            targetObj.label = t.label.slice(0, 60);
          }
          if (t.inverted) {
            targetObj.inverted = true;
          }
          return targetObj;
        }) : []
      }))
    } : { customMacros: clone(INITIAL_CUSTOM_MACROS) }),
    ...(raw.effectChain && typeof raw.effectChain === 'object' ? {
      effectChain: {
        mode: (['parallel', 'delay-into-reverb', 'reverb-into-delay'] as const).includes(raw.effectChain.mode) ? raw.effectChain.mode : 'parallel',
        modules: Array.isArray(raw.effectChain.modules) ? raw.effectChain.modules.map(mod => ({
          id: (['eq', 'warmth', 'flutter', 'delay', 'reverb', 'pump'] as const).includes(mod.id) ? mod.id : 'delay',
          name: typeof mod.name === 'string' ? mod.name : mod.id,
          bypassed: !!mod.bypassed
        })) : DEFAULT_EFFECT_MODULES
      }
    } : { effectChain: { mode: 'parallel', modules: DEFAULT_EFFECT_MODULES } }),
    ...(Array.isArray(raw.workspaceModules) ? {
      workspaceModules: raw.workspaceModules.map(String)
    } : { workspaceModules: DEFAULT_WORKSPACE_MODULES }),
    macros, layers: base.layers.map(l => normalizeLayer(raw.layers?.find(r => r.id === l.id) || l, l)),
    changes: Array.isArray(raw.changes) ? raw.changes.filter(c => c && typeof c.label === 'string' && typeof c.beat === 'number' && Number.isFinite(c.beat)).slice(-30) : [],
    deepMindChannel: Math.round(clamp(raw.deepMindChannel ?? 1, 1, 16)) };
}
export function migrateSession(raw: unknown): JamSession {
  if (!raw || typeof raw !== 'object') throw new Error('Keine gültige Sessiondatei.');
  const r = raw as Record<string, unknown>;
  if (r.version === 2 && Array.isArray(r.layers)) return validateSession(r as unknown as JamSession);
  if (typeof r.bpm === 'number' && Array.isArray(r.layers) && r.ambientParams && typeof r.ambientParams === 'object') {
    const ambient = r.ambientParams as Partial<AmbientSynthParams>; const session = createSession();
    session.name = typeof r.name === 'string' ? r.name : 'Importierte ECHO GARDEN Session'; session.bpm = r.bpm;
    session.root = ambient.rootNote ?? 50; session.scale = ambient.scale || 'dorian'; session.seed = typeof r.seed === 'number' ? r.seed : session.seed;
    session.swing = typeof r.swing === 'number' ? r.swing : 0; session.evolving = !!r.globalEvolveActive; session.lowResource = !!r.lowResourceMode;
    for (const old of r.layers as Array<Record<string, unknown>>) {
      const layer = session.layers.find(l => old.type === 'drum' ? l.drumVoice === old.drumVoice : l.role === 'drone'); if (!layer) continue;
      if (typeof old.volume === 'number') layer.volume = old.volume; layer.muted = !!old.muted; layer.solo = !!old.solo; layer.locked = !!old.locked;
      if (typeof old.midiChannel === 'number') layer.channel = old.midiChannel;
      if (layer.role === 'drone') { const { rootNote: _root, scale: _scale, ...patch } = ambient; layer.settings.audioPatch = sanitizeAudioPatch(patch); if (old.algorithmType === 'granularDrift') layer.settings.ambientAlgorithm = 'granularDrift'; }
      if (layer.drumVoice && r.drumParams && typeof r.drumParams === 'object') { const patch = (r.drumParams as Record<string, unknown>)[layer.drumVoice]; if (patch) layer.settings.drumPatch = sanitizeDrumPatch(patch, layer.drumVoice); }
    }
    if (r.effectsParams) session.effectsPatch = sanitizeEffectsPatch(r.effectsParams);
    if (r.modRoutes) session.modRoutes = sanitizeModRoutes(r.modRoutes);
    return validateSession(session);
  }
  throw new Error('Unbekanntes Sessionformat. Erwartet instajammable v2 oder ein ECHO GARDEN Projekt.');
}
