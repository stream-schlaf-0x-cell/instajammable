import { useState, useEffect } from 'react';
import { Play, Square, Shuffle, Sparkles, Maximize2, Minimize2, X, Zap } from 'lucide-react';
import { JamEngine, SCENES } from '../../engine/jam/JamEngine';
import { useUiEdition } from '../../contexts/UiEditionContext';
import { getCustomMacroDisplayName, getSceneDisplay, getSequenceBlockLabel, stripArtistRefs } from '../../engine/jam/minimalCatalog';
import { noteName } from './PianoRoll';
import type { JamPosition, JamSession, MacroName } from '../../types/jam';

interface DistanceStageHUDProps {
  session: JamSession;
  position: JamPosition;
  onClose?: () => void;
}

const engine = JamEngine.getInstance();
const pitch = (n: number) => noteName(n).replace(/-?\d+$/, '');

export function DistanceStageHUD({ session, position, onClose }: DistanceStageHUDProps) {
  const uiEdition = useUiEdition();
  const isMinimal = uiEdition === 'minimal';
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {});
    } else {
      void document.exitFullscreen().catch(() => {});
    }
  };

  const chordRoot = position.chordRoot;
  const holdBars = Math.max(1, Math.round(position.chordHoldBars || 4));
  const rawLeft = Number.isFinite(position.chordBarsLeft) ? position.chordBarsLeft : holdBars;
  const elapsedBars = position.playing
    ? Math.max(0, Math.min(holdBars - 0.0001, holdBars - rawLeft))
    : 0;
  const currentBarInChord = position.playing ? Math.min(holdBars, Math.floor(elapsedBars) + 1) : 1;
  const holdProgress = holdBars ? elapsedBars / holdBars : 0;
  const currentBeatInBar = Math.floor(position.beat) % 4;

  const seq = position.sequencer;
  const isSeqActive = !!seq?.enabled;

  const activeScene = SCENES.find(s => s.id === session.sceneId);
  const sceneTitle = isMinimal
    ? (activeScene ? getSceneDisplay(activeScene, uiEdition).name : stripArtistRefs(session.name))
    : session.name;

  const MACRO_DEFS: { id: MacroName; label: string; color: string }[] = [
    { id: 'movement', label: isMinimal ? 'MOTION' : 'BEWEGUNG', color: '#a855f7' },
    { id: 'density', label: isMinimal ? 'DENSITY' : 'DICHTE', color: '#10b981' },
    { id: 'warmth', label: isMinimal ? 'WARMTH' : 'WÄRME', color: '#f59e0b' },
    { id: 'space', label: isMinimal ? 'SPACE' : 'RAUM', color: '#06b6d4' },
  ];

  return (
    <div className="distance-stage-hud">
      {/* Top Header Bar in Distance Mode */}
      <div className="stage-top-bar">
        <div className="stage-brand">
          <span className="stage-brand-symbol" />
          <strong>{isMinimal ? 'STAGE HUD · DISTANCE VIEW' : 'STAGE HUD · 2–3 METER FERNBLICK'}</strong>
          <span className={'stage-live-dot ' + (position.playing ? 'is-playing' : '')} />
          <span className="stage-scene-tag">{sceneTitle} ({session.bpm} BPM)</span>
        </div>

        <div className="stage-top-actions">
          <button
            type="button"
            className="button quiet stage-fs-btn"
            onClick={toggleFullscreen}
            title={isMinimal
              ? (isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen')
              : (isFullscreen ? 'Vollbild beenden' : 'Vollbildmodus aktivieren')}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span>{isMinimal ? (isFullscreen ? 'Exit Fullscreen' : 'Fullscreen') : (isFullscreen ? 'Vollbild aus' : 'Vollbild')}</span>
          </button>

          {onClose && (
            <button
              type="button"
              className="button stage-close-btn"
              onClick={onClose}
              title={isMinimal ? 'Back to Studio view' : 'Zurück zur Studio-Finetuning Ansicht'}
            >
              <X size={16} />
              <span>{isMinimal ? 'Studio View' : 'Studio-Ansicht'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Center Stage: Giant Chord & Harmony Anchor */}
      <div className="stage-center-grid">
        {/* Giant Chord Card */}
        <div className="stage-chord-box">
          <div className="stage-box-label">{isMinimal ? 'HARMONIC ANCHOR (NOW)' : 'HARMONISCHER ANKER (JETZT)'}</div>

          <div className="stage-chord-main-row">
            <div className="stage-root-stepper-cluster">
              <button
                type="button"
                className="stage-step-btn"
                onClick={() => engine.transposeRoot(-1)}
                title={isMinimal ? 'Transpose root down (−1 st)' : 'Grundton 1 Halbton tiefer (−1)'}
                aria-label={isMinimal ? 'Root down' : 'Grundton tiefer'}
              >
                −
              </button>
              <button
                type="button"
                className="stage-root-orb"
                onClick={() => void engine.auditionNote(session.root + 12)}
                title={isMinimal ? 'Session Key (click to audition)' : 'Tonart-Grundton anspielen'}
              >
                <small>{isMinimal ? 'KEY' : 'TONART'}</small>
                <strong>{pitch(session.root)}</strong>
              </button>
              <button
                type="button"
                className="stage-step-btn"
                onClick={() => engine.transposeRoot(1)}
                title={isMinimal ? 'Transpose root up (+1 st)' : 'Grundton 1 Halbton höher (+1)'}
                aria-label={isMinimal ? 'Root up' : 'Grundton höher'}
              >
                +
              </button>
            </div>

            <div className="stage-chord-details">
              <div className="stage-chord-title-row">
                <button
                  type="button"
                  className="stage-chord-nav-btn"
                  onClick={() => engine.cycleChord(-1)}
                  title={isMinimal ? 'Previous chord (◀)' : 'Akkordstufe zurück (◀)'}
                  aria-label={isMinimal ? 'Previous chord' : 'Vorherige Stufe'}
                >
                  ◀
                </button>
                <h1 className="stage-chord-title">
                  {position.chord || pitch(session.root)}
                </h1>
                <button
                  type="button"
                  className="stage-chord-nav-btn"
                  onClick={() => engine.cycleChord(1)}
                  title={isMinimal ? 'Next chord (▶)' : 'Akkordstufe vor (▶)'}
                  aria-label={isMinimal ? 'Next chord' : 'Nächste Stufe'}
                >
                  ▶
                </button>
              </div>

              <div className="stage-tones-row">
                {position.chordNotes.map((n, idx) => {
                  const isRootNote = ((n % 12) + 12) % 12 === ((chordRoot % 12) + 12) % 12;
                  return (
                    <div key={idx} className="stage-tone-node">
                      <button
                        type="button"
                        className="stage-tone-nudge"
                        onClick={() => engine.nudgeChordNote(idx, -1)}
                        title={isMinimal ? `${pitch(n)}: −1 semitone` : `${pitch(n)}: −1 Halbton`}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        className={'stage-tone-pill ' + (isRootNote ? 'is-root' : '')}
                        onClick={() => void engine.auditionNote(n)}
                        title={isMinimal ? `Play ${pitch(n)} (${n})` : `${pitch(n)} (${n}) anspielen`}
                      >
                        {pitch(n)}
                      </button>
                      <button
                        type="button"
                        className="stage-tone-nudge"
                        onClick={() => engine.nudgeChordNote(idx, 1)}
                        title={isMinimal ? `${pitch(n)}: +1 semitone` : `${pitch(n)}: +1 Halbton`}
                      >
                        +
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="stage-chord-sub-row">
            <div className="stage-next-chord">
              <span className="sub-label">{isMinimal ? 'NEXT:' : 'DANACH:'}</span>
              <strong className="next-chord-name">{position.nextChord || '–'}</strong>
              <span className="next-countdown">
                {position.playing
                  ? (isMinimal
                    ? `Bar ${currentBarInChord}/${holdBars} · Beat ${currentBeatInBar + 1}/4`
                    : `Takt ${currentBarInChord}/${holdBars} · Schlag ${currentBeatInBar + 1}/4`)
                  : (isMinimal ? 'Starts with jam' : 'Startet mit Jam')}
              </span>
            </div>
            <div className="stage-next-progress-track">
              <div
                className="stage-next-progress-fill"
                style={{ width: `${Math.round(Math.max(0, Math.min(1, holdProgress)) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Giant Rhythm, Beat & Sequence HUD */}
        <div className="stage-rhythm-box">
          <div className="stage-box-label">{isMinimal ? 'RHYTHM, BAR & SEQUENCE' : 'RHYTHMUS, TAKT & SEQUENZ'}</div>

          {/* 4 Giant Beat Pulsing Orbs */}
          <div className="stage-beats-row" aria-label={isMinimal ? `Beat ${currentBeatInBar + 1} of 4` : `Schlag ${currentBeatInBar + 1} von 4`}>
            {[0, 1, 2, 3].map(i => {
              const isBeatActive = position.playing && currentBeatInBar === i;
              const isDownbeat = i === 0;
              return (
                <div
                  key={i}
                  className={
                    'stage-beat-sphere ' +
                    (isBeatActive ? 'beat-flash ' : '') +
                    (isDownbeat ? 'is-downbeat ' : '')
                  }
                >
                  <span className="beat-number">{i + 1}</span>
                </div>
              );
            })}
          </div>

          {/* Bar Count & Arrangement Section */}
          <div className="stage-bar-status">
            <div className="stage-bar-counter">
              <span className="stat-sub">{isMinimal ? 'CURRENT BAR' : 'AKTUELLER TAKT'}</span>
              <span className="stat-giant">{String(position.bar + 1).padStart(3, '0')}</span>
            </div>

            <div className="stage-arr-status">
              <span className="stat-sub">ARRANGEMENT</span>
              <span className={'stage-section-badge ' + (position.arrangementSection || 'groove')}>
                {position.arrangementSection === 'chorus' ? '✨ CHORUS' :
                 position.arrangementSection === 'buildup' ? '⚡ BUILDUP' :
                 position.arrangementSection === 'breakdown' ? '🌊 BREAKDOWN' :
                 position.arrangementSection === 'silent' ? (isMinimal ? '🤫 QUIET' : '🤫 STILLE') : '🥁 GROOVE'}
              </span>
            </div>
          </div>

          {/* Real-time Sequence Display (Follow which sequence it is in!) with arrow energy buttons & bar steppers */}
          {isSeqActive && seq ? (
            <div className="stage-seq-banner">
              <div className="stage-seq-banner-top">
                <span className="stage-seq-tag">{isMinimal ? 'SEQUENCE ACTIVE' : 'SEQUENZ AKTIV'}</span>
                <div className="stage-seq-bar-stepper" title={isMinimal ? 'Adjust bars for this block' : 'Takte für diesen Block ändern'}>
                  <button
                    type="button"
                    className="stage-seq-step-btn"
                    onClick={() => {
                      const curBlock = (session.sequence || engine.getSequencerState().blocks)[seq.activeBlockIndex];
                      if (curBlock) engine.stepBlockBars(curBlock.id, -1);
                    }}
                    title={isMinimal ? 'Shorter (−)' : 'Takte verkürzen (−)'}
                  >
                    −
                  </button>
                  <span className="stage-seq-bars-badge">{seq.totalBlockBars} {isMinimal ? 'Bars' : 'Takte'}</span>
                  <button
                    type="button"
                    className="stage-seq-step-btn"
                    onClick={() => {
                      const curBlock = (session.sequence || engine.getSequencerState().blocks)[seq.activeBlockIndex];
                      if (curBlock) engine.stepBlockBars(curBlock.id, 1);
                    }}
                    title={isMinimal ? 'Longer (+)' : 'Takte verlängern (+)'}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="stage-seq-info">
                <strong>BLOCK #{seq.activeBlockIndex + 1} · {getSequenceBlockLabel(seq.currentBlockLabel || seq.currentSection.toUpperCase(), uiEdition)}</strong>
                <span className="stage-seq-progress-txt">
                  {isMinimal
                    ? `Bar ${seq.blockBarProgress + 1} of ${seq.totalBlockBars} (${seq.barsUntilNextBlock} bar${seq.barsUntilNextBlock === 1 ? '' : 's'} left)`
                    : `Takt ${seq.blockBarProgress + 1} von ${seq.totalBlockBars} (${seq.barsUntilNextBlock} Takt${seq.barsUntilNextBlock === 1 ? '' : 'e'} bis Wechsel)`}
                </span>
              </div>

              {/* Mini buttons referencing arrows for up, high, down, and low */}
              <div className="stage-energy-arrows" role="group" aria-label={isMinimal ? 'Section energy for active block' : 'Abschnitt-Energie für aktiven Block'}>
                <button
                  type="button"
                  className={`stage-arrow-btn high ${seq.currentSection === 'chorus' ? 'is-active' : ''}`}
                  onClick={() => {
                    const curBlock = (session.sequence || engine.getSequencerState().blocks)[seq.activeBlockIndex];
                    if (curBlock) engine.setBlockSectionByEnergy(curBlock.id, 'high');
                  }}
                  title="High (↑) · Chorus / Peak"
                >
                  ↑ High
                </button>
                <button
                  type="button"
                  className={`stage-arrow-btn up ${seq.currentSection === 'buildup' ? 'is-active' : ''}`}
                  onClick={() => {
                    const curBlock = (session.sequence || engine.getSequencerState().blocks)[seq.activeBlockIndex];
                    if (curBlock) engine.setBlockSectionByEnergy(curBlock.id, 'up');
                  }}
                  title={isMinimal ? 'Up (↗) · Buildup' : 'Up (↗) · Buildup / Steigerung'}
                >
                  ↗ Up
                </button>
                <button
                  type="button"
                  className={`stage-arrow-btn groove ${seq.currentSection === 'groove' ? 'is-active' : ''}`}
                  onClick={() => {
                    const curBlock = (session.sequence || engine.getSequencerState().blocks)[seq.activeBlockIndex];
                    if (curBlock) engine.setBlockSectionByEnergy(curBlock.id, 'groove');
                  }}
                  title={isMinimal ? 'Flow (➔) · Full Groove' : 'Flow (➔) · Voller Beat'}
                >
                  ➔ Flow
                </button>
                <button
                  type="button"
                  className={`stage-arrow-btn down ${seq.currentSection === 'breakdown' ? 'is-active' : ''}`}
                  onClick={() => {
                    const curBlock = (session.sequence || engine.getSequencerState().blocks)[seq.activeBlockIndex];
                    if (curBlock) engine.setBlockSectionByEnergy(curBlock.id, 'down');
                  }}
                  title="Down (↘) · Breakdown"
                >
                  ↘ Down
                </button>
                <button
                  type="button"
                  className={`stage-arrow-btn low ${seq.currentSection === 'silent' ? 'is-active' : ''}`}
                  onClick={() => {
                    const curBlock = (session.sequence || engine.getSequencerState().blocks)[seq.activeBlockIndex];
                    if (curBlock) engine.setBlockSectionByEnergy(curBlock.id, 'low');
                  }}
                  title={isMinimal ? 'Low (↓) · Quiet Space' : 'Low (↓) · Stille'}
                >
                  ↓ Low
                </button>
              </div>

              {seq.nextSection && (
                <div className="stage-seq-next-pill">
                  ➔ {getSequenceBlockLabel(seq.nextBlockLabel || seq.nextSection.toUpperCase(), uiEdition)}
                </div>
              )}
            </div>
          ) : (
            <div className="stage-seq-idle-banner">
              <span>{isMinimal ? 'Sequencer idle · Free Jam Mode' : 'Sequencer im Hintergrund · Freier Jam-Modus'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Large-Format Macro Meters Strip */}
      <div className="stage-macros-strip">
        <div className="stage-strip-title">{isMinimal ? 'MUSICAL MACROS & TONE' : 'MUSIKALISCHE MAKROS & KLANGFARBE'}</div>
        <div className="stage-macros-grid">
          {MACRO_DEFS.map(m => {
            const val = session.macros[m.id];
            const pct = Math.round(val * 100);
            return (
              <div key={m.id} className="stage-macro-card" style={{ '--card-theme': m.color } as React.CSSProperties}>
                <div className="stage-macro-header">
                  <span className="macro-name">{m.label}</span>
                  <span className="macro-val-giant">{pct}%</span>
                </div>
                <div className="stage-macro-meter-track">
                  <div className="stage-macro-meter-fill" style={{ width: `${pct}%`, background: m.color }} />
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={val}
                  aria-label={`Macro ${m.label}`}
                  onChange={e => engine.setMacro(m.id, Number(e.target.value))}
                  className="stage-macro-slider"
                />
              </div>
            );
          })}

          {/* Custom User Macros */}
          {session.customMacros && session.customMacros.map(cm => {
            const pct = Math.round(cm.value * 100);
            const cmName = getCustomMacroDisplayName(cm.name, uiEdition);
            return (
              <div key={cm.id} className="stage-macro-card stage-custom-macro" style={{ '--card-theme': cm.color } as React.CSSProperties}>
                <div className="stage-macro-header">
                  <span className="macro-name">★ {cmName.toUpperCase()}</span>
                  <span className="macro-val-giant">{pct}%</span>
                </div>
                <div className="stage-macro-meter-track">
                  <div className="stage-macro-meter-fill" style={{ width: `${pct}%`, background: cm.color }} />
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={cm.value}
                  aria-label={`${isMinimal ? 'Custom macro' : 'Eigenes Makro'} ${cmName}`}
                  onChange={e => engine.setCustomMacro(cm.id, Number(e.target.value))}
                  className="stage-macro-slider"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Giant Distance Transport Buttons */}
      <div className="stage-transport-bar">
        <button
          type="button"
          className={'stage-btn-play ' + (position.playing ? 'is-running' : '')}
          onClick={() => void (position.playing ? engine.stop() : engine.start())}
        >
          {position.playing ? <Square size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
          <span>{position.playing ? 'STOP' : (isMinimal ? 'START JAM' : 'JAM STARTEN')}</span>
        </button>

        <button
          type="button"
          className="stage-btn-action stage-btn-evolve"
          onClick={() => engine.mutate()}
          title={isMinimal ? 'Evolve motifs, voicings & timbres' : 'Motive, Voicings und Klangfarben spontan weiterentwickeln'}
        >
          <Shuffle size={20} />
          <span>{isMinimal ? 'EVOLVE' : 'EVOLVE (Variation)'}</span>
        </button>

        <button
          type="button"
          className="stage-btn-action stage-btn-chaos"
          onClick={() => engine.applyChaosImpulse()}
          title={isMinimal ? 'Trigger organic timbre pulse' : 'Organischen Timbre-Drift anstoßen'}
        >
          <Zap size={20} />
          <span>{isMinimal ? '⚡ DRIFT PULSE' : '⚡ CHAOS-IMPULS'}</span>
        </button>

        <button
          type="button"
          className="stage-btn-action stage-btn-drop"
          onClick={() => engine.applyArrangement('spontaneous')}
          title={isMinimal ? 'Spontaneous arrangement turn (Drop / Buildup)' : 'Spontaner Arrangement-Wechsel (Drop / Buildup)'}
        >
          <Sparkles size={20} />
          <span>{isMinimal ? 'SPONTANEOUS DROP' : 'SPONTANER DROP'}</span>
        </button>

        <button
          type="button"
          className="stage-btn-action stage-btn-panic"
          onClick={() => engine.panic()}
          title={isMinimal ? 'Silence all notes immediately' : 'Noten sofort stummschalten'}
        >
          <span>PANIC</span>
        </button>
      </div>
    </div>
  );
}
