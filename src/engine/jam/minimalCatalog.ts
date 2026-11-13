import type {
  AtmosphereSettings,
  DrumModel,
  DrumVoice,
  EffectModuleId,
  MacroName,
  MacroTargetParam,
  SceneDefinition,
  Timbre,
} from '../../types/jam';
import type { UiEdition } from '../../types/ui';
import type { SoundscapePreset } from './soundscapes';
import type { RhythmPreset } from './rhythms';
import type { InstrumentPreset } from './instrumentPresets';
import type { EqPreset, ParamOption } from './customMacros';
import type { SequenceTemplate } from './sequencer';

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
    description: 'Suspended chords, glassy overtones, and sparse bell drops.',
  },
  'night-orbit': {
    name: 'Night Orbit',
    mood: 'Ambient · Deep Drone',
    description: 'Deep sub drones, dark dual pads, and a slow cosmic pulse.',
  },
  'moss-pulse': {
    name: 'Moss Pulse',
    mood: 'Downtempo · Organic Groove',
    description: 'Rolling 16th bass and subtle organic percussion under warm pads.',
  },
  'ultimae-drift': {
    name: 'Deep Drift',
    mood: 'Ambient Pulse · Half-Time',
    description: 'Wide string ensemble & shimmer dual pads over a steady half-time pulse.',
  },
  'still-water': {
    name: 'Still Water',
    mood: 'Calm · Drum-Free',
    description: 'No drums. A held root, slow breathing pads, and wide space.',
  },
  'rain-window': {
    name: 'Rain Window',
    mood: 'Calm · Felt Keys',
    description: 'Soft felt keys and celesta overtones. Unhurried and intimate.',
  },
  'deep-dub': {
    name: 'Deep Dub',
    mood: 'Dub Techno · Tape Echo',
    description: 'Sub kick, filtered minor chord stabs, and deep stereo tape echoes.',
  },
  'night-rumble': {
    name: 'Sub Rumble',
    mood: 'Dub Techno · Sparse',
    description: 'Heavy, hypnotic, and minimal. Dark Phrygian bass under power drones.',
  },
  'dusty-keys': {
    name: 'Dusty Keys',
    mood: 'Lo-Fi · Warm Electric Piano',
    description: 'Warm 7th chords, soft celesta halo, and laid-back swung drums.',
  },
  'late-train': {
    name: 'Late Train',
    mood: 'Lo-Fi · Swung Keys',
    description: 'Syncopated minor keys over a warm string pad and relaxed groove.',
  },
  'blue-hour': {
    name: 'Blue Hour',
    mood: 'Lo-Fi · Breathing Pad',
    description: 'Warm keys and subtle wave pads breathing around a soft kick.',
  },
  'streamlight': {
    name: 'Streamlight',
    mood: 'Lo-Fi · Soft Bells',
    description: 'Warm celesta waves, wooden perc groove, and mellow upright bass.',
  },
  'cbl-hydroponic': {
    name: 'Subterranean Drift',
    mood: 'Psybient · 7/8 Pulse',
    description: 'Rolling sub bass, polymetric shakers, and lush dual pads.',
  },
  'cbl-interloper': {
    name: 'High Altitude',
    mood: 'Psybient · Downtempo',
    description: 'Resonant sub bass, analog string pads, and wide rhythmic echoes.',
  },
  'symphonic-dawn': {
    name: 'Symphonic Strings',
    mood: 'Orchestral · Wide Hall',
    description: 'Lush string ensemble with delicate glass lines in a wide hall.',
  },
  'cbl-carbon-oasis': {
    name: 'Luminous Oasis',
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
    mood: 'Space · 16th Arp',
    description: '16th-note celesta ostinato, glassy clusters, and wide stereo delays.',
  },
  'berlin-dub-techno': {
    name: '4AM Dub',
    mood: 'Dub Techno · Analog Echo',
    description: 'Sub-heavy kick, quartal chord stabs, and long feedback tape delays.',
  },
  'jon-hopkins-pulse': {
    name: 'Singularity Pulse',
    mood: 'Organic Electronic · Pluck',
    description: 'Driven celesta ostinato, shimmer dual pads, and organic percussion.',
  },
  'eno-apollo-zero': {
    name: 'Zero Gravity',
    mood: 'Space · Infinite Hall',
    description: 'Infinite reverb, weightless Lydian dual pads, and sparse glass drops.',
  },
  'tokyo-midnight-rain': {
    name: 'Midnight Rain',
    mood: 'Lo-Fi · Rainy Keys',
    description: 'Warm electric 7th chords, celesta overtones, and laid-back drums.',
  },
  'cathedral-adagio': {
    name: 'Cathedral Adagio',
    mood: 'Orchestral · Sacred',
    description: 'Slow bowed strings, tonic pedal drone, and expansive hall space.',
  },
};

export const MINIMAL_MACROS: Record<MacroName, { name: string; text: string }> = {
  movement: { name: 'Movement', text: 'Melodic & harmonic motion' },
  density: { name: 'Density', text: 'Note activity across layers' },
  warmth: { name: 'Warmth', text: 'Filter tone & analog color' },
  space: { name: 'Space', text: 'Reverb depth & delay width' },
};

