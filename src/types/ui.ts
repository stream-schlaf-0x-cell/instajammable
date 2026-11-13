export type UiEdition = 'classic' | 'minimal';

export type LayoutVariant = 'console' | 'split' | 'stage' | 'grid' | 'groovebox';

export const LAYOUT_OPTIONS: ReadonlyArray<{
  id: LayoutVariant;
  classicLabel: string;
  minimalLabel: string;
  description: string;
}> = [
  {
    id: 'console',
    classicLabel: '1 · Console',
    minimalLabel: '1 · Console',
    description: 'Classic vertical rack with top bar, macros, mixer and tool drawers',
  },
  {
    id: 'split',
    classicLabel: '2 · Split',
    minimalLabel: '2 · Split',
    description: 'Left: Chords, Macros & Piano Roll · Right: Mixer & Tools side by side',
  },
  {
    id: 'stage',
    classicLabel: '3 · Focus Stage',
    minimalLabel: '3 · Stage',
    description: 'Clean jam stage with giant chords, track pills & slide-over inspector',
  },
  {
    id: 'grid',
    classicLabel: '4 · Command Grid',
    minimalLabel: '4 · Grid',
    description: '2×2 cockpit with Harmony, Mixer, Macros and Piano Roll visible at once',
  },
  {
    id: 'groovebox',
    classicLabel: '5 · Groovebox',
    minimalLabel: '5 · Groovebox',
    description: 'Hardware pad workflow: select a track pad to sculpt its sound',
  },
];
