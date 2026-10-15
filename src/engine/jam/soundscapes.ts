import type { AtmosphereSettings, MacroName, Timbre } from '../../types/jam';
import type { EffectsParams } from '../../types';

export interface SoundscapePreset {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  chordTimbre: Timbre;
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
    description: 'Vielstimmiges Streicherensemble mit weichem Bogen-Crescendo, breiter Stereobühne und großem Konzertsaal-Hall.',
    chordTimbre: 'strings',
    hallAmount: 0.9,
    atmosphere: { kind: 'air', level: 0.16, tone: 0.58, movement: 0.48 },
    macros: { space: 0.88, warmth: 0.68, density: 0.44, movement: 0.36 },
    effects: { reverbSize: 0.95, reverbDecay: 7.5, reverbMix: 0.52, reverbDamping: 0.48 },
    tags: ['Orchester', 'Streichorchester', 'Viel Hall', 'Atmosphärisch']
  },
  {
    id: 'cbl-wash',
    name: 'CBL Psybient Wash',
    subtitle: 'Carbon Based Lifeforms Modulating Pad',
    description: 'Schwebendes, dichtes Pad mit getapptem Tape-Delay und organischer analoger Bandtextur.',
    chordTimbre: 'wash',
    hallAmount: 0.78,
    atmosphere: { kind: 'tape', level: 0.14, tone: 0.50, movement: 0.45 },
    macros: { space: 0.78, warmth: 0.65, density: 0.48, movement: 0.45 },
    effects: { reverbSize: 0.82, reverbDecay: 5.8, reverbMix: 0.42, delayFeedback: 0.55 },
    tags: ['CBL', 'Psybient', 'Modulierend', 'Tape']
  },
  {
    id: 'crystal-glass',
    name: 'Kristalliner Glas-Raum',
    subtitle: 'Luminöse Obertöne & Äther',
    description: 'Schimmernde Glasharmonik mit langem Shimmer-Nachhall für kosmische Ambient-Klanglandschaften.',
    chordTimbre: 'glass',
    hallAmount: 0.84,
    atmosphere: { kind: 'air', level: 0.15, tone: 0.68, movement: 0.40 },
    macros: { space: 0.84, warmth: 0.45, density: 0.38, movement: 0.40 },
    effects: { reverbSize: 0.90, reverbDecay: 7.5, reverbMix: 0.46 },
    tags: ['Kristallin', 'Tidal Glass', 'Shimmer', 'Hell']
  },
  {
    id: 'solina-vintage',
    name: 'Vintage Solina Tape Strings',
    subtitle: 'Mellotron-Wärme & 70s Schmelz',
    description: 'Klassische String-Machine mit analoger Bandsättigung, sanfter Filterhüllkurve und dezenter Nadelgeräusch-Atmosphäre.',
    chordTimbre: 'strings',
    hallAmount: 0.65,
    atmosphere: { kind: 'vinyl', level: 0.12, tone: 0.45, movement: 0.35 },
    macros: { space: 0.65, warmth: 0.82, density: 0.50, movement: 0.32 },
    effects: { reverbSize: 0.75, reverbDecay: 4.8, reverbMix: 0.35, masterDrive: 0.18 },
    tags: ['Vintage', 'Solina', 'Tape', 'Warm']
  },
  {
    id: 'rainy-rhodes',
    name: 'Warme Lo-Fi Keys & Regen',
    subtitle: 'Neo-Soul & Fensterregen',
    description: 'Weiche Rhodes-Septakkorde mit warmem Raumhall unter leisem, gleichmäßigem Regen.',
    chordTimbre: 'keys',
    hallAmount: 0.48,
    atmosphere: { kind: 'rain', level: 0.18, tone: 0.52, movement: 0.35 },
    macros: { space: 0.48, warmth: 0.75, density: 0.52, movement: 0.38 },
    effects: { reverbSize: 0.55, reverbDecay: 3.2, reverbMix: 0.28 },
    tags: ['Lo-Fi', 'Rhodes', 'Regen', 'Cozy']
  },
  {
    id: 'aes-dana-dub',
    name: 'Aes Dana Dub Chamber',
    subtitle: 'Dunkler Hall & Tape-Echo',
    description: 'Gefilterte Moll-Stabs, die in endlosen rhythmischen Tape-Echos und dunklem Hall versinken.',
    chordTimbre: 'dub',
    hallAmount: 0.76,
    atmosphere: { kind: 'tape', level: 0.16, tone: 0.38, movement: 0.42 },
    macros: { space: 0.76, warmth: 0.68, density: 0.58, movement: 0.42 },
    effects: { reverbSize: 0.85, reverbDecay: 5.5, reverbMix: 0.38, delayFeedback: 0.60 },
    tags: ['Deep Dub', 'Aes Dana', 'Echo', 'Techno']
  },
  {
    id: 'sacral-choir',
    name: 'Sakraler Chor & Kathedrale',
    subtitle: 'Großer Dom & Gesangswolke',
    description: 'Sanfte vokale Formanten mit weicher Luftatmung, die sich zu einer schwebenden Kathedralen-Fläche entfalten.',
    chordTimbre: 'air',
    hallAmount: 0.92,
    atmosphere: { kind: 'air', level: 0.16, tone: 0.60, movement: 0.50 },
    macros: { space: 0.90, warmth: 0.62, density: 0.36, movement: 0.45 },
    effects: { reverbSize: 0.98, reverbDecay: 8.5, reverbMix: 0.54 },
    tags: ['Chor', 'Sakral', 'Riesiger Hall', 'Meditativ']
  }
];

export function findSoundscapePreset(id: string): SoundscapePreset | undefined {
  return SOUNDSCAPE_PRESETS.find(p => p.id === id);
}