export const MINIMAL_SOUNDSCAPE_PRESETS: Record<string, { name: string; subtitle: string; tags: string[] }> = {
  'symphonic-strings': {
    name: 'Symphonic Strings',
    subtitle: 'Strings + Shimmer · Cathedral Hall',
    tags: ['Strings', 'Dual Pad'],
  },
  'cbl-wash': {
    name: 'Deep Analog Wash',
    subtitle: 'Analog Wash + 70s Strings · Tape Delay',
    tags: ['Analog', 'Tape'],
  },
  's1gns-nebula': {
    name: 'Deep Space Shimmer',
    subtitle: 'Shimmer + Choir Air · Infinite Space',
    tags: ['Shimmer', 'Space'],
  },
  'asura-monolith': {
    name: 'Fifths Monolith',
    subtitle: '70s Strings + Sub Fifths · Deep Hall',
    tags: ['Drones', 'Deep'],
  },
  'crystal-glass': {
    name: 'Crystal Glass',
    subtitle: 'Glass Harmonics + Celesta · Bright',
    tags: ['Glass', 'Celesta'],
  },
  'solina-vintage': {
    name: 'Vintage 70s Ensemble',
    subtitle: 'String Machine + Warm Pad · Tape',
    tags: ['Ensemble', 'Warm'],
  },
  'rainy-rhodes': {
    name: 'Rainy Warm Keys',
    subtitle: 'Electric 7th Chords + Celesta · Rain',
    tags: ['Keys', 'Rain'],
  },
  'aes-dana-dub': {
    name: 'Deep Dub Chamber',
    subtitle: 'Filtered Chord Stabs + Air · Tape Echo',
    tags: ['Dub', 'Echo'],
  },
  'sacral-choir': {
    name: 'Cathedral Choir',
    subtitle: 'Formant Choir + Symphonic Strings',
    tags: ['Choir', 'Strings'],
  },
};

export const MINIMAL_RHYTHM_PRESETS: Record<string, { name: string; genre: string; description: string }> = {
  'cbl-psybient': {
    name: '7/8 Polymetric Pulse',
    genre: 'Ambient Downtempo',
    description: 'Shifting 7/8 hi-hats with soft density bursts over a rolling sub pulse.',
  },
  'aes-dana-dub': {
    name: 'Hypnotic 4/4 Dub',
    genre: 'Deep Techno',
    description: 'Steady four-on-the-floor kick with offbeat hats and echoed percussion.',
  },
  'euclidean-interlock': {
    name: 'Euclidean Interlock',
    genre: 'Minimal Polyrhythm',
    description: 'Evenly distributed pulses (5/16 kick, 11/16 hat, 7/16 perc).',
  },
  'lofi-backbeat': {
    name: 'Laid-Back Swing',
    genre: 'Chill Beats',
    description: '38% swing with loose snare ghost notes and unquantized feel.',
  },
  'markov-organic': {
    name: 'Stochastic Flow',
    genre: 'Generative Electronic',
    description: 'Probabilistic state transitions between hits, ghost notes, and rests.',
  },
  'ambient-micro': {
    name: 'Floating Micro Perc',
    genre: 'Pure Ambient',
    description: 'Sparse bell and wood clicks leaving wide room for pads and chords.',
  },
  'density-burst': {
    name: 'Fractal Density Burst',
    genre: 'Organic Electronic',
    description: 'Dynamic note clusters swelling in response to movement.',
  },
};

export const MINIMAL_SEQUENCE_TEMPLATES: Record<string, { name: string; description: string }> = {
  'four-bars-flow': {
    name: '4-Bar Flow Cycle',
    description: '4 bars groove, breakdown, buildup, chorus.',
  },
  'slow-symphonic': {
    name: 'Slow Evolution',
    description: 'Gradual arcs from stillness and strings through beat and peak.',
  },
  'cbl-journey': {
    name: '7/8 Deep Journey',
    description: 'Ambient intro, 7/8 hypnotic groove, echo break, and peak.',
  },
  'minimal-dub': {
    name: 'Deep Dub Cycle',
    description: '8 bars sub groove, 4 bars echo break, 8 bars drop, 4 bars space.',
  },
  'lofi-pocket': {
    name: 'Chillhop Pocket',
    description: '8 bars relaxed groove, 4 bars keys breakdown, 8 bars full chorus, 4 bars quiet outro.',
  },
};

const BLOCK_LABEL_MAP: Array<[RegExp, string]> = [
  [/^4T Voller Beat$/i, '4B Full Groove'],
  [/^4T Breakdown\s*[·-]\s*Streicher im Hall$/i, '4B Breakdown · Strings'],
  [/^4T Buildup\s*[·-]\s*Spannungsaufbau$/i, '4B Buildup'],
  [/^4T Chorus\s*[·-]\s*Peak & Energie$/i, '4B Peak'],
  [/^16T Stille\s*[·-]\s*Große Streicher & Hall$/i, '16B Stillness · Strings'],
  [/^16T Breakdown\s*[·-]\s*Flächen schwellen an$/i, '16B Swell'],
  [/^16T Hypnotischer Beat schleicht ein$/i, '16B Subtle Groove'],
  [/^8T Lange Steigerung vor dem Drop$/i, '8B Long Buildup'],
  [/^16T Symphonischer Höhepunkt$/i, '16B Peak'],
  [/^8T Sanfter Ausklang im Raum$/i, '8B Fade Out'],
  [/^8T Psybient Pad Drift$/i, '8B Pad Drift'],
  [/^16T Hypnotischer Groove & Bass$/i, '16B Groove & Bass'],
  [/^8T Drum-Ausstieg & Echo-Fahnen$/i, '8B Echo Breakdown'],
  [/^4T Shaker-Roll & Filteröffnung$/i, '4B Buildup'],
  [/^16T Volle Synthese & Weite$/i, '16B Full Mix'],
  [/^8T Deep Dub 4-on-the-Floor$/i, '8B Sub Groove'],
  [/^4T Echo-Kammer\s*[·-]\s*Drums weg$/i, '4B Echo Break'],
  [/^8T Beat Drop & Bassline$/i, '8B Beat Drop'],
  [/^4T Tiefer Raum & Nachhall$/i, '4B Deep Space'],
];

