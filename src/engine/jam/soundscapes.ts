import type { AtmosphereSettings, ChordPattern, MacroName, Timbre } from '../../types/jam';
import type { EffectsParams } from '../../types';

export interface SoundscapePreset {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  chordTimbre: Timbre;
  secondaryTimbre?: Timbre;
  secondaryVolume?: number;
  secondaryPattern?: ChordPattern;
  hallAmount: number; // 0..1 (boosts space, reverbDecay and reverbMix)
  atmosphere: AtmosphereSettings;
  effects?: Partial<EffectsParams>;
  macros?: Partial<Record<MacroName, number>>;
  tags: string[];
}

export const SOUNDSCAPE_PRESETS: SoundscapePreset[] = [
  {
    id: 'symphonic-strings',
    name: 'Großes Streichorchester',
    subtitle: 'Symphonischer Bogenstrich & Kathedralen-Hall',
    description: 'Vielstimmiges Streicherensemble (Chord A) gepaart mit ätherischer Shimmer-Obertonwolke (Chord B) im großen Konzertsaal-Hall.',
    chordTimbre: 'strings',
    secondaryTimbre: 'shimmer',
    secondaryVolume: 0.56,
    secondaryPattern: 'wave',
    hallAmount: 0.90,
    atmosphere: { kind: 'air', level: 0.06, tone: 0.58, movement: 0.48 },
    macros: { space: 0.88, warmth: 0.68, density: 0.44, movement: 0.36 },
    effects: { reverbSize: 0.95, reverbDecay: 7.8, reverbMix: 0.52, reverbDamping: 0.46 },
    tags: ['Orchester', 'Dual-Pad', 'Viel Hall', 'Atmosphärisch']
  },
  {
    id: 'cbl-wash',
    name: 'CBL Hydroponic Horizon',
    subtitle: 'Carbon Based Lifeforms Dual-Pad & Tape-Delay',
    description: 'Schwebendes CBL-Wash-Pad (Chord A) verwoben mit 70s Solina String-Machine (Chord B) und getapptem Analog-Delay.',
    chordTimbre: 'wash',
    secondaryTimbre: 'solina',
    secondaryVolume: 0.58,
    secondaryPattern: 'broken',
    hallAmount: 0.82,
    atmosphere: { kind: 'tape', level: 0.05, tone: 0.50, movement: 0.45 },
    macros: { space: 0.82, warmth: 0.68, density: 0.48, movement: 0.45 },
    effects: { reverbSize: 0.86, reverbDecay: 6.4, reverbMix: 0.44, delayFeedback: 0.54, delayFlutter: 0.14 },
    tags: ['CBL', 'Psybient', 'Dual-Chord', 'Ultimae']
  },
  {
    id: 's1gns-nebula',
    name: 'S1gns Of L1fe Nebula',
    subtitle: 'Ätherischer Shimmer-Schleier & Deep Space',
    description: 'Feinste kristalline Shimmer-Fläche (Chord A) mit atmendem Air-Chor (Chord B) in unendlicher kosmischer Weite.',
    chordTimbre: 'shimmer',
    secondaryTimbre: 'air',
    secondaryVolume: 0.62,
    secondaryPattern: 'wave',
    hallAmount: 0.94,
    atmosphere: { kind: 'air', level: 0.05, tone: 0.64, movement: 0.46 },
    macros: { space: 0.92, warmth: 0.58, density: 0.40, movement: 0.42 },
    effects: { reverbSize: 0.96, reverbDecay: 8.8, reverbMix: 0.54, delayFeedback: 0.52 },
    tags: ['S1gns Of L1fe', 'Ätherisch', 'Shimmer', 'Space Ambient']
  },
  {
    id: 'asura-monolith',
    name: 'Asura Power Monolith',
    subtitle: 'Mächtige Quint-Drones & Solina-Ensemble',
    description: 'Dronig-mächtiges Analog-Fundament (Root + Solina) mit reinen Quinten, tiefem Sub-Druck und majestätischem Dom-Raum.',
    chordTimbre: 'solina',
    secondaryTimbre: 'root',
    secondaryVolume: 0.65,
    secondaryPattern: 'pad',
    hallAmount: 0.86,
    atmosphere: { kind: 'tape', level: 0.06, tone: 0.44, movement: 0.40 },
    macros: { space: 0.85, warmth: 0.76, density: 0.52, movement: 0.34 },
    effects: { reverbSize: 0.90, reverbDecay: 7.2, reverbMix: 0.46, masterDrive: 0.14 },
    tags: ['Asura', 'Dronig & Mächtig', 'Solina', 'Deep']
  },
  {
    id: 'crystal-glass',
    name: 'Kristalliner Glas-Raum',
    subtitle: 'Luminöse Obertöne & Celeste-Tropfen',
    description: 'Schimmernde Glasharmonik (Chord A) mit zarten Filz-Celeste-Arpeggien (Chord B) für lichtdurchflutete Ambient-Welten.',
    chordTimbre: 'glass',
    secondaryTimbre: 'celeste',
    secondaryVolume: 0.52,
    secondaryPattern: 'broken',
    hallAmount: 0.86,
    atmosphere: { kind: 'air', level: 0.05, tone: 0.66, movement: 0.40 },
    macros: { space: 0.86, warmth: 0.50, density: 0.38, movement: 0.40 },
    effects: { reverbSize: 0.90, reverbDecay: 7.5, reverbMix: 0.48 },
    tags: ['Kristallin', 'Spotify Ambient', 'Celeste', 'Fein']
  },
  {
    id: 'solina-vintage',
    name: 'Cell · Vintage Solina Strings',
    subtitle: 'Eminent 310 Schmelz & Warmer Analog-Teppich',
    description: 'Klassische 70s String-Machine (Chord A) mit warmem Juno-Pad (Chord B), sanfter Bandsättigung und seidigem Höhen-Roll-Off.',
    chordTimbre: 'solina',
    secondaryTimbre: 'warm',
    secondaryVolume: 0.55,
    secondaryPattern: 'wave',
    hallAmount: 0.74,
    atmosphere: { kind: 'vinyl', level: 0.05, tone: 0.45, movement: 0.35 },
    macros: { space: 0.74, warmth: 0.80, density: 0.50, movement: 0.34 },
    effects: { reverbSize: 0.80, reverbDecay: 5.6, reverbMix: 0.40, masterDrive: 0.14 },
    tags: ['Cell', 'Solina', 'Tape', 'Warm']
  },
  {
    id: 'rainy-rhodes',
    name: 'Kupla & No Spirit · Cozy Keys',
    subtitle: 'Warmes Filz-Piano, Rhodes & Shimmer-Bett',
    description: 'Intime Chillhop-Septakkorde auf warmen Keys (Chord A), unterlegt von einem hauchzarten Celeste/Air-Teppich (Chord B) bei sanftem Fensterregen.',
    chordTimbre: 'keys',
    secondaryTimbre: 'celeste',
    secondaryVolume: 0.50,
    secondaryPattern: 'wave',
    hallAmount: 0.56,
    atmosphere: { kind: 'rain', level: 0.07, tone: 0.52, movement: 0.35 },
    macros: { space: 0.56, warmth: 0.76, density: 0.52, movement: 0.38 },
    effects: { reverbSize: 0.64, reverbDecay: 3.8, reverbMix: 0.32, delayFlutter: 0.16 },
    tags: ['Kupla', 'No Spirit', 'Chillhop', 'Cozy']
  },
  {
    id: 'aes-dana-dub',
    name: 'Aes Dana Dub Chamber',
    subtitle: 'Ultimae Dub-Chords & Schwebender Air-Pad-Hintergrund',
    description: 'Gefilterte Moll-Stabs (Chord A) in endlosen rhythmischen Tape-Echos, getragen von einer feinen Air-Fläche (Chord B).',
    chordTimbre: 'dub',
    secondaryTimbre: 'air',
    secondaryVolume: 0.54,
    secondaryPattern: 'pad',
    hallAmount: 0.78,
    atmosphere: { kind: 'tape', level: 0.06, tone: 0.40, movement: 0.42 },
    macros: { space: 0.78, warmth: 0.68, density: 0.56, movement: 0.42 },
    effects: { reverbSize: 0.86, reverbDecay: 5.8, reverbMix: 0.40, delayFeedback: 0.58 },
    tags: ['Aes Dana', 'Deep Dub', 'Echo', 'Ultimae']
  },
  {
    id: 'sacral-choir',
    name: 'Sakraler Chor & Kathedrale',
    subtitle: 'Großer Dom, Formant-Luft & Streicher-Halo',
    description: 'Sanfte vokale Formanten (Chord A) verschmelzen mit langsamen symphonischen Streichern (Chord B) zu einer erhabenen Kathedralen-Fläche.',
    chordTimbre: 'air',
    secondaryTimbre: 'strings',
    secondaryVolume: 0.58,
    secondaryPattern: 'cluster',
    hallAmount: 0.94,
    atmosphere: { kind: 'air', level: 0.06, tone: 0.60, movement: 0.48 },
    macros: { space: 0.92, warmth: 0.64, density: 0.36, movement: 0.42 },
    effects: { reverbSize: 0.98, reverbDecay: 8.8, reverbMix: 0.54 },
    tags: ['Chor', 'Sakral', 'Riesiger Hall', 'Meditativ']
  }
];

export function findSoundscapePreset(id: string): SoundscapePreset | undefined {
  return SOUNDSCAPE_PRESETS.find(p => p.id === id);
}
