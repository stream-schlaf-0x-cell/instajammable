import { useState, useRef, useEffect } from 'react';
import { Volume2, LockKeyhole, Snowflake, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, Dices, X } from 'lucide-react';
import {
  JamEngine,
  getInstrumentPresets,
  detectActiveInstrumentPreset,
  type InstrumentPreset
} from '../../engine/jam/JamEngine';
import type { JamPosition, JamSession, LayerRole } from '../../types/jam';
import { useUiEdition } from '../../contexts/UiEditionContext';
import { stripArtistRefs } from '../../engine/jam/minimalCatalog';

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
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActiveMenuLayerId(null);
      }
    };
    if (activeMenuLayerId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside, { passive: true });
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [activeMenuLayerId]);

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
          <span className="mixer-label">{isMinimal ? '8-CHANNEL STUDIO MIXER' : '8-KANAL STUDIO-MISCHPULT'}</span>
          <span className="mixer-sub">{isMinimal ? 'Instrument presets, calibrated dB faders, Mute, Solo & Locks' : 'Kreative Instrumenten-Presets, kalibrierte Fader mit dB-Skala, Mute, Solo & Locks'}</span>
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
        {layers.map((layer, index) => {
          const pct = Math.round(layer.volume * 100);
          const isSilent = layer.muted || (layers.some(l => l.solo) && !layer.solo);
          const activePreset: InstrumentPreset | undefined = detectActiveInstrumentPreset(layer);
          const availablePresets = getInstrumentPresets(layer.role, layer.drumVoice);
          const isMenuOpen = activeMenuLayerId === layer.id;
          const isRightAlignedPopover = index % 4 >= 2;

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
                  type="button"
                  className={`strip-preset-badge ${isMenuOpen ? 'menu-open' : ''}`}
                  onClick={() => setActiveMenuLayerId(isMenuOpen ? null : layer.id)}
                  title={`Preset: ${activePreset ? (isMinimal ? stripArtistRefs(activePreset.name) : activePreset.name) : layer.settings.timbre}. ${isMinimal ? 'Click to choose preset.' : 'Klicken für Presetauswahl.'}`}
                  aria-haspopup="true"
                  aria-expanded={isMenuOpen}
                >
                  <span className="strip-preset-title">{activePreset ? (isMinimal ? stripArtistRefs(activePreset.name) : activePreset.name) : layer.settings.timbre}</span>
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

                {/* Preset Popover Menu */}
                {isMenuOpen && (
                  <div className={`strip-preset-popover ${isRightAlignedPopover ? 'align-right' : 'align-left'}`} ref={popoverRef}>
                    <div className="preset-popover-header">
                      <span className="preset-popover-title">{layer.name} Presets</span>
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
                      {availablePresets.map(preset => (
                        <button
                          key={preset.id}
                          type="button"
                          className={`preset-popover-item ${activePreset?.id === preset.id ? 'is-active' : ''}`}
                          onClick={() => selectPreset(layer.id, preset.id)}
                        >
                          <div className="preset-item-header">
                            <span className="preset-item-name">{isMinimal ? stripArtistRefs(preset.name) : preset.name}</span>
                            <span className="preset-item-cat">{preset.category}</span>
                          </div>
                          <span className="preset-item-desc">{isMinimal ? stripArtistRefs(preset.description) : preset.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Dual-Chord Layer B Compact Sub-Mixer (Chords Strip Only) */}
              {layer.role === 'chords' && (
                <div className="strip-dual-chord-bar" title="Dual-Chord Spur B: Harmonisch gekoppelter Konterpart mit eigener Klangfarbe & Gegenbewegung">
                  <button
                    type="button"
                    className={`dual-chord-toggle ${layer.settings.secondaryEnabled ? 'active' : ''}`}
                    onClick={() => engine.setSecondaryChord({ enabled: !layer.settings.secondaryEnabled })}
                    aria-pressed={Boolean(layer.settings.secondaryEnabled)}
                    title={layer.settings.secondaryEnabled ? 'Akkordspur B ausschalten' : 'Akkordspur B einschalten'}
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
                      aria-label="Akkordspur B Mix-Pegel"
                      onChange={e => engine.setSecondaryChord({ enabled: true, volume: Number(e.target.value) })}
                      className="dual-chord-blend-slider"
                      title={`Spur B Mix: ${Math.round((layer.settings.secondaryVolume ?? 0.45) * 100)}%`}
                    />
                  )}
                </div>
              )}

              {/* Fader, Meter & Calibrated Ruler Grid Area */}
              <div className="strip-fader-area">
                {/* Visual LED Meter */}
                <div className="strip-meter-container" title={`${pct}% Pegel (${formatDb(layer.volume)})`}>
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
                      title={`Auf ${tick.full} (${Math.round(tick.vol * 100)}%) einrasten`}
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
                    aria-label={`${layer.name} Lautstärke`}
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
                title="Doppelklick zum Zurücksetzen auf Standard-Pegel"
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
                  title={`${layer.name} stummschalten`}
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
                  title={layer.locked ? 'Parameter entsperren' : 'Parameter vor Evolve schützen'}
                  aria-pressed={layer.locked}
                >
                  <LockKeyhole size={12} />
                </button>
                <button
                  type="button"
                  className={`strip-icon-btn ${layer.frozen ? 'active' : ''}`}
                  onClick={() => toggleFreeze(layer.id, layer.frozen)}
                  title={layer.frozen ? 'Phrase auftauen' : 'Phrase einfrieren'}
                  aria-pressed={layer.frozen}
                >
                  <Snowflake size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Miniature live version for when the Mixer is collapsed into a rack strip.
 */
export function MiniMixerPreview({ session }: { session: JamSession }) {
  const layers = session.layers;
  const anySolo = layers.some(l => l.solo);

  return (
    <div className="mini-mixer-display" title="Mischpult Live-Pegel">
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
        {layers.filter(l => !l.muted).length}/{layers.length} Aktiv
      </span>
    </div>
  );
}