const DYNAMIC_BLOCK_LABEL_RULES: Array<[RegExp, string]> = [
  [/^(\d+)T\s+Chorus\s*\(Peak\)$/i, '$1B Peak'],
  [/^(\d+)T\s+Buildup\s*\(Spannung\)$/i, '$1B Buildup'],
  [/^(\d+)T\s+Voller Groove$/i, '$1B Full Groove'],
  [/^(\d+)T\s+Voller Beat$/i, '$1B Full Groove'],
  [/^(\d+)T\s+Breakdown\s*\(Drums aus\)$/i, '$1B Breakdown'],
  [/^(\d+)T\s+Stille\s*\(Minimal\)$/i, '$1B Stillness'],
  [/^(\d+)T\s+Stille$/i, '$1B Stillness'],
];

export function getSequenceBlockLabel(label: string | undefined, edition: UiEdition): string {
  if (!label) return '';
  if (edition === 'classic') return label;
  for (const [re, rep] of BLOCK_LABEL_MAP) {
    if (re.test(label)) return rep;
  }
  let out = label;
  for (const [re, rep] of DYNAMIC_BLOCK_LABEL_RULES) {
    if (re.test(out)) return out.replace(re, rep);
  }
  out = stripArtistRefs(out)
    .replace(/\b(\d+)T\b/g, '$1B')
    .replace(/\bVoller Groove\b/gi, 'Full Groove')
    .replace(/\bVoller Beat\b/gi, 'Full Groove')
    .replace(/\(Spannung\)/gi, '(Tension)')
    .replace(/\(Drums aus\)/gi, '(Drums Off)')
    .replace(/\bSpannungsaufbau\b/gi, 'Buildup')
    .replace(/\bStreicher im Hall\b/gi, 'Strings')
    .replace(/\bEcho-Fahnen\b/gi, 'Echo Tails')
    .replace(/\bStille\b/gi, 'Stillness');
  return out.replace(/\s{2,}/g, ' ').trim();
}

