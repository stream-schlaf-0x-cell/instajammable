import { Play, Pause, ChevronRight, FastForward, Clock } from 'lucide-react';
import { JamEngine } from '../../engine/jam/JamEngine';
import type { JamPosition, JamSession, SequenceBlock } from '../../types/jam';

interface SequenceFollowBarProps {
  session: JamSession;
  position: JamPosition;
  onOpenSequencer?: () => void;
}

const engine = JamEngine.getInstance();

export function SequenceFollowBar({ session, position, onOpenSequencer }: SequenceFollowBarProps) {
  const seq = position.sequencer;
  const isEnabled = !!seq?.enabled;
  const blocks: SequenceBlock[] = (session.sequence && session.sequence.length > 0)
    ? session.sequence
    : (engine.getSequencerState().blocks || []);

  const activeIdx = seq?.activeBlockIndex ?? 0;
  const activeBlock = blocks[activeIdx] || blocks[0];
  const barProgress = seq?.blockBarProgress ?? 0;
  const totalBars = activeBlock ? activeBlock.bars : 4;
  const nextBlock = blocks[(activeIdx + 1) % (blocks.length || 1)];
  const barsLeft = Math.max(0, totalBars - barProgress);

  const percent = Math.min(100, Math.round(((barProgress) / Math.max(1, totalBars)) * 100));

  const toggleSequencer = () => {
    engine.toggleSequencer(!isEnabled);
  };

  const jumpTo = (index: number) => {
    engine.jumpToSequenceBlock(index);
  };

  return (
    <div className={'sequence-follow-bar ' + (isEnabled ? 'is-running' : 'is-idle')}>
      <div className="seq-follow-left">
        <button
          type="button"
          className={'seq-toggle-pill ' + (isEnabled ? 'active-glow' : 'idle-pill')}
          onClick={toggleSequencer}
          title={isEnabled ? 'Sequencer pausieren / ausschalten' : 'Sequencer aktivieren'}
        >
          {isEnabled ? <Pause size={13} /> : <Play size={13} />}
          <span>{isEnabled ? 'Sequenz Läuft' : 'Sequenz Aus'}</span>
          <span className={'seq-status-led ' + (isEnabled ? 'led-on' : '')} />
        </button>

        {isEnabled && activeBlock ? (
          <div className="active-block-callout">
            <div className="callout-header-row">
              <span className="live-seq-badge">
                <span className="live-pulse-dot" />
                BLOCK {activeIdx + 1}/{blocks.length}
              </span>

              {/* Bar stepper like tempo settings */}
              <div className="seq-follow-bar-stepper" title="Länge dieses Blocks anpassen (Takte)">
                <button
                  type="button"
                  className="icon-button follow-bar-step-btn"
                  onClick={() => engine.stepBlockBars(activeBlock.id, -1)}
                  title="Takte verkürzen (−)"
                  aria-label="Takte verkürzen"
                >
                  −
                </button>
                <span className="follow-bars-count">{activeBlock.bars}T</span>
                <button
                  type="button"
                  className="icon-button follow-bar-step-btn"
                  onClick={() => engine.stepBlockBars(activeBlock.id, 1)}
                  title="Takte verlängern (+)"
                  aria-label="Takte verlängern"
                >
                  +
                </button>
              </div>
            </div>

            <div className="active-block-title-row">
              <strong className="active-block-title">
                {activeBlock.label || `${activeBlock.bars}T ${activeBlock.section.toUpperCase()}`}
              </strong>
              <span className="active-block-counter">
                <Clock size={11} /> {barProgress + 1}/{totalBars}T ({barsLeft}T übrig)
              </span>
            </div>

            {/* Mini buttons referencing arrows for up, high, down, and low */}
            <div className="follow-energy-arrows" role="group" aria-label="Abschnitt-Energie für aktiven Block">
              <button
                type="button"
                className={`follow-arrow-pill high ${activeBlock.section === 'chorus' ? 'is-active' : ''}`}
                onClick={() => engine.setBlockSectionByEnergy(activeBlock.id, 'high')}
                title="High (↑) · Chorus / Peak"
              >
                ↑ High
              </button>
              <button
                type="button"
                className={`follow-arrow-pill up ${activeBlock.section === 'buildup' ? 'is-active' : ''}`}
                onClick={() => engine.setBlockSectionByEnergy(activeBlock.id, 'up')}
                title="Up (↗) · Buildup / Steigerung"
              >
                ↗ Up
              </button>
              <button
                type="button"
                className={`follow-arrow-pill groove ${activeBlock.section === 'groove' ? 'is-active' : ''}`}
                onClick={() => engine.setBlockSectionByEnergy(activeBlock.id, 'groove')}
                title="Flow (➔) · Voller Beat"
              >
                ➔ Flow
              </button>
              <button
                type="button"
                className={`follow-arrow-pill down ${activeBlock.section === 'breakdown' ? 'is-active' : ''}`}
                onClick={() => engine.setBlockSectionByEnergy(activeBlock.id, 'down')}
                title="Down (↘) · Breakdown / Drums aus"
              >
                ↘ Down
              </button>
              <button
                type="button"
                className={`follow-arrow-pill low ${activeBlock.section === 'silent' ? 'is-active' : ''}`}
                onClick={() => engine.setBlockSectionByEnergy(activeBlock.id, 'low')}
                title="Low (↓) · Stille / Minimal"
              >
                ↓ Low
              </button>
            </div>
          </div>
        ) : (
          <div className="idle-callout">
            <span>Sequencer inaktiv · Freies Jammen</span>
          </div>
        )}
      </div>

      {/* Stepper Timeline: All Blocks in Flow */}
      <div className="seq-stepper-track" role="list" aria-label="Sequenz-Ablauf">
        {blocks.map((block, idx) => {
          const isCurrent = isEnabled && idx === activeIdx;
          const isPassed = isEnabled && idx < activeIdx;
          const arrowSym = block.section === 'chorus' ? '↑' : block.section === 'buildup' ? '↗' : block.section === 'groove' ? '➔' : block.section === 'breakdown' ? '↘' : '↓';

          return (
            <div key={block.id} className="seq-stepper-node" role="listitem">
              <button
                type="button"
                className={
                  'seq-step-pill ' +
                  (isCurrent ? 'is-active-now ' : isPassed ? 'is-passed ' : '') +
                  block.section
                }
                onClick={() => jumpTo(idx)}
                title={`Zu Block #${idx + 1} springen (${block.bars} Takte ${block.section})`}
              >
                <span className="step-energy-badge">{arrowSym}</span>
                <span className="step-num">#{idx + 1}</span>
                <span className="step-title">{block.label || `${block.bars}T ${block.section}`}</span>
                {isCurrent && <span className="step-bar-readout">{barProgress + 1}/{block.bars}T</span>}
              </button>
              {idx < blocks.length - 1 && <ChevronRight size={13} className="step-arrow" />}
            </div>
          );
        })}
      </div>

      <div className="seq-follow-right">
        {isEnabled && nextBlock && (
          <div className="next-block-preview" title={`Nächster Abschnitt nach Takt ${totalBars}`}>
            <span className="preview-label">NÄCHSTER:</span>
            <span className="preview-target">
              <FastForward size={11} /> {nextBlock.label || `${nextBlock.bars}T ${nextBlock.section}`}
            </span>
          </div>
        )}

        {onOpenSequencer && (
          <button
            type="button"
            className="button quiet seq-open-btn"
            onClick={onOpenSequencer}
            title="Arrangement-Sequencer Deck anzeigen"
          >
            Editor ➔
          </button>
        )}
      </div>

      {/* Thin glowing progress line across bottom */}
      {isEnabled && (
        <div className="seq-global-progress-track">
          <div
            className="seq-global-progress-fill"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
