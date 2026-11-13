import { useState } from 'react';
import { Zap, VolumeX, Flame, Moon, Shuffle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Waves, RefreshCw, Music2, Sliders, Plus, Trash2, ArrowRight, X, Dice5 } from 'lucide-react';
import { JamEngine, SOUNDSCAPE_PRESETS, SEQUENCE_TEMPLATES } from '../../engine/jam/JamEngine';
import { RHYTHM_POOL, type RhythmPreset } from '../../engine/jam/rhythms';
import type { ArrangementSection, JamPosition, JamSession, MacroName, SequenceBlock, Timbre, ChordPattern, ChordPace, ChordTexture } from '../../types/jam';
import { useUiEdition } from '../../contexts/UiEditionContext';
import {
  getSoundscapeDisplay,
  getRhythmDisplay,
  getSequenceTemplateDisplay,
  getSequenceBlockLabel,
} from '../../engine/jam/minimalCatalog';

const engine = JamEngine.getInstance();

export function SoundscapeDeck({ session, onClose }: { session: JamSession; position?: JamPosition; onClose?: () => void }) {
  const edition = useUiEdition();
  const isMinimal = edition === 'minimal';
  const [matchAtmoWithChords, setMatchAtmoWithChords] = useState(true);
  const chordsLayer = session.layers.find(l => l.role === 'chords');
  const currentChordTimbre = chordsLayer?.settings.timbre || 'wash';
  const currentChordPattern = chordsLayer?.settings.chordPattern || (session.style === 'techno' ? 'syncopated' : session.style === 'lofi' ? 'broken' : 'pad');
  const currentChordPace = chordsLayer?.settings.chordPace || '2-bars';
  const secondaryEnabled = Boolean(chordsLayer?.settings.secondaryEnabled);
  const secondaryTimbre = chordsLayer?.settings.secondaryTimbre || 'shimmer';
  const secondaryPattern = chordsLayer?.settings.secondaryPattern || 'wave';
  const secondaryVolume = chordsLayer?.settings.secondaryVolume ?? 0.45;
  const currentSpace = session.macros.space;

  return (
    <section className="soundscape-block" aria-label={isMinimal ? 'Soundscape & Chords' : 'Klangwelt & Streichorchester'}>
      <header className="soundscape-header">
        <div>
          <span className="eyebrow">{isMinimal ? 'SOUNDSCAPE' : 'KLANGWELT & DUAL-CHORD ARCHITEKTUR'}</span>
          <h2>{isMinimal ? 'Chords A + B, Space & Tone.' : 'Akkorde A + B, Hall & Atmosphäre aufeinander abstimmen.'}</h2>
          {!isMinimal && <p className="helper">Zwei harmonisch gekoppelte Akkordspuren (A + B) mit unabhängiger Klangfarbe &amp; Gegenbewegung – inspiriert von CBL, S1gns Of L1fe, Aes Dana, Asura, Kupla &amp; No Spirit.</p>}
        </div>
        <div className="header-right-actions">
          <div className="chord-timbre-badge">
            <Music2 size={16} />
            <span>
              {isMinimal ? 'A' : 'Akkord A'}: <strong>{currentChordTimbre === 'strings' ? (isMinimal ? 'Strings' : 'Streichorchester') : currentChordTimbre}</strong>
              {secondaryEnabled && <> + B: <strong>{secondaryTimbre} ({Math.round(secondaryVolume * 100)}%)</strong></>}
            </span>
          </div>
          {onClose && (
            <button type="button" className="icon-button close-deck-btn" onClick={onClose} title={isMinimal ? 'Close' : 'Deck schließen'}>
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Quick Soundscape Profiles */}
      <div className="soundscape-presets-grid">
        {SOUNDSCAPE_PRESETS.map(preset => {
          const isActive = currentChordTimbre === preset.chordTimbre && session.atmosphere?.kind === preset.atmosphere.kind;
          const disp = getSoundscapeDisplay(preset, edition);
          return (
            <button
              key={preset.id}
              type="button"
              className={'soundscape-card ' + (isActive ? 'active' : '')}
              onClick={() => engine.applySoundscapePreset(preset.id)}
            >
              <div className="soundscape-card-top">
                <strong>{disp.name}</strong>
                <span className="soundscape-hall-pill">{isMinimal ? 'Reverb' : 'Hall'} {Math.round(preset.hallAmount * 100)}%</span>
              </div>
              <span className="soundscape-sub">{disp.subtitle}</span>
              {!isMinimal && <p className="soundscape-desc">{disp.description}</p>}
              <div className="soundscape-tags">
                {disp.tags.map(t => <span key={t} className="soundscape-tag">{t}</span>)}
              </div>
              {isActive && <span className="active-dot">{isMinimal ? 'Active' : 'Aktiv abgestimmt'}</span>}
            </button>
          );
        })}
      </div>

      {/* Direct Chord, Pattern & Hall Controls */}
      <div className="soundscape-controls-bar">
        <div className="ctrl-group">
          <label htmlFor="chord-timbre-select">{isMinimal ? 'Chord Track A (Main Sound)' : 'Akkordspur A (Fundament & Hauptklang)'}</label>
          <select
            id="chord-timbre-select"
            value={currentChordTimbre}
            onChange={e => engine.setChordTimbre(e.target.value as Timbre, matchAtmoWithChords)}
          >
            <option value="strings">{isMinimal ? '🎻 Grand String Orchestra (Symphonic Bow & Chorus)' : '🎻 Großes Streichorchester (Symphonic Bow & Chorus)'}</option>
            <option value="solina">{isMinimal ? '🎻 70s Solina Ensemble (Warm Analog BBD Detune)' : '🎻 70s Solina Ensemble (Cell Ultimae Ästhetik · BBD Detune)'}</option>
            <option value="shimmer">{isMinimal ? '✨ Shimmer Pad (Crystalline Octave Bloom)' : '✨ Shimmer Pad (Crystalline Octave Bloom & Stereo Breath)'}</option>
            <option value="celeste">{isMinimal ? '🔔 Celesta & Felt Piano (Soft Hammer & Bell)' : '🔔 Celesta & Felt Piano (Sanfter Holz- & Glockenanschlag)'}</option>
            <option value="wash">{isMinimal ? '🌊 Atmospheric Wash (Wide Modulating Pad)' : '🌊 CBL Atmospheric Wash (Breites modulierendes Pad)'}</option>
            <option value="glass">{isMinimal ? '💎 Crystalline Glass (Luminous Overtones)' : '💎 Kristallines Glas (Luminöse Obertöne)'}</option>
            <option value="keys">{isMinimal ? '☕ Warm Keys (Electric 7th Chords)' : '☕ Warme Lo-Fi Keys (Rhodes 7th Chords)'}</option>
            <option value="air">{isMinimal ? '⛪ Ethereal Choir & Air (Vocal Texture)' : '⛪ Ätherischer Chor & Dom (Luft & Vokale Textur)'}</option>
            <option value="dub">{isMinimal ? '🌌 Deep Dub Stabs (Filtered Tape Echo)' : '🌌 Deep Dub Stabs (Gefiltertes Tape-Echo)'}</option>
            <option value="organ">{isMinimal ? '🎹 Cathedral Organ (Sustained Warmth)' : '🎹 Sakralorgel (Feierlicher Nachhall)'}</option>
            <option value="warm">{isMinimal ? '🎛️ Analog Synth (Warm Brass Pad)' : '🎛️ Analoger Synth (Asura / Vangelis Brass-Pad)'}</option>
          </select>
        </div>

        <div className="ctrl-group">
          <label htmlFor="chord-pattern-select">{isMinimal ? 'Pattern Track A' : 'Muster Spur A'}</label>
          <select
            id="chord-pattern-select"
            value={currentChordPattern}
            onChange={e => engine.setChordPattern(e.target.value as ChordPattern)}
          >
            <option value="pad">{isMinimal ? '🌊 Living Pad (Sustained & gentle movement)' : '🌊 Living Pad (Flächig, rollende Anschläge & feine Antworten)'}</option>
            <option value="pulse">{isMinimal ? '⚡ Syncopated Pulse (3/16 rhythmic drive)' : '⚡ CBL / Jon Hopkins Pulse (3/16 synkopierte rhythmische Impulse)'}</option>
            <option value="broken">{isMinimal ? '🎹 Broken Arpeggio (Stepped chord notes)' : '🎹 Neo-Klassik Arpeggio (Nils Frahm zerlegte Stufenakkorde)'}</option>
            <option value="syncopated">{isMinimal ? '🌌 Deep Dub Stabs (Off-beat chord hits)' : '🌌 Deep Dub Stabs (Off-Beat Akkordschläge mit Ghost-Hits)'}</option>
            <option value="euclidean">{isMinimal ? '📐 Euclidean Rhythm (Hypnotic polyrhythm)' : '📐 Euklidische Rhythmik (Polyrhythmisch hypnotische Impulse)'}</option>
            <option value="wave">{isMinimal ? '🌊 Ocean Waves (Staggered voice entries)' : '🌊 Ozeanische Wellen (Zeitlich gestaffelte Voice-Einsätze)'}</option>
            <option value="cluster">{isMinimal ? '✨ Shimmer Cluster (Pulsing overtones)' : '✨ Schimmerndes Cluster-Gewebe (Polyzyklisch pulsierende Obertöne)'}</option>
          </select>
        </div>

        <div className="ctrl-group">
          <div className="slider-label-row">
            <label htmlFor="chord-b-timbre-select">{isMinimal ? 'Chord Track B (Counterpart Layer)' : 'Akkordspur B (Ätherischer / Droniger Konterpart)'}</label>
            <label className="checkbox-label" title={isMinimal ? 'Enable second linked chord track (Track B)' : 'Zweite harmonisch gekoppelte Akkordspur (Spur B) aktivieren'}>
              <input
                type="checkbox"
                checked={secondaryEnabled}
                onChange={e => engine.setSecondaryChord({ enabled: e.target.checked })}
              />
              <span>{isMinimal ? 'Track B On' : 'Spur B Aktiv'}</span>
            </label>
          </div>
          <select
            id="chord-b-timbre-select"
            value={secondaryTimbre}
            disabled={!secondaryEnabled}
            onChange={e => engine.setSecondaryChord({ enabled: true, timbre: e.target.value as Timbre })}
          >
            <option value="shimmer">{isMinimal ? '✨ Shimmer Pad (Octave Glow)' : '✨ Shimmer Pad (Ätherischer Oktav-Glanz)'}</option>
            <option value="air">{isMinimal ? '⛪ Ethereal Vocal Choir (Airy Pad)' : '⛪ Ätherischer Vokal-Chor (S1gns Of L1fe / Aes Dana)'}</option>
            <option value="solina">{isMinimal ? '🎻 70s Solina Ensemble (Warm Strings)' : '🎻 70s Solina String-Ensemble (Warmes Band-Ensemble)'}</option>
            <option value="wash">{isMinimal ? '🌊 Atmospheric Wash (Deep Floating Pad)' : '🌊 CBL Atmospheric Wash (Tiefes schwebendes Pad)'}</option>
            <option value="celeste">{isMinimal ? '🔔 Celesta & Felt Piano (Soft Bell Texture)' : '🔔 Celesta & Felt Piano (Kupla / No Spirit Glöckchen-Textur)'}</option>
            <option value="glass">{isMinimal ? '💎 Crystalline Glass (High Overtones)' : '💎 Kristallines Glas (Feine Obertöne im hohen Register)'}</option>
            <option value="strings">{isMinimal ? '🎻 Symphonic Strings (Wide Bow Layer)' : '🎻 Symphonische Streicher (Breiter Bogen-Teppich)'}</option>
            <option value="warm">{isMinimal ? '🎛️ Analog Synth Drone (Warm Brass Layer)' : '🎛️ Analoger Synth-Drone (Asura Monolith Brass-Schicht)'}</option>
            <option value="organ">{isMinimal ? '🎹 Cathedral Organ (Fifth & Octave Drone)' : '🎹 Kathedral-Orgel (Mächtige Quint- & Oktav-Drone)'}</option>
            <option value="keys">{isMinimal ? '☕ Electric Keys (Soft Chord Replies)' : '☕ Rhodes Keys (Sanfte Akkord-Antworten)'}</option>
            <option value="dub">{isMinimal ? '🌌 Dub Chord Echo (Syncopated Filter)' : '🌌 Dub Chord Echo (Synkopierte Filter-Antwort)'}</option>
          </select>
        </div>

        <div className="ctrl-group">
          <label htmlFor="chord-b-pattern-select">{isMinimal ? 'Pattern Track B' : 'Gegenbewegung Spur B'}</label>
          <select
            id="chord-b-pattern-select"
            value={secondaryPattern}
            disabled={!secondaryEnabled}
            onChange={e => engine.setSecondaryChord({ enabled: true, pattern: e.target.value as ChordPattern })}
          >
            <option value="wave">{isMinimal ? '🌊 Breathing Wave (Gentle swell)' : '🌊 Atmende Gegenwelle (Sanft versetztes Aufblühen)'}</option>
            <option value="pad">{isMinimal ? '🕊️ Cathedral Pad (Long overtone arc)' : '🕊️ Ätherischer Kathedral-Teppich (Langer Oberton-Bogen)'}</option>
            <option value="broken">{isMinimal ? '🎹 Delicate Arpeggio Drops (Offset notes)' : '🎹 Zarte Arpeggio-Tropfen (Versetzte Einzelnoten)'}</option>
            <option value="pulse">{isMinimal ? '⚡ Polyrhythmic Counter-Pulse (Subtle drift)' : '⚡ Polyrhythmischer Gegen-Puls (CBL / Aes Dana Drift)'}</option>
            <option value="cluster">{isMinimal ? '✨ Shimmer Cluster (Floating high voicings)' : '✨ Schimmer-Cluster (Hohe schwebende Voicings)'}</option>
          </select>
        </div>

        <div className="ctrl-group hall-slider-group">
          <div className="slider-label-row">
            <label htmlFor="chord-b-volume-slider">{isMinimal ? 'Dual-Chord Mix (Track B Level)' : 'Dual-Chord Mixer (Spur B Pegel)'}</label>
            <output>{secondaryEnabled ? `${Math.round(secondaryVolume * 100)}%` : (isMinimal ? 'Off' : 'Aus')}</output>
          </div>
          <input
            id="chord-b-volume-slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            disabled={!secondaryEnabled}
            value={secondaryVolume}
            onChange={e => engine.setSecondaryChord({ enabled: true, volume: Number(e.target.value) })}
          />
        </div>

        <div className="ctrl-group">
          <label htmlFor="chord-pace-select">{isMinimal ? 'Harmony Pace' : 'Harmoniewechsel (Pace)'}</label>
          <select
            id="chord-pace-select"
            value={currentChordPace}
            onChange={e => engine.setChordPace(e.target.value as ChordPace)}
          >
            <option value="1-bar">{isMinimal ? '⚡ Every Bar (Fast & lively)' : '⚡ Jeden Takt (Schnell & lebendig)'}</option>
            <option value="2-bars">{isMinimal ? '🌿 Every 2 Bars (Balanced pace)' : '🌿 Alle 2 Takte (Atmendes Wohlfühltempo)'}</option>
            <option value="4-bars">{isMinimal ? '🌌 Every 4 Bars (Spacious & deep)' : '🌌 Alle 4 Takte (Episch getragen)'}</option>
            <option value="dynamic">{isMinimal ? '🌊 Dynamic Flow' : '🌊 Dynamisch fließend'}</option>
          </select>
        </div>

        <div className="ctrl-group">
          <label htmlFor="chord-texture-select">{isMinimal ? 'Interval Sheen (Sub-Voice)' : 'Intervall-Glanz (Sub-Voice)'}</label>
          <select
            id="chord-texture-select"
            value={chordsLayer?.settings.chordTexture || 'off'}
            onChange={e => engine.setChordTexture(e.target.value as ChordTexture)}
          >
            <option value="off">{isMinimal ? 'Off (Pure A+B Voicing)' : 'Aus (Reines A+B Voicing)'}</option>
            <option value="shimmer">{isMinimal ? '✨ Shimmer (+12st Octave Glow)' : '✨ Shimmer Layer (+12st Oktav-Glanz)'}</option>
            <option value="octave">{isMinimal ? '⚡ Double Octave (+12st Layer)' : '⚡ Doppel-Oktave (+12st tragender Aufbau)'}</option>
            <option value="sub5th">{isMinimal ? '🪐 Open Fifth (+7st Space)' : '🪐 Harmonische Quinte (+7st offener Raum)'}</option>
          </select>
        </div>

        <div className="ctrl-group hall-slider-group">
          <div className="slider-label-row">
            <label htmlFor="chord-hall-slider">{isMinimal ? 'Hall Reverb & Space' : 'Konzertsaal-Hall & Raum'}</label>
            <output>{Math.round(currentSpace * 100)}% {isMinimal ? (currentSpace > 0.75 ? '· Cathedral (7-9s)' : currentSpace > 0.4 ? '· Concert Hall' : '· Intimate') : (currentSpace > 0.75 ? '· Große Kathedrale (7-9s RT60)' : currentSpace > 0.4 ? '· Konzertsaal' : '· Intimer Raum')}</output>
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
            title={isMinimal ? 'Evolve chord progression and voicings' : 'Akkordfolge und Voicings generativ weiterentwickeln'}
          >
            <Dice5 size={14} />
            <span>{isMinimal ? 'Re-Harmonize' : '🎲 Re-Harmonisieren'}</span>
          </button>
          <label className="checkbox-label" title={isMinimal ? 'Automatically match background atmosphere (max 10%) to selected chord sound' : 'Passe Hintergrund-Atmosphäre (Air, Tape, Rain, Vinyl, max 10%) automatisch dem gewählten Akkord-Klang an'}>
            <input
              type="checkbox"
              checked={matchAtmoWithChords}
              onChange={e => setMatchAtmoWithChords(e.target.checked)}
            />
            <span>{isMinimal ? 'Link Atmosphere (≤10%)' : 'Atmosphäre koppeln (≤10%)'}</span>
          </label>
        </div>
      </div>
    </section>
  );
}

export function SequencerDeck({ session, position, onClose }: { session: JamSession; position: JamPosition; onClose?: () => void }) {
  const edition = useUiEdition();
  const isMinimal = edition === 'minimal';
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
    <section className={`sequencer-block ${!isSequencerActive ? 'is-seq-off' : ''}`} aria-label={isMinimal ? 'Arrangement Sequencer' : 'Arrangement-Sequencer & Makro-Automation'}>
      <header className="sequencer-header">
        <div>
          <span className="eyebrow">{isMinimal ? 'ARRANGEMENT SEQUENCER' : 'ARRANGEMENT-SEQUENCER & MAKRO-AUTOMATION'}</span>
          <h2>{isMinimal ? 'Section Timeline & Macro Morphs.' : 'Der Ablauf: 4 Takte dies, 4 Takte jenes.'}</h2>
          {!isMinimal && (
            <p className="helper">
              {isSequencerActive
                ? 'Sequencer läuft aktiv. Die Abschnitte wechseln automatisch und lassen die Makros organisch morphen.'
                : 'Sequencer ist aktuell AUS. Klicke auf den Schalter oder direkt auf einen beliebigen Block/Pfeil unten, um ihn sofort zu aktivieren.'}
            </p>
          )}
        </div>

        <div className="sequencer-master-actions">
          <button
            type="button"
            role="switch"
            aria-checked={isSequencerActive}
            className={`hardware-switch-pill large ${isSequencerActive ? 'is-on' : 'is-off'}`}
            onClick={() => engine.toggleSequencer(!isSequencerActive)}
            title={isMinimal ? 'Toggle Sequencer' : 'Sequencer ein-/ausschalten'}
          >
            <span className="switch-dot" />
            <span>{isSequencerActive ? 'SEQUENCER: ON' : 'SEQUENCER: OFF'}</span>
          </button>
          {onClose && (
            <button type="button" className="icon-button close-deck-btn" onClick={onClose} title={isMinimal ? 'Close' : 'Deck schließen'}>
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Templates Bar */}
      <div className="sequencer-templates-row">
        <span className="templates-label">{isMinimal ? 'Templates:' : 'Vorlagen:'}</span>
        <div className="templates-list">
          {SEQUENCE_TEMPLATES.map(tmpl => {
            const tmplDisp = getSequenceTemplateDisplay(tmpl, edition);
            return (
            <button
              key={tmpl.id}
              type="button"
              className="button template-pill-btn"
              onClick={() => engine.applySequenceTemplate(tmpl.id)}
              title={tmplDisp.description}
            >
              <strong>{tmplDisp.name}</strong>
              <small>({tmpl.blocks.length} {isMinimal ? 'blocks' : 'Blöcke'})</small>
            </button>
            );
          })}
        </div>
      </div>

      {/* Timeline Blocks Grid */}
      <div className="sequence-timeline">
        {seqBlocks.map((block, idx) => {
          const isCurrent = isSequencerActive && idx === activeBlockIdx;
          const isMacrosExpanded = expandedMacroBlockId === block.id;
          const blockTitle = getSequenceBlockLabel(block.label, edition);

          return (
            <div
              key={block.id}
              className={'seq-block-card ' + (isCurrent ? 'is-active-step ' : '') + block.section}
            >
              {/* Active Step Indicator Pill */}
              {isCurrent && (
                <div className="live-playing-badge">
                  <span className="pulse-dot" />
                  <strong>{isMinimal ? `Playing · Bar ${barProgress + 1}/${totalBlockBars}` : `Spielt jetzt · Takt ${barProgress + 1} von ${totalBlockBars}`}</strong>
                </div>
              )}

              {/* Top Row: Index, Reorder arrows, and Delete */}
              <div className="block-card-header">
                <div className="block-title-cluster">
                  <span className="block-index">#{idx + 1}{blockTitle ? ` · ${blockTitle}` : ''}</span>
                  <div className="block-reorder-cluster">
                    <button
                      type="button"
                      className="icon-button move-block-btn"
                      onClick={() => engine.moveSequenceBlock(block.id, 'left')}
                      disabled={idx === 0}
                      title={isMinimal ? 'Move block left' : 'Block nach links verschieben'}
                      aria-label={isMinimal ? 'Move block left' : 'Block nach links verschieben'}
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-button move-block-btn"
                      onClick={() => engine.moveSequenceBlock(block.id, 'right')}
                      disabled={idx === seqBlocks.length - 1}
                      title={isMinimal ? 'Move block right' : 'Block nach rechts verschieben'}
                      aria-label={isMinimal ? 'Move block right' : 'Block nach rechts verschieben'}
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="icon-button block-del-btn"
                  onClick={() => engine.removeSequenceBlock(block.id)}
                  title={isMinimal ? 'Delete block' : 'Diesen Block löschen'}
                  disabled={seqBlocks.length <= 1}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Energy Direction: Mini Buttons Referencing Arrows for Up, High, Down, and Low */}
              <div className="block-energy-arrows" role="group" aria-label={isMinimal ? 'Block energy level' : 'Abschnitt-Energie für diesen Block'}>
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
                  title={isMinimal ? 'Up (↗) · Buildup' : 'Up (↗) · Buildup / Steigerung'}
                >
                  <span className="arrow-sym">↗</span>
                  <span className="arrow-txt">Up</span>
                </button>
                <button
                  type="button"
                  className={`energy-arrow-btn groove ${block.section === 'groove' ? 'is-selected' : ''}`}
                  onClick={() => engine.setBlockSectionByEnergy(block.id, 'groove')}
                  title={isMinimal ? 'Flow (➔) · Full Groove' : 'Flow (➔) · Voller Beat'}
                >
                  <span className="arrow-sym">➔</span>
                  <span className="arrow-txt">Flow</span>
                </button>
                <button
                  type="button"
                  className={`energy-arrow-btn down ${block.section === 'breakdown' ? 'is-selected' : ''}`}
                  onClick={() => engine.setBlockSectionByEnergy(block.id, 'down')}
                  title={isMinimal ? 'Down (↘) · Breakdown (Drums off)' : 'Down (↘) · Breakdown / Drums aus'}
                >
                  <span className="arrow-sym">↘</span>
                  <span className="arrow-txt">Down</span>
                </button>
                <button
                  type="button"
                  className={`energy-arrow-btn low ${block.section === 'silent' ? 'is-selected' : ''}`}
                  onClick={() => engine.setBlockSectionByEnergy(block.id, 'low')}
                  title={isMinimal ? 'Low (↓) · Quiet / Space' : 'Low (↓) · Stille / Minimal'}
                >
                  <span className="arrow-sym">↓</span>
                  <span className="arrow-txt">Low</span>
                </button>
              </div>

              {/* Duration Stepper: - and + like tempo settings */}
              <div className="block-card-duration">
                <label>{isMinimal ? 'Length: ' : 'Länge: '}</label>
                <div className="bars-stepper-cluster">
                  <button
                    type="button"
                    className="icon-button bar-step-btn"
                    onClick={() => engine.stepBlockBars(block.id, -1)}
                    title={isMinimal ? 'Shorten bars (−)' : 'Takte verkürzen (−)'}
                    aria-label={isMinimal ? 'Shorten bars' : 'Takte verkürzen'}
                  >
                    −
                  </button>
                  <span className="bar-number-badge">{block.bars} {isMinimal ? 'Bars' : 'Takte'}</span>
                  <button
                    type="button"
                    className="icon-button bar-step-btn"
                    onClick={() => engine.stepBlockBars(block.id, 1)}
                    title={isMinimal ? 'Extend bars (+)' : 'Takte verlängern (+)'}
                    aria-label={isMinimal ? 'Extend bars' : 'Takte verlängern'}
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
                  title={isMinimal ? 'Edit macro targets for this block' : 'Makro-Ziele für diesen Block bearbeiten'}
                >
                  <Sliders size={13} />
                  <span>{isMinimal ? 'Block Macros' : 'Makros für diesen Block'}</span>
                  {isMacrosExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>

                {isMacrosExpanded && (
                  <div className="block-macro-sliders">
                    <label className="macro-target-slider">
                      <span>{isMinimal ? 'Space' : 'Raum / Hall'}: {Math.round((block.macroTargets?.space ?? 0.5) * 100)}%</span>
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
                      <span>{isMinimal ? 'Warmth' : 'Wärme'}: {Math.round((block.macroTargets?.warmth ?? 0.6) * 100)}%</span>
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
                      <span>{isMinimal ? 'Density' : 'Dichte'}: {Math.round((block.macroTargets?.density ?? 0.5) * 100)}%</span>
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
                      <span>{isMinimal ? 'Movement' : 'Bewegung'}: {Math.round((block.macroTargets?.movement ?? 0.4) * 100)}%</span>
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
                title={isMinimal ? 'Jump directly to this block' : 'Sofort zu diesem Block springen'}
              >
                <ArrowRight size={12} /> {isMinimal ? 'Jump Here' : 'Jetzt anspringen'}
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
          <span>{isMinimal ? '+ Add Block' : '+ Block anhängen'}</span>
        </button>
      </div>
    </section>
  );
}

export function SpontaneousArrangementDeck({ position, onClose }: { session?: JamSession; position: JamPosition; onClose?: () => void }) {
  const isMinimal = useUiEdition() === 'minimal';
  const section = position.arrangementSection || 'groove';
  const buildupBars = position.buildupCountdown;
  const isAuto = Boolean(position.autoArrangement);

  const chooseArrangement = (action: ArrangementSection | 'spontaneous') => {
    engine.applyArrangement(action);
  };

  return (
    <section className="arrangement-block" aria-label={isMinimal ? 'Instant Arrangement Actions' : 'Spontane Arrangement-Aktionen'}>
      <header className="arrangement-header">
        <div>
          <span className="eyebrow">{isMinimal ? 'INSTANT ACTIONS' : 'SOFORT-AKTIONEN'}</span>
          <h2>{isMinimal ? 'Trigger Section Transitions.' : 'Spontane Wendungen im Moment.'}</h2>
        </div>
        <div className="arrangement-status-badge">
          <span className={'status-indicator ' + section} />
          <strong>
            {section === 'chorus' && '🌟 Chorus / Peak'}
            {section === 'breakdown' && (isMinimal ? '💥 Breakdown (Drums Off)' : '💥 Breakdown (Drums aus)')}
            {section === 'buildup' && (isMinimal ? `⚡ Buildup · Drop in ${buildupBars ?? 1} ${buildupBars === 1 ? 'Bar' : 'Bars'}` : `⚡ Buildup · Drop in ${buildupBars ?? 1} Takt${buildupBars === 1 ? '' : 'en'}`)}
            {section === 'silent' && (isMinimal ? '🤫 Silence / Space' : '🤫 Stille / Pause')}
            {section === 'groove' && (isMinimal ? '🌊 Full Groove' : '🌊 Voller Groove')}
          </strong>
          {onClose && (
            <button type="button" className="icon-button close-deck-btn" onClick={onClose} title={isMinimal ? 'Close' : 'Deck schließen'}>
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
          title={isMinimal ? 'Peak energy with full synth, open melody, and strong kick' : 'Hebt die Energie: wärmerer Synth, offene Melodie, dichtere Begleitung und voller Kick.'}
        >
          <Flame size={16} />
          <span>Chorus / Peak</span>
          <small>{isMinimal ? 'Full energy' : 'Volle Energie'}</small>
        </button>

        <button
          type="button"
          className={'arr-btn ' + (section === 'breakdown' ? 'active' : '')}
          onClick={() => chooseArrangement('breakdown')}
          title={isMinimal ? 'Drop drums while chords and drones sustain in reverb' : 'Blendet die Drums sofort aus. Chords und Drones tragen den Raum mit weitem Hall.'}
        >
          <VolumeX size={16} />
          <span>Breakdown</span>
          <small>{isMinimal ? 'Drums out' : 'Drums ausfaden'}</small>
        </button>

        <button
          type="button"
          className={'arr-btn ' + (section === 'buildup' ? 'active' : '')}
          onClick={() => chooseArrangement('buildup')}
          title={isMinimal ? 'Build tension for 4 bars then drop automatically' : 'Baut 4 Takte lang stetig Spannung auf (Snare/Hat-Rolls, ansteigendes Filter) und droppt automatisch.'}
        >
          <Zap size={16} />
          <span>Buildup &amp; Drop</span>
          <small>{isMinimal ? '4-bar tension' : '4 Takte Spannung'}</small>
        </button>

        <button
          type="button"
          className={'arr-btn ' + (section === 'groove' ? 'active' : '')}
          onClick={() => chooseArrangement('groove')}
          title={isMinimal ? 'Bring full drums and bass back in on the downbeat' : 'Lässt alle Drums und den Bass mit vollem Druck auf dem Downbeat wieder einsetzen.'}
        >
          <Waves size={16} />
          <span>{isMinimal ? 'Full Groove' : 'Voller Groove'}</span>
          <small>Drop In / Release</small>
        </button>

        <button
          type="button"
          className={'arr-btn ' + (section === 'silent' ? 'active' : '')}
          onClick={() => chooseArrangement('silent')}
          title={isMinimal ? 'Strip back to intimate quiet textures' : 'Nimmt Hektik raus: kaum Percussion, ruhige harmonische Dichte, intimer Meditations-Raum.'}
        >
          <Moon size={16} />
          <span>{isMinimal ? 'Stillness' : 'Stille'}</span>
          <small>{isMinimal ? 'Minimal space' : 'Minimaler Raum'}</small>
        </button>

        <button
          type="button"
          className="arr-btn spontaneous"
          onClick={() => chooseArrangement('spontaneous')}
          title={isMinimal ? 'Trigger a musical spontaneous section change' : 'Trifft im Jam eine unvorhersehbare, musikalisch passende Entscheidung.'}
        >
          <Shuffle size={16} />
          <span>{isMinimal ? 'Random Twist' : 'Spontane Wendung'}</span>
          <small>{isMinimal ? 'Spontaneous choice' : 'Zufallsentscheidung'}</small>
        </button>
      </div>

      <div className="arrangement-footer">
        <label className="auto-toggle">
          <input
            type="checkbox"
            checked={isAuto}
            onChange={e => engine.toggleAutoArrangement(e.target.checked, 16)}
          />
          <span>
            {isMinimal ? <><strong>Auto-Pilot:</strong> Switch section every 16 bars</> : <><strong>Zufälliger Autopilot:</strong> Wechselt alle 16 Takte ohne feste Sequenz</>}
          </span>
        </label>
      </div>
    </section>
  );
}

export function RhythmPoolDeck({ session, onClose }: { session?: JamSession; position?: JamPosition; onClose?: () => void }) {
  const edition = useUiEdition();
  const isMinimal = edition === 'minimal';
  const [fallbackRhythmId, setFallbackRhythmId] = useState<string>(RHYTHM_POOL[0].id);

  const activeRhythm = session
    ? RHYTHM_POOL.find(preset => (['kick', 'snare', 'hihat', 'perc'] as const).every(voice => {
        const spec = preset.drumLayers[voice];
        if (!spec) return true;
        const layer = session.layers.find(l => l.id === voice);
        return !!layer && layer.settings.rhythmAlgorithm === spec.rhythmAlgorithm && !!layer.muted === !!spec.muted;
      }))
    : RHYTHM_POOL.find(p => p.id === fallbackRhythmId);

  const chooseRhythm = (preset: RhythmPreset) => {
    setFallbackRhythmId(preset.id);
    engine.applyRhythmPreset(preset.id);
  };

  const randomRhythm = () => {
    const others = RHYTHM_POOL.filter(p => p.id !== activeRhythm?.id);
    const pick = others[Math.floor(Math.random() * others.length)] || RHYTHM_POOL[0];
    chooseRhythm(pick);
  };

  return (
    <section className="rhythm-pool-block" aria-label={isMinimal ? 'Rhythm Pool & Generative Grooves' : 'Rhythmus-Pool & Generative Grooves'}>
      <header className="rhythm-header">
        <div>
          <span className="eyebrow">{isMinimal ? 'RHYTHM POOL · GENERATIVE GROOVES' : 'RHYTHMUS-POOL · GENERATIVE GROOVES'}</span>
          <h2>{isMinimal ? 'Select Drum Algorithm & Feel.' : 'Von CBL-Psybient bis Steve Reich.'}</h2>
          {!isMinimal && <p className="helper">Klicke einen Rhythmus an: Die Drum-Algorithmen, Dichten und Swing-Regler verändern sich live.</p>}
        </div>
        <div className="rhythm-header-actions">
          <button type="button" className="button quiet" onClick={randomRhythm} title={isMinimal ? 'Apply random rhythm preset' : 'Zufälligen Rhythmus aus dem Pool anwenden'}>
            <RefreshCw size={14} /> {isMinimal ? 'Random Rhythm' : 'Zufälliger Rhythmus'}
          </button>
          {onClose && (
            <button type="button" className="icon-button close-deck-btn" onClick={onClose} title={isMinimal ? 'Close' : 'Deck schließen'}>
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      <div className="rhythm-grid">
        {RHYTHM_POOL.map(preset => {
          const isSelected = activeRhythm?.id === preset.id;
          const disp = getRhythmDisplay(preset, edition);
          return (
            <button
              key={preset.id}
              type="button"
              className={'rhythm-card ' + (isSelected ? 'selected' : '')}
              onClick={() => chooseRhythm(preset)}
            >
              <div className="rhythm-card-header">
                <strong>{disp.name}</strong>
                {disp.artistInspiration && <span className="inspiration-pill">{disp.artistInspiration}</span>}
              </div>
              <span className="rhythm-genre">{disp.genre}</span>
              <p className="rhythm-desc">{disp.description}</p>
              {isSelected && <span className="active-dot">{isMinimal ? 'Active' : 'Aktiv · Knobs angepasst'}</span>}
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