export const MINIMAL_INSTRUMENT_PRESETS: Record<string, { name: string; description: string }> = {
  // Bass
  'bass-woody-upright': { name: 'Woody Upright', description: 'Acoustic upright pluck with warm body resonance.' },
  'bass-deep-sub-808': { name: 'Sub 808', description: 'Pure low-frequency sine sub with clean weight.' },
  'bass-acid-303': { name: 'Acid 303 Reso', description: 'Resonant diode filter sweep with punchy decay.' },
  'bass-moog-24db': { name: 'Ladder 24dB', description: 'Fat dual sawtooth through a 24dB analog lowpass filter.' },
  'bass-jaco-fretless': { name: 'Fretless Sing', description: 'Vocal midrange fretless tone with gentle vibrato.' },
  'bass-motown-flatwound': { name: 'Flatwound Vintage', description: 'Muted vintage P-bass with round thump.' },
  'bass-dub-roller': { name: 'Dub Techno Roller', description: 'Rolling off-beat sub bass tailored for tape echo.' },
  'bass-reese-dark': { name: 'Reese Dark Drift', description: 'Detuned dark sawtooth bass with wide stereo motion.' },
  'bass-funk-pluck': { name: 'Pluck Thumb', description: 'Percussive finger pluck with crisp filter snap.' },
  'bass-ambient-pedal': { name: 'Ambient Pedal Sub', description: 'Smooth sustained pedal tone without click transient.' },
  // Kick
  'kick-sp404-pillow': { name: 'Warm Pillow Kick', description: 'Soft 48Hz sub thump with warm tape saturation.' },
  'kick-berlin-909': { name: '909 Club Punch', description: 'Punchy 46Hz kick with tight transient click.' },
  'kick-sub-808-boom': { name: 'Sub 808 Boom', description: 'Deep 41Hz sine boom with long sub tail.' },
  'kick-acoustic-felt': { name: 'Acoustic Felt', description: 'Warm felt beater transient and natural roundness.' },
  'kick-punch-click': { name: 'Punch Click', description: 'Fast, tight kick for dense rhythmic grooves.' },
  'kick-ambient-heartbeat': { name: 'Ambient Heartbeat', description: 'Gentle clickless pulse for quiet passages.' },
  'kick-industrial-crunch': { name: 'Saturated Crunch', description: 'Overdriven low punch with gritty tape drive.' },
  // Snare
  'snare-sp404-thwack': { name: 'Wood Body Thwack', description: 'Warm woody midrange slap with subtle drive.' },
  'snare-crisp-rimshot': { name: 'Crisp Rimshot', description: 'Dry tight rimshot with short decay.' },
  'snare-dusty-paper': { name: 'Dusty Paper', description: 'Low thud with soft paper and vinyl noise.' },
  'snare-dub-echo-clap': { name: 'Dub Echo Clap', description: 'Wide stereo clap suited for tape feedback.' },
  'snare-tea-towel-70s': { name: '70s Muted Snare', description: 'Dry vintage damped snare hit.' },
  'snare-ghost-brush': { name: 'Ghosted Brush', description: 'Soft brushed texture for subtle grooves.' },
  'snare-909-snappy': { name: '909 Snappy', description: 'Crisp analog snare snap for driving beats.' },
  // Hi-Hat
  'hat-tape-sizzle': { name: 'Tape Sizzle', description: 'Smooth tape-saturated hats without harshness.' },
  'hat-808-metallic': { name: '808 Metallic', description: 'Tight metallic tick with ultra-short envelope.' },
  'hat-organic-shaker': { name: 'Organic Shaker', description: 'Soft shaker grain with natural velocity dynamics.' },
  'hat-909-crisp': { name: '909 Open Sizzle', description: 'Bright driving metallic hat for rhythmic momentum.' },
  'hat-dark-felt-tick': { name: 'Dark Felt Tick', description: 'Filtered dark tick for understated pulse.' },
  'hat-polyrhythm': { name: 'Polyrhythm 7/8', description: 'Polymetric accent patterns shifting across bars.' },
  // Perc
  'perc-woodblock-pop': { name: 'Woodblock Pop', description: 'Warm tuned wood pop with organic body.' },
  'perc-modular-glitch': { name: 'Analog Tick & Glitch', description: 'Bandpassed pulse bursts for intricate texture.' },
  'perc-dub-conga': { name: 'Dub Conga', description: 'Resonant hand drum with pitch drop and echo.' },
  'perc-metal-rim-ping': { name: 'Rimshot & Clave', description: 'Dry dual-sine rim click with clean transient.' },
  'perc-foley-raindrop': { name: 'Glass Raindrop', description: 'Crystalline inharmonic droplet for open space.' },
  'perc-analog-cowbell': { name: 'Tabla & Shaker', description: 'Organic upward-pitched percussion hit.' },
  // Chords
  'chords-cell-solina': { name: '70s String Ensemble', description: 'Classic analog string chorus (A) + shimmer veil (B).' },
  'chords-s1gns-ethereal': { name: 'Ethereal Shimmer Veil', description: 'Crystalline shimmer harmonics (A) + breathing air choir (B).' },
  'chords-asura-monolith': { name: 'Power Monolith', description: 'Deep fifth drone (A) + wide analog string ensemble (B).' },
  'chords-cbl-hydroponic': { name: 'Hydroponic Dual Pad', description: 'Warm analog wash (A) + 70s string machine (B).' },
  'chords-kupla-cozy': { name: 'Warm 7th Keys', description: 'Soft electric piano 7th chords (A) + celesta/air pad (B).' },
  'chords-dusty-rhodes': { name: 'Dusty Electric Piano', description: 'Warm tines with flutter (A) + soft analog pad (B).' },
  'chords-celeste-hall': { name: 'Felted Celesta', description: 'Felted piano bells (A) + floating shimmer halo (B).' },
  'chords-ambient-wash': { name: 'Ambient Wash Cloud', description: 'Floating pad (A) + slow bowed strings (B) in wide hall.' },
  'chords-dub-stabs': { name: 'Deep Dub Stabs', description: 'Filtered minor stabs (A) + airy background pad (B).' },
  'chords-shimmer-cathedral': { name: 'Shimmer Cathedral', description: 'Octave shimmer voices + bright glass arpeggio.' },
  'chords-nils-felt': { name: 'Nordic Felt Hall', description: 'Intimate felt piano chords (A) + warm string breath (B).' },
  'chords-church-organ': { name: 'Warm Pipe Organ', description: 'Soft cathedral flutes (A) + vocal air choir (B).' },
  // Melody
  'melody-celesta-bells': { name: 'Celesta Bells', description: 'Clear crystal bells with stereo sparkle.' },
  'melody-glass-kalimba': { name: 'Glass Kalimba', description: 'Plucked crystalline tines with airy attack.' },
  'melody-tape-flute': { name: 'Tape Flute', description: 'Warm analog flute with subtle pitch drift.' },
  'melody-pure-sine': { name: 'Pure Sine Whistle', description: 'Smooth expressive sine lead for melodic lines.' },
  'melody-apollo-chime': { name: 'Deep Space Chime', description: 'Floating bell harmonics in expansive reverb.' },
  'melody-nordic-felt': { name: 'Nordic Felt Motif', description: 'Soft felt piano notes with natural dynamics.' },
  'melody-analog-pluck': { name: 'Analog Pluck Arp', description: 'Crisp 24dB filter pluck for rhythmic motifs.' },
  // Drone
  'drone-deep-earth-root': { name: 'Deep Earth Root', description: 'Grounded tonic & fifth anchor beneath the mix.' },
  'drone-asura-fifth': { name: 'Cathedral Fifth', description: 'Deep analog fifth drone with warm low-end presence.' },
  'drone-s1gns-aether': { name: 'Ethereal Overtone Veil', description: 'Weightless high harmonic shimmer drone.' },
  'drone-granular-cloud': { name: 'Granular Drift Cloud', description: 'Slow evolving overtone mist with organic motion.' },
  'drone-cathedral-cello': { name: 'Cathedral Bowed Cello', description: 'Deep sustained string ensemble in wide reverb.' },
  'drone-analog-swarm': { name: 'Analog Swarm Pad', description: 'Detuned multi-oscillator analog pad with slow drift.' },
  'drone-singing-bowl': { name: 'Singing Bowl', description: 'Warm metallic resonance for calm meditative focus.' },
  'drone-abyssal-sub': { name: 'Abyssal Deep Sub', description: 'Sub-harmonic dark drone with wide analog warmth.' },
};

