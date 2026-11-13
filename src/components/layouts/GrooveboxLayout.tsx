import { useState } from 'react';
import { Shuffle, ChevronRight, LockKeyhole, Snowflake } from 'lucide-react';
import { JamEngine } from '../../engine/jam/JamEngine';
import { getInstrumentPresets, detectActiveInstrumentPreset } from '../../engine/jam/instrumentPresets';
import { getInstrumentPresetDisplay } from '../../engine/jam/minimalCatalog';
import { DRUM_MODELS, TIMBRES, type DrumModel, type JamPosition, type JamSession, type Timbre } from '../../types/jam';
import type { UiEdition } from '../../types/ui';
import { HarmonyHeroCard, MacroDeckCard } from './LayoutShared';

const engine = JamEngine.getInstance();

interface GrooveboxLayoutProps {
  session: JamSession;
  position: JamPosition;
  edition: UiEdition;
}

export function GrooveboxLayout({ session, position, edition }: GrooveboxLayoutProps) {
  const min = edition === 'minimal';
  const [selectedId, setSelectedId] = useState<string>('chords');
  const layer = session.layers.find(l => l.id === selectedId) || session.layers[0];
  const presets = getInstrumentPresets(layer.role, layer.drumVoice);
  const activePreset = detectActiveInstrumentPreset(layer);

  return (
    <div className="layout-groovebox">
      {/* Top Row: Compact Harmony Display + Core Macros */}
      <div className="groovebox-top-pair">
        <HarmonyHeroCard session={session} position={position} edition={edition} compact />
        <MacroDeckCard session={session} edition={edition} />
      </div>

      {/* Hardware Track Pad Grid (8 pads) */}
      <section className="plugin-card groovebox-pads-section" aria-label={min ? 'Track Pads' : 'Spur-Pads'}>
        <header className="plugin-card-head">
          <div>
            <span className="plugin-eyebrow">{min ? 'SELECT A PAD TO SCULPT' : 'PAD WÄHLEN ZUM BEARBEITEN'}</span>
            <h3 className="plugin-card-title">{min ? '8-Track Hardware Matrix' : '8-Spur Groovebox-Matrix'}</h3>
          </div>
          <span className="plugin-eyebrow">
            {min ? `Bar ${position.bar + 1} · Beat ${(Math.floor(position.beat) % 4) + 1}` : `Takt ${position.bar + 1} · Schlag ${(Math.floor(position.beat) % 4) + 1}`}
          </span>
        </header>

        <div className="groovebox-pad-grid">
          {session.layers.map((l, idx) => {
            const isSel = l.id === layer.id;
            return (
              <div
                key={l.id}
                role="button"
                tabIndex={0}
                className={`groovebox-pad ${isSel ? 'is-selected' : ''} ${l.muted ? 'is-muted' : ''}`}
                style={{ '--pad-color': l.color } as React.CSSProperties}
                onClick={() => setSelectedId(l.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(l.id); } }}
              >
                <div className="pad-header-row">
                  <span className="pad-index">0{idx + 1}</span>
                  <span className="pad-led" />
                </div>
                <strong className="pad-title">{l.name}</strong>
                <span className="pad-sub">
                  {l.role === 'drum' ? (l.settings.drumModel || l.drumVoice) : l.settings.timbre}
                </span>
                <div className="pad-meter-bar">
                  <div className="pad-meter-fill" style={{ width: `${Math.round(l.volume * 100)}%` }} />
                </div>
                <div className="pad-quick-actions">
                  <button
                    type="button"
                    className={`mini-toggle ${l.muted ? 'is-active-mute' : ''}`}
                    onClick={e => { e.stopPropagation(); engine.updateLayer(l.id, { muted: !l.muted }); }}
                  >
                    M
                  </button>
                  <button
                    type="button"
                    className={`mini-toggle ${l.solo ? 'is-active-solo' : ''}`}
                    onClick={e => { e.stopPropagation(); engine.updateLayer(l.id, { solo: !l.solo }); }}
                  >
                    S
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Selected Track Sculpting Deck */}
      <section className="plugin-card groovebox-inspector" style={{ '--pad-color': layer.color } as React.CSSProperties}>
        <header className="plugin-card-head">
          <div>
            <span className="plugin-eyebrow">{min ? 'ACTIVE TRACK INSPECTOR' : 'AKTIVE SPUR BEARBEITEN'}</span>
            <h3 className="plugin-card-title">{layer.name}</h3>
          </div>
          <div className="hero-actions-inline">
            <button
              type="button"
              className={`plugin-chip-btn ${layer.locked ? 'is-accent' : ''}`}
              onClick={() => engine.updateLayer(layer.id, { locked: !layer.locked })}
            >
              <LockKeyhole size={12} />
              <span>{min ? 'Lock' : 'Schützen'}</span>
            </button>
            <button
              type="button"
              className={`plugin-chip-btn ${layer.frozen ? 'is-accent' : ''}`}
              onClick={() => engine.updateLayer(layer.id, { frozen: !layer.frozen })}
            >
              <Snowflake size={12} />
              <span>Freeze</span>
            </button>
          </div>
        </header>

        <div className="groovebox-controls-grid">
          {/* Volume */}
          <label className="plugin-macro-tile">
            <div className="plugin-macro-top">
              <strong>{min ? 'Level' : 'Lautstärke'}</strong>
              <output>{Math.round(layer.volume * 100)}%</output>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={layer.volume}
              onChange={e => engine.updateLayer(layer.id, { volume: Number(e.target.value) })}
            />
          </label>

          {/* Density */}
          <label className="plugin-macro-tile">
            <div className="plugin-macro-top">
              <strong>{min ? 'Activity / Density' : 'Dichte / Aktivität'}</strong>
              <output>{Math.round(layer.settings.density * 100)}%</output>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={layer.settings.density}
              onChange={e => engine.setLayerSettings(layer.id, { density: Number(e.target.value) })}
            />
          </label>

          {/* Timbre or Drum Model */}
          {layer.role !== 'drum' ? (
            <label className="plugin-macro-tile">
              <div className="plugin-macro-top">
                <strong>{min ? 'Sound Engine Timbre' : 'Klangfarbe (Timbre)'}</strong>
              </div>
              <select
                value={layer.settings.timbre}
                onChange={e => engine.setLayerSettings(layer.id, { timbre: e.target.value as Timbre })}
              >
                {TIMBRES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="plugin-macro-tile">
              <div className="plugin-macro-top">
                <strong>{min ? 'Percussion Model' : 'Drum-Modell'}</strong>
              </div>
              <select
                value={layer.settings.drumModel || 'woodblock'}
                onChange={e => engine.setLayerSettings(layer.id, { drumModel: e.target.value as DrumModel })}
              >
                {DRUM_MODELS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          )}

          {/* Preset Selector & Quick Actions */}
          <div className="plugin-macro-tile">
            <div className="plugin-macro-top">
              <strong>{min ? 'Channel Preset' : 'Kanal-Preset'}</strong>
              <div className="hero-actions-inline">
                <button
                  type="button"
                  className="plugin-chip-btn"
                  onClick={() => engine.cycleInstrumentPreset(layer.id, 1)}
                  title={min ? 'Next preset' : 'Nächstes Preset'}
                >
                  <ChevronRight size={12} />
                </button>
                <button
                  type="button"
                  className="plugin-chip-btn"
                  onClick={() => engine.randomizeInstrumentPreset(layer.id)}
                  title={min ? 'Randomize preset' : 'Zufälliges Preset'}
                >
                  <Shuffle size={12} />
                </button>
              </div>
            </div>
            <select
              value={activePreset?.id || ''}
              onChange={e => {
                if (e.target.value) engine.applyInstrumentPreset(layer.id, e.target.value);
              }}
            >
              <option value="">{min ? '— Custom —' : '— Benutzerdefiniert —'}</option>
              {presets.map(p => (
                <option key={p.id} value={p.id}>
                  {getInstrumentPresetDisplay(p, edition).name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}
