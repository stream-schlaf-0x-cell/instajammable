import { useState, useEffect } from 'react';
import { Play, Square, Shuffle, Sparkles, Maximize2, Minimize2, X, Zap } from 'lucide-react';
import { JamEngine } from '../../engine/jam/JamEngine';
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

  const root = position.chordRoot;
  const holdProgress = position.chordHoldBars ? 1 - position.chordBarsLeft / position.chordHoldBars : 0;
  const currentBeatInBar = Math.floor(position.beat) % 4;

  const seq = position.sequencer;
  const isSeqActive = !!seq?.enabled;

  const MACRO_DEFS: { id: MacroName; label: string; color: string }[] = [
    { id: 'movement', label: 'BEWEGUNG', color: '#a855f7' },
    { id: 'density', label: 'DICHTE', color: '#10b981' },
    { id: 'warmth', label: 'WÄRME', color: '#f59e0b' },
    { id: 'space', label: 'RAUM', color: '#06b6d4' },
  ];

  return (
    <div className="distance-stage-hud">
      {/* Top Header Bar in Distance Mode */}
      <div className="stage-top-bar">
        <div className="stage-brand">
          <span className="stage-brand-symbol" />
          <strong>STAGE HUD · 2–3 METER FERNBLICK</strong>
          <span className={'stage-live-dot ' + (position.playing ? 'is-playing' : '')} />
          <span className="stage-scene-tag">{session.name} ({session.bpm} BPM)</span>
        </div>

        <div className="stage-top-actions">
          <button
            type="button"
            className="button quiet stage-fs-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Vollbild beenden' : 'Vollbildmodus aktivieren'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span>{isFullscreen ? 'Vollbild aus' : 'Vollbild'}</span>
          </button>

          {onClose && (
            <button
              type="button"
              className="button stage-close-btn"
              onClick={onClose}
              title="Zurück zur Studio-Finetuning Ansicht"
            >
              <X size={16} />
              <span>Studio-Ansicht</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Center Stage: Giant Chord & Harmony Anchor */}
      <div className="stage-center-grid">
        {/* Giant Chord Card */}
        <div className="stage-chord-box">
          <div className="stage-box-label">HARMONISCHER ANKER (JETZT)</div>

          <div className="stage-chord-main-row">
            <div className="stage-root-stepper-cluster">
              <button
                type="button"
                className="stage-step-btn"
                onClick={() => engine.transposeRoot(-1)}
                title="Grundton 1 Halbton tiefer (−1)"
                aria-label="Grundton tiefer"
              >
                −
              </button>
              <button
                type="button"
                className="stage-root-orb"
                onClick={() => void engine.auditionNote(session.root + 12)}
                title="Grundton anspielen"
              >
                <small>ROOT</small>
                <strong>{pitch(root)}</strong>
              </button>
              <button
                type="button"
                className="stage-step-btn"
                onClick={() => engine.transposeRoot(1)}
                title="Grundton 1 Halbton höher (+1)"
                aria-label="Grundton höher"
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
                  title="Akkordstufe zurück (◀)"
                  aria-label="Vorherige Stufe"
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
                  title="Akkordstufe vor (▶)"
                  aria-label="Nächste Stufe"
                >
                  ▶
                </button>
              </div>

              <div className="stage-tones-row">
                {position.chordNotes.map((n, idx) => {
                  const isRootNote = ((n % 12) + 12) % 12 === ((root % 12) + 12) % 12;
                  return (
                    <div key={idx} className="stage-tone-node">
                      <button
                        type="button"
                        className="stage-tone-nudge"
                        onClick={() => engine.nudgeChordNote(idx, -1)}
                        title={`${pitch(n)}: −1 Halbton`}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        className={'stage-tone-pill ' + (isRootNote ? 'is-root' : '')}
                        onClick={() => void engine.auditionNote(n)}
                        title={`${pitch(n)} (${n}) anspielen`}
                      >
                        {pitch(n)}
                      </button>
                      <button
                        type="button"
                        className="stage-tone-nudge"
                        onClick={() => engine.nudgeChordNote(idx, 1)}
                        title={`${pitch(n)}: +1 Halbton`}
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
              <span className="sub-label">DANACH:</span>
              <strong className="next-chord-name">{position.nextChord || '–'}</strong>
              <span className="next-countdown">
                {position.playing
                  ? `in ${Math.max(1, Math.ceil(position.chordBarsLeft))} Takt${Math.ceil(position.chordBarsLeft) === 1 ? '' : 'en'}`
                  : 'Startet mit Jam'}
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
          <div className="stage-box-label">RHYTHMUS, TAKT & SEQUENZ</div>

          {/* 4 Giant Beat Pulsing Orbs */}
          <div className="stage-beats-row" aria-label={`Schlag ${currentBeatInBar + 1} von 4`}>
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
              <span className="stat-sub">AKTUELLER TAKT</span>
              <span className="stat-giant">{String(position.bar + 1).padStart(3, '0')}</span>
            </div>

            <div className="stage-arr-status">
              <span className="stat-sub">ARRANGEMENT</span>
              <span className={'stage-section-badge ' + (position.arrangementSection || 'groove')}>
                {position.arrangementSection === 'chorus' ? '✨ CHORUS' :
                 position.arrangementSection === 'buildup' ? '⚡ BUILDUP' :
                 position.arrangementSection === 'breakdown' ? '🌊 BREAKDOWN' :
                 position.arrangementSection === 'silent' ? '🤫 STILLE' : '🥁 GROOVE'}
              </span>
            </div>
          </div>

          {/* Real-time Sequence Display (Follow which sequence it is in!) with arrow energy buttons & bar steppers */}
          {isSeqActive && seq ? (
            <div className="stage-seq-banner">
              <div className="stage-seq-banner-top">
                <span className="stage-seq-tag">SEQUENZ AKTIV</span>
                <div className="stage-seq-bar-stepper" title="Takte für diesen Block ändern">
                  <button
                    type="button"
                    className="stage-seq-step-btn"
                    onClick={() => {
                      const curBlock = (session.sequence || engine.getSequencerState().blocks)[seq.activeBlockIndex];
                      if (curBlock) engine.stepBlockBars(curBlock.id, -1);
                    }}
                    title="Takte verkürzen (−)"
                  >
                    −
                  </button>
                  <span className="stage-seq-bars-badge">{seq.totalBlockBars} Takte</span>
                  <button
                    type="button"
                    className="stage-seq-step-btn"
                    onClick={() => {
                      const curBlock = (session.sequence || engine.getSequencerState().blocks)[seq.activeBlockIndex];
                      if (curBlock) engine.stepBlockBars(curBlock.id, 1);
                    }}
                    title="Takte verlängern (+)"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="stage-seq-info">
                <strong>BLOCK #{seq.activeBlockIndex + 1} · {seq.currentBlockLabel || seq.currentSection.toUpperCase()}</strong>
                <span className="stage-seq-progress-txt">
                  Takt {seq.blockBarProgress + 1} von {seq.totalBlockBars} ({seq.barsUntilNextBlock} Takt{seq.barsUntilNextBlock === 1 ? '' : 'e'} bis Wechsel)
                </span>
              </div>

              {/* Mini buttons referencing arrows for up, high, down, and low */}
              <div className="stage-energy-arrows" role="group" aria-label="Abschnitt-Energie für aktiven Block">
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
                  title="Up (↗) · Buildup / Steigerung"
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
                  title="Flow (➔) · Voller Beat"
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
                  title="Low (↓) · Stille"
                >
                  ↓ Low
                </button>
              </div>

              {seq.nextSection && (
                <div className="stage-seq-next-pill">
                  ➔ {seq.nextBlockLabel || seq.nextSection.toUpperCase()}
                </div>
              )}
            </div>
          ) : (
            <div className="stage-seq-idle-banner">
              <span>Sequencer im Hintergrund · Freier Jam-Modus</span>
            </div>
          )}
        </div>
      </div>

      {/* Large-Format Macro Meters Strip */}
      <div className="stage-macros-strip">
        <div className="stage-strip-title">MUSIKALISCHE MAKROS & KLANGFARBE</div>
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
                  aria-label={`Makro ${m.label}`}
                  onChange={e => engine.setMacro(m.id, Number(e.target.value))}
                  className="stage-macro-slider"
                />
              </div>
            );
          })}

          {/* Custom User Macros */}
          {session.customMacros && session.customMacros.map(cm => {
            const pct = Math.round(cm.value * 100);
            return (
              <div key={cm.id} className="stage-macro-card stage-custom-macro" style={{ '--card-theme': cm.color } as React.CSSProperties}>
                <div className="stage-macro-header">
                  <span className="macro-name">★ {cm.name.toUpperCase()}</span>
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
                  aria-label={`Eigenes Makro ${cm.name}`}
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
          <span>{position.playing ? 'STOP' : 'JAM STARTEN'}</span>
        </button>

        <button
          type="button"
          className="stage-btn-action stage-btn-evolve"
          onClick={() => engine.mutate()}
          title="Motive, Voicings und Klangfarben spontan weiterentwickeln"
        >
          <Shuffle size={20} />
          <span>EVOLVE (Variation)</span>
        </button>

        <button
          type="button"
          className="stage-btn-action stage-btn-chaos"
          onClick={() => engine.applyChaosImpulse()}
          title="Organischen Timbre-Drift anstoßen"
        >
          <Zap size={20} />
          <span>⚡ CHAOS-IMPULS</span>
        </button>

        <button
          type="button"
          className="stage-btn-action stage-btn-drop"
          onClick={() => engine.applyArrangement('spontaneous')}
          title="Spontaner Arrangement-Wechsel (Drop / Buildup)"
        >
          <Sparkles size={20} />
          <span>SPONTANER DROP</span>
        </button>

        <button
          type="button"
          className="stage-btn-action stage-btn-panic"
          onClick={() => engine.panic()}
          title="Noten sofort stummschalten"
        >
          <span>PANIC</span>
        </button>
      </div>
    </div>
  );
}