export const MINIMAL_PARAM_OPTIONS: Record<MacroTargetParam, { label: string; category: 'Effects' | 'Macros' | 'Atmosphere' | 'Tracks' }> = {
  'fx:reverbMix': { label: 'Reverb Mix', category: 'Effects' },
  'fx:reverbSize': { label: 'Reverb Size', category: 'Effects' },
  'fx:reverbDecay': { label: 'Reverb Decay (s)', category: 'Effects' },
  'fx:delayMix': { label: 'Delay Mix', category: 'Effects' },
  'fx:delayFeedback': { label: 'Delay Feedback', category: 'Effects' },
  'fx:delayFlutter': { label: 'Tape Flutter', category: 'Effects' },
  'fx:masterDrive': { label: 'Tape Drive', category: 'Effects' },
  'fx:eqLow': { label: 'EQ Low (dB)', category: 'Effects' },
  'fx:eqMid': { label: 'EQ Mid (dB)', category: 'Effects' },
  'fx:eqHigh': { label: 'EQ High (dB)', category: 'Effects' },
  'fx:eqHighpass': { label: 'EQ Highpass (Hz)', category: 'Effects' },
  'macro:space': { label: 'Macro: Space', category: 'Macros' },
  'macro:warmth': { label: 'Macro: Warmth', category: 'Macros' },
  'macro:density': { label: 'Macro: Density', category: 'Macros' },
  'macro:movement': { label: 'Macro: Movement', category: 'Macros' },
  'atmo:level': { label: 'Atmosphere Level', category: 'Atmosphere' },
  pump: { label: 'Sidechain Pump', category: 'Atmosphere' },
  'layer:kick:volume': { label: 'Kick Volume', category: 'Tracks' },
  'layer:snare:volume': { label: 'Snare Volume', category: 'Tracks' },
  'layer:chords:volume': { label: 'Chords Volume', category: 'Tracks' },
  'layer:melody:volume': { label: 'Melody Volume', category: 'Tracks' },
  'layer:bass:volume': { label: 'Bass Volume', category: 'Tracks' },
  'layer:drone:volume': { label: 'Drone Volume', category: 'Tracks' },
};

export const MINIMAL_EQ_PRESETS: Record<string, { name: string; subtitle: string }> = {
  flat: { name: 'Flat / Neutral', subtitle: 'Linear 0 dB response' },
  'warm-scoop': { name: 'Warm Scoop', subtitle: 'Warm lows, scooped mids, smooth highs' },
  'lofi-radio': { name: 'Lo-Fi Filter', subtitle: '320Hz highpass, focused mids, rolled-off highs' },
  'deep-ambient': { name: 'Deep Space', subtitle: 'Sub warmth, relaxed mids, airy top end' },
  'club-punch': { name: 'Punchy Low', subtitle: 'Tight 35Hz cut, firm low shelf & kick snap' },
  'air-shimmer': { name: 'Silky Air', subtitle: 'Open top-end shimmer for pads and reverb' },
};

export const MINIMAL_EFFECT_MODULES: Record<EffectModuleId, string> = {
  eq: '3-Band Parametric EQ',
  warmth: 'Tape Drive',
  flutter: 'Analog Flutter',
  delay: 'Stereo Delay',
  reverb: 'Hall Reverb',
  pump: 'Sidechain Pump',
};

export const MINIMAL_ATMOSPHERE_LABELS: Record<AtmosphereSettings['kind'], string> = {
  off: 'Off',
  sample: 'Custom Sample',
  tape: 'Tape Hiss',
  air: 'Breathing Air',
  vinyl: 'Vinyl Crackle',
  rain: 'Soft Rain',
};

export const MINIMAL_ATMOSPHERE_DESC: Record<AtmosphereSettings['kind'], string> = {
  off: 'No background noise bed.',
  sample: 'Local audio loop (stays on your device).',
  tape: 'Soft, warm analog tape floor.',
  air: 'Slowly breathing non-rhythmic air.',
  vinyl: 'Subtle lo-fi vinyl crackle.',
  rain: 'Steady soft rain texture.',
};

const CUSTOM_MACRO_EN_MAP: Record<string, string> = {
  'Psybient Shimmer': 'Shimmer & Delay',
  'Dreck & Space': 'Drive & Space',
  'Breakdown Drop': 'Filter Breakdown',
};

