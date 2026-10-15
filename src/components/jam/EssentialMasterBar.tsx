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
  Activity,
  Maximize2,
  Minimize2,
  Dice5,
  FolderDown,
} from 'lucide-react';
import { JamEngine, SCENES } from '../../engine/jam/JamEngine';
import { noteName } from './PianoRoll';
import type { JamPosition, JamSession, ChordPattern, ChordPace, ChordTexture } from '../../types/jam';
import type { MusicalScale } from '../../types';

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
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  allCollapsed?: boolean;
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
  onExpandAll,
  onCollapseAll,
  allCollapsed = false,
}: EssentialMasterBarProps) {
  // Tempo draft state
  const [bpmDraft, setBpmDraft] = useState(String(session.bpm));
  const tempoFocused = useRef(false);
  const taps = useRef<number[]>([]);

  useEffect(() => {
    if (!tempoFocused.current) setBpmDraft(String(session.bpm));
  }, [session.bpm]);

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
  const currentScene = SCENES[currentSceneIndex] || SCENES[0];
  const root = position.chordRoot;
  const holdBars = position.chordHoldBars || 4;
  const progress = holdBars ? 1 - position.chordBarsLeft / holdBars : 0;
  const scaleName = SCALES.find(s => s[0] === session.scale)?.[1] || session.scale;
  const beatIndex = Math.floor(position.beat) % 4;
  const chordsLayer = session.layers.find(l => l.role === 'chords');
  const currentChordPattern = chordsLayer?.settings.chordPattern || (session.style === 'techno' ? 'syncopated' : session.style === 'lofi' ? 'broken' : 'pad');
  const currentChordPace = chordsLayer?.settings.chordPace || '2-bars';
  const currentChordTexture = chordsLayer?.settings.chordTexture || 'off';

  const seq = position.sequencer;
  const isSeqActive = !!seq?.enabled;

  const handleEvolve = () => {
    // Loudness-safe evolve keeps perceived overall loudness stable
    engine.mutate(true);
  };

  const handleRadical = () => {
    // Radical randomizes scale, root, BPM, timbres, rhythms and effects safely
    engine.radicalRandomize();
  };

  return (
    <header className="essential-master-bar" aria-label="Essential Master Bar">
      {/* Top Deck: Big Name + Preset Selector right next to it */}
      <div className="master-bar-top-row">
        <div className="session-preset-cluster">
          <div className="title-and-dropdown">
            <h1 className="session-big-title">
              {session.name}
              <span className="scene-num-badge">
                #{String((currentSceneIndex >= 0 ? currentSceneIndex : 0) + 1).padStart(2, '0')}
              </span>
            </h1>

            {/* Preset Selector RIGHT NEXT to the big name */}
            <div className="scene-picker-container" title="Preset / Szene direkt wechseln">
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

          <p className="scene-quick-desc">{currentScene?.description || 'Atmosphärischer Klangraum'}</p>
        </div>

        {/* Global Live Info & Routing Chip */}
        <div className="master-meta-cluster">
          {onOpenSettings && (
            <button
              type="button"
              className="button quiet settings-mgr-pill"
              onClick={onOpenSettings}
              title="Standardisierte Presets & Backups: Alles importieren/exportieren & Ableton Live"
            >
              <FolderDown size={14} />
              <span>Settings & Ableton</span>
            </button>
          )}

          <button
            type="button"
            className="button quiet midi-route-pill"
            onClick={onOpenRouting}
            title="Audio- & MIDI-Ausgangsrouting konfigurieren"
          >
            <Radio size={14} />
            <span>{session.outputMode === 'internal' ? 'Audio intern' : session.outputMode === 'both' ? 'Audio + MIDI' : 'MIDI'}</span>
            <span className={`status-led ${midiStatus === 'ready' ? 'is-ready' : ''}`} />
          </button>

          <div className="jam-live-status-pill">
            <span className={`live-pulse-dot ${position.playing ? 'is-running' : ''}`} />
            <span className="live-status-text">
              {position.playing ? `Live · Takt ${String(position.bar + 1).padStart(3, '0')}` : 'Bereit'}
            </span>
          </div>

          {/* Quick Rack Collapse / Expand All toggle */}
          {onExpandAll && onCollapseAll && (
            <button
              type="button"
              className="button quiet rack-toggle-all-btn"
              onClick={allCollapsed ? onExpandAll : onCollapseAll}
              title={allCollapsed ? 'Alle Plugins ausklappen' : 'Alle Plugins auf Miniatur-Leiste minimieren'}
            >
              {allCollapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
              <span>{allCollapsed ? 'Alle Ausklappen' : 'Alle Minimieren'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Essential Controls Strip */}
      <div className="essential-strip-grid">
        {/* Unit 1: Transport & BPM */}
        <div className="essential-cell transport-cell">
          <button
            type="button"
            className={`master-play-btn ${position.playing ? 'is-playing' : ''}`}
            onClick={() => void (position.playing ? engine.stop() : engine.start())}
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

        {/* Unit 2: Harmonic Center & Sounding Chord - Notes on the fly like tempo settings */}
        <div className="essential-cell harmony-cell">
          {/* Root note stepper: - / root / + like tempo settings */}
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
                  <option key={pIdx} value={pIdx}>{pName}</option>
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
              <span className="cell-eyebrow">AKKORD JETZT</span>
              <select
                className="key-tag-select"
                value={session.scale}
                onChange={e => engine.updateSession({ scale: e.target.value as MusicalScale })}
                title={`Tonleiter: ${pitch(session.root)} ${scaleName} (Klick zum Wechseln)`}
                aria-label="Skala wechseln"
              >
                {SCALES.map(([val, label]) => (
                  <option key={val} value={val}>{pitch(session.root)} {label}</option>
                ))}
              </select>
            </div>

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

            {/* Individual chord notes: on the fly transposing and auditioning like tempo settings */}
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

            {/* Generative pattern & pace on-the-fly row */}
            <div className="chord-pattern-pace-row">
              <label className="mini-chord-pattern-select" title="Generatives Akkordmuster wählen">
                <span className="mini-label">Muster:</span>
                <select
                  value={currentChordPattern}
                  onChange={e => engine.setChordPattern(e.target.value as ChordPattern)}
                  aria-label="Akkordmuster"
                >
                  <option value="pad">Pad (Fläche)</option>
                  <option value="pulse">Puls (3/16 CBL)</option>
                  <option value="broken">Broken (Arp)</option>
                  <option value="syncopated">Sync (Dub-Stab)</option>
                  <option value="euclidean">Euklid (Poly)</option>
                  <option value="wave">Welle (Swell)</option>
                  <option value="cluster">Cluster (Glanz)</option>
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

              <label className="mini-chord-pace-select" title="Zusätzliche Begleittextur / Shimmer Layer">
                <span className="mini-label">Layer:</span>
                <select
                  value={currentChordTexture}
                  onChange={e => engine.setChordTexture(e.target.value as ChordTexture)}
                  aria-label="Akkord-Begleittextur"
                >
                  <option value="off">Aus</option>
                  <option value="shimmer">✨ Shimmer</option>
                  <option value="octave">⚡ Oktave</option>
                  <option value="sub5th">🪐 Quinte</option>
                </select>
              </label>

              <button
                type="button"
                className="mini-reharmonize-btn"
                onClick={() => engine.evolve()}
                title="Akkordfolge & Voicings generativ weiterentwickeln"
                aria-label="Re-Harmonisieren"
              >
                <Dice5 size={11} />
                <span>Neu</span>
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
              {position.playing ? `in ${Math.max(1, Math.ceil(position.chordBarsLeft))}T` : 'beim Jam'}
            </span>
          </div>
        </div>

        {/* Unit 3: Sequence Tracker Ribbon Breadcrumb with on-the-fly mini arrow buttons & steppers */}
        <div className="essential-cell sequence-cell">
          <div className="seq-cell-header">
            <span className="cell-eyebrow">ARRANGEMENT-SEQUENZ</span>
            <button
              type="button"
              className={`seq-status-chip ${isSeqActive ? 'active' : 'idle'}`}
              onClick={() => engine.toggleSequencer(!isSeqActive)}
              title={isSeqActive ? 'Sequencer pausieren' : 'Sequencer starten'}
            >
              <Activity size={12} />
              <span>{isSeqActive ? 'Aktiv' : 'Frei'}</span>
            </button>
          </div>

          {isSeqActive && seq ? (
            <div className="seq-block-callout">
              <div className="seq-block-title-row">
                <strong className="active-block-name">
                  #{seq.activeBlockIndex + 1} · {seq.currentBlockLabel || seq.currentSection.toUpperCase()}
                </strong>

                {/* Stepper for block duration like tempo settings */}
                <div className="seq-bars-mini-stepper" title="Länge dieses Blocks anpassen (Takte)">
                  <button
                    type="button"
                    className="icon-button mini-bar-step-btn"
                    onClick={() => {
                      const curBlock = (session.sequence || engine.getSequencerState().blocks)[seq.activeBlockIndex];
                      if (curBlock) engine.stepBlockBars(curBlock.id, -1);
                    }}
                    title="Takte verkürzen (−)"
                    aria-label="Takte verkürzen"
                  >
                    −
                  </button>
                  <span className="active-bar-badge">
                    {seq.blockBarProgress + 1}/{seq.totalBlockBars}T
                  </span>
                  <button
                    type="button"
                    className="icon-button mini-bar-step-btn"
                    onClick={() => {
                      const curBlock = (session.sequence || engine.getSequencerState().blocks)[seq.activeBlockIndex];
                      if (curBlock) engine.stepBlockBars(curBlock.id, 1);
                    }}
                    title="Takte verlängern (+)"
                    aria-label="Takte verlängern"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Mini buttons referencing arrows for up, high, down, and low */}
              <div className="seq-energy-arrow-row" role="group" aria-label="Abschnitt-Energie für aktiven Block">
                <button
                  type="button"
                  className={`seq-mini-arrow-btn high ${seq.currentSection === 'chorus' ? 'is-selected' : ''}`}
                  onClick={() => {
                    const curBlock = (session.sequence || engine.getSequencerState().blocks)[seq.activeBlockIndex];
                    if (curBlock) engine.setBlockSectionByEnergy(curBlock.id, 'high');
                  }}
                  title="High (↑) · Chorus / Peak"
                >
                  <span className="arrow-icon">↑</span>
                  <span>High</span>
                </button>
                <button
                  type="button"
                  className={`seq-mini-arrow-btn up ${seq.currentSection === 'buildup' ? 'is-selected' : ''}`}
                  onClick={() => {
                    const curBlock = (session.sequence || engine.getSequencerState().blocks)[seq.activeBlockIndex];
                    if (curBlock) engine.setBlockSectionByEnergy(curBlock.id, 'up');
                  }}
                  title="Up (↗) · Buildup / Steigerung"
                >
                  <span className="arrow-icon">↗</span>
                  <span>Up</span>
                </button>
                <button
                  type="button"
                  className={`seq-mini-arrow-btn groove ${seq.currentSection === 'groove' ? 'is-selected' : ''}`}
                  onClick={() => {
                    const curBlock = (session.sequence || engine.getSequencerState().blocks)[seq.activeBlockIndex];
                    if (curBlock) engine.setBlockSectionByEnergy(curBlock.id, 'groove');
                  }}
                  title="Flow (➔) · Voller Beat"
                >
                  <span className="arrow-icon">➔</span>
                  <span>Flow</span>
                </button>
                <button
                  type="button"
                  className={`seq-mini-arrow-btn down ${seq.currentSection === 'breakdown' ? 'is-selected' : ''}`}
                  onClick={() => {
                    const curBlock = (session.sequence || engine.getSequencerState().blocks)[seq.activeBlockIndex];
                    if (curBlock) engine.setBlockSectionByEnergy(curBlock.id, 'down');
                  }}
                  title="Down (↘) · Breakdown / Drums aus"
                >
                  <span className="arrow-icon">↘</span>
                  <span>Down</span>
                </button>
                <button
                  type="button"
                  className={`seq-mini-arrow-btn low ${seq.currentSection === 'silent' ? 'is-selected' : ''}`}
                  onClick={() => {
                    const curBlock = (session.sequence || engine.getSequencerState().blocks)[seq.activeBlockIndex];
                    if (curBlock) engine.setBlockSectionByEnergy(curBlock.id, 'low');
                  }}
                  title="Low (↓) · Stille / Minimal"
                >
                  <span className="arrow-icon">↓</span>
                  <span>Low</span>
                </button>
              </div>

              <div className="seq-next-sub-row">
                <span className="seq-next-cue">
                  ➔ {seq.nextBlockLabel || seq.nextSection?.toUpperCase() || 'Loop'} (noch {seq.barsUntilNextBlock}T)
                </span>
                <button
                  type="button"
                  className="seq-skip-btn"
                  onClick={() => engine.jumpToSequenceBlock((seq.activeBlockIndex + 1) % (seq.totalBlocks || 1))}
                  title="Sofort zum nächsten Block springen"
                >
                  <SkipForward size={11} />
                  <span>Skip</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="seq-idle-info">
              <span>Freier Jam ohne Kette</span>
              <button
                type="button"
                className="button quiet seq-activate-link"
                onClick={() => engine.toggleSequencer(true)}
                title="Arrangement-Sequencer jetzt starten"
              >
                Sequenz starten ▶
              </button>
            </div>
          )}
        </div>

        {/* Unit 4: Loudness-Safe Evolve & Creative Controls */}
        <div className="essential-cell creative-cell">
          <div className="evolve-button-group">
            <button
              type="button"
              className="master-evolve-btn"
              onClick={handleEvolve}
              title="Entwickelt Voicings, Grooves und Klangfarben weiter mit automatischer Lautstärke-Stabilisierung (keine Pegelsprünge)"
            >
              <Shuffle size={15} />
              <div className="evolve-btn-txt">
                <strong>Evolve</strong>
                <span className="loudness-tag">⚖️ Loudness-Safe</span>
              </div>
            </button>

            <button
              type="button"
              className="master-radical-btn"
              onClick={handleRadical}
              title="🎲 Radical Random: Komplette kreative Neukomposition (Skala, Grundton, Timbres, Rhythmen, Effekte) mit Loudness-Schutz"
            >
              <Dice5 size={15} />
              <div className="radical-btn-txt">
                <strong>Radical</strong>
                <span className="radical-tag">🎲 Chaos Dice</span>
              </div>
            </button>

            <div className="undo-redo-cluster">
              <button
                type="button"
                className="icon-button master-tool-btn"
                onClick={() => engine.undo()}
                title="Evolve rückgängig machen"
                aria-label="Undo"
              >
                <Undo2 size={14} />
              </button>
              <button
                type="button"
                className="icon-button master-tool-btn"
                onClick={() => engine.redo()}
                title="Evolve wiederholen"
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
              <span>Chaos</span>
            </button>
            <button
              type="button"
              className="quick-creative-btn drop-btn"
              onClick={() => engine.applyArrangement('spontaneous')}
              title="Spontaner Arrangement-Wechsel (Drop / Buildup)"
            >
              <Sparkles size={12} />
              <span>Drop</span>
            </button>
            <button
              type="button"
              className="quick-creative-btn capture-btn"
              onClick={onCapture}
              title="Letzte 8 Takte als MIDI-Take festhalten"
            >
              <Circle size={10} />
              <span>Capture</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
