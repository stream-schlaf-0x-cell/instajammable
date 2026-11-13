import type { MacroName, SceneDefinition } from '../../types/jam';
import type { UiEdition } from '../../types/ui';

export interface MinimalSceneMeta {
  name: string;
  mood: string;
  description: string;
}

export const MINIMAL_SCENE_META: Record<string, MinimalSceneMeta> = {
  'dorian-dawn': {
    name: 'Amber Horizon',
    mood: 'Ambient · Warm Pad',
    description: 'Warm open chords with an airy shimmer halo and quiet melodic motifs.',
  },
  'tidal-glass': {
    name: 'Tidal Glass',
    mood: 'Ambient · Crystalline',
    description: 'Luminous suspended chords, glassy overtones, and sparse bell drops.',
  },
  'night-orbit': {
    name: 'Night Orbit',
    mood: 'Ambient · Deep Drone',
    description: 'Cathedral sub-drones, dark dual pads, and a slow cosmic pulse.',
  },
  'moss-pulse': {
    name: 'Moss Pulse',
    mood: 'Psybient · Organic Groove',
    description: 'Rolling 16th bass and repeating organic groove under warm pads.',
  },
  'ultimae-drift': {
    name: 'Deep Drift',
    mood: 'Psybient · Half-Time',
    description: 'Wide ensemble & shimmer dual pads over a steady half-time pulse.',
  },
  'still-water': {
    name: 'Still Water',
    mood: 'Calm · Drum-Free',
    description: 'No drums. A held root, slow breathing pads, and wide silences.',
  },
  'rain-window': {
    name: 'Rain Window',
    mood: 'Calm · Felt Keys',
    description: 'Soft felt keys and celeste overtones. Unhurried and intimate.',
  },
  'deep-dub': {
    name: 'Deep Dub',
    mood: 'Dub Techno · Tape Echo',
    description: 'Sub kick, filtered minor chord stabs, and deep stereo tape echoes.',
  },
  'night-rumble': {
    name: 'Sub Rumble',
    mood: 'Dub Techno · Sparse',
    description: 'Heavy, hypnotic, and minimal. Phrygian bass under dark power drones.',
  },
  'dusty-keys': {
    name: 'Dusty Keys',
    mood: 'Lo-Fi · Warm Rhodes',
    description: 'Warm electric piano 7th chords, celeste halo, and swung backbeat.',
  },
  'late-train': {
    name: 'Late Train',
    mood: 'Lo-Fi · Swung Keys',
    description: 'Syncopated minor keys over a warm string pad and relaxed groove.',
  },
  'blue-hour': {
    name: 'Blue Hour',
    mood: 'Lo-Fi · Breathing Pad',
    description: 'Warm keys and subtle wave pads that breathe around a soft kick.',
  },
  'streamlight': {
    name: 'Streamlight',
    mood: 'Lo-Fi · Soft Celeste',
    description: 'Cozy celeste waves, gentle woodblock groove, and mellow jazz bass.',
  },
  'cbl-hydroponic': {
    name: 'Hydroponic Drift',
    mood: 'Psybient · 7/8 Pulse',
    description: 'Rolling sub bass, polymetric shakers, and lush dual pads.',
  },
  'cbl-interloper': {
    name: 'Interloper Sky',
    mood: 'Psybient · Downtempo',
    description: 'Resonant sub bass, analog string pads, and wide rhythmic echoes.',
  },
  'symphonic-dawn': {
    name: 'Symphonic Strings',
    mood: 'Orchestral · Wide Hall',
    description: 'Lush string ensemble with neoclassical glass lines in a wide hall.',
  },
  'cbl-carbon-oasis': {
    name: 'Carbon Oasis',
    mood: 'Psybient · Polymetric',
    description: 'Bright Lydian pads, 8th-note bass pulse, and polymetric percussion.',
  },
  'nils-felt-hall': {
    name: 'Nordic Felt Hall',
    mood: 'Neo-Classical · Intimate',
    description: 'Felt piano arpeggios, airy pad bed, and warm upright bass.',
  },
  'solar-fields-orbit': {
    name: 'Luminous Orbit',
    mood: 'Psybient · 16th Arp',
    description: '16th-note celeste ostinato, glassy clusters, and wide stereo delays.',
  },
  'berlin-dub-techno': {
    name: '4AM Dub',
    mood: 'Dub Techno · Analog Echo',
    description: 'Sub-heavy kick, quartal chord stabs, and long feedback tape delays.',
  },
  'jon-hopkins-pulse': {
    name: 'Singularity Pulse',
    mood: 'Organic IDM · Pluck',
    description: 'Lively celeste ostinato, shimmer dual pads, and organic percussion.',
  },
  'eno-apollo-zero': {
    name: 'Zero Gravity',
    mood: 'Space · Infinite Hall',
    description: 'Infinite reverb, weightless Lydian dual pads, and sparse glass drops.',
  },
  'tokyo-midnight-rain': {
    name: 'Midnight Rain',
    mood: 'Lo-Fi · Rainy Keys',
    description: 'Warm Rhodes chords, celeste overtones, and laid-back chillhop drums.',
  },
  'cathedral-adagio': {
    name: 'Cathedral Adagio',
    mood: 'Orchestral · Sacred',
    description: 'Slow bowed strings, tonic pedal drone, and expansive cathedral space.',
  },
};