const ARTIST_STRIP_PATTERNS: Array<[RegExp, string]> = [
  [/S1gns Of L1fe\s*[&·-]*\s*/gi, 'Ethereal '],
  [/Carbon Based Lifeforms\s*[&·-]*\s*/gi, 'Deep '],
  [/CBL\s*[&·-]*\s*/gi, 'Deep '],
  [/Aes Dana\s*[&·-]*\s*/gi, 'Deep '],
  [/Asura\s*[&·-]*\s*/gi, 'Monolith '],
  [/Kupla\s*[&·-]*\s*/gi, 'Warm '],
  [/No Spirit\s*[&·-]*\s*/gi, 'Mellow '],
  [/Cell[- ]Grade\s*[&·-]*\s*/gi, 'Studio '],
  [/Cell\s*[·-]+\s*/gi, ''],
  [/Ultimae\s*[&·-]*\s*/gi, 'Wide Space '],
  [/Nils Frahm\s*[&·-]*\s*/gi, 'Nordic '],
  [/Jon Hopkins\s*[&·-]*\s*/gi, 'Organic '],
  [/Solar Fields\s*[&·-]*\s*/gi, 'Luminous '],
  [/Brian Eno\s*[&·-]*\s*/gi, 'Space '],
  [/J Dilla\s*[&·-]*\s*/gi, 'Swung '],
  [/ChilledCow\s*[&·-]*\s*/gi, 'Chill '],
  [/Steve Reich\s*[&·-]*\s*/gi, 'Minimal '],
  [/Autechre\s*[&·-]*\s*/gi, 'Generative '],
  [/Max Cooper\s*[&·-]*\s*/gi, 'Fractal '],
  [/Spotify\s*/gi, ''],
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

export function getSoundscapeDisplay(preset: SoundscapePreset, edition: UiEdition) {
  if (edition === 'classic') {
    return {
      name: preset.name,
      subtitle: preset.subtitle,
      description: preset.description,
      tags: preset.tags,
    };
  }
  const m = MINIMAL_SOUNDSCAPE_PRESETS[preset.id];
  return m
    ? { name: m.name, subtitle: m.subtitle, description: m.subtitle, tags: m.tags }
    : {
        name: stripArtistRefs(preset.name),
        subtitle: stripArtistRefs(preset.subtitle),
        description: stripArtistRefs(preset.description),
        tags: preset.tags.slice(0, 2).map(stripArtistRefs),
      };
}

export function getRhythmDisplay(preset: RhythmPreset, edition: UiEdition) {
  if (edition === 'classic') {
    return {
      name: preset.name,
      genre: preset.genre,
      description: preset.description,
      artistInspiration: preset.artistInspiration,
    };
  }
  const m = MINIMAL_RHYTHM_PRESETS[preset.id];
  return m
    ? { ...m, artistInspiration: '' }
    : {
        name: stripArtistRefs(preset.name),
        genre: stripArtistRefs(preset.genre),
        description: stripArtistRefs(preset.description),
        artistInspiration: '',
      };
}

export function getInstrumentPresetDisplay(preset: InstrumentPreset, edition: UiEdition) {
  if (edition === 'classic') {
    return { name: preset.name, description: preset.description };
  }
  return MINIMAL_INSTRUMENT_PRESETS[preset.id] ?? {
    name: stripArtistRefs(preset.name),
    description: stripArtistRefs(preset.description),
  };
}

export function getSequenceTemplateDisplay(tmpl: SequenceTemplate, edition: UiEdition) {
  if (edition === 'classic') {
    return { name: tmpl.name, description: tmpl.description };
  }
  return MINIMAL_SEQUENCE_TEMPLATES[tmpl.id] ?? {
    name: stripArtistRefs(tmpl.name),
    description: stripArtistRefs(tmpl.description),
  };
}

export function getParamOptionDisplay(opt: ParamOption, edition: UiEdition) {
  if (edition === 'classic') {
    return { label: opt.label, category: opt.category };
  }
  return MINIMAL_PARAM_OPTIONS[opt.param] ?? { label: opt.label, category: 'Effects' as const };
}

export function getEqPresetDisplay(preset: EqPreset, edition: UiEdition) {
  if (edition === 'classic') {
    return { name: preset.name, subtitle: preset.subtitle };
  }
  return MINIMAL_EQ_PRESETS[preset.id] ?? { name: preset.name, subtitle: preset.subtitle };
}

export function getCustomMacroDisplayName(name: string, edition: UiEdition): string {
  if (edition === 'classic') return name;
  return CUSTOM_MACRO_EN_MAP[name] ?? stripArtistRefs(name);
}

const PRESET_CATEGORY_EN_MAP: Record<string, string> = {
  'Cell-Grade Ultimae': 'Wide Space Studio',
};

export function getPresetCategoryDisplay(category: string, edition: UiEdition): string {
  if (edition === 'classic') return category;
  return PRESET_CATEGORY_EN_MAP[category] ?? stripArtistRefs(category);
}

const TIMBRE_LABELS_DE: Record<Timbre, string> = {
  warm: 'Warm',
  air: 'Luftig',
  keys: 'Keys',
  bell: 'Glocke',
  strings: 'Streicher',
  wash: 'Wash-Fläche',
  dub: 'Dub-Stab',
  root: 'Root-Anker',
  glass: 'Glas-Schimmer',
  organ: 'Weiche Orgel',
  solina: 'Solina Ensemble',
  shimmer: 'Shimmer-Hall',
  celeste: 'Celesta',
};

const TIMBRE_LABELS_EN: Record<Timbre, string> = {
  warm: 'Warm Pad',
  air: 'Airy Pad',
  keys: 'Electric Keys',
  bell: 'Bell',
  strings: 'Strings',
  wash: 'Wash Pad',
  dub: 'Dub Stab',
  root: 'Deep Root',
  glass: 'Crystal Glass',
  organ: 'Soft Organ',
  solina: 'Analog Ensemble',
  shimmer: 'Shimmer Halo',
  celeste: 'Felt Celesta',
};

export function getTimbreDisplayName(timbre: Timbre, edition: UiEdition): string {
  return (edition === 'minimal' ? TIMBRE_LABELS_EN : TIMBRE_LABELS_DE)[timbre] ?? timbre;
}

const DRUM_MODEL_LABELS_DE: Record<DrumModel | DrumVoice, string> = {
  woodblock: 'Holzblock',
  shaker: 'Shaker',
  rim: 'Rimshot',
  conga: 'Conga',
  clave: 'Clave',
  glassDrop: 'Glastropfen',
  tablaTick: 'Tabla-Klick',
  vinylTick: 'Vinyl-Klick',
  clap: 'Clap',
  brush: 'Besen-Snare',
  closedHat: 'Geschlossene Hi-Hat',
  shakerHat: 'Shaker-Hi-Hat',
  tick808: '808 Rim-Klick',
  kick: 'Kick',
  snare: 'Snare',
  hihat: 'Hi-Hat',
  perc: 'Perkussion',
};

const DRUM_MODEL_LABELS_EN: Record<DrumModel | DrumVoice, string> = {
  woodblock: 'Woodblock',
  shaker: 'Shaker',
  rim: 'Rimshot',
  conga: 'Conga',
  clave: 'Clave',
  glassDrop: 'Glass Drop',
  tablaTick: 'Tabla Click',
  vinylTick: 'Vinyl Click',
  clap: 'Clap',
  brush: 'Brushed Snare',
  closedHat: 'Closed Hi-Hat',
  shakerHat: 'Shaker Hi-Hat',
  tick808: '808 Rim Click',
  kick: 'Kick',
  snare: 'Snare',
  hihat: 'Hi-Hat',
  perc: 'Percussion',
};

export function getDrumModelDisplayName(model: DrumModel | DrumVoice | undefined, edition: UiEdition): string {
  if (!model) return '';
  return (edition === 'minimal' ? DRUM_MODEL_LABELS_EN : DRUM_MODEL_LABELS_DE)[model] ?? model;
}

const CLASSIC_TO_MINIMAL_SCENE_NAME: Record<string, string> = {
  'Dorian Dawn': 'Amber Horizon',
  'Ultimae Drift': 'Deep Drift',
  'Hydroponic Drift': 'Subterranean Drift',
  'Interloper Sky': 'High Altitude',
  'Carbon Oasis': 'Luminous Oasis',
  'Solar Fields Orbit': 'Luminous Orbit',
  'Berlin 4AM Dub': '4AM Dub',
  'Apollo Zero Gravity': 'Zero Gravity',
  'Tokyo Midnight Rain': 'Midnight Rain',
};

export function getClipTitleDisplay(title: string, edition: UiEdition): string {
  if (edition === 'classic') return title;
  let out = title;
  for (const [classicName, minName] of Object.entries(CLASSIC_TO_MINIMAL_SCENE_NAME)) {
    if (out.startsWith(classicName)) {
      out = minName + out.slice(classicName.length);
      break;
    }
  }
  out = stripArtistRefs(out)
    .replace(/·\s*(\d+(?:\.\d+)?)\s*Takte\b/gi, '· $1 Bars')
    .replace(/\b(\d+(?:\.\d+)?)\s*Takte\b/gi, '$1 Bars')
    .replace(/\bAufnahme\b/gi, 'Capture')
    .replace(/\bVorschau\b/gi, 'Preview');
  return out;
}

const CLASSIC_RHYTHM_NAME_TO_ID: Array<[string, string]> = [
  ['CBL Psybient Pulse', 'cbl-psybient'],
  ['Aes Dana Slow Techno', 'aes-dana-dub'],
  ['Euclidean Interlock', 'euclidean-interlock'],
  ['Lo-Fi Lazy Swing', 'lofi-backbeat'],
  ['Markov Stochastic Flow', 'markov-organic'],
  ['Ambient Floating Bells', 'ambient-micro'],
  ['Density Burst Swarm', 'density-burst'],
];

const CLASSIC_SOUNDSCAPE_NAME_TO_ID: Array<[string, string]> = [
  ['Großes Streichorchester', 'symphonic-strings'],
  ['Psybient Hydroponic Horizon', 'cbl-wash'],
  ['Ethereal Nebula', 's1gns-nebula'],
  ['Monolith Power Monolith', 'asura-monolith'],
  ['Kristalliner Glas-Raum', 'crystal-glass'],
  ['Vintage Solina Strings', 'solina-vintage'],
  ['Cozy Mellow Cozy Keys', 'rainy-rhodes'],
  ['Deep Dub Chamber', 'aes-dana-dub'],
  ['Sakraler Chor & Kathedrale', 'sacral-choir'],
];

const EXACT_CHANGE_EN: Record<string, string> = {
  'Panic · Stimmen und MIDI gestoppt': 'Panic · Voices and MIDI stopped',
  'Bearbeitete Phrase übernommen': 'Edited phrase applied',
  'Neue Motivvariation · sanfte Klangbewegung': 'New motif variation · subtle motion',
  'Neue Phrase · Harmonie und Groove': 'New phrase · harmony and groove',
  'Freeze · Vorschauphrase (noch kein gespieltes Material)': 'Freeze · Preview phrase',
  'Arrangement: ⚡ Buildup gestartet (Drop in 4 Takten)': 'Arrangement: Buildup started (drop in 4 bars)',
  'Arrangement: 💥 Breakdown · Drums ausgeblendet, Pad schwebt': 'Arrangement: Breakdown · Drums out, pad open',
  'Arrangement: 🌟 Chorus / Peak · Volle Klangdichte': 'Arrangement: Peak · Full density',
  'Arrangement: 🤫 Stille · Intimer Ambient-Teil': 'Arrangement: Stillness · Quiet ambient section',
  'Arrangement: 🌊 Voller Beat (Drop In)': 'Arrangement: Full groove (Drop In)',
  'Spontanes Arrangement: Deaktiviert': 'Auto-Arrangement: Off',
  'Arrangement-Sequencer: Aktiviert': 'Sequencer: Enabled',
  'Arrangement-Sequencer: Deaktiviert': 'Sequencer: Off',
  'Eigene Makros: Aktiviert': 'Custom Macros: Enabled',
  'Eigene Makros: Bypassed': 'Custom Macros: Bypassed',
  'Organischer Attraktor: Aktiviert': 'Organic Attractor: Enabled',
  'Organischer Attraktor: Aus': 'Organic Attractor: Off',
  '⚡ Chaotischer Impuls (Organischer Timbre-Drift)': 'Chaos Impulse (Organic Drift)',
  'Übergang · Zurück zum vollen Groove': 'Transition · Back to full groove',
  'Übergang · Raum öffnet sich': 'Transition · Space opens up',
  'Übergang · Klang wird dunkler': 'Transition · Darker tone',
  'Übergang · Klang öffnet sich': 'Transition · Brighter tone',
  'Übergang · Das Ensemble atmet': 'Transition · Ensemble breathing',
  'Übergang · Drums treten zurück': 'Transition · Drums pull back',
  'Übergang · Neue Motive, gleiche Harmonie': 'Transition · New motifs, same harmony',
};

export function getChangeDisplay(label: string, edition: UiEdition): string {
  if (edition === 'classic') return label;
  if (EXACT_CHANGE_EN[label]) return EXACT_CHANGE_EN[label];

  let m: RegExpMatchArray | null;
  if ((m = label.match(/^Spontanes Arrangement: Aktiv \(alle (\d+) Takte\)$/))) {
    return `Auto-Arrangement: On (every ${m[1]} bars)`;
  }
  if ((m = label.match(/^Sequencer: \[(.+)\] \((\d+) Takte\)$/))) {
    return `Sequencer: [${getSequenceBlockLabel(m[1], 'minimal')}] (${m[2]} bars)`;
  }
  if ((m = label.match(/^Sequencer: Zu \[(.+)\] gesprungen$/))) {
    return `Sequencer: Jumped to [${getSequenceBlockLabel(m[1], 'minimal')}]`;
  }
  if ((m = label.match(/^Sequenz: Block #(\d+) verschoben nach #(\d+)$/))) {
    return `Sequence: Moved block #${m[1]} to #${m[2]}`;
  }
  if ((m = label.match(/^Sequenz: Block-Dauer auf (\d+) Takte geändert$/))) {
    return `Sequence: Block length ${m[1]} bars`;
  }
  if ((m = label.match(/^Sequenz: Block auf \[(.+)\] \(([A-Z]+)\) gesetzt & aktiviert$/))) {
    return `Sequence: Block set to [${getSequenceBlockLabel(m[1], 'minimal')}] (${m[2]})`;
  }
  if ((m = label.match(/^Rhythmus: ([^(]+?)(?:\s*\([^)]*\))?$/))) {
    const rawName = m[1].trim();
    const matched = CLASSIC_RHYTHM_NAME_TO_ID.find(([n]) => n === rawName);
    const minName = matched ? MINIMAL_RHYTHM_PRESETS[matched[1]]?.name : stripArtistRefs(rawName);
    return `Rhythm: ${minName || rawName}`;
  }
  if ((m = label.match(/^Klangwelt: (?:🎻\s*)?([^(]+?)(?:\s*\([^)]*\))?$/))) {
    const rawName = m[1].trim();
    const matched = CLASSIC_SOUNDSCAPE_NAME_TO_ID.find(([n]) => n === rawName);
    const minPreset = matched ? MINIMAL_SOUNDSCAPE_PRESETS[matched[1]] : undefined;
    return `Soundscape: ${minPreset?.name ?? stripArtistRefs(rawName)}`;
  }
  if ((m = label.match(/^Akkord-Klang: (.+)$/))) {
    const raw = m[1] === 'Großes Streichorchester' ? 'strings' : m[1];
    const timbreName = raw in TIMBRE_LABELS_EN ? TIMBRE_LABELS_EN[raw as Timbre] : stripArtistRefs(raw);
    return `Chord Timbre: ${timbreName}`;
  }
  if ((m = label.match(/^Effekt-Kette: Modus (.+)$/))) {
    return `FX Chain: ${stripArtistRefs(m[1])}`;
  }
  if ((m = label.match(/^Neues Makro erstellt: (.+)$/))) {
    return `Custom Macro Created: ${getCustomMacroDisplayName(m[1], 'minimal')}`;
  }
  if (label.startsWith('Grundton: ')) return `Root Key: ${label.slice('Grundton: '.length)}`;
  if ((m = label.match(/^Akkordnote #(\d+): (.+)$/))) return `Chord Note #${m[1]}: ${m[2]}`;
  if (label.startsWith('Akkord gewechselt: ')) return `Chord Changed: ${label.slice('Akkord gewechselt: '.length)}`;
  if (label.startsWith('Akkordmuster: ')) return `Chord Pattern: ${label.slice('Akkordmuster: '.length)}`;
  if (label.startsWith('Harmoniewechsel: ')) return `Chord Pace: ${label.slice('Harmoniewechsel: '.length)}`;
  if (label.startsWith('Akkord-Begleittextur: ')) return `Chord Texture: ${label.slice('Akkord-Begleittextur: '.length)}`;
  if (label === 'Chord Layer B: Aus') return 'Chord Track B: Off';
  if (label.startsWith('Variation · Motive und Groove')) {
    return label.replace('Variation · Motive und Groove', 'Variation · Motifs and groove');
  }
  if ((m = label.match(/^(.+?) · Register enthält keinen Skalenton; Layer bleibt stumm$/))) {
    return `${m[1]} · Range has no scale notes; track stays silent`;
  }
  if ((m = label.match(/^(.+?) Zufalls-Sound · (.+)$/))) {
    return `${m[1]} Random Preset · ${stripArtistRefs(m[2])}`;
  }
  if ((m = label.match(/^(.+?) Preset · (.+)$/))) {
    return `${m[1]} Preset · ${stripArtistRefs(m[2])}`;
  }
  if (label.startsWith('🎲 Radical Random · ')) {
    return `Randomize · ${stripArtistRefs(label.slice('🎲 Radical Random · '.length))}`;
  }
  if ((m = label.match(/^Sequencer-Vorlage: (.+)$/))) {
    return `Sequence Template: ${stripArtistRefs(m[1])}`;
  }

  return stripArtistRefs(label)
    .replace(/\bTakte\b/g, 'bars')
    .replace(/\bTakt\b/g, 'bar')
    .replace(/·/g, '·');
}
