import type { AtmosphereSettings, FlowSettings, JamLayer, JamSession, MacroName, SceneDefinition } from '../../types/jam';
/**
 * Scene catalogue. To add a scene: append one entry here and, if it needs its own character,
 * one entry in SCENE_TUNING below. Everything else (UI list, preview, validation) picks it up.
 */
export const SCENES: SceneDefinition[] = [
  { id: 'dorian-dawn', name: 'Dorian Dawn', description: 'Warm, open chords. Quiet motifs. Room for your keys.', style: 'ambient', bpm: 78, root: 50, scale: 'dorian', mood: 'Ambient' },
  { id: 'tidal-glass', name: 'Tidal Glass', description: 'Luminous suspended harmony and bell-like fragments.', style: 'ambient', bpm: 72, root: 48, scale: 'lydian', mood: 'Ambient' },
  { id: 'night-orbit', name: 'Night Orbit', description: 'Low drones, minor harmony and a slow pulse.', style: 'ambient', bpm: 66, root: 45, scale: 'aeolian', mood: 'Ambient' },
  { id: 'moss-pulse', name: 'Moss Pulse', description: 'A repeating organic groove underneath moving pads.', style: 'ambient', bpm: 92, root: 55, scale: 'dorian', mood: 'Groove' },
  { id: 'ultimae-drift', name: 'Ultimae Drift', description: 'Deep, wide pads over a slow half-time pulse. Bells drift on top.', style: 'ambient', bpm: 84, root: 45, scale: 'aeolian', mood: 'Ultimae' },
  { id: 'still-water', name: 'Still Water', description: 'No drums. A held root, slow chords and long silences.', style: 'ambient', bpm: 56, root: 48, scale: 'lydian', mood: 'Calm' },
  { id: 'rain-window', name: 'Rain Window', description: 'Soft minor harmony under steady rain. Nothing hurries.', style: 'ambient', bpm: 62, root: 43, scale: 'aeolian', mood: 'Calm' },
  { id: 'deep-dub', name: 'Deep Dub', description: 'Slow deep techno: sub kick, chord stabs and long tape echoes.', style: 'techno', bpm: 116, root: 45, scale: 'dorian', mood: 'Deep Techno' },
  { id: 'night-rumble', name: 'Night Rumble', description: 'Heavy, hypnotic and sparse. A phrygian bass under dark wash.', style: 'techno', bpm: 108, root: 43, scale: 'phrygian', mood: 'Deep Techno' },
  { id: 'dusty-keys', name: 'Dusty Keys', description: 'Seventh chords, soft bass and a relaxed backbeat.', style: 'lofi', bpm: 82, root: 50, scale: 'dorian', mood: 'Lo-Fi' },
  { id: 'late-train', name: 'Late Train', description: 'Minor keys and a hypnotic, lightly swung groove.', style: 'lofi', bpm: 74, root: 48, scale: 'aeolian', mood: 'Lo-Fi' },
  { id: 'blue-hour', name: 'Blue Hour', description: 'Atmospheric lo-fi that breathes with the kick and shifts gently every few bars.', style: 'lofi', bpm: 78, root: 50, scale: 'dorian', mood: 'Lo-Fi · Flow' },
  { id: 'streamlight', name: 'Streamlight', description: 'Rainy lo-fi made for long improvised sessions. Slow, easy transitions.', style: 'lofi', bpm: 70, root: 46, scale: 'aeolian', mood: 'Lo-Fi · Flow' },
  { id: 'cbl-hydroponic', name: 'Hydroponic Drift', description: 'Carbon Based Lifeforms vibes. Rolling sub, 7/8 polymetric shakers and lush pads.', style: 'ambient', bpm: 86, root: 50, scale: 'dorian', mood: 'Psybient · CBL' },
  { id: 'cbl-interloper', name: 'Interloper Sky', description: 'Deep psybient downtempo. Resonant 303 warm bass, bell arps and wide tape delays.', style: 'ambient', bpm: 90, root: 45, scale: 'aeolian', mood: 'Psybient · CBL' },
  { id: 'symphonic-dawn', name: 'Symphonic Strings', description: 'Großes Streichorchester mit weitem Kathedralen-Hall und sanft atmender Atmosphäre.', style: 'ambient', bpm: 72, root: 50, scale: 'dorian', mood: 'Orchestral' },
  { id: 'cbl-carbon-oasis', name: 'Carbon Oasis', description: 'CBL Psybient: polymetrische Shaker, warmer 303-Subbass und schwebende Wash-Pads in endlosen Delays.', style: 'ambient', bpm: 88, root: 50, scale: 'dorian', mood: 'Psybient · CBL' },
  { id: 'nils-felt-hall', name: 'Nordic Felt Hall', description: 'Nils Frahm Ästhetik: Gefilzte Klaviertöne, weiter Kathedralen-Raum, sanfter Regen und warmer Kontrabass.', style: 'ambient', bpm: 68, root: 48, scale: 'aeolian', mood: 'Neo-Classical' },
  { id: 'solar-fields-orbit', name: 'Solar Fields Orbit', description: 'Ultimae Downtempo: 16tel Sub-Arpeggio, luminöse Glas-Flächen und weite Stereo-Echos.', style: 'ambient', bpm: 94, root: 45, scale: 'lydian', mood: 'Psybient · Ultimae' },
  { id: 'berlin-dub-techno', name: 'Berlin 4AM Dub', description: 'Hypnotischer Dub-Techno: Sub-schwere 909-Kick, gefilterte Moll-Akkorde und analoges Bandmaschinen-Echo.', style: 'techno', bpm: 114, root: 43, scale: 'dorian', mood: 'Deep Techno' },
  { id: 'jon-hopkins-pulse', name: 'Singularity Pulse', description: 'Jon Hopkins Inspiration: Lebendige mikrotonale Glockenmuster, warmer Bass-Puls und subtile analoge Sättigung.', style: 'ambient', bpm: 84, root: 46, scale: 'aeolian', mood: 'Organic IDM' },
  { id: 'eno-apollo-zero', name: 'Apollo Zero Gravity', description: 'Brian Eno Space Ambient: Unendlicher Hall, schwebende Lydische Harmonien, keine Drums, vollkommene Schwerelosigkeit.', style: 'ambient', bpm: 52, root: 52, scale: 'lydian', mood: 'Deep Space' },
  { id: 'tokyo-midnight-rain', name: 'Tokyo Midnight Rain', description: 'Entspannter Lo-Fi Flow: Rhodes mit Vinyl-Knistern, Regen am Fenster, sanft geswungene Drums und warmer Bass.', style: 'lofi', bpm: 72, root: 50, scale: 'dorian', mood: 'Lo-Fi Chill' },
  { id: 'cathedral-adagio', name: 'Cathedral Adagio', description: 'Großes Streicher-Adagio: butterweicher Bogenstrich, sakrale Weite (8.5s Hall), warmer Cellobass und reine Streicherwolken.', style: 'ambient', bpm: 62, root: 45, scale: 'aeolian', mood: 'Orchestral' },
];
const COLORS = ['#9bbba7', '#e4be76', '#9dadd5', '#d39cac', '#db9d76', '#c8be93', '#93c2c6', '#b2a5cf'];

