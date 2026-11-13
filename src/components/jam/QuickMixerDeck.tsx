import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Volume2, LockKeyhole, Snowflake, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, Dices, X } from 'lucide-react';
import {
  JamEngine,
  getInstrumentPresets,
  detectActiveInstrumentPreset,
  type InstrumentPreset
} from '../../engine/jam/JamEngine';
import type { JamPosition, JamSession, LayerRole } from '../../types/jam';
import { useUiEdition } from '../../contexts/UiEditionContext';
import { getInstrumentPresetDisplay, getPresetCategoryDisplay } from '../../engine/jam/minimalCatalog';

interface QuickMixerDeckProps {
  session: JamSession;
  position: JamPosition;
}

const engine = JamEngine.getInstance();

const GRID_TICKS = [
  { label: '0', full: '0 dB', vol: 1.0, major: true },
  { label: '-3', full: '-3 dB', vol: 0.71, major: true },
  { label: '-6', full: '-6 dB', vol: 0.50, major: true },
  { label: '-12', full: '-12 dB', vol: 0.25, major: true },
  { label: '-24', full: '-24 dB', vol: 0.08, major: false },
  { label: '-∞', full: '-∞ dB', vol: 0.0, major: true },
];

export function QuickMixerDeck({ session }: QuickMixerDeckProps) {
  const edition = useUiEdition();
  const isMinimal = edition === 'minimal';
  const layers = session.layers;
  const [activeMenuLayerId, setActiveMenuLayerId] = useState<string | null>(null);
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number; isRightAligned: boolean } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const updatePopoverPosition = useCallback(() => {
    if (!activeMenuLayerId || typeof window === 'undefined' || window.innerWidth <= 640) {
      setPopoverCoords(null);
      return;
    }
    const triggerEl = triggerRefs.current[activeMenuLayerId];
    if (!triggerEl) {
      setPopoverCoords(null);
      return;
    }
    const rect = triggerEl.getBoundingClientRect();
    const layerIdx = layers.findIndex(l => l.id === activeMenuLayerId);
    const isRightAligned = layerIdx >= 0 ? layerIdx % 4 >= 2 : false;
    const popoverWidth = 235;
    const margin = 8;
    const rawLeft = isRightAligned ? rect.right - popoverWidth : rect.left;
    const left = Math.max(margin, Math.min(window.innerWidth - popoverWidth - margin, rawLeft));
    const spaceBelow = window.innerHeight - rect.bottom;
    const preferAbove = spaceBelow < 240 && rect.top > 320;
    const top = preferAbove
      ? Math.max(margin, rect.top - 314)
      : Math.max(margin, Math.min(window.innerHeight - 280, rect.bottom + 4));
    setPopoverCoords({ top, left, isRightAligned });
  }, [activeMenuLayerId, layers]);

  useLayoutEffect(() => {
    updatePopoverPosition();
  }, [updatePopoverPosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const targetEl = e.target as HTMLElement | null;
      if (activeMenuLayerId && targetEl?.closest(`[data-preset-menu-layer="${activeMenuLayerId}"]`)) {
        return;
      }
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActiveMenuLayerId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveMenuLayerId(null);
    };
    const handleReposition = (e: Event) => {
      if (e.type === 'scroll' && popoverRef.current && popoverRef.current.contains(e.target as Node)) {
        return;
      }
      updatePopoverPosition();
    };
    if (activeMenuLayerId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside, { passive: true });
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('resize', handleReposition);
      window.addEventListener('scroll', handleReposition, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [activeMenuLayerId, updatePopoverPosition]);

  const setVolume = (id: string, vol: number) => {
    engine.updateLayer(id, { volume: Math.max(0, Math.min(1, vol)) });
  };

  const resetChannelVolume = (id: string, role: LayerRole) => {
    const defaultVol = id === 'kick' ? 0.78 : role === 'bass' ? 0.65 : role === 'chords' ? 0.55 : 0.45;
    setVolume(id, defaultVol);
  };

  const toggleMute = (id: string, current: boolean) => {
    engine.updateLayer(id, { muted: !current });
  };

  const toggleSolo = (id: string, current: boolean) => {
    engine.updateLayer(id, { solo: !current });
  };

  const toggleLock = (id: string, current: boolean) => {
    engine.updateLayer(id, { locked: !current });
  };

  const toggleFreeze = (id: string, current: boolean) => {
    engine.updateLayer(id, { frozen: !current });
  };

  const unmuteAll = () => {
    for (const l of layers) {
      if (l.muted || l.solo) {
        engine.updateLayer(l.id, { muted: false, solo: false });
      }
    }
  };

  const resetMix = () => {
    for (const l of layers) {
      const defaultVol = l.id === 'kick' ? 0.78 : l.role === 'bass' ? 0.65 : l.role === 'chords' ? 0.55 : 0.45;
      engine.updateLayer(l.id, { volume: defaultVol });
    }
  };

  const cyclePreset = (layerId: string, direction: 1 | -1) => {
    engine.cycleInstrumentPreset(layerId, direction);
  };

  const randomizePreset = (layerId: string) => {
    engine.randomizeInstrumentPreset(layerId);
  };

  const selectPreset = (layerId: string, presetId: string) => {
    engine.applyInstrumentPreset(layerId, presetId);
    setActiveMenuLayerId(null);
  };

  const formatDb = (volume: number): string => {
    if (volume <= 0.001) return '-∞ dB';
    const db = 20 * Math.log10(volume);
    return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
  };

  return (
    <div className="quick-mixer-deck">
      <div className="mixer-toolbar">
        <div className="mixer-info">
          <span className="mixer-label">{isMinimal ? '8-CHANNEL MIXER' : '8-KANAL STUDIO-MISCHPULT'}</span>
          {!isMinimal && <span className="mixer-sub">Kreative Instrumenten-Presets, kalibrierte Fader mit dB-Skala, Mute, Solo & Locks</span>}
        </div>
        <div className="mixer-actions">
          <button type="button" className="button quiet mixer-action-btn" onClick={unmuteAll} title={isMinimal ? 'Clear all mutes and solos' : 'Alle Stummschaltungen und Solos aufheben'}>
            <Volume2 size={13} />
            <span>{isMinimal ? 'Unmute All' : 'Alle Aktiv'}</span>
          </button>
          <button type="button" className="button quiet mixer-action-btn" onClick={resetMix} title={isMinimal ? 'Reset levels to studio defaults' : 'Lautstärken auf Studio-Standard ausrichten'}>
            <RotateCcw size={13} />
            <span>{isMinimal ? 'Reset Levels' : 'Standard-Pegel'}</span>
          </button>
        </div>
      </div>

      {/* 8 Channel Strips Grid */}
      <div className="mixer-strips-grid">
        {layers.map(layer => {
          const pct = Math.round(layer.volume * 100);
          const isSilent = layer.muted || (layers.some(l => l.solo) && !layer.solo);
          const activePreset: InstrumentPreset | undefined = detectActiveInstrumentPreset(layer);
          const isMenuOpen = activeMenuLayerId === layer.id;

          return (
            <div
              key={layer.id}
              className={`mixer-strip ${layer.muted ? 'is-muted' : ''} ${layer.solo ? 'is-soloed' : ''} ${isSilent ? 'is-silent' : ''}`}
              style={{ '--strip-color': layer.color } as React.CSSProperties}
            >
              {/* Channel Header */}
              <div className="strip-header">
                <span className="strip-color-pip" />
                <strong className="strip-name">{layer.name}</strong>
                <span className="strip-role">{layer.role === 'drum' ? layer.drumVoice?.toUpperCase() : layer.settings.timbre.toUpperCase()}</span>
              </div>

              {/* Fast Instrument Preset Selector */}
              <div className="strip-preset-bar">
                <button
                  type="button"
                  className="strip-preset-nav-btn"
                  onClick={() => cyclePreset(layer.id, -1)}
                  title={isMinimal ? 'Previous Preset' : 'Vorheriges Preset'}
                  aria-label={`${layer.name} ${isMinimal ? 'previous preset' : 'vorheriges Preset'}`}
                >
                  <ChevronLeft size={11} />
                </button>

                <button
                  ref={el => { triggerRefs.current[layer.id] = el; }}
                  data-preset-menu-layer={layer.id}
                  type="button"
                  className={`strip-preset-badge ${isMenuOpen ? 'menu-open' : ''}`}
                  onClick={() => setActiveMenuLayerId(isMenuOpen ? null : layer.id)}
                  title={`Preset: ${activePreset ? getInstrumentPresetDisplay(activePreset, edition).name : layer.settings.timbre}. ${isMinimal ? 'Click to choose preset.' : 'Klicken für Presetauswahl.'}`}
                  aria-haspopup="true"
                  aria-expanded={isMenuOpen}
                >
                  <span className="strip-preset-title">{activePreset ? getInstrumentPresetDisplay(activePreset, edition).name : layer.settings.timbre}</span>
                  <ChevronDown size={9} className="strip-preset-caret" />
                </button>

                <button
                  type="button"
                  className="strip-preset-nav-btn"
                  onClick={() => cyclePreset(layer.id, 1)}
                  title={isMinimal ? 'Next Preset' : 'Nächstes Preset'}
                  aria-label={`${layer.name} ${isMinimal ? 'next preset' : 'nächstes Preset'}`}
                >
                  <ChevronRight size={11} />
                </button>

                <button
                  type="button"
                  className="strip-preset-dice-btn"
                  onClick={() => randomizePreset(layer.id)}
                  title={isMinimal ? 'Random preset for this track' : 'Zufälliges Preset für diesen Kanal würfeln'}
                  aria-label={`${layer.name} ${isMinimal ? 'random preset' : 'Preset würfeln'}`}
                >
                  <Dices size={11} />
                </button>
              </div>

              {/* Dual-Chord Layer B Compact Sub-Mixer (Chords Strip Only) */}
              {layer.role === 'chords' && (
                <div className="strip-dual-chord-bar" title={isMinimal ? 'Dual-Chord Track B: Harmonically linked counterpart layer' : 'Dual-Chord Spur B: Harmonisch gekoppelter Konterpart mit eigener Klangfarbe & Gegenbewegung'}>
                  <button
                    type="button"
                    className={`dual-chord-toggle ${layer.settings.secondaryEnabled ? 'active' : ''}`}
                    onClick={() => engine.setSecondaryChord({ enabled: !layer.settings.secondaryEnabled })}
                    aria-pressed={Boolean(layer.settings.secondaryEnabled)}
                    title={isMinimal ? (layer.settings.secondaryEnabled ? 'Turn off Chord Track B' : 'Turn on Chord Track B') : (layer.settings.secondaryEnabled ? 'Akkordspur B ausschalten' : 'Akkordspur B einschalten')}
                  >
                    B: {layer.settings.secondaryEnabled ? (layer.settings.secondaryTimbre || 'shimmer').toUpperCase() : 'OFF'}
                  </button>
                  {layer.settings.secondaryEnabled && (
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={layer.settings.secondaryVolume ?? 0.45}
                      aria-label={isMinimal ? 'Chord Track B Mix' : 'Akkordspur B Mix-Pegel'}
                      onChange={e => engine.setSecondaryChord({ enabled: true, volume: Number(e.target.value) })}
                      className="dual-chord-blend-slider"
                      title={`${isMinimal ? 'Track B Mix' : 'Spur B Mix'}: ${Math.round((layer.settings.secondaryVolume ?? 0.45) * 100)}%`}
                    />
                  )}
                </div>
              )}

              {/* Fader, Meter & Calibrated Ruler Grid Area */}
              <div className="strip-fader-area">
                {/* Visual LED Meter */}
                <div className="strip-meter-container" title={`${pct}% ${isMinimal ? 'Level' : 'Pegel'} (${formatDb(layer.volume)})`}>
                  <div
                    className="strip-meter-fill"
                    style={{
                      height: `${isSilent ? 0 : pct}%`,
                      background: isSilent ? 'transparent' : pct > 90 ? 'linear-gradient(to top, #22c55e 0%, #eab308 75%, #ef4444 100%)' : pct > 70 ? 'linear-gradient(to top, #22c55e 0%, #eab308 100%)' : '#22c55e',
                      opacity: isSilent ? 0.2 : 0.95,
                    }}
                  />
                </div>

                {/* Calibrated dB Scale / Grid Ruler */}
                <div className="strip-ruler">
                  {GRID_TICKS.map(tick => (
                    <button
                      key={tick.label}
                      type="button"
                      className={`ruler-tick ${tick.major ? 'major' : 'minor'}`}
                      style={{ bottom: `${tick.vol * 100}%` }}
                      onClick={() => setVolume(layer.id, tick.vol)}
                      title={isMinimal ? `Snap to ${tick.full} (${Math.round(tick.vol * 100)}%)` : `Auf ${tick.full} (${Math.round(tick.vol * 100)}%) einrasten`}
                    >
                      <span className="tick-line" />
                      <span className="tick-label">{tick.label}</span>
                    </button>
                  ))}
                </div>

                {/* Tactile Vertical Slider */}
                <div className="strip-slider-holder">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={layer.volume}
                    aria-label={`${layer.name} ${isMinimal ? 'volume' : 'Lautstärke'}`}
                    onChange={e => setVolume(layer.id, Number(e.target.value))}
                    onDoubleClick={() => resetChannelVolume(layer.id, layer.role)}
                    className="strip-fader-slider"
                  />
                </div>
              </div>

              {/* Readout: % and dB */}
              <div
                className="strip-readout"
                onDoubleClick={() => resetChannelVolume(layer.id, layer.role)}
                title={isMinimal ? 'Double-click to reset level' : 'Doppelklick zum Zurücksetzen auf Standard-Pegel'}
              >
                <span className="fader-val">{pct}%</span>
                <span className="fader-db">{formatDb(layer.volume)}</span>
              </div>

              {/* Mute & Solo Tactile Buttons */}
              <div className="strip-btn-row">
                <button
                  type="button"
                  className={`strip-ms-btn mute-btn ${layer.muted ? 'active' : ''}`}
                  onClick={() => toggleMute(layer.id, layer.muted)}
                  title={`${layer.name} ${isMinimal ? 'mute' : 'stummschalten'}`}
                  aria-pressed={layer.muted}
                >
                  M
                </button>
                <button
                  type="button"
                  className={`strip-ms-btn solo-btn ${layer.solo ? 'active' : ''}`}
                  onClick={() => toggleSolo(layer.id, layer.solo)}
                  title={`${layer.name} solo`}
                  aria-pressed={layer.solo}
                >
                  S
                </button>
              </div>

              {/* Lock & Freeze Secondary Controls */}
              <div className="strip-secondary-row">
                <button
                  type="button"
                  className={`strip-icon-btn ${layer.locked ? 'active' : ''}`}
                  onClick={() => toggleLock(layer.id, layer.locked)}
                  title={isMinimal ? (layer.locked ? 'Unlock parameters' : 'Lock parameters') : (layer.locked ? 'Parameter entsperren' : 'Parameter vor Evolve schützen')}
                  aria-pressed={layer.locked}
                >
                  <LockKeyhole size={12} />
                </button>
                <button
                  type="button"
                  className={`strip-icon-btn ${layer.frozen ? 'active' : ''}`}
                  onClick={() => toggleFreeze(layer.id, layer.frozen)}
                  title={isMinimal ? (layer.frozen ? 'Unfreeze phrase' : 'Freeze phrase') : (layer.frozen ? 'Phrase auftauen' : 'Phrase einfrieren')}
                  aria-pressed={layer.frozen}
                >
                  <Snowflake size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {activeMenuLayerId && (() => {
        const activeLayer = layers.find(l => l.id === activeMenuLayerId);
        if (!activeLayer) return null;
        const activePreset = detectActiveInstrumentPreset(activeLayer);
        const availablePresets = getInstrumentPresets(activeLayer.role, activeLayer.drumVoice);
        const portalNode = (
          <div
            ref={popoverRef}
            className={`strip-preset-popover ${popoverCoords?.isRightAligned ? 'align-right' : 'align-left'}`}
            style={popoverCoords ? { position: 'fixed', top: `${popoverCoords.top}px`, left: `${popoverCoords.left}px`, right: 'auto', marginTop: 0 } : undefined}
          >
            <div className="preset-popover-header">
              <span className="preset-popover-title">{activeLayer.name} Presets</span>
              <button
                type="button"
                className="preset-popover-close"
                onClick={() => setActiveMenuLayerId(null)}
                aria-label={isMinimal ? 'Close' : 'Schließen'}
              >
                <X size={11} />
              </button>
            </div>
            <div className="preset-popover-list">
              {availablePresets.map(preset => {
                const disp = getInstrumentPresetDisplay(preset, edition);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`preset-popover-item ${activePreset?.id === preset.id ? 'is-active' : ''}`}
                    onClick={() => selectPreset(activeLayer.id, preset.id)}
                  >
                    <div className="preset-item-header">
                      <span className="preset-item-name">{disp.name}</span>
                      <span className="preset-item-cat">{getPresetCategoryDisplay(preset.category, edition)}</span>
                    </div>
                    <span className="preset-item-desc">{disp.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
        return typeof document !== 'undefined' ? createPortal(portalNode, document.body) : portalNode;
      })()}
    </div>
  );
}

/**
 * Miniature live version for when the Mixer is collapsed into a rack strip.
 */
export function MiniMixerPreview({ session }: { session: JamSession }) {
  const isMinimal = useUiEdition() === 'minimal';
  const layers = session.layers;
  const anySolo = layers.some(l => l.solo);

  return (
    <div className="mini-mixer-display" title={isMinimal ? 'Live Mixer Levels' : 'Mischpult Live-Pegel'}>
      <div className="mini-meter-bars">
        {layers.map(layer => {
          const isSilent = layer.muted || (anySolo && !layer.solo);
          const height = isSilent ? 2 : Math.max(4, Math.round(layer.volume * 22));
          return (
            <div key={layer.id} className="mini-bar-unit" title={`${layer.name}: ${Math.round(layer.volume * 100)}%`}>
              <div
                className="mini-bar-fill"
                style={{
                  height: `${height}px`,
                  background: isSilent ? '#33403e' : layer.color,
                }}
              />
              <span className="mini-bar-label">{layer.name[0]}</span>
            </div>
          );
        })}
      </div>
      <span className="mini-mixer-summary">
        {layers.filter(l => !l.muted).length}/{layers.length} {isMinimal ? 'Active' : 'Aktiv'}
      </span>
    </div>
  );
}
