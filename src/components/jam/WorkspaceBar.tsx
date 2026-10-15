import { SlidersHorizontal, Music2, Waves, Activity, Sparkles, Wand2, Compass, Layers, Disc3, Sliders, LayoutGrid, Tv } from 'lucide-react';
import { JamEngine } from '../../engine/jam/JamEngine';
import { WORKSPACE_PRESETS } from '../../engine/jam/customMacros';
import type { JamSession, WorkspaceModuleId } from '../../types/jam';

const engine = JamEngine.getInstance();

export type ViewDensityMode = 'compact' | 'standard' | 'distance';

interface ModuleMeta {
  id: WorkspaceModuleId;
  label: string;
  shortLabel: string;
  icon: typeof Music2;
  description: string;
}

const MODULE_DEFINITIONS: ModuleMeta[] = [
  { id: 'pianoroll', label: 'Noten & Ensemble', shortLabel: 'Noten', icon: Music2, description: 'Interaktive Pianorolle und Layer-Mischpult' },
  { id: 'custommacros', label: 'Eigene Makros', shortLabel: 'Makros', icon: SlidersHorizontal, description: 'Selbsterstellte Multi-Parameter-Regler' },
  { id: 'eq', label: 'Studio-EQ & Low-Cut', shortLabel: 'Studio-EQ', icon: Sliders, description: '3-Band Parametrischer Master-EQ mit Low-Cut & Frequenzgang' },
  { id: 'soundscape', label: 'Klangwelt & Streicher', shortLabel: 'Klangwelt', icon: Compass, description: 'Großes Streichorchester, Hall & aufeinander abgestimmte Chords' },
  { id: 'sequencer', label: 'Sequencer (4 Takte)', shortLabel: 'Sequencer', icon: Activity, description: 'Verlaufskette: 4 Takte dies, 4 Takte jenes' },
  { id: 'fxchain', label: 'Modulare FX-Kette', shortLabel: 'FX-Kette', icon: Waves, description: 'Effekt-Signalfluss, Routing (Delay ➔ Reverb) & Bypass' },
  { id: 'chaos', label: 'Chaos & Organischer Drift', shortLabel: 'Chaos', icon: Sparkles, description: 'Wandernder Attraktor, 2D-Drift & spontane Impulse' },
  { id: 'atmosphere', label: 'Textur & Kick-Atmung', shortLabel: 'Textur', icon: Wand2, description: 'Hintergrund-Bett (max 20%) und Ducking' },
  { id: 'rhythms', label: 'Rhythmus-Pool', shortLabel: 'Rhythmen', icon: Layers, description: 'Generative Rhythmus-Algorithmen (Euclidean, Markov, CBL)' },
  { id: 'scenes', label: 'Szenen (16)', shortLabel: 'Szenen', icon: Disc3, description: '16 kuratierte musikalische Ausgangspunkte' },
];

export function WorkspaceBar({
  session,
  viewMode = 'compact',
  onViewModeChange,
}: {
  session: JamSession;
  viewMode?: ViewDensityMode;
  onViewModeChange?: (mode: ViewDensityMode) => void;
}) {
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
    <nav className="workspace-deck" aria-label="Arbeitsbereich anpassen">
      <div className="workspace-bar-top">
        <div className="workspace-title-row">
          <div className="workspace-heading">
            <span className="eyebrow">DEIN ARBEITSBEREICH</span>
            <h2>Alle Optionen da – du entscheidest, was offen ist.</h2>
          </div>
          <div className="workspace-counter">
            <span className="counter-pill">{activeModules.length} von {MODULE_DEFINITIONS.length} Modulen aktiv</span>
          </div>
        </div>

        {/* View Density / Distance Selector */}
        {onViewModeChange && (
          <div className="view-mode-selector" role="group" aria-label="Ansichts-Modus">
            <span className="preset-label">Modus:</span>
            <button
              type="button"
              className={'button view-mode-btn ' + (viewMode === 'compact' ? 'active' : '')}
              onClick={() => onViewModeChange('compact')}
              title="Kompakt-Layout: Mehr Optionen auf einen Blick, optimiert für große Bildschirme"
            >
              <LayoutGrid size={13} />
              <span>Kompakt (Mehr im Blick)</span>
            </button>
            <button
              type="button"
              className={'button view-mode-btn ' + (viewMode === 'standard' ? 'active' : '')}
              onClick={() => onViewModeChange('standard')}
              title="Klassische Studio-Abstände"
            >
              <span>Standard</span>
            </button>
            <button
              type="button"
              className={'button view-mode-btn distance-btn ' + (viewMode === 'distance' ? 'active' : '')}
              onClick={() => onViewModeChange('distance')}
              title="Distanz-Modus: Große Signale und HUD für 2–3 Meter Entfernung"
            >
              <Tv size={13} />
              <span>Distanz (2–3m)</span>
            </button>
          </div>
        )}

        {/* Quick View Presets */}
        <div className="workspace-presets-row" role="group" aria-label="Arbeitsbereich-Vorlagen">
          <span className="preset-label">Presets:</span>
          {Object.entries(WORKSPACE_PRESETS).map(([key, p]) => {
            const isMatch = p.modules.length === activeModules.length && p.modules.every(m => activeModules.includes(m));
            return (
              <button
                key={key}
                type="button"
                className={'button workspace-preset-btn ' + (isMatch ? 'active' : '')}
                onClick={() => setPreset(key as keyof typeof WORKSPACE_PRESETS)}
                title={p.description}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Module Toggle Chips */}
      <div className="workspace-chips-grid" role="toolbar" aria-label="Module umschalten">
        {MODULE_DEFINITIONS.map(mod => {
          const isActive = activeModules.includes(mod.id);
          const Icon = mod.icon;
          return (
            <button
              key={mod.id}
              type="button"
              className={'workspace-chip ' + (isActive ? 'active' : 'inactive')}
              onClick={() => toggleModule(mod.id)}
              aria-pressed={isActive}
              title={`${mod.description} (${isActive ? 'Klicken zum Schließen' : 'Klicken zum Öffnen'})`}
            >
              <span className={'chip-led ' + (isActive ? 'on' : 'off')} />
              <Icon size={14} className="chip-icon" />
              <span className="chip-label">{mod.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
