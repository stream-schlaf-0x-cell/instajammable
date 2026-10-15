import type { SequenceBlock } from '../../types/jam';

export interface SequenceTemplate {
  id: string;
  name: string;
  description: string;
  blocks: Array<Omit<SequenceBlock, 'id'>>;
}

export const SEQUENCE_TEMPLATES: SequenceTemplate[] = [
  {
    id: 'four-bars-flow',
    name: '4 Takte Dies & Jenes (Flow)',
    description: '4 Takte Beat, 4 Takte schwebender Breakdown, 4 Takte Steigerung, 4 Takte voller Chorus.',
    blocks: [
      { section: 'groove', bars: 4, label: '4T Voller Beat', macroTargets: { movement: 0.35, density: 0.55, warmth: 0.60, space: 0.50 } },
      { section: 'breakdown', bars: 4, label: '4T Breakdown · Streicher im Hall', macroTargets: { movement: 0.25, density: 0.28, warmth: 0.70, space: 0.86 } },
      { section: 'buildup', bars: 4, label: '4T Buildup · Spannungsaufbau', macroTargets: { movement: 0.65, density: 0.72, warmth: 0.65, space: 0.60 } },
      { section: 'chorus', bars: 4, label: '4T Chorus · Peak & Energie', macroTargets: { movement: 0.50, density: 0.80, warmth: 0.75, space: 0.72 } },
    ]
  },
  {
    id: 'slow-symphonic',
    name: 'Slow Symphonic Evolution',
    description: 'Langsam morphend: 16 Takte Streicher & Hall, 16 Takte Beat, 8 Takte Buildup, 16 Takte Peak.',
    blocks: [
      { section: 'silent', bars: 16, label: '16T Stille · Große Streicher & Hall', macroTargets: { movement: 0.20, density: 0.22, warmth: 0.72, space: 0.90 } },
      { section: 'breakdown', bars: 16, label: '16T Breakdown · Flächen schwellen an', macroTargets: { movement: 0.30, density: 0.35, warmth: 0.70, space: 0.84 } },
      { section: 'groove', bars: 16, label: '16T Hypnotischer Beat schleicht ein', macroTargets: { movement: 0.38, density: 0.52, warmth: 0.62, space: 0.60 } },
      { section: 'buildup', bars: 8, label: '8T Lange Steigerung vor dem Drop', macroTargets: { movement: 0.70, density: 0.75, warmth: 0.68, space: 0.65 } },
      { section: 'chorus', bars: 16, label: '16T Symphonischer Höhepunkt', macroTargets: { movement: 0.55, density: 0.82, warmth: 0.78, space: 0.80 } },
      { section: 'breakdown', bars: 8, label: '8T Sanfter Ausklang im Raum', macroTargets: { movement: 0.24, density: 0.30, warmth: 0.68, space: 0.88 } },
    ]
  },
  {
    id: 'cbl-journey',
    name: 'CBL Psybient Journey',
    description: 'Atmosphärischer Einstieg, hypnotischer 7/8 Beat, tiefe Pause und voller Ausbruch.',
    blocks: [
      { section: 'silent', bars: 8, label: '8T Psybient Pad Drift', macroTargets: { movement: 0.28, density: 0.25, warmth: 0.65, space: 0.82 } },
      { section: 'groove', bars: 16, label: '16T Hypnotischer Groove & Bass', macroTargets: { movement: 0.42, density: 0.58, warmth: 0.68, space: 0.68 } },
      { section: 'breakdown', bars: 8, label: '8T Drum-Ausstieg & Echo-Fahnen', macroTargets: { movement: 0.30, density: 0.32, warmth: 0.70, space: 0.85 } },
      { section: 'buildup', bars: 4, label: '4T Shaker-Roll & Filteröffnung', macroTargets: { movement: 0.68, density: 0.70, warmth: 0.65, space: 0.65 } },
      { section: 'chorus', bars: 16, label: '16T Volle Synthese & Weite', macroTargets: { movement: 0.52, density: 0.78, warmth: 0.74, space: 0.78 } },
    ]
  },
  {
    id: 'minimal-dub',
    name: 'Minimal Deep Dub Flow',
    description: '8 Takte Sub-Groove, 4 Takte Echo-Breakdown, 8 Takte voller Beat.',
    blocks: [
      { section: 'groove', bars: 8, label: '8T Deep Dub 4-on-the-Floor', macroTargets: { movement: 0.38, density: 0.62, warmth: 0.65, space: 0.65 } },
      { section: 'breakdown', bars: 4, label: '4T Echo-Kammer · Drums weg', macroTargets: { movement: 0.28, density: 0.30, warmth: 0.68, space: 0.85 } },
      { section: 'groove', bars: 8, label: '8T Beat Drop & Bassline', macroTargets: { movement: 0.40, density: 0.64, warmth: 0.66, space: 0.66 } },
      { section: 'silent', bars: 4, label: '4T Tiefer Raum & Nachhall', macroTargets: { movement: 0.20, density: 0.20, warmth: 0.60, space: 0.82 } },
    ]
  }
];

export function createDefaultSequence(): SequenceBlock[] {
  return SEQUENCE_TEMPLATES[0].blocks.map((b, i) => ({
    id: `seq-block-${i + 1}`,
    ...b,
  }));
}

export function findSequenceTemplate(id: string): SequenceTemplate | undefined {
  return SEQUENCE_TEMPLATES.find(t => t.id === id);
}
