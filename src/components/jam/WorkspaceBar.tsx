import { SlidersHorizontal, Music2, Waves, Activity, Sparkles, Wand2, Compass, Layers, Disc3, Sliders, LayoutGrid, Tv } from 'lucide-react';
import { JamEngine } from '../../engine/jam/JamEngine';
import { WORKSPACE_PRESETS } from '../../engine/jam/customMacros';
import { useUiEdition } from '../../contexts/UiEditionContext';
import type { JamSession, WorkspaceModuleId } from '../../types/jam';

const engine = JamEngine.getInstance();

export type ViewDensityMode = 'compact' | 'standard' | 'distance';

interface ModuleMeta {
  id: WorkspaceModuleId;
  label: string;
  enLabel: string;
  shortLabel: string;
  enShortLabel: string;
  icon: typeof Music2;
  description: string;
  enDescription: string;
}

const MODULE_DEFINITIONS: ModuleMeta[] = [
  { id: 'pianoroll', label: 'Noten & Ensemble', enLabel: 'Notes & Ensemble', shortLabel: 'Noten', enShortLabel: 'Notes', icon: Music2, description: 'Interaktive Pianorolle und Layer-Mischpult', enDescription: 'Interactive piano roll and layer mixer' },
  { id: 'custommacros', label: 'Eigene Makros', enLabel: 'Custom Macros', shortLabel: 'Makros', enShortLabel: 'Macros', icon: SlidersHorizontal, description: 'Selbsterstellte Multi-Parameter-Regler', enDescription: 'User-defined multi-parameter controls' },
  { id: 'eq', label: 'Studio-EQ & Low-Cut', enLabel: 'EQ & Low-Cut', shortLabel: 'Studio-EQ', enShortLabel: 'EQ', icon: Sliders, description: '3-Band Parametrischer Master-EQ mit Low-Cut & Frequenzgang', enDescription: '3-band parametric master EQ with highpass filter' },
  { id: 'soundscape', label: 'Klangwelt & Streicher', enLabel: 'Soundscape & Chords', shortLabel: 'Klangwelt', enShortLabel: 'Soundscape', icon: Compass, description: 'Großes Streichorchester, Hall & aufeinander abgestimmte Chords', enDescription: 'Dual-chord voicing architecture, reverb and atmosphere link' },
  { id: 'sequencer', label: 'Sequencer (4 Takte)', enLabel: 'Sequencer', shortLabel: 'Sequencer', enShortLabel: 'Sequencer', icon: Activity, description: 'Verlaufskette: 4 Takte dies, 4 Takte jenes', enDescription: 'Block-based arrangement timeline' },
  { id: 'fxchain', label: 'Modulare FX-Kette', enLabel: 'FX Chain', shortLabel: 'FX-Kette', enShortLabel: 'FX Chain', icon: Waves, description: 'Effekt-Signalfluss, Routing (Delay ➔ Reverb) & Bypass', enDescription: 'Signal routing (Delay/Reverb order) and module bypass' },
  { id: 'chaos', label: 'Chaos & Organischer Drift', enLabel: 'Chaos & Drift', shortLabel: 'Chaos', enShortLabel: 'Drift', icon: Sparkles, description: 'Wandernder Attraktor, 2D-Drift & spontane Impulse', enDescription: '2D attractor modulating motion and space' },
  { id: 'atmosphere', label: 'Textur & Kick-Atmung', enLabel: 'Texture & Flow', shortLabel: 'Textur', enShortLabel: 'Texture', icon: Wand2, description: 'Hintergrund-Bett (max 10%) und Ducking', enDescription: 'Background texture layer, sidechain ducking and auto-flow' },
  { id: 'rhythms', label: 'Rhythmus-Pool', enLabel: 'Rhythm Engine', shortLabel: 'Rhythmen', enShortLabel: 'Rhythms', icon: Layers, description: 'Generative Rhythmus-Algorithmen (Euclidean, Markov, CBL)', enDescription: 'Generative rhythm algorithms (Euclidean, Markov, Ambient Pulse)' },
  { id: 'scenes', label: 'Szenen (24)', enLabel: 'Scenes (24)', shortLabel: 'Szenen', enShortLabel: 'Scenes', icon: Disc3, description: '24 kuratierte musikalische Ausgangspunkte', enDescription: '24 curated musical starting presets' },
];

const MINIMAL_WORKSPACE_PRESETS: Record<string, { label: string; description: string }> = {
  minimal: { label: 'Minimal Flow', description: 'Chord stage, piano roll and core macros.' },
  soundscape: { label: 'Soundscape & FX', description: 'Chords, EQ, FX chain, drift and texture.' },
  arrangement: { label: 'Arrangement & Flow', description: 'Sequencer, rhythms and soundscape.' },
  full: { label: 'Full Studio', description: 'All modules open.' },
};