interface LayerTuning {
  volume?: number;
  density?: number;
  muted?: boolean;
  timbre?: JamLayer['settings']['timbre'];
  velocityMax?: number;
  humanizeMs?: number;
  drumPatch?: JamLayer['settings']['drumPatch'];
  rhythmAlgorithm?: JamLayer['settings']['rhythmAlgorithm'];
  chordPattern?: JamLayer['settings']['chordPattern'];
  chordPace?: JamLayer['settings']['chordPace'];
  chordTexture?: JamLayer['settings']['chordTexture'];
}
interface Tuning {
  macros?: Partial<Record<MacroName, number>>; swing?: number; atmosphere?: AtmosphereSettings; pump?: number; flow?: FlowSettings;
  layers?: Partial<Record<string, LayerTuning>>;
}
const NO_DRUMS: Tuning['layers'] = { kick: { muted: true }, snare: { muted: true }, hihat: { muted: true }, perc: { muted: true } };
const bed = (kind: AtmosphereSettings['kind'], level: number, tone = 0.5, movement = 0.4): AtmosphereSettings => {
  const cap = 0.10;
  return { kind, level: Math.min(cap, level), tone, movement };
};
const SCENE_TUNING: Record<string, Tuning> = {
  'symphonic-dawn': {
    atmosphere: bed('air', 0.07, 0.58, 0.45),
    macros: { space: 0.88, warmth: 0.68, movement: 0.36, density: 0.44 },
    layers: {
      drone: { timbre: 'root', volume: 0.48 },
      chords: { timbre: 'strings', volume: 0.58, density: 0.82, chordPattern: 'wave', chordPace: '4-bars', chordTexture: 'octave' },
      melody: { timbre: 'glass', volume: 0.35, density: 0.28 },
      kick: { volume: 0.30, density: 0.38 },
      snare: { volume: 0.18, density: 0.35 },
      hihat: { volume: 0.22, density: 0.42 },
      perc: { volume: 0.28, density: 0.36 },
    }
  },
  'dorian-dawn': {
    atmosphere: bed('tape', 0.06, 0.45),
    layers: {
      drone: { timbre: 'root' },
      chords: { timbre: 'solina', chordPattern: 'pad', chordPace: '2-bars', chordTexture: 'shimmer' }
    }
  },
  'tidal-glass': {
    atmosphere: bed('air', 0.06, 0.6, 0.55),
    macros: { space: 0.78, warmth: 0.46 },
    layers: {
      drone: { timbre: 'root' },
      chords: { timbre: 'shimmer', chordPattern: 'wave', chordPace: '4-bars', chordTexture: 'shimmer' },
      melody: { density: 0.3 }
    }
  },
  'night-orbit': {
    atmosphere: bed('air', 0.05, 0.35, 0.3),
    layers: {
      drone: { timbre: 'root' },
      chords: { timbre: 'wash', chordPattern: 'pad', chordPace: '4-bars' }
    }
  },
  'moss-pulse': {
    atmosphere: bed('tape', 0.05, 0.5),
    pump: 0.2,
    flow: { enabled: true, bars: 16, depth: 0.5 },
    layers: {
      drone: { timbre: 'root' },
      chords: { timbre: 'wash', chordPattern: 'pulse', chordTexture: 'sub5th' }
    }
  },
  'ultimae-drift': {
    atmosphere: bed('air', 0.06, 0.52, 0.50),
    pump: 0.22,
    macros: { space: 0.84, warmth: 0.68, movement: 0.46, density: 0.48 },
    flow: { enabled: true, bars: 16, depth: 0.55 },
    layers: {
      drone: { timbre: 'root', volume: 0.6 },
      chords: { timbre: 'solina', volume: 0.56, density: 0.82, chordPattern: 'pulse', chordPace: '2-bars', chordTexture: 'shimmer' },
      bass: { volume: 0.62, density: 0.58 },
      melody: { timbre: 'bell', density: 0.42 },
      kick: { volume: 0.38, density: 0.55 },
      snare: { volume: 0.24, density: 0.5 },
      hihat: { volume: 0.24, density: 0.45 },
      perc: { volume: 0.36, density: 0.45 }
    }
  },
  'still-water': {
    atmosphere: bed('air', 0.05, 0.4, 0.35),
    macros: { space: 0.85, warmth: 0.5, movement: 0.25, density: 0.3 },
    layers: {
      ...NO_DRUMS,
      drone: { timbre: 'root', volume: 0.62 },
      chords: { timbre: 'wash', volume: 0.5, chordPattern: 'wave', chordPace: '4-bars', chordTexture: 'shimmer' },
      bass: { volume: 0.3, density: 0.3 },
      melody: { timbre: 'celeste', density: 0.22 }
    }
  },
  'rain-window': {
    atmosphere: bed('rain', 0.07, 0.55, 0.3),
    macros: { space: 0.78, warmth: 0.65, movement: 0.28, density: 0.32 },
    layers: {
      ...NO_DRUMS,
      drone: { timbre: 'root', volume: 0.5 },
      chords: { timbre: 'keys', volume: 0.52, chordPattern: 'broken', chordPace: '2-bars', chordTexture: 'octave' },
      bass: { volume: 0.3, density: 0.3 },
      melody: { timbre: 'celeste', density: 0.28, velocityMax: 70 }
    }
  },
  'deep-dub': {
    swing: 0.1,
    atmosphere: bed('tape', 0.06, 0.5, 0.35),
    pump: 0.42,
    macros: { space: 0.7, warmth: 0.62, movement: 0.42, density: 0.6 },
    flow: { enabled: true, bars: 16, depth: 0.6 },
    layers: {
      drone: { timbre: 'root', volume: 0.36, density: 0.8 },
      chords: { timbre: 'dub', volume: 0.6, density: 0.85, chordPattern: 'syncopated' },
      bass: { timbre: 'warm', volume: 0.70, density: 0.9 },
      melody: { timbre: 'bell', volume: 0.4, density: 0.26 },
      kick: { volume: 0.9, density: 0.95, drumPatch: { pitch: 46, decay: 0.55, tone: 0.1, drive: 0.12 } },
      snare: { volume: 0.4, density: 0.55, drumPatch: { decay: 0.2, tone: 0.18 } },
      hihat: { volume: 0.34, density: 0.7, drumPatch: { tone: 0.0, decay: 0.05 } },
      perc: { volume: 0.44, density: 0.55, drumPatch: { pitch: 48, decay: 0.16 } }
    }
  },
  'night-rumble': {
    swing: 0.06,
    atmosphere: bed('air', 0.05, 0.3, 0.4),
    pump: 0.5,
    macros: { space: 0.76, warmth: 0.7, movement: 0.35, density: 0.5 },
    flow: { enabled: true, bars: 32, depth: 0.6 },
    layers: {
      drone: { timbre: 'root', volume: 0.5, density: 0.9 },
      chords: { timbre: 'dub', volume: 0.48, density: 0.5, chordPattern: 'syncopated', chordPace: '4-bars' },
      bass: { timbre: 'warm', volume: 0.75, density: 0.95 },
      melody: { muted: true },
      kick: { volume: 0.95, density: 1, drumPatch: { pitch: 42, decay: 0.7, tone: 0.06, drive: 0.18 } },
      snare: { volume: 0.3, density: 0.3, drumPatch: { decay: 0.24, tone: 0.12 } },
      hihat: { volume: 0.26, density: 0.45, drumPatch: { tone: 0.0, decay: 0.05 } },
      perc: { volume: 0.32, density: 0.4, drumPatch: { pitch: 44, decay: 0.2 } }
    }
  },
  'dusty-keys': {
    atmosphere: bed('vinyl', 0.04, 0.55, 0.3),
    pump: 0.28,
    swing: 0.38,
    macros: { space: 0.55, warmth: 0.78, movement: 0.42, density: 0.62 },
    flow: { enabled: true, bars: 8, depth: 0.55 },
    layers: {
      chords: { timbre: 'keys', volume: 0.64, density: 0.85, chordPattern: 'broken', chordPace: '2-bars' },
      bass: { timbre: 'warm', volume: 0.82, density: 0.88 },
      kick: { volume: 0.88, density: 0.75 },
      snare: { volume: 0.68, density: 0.55 },
      hihat: { volume: 0.36, density: 0.65 },
      perc: { volume: 0.32, density: 0.45 }
    }
  },
  'late-train': {
    atmosphere: bed('vinyl', 0.04, 0.5, 0.3),
    pump: 0.26,
    swing: 0.36,
    macros: { space: 0.58, warmth: 0.76, movement: 0.45, density: 0.60 },
    flow: { enabled: true, bars: 8, depth: 0.55 },
    layers: {
      chords: { timbre: 'keys', volume: 0.62, density: 0.82, chordPattern: 'syncopated', chordPace: '2-bars' },
      bass: { timbre: 'warm', volume: 0.80, density: 0.85 },
      kick: { volume: 0.86, density: 0.72 },
      snare: { volume: 0.66, density: 0.54 },
      hihat: { volume: 0.36, density: 0.62 }
    }
  },
  'blue-hour': {
    swing: 0.4,
    atmosphere: bed('vinyl', 0.05, 0.5, 0.45),
    pump: 0.28,
    macros: { space: 0.60, warmth: 0.75, movement: 0.5, density: 0.58 },
    flow: { enabled: true, bars: 8, depth: 0.6 },
    layers: {
      drone: { timbre: 'root', volume: 0.3, density: 0.9 },
      chords: { timbre: 'keys', volume: 0.64, chordPattern: 'wave', chordPace: '2-bars', chordTexture: 'octave' },
      bass: { timbre: 'warm', volume: 0.82, density: 0.88 },
      melody: { timbre: 'celeste', density: 0.38 },
      kick: { volume: 0.88, density: 0.74 },
      snare: { volume: 0.66, density: 0.52 },
      hihat: { volume: 0.36 }
    }
  },
  'streamlight': {
    swing: 0.34,
    atmosphere: bed('rain', 0.06, 0.5, 0.4),
    pump: 0.24,
    macros: { space: 0.62, warmth: 0.76, movement: 0.45, density: 0.54 },
    flow: { enabled: true, bars: 8, depth: 0.55 },
    layers: {
      drone: { timbre: 'root', volume: 0.28, density: 0.9 },
      chords: { timbre: 'celeste', volume: 0.60, chordPattern: 'wave', chordPace: '2-bars', chordTexture: 'shimmer' },
      bass: { timbre: 'warm', volume: 0.78, density: 0.82 },
      melody: { timbre: 'keys', density: 0.36 },
      kick: { volume: 0.84, density: 0.70 },
      snare: { volume: 0.64, density: 0.50 },
      perc: { volume: 0.26 }
    }
  },
  'cbl-hydroponic': {
    swing: 0.14,
    atmosphere: bed('air', 0.06, 0.52, 0.45),
    pump: 0.24,
    macros: { space: 0.76, warmth: 0.68, movement: 0.48, density: 0.50 },
    flow: { enabled: true, bars: 16, depth: 0.5 },
    layers: {
      drone: { timbre: 'root', volume: 0.52 },
      chords: { timbre: 'shimmer', volume: 0.56, density: 0.82, chordPattern: 'pulse', chordPace: '2-bars', chordTexture: 'shimmer' },
      bass: { timbre: 'warm', volume: 0.70, density: 0.88 },
      melody: { timbre: 'bell', density: 0.38 },
      hihat: { volume: 0.36, density: 0.58 },
      perc: { volume: 0.35, density: 0.52 }
    }
  },
  'cbl-interloper': {
    swing: 0.12,
    atmosphere: bed('tape', 0.06, 0.48, 0.5),
    pump: 0.22,
    macros: { space: 0.78, warmth: 0.70, movement: 0.52, density: 0.54 },
    flow: { enabled: true, bars: 16, depth: 0.55 },
    layers: {
      drone: { timbre: 'root', volume: 0.48 },
      chords: { timbre: 'solina', volume: 0.55, density: 0.78, chordPattern: 'pulse', chordPace: '2-bars', chordTexture: 'sub5th' },
      bass: { timbre: 'warm', volume: 0.72, density: 0.90 },
      melody: { timbre: 'glass', density: 0.4 },
      kick: { volume: 0.80, density: 0.65 },
      snare: { volume: 0.34, density: 0.4 },
      hihat: { volume: 0.36, density: 0.6 },
      perc: { volume: 0.40, density: 0.52 }
    }
  },
  'cbl-carbon-oasis': {
    swing: 0.12,
    atmosphere: bed('tape', 0.06, 0.48, 0.50),
    pump: 0.22,
    flow: { enabled: true, bars: 16, depth: 0.55 },
    macros: { space: 0.80, warmth: 0.72, movement: 0.48, density: 0.52 },
    layers: {
      drone: { timbre: 'root', volume: 0.48, density: 0.85 },
      chords: { timbre: 'solina', volume: 0.56, density: 0.82, chordPattern: 'pulse', chordPace: '2-bars', chordTexture: 'shimmer' },
      bass: { timbre: 'warm', volume: 0.70, density: 0.90 },
      melody: { timbre: 'celeste', volume: 0.40, density: 0.38 },
      kick: { volume: 0.78, density: 0.62 },
      snare: { volume: 0.32, density: 0.40 },
      hihat: { volume: 0.36, density: 0.62, rhythmAlgorithm: 'polymetric' },
      perc: { volume: 0.38, density: 0.55, rhythmAlgorithm: 'densityBurst' }
    }
  },
  'nils-felt-hall': {
    atmosphere: bed('rain', 0.06, 0.55, 0.35),
    macros: { space: 0.88, warmth: 0.84, movement: 0.32, density: 0.38 },
    layers: {
      drone: { timbre: 'root', volume: 0.45 },
      chords: { timbre: 'celeste', volume: 0.62, density: 0.80, chordPattern: 'broken', chordPace: '2-bars', chordTexture: 'octave' },
      bass: { timbre: 'warm', volume: 0.50, density: 0.45 },
      melody: { timbre: 'keys', volume: 0.42, density: 0.32, velocityMax: 78 },
      kick: { muted: true, volume: 0.1 },
      snare: { muted: true, volume: 0.1 },
      hihat: { muted: true, volume: 0.1 },
      perc: { volume: 0.20, density: 0.25, rhythmAlgorithm: 'probabilistic' }
    }
  },
  'solar-fields-orbit': {
    atmosphere: bed('air', 0.06, 0.62, 0.52),
    pump: 0.25,
    flow: { enabled: true, bars: 16, depth: 0.5 },
    macros: { space: 0.84, warmth: 0.66, movement: 0.52, density: 0.54 },
    layers: {
      drone: { timbre: 'air', volume: 0.52 },
      chords: { timbre: 'glass', volume: 0.54, density: 0.78, chordPattern: 'cluster', chordPace: '2-bars', chordTexture: 'shimmer' },
      bass: { timbre: 'warm', volume: 0.72, density: 0.92 },
      melody: { timbre: 'celeste', volume: 0.38, density: 0.44 },
      kick: { volume: 0.82, density: 0.68 },
      snare: { volume: 0.34, density: 0.45 },
      hihat: { volume: 0.38, density: 0.68, rhythmAlgorithm: 'euclidean' },
      perc: { volume: 0.40, density: 0.58, rhythmAlgorithm: 'markov' }
    }
  },
  'berlin-dub-techno': {
    swing: 0.08,
    atmosphere: bed('tape', 0.06, 0.42, 0.38),
    pump: 0.48,
    flow: { enabled: true, bars: 16, depth: 0.62 },
    macros: { space: 0.74, warmth: 0.74, movement: 0.46, density: 0.62 },
    layers: {
      drone: { timbre: 'root', volume: 0.38, density: 0.85 },
      chords: { timbre: 'dub', volume: 0.64, density: 0.88, chordPattern: 'syncopated', chordPace: '2-bars' },
      bass: { timbre: 'warm', volume: 0.72, density: 0.94 },
      melody: { timbre: 'bell', volume: 0.32, density: 0.22 },
      kick: { volume: 0.94, density: 0.96, drumPatch: { pitch: 44, decay: 0.65, tone: 0.08, drive: 0.16 } },
      snare: { volume: 0.36, density: 0.52, drumPatch: { decay: 0.22, tone: 0.15 } },
      hihat: { volume: 0.36, density: 0.72, drumPatch: { tone: 0.0, decay: 0.06 } },
      perc: { volume: 0.42, density: 0.58, drumPatch: { pitch: 46, decay: 0.18 } }
    }
  },
  'jon-hopkins-pulse': {
    swing: 0.06,
    atmosphere: bed('tape', 0.05, 0.50, 0.45),
    pump: 0.28,
    flow: { enabled: true, bars: 16, depth: 0.5 },
    macros: { space: 0.78, warmth: 0.72, movement: 0.55, density: 0.56 },
    layers: {
      drone: { timbre: 'root', volume: 0.48 },
      chords: { timbre: 'shimmer', volume: 0.54, density: 0.80, chordPattern: 'cluster', chordPace: '2-bars', chordTexture: 'shimmer' },
      bass: { timbre: 'warm', volume: 0.68, density: 0.88 },
      melody: { timbre: 'celeste', volume: 0.44, density: 0.46 },
      kick: { volume: 0.84, density: 0.60 },
      snare: { volume: 0.36, density: 0.45 },
      hihat: { volume: 0.36, density: 0.64, rhythmAlgorithm: 'probabilistic' },
      perc: { volume: 0.44, density: 0.62, rhythmAlgorithm: 'densityBurst' }
    }
  },
  'eno-apollo-zero': {
    atmosphere: bed('air', 0.06, 0.65, 0.40),
    macros: { space: 0.95, warmth: 0.60, movement: 0.22, density: 0.28 },
    layers: {
      ...NO_DRUMS,
      drone: { timbre: 'air', volume: 0.65 },
      chords: { timbre: 'strings', volume: 0.62, density: 0.85, chordPattern: 'wave', chordPace: '4-bars', chordTexture: 'shimmer' },
      bass: { volume: 0.35, density: 0.30 },
      melody: { timbre: 'glass', volume: 0.32, density: 0.20 }
    }
  },
  'tokyo-midnight-rain': {
    swing: 0.38,
    atmosphere: bed('rain', 0.06, 0.52, 0.38),
    pump: 0.30,
    flow: { enabled: true, bars: 8, depth: 0.55 },
    macros: { space: 0.58, warmth: 0.80, movement: 0.44, density: 0.56 },
    layers: {
      drone: { timbre: 'root', volume: 0.28, density: 0.85 },
      chords: { timbre: 'keys', volume: 0.64, density: 0.84, chordPattern: 'broken', chordPace: '2-bars', chordTexture: 'shimmer' },
      bass: { timbre: 'warm', volume: 0.82, density: 0.88 },
      melody: { timbre: 'celeste', volume: 0.40, density: 0.34, velocityMax: 76 },
      kick: { volume: 0.88, density: 0.72 },
      snare: { volume: 0.68, density: 0.55 },
      hihat: { volume: 0.38, density: 0.60 },
      perc: { volume: 0.30, density: 0.40 }
    }
  },
  'cathedral-adagio': {
    atmosphere: bed('air', 0.06, 0.56, 0.42),
    macros: { space: 0.94, warmth: 0.75, movement: 0.32, density: 0.46 },
    layers: {
      ...NO_DRUMS,
      drone: { timbre: 'root', volume: 0.52 },
      chords: { timbre: 'solina', volume: 0.66, density: 0.90, chordPattern: 'wave', chordPace: '4-bars', chordTexture: 'octave' },
      bass: { timbre: 'warm', volume: 0.58, density: 0.45 },
      melody: { timbre: 'strings', volume: 0.40, density: 0.30 }
    }
  },
};
export function createSession(sceneId = 'dorian-dawn', seed = 142857): JamSession {
  const scene = SCENES.find(s => s.id === sceneId) || SCENES[0]; const lofi = scene.style === 'lofi'; const root = scene.root; const tuning = SCENE_TUNING[scene.id] || {};
  const definitions: Array<[string, string, JamLayer['role'], number, number, number, number, JamLayer['settings']['timbre']]> = [
    ['drone', 'Texture', 'drone', 1, root - 12, root + 12, lofi ? 0.14 : 0.58, scene.id === 'tidal-glass' ? 'air' : 'warm'],
    ['chords', 'Chords', 'chords', 1, root, root + 25, lofi ? 0.63 : 0.48, lofi ? 'keys' : 'warm'],
    ['bass', 'Bass', 'bass', 3, root - 24, root - 8, lofi ? 0.7 : 0.4, 'warm'],
    ['melody', 'Melody', 'melody', 2, root + 12, root + 31, lofi ? 0.42 : 0.3, scene.id === 'tidal-glass' ? 'bell' : 'keys'],
    ['kick', 'Kick', 'drum', 10, 36, 36, lofi ? 0.8 : 0.23, 'warm'],
    ['snare', 'Snare / Rim', 'drum', 10, 38, 38, lofi ? 0.63 : 0.16, 'warm'],
    ['hihat', 'Hi-hat', 'drum', 10, 42, 42, lofi ? 0.42 : 0.17, 'warm'],
    ['perc', 'Percussion', 'drum', 10, 37, 37, lofi ? 0.28 : 0.31, 'bell'],
  ];
  const layers = definitions.map(([id, name, role, channel, minNote, maxNote, volume, timbre], index): JamLayer => ({
    id, name, role, channel, color: COLORS[index], volume, muted: scene.id === 'night-orbit' && role === 'drum', solo: false,
    locked: false, frozen: false, outputId: null, ...(role === 'drum' ? { drumVoice: id as JamLayer['drumVoice'] } : {}),
    settings: {
      density: role === 'drone' ? 0.86 : role === 'chords' ? 0.84 : role === 'bass' ? (lofi ? 0.8 : 0.44) : role === 'melody' ? 0.36 : (lofi ? 0.74 : 0.34),
      minNote, maxNote, phraseBars: role === 'drone' || role === 'chords' ? (lofi ? 2 : 4) : 4,
      humanizeMs: role === 'drum' ? (lofi ? 9 : 4) : role === 'melody' ? 8 : 0,
      velocityMin: role === 'drum' ? 42 : 44, velocityMax: role === 'drum' ? 99 : 83, timbre,
    },
  }));
  if (scene.id === 'moss-pulse') layers.filter(l => l.role === 'drum').forEach(l => { l.volume *= 1.65; l.settings.density = 0.66; });
  if (scene.id === 'tidal-glass') { layers[1].settings.timbre = 'air'; layers[3].settings.density = 0.24; }
  if (scene.id === 'cbl-hydroponic') { const h = layers.find(l => l.id === 'hihat'); if (h) h.settings.rhythmAlgorithm = 'polymetric'; const p = layers.find(l => l.id === 'perc'); if (p) p.settings.rhythmAlgorithm = 'densityBurst'; }
  if (scene.id === 'cbl-interloper') { const h = layers.find(l => l.id === 'hihat'); if (h) h.settings.rhythmAlgorithm = 'euclidean'; const p = layers.find(l => l.id === 'perc'); if (p) p.settings.rhythmAlgorithm = 'markov'; }
  for (const layer of layers) {
    const t = tuning.layers?.[layer.id]; if (!t) continue;
    if (t.volume !== undefined) layer.volume = t.volume; if (t.muted !== undefined) layer.muted = t.muted;
    if (t.density !== undefined) layer.settings.density = t.density; if (t.timbre) layer.settings.timbre = t.timbre;
    if (t.velocityMax !== undefined) layer.settings.velocityMax = t.velocityMax; if (t.humanizeMs !== undefined) layer.settings.humanizeMs = t.humanizeMs;
    if (t.drumPatch) layer.settings.drumPatch = { ...t.drumPatch };
    if (t.rhythmAlgorithm) layer.settings.rhythmAlgorithm = t.rhythmAlgorithm;
    if (t.chordPattern) layer.settings.chordPattern = t.chordPattern;
    if (t.chordPace) layer.settings.chordPace = t.chordPace;
    if (t.chordTexture) layer.settings.chordTexture = t.chordTexture;
  }
  const macros = { movement: lofi ? 0.42 : 0.35, density: lofi ? 0.6 : 0.4, warmth: 0.62, space: lofi ? 0.32 : 0.65, ...tuning.macros };
  return {
    version: 2, id: `jam-${scene.id}`, name: scene.name, sceneId: scene.id, style: scene.style, root, scale: scene.scale,
    bpm: scene.bpm, swing: tuning.swing ?? (lofi ? 0.36 : 0.08), seed: seed >>> 0, evolving: true, outputMode: 'internal', volume: 0.78,
    lowResource: false, deepMindEnabled: false, deepMindChannel: 1, pinned: ['movement', 'density', 'warmth', 'space'],
    macros, layers, changes: [],
    ...(tuning.atmosphere ? { atmosphere: { ...tuning.atmosphere } } : {}), ...(tuning.pump ? { pump: tuning.pump } : {}),
    ...(tuning.flow ? { flow: { ...tuning.flow } } : {}),
  };
}
