import { useState } from 'react';
import { Zap, VolumeX, Flame, Moon, Shuffle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Waves, RefreshCw, Music2, Sliders, Play, Plus, Trash2, ArrowRight, X, Dice5 } from 'lucide-react';
import { JamEngine, SOUNDSCAPE_PRESETS, SEQUENCE_TEMPLATES } from '../../engine/jam/JamEngine';
import { RHYTHM_POOL, type RhythmPreset } from '../../engine/jam/rhythms';
import type { ArrangementSection, JamPosition, JamSession, MacroName, SequenceBlock, Timbre, ChordPattern, ChordPace, ChordTexture } from '../../types/jam';

const engine = JamEngine.getInstance();

export function SoundscapeDeck({ session, onClose }: { session: JamSession; position?: JamPosition; onClose?: () => void }) {
  const [matchAtmoWithChords, setMatchAtmoWithChords] = useState(true);
  const chordsLayer = session.layers.find(l => l.role === 'chords');
  const currentChordTimbre = chordsLayer?.settings.timbre || 'wash';
  const currentChordPattern = chordsLayer?.settings.chordPattern || (session.style === 'techno' ? 'syncopated' : session.style === 'lofi' ? 'broken' : 'pad');
  const currentChordPace = chordsLayer?.settings.chordPace || '2-bars';
  const currentSpace = session.macros.space;

  return (
    <section className="soundscape-block" aria-label="Klangwelt & Streichorchester">
      <header className="soundscape-header">
        <div>
          <span className="eyebrow">KLANGWELT & STREICHORCHESTER</span>
          <h2>Akkorde, Hall & Atmosphäre aufeinander abstimmen.</h2>
          <p className="helper">Großes Streichorchester, warmes Solina oder schwebender CBL-Wash – abgestimmt mit passendem Raumklang und Hintergrundtextur.</p>
        </div>
        <div className="header-right-actions">
          <div className="chord-timbre-badge">
            <Music2 size={16} />
            <span>Akkord-Klang: <strong>{currentChordTimbre === 'strings' ? 'Großes Streichorchester' : currentChordTimbre}</strong></span>
          </div>
          {onClose && (
            <button type="button" className="icon-button close-deck-btn" onClick={onClose} title="Deck schließen">
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Quick Soundscape Profiles */}
      <div className="soundscape-presets-grid">
        {SOUNDSCAPE_PRESETS.map(preset => {
          const isActive = currentChordTimbre === preset.chordTimbre && session.atmosphere?.kind === preset.atmosphere.kind;
          return (
            <button
              key={preset.id}
              type="button"
              className={'soundscape-card ' + (isActive ? 'active' : '')}
              onClick={() => engine.applySoundscapePreset(preset.id)}
            >
              <div className="soundscape-card-top">
                <strong>{preset.name}</strong>
                <span className="soundscape-hall-pill">Hall {Math.round(preset.hallAmount * 100)}%</span>
              </div>
              <span className="soundscape-sub">{preset.subtitle}</span>
              <p className="soundscape-desc">{preset.description}</p>
              <div className="soundscape-tags">
                {preset.tags.map(t => <span key={t} className="soundscape-tag">{t}</span>)}
              </div>
              {isActive && <span className="active-dot">Aktiv abgestimmt</span>}
            </button>
          );
        })}
      </div>

      {/* Direct Chord, Pattern & Hall Controls */}
      <div className="soundscape-controls-bar">
        <div className="ctrl-group">
          <label htmlFor="chord-timbre-select">Akkord-Klangfarbe</label>
          <select
            id="chord-timbre-select"
            value={currentChordTimbre}
            onChange={e => engine.setChordTimbre(e.target.value as Timbre, matchAtmoWithChords)}
          >
            <option value="strings">🎻 Großes Streichorchester (Symphonic Bow & Chorus)</option>
            <option value="solina">🎻 70s Solina Ensemble (Cell Ultimae Ästhetik · BBD Detune)</option>
            <option value="shimmer">✨ Shimmer Pad (Crystalline Octave Bloom & Stereo Breath)</option>
            <option value="celeste">🔔 Celesta & Felt Piano (Sanfter Holz- & Glockenanschlag)</option>
            <option value="wash">🌊 CBL Atmospheric Wash (Breites modulierendes Pad)</option>
            <option value="glass">💎 Kristallines Glas (Luminöse Obertöne)</option>
            <option value="keys">☕ Warme Lo-Fi Keys (Rhodes 7th Chords)</option>
            <option value="air">⛪ Ätherischer Chor & Dom (Luft & Vokale Textur)</option>
            <option value="dub">🌌 Deep Dub Stabs (Gefiltertes Tape-Echo)</option>
            <option value="organ">🎹 Sakralorgel (Feierlicher Nachhall)</option>
            <option value="warm">🎛️ Analoger Synth (Klassischer Sägezahn)</option>
          </select>
        </div>

        <div className="ctrl-group">
          <label htmlFor="chord-pattern-select">Generatives Akkord-Muster</label>
          <select
            id="chord-pattern-select"
            value={currentChordPattern}
            onChange={e => engine.setChordPattern(e.target.value as ChordPattern)}
          >
            <option value="pad">🌊 Living Pad (Flächig, rollende Anschläge & feine Antworten)</option>
            <option value="pulse">⚡ CBL / Jon Hopkins Pulse (3/16 synkopierte rhythmische Impulse)</option>
            <option value="broken">🎹 Neo-Klassik Arpeggio (Nils Frahm zerlegte Stufenakkorde)</option>
            <option value="syncopated">🌌 Deep Dub Stabs (Off-Beat Akkordschläge mit Ghost-Hits)</option>
            <option value="euclidean">📐 Euklidische Rhythmik (Polyrhythmisch hypnotische Impulse)</option>
            <option value="wave">🌊 Ozeanische Wellen (Zeitlich gestaffelte Voice-Einsätze)</option>
            <option value="cluster">✨ Schimmerndes Cluster-Gewebe (Polyzyklisch pulsierende Obertöne)</option>
          </select>
        </div>

        <div className="ctrl-group">
          <label htmlFor="chord-pace-select">Harmoniewechsel (Pace)</label>
          <select
            id="chord-pace-select"
            value={currentChordPace}
            onChange={e => engine.setChordPace(e.target.value as ChordPace)}
          >
            <option value="1-bar">⚡ Jeden Takt (Schnell & lebendig)</option>
            <option value="2-bars">🌿 Alle 2 Takte (Atmendes Wohlfühltempo)</option>
            <option value="4-bars">🌌 Alle 4 Takte (Episch getragen)</option>
            <option value="dynamic">🌊 Dynamisch fließend</option>
          </select>
        </div>

        <div className="ctrl-group">
          <label htmlFor="chord-texture-select">Begleittextur / Shimmer Layer (Zweite Stimme)</label>
          <select
            id="chord-texture-select"
            value={chordsLayer?.settings.chordTexture || 'off'}
            onChange={e => engine.setChordTexture(e.target.value as ChordTexture)}
          >
            <option value="off">Aus (Reiner Hauptakkord)</option>
            <option value="shimmer">✨ Shimmer Layer (+12st Oktav-Glanz mit zartem Stereo-Offset)</option>
            <option value="octave">⚡ Doppel-Oktave (+12st tragender Voicing-Aufbau)</option>
            <option value="sub5th">🪐 Harmonische Quinte (+7st offener Weltraum-Klang)</option>
          </select>
        </div>

        <div className="ctrl-group hall-slider-group">
          <div className="slider-label-row">
            <label htmlFor="chord-hall-slider">Konzertsaal-Hall & Raum</label>
            <output>{Math.round(currentSpace * 100)}% {currentSpace > 0.75 ? '· Große Kathedrale (7-9s RT60)' : currentSpace > 0.4 ? '· Konzertsaal' : '· Intimer Raum'}</output>
          </div>
          <input
            id="chord-hall-slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={currentSpace}
            onChange={e => engine.setChordHall(Number(e.target.value))}
          />
        </div>

        <div className="ctrl-group match-toggle-group">
          <button
            type="button"
            className="reharmonize-deck-btn"
            onClick={() => engine.evolve()}
            title="Akkordfolge und Voicings generativ weiterentwickeln"
          >
            <Dice5 size={14} />
            <span>🎲 Re-Harmonisieren</span>
          </button>
          <label className="checkbox-label" title="Passe Hintergrund-Atmosphäre (Air, Tape, Rain, Vinyl) automatisch dem gewählten Akkord-Klang an">
            <input
              type="checkbox"
              checked={matchAtmoWithChords}
              onChange={e => setMatchAtmoWithChords(e.target.checked)}
            />
            <span>Atmosphäre koppeln</span>
          </label>
        </div>
      </div>
    </section>
  );
}

export function SequencerDeck({ session, position, onClose }: { session: JamSession; position: JamPosition; onClose?: () => void }) {
  const [expandedMacroBlockId, setExpandedMacroBlockId] = useState<string | null>(null);
  const sequencerState = position.sequencer;
  const isSequencerActive = Boolean(sequencerState?.enabled);
  const activeBlockIdx = sequencerState?.activeBlockIndex ?? 0;
  const barProgress = sequencerState?.blockBarProgress ?? 0;
  const totalBlockBars = sequencerState?.totalBlockBars ?? 4;

  const seqBlocks: SequenceBlock[] = session.sequence && session.sequence.length > 0
    ? session.sequence
    : engine.getSequencerState().blocks;

  const handleUpdateBlockMacro = (blockId: string, macro: MacroName, val: number) => {
    const block = seqBlocks.find(b => b.id === blockId);
    if (!block) return;
    const currentTargets = block.macroTargets || {};
    engine.updateSequenceBlock(blockId, {
      macroTargets: {
        ...currentTargets,
        [macro]: val,
      }
    });
  };

  return (
    <section className="sequencer-block" aria-label="Arrangement-Sequencer & Makro-Automation">
      <header className="sequencer-header">
        <div>
          <span className="eyebrow">ARRANGEMENT-SEQUENCER & MAKRO-AUTOMATION</span>
          <h2>Der Ablauf: 4 Takte dies, 4 Takte jenes.</h2>
          <p className="helper">Baue deine Song-Dramaturgie. Die Abschnitte wechseln automatisch und lassen die Makros (Raum, Wärme, Dichte, Bewegung) langsam und organisch morphen.</p>
        </div>

        <div className="sequencer-master-actions">
          <button
            type="button"
            className={'button ' + (isSequencerActive ? 'primary' : '')}
            onClick={() => engine.toggleSequencer(!isSequencerActive)}
            title="Sequencer an/ausschalten"
          >
            <Play size={15} />
            <span>{isSequencerActive ? 'Sequencer Aktiv (Läuft)' : 'Sequencer Einschalten'}</span>
          </button>
          {onClose && (
            <button type="button" className="icon-button close-deck-btn" onClick={onClose} title="Deck schließen">
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Templates Bar */}
      <div className="sequencer-templates-row">
        <span className="templates-label">Vorlagen:</span>
        <div className="templates-list">
          {SEQUENCE_TEMPLATES.map(tmpl => (
            <button
              key={tmpl.id}
              type="button"
              className="button template-pill-btn"
              onClick={() => engine.applySequenceTemplate(tmpl.id)}
              title={tmpl.description}
            >
              <strong>{tmpl.name}</strong>
              <small>({tmpl.blocks.length} Blöcke)</small>
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Blocks Grid */}
      <div className="sequence-timeline">
        {seqBlocks.map((block, idx) => {
          const isCurrent = isSequencerActive && idx === activeBlockIdx;
          const isMacrosExpanded = expandedMacroBlockId === block.id;

          return (
            <div
              key={block.id}
              className={'seq-block-card ' + (isCurrent ? 'is-active-step ' : '') + block.section}
            >
              {/* Active Step Indicator Pill */}
              {isCurrent && (
                <div className="live-playing-badge">
                  <span className="pulse-dot" />
                  <strong>Spielt jetzt · Takt {barProgress + 1} von {totalBlockBars}</strong>
                </div>
              )}

              {/* Top Row: Index, Reorder arrows, and Delete */}
              <div className="block-card-header">
                <div className="block-title-cluster">
                  <span className="block-index">#{idx + 1}</span>
                  <div className="block-reorder-cluster">
                    <button
                      type="button"
                      className="icon-button move-block-btn"
                      onClick={() => engine.moveSequenceBlock(block.id, 'left')}
                      disabled={idx === 0}
                      title="Block nach links verschieben"
                      aria-label="Block nach links verschieben"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-button move-block-btn"
                      onClick={() => engine.moveSequenceBlock(block.id, 'right')}
                      disabled={idx === seqBlocks.length - 1}
                      title="Block nach rechts verschieben"
                      aria-label="Block nach rechts verschieben"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="icon-button block-del-btn"
                  onClick={() => engine.removeSequenceBlock(block.id)}
                  title="Diesen Block löschen"
                  disabled={seqBlocks.length <= 1}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Energy Direction: Mini Buttons Referencing Arrows for Up, High, Down, and Low */}
              <div className="block-energy-arrows" role="group" aria-label="Abschnitt-Energie für diesen Block">
                <button
                  type="button"
                  className={`energy-arrow-btn high ${block.section === 'chorus' ? 'is-selected' : ''}`}
                  onClick={() => engine.setBlockSectionByEnergy(block.id, 'high')}
                  title="High (↑) · Chorus / Peak"
                >
                  <span className="arrow-sym">↑</span>
                  <span className="arrow-txt">High</span>
                </button>
                <button
                  type="button"
                  className={`energy-arrow-btn up ${block.section === 'buildup' ? 'is-selected' : ''}`}
                  onClick={() => engine.setBlockSectionByEnergy(block.id, 'up')}
                  title="Up (↗) · Buildup / Steigerung"
                >
                  <span className="arrow-sym">↗</span>
                  <span className="arrow-txt">Up</span>
                </button>
                <button
                  type="button"
                  className={`energy-arrow-btn groove ${block.section === 'groove' ? 'is-selected' : ''}`}
                  onClick={() => engine.setBlockSectionByEnergy(block.id, 'groove')}
                  title="Flow (➔) · Voller Beat"
                >
                  <span className="arrow-sym">➔</span>
                  <span className="arrow-txt">Flow</span>
                </button>
                <button
                  type="button"
                  className={`energy-arrow-btn down ${block.section === 'breakdown' ? 'is-selected' : ''}`}
                  onClick={() => engine.setBlockSectionByEnergy(block.id, 'down')}
                  title="Down (↘) · Breakdown / Drums aus"
                >
                  <span className="arrow-sym">↘</span>
                  <span className="arrow-txt">Down</span>
                </button>
                <button
                  type="button"
                  className={`energy-arrow-btn low ${block.section === 'silent' ? 'is-selected' : ''}`}
                  onClick={() => engine.setBlockSectionByEnergy(block.id, 'low')}
                  title="Low (↓) · Stille / Minimal"
                >
                  <span className="arrow-sym">↓</span>
                  <span className="arrow-txt">Low</span>
                </button>
              </div>

              {/* Duration Stepper: - and + like tempo settings */}
              <div className="block-card-duration">
                <label>Länge: </label>
                <div className="bars-stepper-cluster">
                  <button
                    type="button"
                    className="icon-button bar-step-btn"
                    onClick={() => engine.stepBlockBars(block.id, -1)}
                    title="Takte verkürzen (−)"
                    aria-label="Takte verkürzen"
                  >
                    −
                  </button>
                  <span className="bar-number-badge">{block.bars} Takte</span>
                  <button
                    type="button"
                    className="icon-button bar-step-btn"
                    onClick={() => engine.stepBlockBars(block.id, 1)}
                    title="Takte verlängern (+)"
                    aria-label="Takte verlängern"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Progress bar if current */}
              {isCurrent && (
                <div className="block-progress-bar">
                  <div
                    className="block-progress-fill"
                    style={{ width: `${Math.round(((barProgress) / Math.max(1, totalBlockBars)) * 100)}%` }}
                  />
                </div>
              )}

              {/* Makro-Ziele Drawer / Toggle */}
              <div className="block-macros-drawer">
                <button
                  type="button"
                  className="toggle-block-macros-btn"
                  onClick={() => setExpandedMacroBlockId(isMacrosExpanded ? null : block.id)}
                  title="Makro-Ziele für diesen Block bearbeiten"
                >
                  <Sliders size={13} />
                  <span>Makros für diesen Block</span>
                  {isMacrosExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>

                {isMacrosExpanded && (
                  <div className="block-macro-sliders">
                    <label className="macro-target-slider">
                      <span>Raum / Hall: {Math.round((block.macroTargets?.space ?? 0.5) * 100)}%</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={block.macroTargets?.space ?? 0.5}
                        onChange={e => handleUpdateBlockMacro(block.id, 'space', Number(e.target.value))}
                      />
                    </label>

                    <label className="macro-target-slider">
                      <span>Wärme: {Math.round((block.macroTargets?.warmth ?? 0.6) * 100)}%</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={block.macroTargets?.warmth ?? 0.6}
                        onChange={e => handleUpdateBlockMacro(block.id, 'warmth', Number(e.target.value))}
                      />
                    </label>

                    <label className="macro-target-slider">
                      <span>Dichte: {Math.round((block.macroTargets?.density ?? 0.5) * 100)}%</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={block.macroTargets?.density ?? 0.5}
                        onChange={e => handleUpdateBlockMacro(block.id, 'density', Number(e.target.value))}
                      />
                    </label>

                    <label className="macro-target-slider">
                      <span>Bewegung: {Math.round((block.macroTargets?.movement ?? 0.4) * 100)}%</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={block.macroTargets?.movement ?? 0.4}
                        onChange={e => handleUpdateBlockMacro(block.id, 'movement', Number(e.target.value))}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Jump to this block button */}
              <button
                type="button"
                className="jump-block-btn"
                onClick={() => engine.jumpToSequenceBlock(idx)}
                title="Sofort zu diesem Block springen"
              >
                <ArrowRight size={12} /> Jetzt anspringen
              </button>
            </div>
          );
        })}

        {/* Add Block Card */}
        <button
          type="button"
          className="add-block-card"
          onClick={() => engine.addSequenceBlock('breakdown', 4)}
        >
          <Plus size={20} />
          <span>+ Block anhängen</span>
        </button>
      </div>
    </section>
  );
}

export function SpontaneousArrangementDeck({ position, onClose }: { session?: JamSession; position: JamPosition; onClose?: () => void }) {
  const section = position.arrangementSection || 'groove';
  const buildupBars = position.buildupCountdown;
  const isAuto = Boolean(position.autoArrangement);

  const chooseArrangement = (action: ArrangementSection | 'spontaneous') => {
    engine.applyArrangement(action);
  };

  return (
    <section className="arrangement-block" aria-label="Spontane Arrangement-Aktionen">
      <header className="arrangement-header">
        <div>
          <span className="eyebrow">SOFORT-AKTIONEN</span>
          <h2>Spontane Wendungen im Moment.</h2>
        </div>
        <div className="arrangement-status-badge">
          <span className={'status-indicator ' + section} />
          <strong>
            {section === 'chorus' && '🌟 Chorus / Peak'}
            {section === 'breakdown' && '💥 Breakdown (Drums aus)'}
            {section === 'buildup' && `⚡ Buildup · Drop in ${buildupBars ?? 1} Takt${buildupBars === 1 ? '' : 'en'}`}
            {section === 'silent' && '🤫 Stille / Pause'}
            {section === 'groove' && '🌊 Voller Groove'}
          </strong>
          {onClose && (
            <button type="button" className="icon-button close-deck-btn" onClick={onClose} title="Deck schließen">
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      <div className="arrangement-grid">
        <button
          type="button"
          className={'arr-btn ' + (section === 'chorus' ? 'active' : '')}
          onClick={() => chooseArrangement('chorus')}
          title="Hebt die Energie: wärmerer Synth, offene Melodie, dichtere Begleitung und voller Kick."
        >
          <Flame size={16} />
          <span>Chorus / Peak</span>
          <small>Volle Energie</small>
        </button>

        <button
          type="button"
          className={'arr-btn ' + (section === 'breakdown' ? 'active' : '')}
          onClick={() => chooseArrangement('breakdown')}
          title="Blendet die Drums sofort aus. Chords und Drones tragen den Raum mit weitem Hall."
        >
          <VolumeX size={16} />
          <span>Breakdown</span>
          <small>Drums ausfaden</small>
        </button>

        <button
          type="button"
          className={'arr-btn ' + (section === 'buildup' ? 'active' : '')}
          onClick={() => chooseArrangement('buildup')}
          title="Baut 4 Takte lang stetig Spannung auf (Snare/Hat-Rolls, ansteigendes Filter) und droppt automatisch."
        >
          <Zap size={16} />
          <span>Buildup & Drop</span>
          <small>4 Takte Spannung</small>
        </button>

        <button
          type="button"
          className={'arr-btn ' + (section === 'groove' ? 'active' : '')}
          onClick={() => chooseArrangement('groove')}
          title="Lässt alle Drums und den Bass mit vollem Druck auf dem Downbeat wieder einsetzen."
        >
          <Waves size={16} />
          <span>Voller Groove</span>
          <small>Drop In / Release</small>
        </button>

        <button
          type="button"
          className={'arr-btn ' + (section === 'silent' ? 'active' : '')}
          onClick={() => chooseArrangement('silent')}
          title="Nimmt Hektik raus: kaum Percussion, ruhige harmonische Dichte, intimer Meditations-Raum."
        >
          <Moon size={16} />
          <span>Stille</span>
          <small>Minimaler Raum</small>
        </button>

        <button
          type="button"
          className="arr-btn spontaneous"
          onClick={() => chooseArrangement('spontaneous')}
          title="Trifft im Jam eine unvorhersehbare, musikalisch passende Entscheidung."
        >
          <Shuffle size={16} />
          <span>Spontane Wendung</span>
          <small>Zufallsentscheidung</small>
        </button>
      </div>

      <div className="arrangement-footer">
        <label className="auto-toggle">
          <input
            type="checkbox"
            checked={isAuto}
            onChange={e => engine.toggleAutoArrangement(e.target.checked, 16)}
          />
          <span><strong>Zufälliger Autopilot:</strong> Wechselt alle 16 Takte ohne feste Sequenz</span>
        </label>
      </div>
    </section>
  );
}

export function RhythmPoolDeck({ onClose }: { session?: JamSession; position?: JamPosition; onClose?: () => void }) {
  const [selectedRhythm, setSelectedRhythm] = useState<RhythmPreset>(RHYTHM_POOL[0]);

  const chooseRhythm = (preset: RhythmPreset) => {
    setSelectedRhythm(preset);
    engine.applyRhythmPreset(preset.id);
  };

  const randomRhythm = () => {
    const others = RHYTHM_POOL.filter(p => p.id !== selectedRhythm.id);
    const pick = others[Math.floor(Math.random() * others.length)] || RHYTHM_POOL[0];
    chooseRhythm(pick);
  };

  return (
    <section className="rhythm-pool-block" aria-label="Rhythmus-Pool & Generative Grooves">
      <header className="rhythm-header">
        <div>
          <span className="eyebrow">RHYTHMUS-POOL · GENERATIVE GROOVES</span>
          <h2>Von CBL-Psybient bis Steve Reich.</h2>
          <p className="helper">Klicke einen Rhythmus an: Die Drum-Algorithmen, Dichten und Swing-Regler verändern sich live.</p>
        </div>
        <div className="rhythm-header-actions">
          <button type="button" className="button quiet" onClick={randomRhythm} title="Zufälligen Rhythmus aus dem Pool anwenden">
            <RefreshCw size={14} /> Zufälliger Rhythmus
          </button>
          {onClose && (
            <button type="button" className="icon-button close-deck-btn" onClick={onClose} title="Deck schließen">
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      <div className="rhythm-grid">
        {RHYTHM_POOL.map(preset => {
          const isSelected = selectedRhythm.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              className={'rhythm-card ' + (isSelected ? 'selected' : '')}
              onClick={() => chooseRhythm(preset)}
            >
              <div className="rhythm-card-header">
                <strong>{preset.name}</strong>
                <span className="inspiration-pill">{preset.artistInspiration}</span>
              </div>
              <span className="rhythm-genre">{preset.genre}</span>
              <p className="rhythm-desc">{preset.description}</p>
              {isSelected && <span className="active-dot">Aktiv · Knobs angepasst</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function ArrangementHub({ session, position }: { session: JamSession; position: JamPosition }) {
  return (
    <section className="arrangement-hub" aria-label="Arrangement, Streichorchester & Rhythmus">
      <SoundscapeDeck session={session} position={position} />
      <SequencerDeck session={session} position={position} />
      <SpontaneousArrangementDeck session={session} position={position} />
      <RhythmPoolDeck session={session} position={position} />
    </section>
  );
}
