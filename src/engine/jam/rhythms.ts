import type { JamLayer } from '../../types/jam';

export interface RhythmPreset {
  id: string;
  name: string;
  artistInspiration: string;
  genre: string;
  description: string;
  explanation: string;
  swing?: number;
  drumLayers: {
    kick?: Partial<JamLayer['settings']> & { muted?: boolean; volume?: number };
    snare?: Partial<JamLayer['settings']> & { muted?: boolean; volume?: number };
    hihat?: Partial<JamLayer['settings']> & { muted?: boolean; volume?: number };
    perc?: Partial<JamLayer['settings']> & { muted?: boolean; volume?: number };
  };
}

export const RHYTHM_POOL: RhythmPreset[] = [
  {
    id: 'cbl-psybient',
    name: 'CBL Psybient Pulse',
    artistInspiration: 'Carbon Based Lifeforms',
    genre: 'Psybient / Ambient Downtempo',
    description: '7/8 Polymetrischer Shaker mit organischen Density-Bursts und sanft rollendem Sub-Puls.',
    explanation: 'Polymetrie lässt die Hi-Hat in einer 7-Schritt-Schleife über das 16-Schritt-Taktraster laufen. Dadurch verschiebt sich der Akzent in jedem Takt kontinuierlich und erzeugt die typische schwebende Hypnose von CBL, ohne je langweilig zu werden. Perfekt für lange Improvisationen mit sanften Pads.',
    swing: 0.14,
    drumLayers: {
      kick: { rhythmAlgorithm: 'composed', density: 0.55, humanizeMs: 6, muted: false, volume: 0.78 },
      snare: { rhythmAlgorithm: 'probabilistic', density: 0.35, humanizeMs: 8, muted: false, volume: 0.32 },
      hihat: { rhythmAlgorithm: 'polymetric', density: 0.72, humanizeMs: 5, muted: false, volume: 0.42 },
      perc: { rhythmAlgorithm: 'densityBurst', density: 0.58, humanizeMs: 12, muted: false, volume: 0.36 },
    },
  },
  {
    id: 'aes-dana-dub',
    name: 'Aes Dana Slow Techno',
    artistInspiration: 'Aes Dana · Ultimae Records',
    genre: 'Deep Hypnotic Techno',
    description: '4-on-the-Floor Fundament mit versetzten Offbeat-Hats und delay-gesättigter Perkussion.',
    explanation: 'Ein tiefer 4/4 Kick auf jeder Viertelnote, gepaart mit synkopierten Offbeat-Hi-Hats und polymetrischen Delay-Taps. Der Kick duckt über den Pump-Regler die Synth-Pads weg, sodass der gesamte Track organisch wie eine Lunge atmet.',
    swing: 0.08,
    drumLayers: {
      kick: { rhythmAlgorithm: 'composed', density: 0.95, humanizeMs: 3, muted: false, volume: 0.92 },
      snare: { rhythmAlgorithm: 'probabilistic', density: 0.42, humanizeMs: 5, muted: false, volume: 0.38 },
      hihat: { rhythmAlgorithm: 'probabilistic', density: 0.82, humanizeMs: 4, muted: false, volume: 0.38 },
      perc: { rhythmAlgorithm: 'polymetric', density: 0.62, humanizeMs: 7, muted: false, volume: 0.44 },
    },
  },
  {
    id: 'euclidean-interlock',
    name: 'Euclidean Interlock',
    artistInspiration: 'Steve Reich · Polyrhythmic Minimal',
    genre: 'Polyrhythmic Minimal',
    description: 'Mathematisch ideal verteilte Pulse (5/16 Kick, 11/16 Hat, 7/16 Perc).',
    explanation: 'Der Euklidische Rhythmus E(k, n) verteilt k Impulse so gleichmäßig wie möglich auf n Zeitschritte (wie in traditioneller westafrikanischer Glockenmusik). Die einzelnen Trommelstimmen greifen wie Zahnräder ineinander, ohne sich gegenseitig zu maskieren.',
    swing: 0.06,
    drumLayers: {
      kick: { rhythmAlgorithm: 'euclidean', density: 0.65, humanizeMs: 4, muted: false, volume: 0.82 },
      snare: { rhythmAlgorithm: 'euclidean', density: 0.38, humanizeMs: 5, muted: false, volume: 0.35 },
      hihat: { rhythmAlgorithm: 'euclidean', density: 0.85, humanizeMs: 4, muted: false, volume: 0.34 },
      perc: { rhythmAlgorithm: 'euclidean', density: 0.72, humanizeMs: 6, muted: false, volume: 0.40 },
    },
  },
  {
    id: 'lofi-backbeat',
    name: 'Lo-Fi Lazy Swing',
    artistInspiration: 'J Dilla · ChilledCow',
    genre: 'Lo-Fi Hip-Hop / Beatmaking',
    description: 'Schläfriger 38% Swing mit Geisternoten auf Snare und unquantisiertem Fingerdrumming.',
    explanation: 'Hoher Swing-Wert (38 %) verzögert jede zweite 16tel-Note spürbar. Zusätzliches Humanize-Jitter von 14 ms bricht das starre Computerraster auf. Ideal für entspannte E-Piano Seventh-Akkorde und Pentatonik-Soli.',
    swing: 0.38,
    drumLayers: {
      kick: { rhythmAlgorithm: 'composed', density: 0.68, humanizeMs: 12, muted: false, volume: 0.85 },
      snare: { rhythmAlgorithm: 'markov', density: 0.62, humanizeMs: 15, muted: false, volume: 0.62 },
      hihat: { rhythmAlgorithm: 'composed', density: 0.75, humanizeMs: 14, muted: false, volume: 0.45 },
      perc: { rhythmAlgorithm: 'probabilistic', density: 0.44, humanizeMs: 18, muted: false, volume: 0.32 },
    },
  },
  {
    id: 'markov-organic',
    name: 'Markov Stochastic Flow',
    artistInspiration: 'Autechre · Generative IDM',
    genre: 'Generative IDM / Downtempo',
    description: 'Stochastische Zustandsübergänge: Treffer, Geisternote, Akzent oder Pause.',
    explanation: 'Eine Markov-Kette erster Ordnung berechnet bei jedem Schritt anhand einer Wahrscheinlichkeitsmatrix die Wahrscheinlichkeit für Hit, Ghost, Akzent oder Rest. Die Drums wiederholen sich nicht starr, sondern wandern wie ein echter Schlagzeuger durch subtile Variationen.',
    swing: 0.18,
    drumLayers: {
      kick: { rhythmAlgorithm: 'markov', density: 0.65, humanizeMs: 7, muted: false, volume: 0.80 },
      snare: { rhythmAlgorithm: 'markov', density: 0.55, humanizeMs: 9, muted: false, volume: 0.36 },
      hihat: { rhythmAlgorithm: 'markov', density: 0.80, humanizeMs: 6, muted: false, volume: 0.35 },
      perc: { rhythmAlgorithm: 'markov', density: 0.68, humanizeMs: 10, muted: false, volume: 0.38 },
    },
  },
  {
    id: 'ambient-micro',
    name: 'Ambient Floating Bells',
    artistInspiration: 'Brian Eno · Solar Fields',
    genre: 'Pure Ambient / Space Music',
    description: 'Sehr spärliche Klicks, kaum Kick, weite perkussive Reflexionen im Raum.',
    explanation: 'Kick und Snare treten fast völlig zurück, während Glocken- und Holzperkussionen (9/16 Polymetrie) vereinzelt Akzente setzen. Dadurch bleibt maximaler Raum für schwebende Texturen und meditative Akkordwechsel.',
    swing: 0.02,
    drumLayers: {
      kick: { rhythmAlgorithm: 'probabilistic', density: 0.18, humanizeMs: 6, muted: false, volume: 0.35 },
      snare: { rhythmAlgorithm: 'probabilistic', density: 0.10, humanizeMs: 8, muted: true, volume: 0.20 },
      hihat: { rhythmAlgorithm: 'densityBurst', density: 0.35, humanizeMs: 8, muted: false, volume: 0.22 },
      perc: { rhythmAlgorithm: 'polymetric', density: 0.52, humanizeMs: 10, muted: false, volume: 0.42 },
    },
  },
  {
    id: 'density-burst',
    name: 'Density Burst Swarm',
    artistInspiration: 'Jon Hopkins · Max Cooper',
    genre: 'Organic Electronica',
    description: 'Schwärme aus Noten-Clustern, die auf Bewegung und Filteröffnung reagieren.',
    explanation: 'Der DensityBurst-Algorithmus erzeugt fraktale Impulse: Ein einzelner Anschlag löst dichte Kaskaden aus, die wieder abklingen. Perfekt, um dynamische Spannungsbögen aufzubauen, ohne dass es mechanisch klingt.',
    swing: 0.12,
    drumLayers: {
      kick: { rhythmAlgorithm: 'composed', density: 0.75, humanizeMs: 5, muted: false, volume: 0.84 },
      snare: { rhythmAlgorithm: 'densityBurst', density: 0.58, humanizeMs: 8, muted: false, volume: 0.38 },
      hihat: { rhythmAlgorithm: 'densityBurst', density: 0.78, humanizeMs: 6, muted: false, volume: 0.38 },
      perc: { rhythmAlgorithm: 'densityBurst', density: 0.70, humanizeMs: 9, muted: false, volume: 0.42 },
    },
  },
];

export function findRhythmPreset(id: string): RhythmPreset | undefined {
  return RHYTHM_POOL.find(p => p.id === id);
}
