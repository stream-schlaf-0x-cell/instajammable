export type UiEdition = 'classic' | 'minimal';

export type LayoutVariant =
  | 'console'
  | 'split'
  | 'stage'
  | 'grid'
  | 'groovebox'
  | 'orbit'
  | 'patchbay'
  | 'synesthesia';

export const LAYOUT_OPTIONS: ReadonlyArray<{
  id: LayoutVariant;
  classicLabel: string;
  minimalLabel: string;
  description: string;
  experimental?: boolean;
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
  {
    id: 'orbit',
    classicLabel: '6 · Orbit ★',
    minimalLabel: '6 · Orbit ★',
    description: 'Harmonic solar system: concentric layer rings, step flares & gravity macros',
    experimental: true,
  },
  {
    id: 'patchbay',
    classicLabel: '7 · Patchbay ★',
    minimalLabel: '7 · Patchbay ★',
    description: 'Live modular signal flow: interactive generator, track & FX cable graph',
    experimental: true,
  },
  {
    id: 'synesthesia',
    classicLabel: '8 · Synesthesia ★',
    minimalLabel: '8 · Synesthesia ★',
    description: '3D horizon aurora, melodic starfield, dual XY pads & luminous track totems',
    experimental: true,
  },
];

export type ThemePresetId =
  | 'forest'
  | 'obsidian'
  | 'cobalt'
  | 'synthwave'
  | 'copper'
  | 'nordic'
  | 'monochrome'
  | 'paper'
  | 'custom';

export interface CustomThemeColors {
  bg: string;
  accent: string;
  accent2: string;
}

export interface StudioThemePreset {
  id: Exclude<ThemePresetId, 'custom'>;
  name: string;
  classicName: string;
  isLight?: boolean;
  bg: string;
  surface: string;
  surfaceHigh: string;
  surfaceInset: string;
  line: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
}

export const DEFAULT_CUSTOM_THEME: CustomThemeColors = {
  bg: '#111315',
  accent: '#e5b374',
  accent2: '#7ecfb8',
};

