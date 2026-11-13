import { useState, useRef, useEffect } from 'react';
import {
  Play,
  Square,
  Shuffle,
  Undo2,
  Redo2,
  Circle,
  Radio,
  Zap,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Dice5,
  FolderDown,
  Tv,
  LayoutGrid,
  Volume2,
} from 'lucide-react';
import { JamEngine, SCENES } from '../../engine/jam/JamEngine';
import { MasterAudio } from '../../engine/audio/audioContext';
import { noteName } from './PianoRoll';
import type { JamPosition, JamSession, ChordPattern, ChordPace } from '../../types/jam';
import type { MusicalScale } from '../../types';
import type { ViewDensityMode } from './WorkspaceBar';
import type { RecorderState } from '../../engine/audio/recorder';

const SCALES: [MusicalScale, string][] = [
  ['dorian', 'Dorian'],
  ['aeolian', 'Natural Minor'],
  ['lydian', 'Lydian'],
  ['phrygian', 'Phrygian'],
  ['majorPentatonic', 'Major Pentatonic'],
  ['minorPentatonic', 'Minor Pentatonic'],
  ['hirajoshi', 'Hirajoshi'],
];

interface EssentialMasterBarProps {
  session: JamSession;
  position: JamPosition;
  midiStatus: string;
  onOpenRouting: () => void;
  onCapture: () => void;
  onOpenSettings?: () => void;
  tab?: 'jam' | 'library' | 'details';
  onTabChange?: (tab: 'jam' | 'library' | 'details') => void;
  libraryCount?: number;
  viewMode?: ViewDensityMode;
  onViewModeChange?: (mode: ViewDensityMode) => void;
  recording?: RecorderState;
  onRecord?: () => void;
  onTogglePlay?: () => void;
  allCollapsed?: boolean;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

const engine = JamEngine.getInstance();
const pitch = (n: number) => noteName(n).replace(/-?\d+$/, '');
const clampBpm = (n: number) => Math.max(40, Math.min(180, Math.round(n)));

export function EssentialMasterBar({
  session,
  position,
  midiStatus,
  onOpenRouting,
  onCapture,
  onOpenSettings,
  tab = 'jam',
  onTabChange,
  libraryCount = 0,
  viewMode = 'compact',
  onViewModeChange,
  recording,
  onRecord,
  onTogglePlay,
}: EssentialMasterBarProps) {
  const [bpmDraft, setBpmDraft] = useState(String(session.bpm));
  const tempoFocused = useRef(false);
  const taps = useRef<number[]>([]);
  const [peakDb, setPeakDb] = useState(-96);
  const lastTapRef = useRef(0);

  useEffect(() => {
    if (!tempoFocused.current) setBpmDraft(String(session.bpm));
  }, [session.bpm]);

  useEffect(() => {
    if (!position.playing) {
      setPeakDb(-96);
      return;
    }
    let raf = 0;
    const tick = () => {
      setPeakDb(engine.getPeakDb());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [position.playing]);

  const masterGainLinear = MasterAudio.volumeToGain(session.volume);
  const masterDbLabel =
    masterGainLinear <= 0.0001
      ? '-∞ dB'
      : `${masterGainLinear >= 1 ? '+' : ''}${(20 * Math.log10(masterGainLinear)).toFixed(1)} dB`;
  const peakLedClass = !position.playing || peakDb < -40
    ? 'is-idle'
    : peakDb > -1
      ? 'is-red'
      : peakDb >= -6
        ? 'is-yellow'
        : 'is-green';

  const resetMasterVolume = () => {
    engine.updateSession({ volume: 0.9 });
  };

  const applyBpm = (n: number) => {
    engine.updateSession({ bpm: clampBpm(n) });
  };

  const commitBpm = () => {
    tempoFocused.current = false;
    const n = Number(bpmDraft.replace(',', '.'));
    if (bpmDraft.trim() && Number.isFinite(n)) applyBpm(n);
    setBpmDraft(String(engine.getState().bpm));
  };

  const tap = () => {
    const now = performance.now();
    taps.current = [...taps.current.filter(t => now - t < 2200), now].slice(-6);
    if (taps.current.length >= 3) {
      const gaps = taps.current.slice(1).map((t, i) => t - taps.current[i]);
      applyBpm(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length));
    }
  };

  const currentSceneIndex = SCENES.findIndex(s => s.id === session.sceneId);
  const root = position.chordRoot;
  const holdBars = position.chordHoldBars || 4;
  const progress = holdBars ? 1 - position.chordBarsLeft / holdBars : 0;
  const scaleName = SCALES.find(s => s[0] === session.scale)?.[1] || session.scale;
  const beatIndex = Math.floor(position.beat) % 4;
  const chordsLayer = session.layers.find(l => l.role === 'chords');
  const currentChordPattern =
    chordsLayer?.settings.chordPattern ||
    (session.style === 'techno' ? 'syncopated' : session.style === 'lofi' ? 'broken' : 'pad');
  const currentChordPace = chordsLayer?.settings.chordPace || '2-bars';
  const secondaryEnabled = Boolean(chordsLayer?.settings.secondaryEnabled);
  const secondaryTimbre = chordsLayer?.settings.secondaryTimbre || 'shimmer';

  const seqBlocks =
    session.sequence && session.sequence.length > 0
      ? session.sequence
      : engine.getSequencerState().blocks;
  const seq = position.sequencer;
  const isSeqActive = Boolean(seq?.enabled);
  const activeBlockIdx = seq?.activeBlockIndex ?? 0;
  const activeBlock = seqBlocks[activeBlockIdx] || seqBlocks[0];
  const currentSection = seq?.currentSection || activeBlock?.section || position.arrangementSection || 'groove';
  const blockBarProgress = seq?.blockBarProgress ?? 0;
  const totalBlockBars = seq?.totalBlockBars ?? activeBlock?.bars ?? 4;
  const nextLabel = seq?.nextBlockLabel || seq?.nextSection?.toUpperCase() || 'Loop';
  const barsUntilNext = seq?.barsUntilNextBlock ?? totalBlockBars;

  const handleEvolve = () => {
    engine.mutate(true);
  };

  const handleRadical = () => {
    engine.radicalRandomize();
  };

  return (
    <header className="essential-master-bar unified-top-console" aria-label="Unified Top Console">
      {/* Unified Console Header Row: Brand + Nav + Scene Preset Selector + Studio Actions */}
      <div className="master-bar-top-row">
        <div className="console-left-cluster">
          <a
            className="wordmark"
            href="#jam"
            onClick={e => {
              e.preventDefault();
              onTabChange?.('jam');
            }}
            aria-label="instajammable — Jam öffnen"
          >
            <span className="brand-symbol">
              <i />
              <i />
              <i />
              <i />
            </span>
            instajammable<span className="brand-dot">.</span>
          </a>

          {onTabChange && (
            <nav className="primary-nav unified-nav" aria-label="Hauptnavigation">
              {([
                ['jam', 'Jam'],
                ['library', 'Sammlung'],
                ['details', 'Details'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onTabChange(id)}
                  aria-current={tab === id ? 'page' : undefined}
                  className={tab === id ? 'selected' : ''}
                >
                  {label}
                  {id === 'library' && libraryCount ? <span>{libraryCount}</span> : null}
                </button>
              ))}
            </nav>
          )}

          <div className="console-divider" />

          {/* Preset Selector right in the Unified Console */}
          <div className="title-and-dropdown">
            <span className="scene-num-badge">
              #{String((currentSceneIndex >= 0 ? currentSceneIndex : 0) + 1).padStart(2, '0')}
            </span>
            <div className="scene-picker-container" title="Kuratierte Klangwelt / Szene direkt wechseln">
              <select
                aria-label="Preset auswählen"
                value={session.sceneId || 'moss-pulse'}
                onChange={e => {
                  void engine.loadScene(e.target.value);
                }}
                className="scene-picker-dropdown"
              >
                {SCENES.map((s, idx) => (
                  <option key={s.id} value={s.id}>
                    #{String(idx + 1).padStart(2, '0')} · {s.name} ({s.style.toUpperCase()} · {s.bpm} BPM)
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="dropdown-arrow-icon" />
            </div>
          </div>
        </div>

        {/* Right Studio Controls: View Mode, Settings & Ableton, Audio/MIDI, Rec, Live Status */}
        <div className="master-meta-cluster">
          {onViewModeChange && (
            <div className="console-density-pills" role="group" aria-label="Ansichts-Modus">
              <button
                type="button"
                className={`console-pill-btn ${viewMode === 'compact' ? 'active' : ''}`}
                onClick={() => onViewModeChange('compact')}
                title="Kompakt-Ansicht"
              >
                <LayoutGrid size={12} />
                <span>Kompakt</span>
              </button>
              <button
                type="button"
                className={`console-pill-btn ${viewMode === 'standard' ? 'active' : ''}`}
                onClick={() => onViewModeChange('standard')}
                title="Standard Studio-Abstände"
              >
                <span>Standard</span>
              </button>
              <button
                type="button"
                className={`console-pill-btn ${viewMode === 'distance' ? 'active' : ''}`}
                onClick={() => onViewModeChange('distance')}
                title="Distanz-HUD (2–3m)"
              >
                <Tv size={12} />
                <span>HUD</span>
              </button>
            </div>
          )}

          {onOpenSettings && (
            <button
              type="button"
              className="button quiet settings-mgr-pill"
              onClick={onOpenSettings}
              title="Presets, Backups & Ableton Live Export"
            >
              <FolderDown size={14} />
              <span>Ableton & Presets</span>
            </button>
          )}

          <button
            type="button"
            className="button quiet midi-route-pill"
            onClick={onOpenRouting}
            title="Audio- & MIDI-Ausgangsrouting konfigurieren"
          >
            <Radio size={14} />
            <span>
              {session.outputMode === 'internal'
                ? 'Audio intern'
                : session.outputMode === 'both'
                  ? 'Audio + MIDI'
                  : 'MIDI'}
            </span>
            <span className={`status-led ${midiStatus === 'ready' ? 'is-ready' : ''}`} />
          </button>

          {onRecord && (
            <button
              type="button"
              className={`record-button ${recording?.isRecording ? 'recording' : ''}`}
              onClick={onRecord}
              aria-label={recording?.isRecording ? 'Aufnahme stoppen und speichern' : 'Audio aufnehmen'}
              title="Internes Audio als WAV mitschneiden"
            >
              <Circle size={12} />
              <span>{recording?.isRecording ? `${recording.durationSec}s` : 'Rec'}</span>
            </button>
          )}

          <div className="jam-live-status-pill">
            <span className={`live-pulse-dot ${position.playing ? 'is-running' : ''}`} />
            <span className="live-status-text">
              {position.playing ? `Takt ${String(position.bar + 1).padStart(3, '0')}` : 'Bereit'}
            </span>
          </div>
        </div>
      </div>

      {/* Prominent Master Volume Bar (Touch-ready 44px target, dB display & Peak LED) */}
      <div className="master-volume-strip" aria-label="Master Lautstärke">
        <div className="master-volume-label">
          <Volume2 size={15} />
          <span>Lautstärke</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={session.volume}
          aria-label="Master Lautstärke"
          title="Master-Lautstärke (Doppelklick/Doppeltap = 90 % Reset)"
          className="master-volume-slider"
          onChange={e => engine.updateSession({ volume: Number(e.target.value) })}
          onDoubleClick={resetMasterVolume}
          onTouchEnd={() => {
            const now = Date.now();
            if (now - lastTapRef.current < 320) resetMasterVolume();
            lastTapRef.current = now;
          }}
        />
        <div className="master-volume-readout">
          <span className="master-volume-pct">{Math.round(session.volume * 100)}%</span>
          <span className="master-volume-db">{masterDbLabel}</span>
          <span
            className={`master-peak-led ${peakLedClass}`}
            title={`Ausgangs-Peak: ${peakDb <= -90 ? '-∞' : peakDb.toFixed(1)} dBFS`}
            aria-label={`Pegel-LED ${peakLedClass}`}
          />
        </div>
      </div>

      {/* Main 4-Cell Studio Control Strip (Well-spaced, clear overview, always editable) */}
      <div className="essential-strip-grid">
        {/* Unit 1: Transport & BPM */}
        <div className="essential-cell transport-cell">
          <button
            type="button"
            className={`master-play-btn ${position.playing ? 'is-playing' : ''}`}
            onClick={() => {
              if (onTogglePlay) {
                onTogglePlay();
              } else {
                void (position.playing ? engine.stop() : engine.start());
              }
            }}
            title={position.playing ? 'Jam stoppen (Leertaste)' : 'Jam starten (Leertaste)'}
          >
            {position.playing ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            <span>{position.playing ? 'Stop' : 'Start'}</span>
          </button>

          <div className="tempo-cluster">
            <div className="tempo-inputs">
              <button
                type="button"
                className="icon-button bpm-step-btn"
                onClick={() => applyBpm(session.bpm - 1)}
                aria-label="1 BPM langsamer"
              >
                −
              </button>
              <input
                id="master-bpm"
                type="text"
                inputMode="numeric"
                className="bpm-text-input"
                aria-label="Tempo in BPM"
                value={bpmDraft}
                onFocus={e => {
                  tempoFocused.current = true;
                  e.currentTarget.select();
                }}
                onChange={e => {
                  const text = e.target.value.replace(/[^0-9.,]/g, '').slice(0, 6);
                  setBpmDraft(text);
                  const n = Number(text.replace(',', '.'));
                  if (text && Number.isFinite(n) && n >= 40 && n <= 180) applyBpm(n);
                }}
                onBlur={commitBpm}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitBpm();
                    e.currentTarget.blur();
                  }
                }}
              />
              <button
                type="button"
                className="icon-button bpm-step-btn"
                onClick={() => applyBpm(session.bpm + 1)}
                aria-label="1 BPM schneller"
              >
                +
              </button>
            </div>

            <div className="tempo-sub-row">
              <button type="button" className="tap-pill-btn" onClick={tap} title="Drei- bis sechsmal im Takt tippen">
                TAP
              </button>
              <div className="master-beat-dots" role="img" aria-label={`Schlag ${beatIndex + 1} von 4`}>
                {[0, 1, 2, 3].map(i => (
                  <span key={i} className={`beat-dot ${position.playing && beatIndex === i ? 'active-beat' : ''}`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Unit 2: Harmonic Center & Dual-Chord Quick Access */}
        <div className="essential-cell harmony-cell">
          <div className="root-stepper-cluster" title="Grundton anpassen (− / + Halbton) oder anspielen">
            <button
              type="button"
              className="icon-button note-step-btn"
              onClick={() => engine.transposeRoot(-1)}
              title="Grundton 1 Halbton tiefer (−1)"
              aria-label="Grundton tiefer"
            >
              −
            </button>

            <div className="root-orb-wrapper">
              <button
                type="button"
                className="master-root-orb"
                onClick={() => void engine.auditionNote(session.root + 12)}
                title="Klicken: Grundton anspielen"
              >
                <small>ROOT</small>
                <strong>{pitch(root)}</strong>
              </button>
              <select
                className="root-inline-picker"
                aria-label="Grundton direkt auswählen"
                value={((session.root % 12) + 12) % 12}
                onChange={e => {
                  const pc = Number(e.target.value);
                  const oct = Math.floor(session.root / 12);
                  engine.setRoot(oct * 12 + pc);
                }}
                title="Grundton direkt auswählen"
              >
                {['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'].map((pName, pIdx) => (
                  <option key={pIdx} value={pIdx}>
                    {pName}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="icon-button note-step-btn"
              onClick={() => engine.transposeRoot(1)}
              title="Grundton 1 Halbton höher (+1)"
              aria-label="Grundton höher"
            >
              +
            </button>
          </div>

          <div className="master-chord-info">
            <div className="chord-label-row">
              <div className="chord-title-interactive-row">
                <button
                  type="button"
                  className="icon-button chord-nav-btn"
                  onClick={() => engine.cycleChord(-1)}
                  title="Vorherige Akkordstufe (◀)"
                  aria-label="Vorherige Akkordstufe"
                >
                  <ChevronLeft size={13} />
                </button>
                <strong className="master-chord-title">{position.chord || pitch(session.root)}</strong>
                <button
                  type="button"
                  className="icon-button chord-nav-btn"
                  onClick={() => engine.cycleChord(1)}
                  title="Nächste Akkordstufe (▶)"
                  aria-label="Nächste Akkordstufe"
                >
                  <ChevronRight size={13} />
                </button>
              </div>

              <select
                className="key-tag-select"
                value={session.scale}
                onChange={e => engine.updateSession({ scale: e.target.value as MusicalScale })}
                title={`Tonleiter: ${pitch(session.root)} ${scaleName}`}
                aria-label="Skala wechseln"
              >
                {SCALES.map(([val, label]) => (
                  <option key={val} value={val}>
                    {pitch(session.root)} {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Individual chord notes: on-the-fly transposing and auditioning */}
            <div className="master-chord-tones">
              {position.chordNotes.map((n, i) => (
                <div key={i} className="mini-tone-stepper-node">
                  <button
                    type="button"
                    className="mini-note-nudge down"
                    onClick={() => engine.nudgeChordNote(i, -1)}
                    title={`${pitch(n)}: 1 Halbton tiefer (−)`}
                    aria-label={`${pitch(n)} tiefer`}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className={`mini-tone-btn ${((n % 12) + 12) % 12 === ((root % 12) + 12) % 12 ? 'is-root' : ''}`}
                    onClick={() => void engine.auditionNote(n)}
                    title={`${pitch(n)} (${n}) anspielen`}
                  >
                    {pitch(n)}
                  </button>
                  <button
                    type="button"
                    className="mini-note-nudge up"
                    onClick={() => engine.nudgeChordNote(i, 1)}
                    title={`${pitch(n)}: 1 Halbton höher (+)`}
                    aria-label={`${pitch(n)} höher`}
                  >
                    +
                  </button>
                </div>
              ))}
            </div>

            {/* Pattern, Pace & Dual-Chord B Quick Row */}
            <div className="chord-pattern-pace-row">
              <label className="mini-chord-pattern-select" title="Generatives Akkordmuster wählen">
                <span className="mini-label">Muster:</span>
                <select
                  value={currentChordPattern}
                  onChange={e => engine.setChordPattern(e.target.value as ChordPattern)}
                  aria-label="Akkordmuster"
                >
                  <option value="pad">Pad</option>
                  <option value="wave">Wave</option>
                  <option value="pulse">Pulse</option>
                  <option value="broken">Arp</option>
                  <option value="cluster">Cluster</option>
                  <option value="euclidean">Euklid</option>
                  <option value="syncopated">Sync</option>
                </select>
              </label>

              <label className="mini-chord-pace-select" title="Harmoniewechsel (Pace)">
                <span className="mini-label">Takt:</span>
                <select
                  value={currentChordPace}
                  onChange={e => engine.setChordPace(e.target.value as ChordPace)}
                  aria-label="Harmoniewechsel"
                >
                  <option value="1-bar">1T</option>
                  <option value="2-bars">2T</option>
                  <option value="4-bars">4T</option>
                  <option value="dynamic">Dyn</option>
                </select>
              </label>

              <button
                type="button"
                className={`mini-reharmonize-btn ${secondaryEnabled ? 'is-active' : ''}`}
                onClick={() => engine.setSecondaryChord({ enabled: !secondaryEnabled })}
                title="Dual-Chord Spur B ein-/ausschalten"
              >
                <span>B: {secondaryEnabled ? secondaryTimbre.toUpperCase() : 'OFF'}</span>
              </button>
            </div>
          </div>

          <div className="master-next-chord-col">
            <span className="cell-eyebrow">DANACH</span>
            <strong className="next-chord-text">{position.nextChord || '–'}</strong>
            <div className="next-chord-progress-bar">
              <div className="next-chord-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <span className="next-chord-helper">
              {position.playing ? `in ${Math.max(1, Math.ceil(position.chordBarsLeft))}T` : 'Bereit'}
            </span>
          </div>
        </div>

        {/* Unit 3: Editable Arrangement Mini Module (Always editable; clicking any scene activates it ASAP) */}
        <div className={`essential-cell sequence-cell ${!isSeqActive ? 'is-seq-off' : ''}`}>
          <div className="seq-cell-header">
            <span className="cell-eyebrow">
              ARRANGEMENT · {isSeqActive ? `#${activeBlockIdx + 1} ${(seq?.currentBlockLabel || currentSection).toUpperCase()}` : 'MANUELL / AUS'}
            </span>

            <div className="seq-header-right">
              {/* Bar duration stepper: always editable */}
              <div className="seq-bars-mini-stepper" title="Block-Länge in Takten anpassen (aktiviert Sequencer sofort)">
                <button
                  type="button"
                  className="icon-button mini-bar-step-btn"
                  onClick={() => {
                    if (activeBlock) engine.stepBlockBars(activeBlock.id, -1);
                  }}
                  title="Takte verkürzen (−)"
                  aria-label="Takte verkürzen"
                >
                  −
                </button>
                <span className="active-bar-badge">
                  {isSeqActive ? `${blockBarProgress + 1}/${totalBlockBars}T` : `${totalBlockBars}T`}
                </span>
                <button
                  type="button"
                  className="icon-button mini-bar-step-btn"
                  onClick={() => {
                    if (activeBlock) engine.stepBlockBars(activeBlock.id, 1);
                  }}
                  title="Takte verlängern (+)"
                  aria-label="Takte verlängern"
                >
                  +
                </button>
              </div>

              {/* Clean ON / OFF Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={isSeqActive}
                className={`hardware-switch-pill ${isSeqActive ? 'is-on' : 'is-off'}`}
                onClick={() => engine.toggleSequencer(!isSeqActive)}
                title={isSeqActive ? 'Arrangement-Sequenzer ausschalten' : 'Arrangement-Sequenzer einschalten'}
              >
                <span className="switch-dot" />
                <span>{isSeqActive ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>

          <div className="seq-block-callout">
            {/* Always-editable scene/section buttons: clicking any button activates the sequencer ASAP */}
            <div className="seq-energy-arrow-row" role="group" aria-label="Abschnitt sofort aktivieren">
              <button
                type="button"
                className={`seq-mini-arrow-btn high ${isSeqActive && currentSection === 'chorus' ? 'is-selected' : ''}`}
                onClick={() => {
                  if (activeBlock) engine.setBlockSectionByEnergy(activeBlock.id, 'high');
                  else engine.applyArrangement('chorus');
                }}
                title="Sofort aktivieren: High (↑) · Chorus / Peak"
              >
                <span className="arrow-icon">↑</span>
                <span>High</span>
              </button>
              <button
                type="button"
                className={`seq-mini-arrow-btn up ${isSeqActive && currentSection === 'buildup' ? 'is-selected' : ''}`}
                onClick={() => {
                  if (activeBlock) engine.setBlockSectionByEnergy(activeBlock.id, 'up');
                  else engine.applyArrangement('buildup');
                }}
                title="Sofort aktivieren: Up (↗) · Buildup / Steigerung"
              >
                <span className="arrow-icon">↗</span>
                <span>Up</span>
              </button>
              <button
                type="button"
                className={`seq-mini-arrow-btn groove ${isSeqActive && currentSection === 'groove' ? 'is-selected' : ''}`}
                onClick={() => {
                  if (activeBlock) engine.setBlockSectionByEnergy(activeBlock.id, 'groove');
                  else engine.applyArrangement('groove');
                }}
                title="Sofort aktivieren: Flow (➔) · Voller Groove"
              >
                <span className="arrow-icon">➔</span>
                <span>Flow</span>
              </button>
              <button
                type="button"
                className={`seq-mini-arrow-btn down ${isSeqActive && currentSection === 'breakdown' ? 'is-selected' : ''}`}
                onClick={() => {
                  if (activeBlock) engine.setBlockSectionByEnergy(activeBlock.id, 'down');
                  else engine.applyArrangement('breakdown');
                }}
                title="Sofort aktivieren: Down (↘) · Breakdown (Drums aus)"
              >
                <span className="arrow-icon">↘</span>
                <span>Down</span>
              </button>
              <button
                type="button"
                className={`seq-mini-arrow-btn low ${isSeqActive && currentSection === 'silent' ? 'is-selected' : ''}`}
                onClick={() => {
                  if (activeBlock) engine.setBlockSectionByEnergy(activeBlock.id, 'low');
                  else engine.applyArrangement('silent');
                }}
                title="Sofort aktivieren: Low (↓) · Stille / Intimer Raum"
              >
                <span className="arrow-icon">↓</span>
                <span>Low</span>
              </button>
            </div>

            <div className="seq-next-sub-row">
              <span className="seq-next-cue">
                {isSeqActive
                  ? `Nächster Teil: ${nextLabel} (in ${barsUntilNext}T)`
                  : 'Klicke High / Up / Flow / Down / Low für Sofort-Start'}
              </span>
              <button
                type="button"
                className="seq-skip-btn"
                onClick={() =>
                  engine.jumpToSequenceBlock((activeBlockIdx + 1) % Math.max(1, seqBlocks.length))
                }
                title="Sofort zum nächsten Block springen (aktiviert Sequencer)"
              >
                <SkipForward size={11} />
                <span>Nächster Block</span>
              </button>
            </div>
          </div>
        </div>

        {/* Unit 4: Creative Evolution & Capture (Generously spaced buttons) */}
        <div className="essential-cell creative-cell">
          <div className="evolve-button-group">
            <button
              type="button"
              className="master-evolve-btn"
              onClick={handleEvolve}
              title="Entwickelt Voicings, Grooves und Klangfarben weiter mit automatischer Lautstärke-Stabilisierung"
            >
              <Shuffle size={15} />
              <div className="evolve-btn-txt">
                <strong>Evolve</strong>
                <span className="loudness-tag">Loudness-Safe</span>
              </div>
            </button>

            <button
              type="button"
              className="master-radical-btn"
              onClick={handleRadical}
              title="Radical Random: Komplette kreative Neukomposition (Skala, Grundton, Timbres, Rhythmen, Effekte)"
            >
              <Dice5 size={15} />
              <div className="radical-btn-txt">
                <strong>Radical</strong>
                <span className="radical-tag">Neu würfeln</span>
              </div>
            </button>

            <div className="undo-redo-cluster">
              <button
                type="button"
                className="icon-button master-tool-btn"
                onClick={() => engine.undo()}
                title="Rückgängig machen (Undo)"
                aria-label="Undo"
              >
                <Undo2 size={14} />
              </button>
              <button
                type="button"
                className="icon-button master-tool-btn"
                onClick={() => engine.redo()}
                title="Wiederholen (Redo)"
                aria-label="Redo"
              >
                <Redo2 size={14} />
              </button>
            </div>
          </div>

          <div className="creative-shortcuts-row">
            <button
              type="button"
              className="quick-creative-btn chaos-btn"
              onClick={() => engine.applyChaosImpulse()}
              title="Organischen Timbre-Drift anstoßen"
            >
              <Zap size={12} />
              <span>Drift</span>
            </button>
            <button
              type="button"
              className="quick-creative-btn drop-btn"
              onClick={() => engine.applyArrangement('spontaneous')}
              title="Spontaner Arrangement-Wechsel"
            >
              <Sparkles size={12} />
              <span>Wendung</span>
            </button>
            <button
              type="button"
              className="quick-creative-btn capture-btn"
              onClick={onCapture}
              title="Letzte 8 Takte als MIDI-Take festhalten"
            >
              <Circle size={10} />
              <span>Capture MIDI</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
