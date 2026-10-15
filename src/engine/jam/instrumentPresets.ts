import type { DrumVoice, JamLayer, JamSession, LayerRole, LayerSettings } from '../../types/jam';

export interface InstrumentPreset {
  id: string;
  name: string;
  role: LayerRole;
  drumVoice?: DrumVoice;
  category: string;
  description: string;
  settings: Partial<LayerSettings>;
  volume?: number;
}

/**
 * Creative Instrument Presets Catalog for all 8 Studio Channels.
 * Provides instant sound morphing in the Mischpult.
 */
export const INSTRUMENT_PRESETS: InstrumentPreset[] = [
  // =========================================================================
  // BASS PRESETS (role: 'bass')
  // =========================================================================
  {
    id: 'bass-woody-upright',
    name: 'Woody Upright',
    role: 'bass',
    category: 'Acoustic & Jazz',
    description: 'Akkustischer Kontrabass: warmer Korpus, perkussiver Zupf-Attack und feines Bandmaschinen-Wow.',
    volume: 0.82,
    settings: {
      timbre: 'warm',
      density: 0.85,
      rhythmAlgorithm: 'composed',
      audioPatch: {
        osc1Wave: 'triangle',
        osc2Wave: 'sawtooth',
        osc3Wave: 'sine',
        attack: 0.010,
        decay: 0.55,
        sustain: 0.80,
        release: 0.95,
        filterCutoff: 380,
        filterResonance: 1.25,
        filterEnvAmount: 0.32,
        driftAmount: 0.14,
        subLevel: 0.18,
        detuneSpread: 4
      }
    }
  },
  {
    id: 'bass-deep-sub-808',
    name: 'Sub 808',
    role: 'bass',
    category: 'Sub & Trap',
    description: 'Reiner Sinus-Sub (35–55 Hz): massiver Druck im Tiefbass ohne Buzz oder Mitten-Matsch.',
    volume: 0.85,
    settings: {
      timbre: 'root',
      density: 0.75,
      rhythmAlgorithm: 'composed',
      audioPatch: {
        osc1Wave: 'sine',
        osc2Wave: 'triangle',
        osc3Wave: 'sine',
        attack: 0.020,
        decay: 0.85,
        sustain: 0.95,
        release: 1.40,
        filterCutoff: 170,
        filterResonance: 0.25,
        filterEnvAmount: 0.06,
        subLevel: 0.40,
        driftAmount: 0.02,
        detuneSpread: 2
      }
    }
  },
  {
    id: 'bass-acid-303',
    name: 'Acid 303 Reso',
    role: 'bass',
    category: 'Synthesizer & Punch',
    description: 'Resonanter Dioden-Filter-Squelch: gummiger Envelope-Abfall und aggressiver Biss.',
    volume: 0.72,
    settings: {
      timbre: 'dub',
      density: 0.70,
      rhythmAlgorithm: 'euclidean',
      audioPatch: {
        osc1Wave: 'sawtooth',
        osc2Wave: 'sawtooth',
        osc3Wave: 'triangle',
        attack: 0.008,
        decay: 0.35,
        sustain: 0.30,
        release: 0.42,
        filterCutoff: 950,
        filterResonance: 2.20,
        filterEnvAmount: 0.65,
        detuneSpread: 6,
        subLevel: 0.10
      }
    }
  },
  {
    id: 'bass-moog-24db',
    name: 'Moog 24dB Ladder',
    role: 'bass',
    category: 'Analog Classic',
    description: 'Fetter doppelter Sägezahn durch 24dB Kaskadenfilter mit analoger Sättigung.',
    volume: 0.78,
    settings: {
      timbre: 'warm',
      density: 0.80,
      rhythmAlgorithm: 'composed',
      audioPatch: {
        osc1Wave: 'sawtooth',
        osc2Wave: 'sawtooth',
        osc3Wave: 'triangle',
        attack: 0.012,
        decay: 0.45,
        sustain: 0.70,
        release: 0.60,
        filterCutoff: 650,
        filterResonance: 1.40,
        filterEnvAmount: 0.45,
        detuneSpread: 12,
        subLevel: 0.15
      }
    }
  },
  {
    id: 'bass-jaco-fretless',
    name: 'Fretless Jaco',
    role: 'bass',
    category: 'Acoustic & Jazz',
    description: 'Singender Steg-Pickup "Mwah"-Mitten-Klang mit sanftem Vibrato und weitem Ausklang.',
    volume: 0.76,
    settings: {
      timbre: 'warm',
      density: 0.68,
      rhythmAlgorithm: 'composed',
      audioPatch: {
        osc1Wave: 'triangle',
        osc2Wave: 'sawtooth',
        osc3Wave: 'sine',
        attack: 0.025,
        decay: 0.60,
        sustain: 0.85,
        release: 1.20,
        filterCutoff: 820,
        filterResonance: 1.10,
        filterEnvAmount: 0.25,
        lfoRate: 3.5,
        lfoDepth: 0.08,
        driftAmount: 0.18
      }
    }
  },
  {
    id: 'bass-motown-flatwound',
    name: 'Motown Flatwound',
    role: 'bass',
    category: 'Vintage Soul',
    description: '1965 P-Bass mit Schaumstoff-Dämpfung: runder Punch, kurzer trockener Thump.',
    volume: 0.80,
    settings: {
      timbre: 'keys',
      density: 0.82,
      rhythmAlgorithm: 'composed',
      audioPatch: {
        osc1Wave: 'triangle',
        osc2Wave: 'sine',
        osc3Wave: 'triangle',
        attack: 0.008,
        decay: 0.32,
        sustain: 0.40,
        release: 0.35,
        filterCutoff: 320,
        filterResonance: 0.60,
        filterEnvAmount: 0.20,
        subLevel: 0.15
      }
    }
  },
  {
    id: 'bass-dub-roller',
    name: 'Dub Techno Roller',
    role: 'bass',
    category: 'Deep Techno & Dub',
    description: 'Tiefer rollender Off-Beat Subbass für dunkle Keller und endlose Bandecho-Räume.',
    volume: 0.75,
    settings: {
      timbre: 'dub',
      density: 0.65,
      rhythmAlgorithm: 'composed',
      audioPatch: {
        osc1Wave: 'sine',
        osc2Wave: 'triangle',
        osc3Wave: 'sawtooth',
        attack: 0.040,
        decay: 0.70,
        sustain: 0.80,
        release: 1.60,
        filterCutoff: 280,
        filterResonance: 0.80,
        filterEnvAmount: 0.15,
        driftAmount: 0.10
      }
    }
  },
  {
    id: 'bass-reese-dark',
    name: 'Reese Dark Drift',
    role: 'bass',
    category: 'Cinematic & Space',
    description: 'Schwebende gegeneinander verstimmte Sägezähne: düsterer Reese-Bass mit Stereo-Tiefe.',
    volume: 0.70,
    settings: {
      timbre: 'wash',
      density: 0.55,
      rhythmAlgorithm: 'composed',
      audioPatch: {
        osc1Wave: 'sawtooth',
        osc2Wave: 'sawtooth',
        osc3Wave: 'triangle',
        attack: 0.080,
        decay: 1.20,
        sustain: 0.90,
        release: 2.20,
        filterCutoff: 480,
        filterResonance: 0.90,
        filterEnvAmount: 0.18,
        detuneSpread: 24,
        voiceSpread: 0.90
      }
    }
  },
  {
    id: 'bass-funk-pluck',
    name: 'Funk Slap Thumb',
    role: 'bass',
    category: 'Vintage Soul',
    description: 'Perkussiver Daumen-Slap mit offenem Filter-Pluck und trockenem Punch.',
    volume: 0.74,
    settings: {
      timbre: 'keys',
      density: 0.75,
      rhythmAlgorithm: 'euclidean',
      audioPatch: {
        osc1Wave: 'triangle',
        osc2Wave: 'sawtooth',
        osc3Wave: 'sine',
        attack: 0.005,
        decay: 0.28,
        sustain: 0.25,
        release: 0.30,
        filterCutoff: 1200,
        filterResonance: 1.50,
        filterEnvAmount: 0.55
      }
    }
  },
  {
    id: 'bass-ambient-pedal',
    name: 'Ambient Pedal Sub',
    role: 'bass',
    category: 'Cinematic & Space',
    description: 'Schwereloser, unendlicher Orgel-Pedalton ohne perkussiven Anschlagklick.',
    volume: 0.68,
    settings: {
      timbre: 'root',
      density: 0.45,
      rhythmAlgorithm: 'composed',
      audioPatch: {
        osc1Wave: 'sine',
        osc2Wave: 'triangle',
        osc3Wave: 'sine',
        attack: 0.600,
        decay: 2.00,
        sustain: 0.95,
        release: 3.50,
        filterCutoff: 220,
        filterResonance: 0.50,
        lfoRate: 0.08,
        lfoDepth: 0.12
      }
    }
  },

  // =========================================================================
  // KICK DRUM PRESETS (role: 'drum', drumVoice: 'kick')
  // =========================================================================
  {
    id: 'kick-sp404-pillow',
    name: 'SP-404 Pillow',
    role: 'drum',
    drumVoice: 'kick',
    category: 'Lo-Fi Chill',
    description: '48Hz Subbass mit 0.36s samtigem Ausklang und analogem SP-404 Bandsättigungs-Drive.',
    volume: 0.88,
    settings: {
      drumPatch: { pitch: 48, decay: 0.36, tone: 0.12, drive: 0.22, volume: 0.88 }
    }
  },
  {
    id: 'kick-berlin-909',
    name: 'Berlin 909 Punch',
    role: 'drum',
    drumVoice: 'kick',
    category: 'Deep Techno',
    description: '46Hz Wucht mit 0.52s Decay und trockenem Transienten-Klick für druckvolle Techno-Clubs.',
    volume: 0.92,
    settings: {
      drumPatch: { pitch: 46, decay: 0.52, tone: 0.18, drive: 0.14, volume: 0.92 }
    }
  },
  {
    id: 'kick-sub-808-boom',
    name: 'Sub 808 Boom',
    role: 'drum',
    drumVoice: 'kick',
    category: 'Sub & Trap',
    description: '41Hz tiefer Sinus-Sub-Boom mit 0.68s Nachhall, ideal für Hip-Hop und Dub.',
    volume: 0.86,
    settings: {
      drumPatch: { pitch: 41, decay: 0.68, tone: 0.08, drive: 0.06, volume: 0.86 }
    }
  },
  {
    id: 'kick-acoustic-felt',
    name: 'Acoustic Felt',
    role: 'drum',
    drumVoice: 'kick',
    category: 'Acoustic & Jazz',
    description: '52Hz gefilzter Holz-Schlegel: natürlicher akustischer Kick-Sound mit rundem Punch.',
    volume: 0.82,
    settings: {
      drumPatch: { pitch: 52, decay: 0.26, tone: 0.22, drive: 0.04, volume: 0.82 }
    }
  },
  {
    id: 'kick-punch-click',
    name: 'Punch Click',
    role: 'drum',
    drumVoice: 'kick',
    category: 'Modern Electro',
    description: '50Hz schneller Klick-Kick mit 0.22s straffem Punch für dichte elektronische Grooves.',
    volume: 0.86,
    settings: {
      drumPatch: { pitch: 50, decay: 0.22, tone: 0.30, drive: 0.16, volume: 0.86 }
    }
  },
  {
    id: 'kick-ambient-heartbeat',
    name: 'Ambient Heartbeat',
    role: 'drum',
    drumVoice: 'kick',
    category: 'Cinematic & Space',
    description: '43Hz organischer Herzschlag-Puls ohne Klick für meditative und ruhige Sessions.',
    volume: 0.76,
    settings: {
      drumPatch: { pitch: 43, decay: 0.42, tone: 0.04, drive: 0.00, volume: 0.76 }
    }
  },
  {
    id: 'kick-industrial-crunch',
    name: 'Industrial Crunch',
    role: 'drum',
    drumVoice: 'kick',
    category: 'Heavy Distortion',
    description: '45Hz satt übersteuerter Industrial-Kick mit kräftiger Bandsättigung und Schmutz.',
    volume: 0.90,
    settings: {
      drumPatch: { pitch: 45, decay: 0.48, tone: 0.25, drive: 0.38, volume: 0.90 }
    }
  },

  // =========================================================================
  // SNARE DRUM PRESETS (role: 'drum', drumVoice: 'snare')
  // =========================================================================
  {
    id: 'snare-sp404-thwack',
    name: 'SP-404 Body Thwack',
    role: 'drum',
    drumVoice: 'snare',
    category: 'Lo-Fi Chill',
    description: '168Hz Holz-Korpus mit 0.20s Decay und Tape-Drive: warmer Slap, der lowkey sitzt.',
    volume: 0.68,
    settings: {
      drumPatch: { pitch: 168, decay: 0.20, tone: 0.26, drive: 0.14, volume: 0.68 }
    }
  },
  {
    id: 'snare-crisp-rimshot',
    name: 'Crisp Rimshot',
    role: 'drum',
    drumVoice: 'snare',
    category: 'Acoustic & Jazz',
    description: '198Hz trockener Rimshot-Knall mit 0.11s kurzem Decay für schnittige Backbeats.',
    volume: 0.62,
    settings: {
      drumPatch: { pitch: 198, decay: 0.11, tone: 0.35, drive: 0.08, volume: 0.62 }
    }
  },
  {
    id: 'snare-dusty-paper',
    name: 'Dusty Paper',
    role: 'drum',
    drumVoice: 'snare',
    category: 'Lo-Fi Chill',
    description: '152Hz tiefer Thud mit Papier-Rauschen und Vinyl-Textur.',
    volume: 0.66,
    settings: {
      drumPatch: { pitch: 152, decay: 0.18, tone: 0.20, drive: 0.18, volume: 0.66 }
    }
  },
  {
    id: 'snare-dub-echo-clap',
    name: 'Dub Echo Clap',
    role: 'drum',
    drumVoice: 'snare',
    category: 'Deep Techno',
    description: '175Hz breiter Stereo-Handclap mit 0.28s Ausklang und weitem Bandecho-Charakter.',
    volume: 0.64,
    settings: {
      drumPatch: { pitch: 175, decay: 0.28, tone: 0.28, drive: 0.10, volume: 0.64 }
    }
  },
  {
    id: 'snare-tea-towel-70s',
    name: '70s Tea Towel',
    role: 'drum',
    drumVoice: 'snare',
    category: 'Vintage Soul',
    description: '160Hz mit Handtuch gedämpfte Vintage-Snare: trockener, organischer 70er Jahre Schlag.',
    volume: 0.65,
    settings: {
      drumPatch: { pitch: 160, decay: 0.13, tone: 0.18, drive: 0.06, volume: 0.65 }
    }
  },
  {
    id: 'snare-ghost-brush',
    name: 'Ghosted Brush',
    role: 'drum',
    drumVoice: 'snare',
    category: 'Acoustic & Jazz',
    description: '142Hz feiner Besen-Wischsound für subtile Jazz- und Ambient-Grooves.',
    volume: 0.54,
    settings: {
      drumPatch: { pitch: 142, decay: 0.22, tone: 0.12, drive: 0.02, volume: 0.54 }
    }
  },
  {
    id: 'snare-909-snappy',
    name: '909 Snappy',
    role: 'drum',
    drumVoice: 'snare',
    category: 'Deep Techno',
    description: '185Hz analoger Snare-Wire Snapp mit straffer elektronischer Durchsetzungskraft.',
    volume: 0.70,
    settings: {
      drumPatch: { pitch: 185, decay: 0.15, tone: 0.32, drive: 0.12, volume: 0.70 }
    }
  },

  // =========================================================================
  // HI-HAT PRESETS (role: 'drum', drumVoice: 'hihat')
  // =========================================================================
  {
    id: 'hat-tape-sizzle',
    name: 'Tape Sizzle',
    role: 'drum',
    drumVoice: 'hihat',
    category: 'Lo-Fi Chill',
    description: 'Warme analoge Bandsättigung mit samtigen Höhen ohne metallisches Klingeln.',
    volume: 0.36,
    settings: {
      drumPatch: { pitch: 38, decay: 0.040, tone: 0.08, drive: 0.08, volume: 0.36 }
    }
  },
  {
    id: 'hat-808-metallic',
    name: '808 Metallic',
    role: 'drum',
    drumVoice: 'hihat',
    category: 'Sub & Trap',
    description: 'Präziser metallischer 808-Transistor-Tick mit 0.035s kurzer Hüllkurve.',
    volume: 0.32,
    settings: {
      drumPatch: { pitch: 42, decay: 0.035, tone: 0.12, drive: 0.00, volume: 0.32 }
    }
  },
  {
    id: 'hat-organic-shaker',
    name: 'Organic Shaker',
    role: 'drum',
    drumVoice: 'hihat',
    category: 'Acoustic & Jazz',
    description: 'Weiche Shaker-Korn-Textur mit natürlicher Anschlagsdynamik.',
    volume: 0.34,
    settings: {
      drumPatch: { pitch: 36, decay: 0.055, tone: 0.06, drive: 0.00, volume: 0.34 }
    }
  },
  {
    id: 'hat-909-crisp',
    name: '909 Sizzle Open',
    role: 'drum',
    drumVoice: 'hihat',
    category: 'Deep Techno',
    description: 'Helles, treibendes 909-Becken mit feinem Obertonglanz für Techno-Pulse.',
    volume: 0.38,
    settings: {
      drumPatch: { pitch: 40, decay: 0.065, tone: 0.15, drive: 0.04, volume: 0.38 }
    }
  },
  {
    id: 'hat-dark-felt-tick',
    name: 'Dark Felt Tick',
    role: 'drum',
    drumVoice: 'hihat',
    category: 'Cinematic & Space',
    description: 'Gefilterter dunkler Tick (0.028s) für unaufdringliche, intime Begleitung.',
    volume: 0.28,
    settings: {
      drumPatch: { pitch: 34, decay: 0.028, tone: 0.03, drive: 0.00, volume: 0.28 }
    }
  },
  {
    id: 'hat-polyrhythm',
    name: 'Polyrhythm 7/8',
    role: 'drum',
    drumVoice: 'hihat',
    category: 'Modern Electro',
    description: 'Polymetrische Phrasierung mit dynamischen Akzent-Verschiebungen.',
    volume: 0.35,
    settings: {
      rhythmAlgorithm: 'polymetric',
      drumPatch: { pitch: 39, decay: 0.042, tone: 0.09, drive: 0.02, volume: 0.35 }
    }
  },

  // =========================================================================
  // PERCUSSION PRESETS (role: 'drum', drumVoice: 'perc')
  // =========================================================================
  {
    id: 'perc-woodblock-pop',
    name: 'Woodblock Pop',
    role: 'drum',
    drumVoice: 'perc',
    category: 'Acoustic & Organic',
    description: '58Hz hölzerner Plop mit 0.12s Decay: organische organische Percussion-Wärme.',
    volume: 0.44,
    settings: {
      drumPatch: { pitch: 58, decay: 0.12, tone: 0.22, drive: 0.04, volume: 0.44 }
    }
  },
  {
    id: 'perc-modular-glitch',
    name: 'Modular Glitch',
    role: 'drum',
    drumVoice: 'perc',
    category: 'Modern IDM',
    description: '72Hz FM-Synthesizer-Ping mit 0.08s kurzem Klick für moderne IDM-Farben.',
    volume: 0.40,
    settings: {
      drumPatch: { pitch: 72, decay: 0.08, tone: 0.34, drive: 0.14, volume: 0.40 }
    }
  },
  {
    id: 'perc-dub-conga',
    name: 'Dub Conga',
    role: 'drum',
    drumVoice: 'perc',
    category: 'Deep Techno',
    description: '46Hz resonante Handtrommel mit 0.22s Ausklang und weitem Bandecho-Raum.',
    volume: 0.46,
    settings: {
      drumPatch: { pitch: 46, decay: 0.22, tone: 0.18, drive: 0.08, volume: 0.46 }
    }
  },
  {
    id: 'perc-metal-rim-ping',
    name: 'Metal Rim Ping',
    role: 'drum',
    drumVoice: 'perc',
    category: 'Acoustic & Organic',
    description: '64Hz glockenartiger Kessel-Randanschlag mit strahlendem Ring.',
    volume: 0.38,
    settings: {
      drumPatch: { pitch: 64, decay: 0.16, tone: 0.28, drive: 0.06, volume: 0.38 }
    }
  },
  {
    id: 'perc-foley-raindrop',
    name: 'Foley Raindrop',
    role: 'drum',
    drumVoice: 'perc',
    category: 'Cinematic & Space',
    description: '52Hz zarter Wassertropfen / Zweig-Knack mit Mikro-Decay.',
    volume: 0.32,
    settings: {
      drumPatch: { pitch: 52, decay: 0.09, tone: 0.14, drive: 0.02, volume: 0.32 }
    }
  },
  {
    id: 'perc-analog-cowbell',
    name: '808 Cowbell',
    role: 'drum',
    drumVoice: 'perc',
    category: 'Retro Electro',
    description: '60Hz gestimmte Doppel-Transistor-Kuhglocke mit Vintage-Kultcharakter.',
    volume: 0.42,
    settings: {
      drumPatch: { pitch: 60, decay: 0.18, tone: 0.40, drive: 0.12, volume: 0.42 }
    }
  },

  // =========================================================================
  // CHORDS PRESETS (role: 'chords')
  // =========================================================================
  {
    id: 'chords-cell-solina',
    name: 'Cell Solina Ensemble',
    role: 'chords',
    category: 'Cell-Grade Ultimae',
    description: '70er Eminent BBD-Ensemble-Chorus: samtige Sägezähne mit breiter Stereo-Atmosphäre.',
    volume: 0.58,
    settings: {
      timbre: 'solina',
      chordPattern: 'pulse',
      chordPace: '2-bars',
      chordTexture: 'shimmer',
      density: 0.82
    }
  },
  {
    id: 'chords-dusty-rhodes',
    name: 'Dusty Rhodes EP',
    role: 'chords',
    category: 'Lo-Fi Chill',
    description: 'Warme Tines mit dezentem Tremolo-Flutter und analogem Bandsättigungs-Charakter.',
    volume: 0.64,
    settings: {
      timbre: 'keys',
      chordPattern: 'broken',
      chordPace: '2-bars',
      chordTexture: 'octave',
      density: 0.85
    }
  },
  {
    id: 'chords-celeste-hall',
    name: 'Felted Celeste',
    role: 'chords',
    category: 'Neo-Classical',
    description: 'Gefilztes Klavier trifft Celesta-Glocken: perkussiver Zupf-Attack und warmer Ausklang.',
    volume: 0.60,
    settings: {
      timbre: 'celeste',
      chordPattern: 'wave',
      chordPace: '2-bars',
      chordTexture: 'shimmer',
      density: 0.80
    }
  },
  {
    id: 'chords-ambient-wash',
    name: 'Ambient Wash Cloud',
    role: 'chords',
    category: 'Cinematic & Space',
    description: 'Endlos schwebendes Pad mit langsamem Anschwellen und weitem Kathedralen-Hall.',
    volume: 0.54,
    settings: {
      timbre: 'wash',
      chordPattern: 'pad',
      chordPace: '4-bars',
      chordTexture: 'shimmer',
      density: 0.78
    }
  },
  {
    id: 'chords-dub-stabs',
    name: 'Dub Techno Stabs',
    role: 'chords',
    category: 'Deep Techno',
    description: 'Gefilterte Moll-Akkord-Stabs mit bandverzögertem Raum-Echo auf die 16tel.',
    volume: 0.62,
    settings: {
      timbre: 'dub',
      chordPattern: 'syncopated',
      chordPace: '4-bars',
      chordTexture: 'off',
      density: 0.82
    }
  },
  {
    id: 'chords-shimmer-cathedral',
    name: 'Shimmer Cathedral',
    role: 'chords',
    category: 'Cell-Grade Ultimae',
    description: 'Kristalline Oktav-Begleitstimmen (+12st) mit schimmerndem Mikro-Timing-Delay.',
    volume: 0.56,
    settings: {
      timbre: 'shimmer',
      chordPattern: 'wave',
      chordPace: '4-bars',
      chordTexture: 'shimmer',
      density: 0.80
    }
  },
  {
    id: 'chords-nils-felt',
    name: 'Nordic Felt Hall',
    role: 'chords',
    category: 'Neo-Classical',
    description: 'Nils Frahm Ästhetik: intimer Klavier-Anschlag mit mechanischer Resonanz.',
    volume: 0.58,
    settings: {
      timbre: 'keys',
      chordPattern: 'broken',
      chordPace: '2-bars',
      chordTexture: 'sub5th',
      density: 0.76
    }
  },
  {
    id: 'chords-church-organ',
    name: 'Warm Pipe Organ',
    role: 'chords',
    category: 'Cinematic & Space',
    description: 'Sanfte Kirchenorgel-Flöten mit erhabenem, tragendem Akkord-Fundament.',
    volume: 0.52,
    settings: {
      timbre: 'organ',
      chordPattern: 'pad',
      chordPace: '4-bars',
      chordTexture: 'octave',
      density: 0.75
    }
  },

  // =========================================================================
  // MELODY PRESETS (role: 'melody')
  // =========================================================================
  {
    id: 'melody-celesta-bells',
    name: 'Celesta Bells',
    role: 'melody',
    category: 'Cell-Grade Ultimae',
    description: 'Luminöse Kristallglocken mit weitem Stereofeld und samtigem Obertonglanz.',
    volume: 0.42,
    settings: {
      timbre: 'celeste',
      density: 0.38
    }
  },
  {
    id: 'melody-glass-kalimba',
    name: 'Glass Kalimba',
    role: 'melody',
    category: 'Acoustic & Organic',
    description: 'Kristalline gezupfte Tines mit gläsernem Transienten-Attack und Luftigkeit.',
    volume: 0.40,
    settings: {
      timbre: 'glass',
      density: 0.42
    }
  },
  {
    id: 'melody-tape-flute',
    name: 'Mellotron Flute',
    role: 'melody',
    category: 'Vintage Soul',
    description: 'Analoge Bandflöte mit feinem Tonhöhen-Drift und nostalgischer Melancholie.',
    volume: 0.38,
    settings: {
      timbre: 'air',
      density: 0.32
    }
  },
  {
    id: 'melody-pure-sine',
    name: 'Pure Sine Whistle',
    role: 'melody',
    category: 'Lo-Fi Chill',
    description: 'Geschmeidiger Sinus-Lead mit sanftem Portamento-Feeling für soulige Soli.',
    volume: 0.36,
    settings: {
      timbre: 'bell',
      density: 0.35
    }
  },
  {
    id: 'melody-apollo-chime',
    name: 'Apollo Space Chime',
    role: 'melody',
    category: 'Cinematic & Space',
    description: 'Brian Eno Space Ambient: schwebende Glockensplitter im unendlichen Nachhall.',
    volume: 0.34,
    settings: {
      timbre: 'shimmer',
      density: 0.28
    }
  },
  {
    id: 'melody-nordic-felt',
    name: 'Nordic Felt Motif',
    role: 'melody',
    category: 'Neo-Classical',
    description: 'Sanfte melodische Klaviernoten mit menschlicher Velocity-Dynamik.',
    volume: 0.38,
    settings: {
      timbre: 'keys',
      density: 0.36
    }
  },
  {
    id: 'melody-analog-pluck',
    name: 'Analog Pluck Arp',
    role: 'melody',
    category: 'Modern IDM',
    description: 'Knackiger 24dB Filter-Pluck mit schnellem Zupf-Envelope für treibende Motive.',
    volume: 0.44,
    settings: {
      timbre: 'warm',
      density: 0.48
    }
  },

  // =========================================================================
  // DRONE PRESETS (role: 'drone')
  // =========================================================================
  {
    id: 'drone-deep-earth-root',
    name: 'Deep Earth Root',
    role: 'drone',
    category: 'Grounding & Sub',
    description: 'Fester Grundton-Anker mit harmonischem Oberton: verleiht dem gesamten Mix Stabilität.',
    volume: 0.52,
    settings: {
      timbre: 'root',
      density: 0.95
    }
  },
  {
    id: 'drone-granular-cloud',
    name: 'Granular Drift Cloud',
    role: 'drone',
    category: 'Cinematic & Space',
    description: 'Sanft wogender Granular-Nebel mit subtilen Obertönen und organischem Fluss.',
    volume: 0.48,
    settings: {
      timbre: 'air',
      ambientAlgorithm: 'granularDrift',
      density: 0.90
    }
  },
  {
    id: 'drone-cathedral-cello',
    name: 'Cathedral Bowed Cello',
    role: 'drone',
    category: 'Neo-Classical',
    description: 'Bogenstrich eines Solo-Cellos im sakralen Kathedralen-Raum.',
    volume: 0.50,
    settings: {
      timbre: 'strings',
      density: 0.88
    }
  },
  {
    id: 'drone-analog-swarm',
    name: 'Analog Swarm Pad',
    role: 'drone',
    category: 'Cell-Grade Ultimae',
    description: 'Dreifach verstimmte Sägezahn-Schwebung mit sanfter Phasen-Verschiebung.',
    volume: 0.46,
    settings: {
      timbre: 'solina',
      density: 0.90
    }
  },
  {
    id: 'drone-singing-bowl',
    name: 'Tibetan Singing Bowl',
    role: 'drone',
    category: 'Acoustic & Organic',
    description: 'Metallisch warmer Klangschalen-Grundton für tiefe Entspannung und Meditation.',
    volume: 0.44,
    settings: {
      timbre: 'glass',
      density: 0.82
    }
  },
  {
    id: 'drone-abyssal-sub',
    name: 'Abyssal Deep Sub',
    role: 'drone',
    category: 'Grounding & Sub',
    description: 'Subharmonischer Abgrund-Ton: phrygische Schwere und erhabene Tiefe.',
    volume: 0.54,
    settings: {
      timbre: 'warm',
      density: 0.92
    }
  }
];