export const STUDIO_THEMES: ReadonlyArray<StudioThemePreset> = [
  {
    id: 'forest',
    name: 'Studio Forest',
    classicName: 'Studio Wald',
    bg: '#111315',
    surface: '#191c1e',
    surfaceHigh: '#202326',
    surfaceInset: '#121518',
    line: '#33383a',
    text: '#edebe7',
    muted: '#aaa79f',
    accent: '#e5b374',
    accent2: '#7ecfb8',
  },
  {
    id: 'obsidian',
    name: 'Obsidian Gold',
    classicName: 'Obsidian Gold',
    bg: '#0d0e11',
    surface: '#15171d',
    surfaceHigh: '#1d2028',
    surfaceInset: '#0f1116',
    line: '#2e3340',
    text: '#f2efe9',
    muted: '#a4a7b3',
    accent: '#f0b865',
    accent2: '#89c2f7',
  },
  {
    id: 'cobalt',
    name: 'Deep Cobalt',
    classicName: 'Tiefkobalt',
    bg: '#0b111d',
    surface: '#111a2c',
    surfaceHigh: '#18243c',
    surfaceInset: '#0c1321',
    line: '#293a59',
    text: '#eaf1fb',
    muted: '#97aac8',
    accent: '#ffb56b',
    accent2: '#5de4c7',
  },
  {
    id: 'synthwave',
    name: 'Neon Dusk',
    classicName: 'Neon Abend',
    bg: '#120d1a',
    surface: '#1b1428',
    surfaceHigh: '#261c37',
    surfaceInset: '#140f1e',
    line: '#3c2c56',
    text: '#f5ecff',
    muted: '#b5a2cf',
    accent: '#ff70a6',
    accent2: '#58e6ff',
  },
  {
    id: 'copper',
    name: 'Tape Copper',
    classicName: 'Band-Kupfer',
    bg: '#15110e',
    surface: '#1f1814',
    surfaceHigh: '#2a211b',
    surfaceInset: '#16110d',
    line: '#40332a',
    text: '#f3ece4',
    muted: '#b4a396',
    accent: '#ea9b52',
    accent2: '#7ec9a6',
  },
  {
    id: 'nordic',
    name: 'Nordic Slate',
    classicName: 'Nordic Schiefer',
    bg: '#13181c',
    surface: '#1b2228',
    surfaceHigh: '#242d35',
    surfaceInset: '#141a1f',
    line: '#33404b',
    text: '#ecf2f7',
    muted: '#9fb0bd',
    accent: '#8cd3ff',
    accent2: '#ffd28c',
  },
  {
    id: 'monochrome',
    name: 'Graphite Mono',
    classicName: 'Graphit Mono',
    bg: '#101012',
    surface: '#18181b',
    surfaceHigh: '#232328',
    surfaceInset: '#111114',
    line: '#34343b',
    text: '#f4f4f5',
    muted: '#a1a1aa',
    accent: '#f4f4f5',
    accent2: '#a8b3cf',
  },
  {
    id: 'paper',
    name: 'Daylight Paper',
    classicName: 'Tageslicht Papier',
    isLight: true,
    bg: '#efeae1',
    surface: '#fbf9f5',
    surfaceHigh: '#f0ebe1',
    surfaceInset: '#e4ddd0',
    line: '#cbc2b3',
    text: '#1c1b18',
    muted: '#666055',
    accent: '#c26518',
    accent2: '#137c6f',
  },
];

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace('#', '');
  const norm =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const n = Number.parseInt(norm, 16);
  if (!Number.isFinite(n)) return [17, 19, 21];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clampByte(r), clampByte(g), clampByte(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

function mixHex(a: string, b: string, weightB: number): string {
  const [ar, ag, ab] = parseHexRgb(a);
  const [br, bg, bb] = parseHexRgb(b);
  const t = Math.max(0, Math.min(1, weightB));
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function isLightHex(hex: string): boolean {
  const [r, g, b] = parseHexRgb(hex);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.52;
}

export function resolveThemeTokens(
  themeId: ThemePresetId,
  custom: CustomThemeColors,
): StudioThemePreset {
  if (themeId !== 'custom') {
    return STUDIO_THEMES.find((t) => t.id === themeId) ?? STUDIO_THEMES[0];
  }
  const bg = custom.bg || DEFAULT_CUSTOM_THEME.bg;
  const accent = custom.accent || DEFAULT_CUSTOM_THEME.accent;
  const accent2 = custom.accent2 || DEFAULT_CUSTOM_THEME.accent2;
  const light = isLightHex(bg);
  if (light) {
    return {
      id: 'paper',
      name: 'Custom',
      classicName: 'Eigene Farben',
      isLight: true,
      bg,
      surface: mixHex(bg, '#ffffff', 0.65),
      surfaceHigh: mixHex(bg, '#ffffff', 0.25),
      surfaceInset: mixHex(bg, '#000000', 0.06),
      line: mixHex(bg, '#000000', 0.19),
      text: '#181816',
      muted: mixHex(bg, '#000000', 0.56),
      accent,
      accent2,
    };
  }
  return {
    id: 'forest',
    name: 'Custom',
    classicName: 'Eigene Farben',
    isLight: false,
    bg,
    surface: mixHex(bg, '#ffffff', 0.055),
    surfaceHigh: mixHex(bg, '#ffffff', 0.1),
    surfaceInset: mixHex(bg, '#000000', 0.18),
    line: mixHex(bg, '#ffffff', 0.18),
    text: '#efece6',
    muted: mixHex(bg, '#ffffff', 0.58),
    accent,
    accent2,
  };
}

export function applyThemeToDocument(themeId: ThemePresetId, custom: CustomThemeColors): void {
  if (typeof document === 'undefined') return;
  const tokens = resolveThemeTokens(themeId, custom);
  const root = document.documentElement;
  root.style.setProperty('--bg', tokens.bg);
  root.style.setProperty('--surface', tokens.surface);
  root.style.setProperty('--surface-high', tokens.surfaceHigh);
  root.style.setProperty('--surface-inset', tokens.surfaceInset);
  root.style.setProperty('--line', tokens.line);
  root.style.setProperty('--text', tokens.text);
  root.style.setProperty('--muted', tokens.muted);
  root.style.setProperty('--amber', tokens.accent);
  root.style.setProperty('--accent', tokens.accent);
  root.style.setProperty('--accent-2', tokens.accent2);
  root.style.colorScheme = tokens.isLight ? 'light' : 'dark';
  root.dataset.theme = themeId;
}