export const MINIMAL_MACROS: Record<MacroName, { name: string; text: string }> = {
  movement: { name: 'Movement', text: 'How far melodies and voicings wander' },
  density: { name: 'Density', text: 'Note activity without crowding the mix' },
  warmth: { name: 'Warmth', text: 'Analog filter softness and harmonic tone' },
  space: { name: 'Space', text: 'Reverb depth and stereo delay width' },
};

const ARTIST_STRIP_PATTERNS: Array<[RegExp, string]> = [
  [/S1gns Of L1fe\s*[&·-]*\s*/gi, 'Ethereal '],
  [/Carbon Based Lifeforms\s*[&·-]*\s*/gi, 'Psybient '],
  [/CBL\s*[&·-]*\s*/gi, 'Psybient '],
  [/Aes Dana\s*[&·-]*\s*/gi, 'Deep '],
  [/Asura\s*[&·-]*\s*/gi, 'Monolith '],
  [/Kupla\s*[&·-]*\s*/gi, 'Cozy '],
  [/No Spirit\s*[&·-]*\s*/gi, 'Mellow '],
  [/Cell[- ]Grade\s*[&·-]*\s*/gi, 'Studio '],
  [/Cell\s*[·-]+\s*/gi, ''],
  [/Ultimae\s*[&·-]*\s*/gi, 'Deep Space '],
  [/Nils Frahm\s*[&·-]*\s*/gi, 'Nordic '],
  [/Jon Hopkins\s*[&·-]*\s*/gi, 'Organic '],
  [/Solar Fields\s*[&·-]*\s*/gi, 'Luminous '],
  [/Brian Eno\s*[&·-]*\s*/gi, 'Space '],
  [/Eno\s*[&·-]*\s*/gi, 'Space '],
];

export function stripArtistRefs(text: string): string {
  let out = text;
  for (const [re, rep] of ARTIST_STRIP_PATTERNS) {
    out = out.replace(re, rep);
  }
  return out.replace(/\s{2,}/g, ' ').replace(/^[·\-\s]+/, '').trim();
}

export function getSceneDisplay(scene: SceneDefinition, edition: UiEdition): MinimalSceneMeta {
  if (edition === 'classic') {
    return { name: scene.name, mood: scene.mood ?? '', description: scene.description };
  }
  return MINIMAL_SCENE_META[scene.id] ?? {
    name: stripArtistRefs(scene.name),
    mood: stripArtistRefs(scene.mood ?? ''),
    description: stripArtistRefs(scene.description),
  };
}