/**
 * Filter presets for a specific channel strip.
 */
export function getInstrumentPresets(role: LayerRole, drumVoice?: DrumVoice): InstrumentPreset[] {
  if (role === 'drum') {
    return INSTRUMENT_PRESETS.filter(p => p.role === 'drum' && p.drumVoice === drumVoice);
  }
  return INSTRUMENT_PRESETS.filter(p => p.role === role);
}

/**
 * Lookup a preset by its unique ID.
 */
export function getInstrumentPresetById(id: string): InstrumentPreset | undefined {
  return INSTRUMENT_PRESETS.find(p => p.id === id);
}

/**
 * Detect which preset currently matches the layer settings most closely.
 */
export function detectActiveInstrumentPreset(layer: JamLayer): InstrumentPreset | undefined {
  const presets = getInstrumentPresets(layer.role, layer.drumVoice);
  if (presets.length === 0) return undefined;

  if (layer.role === 'drum') {
    // Match by drumVoice patch pitch or first preset
    return presets.find(p => {
      const pPitch = p.settings.drumPatch?.pitch;
      const lPitch = layer.settings.drumPatch?.pitch;
      return pPitch !== undefined && lPitch !== undefined && Math.abs(pPitch - lPitch) <= 2;
    }) || presets[0];
  }

  // For tonal layers, match by timbre or audioPatch characteristics
  return presets.find(p => p.settings.timbre === layer.settings.timbre) || presets[0];
}

