import React, { useState, useRef, useMemo, useEffect } from 'react';
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
import { useUiEdition } from '../../contexts/UiEditionContext';
import { getSceneDisplay, MINIMAL_ATMOSPHERE_LABELS, stripArtistRefs } from '../../engine/jam/minimalCatalog';
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
  const uiEdition = useUiEdition();
  const isMinimal = uiEdition === 'minimal';
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
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      prevFocus?.focus?.();
    };
  }, [isOpen, onClose]);

  // Filter scenes
  const filteredScenes = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return SCENES.filter(s => {
      const disp = getSceneDisplay(s, uiEdition);
      const matchesSearch =
        disp.name.toLowerCase().includes(q) ||
        disp.description.toLowerCase().includes(q) ||
        (disp.mood && disp.mood.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (categoryFilter === 'all') return true;
      if (categoryFilter === 'psybient') return /cbl|psybient|ultimae/i.test(s.mood || s.id);
      if (categoryFilter === 'ambient') return s.style === 'ambient' && !/cbl|psybient|ultimae|orchestral|classical/i.test(s.mood || s.id);
      if (categoryFilter === 'classical') return /orchestral|classical/i.test(s.mood || s.id);
      if (categoryFilter === 'techno') return s.style === 'techno';
      if (categoryFilter === 'lofi') return s.style === 'lofi';
      return true;
    });
  }, [searchQuery, categoryFilter, uiEdition]);

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
        throw new Error(isMinimal ? 'JSON must be an object.' : 'JSON muss ein Objekt sein.');
      }
      const name = parsed.name || (isMinimal ? 'Untitled Session' : 'Unbenannte Session');
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
        error: err instanceof Error ? err.message : (isMinimal ? 'Invalid JSON format.' : 'Ungültiges JSON-Format.'),
      });
    }
  };

  const handleApplyPastedJson = () => {
    if (!jsonValidation?.valid || !jsonValidation.parsed) return;
    try {
      engine.loadSession(jsonValidation.parsed);
      onToast(isMinimal ? `Settings "${jsonValidation.name}" imported.` : `Einstellungen "${jsonValidation.name}" erfolgreich importiert & geladen!`);
      onClose();
    } catch (err) {
      onToast(err instanceof Error ? err.message : (isMinimal ? 'Failed to load session.' : 'Fehler beim Laden der Session.'));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 12_000_000) {
      onToast(isMinimal ? 'File is too large (max 12 MB).' : 'Datei ist zu groß (max 12 MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result);
        const parsed = JSON.parse(text);
        engine.loadSession(parsed);
        onToast(isMinimal ? `Session "${parsed.name || file.name}" loaded.` : `Session "${parsed.name || file.name}" geladen!`);
        onClose();
      } catch (err) {
        onToast(err instanceof Error ? err.message : (isMinimal ? 'Failed to import file.' : 'Fehler beim Importieren der Datei.'));
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
      onToast(isMinimal ? 'Multitrack MIDI (.mid) exported.' : 'Ableton Multitrack MIDI (.mid) erfolgreich exportiert!');
    } catch (err) {
      onToast(err instanceof Error ? err.message : (isMinimal ? 'MIDI export failed.' : 'MIDI-Export fehlgeschlagen.'));
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
      onToast(isMinimal ? `${count} tracks exported as MIDI stems.` : `${count} Spuren als separate Ableton MIDI-Stems exportiert!`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : (isMinimal ? 'Stem export failed.' : 'Stem-Export fehlgeschlagen.'));
    }
  };

  // Export Full Session JSON
  const handleExportSessionJson = () => {
    try {
      const current = engine.saveSession();
      const safeName = current.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
      exportJson(current, `atem-session-${safeName}-${Date.now()}.json`);
      onToast(isMinimal ? 'Full session (.json) exported.' : 'Vollständige Session (.json) exportiert!');
    } catch (err) {
      onToast(err instanceof Error ? err.message : (isMinimal ? 'Export failed.' : 'Export fehlgeschlagen.'));
    }
  };

  // Copy JSON to Clipboard
  const handleCopyJson = async () => {
    try {
      const current = engine.saveSession();
      const jsonStr = JSON.stringify(current, null, 2);
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(jsonStr);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2400);
      onToast(isMinimal ? 'Settings copied to clipboard.' : 'Gesamte Einstellungen in die Zwischenablage kopiert!');
    } catch {
      setCopied(false);
      onToast(isMinimal ? 'Could not copy to clipboard.' : 'Konnte nicht in die Zwischenablage kopieren.');
    }
  };

  const sessionDisplayName = isMinimal ? stripArtistRefs(session.name) : session.name;
  const activeScene = SCENES.find(s => s.id === session.sceneId);
  const shownSessionName = isMinimal && activeScene ? getSceneDisplay(activeScene, uiEdition).name : sessionDisplayName;

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
            <h2 id="settings-dialog-title">{isMinimal ? 'Import, Export & DAW MIDI' : 'Alles importieren, exportieren & Ableton Live'}</h2>
            {!isMinimal && (
              <p className="header-sub">
                Standardisierte Vorlagen, vollständige Backups und nahtloser Workflow mit Ableton Live 10/11/12.
              </p>
            )}
          </div>
          <button
            type="button"
            className="icon-button close-modal-btn"
            onClick={onClose}
            aria-label={isMinimal ? 'Close' : 'Schließen'}
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
            <span>{isMinimal ? `Presets (${SCENES.length})` : `Standardisierte Presets (${SCENES.length})`}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
            role="tab"
            aria-selected={activeTab === 'import'}
          >
            <Upload size={15} />
            <span>{isMinimal ? 'Import' : 'Einstellungen importieren'}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
            role="tab"
            aria-selected={activeTab === 'export'}
          >
            <Download size={15} />
            <span>{isMinimal ? 'Export & MIDI' : 'Alles exportieren & Ableton'}</span>
          </button>
        </nav>

        {/* Tab 1: Standardized Presets */}
        {activeTab === 'presets' && (
          <div className="tab-content presets-tab-content">
            <div className="presets-toolbar">
              <div className="filter-pills">
                {(isMinimal
                  ? [
                      ['all', 'All Presets'],
                      ['psybient', 'Psybient'],
                      ['ambient', 'Ambient & Space'],
                      ['classical', 'Orchestral / Felt'],
                      ['techno', 'Deep Techno'],
                      ['lofi', 'Lo-Fi Flow'],
                    ]
                  : [
                      ['all', 'Alle Presets'],
                      ['psybient', 'Psybient · CBL'],
                      ['ambient', 'Ambient & Space'],
                      ['classical', 'Orchestral / Felt'],
                      ['techno', 'Deep Techno'],
                      ['lofi', 'Lo-Fi Flow'],
                    ]
                ).map(([id, label]) => (
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
                placeholder={isMinimal ? 'Search preset by name or mood…' : 'Preset nach Name oder Stimmung suchen …'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="preset-cards-grid">
              {filteredScenes.map((scene: SceneDefinition) => {
                const isCurrent = scene.id === session.sceneId;
                const disp = getSceneDisplay(scene, uiEdition);
                return (
                  <article
                    key={scene.id}
                    className={`preset-card ${isCurrent ? 'is-current' : ''}`}
                  >
                    <div className="card-top-row">
                      <span className="preset-mood-badge">{disp.mood || scene.style.toUpperCase()}</span>
                      <span className="preset-tempo-badge">{scene.bpm} BPM</span>
                      <span className="preset-key-badge">
                        {pitch(scene.root)} {scene.scale}
                      </span>
                    </div>

                    <h3 className="preset-card-title">{disp.name}</h3>
                    {!isMinimal && <p className="preset-card-desc">{disp.description}</p>}

                    <div className="preset-card-footer">
                      <button
                        type="button"
                        className={`button ${isCurrent ? 'primary-active' : 'quiet'}`}
                        onClick={async () => {
                          await engine.loadScene(scene.id);
                          onToast(isMinimal ? `Preset "${disp.name}" loaded.` : `Preset "${disp.name}" geladen!`);
                        }}
                      >
                        {isCurrent ? <CheckCircle2 size={14} /> : <Sparkles size={14} />}
                        <span>{isMinimal ? (isCurrent ? 'Active' : 'Load') : (isCurrent ? 'Aktiv im Jam' : 'Laden')}</span>
                      </button>

                      <button
                        type="button"
                        className="icon-button"
                        title={isMinimal ? 'Export as multitrack MIDI clip' : 'Als Ableton MIDI Clip exportieren'}
                        onClick={() => {
                          const preview = engine.previewScene(scene.id, 8);
                          downloadClipMidi(preview);
                          onToast(isMinimal ? `Preset "${disp.name}" exported as MIDI.` : `Preset "${disp.name}" als Ableton MIDI exportiert!`);
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
                <h3>{isMinimal ? 'Open JSON Session File' : 'JSON-Einstellungsdatei öffnen'}</h3>
                <p>{isMinimal ? 'Click or drop a saved session (.json) file here.' : 'Klicke hier oder ziehe eine gespeicherte Session-Datei (.json) hinein.'}</p>
                <button type="button" className="button primary">
                  <Upload size={14} />
                  <span>{isMinimal ? 'Choose File' : 'Datei auswählen'}</span>
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
                  <h3>{isMinimal ? 'Or Paste Session JSON' : 'Oder JSON-Code direkt einfügen'}</h3>
                </div>
                <textarea
                  className="json-paste-area"
                  rows={8}
                  placeholder={isMinimal ? 'Paste copied session JSON here…' : 'Kopierten Session-JSON-Code hier einfügen …'}
                  value={pastedJson}
                  onChange={e => handleJsonChange(e.target.value)}
                />

                {jsonValidation && (
                  <div className={`validation-status ${jsonValidation.valid ? 'is-valid' : 'is-invalid'}`}>
                    {jsonValidation.valid ? (
                      <>
                        <CheckCircle2 size={16} />
                        <div>
                          <strong>{isMinimal ? `Valid session: ${jsonValidation.name}` : `Gültige Session: ${jsonValidation.name}`}</strong>
                          <small>
                            {jsonValidation.bpm} BPM · {pitch(jsonValidation.root ?? 50)} {jsonValidation.scale}
                          </small>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={16} />
                        <span>{isMinimal ? `Error: ${jsonValidation.error}` : `Fehler: ${jsonValidation.error}`}</span>
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
                  <span>{isMinimal ? 'Apply Settings Now' : 'Einstellungen jetzt anwenden (Hot-Load)'}</span>
                </button>
              </div>
            </div>

            {!isMinimal && (
              <div className="import-security-notice">
                <CheckCircle2 size={14} />
                <span>
                  <strong>Sicherheits-Garantie:</strong> Beim Importieren wird die Lautstärke automatisch
                  normalisiert, der Vinyl-Geräuschpegel bleibt strikt auf max. 5% und die Atmosphäre auf max. 10%
                  gedeckelt, um Pegelsprünge zu verhindern.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Export Everything & Ableton Integration */}
        {activeTab === 'export' && (
          <div className="tab-content export-tab-content">
            <div className="export-sections-grid">
              {/* Ableton Live Section */}
              <div className="export-card ableton-export-card">
                <div className="card-badge">{isMinimal ? 'MULTITRACK MIDI' : 'ABLETON LIVE STANDARD'}</div>
                <div className="card-header-line">
                  <Headphones size={22} />
                  <div>
                    <h3>{isMinimal ? 'DAW / Ableton MIDI Export' : 'Ableton Live Multitrack Export'}</h3>
                    <p>{isMinimal ? 'Standard MIDI File (Type 1 SMF) with separated tracks & tempo map.' : 'Standard MIDI File (Type 1 SMF) mit getrennten Spuren & Tempospur.'}</p>
                  </div>
                </div>

                <div className="ableton-track-list">
                  <div className="track-tag">Ch 1: Texture & Chords</div>
                  <div className="track-tag">Ch 2: Melody</div>
                  <div className="track-tag">Ch 3: Bass</div>
                  <div className="track-tag">Ch 10: Drums (GM: Kick 36, Snare 38, Hat 42, Perc 37)</div>
                  <div className="track-tag info">{isMinimal ? 'Octave convention: C3 = MIDI 60' : 'Oktaven-Standard: Ableton C3 = MIDI 60'}</div>
                </div>

                <div className="export-actions-cluster">
                  <button
                    type="button"
                    className="button primary"
                    onClick={handleExportAbletonMidi}
                  >
                    <Music size={14} />
                    <span>{isMinimal ? 'Multitrack MIDI (.mid)' : 'Multitrack MIDI für Ableton (.mid)'}</span>
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={handleExportStems}
                  >
                    <Sliders size={14} />
                    <span>{isMinimal ? 'Export Track Stems (.mid)' : 'Alle Spuren als Stems herunterladen'}</span>
                  </button>
                  <a
                    href="./templates/InstaJammable_Studio_Catch.als"
                    download="InstaJammable_Studio_Catch.als"
                    className="button"
                    style={{ textDecoration: 'none' }}
                    title={isMinimal ? 'Ableton Live 12 template with preconfigured IAC MIDI channels' : 'Live-Routing-Vorlage für Ableton Live 12 mit vorkonfiguriertem IAC-Empfang für DS Kick & Xpand!2'}
                  >
                    <Download size={14} />
                    <span>Ableton Catch Template (.als)</span>
                  </a>
                </div>
              </div>

              {/* Complete Session Backup */}
              <div className="export-card full-session-card">
                <div className="card-badge">{isMinimal ? 'SESSION BACKUP' : 'VOLLSTÄNDIGES BACKUP'}</div>
                <div className="card-header-line">
                  <FileJson size={22} />
                  <div>
                    <h3>{isMinimal ? 'Export Full Settings' : 'Gesamte Einstellungen exportieren'}</h3>
                    <p>{isMinimal ? '8 mixer channels, EQ, FX chain, macros, sequences and routing.' : '8 Mixer-Spuren, EQ, FX-Ketten, Makros, Sequenzen und Routing.'}</p>
                  </div>
                </div>

                <div className="session-summary-box">
                  <div className="summary-item">
                    <span>Session:</span>
                    <strong>{shownSessionName}</strong>
                  </div>
                  <div className="summary-item">
                    <span>{isMinimal ? 'Tempo & Key:' : 'Tempo & Tonart:'}</span>
                    <strong>{session.bpm} BPM · {pitch(session.root)} {session.scale}</strong>
                  </div>
                  <div className="summary-item">
                    <span>{isMinimal ? 'Tracks:' : 'Spuren:'}</span>
                    <strong>{session.layers.length} {isMinimal ? 'channels configured' : 'Kanäle konfiguriert'}</strong>
                  </div>
                  <div className="summary-item">
                    <span>{isMinimal ? 'Atmosphere:' : 'Atmosphäre:'}</span>
                    <strong>
                      {isMinimal
                        ? MINIMAL_ATMOSPHERE_LABELS[session.atmosphere?.kind || 'off']
                        : (session.atmosphere?.kind || 'off')} ({Math.round((session.atmosphere?.level ?? 0) * 100)}%)
                    </strong>
                  </div>
                </div>

                <div className="export-actions-cluster">
                  <button
                    type="button"
                    className="button primary"
                    onClick={handleExportSessionJson}
                  >
                    <Download size={14} />
                    <span>{isMinimal ? 'Download Session (.json)' : 'Session-Datei (.json) herunterladen'}</span>
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={handleCopyJson}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? (isMinimal ? 'Copied to clipboard!' : 'In Zwischenablage kopiert!') : (isMinimal ? 'Copy JSON to Clipboard' : 'JSON in Zwischenablage kopieren')}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Live Streaming to Ableton Guide */}
            <div className="live-ableton-routing-strip">
              <div className="strip-title">
                <Radio size={16} />
                <strong>{isMinimal ? 'Live MIDI to DAW via macOS IAC Driver' : 'Echtzeit-MIDI zu Ableton Live über den macOS IAC-Treiber'}</strong>
              </div>
              <p>
                {isMinimal
                  ? 'Record live notes into your DAW: enable the IAC Driver in macOS Audio MIDI Setup, select it in MIDI Routing, and receive each track on MIDI Ch 1–8 (1 Texture · 2 Chords · 3 Bass · 4 Melody · 5 Kick · 6 Snare · 7 Hi-Hat · 8 Perc), or switch to GM Drums Ch 10.'
                  : <>Du kannst die Noten während des Jammens auch live in Ableton aufnehmen: Aktiviere in macOS Audio-MIDI-Setup den <strong>IAC-Treiber</strong>, wähle in der App den <strong>🎹 MIDI Mode</strong> (oder <em>Audio- & MIDI-Routing</em>) und lege in Ableton pro Instrument eine Spur auf <strong>Ch 1–8</strong> an (1 Texture · 2 Chords · 3 Bass · 4 Melody · 5 Kick · 6 Snare · 7 Hi-Hat · 8 Perc).</>}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
