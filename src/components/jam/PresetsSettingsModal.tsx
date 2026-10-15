import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  Download,
  Upload,
  FileJson,
  Copy,
  Check,
  Sparkles,
  Music,
  Headphones,
  Sliders,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Radio,
} from 'lucide-react';
import { JamEngine, SCENES } from '../../engine/jam/JamEngine';
import { exportJson } from '../../engine/jam/storage';
import { downloadClipMidi } from '../../engine/jam/clipMidi';
import { noteName } from './PianoRoll';
import type { JamSession, SceneDefinition } from '../../types/jam';

interface PresetsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: JamSession;
  onToast: (msg: string) => void;
}

type TabType = 'presets' | 'import' | 'export';

const pitch = (n: number) => noteName(n).replace(/-?\d+$/, '');

export const PresetsSettingsModal: React.FC<PresetsSettingsModalProps> = ({
  isOpen,
  onClose,
  session,
  onToast,
}) => {
  const engine = JamEngine.getInstance();
  const [activeTab, setActiveTab] = useState<TabType>('presets');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pastedJson, setPastedJson] = useState('');
  const [jsonValidation, setJsonValidation] = useState<{
    valid: boolean;
    name?: string;
    bpm?: number;
    scale?: string;
    root?: number;
    error?: string;
    parsed?: unknown;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter scenes
  const filteredScenes = useMemo(() => {
    return SCENES.filter(s => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.mood && s.mood.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (categoryFilter === 'all') return true;
      if (categoryFilter === 'psybient') return /cbl|psybient|ultimae/i.test(s.mood || s.id);
      if (categoryFilter === 'ambient') return s.style === 'ambient' && !/cbl|psybient|ultimae|orchestral|classical/i.test(s.mood || s.id);
      if (categoryFilter === 'classical') return /orchestral|classical/i.test(s.mood || s.id);
      if (categoryFilter === 'techno') return s.style === 'techno';
      if (categoryFilter === 'lofi') return s.style === 'lofi';
      return true;
    });
  }, [searchQuery, categoryFilter]);

  if (!isOpen) return null;

  // JSON Validation handler
  const handleJsonChange = (text: string) => {
    setPastedJson(text);
    if (!text.trim()) {
      setJsonValidation(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('JSON muss ein Objekt sein.');
      }
      const name = parsed.name || 'Unbenannte Session';
      const bpm = parsed.bpm || 78;
      const scale = parsed.scale || 'dorian';
      const root = parsed.root || 50;
      setJsonValidation({
        valid: true,
        name,
        bpm,
        scale,
        root,
        parsed,
      });
    } catch (err) {
      setJsonValidation({
        valid: false,
        error: err instanceof Error ? err.message : 'Ungültiges JSON-Format.',
      });
    }
  };

  const handleApplyPastedJson = () => {
    if (!jsonValidation?.valid || !jsonValidation.parsed) return;
    try {
      engine.loadSession(jsonValidation.parsed);
      onToast(`Einstellungen "${jsonValidation.name}" erfolgreich importiert & geladen!`);
      onClose();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Fehler beim Laden der Session.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 12_000_000) {
      onToast('Datei ist zu groß (max 12 MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result);
        const parsed = JSON.parse(text);
        engine.loadSession(parsed);
        onToast(`Session "${parsed.name || file.name}" geladen!`);
        onClose();
      } catch (err) {
        onToast(err instanceof Error ? err.message : 'Fehler beim Importieren der Datei.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Ableton Multitrack MIDI Export
  const handleExportAbletonMidi = () => {
    try {
      const clip = engine.exportAbletonClip(8);
      downloadClipMidi(clip);
      onToast('Ableton Multitrack MIDI (.mid) erfolgreich exportiert!');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'MIDI-Export fehlgeschlagen.');
    }
  };

  // Export Track Stems
  const handleExportStems = () => {
    try {
      const clip = engine.exportAbletonClip(8);
      const trackIds = clip.tracks.map(t => t.id).filter(id => id !== '__conductor__');
      let count = 0;
      trackIds.forEach((trackId, index) => {
        setTimeout(() => {
          downloadClipMidi(clip, trackId);
        }, index * 200);
        count++;
      });
      onToast(`${count} Spuren als separate Ableton MIDI-Stems exportiert!`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Stem-Export fehlgeschlagen.');
    }
  };

  // Export Full Session JSON
  const handleExportSessionJson = () => {
    try {
      const current = engine.saveSession();
      const safeName = current.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
      exportJson(current, `atem-session-${safeName}-${Date.now()}.json`);
      onToast('Vollständige Session (.json) exportiert!');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Export fehlgeschlagen.');
    }
  };

  // Copy JSON to Clipboard
  const handleCopyJson = () => {
    try {
      const current = engine.saveSession();
      const jsonStr = JSON.stringify(current, null, 2);
      navigator.clipboard.writeText(jsonStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
      onToast('Gesamte Einstellungen in die Zwischenablage kopiert!');
    } catch {
      onToast('Konnte nicht in die Zwischenablage kopieren.');
    }
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="presets-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <header className="settings-modal-header">
          <div className="header-titles">
            <span className="eyebrow">PRESETS & BACKUP</span>
            <h2 id="settings-dialog-title">Alles importieren, exportieren & Ableton Live</h2>
            <p className="header-sub">
              Standardisierte Vorlagen, vollständige Backups und nahtloser Workflow mit Ableton Live 10/11/12.
            </p>
          </div>
          <button
            type="button"
            className="icon-button close-modal-btn"
            onClick={onClose}
            aria-label="Schließen"
          >
            <X size={18} />
          </button>
        </header>

        {/* Modal Navigation Tabs */}
        <nav className="settings-tab-nav" role="tablist">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'presets' ? 'active' : ''}`}
            onClick={() => setActiveTab('presets')}
            role="tab"
            aria-selected={activeTab === 'presets'}
          >
            <Sparkles size={15} />
            <span>Standardisierte Presets ({SCENES.length})</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
            role="tab"
            aria-selected={activeTab === 'import'}
          >
            <Upload size={15} />
            <span>Einstellungen importieren</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
            role="tab"
            aria-selected={activeTab === 'export'}
          >
            <Download size={15} />
            <span>Alles exportieren & Ableton</span>
          </button>
        </nav>

        {/* Tab 1: Standardized Presets */}
        {activeTab === 'presets' && (
          <div className="tab-content presets-tab-content">
            <div className="presets-toolbar">
              <div className="filter-pills">
                {[
                  ['all', 'Alle Presets'],
                  ['psybient', 'Psybient · CBL'],
                  ['ambient', 'Ambient & Space'],
                  ['classical', 'Orchestral / Felt'],
                  ['techno', 'Deep Techno'],
                  ['lofi', 'Lo-Fi Flow'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`filter-pill ${categoryFilter === id ? 'active' : ''}`}
                    onClick={() => setCategoryFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                className="preset-search-input"
                placeholder="Preset nach Name oder Stimmung suchen …"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="preset-cards-grid">
              {filteredScenes.map((scene: SceneDefinition) => {
                const isCurrent = scene.id === session.sceneId;
                return (
                  <article
                    key={scene.id}
                    className={`preset-card ${isCurrent ? 'is-current' : ''}`}
                  >
                    <div className="card-top-row">
                      <span className="preset-mood-badge">{scene.mood || scene.style.toUpperCase()}</span>
                      <span className="preset-tempo-badge">{scene.bpm} BPM</span>
                      <span className="preset-key-badge">
                        {pitch(scene.root)} {scene.scale}
                      </span>
                    </div>

                    <h3 className="preset-card-title">{scene.name}</h3>
                    <p className="preset-card-desc">{scene.description}</p>

                    <div className="preset-card-footer">
                      <button
                        type="button"
                        className={`button ${isCurrent ? 'primary-active' : 'quiet'}`}
                        onClick={async () => {
                          await engine.loadScene(scene.id);
                          onToast(`Preset "${scene.name}" geladen!`);
                        }}
                      >
                        {isCurrent ? <CheckCircle2 size={14} /> : <Sparkles size={14} />}
                        <span>{isCurrent ? 'Aktiv im Jam' : 'Laden'}</span>
                      </button>

                      <button
                        type="button"
                        className="icon-button"
                        title="Als Ableton MIDI Clip exportieren"
                        onClick={() => {
                          const preview = engine.previewScene(scene.id, 8);
                          downloadClipMidi(preview);
                          onToast(`Preset "${scene.name}" als Ableton MIDI exportiert!`);
                        }}
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Import Whole Settings */}
        {activeTab === 'import' && (
          <div className="tab-content import-tab-content">
            <div className="import-grid">
              {/* Option A: File Drop / Select */}
              <div
                className="import-card file-drop-card"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileJson size={32} className="card-icon" />
                <h3>JSON-Einstellungsdatei öffnen</h3>
                <p>Klicke hier oder ziehe eine gespeicherte Session-Datei (.json) hinein.</p>
                <button type="button" className="button primary">
                  <Upload size={14} />
                  <span>Datei auswählen</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden-file-input"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
              </div>

              {/* Option B: Direct Paste JSON */}
              <div className="import-card paste-json-card">
                <div className="card-header-line">
                  <FileCode size={20} />
                  <h3>Oder JSON-Code direkt einfügen</h3>
                </div>
                <textarea
                  className="json-paste-area"
                  rows={8}
                  placeholder="Kopierten Session-JSON-Code hier einfügen …"
                  value={pastedJson}
                  onChange={e => handleJsonChange(e.target.value)}
                />

                {jsonValidation && (
                  <div className={`validation-status ${jsonValidation.valid ? 'is-valid' : 'is-invalid'}`}>
                    {jsonValidation.valid ? (
                      <>
                        <CheckCircle2 size={16} />
                        <div>
                          <strong>Gültige Session: {jsonValidation.name}</strong>
                          <small>
                            {jsonValidation.bpm} BPM · {pitch(jsonValidation.root ?? 50)} {jsonValidation.scale}
                          </small>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={16} />
                        <span>Fehler: {jsonValidation.error}</span>
                      </>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className="button primary apply-json-btn"
                  disabled={!jsonValidation?.valid}
                  onClick={handleApplyPastedJson}
                >
                  <Check size={14} />
                  <span>Einstellungen jetzt anwenden (Hot-Load)</span>
                </button>
              </div>
            </div>

            <div className="import-security-notice">
              <CheckCircle2 size={14} />
              <span>
                <strong>Sicherheits-Garantie:</strong> Beim Importieren wird die Lautstärke automatisch
                normalisiert, der Vinyl-Geräuschpegel bleibt strikt auf max. 5% und die Atmosphäre auf max. 20%
                gedeckelt, um Pegelsprünge zu verhindern.
              </span>
            </div>
          </div>
        )}

        {/* Tab 3: Export Everything & Ableton Integration */}
        {activeTab === 'export' && (
          <div className="tab-content export-tab-content">
            <div className="export-sections-grid">
              {/* Ableton Live Section */}
              <div className="export-card ableton-export-card">
                <div className="card-badge">ABLETON LIVE STANDARD</div>
                <div className="card-header-line">
                  <Headphones size={22} />
                  <div>
                    <h3>Ableton Live Multitrack Export</h3>
                    <p>Standard MIDI File (Type 1 SMF) mit getrennten Spuren & Tempospur.</p>
                  </div>
                </div>

                <div className="ableton-track-list">
                  <div className="track-tag">Ch 1: Texture & Chords</div>
                  <div className="track-tag">Ch 2: Melody</div>
                  <div className="track-tag">Ch 3: Bass</div>
                  <div className="track-tag">Ch 10: Drums (GM: Kick 36, Snare 38, Hat 42, Perc 37)</div>
                  <div className="track-tag info">Oktaven-Standard: Ableton C3 = MIDI 60</div>
                </div>

                <div className="export-actions-cluster">
                  <button
                    type="button"
                    className="button primary"
                    onClick={handleExportAbletonMidi}
                  >
                    <Music size={14} />
                    <span>Multitrack MIDI für Ableton (.mid)</span>
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={handleExportStems}
                  >
                    <Sliders size={14} />
                    <span>Alle Spuren als Stems herunterladen</span>
                  </button>
                </div>
              </div>

              {/* Complete Session Backup */}
              <div className="export-card full-session-card">
                <div className="card-badge">VOLLSTÄNDIGES BACKUP</div>
                <div className="card-header-line">
                  <FileJson size={22} />
                  <div>
                    <h3>Gesamte Einstellungen exportieren</h3>
                    <p>8 Mixer-Spuren, EQ, FX-Ketten, Makros, Sequenzen und Routing.</p>
                  </div>
                </div>

                <div className="session-summary-box">
                  <div className="summary-item">
                    <span>Session:</span>
                    <strong>{session.name}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Tempo & Tonart:</span>
                    <strong>{session.bpm} BPM · {pitch(session.root)} {session.scale}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Spuren:</span>
                    <strong>{session.layers.length} Kanäle konfiguriert</strong>
                  </div>
                  <div className="summary-item">
                    <span>Atmosphäre:</span>
                    <strong>{session.atmosphere?.kind || 'off'} ({Math.round((session.atmosphere?.level ?? 0) * 100)}%)</strong>
                  </div>
                </div>

                <div className="export-actions-cluster">
                  <button
                    type="button"
                    className="button primary"
                    onClick={handleExportSessionJson}
                  >
                    <Download size={14} />
                    <span>Session-Datei (.json) herunterladen</span>
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={handleCopyJson}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'In Zwischenablage kopiert!' : 'JSON in Zwischenablage kopieren'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Live Streaming to Ableton Guide */}
            <div className="live-ableton-routing-strip">
              <div className="strip-title">
                <Radio size={16} />
                <strong>Echtzeit-MIDI zu Ableton Live über den macOS IAC-Treiber</strong>
              </div>
              <p>
                Du kannst die Noten während des Jammens auch live in Ableton aufnehmen:
                Aktiviere in macOS Audio-MIDI-Setup den <strong>IAC-Treiber</strong>, wähle in der App unter{' '}
                <em>Audio- & MIDI-Routing</em> den IAC-Treiber als Ausgang, und erstelle in Ableton MIDI-Spuren
                mit <em>MIDI From: IAC-Treiber</em> auf den Kanälen 1, 2, 3 und 10.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