/**
 * Apply a preset to a layer within a session, returning an updated session immutably.
 */
export function applyInstrumentPreset(
  session: JamSession,
  layerId: string,
  presetId: string
): JamSession {
  const preset = getInstrumentPresetById(presetId);
  if (!preset) return session;

  const layers = session.layers.map(layer => {
    if (layer.id !== layerId) return layer;

    const mergedSettings: LayerSettings = {
      ...layer.settings,
      ...preset.settings,
      audioPatch: {
        ...(layer.settings.audioPatch || {}),
        ...(preset.settings.audioPatch || {})
      },
      drumPatch: {
        ...(layer.settings.drumPatch || {}),
        ...(preset.settings.drumPatch || {})
      }
    };

    return {
      ...layer,
      volume: preset.volume !== undefined ? preset.volume : layer.volume,
      settings: mergedSettings
    };
  });

  return {
    ...session,
    layers
  };
}

/**
 * Fast cycle to next/previous preset for a channel strip.
 */
export function cycleInstrumentPreset(
  session: JamSession,
  layerId: string,
  direction: 1 | -1
): { session: JamSession; preset: InstrumentPreset } | null {
  const layer = session.layers.find(l => l.id === layerId);
  if (!layer) return null;

  const presets = getInstrumentPresets(layer.role, layer.drumVoice);
  if (presets.length === 0) return null;

  const active = detectActiveInstrumentPreset(layer);
  let currentIndex = active ? presets.findIndex(p => p.id === active.id) : 0;
  if (currentIndex === -1) currentIndex = 0;

  const nextIndex = (currentIndex + direction + presets.length) % presets.length;
  const targetPreset = presets[nextIndex];

  return {
    session: applyInstrumentPreset(session, layerId, targetPreset.id),
    preset: targetPreset
  };
}

/**
 * Pick a random preset for a specific channel strip.
 */
export function randomizeInstrumentPreset(
  session: JamSession,
  layerId: string
): { session: JamSession; preset: InstrumentPreset } | null {
  const layer = session.layers.find(l => l.id === layerId);
  if (!layer) return null;

  const presets = getInstrumentPresets(layer.role, layer.drumVoice);
  if (presets.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * presets.length);
  const targetPreset = presets[randomIndex];

  return {
    session: applyInstrumentPreset(session, layerId, targetPreset.id),
    preset: targetPreset
  };
}