export function WorkspaceBar({
  session,
  viewMode = 'compact',
  onViewModeChange,
}: {
  session: JamSession;
  viewMode?: ViewDensityMode;
  onViewModeChange?: (mode: ViewDensityMode) => void;
}) {
  const isMinimal = useUiEdition() === 'minimal';
  const activeModules = session.workspaceModules || [
    'pianoroll',
    'soundscape',
    'sequencer',
    'fxchain',
    'custommacros',
    'atmosphere',
  ];

  const setPreset = (presetKey: keyof typeof WORKSPACE_PRESETS) => {
    const preset = WORKSPACE_PRESETS[presetKey];
    if (!preset) return;
    engine.setWorkspaceModules(preset.modules);
  };

  const toggleModule = (id: WorkspaceModuleId) => {
    engine.toggleWorkspaceModule(id);
  };

  return (
    <nav className="workspace-deck" aria-label={isMinimal ? 'Workspace Layout' : 'Arbeitsbereich anpassen'}>
      <div className="workspace-bar-top">
        <div className="workspace-title-row">
          <div className="workspace-heading">
            <span className="eyebrow">{isMinimal ? 'WORKSPACE' : 'DEIN ARBEITSBEREICH'}</span>
            <h2>{isMinimal ? 'Modules & View Density' : 'Alle Optionen da – du entscheidest, was offen ist.'}</h2>
          </div>
          <div className="workspace-counter">
            <span className="counter-pill">
              {isMinimal
                ? `${activeModules.length} of ${MODULE_DEFINITIONS.length} active`
                : `${activeModules.length} von ${MODULE_DEFINITIONS.length} Modulen aktiv`}
            </span>
          </div>
        </div>

        {/* View Density / Distance Selector */}
        {onViewModeChange && (
          <div className="view-mode-selector" role="group" aria-label={isMinimal ? 'View mode' : 'Ansichts-Modus'}>
            <span className="preset-label">{isMinimal ? 'Mode:' : 'Modus:'}</span>
            <button
              type="button"
              className={'button view-mode-btn ' + (viewMode === 'compact' ? 'active' : '')}
              onClick={() => onViewModeChange('compact')}
              title={isMinimal ? 'Compact layout: dense view for large screens' : 'Kompakt-Layout: Mehr Optionen auf einen Blick, optimiert für große Bildschirme'}
            >
              <LayoutGrid size={13} />
              <span>{isMinimal ? 'Compact' : 'Kompakt (Mehr im Blick)'}</span>
            </button>
            <button
              type="button"
              className={'button view-mode-btn ' + (viewMode === 'standard' ? 'active' : '')}
              onClick={() => onViewModeChange('standard')}
              title={isMinimal ? 'Standard studio spacing' : 'Klassische Studio-Abstände'}
            >
              <span>Standard</span>
            </button>
            <button
              type="button"
              className={'button view-mode-btn distance-btn ' + (viewMode === 'distance' ? 'active' : '')}
              onClick={() => onViewModeChange('distance')}
              title={isMinimal ? 'Distance mode: large HUD for viewing from afar' : 'Distanz-Modus: Große Signale und HUD für 2–3 Meter Entfernung'}
            >
              <Tv size={13} />
              <span>{isMinimal ? 'Distance HUD' : 'Distanz (2–3m)'}</span>
            </button>
          </div>
        )}

        {/* Quick View Presets */}
        <div className="workspace-presets-row" role="group" aria-label={isMinimal ? 'Workspace presets' : 'Arbeitsbereich-Vorlagen'}>
          <span className="preset-label">Presets:</span>
          {Object.entries(WORKSPACE_PRESETS).map(([key, p]) => {
            const isMatch = p.modules.length === activeModules.length && p.modules.every(m => activeModules.includes(m));
            const minPreset = MINIMAL_WORKSPACE_PRESETS[key];
            return (
              <button
                key={key}
                type="button"
                className={'button workspace-preset-btn ' + (isMatch ? 'active' : '')}
                onClick={() => setPreset(key as keyof typeof WORKSPACE_PRESETS)}
                title={isMinimal && minPreset ? minPreset.description : p.description}
              >
                {isMinimal && minPreset ? minPreset.label : p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Module Toggle Chips */}
      <div className="workspace-chips-grid" role="toolbar" aria-label={isMinimal ? 'Toggle modules' : 'Module umschalten'}>
        {MODULE_DEFINITIONS.map(mod => {
          const isActive = activeModules.includes(mod.id);
          const Icon = mod.icon;
          const desc = isMinimal ? mod.enDescription : mod.description;
          return (
            <button
              key={mod.id}
              type="button"
              className={'workspace-chip ' + (isActive ? 'active' : 'inactive')}
              onClick={() => toggleModule(mod.id)}
              aria-pressed={isActive}
              title={isMinimal
                ? `${desc} (${isActive ? 'Click to hide' : 'Click to show'})`
                : `${desc} (${isActive ? 'Klicken zum Schließen' : 'Klicken zum Öffnen'})`}
            >
              <span className={'chip-led ' + (isActive ? 'on' : 'off')} />
              <Icon size={14} className="chip-icon" />
              <span className="chip-label">{isMinimal ? mod.enShortLabel : mod.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
