import { useEffect, useRef, useState } from 'react';
import { Sparkles, Dice5, Dices, Volume2, LockKeyhole, Snowflake, SkipForward, SlidersHorizontal } from 'lucide-react';
import { JamEngine, SCENES } from '../../engine/jam/JamEngine';
import { getInstrumentPresets, detectActiveInstrumentPreset } from '../../engine/jam/instrumentPresets';
import {
  getSceneDisplay,
  MINIMAL_MACROS,
  getInstrumentPresetDisplay,
  getTimbreDisplayName,
  getDrumModelDisplayName,
} from '../../engine/jam/minimalCatalog';
import { SoundscapeDeck, SequencerDeck, RhythmPoolDeck } from '../jam/ArrangementHub';
import { EqualizerDeck } from '../jam/EqualizerDeck';
import { EffectChainDeck } from '../jam/EffectChainDeck';
import { ChaosModulatorDeck } from '../jam/ChaosModulatorDeck';
import { AtmosphereFlow } from '../jam/AtmosphereFlow';
import { CustomMacroDeck } from '../jam/CustomMacroDeck';
import { noteName } from '../jam/PianoRoll';
import type { JamLayer, JamPosition, JamSession, LayerSettings, MacroName } from '../../types/jam';
import type { MusicalScale } from '../../types';
import type { UiEdition } from '../../types/ui';

const engine = JamEngine.getInstance();
const pitch = (n: number) => noteName(n).replace(/-?\d+$/, '');

export function isMidiOnlyMode(session: JamSession): boolean {
  return session.outputMode === 'midi';
}

export function getMacroLabelInfo(
  id: MacroName,
  midiMode: boolean,
  min: boolean,
): { name: string; text: string } {
  if (midiMode) {
    if (id === 'warmth') {
      return min
        ? { name: 'Dynamics', text: 'MIDI velocity curve & accent expression' }
        : { name: 'MIDI Dynamik', text: 'Velocity-Ausdruck & Akzentstärke für Ableton' };
    }
    if (id === 'space') {
      return min
        ? { name: 'Note Gate', text: 'MIDI note sustain & gate duration in DAW' }
        : { name: 'Note Gate', text: 'Notenlänge & Gate-Sustain in Ableton' };
    }
  }
  return min ? MINIMAL_MACROS[id] : CLASSIC_MACROS[id];
}

export interface RhythmControlSpec {
  field: keyof LayerSettings;
  value: string;
  options: Array<{ value: string; label: string }>;
}

export function getLayerRhythmOptions(layer: JamLayer, min = false): RhythmControlSpec {
  const s = layer.settings;
  if (layer.role === 'bass') {
    return {
      field: 'bassStyle',
      value: s.bassStyle || 'pedal',
      options: [
        { value: 'pedal', label: 'Pedal Sub' },
        { value: 'breathingSub', label: 'Breathing Sub' },
        { value: 'dubOffbeat', label: 'Dub Offbeat' },
        { value: 'jazzWalk', label: 'Jazz Walk' },
        { value: 'syncopatedGroove', label: 'Syncopated' },
        { value: 'minimalArp', label: 'Minimal Arp' },
        { value: 'pulse8', label: '1/8 Pulse' },
        { value: 'psyRoll', label: '1/16 Roll' },
      ],
    };
  }
  if (layer.role === 'chords') {
    return {
      field: 'chordPattern',
      value: s.chordPattern || 'pad',
      options: [
        { value: 'pad', label: 'Pad Sustain' },
        { value: 'wave', label: 'Breathing Wave' },
        { value: 'broken', label: 'Broken Arp' },
        { value: 'pulse', label: 'Gate Pulse' },
        { value: 'syncopated', label: 'Syncopated' },
        { value: 'euclidean', label: min ? 'Euclidean' : 'Euklidisch' },
        { value: 'cluster', label: 'Cluster Swell' },
      ],
    };
  }
  if (layer.role === 'melody') {
    return {
      field: 'melodyStyle',
      value: s.melodyStyle || 'motif',
      options: [
        { value: 'motif', label: min ? 'Motif' : 'Motiv' },
        { value: 'ostinato', label: 'Ostinato' },
        { value: 'bellDrops', label: 'Bell Drops' },
        { value: 'neoclassical', label: 'Neoclassical' },
        { value: 'lofiHook', label: 'Lo-Fi Hook' },
        { value: 'off', label: min ? 'Off' : 'Aus' },
      ],
    };
  }
  if (layer.role === 'drone') {
    return {
      field: 'droneStyle',
      value: s.droneStyle || 'rootFifth',
      options: [
        { value: 'rootFifth', label: min ? 'Root + 5th' : 'Grundton + Quinte' },
        { value: 'rootOctave', label: min ? 'Root + Oct' : 'Grundton + Oktave' },
        { value: 'pedalTonic', label: 'Pedal Tonic' },
        { value: 'shiftingFifth', label: 'Shifting 5th' },
        { value: 'cluster', label: 'Open Cluster' },
      ],
    };
  }
  return {
    field: 'rhythmAlgorithm',
    value: s.rhythmAlgorithm || 'composed',
    options: [
      { value: 'composed', label: min ? 'Composed' : 'Komponiert' },
      { value: 'euclidean', label: min ? 'Euclidean' : 'Euklidisch' },
      { value: 'probabilistic', label: min ? 'Probabilistic' : 'Wahrscheinlichkeit' },
      { value: 'polymetric', label: min ? 'Polymetric' : 'Polymetrisch' },
      { value: 'markov', label: 'Markov' },
      { value: 'densityBurst', label: 'Density Burst' },
    ],
  };
}

export function TrackRhythmControls({
  layer,
  edition,
  compact = false,
}: {
  layer: JamLayer;
  edition: UiEdition;
  compact?: boolean;
}) {
  const min = edition === 'minimal';
  const spec = getLayerRhythmOptions(layer, min);
  return (
    <div
      className={`track-rhythm-bar ${compact ? 'is-compact' : ''}`}
      onClick={e => e.stopPropagation()}
    >
      <select
        className="track-rhythm-select"
        aria-label={`${layer.name} ${min ? 'rhythm pattern' : 'Rhythmus-Muster'}`}
        title={min ? 'Change rhythm pattern' : 'Rhythmus / Spielmuster wechseln'}
        value={spec.value}
        onChange={e => engine.setLayerSettings(layer.id, { [spec.field]: e.target.value } as Partial<LayerSettings>)}
      >
        {spec.options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <button
        type="button"
        className="mini-toggle mini-rhythm-dice-btn"
        onClick={e => { e.stopPropagation(); engine.randomizeLayerRhythm(layer.id); }}
        title={min ? 'Randomize rhythm pattern' : 'Neuen Rhythmus für diese Spur würfeln'}
        aria-label={`${layer.name} ${min ? 'randomize rhythm' : 'Rhythmus würfeln'}`}
      >
        <Dices size={12} />
      </button>
    </div>
  );
}

export function TrackMidiControls({
  layer,
  edition,
  compact = false,
}: {
  layer: JamLayer;
  edition: UiEdition;
  compact?: boolean;
}) {
  const min = edition === 'minimal';
  const isDrum = layer.role === 'drum';
  const rangeLabel = isDrum
    ? `${noteName(layer.settings.minNote)} (${layer.settings.minNote})`
    : `${noteName(layer.settings.minNote)}–${noteName(layer.settings.maxNote)}`;

  return (
    <div
      className={`track-midi-bar ${compact ? 'is-compact' : ''}`}
      onClick={e => e.stopPropagation()}
    >
      <label className="track-midi-ch-field" title={min ? 'MIDI Channel (1–16)' : 'MIDI-Kanal (1–16) für Ableton'}>
        <span>Ch</span>
        <select
          aria-label={`${layer.name} MIDI Channel`}
          value={layer.channel}
          onChange={e => engine.updateLayer(layer.id, { channel: Number(e.target.value) })}
        >
          {Array.from({ length: 16 }, (_, i) => i + 1).map(ch => (
            <option key={ch} value={ch}>{ch}</option>
          ))}
        </select>
      </label>
      <div className="track-midi-oct-group" title={isDrum ? (min ? 'Drum trigger note −/+1' : 'Drum MIDI-Note −/+1') : (min ? 'Transpose −/+1 octave' : 'Register −/+1 Oktave verschieben')}>
        <button
          type="button"
          className="mini-toggle mini-oct-btn"
          onClick={e => { e.stopPropagation(); engine.shiftLayerOctave(layer.id, -1); }}
          aria-label={`${layer.name} ${isDrum ? 'note down' : 'octave down'}`}
        >
          −
        </button>
        <span className="track-midi-range-tag">{rangeLabel}</span>
        <button
          type="button"
          className="mini-toggle mini-oct-btn"
          onClick={e => { e.stopPropagation(); engine.shiftLayerOctave(layer.id, 1); }}
          aria-label={`${layer.name} ${isDrum ? 'note up' : 'octave up'}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export const SCALES_LIST: [MusicalScale, string][] = [
  ['dorian', 'Dorian'],
  ['aeolian', 'Natural Minor'],
  ['lydian', 'Lydian'],
  ['phrygian', 'Phrygian'],
  ['majorPentatonic', 'Major Pentatonic'],
  ['minorPentatonic', 'Minor Pentatonic'],
  ['hirajoshi', 'Hirajoshi'],
];

const CLASSIC_MACROS: Record<MacroName, { name: string; text: string }> = {
  movement: { name: 'Bewegung', text: 'Wie weit Motive und Voicings wandern.' },
  density: { name: 'Dichte', text: 'Mehr Noten, ohne den Raum zu verlieren.' },
  warmth: { name: 'Wärme', text: 'Klangfarbe des internen Instruments.' },
  space: { name: 'Raum', text: 'Weite, Delay und Nachklang.' },
};

export function useSmoothBeat(position: JamPosition, lowResource = false, bpm?: number): number {
  const [beat, setBeat] = useState(() => position.beat || 0);
  const anchorRef = useRef({ beat: position.beat || 0, time: performance.now(), rateBps: (bpm && bpm > 0 ? bpm : 80) / 60 });

  useEffect(() => {
    const now = performance.now();
    const baseBeat = position.beat || 0;
    const prev = anchorRef.current;
    let nextRateBps = bpm && bpm > 0 ? bpm / 60 : prev.rateBps;
    if (!bpm && position.playing && baseBeat > prev.beat) {
      const measuredDt = (now - prev.time) / 1000;
      if (measuredDt >= 0.03 && measuredDt <= 0.35) {
        const measuredRate = (baseBeat - prev.beat) / measuredDt;
        if (measuredRate >= 0.4 && measuredRate <= 4.5) {
          nextRateBps = measuredRate;
        }
      }
    }
    anchorRef.current = { beat: baseBeat, time: now, rateBps: nextRateBps };
    setBeat(baseBeat);
    if (!position.playing) return;

    let raf = 0;
    let lastPaint = 0;
    const minFrameMs = lowResource ? 32 : 0;

    const tick = (frameNow: number) => {
      if (minFrameMs > 0 && frameNow - lastPaint < minFrameMs) {
        raf = requestAnimationFrame(tick);
        return;
      }
      lastPaint = frameNow;
      const dtSec = Math.min(0.16, Math.max(0, (frameNow - anchorRef.current.time) / 1000));
      setBeat(anchorRef.current.beat + dtSec * anchorRef.current.rateBps);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [position.beat, position.playing, lowResource, bpm]);

  return position.playing ? beat : position.beat || 0;
}

export function ChordBarStepMeter({
  position,
  edition,
}: {
  position: JamPosition;
  edition: UiEdition;
}) {
  const min = edition === 'minimal';
  const smoothBeat = useSmoothBeat(position);
  const holdBars = Math.max(1, Math.round(position.chordHoldBars || 4));
  const rawLeft = Number.isFinite(position.chordBarsLeft) ? position.chordBarsLeft : holdBars;
  const dtBars = position.playing ? Math.max(0, (smoothBeat - (position.beat || 0)) / 4) : 0;
  const smoothLeft = Math.max(0, rawLeft - dtBars);
  const elapsedBars = position.playing
    ? Math.max(0, Math.min(holdBars - 0.0001, holdBars - smoothLeft))
    : 0;
  const currentBarInChord = position.playing ? Math.min(holdBars, Math.floor(elapsedBars) + 1) : 1;
  const barFillPct = position.playing
    ? Math.round((elapsedBars - Math.floor(elapsedBars)) * 1000) / 10
    : 0;
  const stepInBar = position.playing ? ((Math.floor(smoothBeat * 4) % 16) + 16) % 16 : 0;
  const beatInBar = Math.floor(stepInBar / 4);

  return (
    <div className="harmony-meter-wrap">
      <div className="harmony-segmented-bars" aria-hidden="true">
        {Array.from({ length: holdBars }, (_, idx) => {
          const fillPct = !position.playing
            ? 0
            : idx < currentBarInChord - 1
              ? 100
              : idx === currentBarInChord - 1
                ? barFillPct
                : 0;
          const isCurrent = position.playing && idx === currentBarInChord - 1;
          return (
            <div key={idx} className={`harmony-bar-seg ${isCurrent ? 'is-current' : ''}`}>
              <div className="harmony-bar-seg-fill" style={{ width: `${fillPct}%` }} />
            </div>
          );
        })}
      </div>
      <div className="harmony-step-strip" aria-hidden="true">
        {Array.from({ length: 16 }, (_, idx) => {
          const isBeatStart = idx % 4 === 0;
          const isNow = position.playing && idx === stepInBar;
          const isPassed = position.playing && idx < stepInBar;
          return (
            <span
              key={idx}
              className={`harmony-step-dot ${isBeatStart ? 'is-beat-start' : ''} ${isNow ? 'is-step-now' : ''} ${isPassed ? 'is-step-passed' : ''}`}
            />
          );
        })}
      </div>
      <span className="harmony-submeta">
        {position.playing
          ? (min
              ? `Bar ${currentBarInChord}/${holdBars} · Beat ${beatInBar + 1}/4 · Step ${String(stepInBar + 1).padStart(2, '0')}/16`
              : `Takt ${currentBarInChord}/${holdBars} · Schlag ${beatInBar + 1}/4 · Step ${String(stepInBar + 1).padStart(2, '0')}/16`)
          : (min
              ? `${holdBars} ${holdBars === 1 ? 'bar' : 'bars'} · Ready`
              : `${holdBars} ${holdBars === 1 ? 'Takt' : 'Takte'} · Bereit`)}
      </span>
    </div>
  );
}

export function HarmonyHeroCard({
  session,
  position,
  edition,
  compact = false,
}: {
  session: JamSession;
  position: JamPosition;
  edition: UiEdition;
  compact?: boolean;
}) {
  const min = edition === 'minimal';
  const scene = SCENES.find(s => s.id === session.sceneId) || SCENES[0];
  const sceneMeta = getSceneDisplay(scene, edition);

  return (
    <section className={`plugin-card harmony-hero-card ${compact ? 'is-compact' : ''}`} aria-label={min ? 'Harmony & Tempo' : 'Harmonie & Tempo'}>
      <header className="plugin-card-head">
        <div>
          <span className="plugin-eyebrow">{sceneMeta.mood}</span>
          <h2 className="plugin-card-title">{sceneMeta.name}</h2>
        </div>
        <div className="hero-actions-inline">
          <button
            type="button"
            className="plugin-chip-btn is-accent"
            onClick={() => engine.mutate(true)}
            title={min ? 'Evolve harmony & phrasing' : 'Harmonie & Phrasierung sanft entwickeln'}
          >
            <Sparkles size={13} />
            <span>{min ? 'Evolve' : 'Variieren'}</span>
          </button>
          <button
            type="button"
            className="plugin-chip-btn"
            onClick={() => engine.updateSession({ seed: ((session.seed + 1) * 1664525 + 1013904223) >>> 0 })}
            title={min ? 'Generate new melodic seed' : 'Neuen Seed würfeln'}
          >
            <Dice5 size={13} />
            <span>{min ? 'New Seed' : 'Neuer Seed'}</span>
          </button>
        </div>
      </header>

      <div className="harmony-stage-display">
        <div className="harmony-now-block">
          <span className="harmony-tag">{min ? 'CURRENT CHORD' : 'AKTUELLER AKKORD'}</span>
          <strong className="harmony-chord-big">{position.chord || `${pitch(session.root)} ${session.scale}`}</strong>
          <ChordBarStepMeter position={position} edition={edition} />
        </div>

        <div className="harmony-next-block">
          <span className="harmony-tag">{min ? 'NEXT' : 'NÄCHSTER'}</span>
          <strong className="harmony-chord-next">{position.nextChord || '—'}</strong>
          <button
            type="button"
            className="plugin-chip-btn"
            onClick={() => engine.cycleChord(1)}
            title={min ? 'Step to next chord' : 'Zum nächsten Akkord springen'}
          >
            <SkipForward size={12} />
            <span>{min ? 'Step' : 'Weiter'}</span>
          </button>
        </div>
      </div>

      <div className="harmony-controls-row">
        <label className="plugin-inline-field">
          <span>{min ? 'Key' : 'Grundton'}</span>
          <select
            aria-label={min ? 'Root Key' : 'Grundton'}
            value={((session.root % 12) + 12) % 12}
            onChange={e => engine.setRoot(Math.floor(session.root / 12) * 12 + Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, pc) => (
              <option key={pc} value={pc}>{pitch(pc)}</option>
            ))}
          </select>
        </label>

        <label className="plugin-inline-field">
          <span>{min ? 'Scale' : 'Tonleiter'}</span>
          <select
            aria-label={min ? 'Scale' : 'Tonleiter'}
            value={session.scale}
            onChange={e => engine.updateSession({ scale: e.target.value as MusicalScale })}
          >
            {SCALES_LIST.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </label>

        <label className="plugin-inline-field">
          <span>BPM</span>
          <input
            type="number"
            min={40}
            max={180}
            value={session.bpm}
            onChange={e => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) engine.updateSession({ bpm: Math.max(40, Math.min(180, Math.round(v))) });
            }}
          />
        </label>
      </div>
    </section>
  );
}

export function MacroDeckCard({
  session,
  edition,
}: {
  session: JamSession;
  edition: UiEdition;
}) {
  const min = edition === 'minimal';
  const midiMode = isMidiOnlyMode(session);
  const macroIds: MacroName[] = ['movement', 'density', 'warmth', 'space'];

  return (
    <section className={`plugin-card macro-deck-card ${midiMode ? 'is-midi-mode' : ''}`} aria-label={min ? 'Sound Macros' : 'Klang-Makros'}>
      <header className="plugin-card-head">
        <div>
          <span className="plugin-eyebrow">{midiMode ? 'MIDI EXPRESSION' : (min ? 'EXPRESSION' : 'AUSDRUCK')}</span>
          <h3 className="plugin-card-title">{midiMode ? (min ? 'MIDI Controls' : 'MIDI-Makros (Ableton)') : (min ? 'Core Macros' : 'Kern-Makros')}</h3>
        </div>
      </header>
      <div className="macro-deck-grid">
        {macroIds.map(id => {
          const info = getMacroLabelInfo(id, midiMode, min);
          const val = session.macros[id];
          return (
            <label key={id} className="plugin-macro-tile">
              <div className="plugin-macro-top">
                <strong>{info.name}</strong>
                <output>{Math.round(val * 100)}%</output>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={val}
                aria-label={info.name}
                onChange={e => engine.setMacro(id, Number(e.target.value))}
              />
              <small>{info.text}</small>
            </label>
          );
        })}
      </div>
    </section>
  );
}

export function CompactTrackMatrix({
  session,
  edition,
  selectedLayerId,
  onSelectLayer,
}: {
  session: JamSession;
  edition: UiEdition;
  selectedLayerId?: string;
  onSelectLayer?: (layerId: string) => void;
}) {
  const min = edition === 'minimal';
  const midiMode = isMidiOnlyMode(session);
  return (
    <div className={`compact-track-matrix ${midiMode ? 'is-midi-mode' : ''}`} role="list" aria-label={min ? 'Tracks' : 'Spuren'}>
      {session.layers.map((layer: JamLayer) => {
        const selected = selectedLayerId === layer.id;
        const presets = getInstrumentPresets(layer.role, layer.drumVoice);
        const activePreset = detectActiveInstrumentPreset(layer);
        const fallbackLabel = layer.role === 'drum'
          ? getDrumModelDisplayName(layer.settings.drumModel || layer.drumVoice, edition)
          : getTimbreDisplayName(layer.settings.timbre, edition);
        return (
          <div
            key={layer.id}
            role="listitem"
            className={`compact-track-pill ${layer.muted ? 'is-muted' : ''} ${selected ? 'is-selected' : ''}`}
            style={{ '--track-color': layer.color } as React.CSSProperties}
            onClick={() => onSelectLayer?.(layer.id)}
          >
            <div className="compact-track-top">
              <span className="track-led" />
              <strong className="compact-track-name">{layer.name}</strong>
              {midiMode && <span className="track-midi-ch-badge">Ch {layer.channel}</span>}
              <div className="compact-track-btns">
                {!midiMode && (
                  <button
                    type="button"
                    className="mini-toggle mini-dice-btn"
                    onClick={e => { e.stopPropagation(); engine.randomizeInstrumentPreset(layer.id); }}
                    title={min ? 'Randomize track instrument' : 'Instrument für diese Spur würfeln'}
                    aria-label={`${layer.name} ${min ? 'random instrument' : 'Instrument würfeln'}`}
                  >
                    <Dices size={12} />
                  </button>
                )}
                <button
                  type="button"
                  className={`mini-toggle ${layer.muted ? 'is-active-mute' : ''}`}
                  onClick={e => { e.stopPropagation(); engine.updateLayer(layer.id, { muted: !layer.muted }); }}
                  title={min ? 'Mute track' : 'Spur stummschalten'}
                >
                  M
                </button>
                <button
                  type="button"
                  className={`mini-toggle ${layer.solo ? 'is-active-solo' : ''}`}
                  onClick={e => { e.stopPropagation(); engine.updateLayer(layer.id, { solo: !layer.solo }); }}
                  title={min ? 'Solo track' : 'Spur solo'}
                >
                  S
                </button>
                {layer.locked && <LockKeyhole size={11} className="track-flag-icon" />}
                {layer.frozen && <Snowflake size={11} className="track-flag-icon" />}
              </div>
            </div>
            {midiMode ? (
              <TrackMidiControls layer={layer} edition={edition} compact />
            ) : (
              <div className="compact-track-preset-row" onClick={e => e.stopPropagation()}>
                <select
                  className="compact-track-preset-select"
                  aria-label={`${layer.name} ${min ? 'instrument preset' : 'Instrumenten-Preset'}`}
                  value={activePreset?.id || ''}
                  onChange={e => {
                    if (e.target.value) engine.applyInstrumentPreset(layer.id, e.target.value);
                  }}
                >
                  {!activePreset && (
                    <option value="">{fallbackLabel}</option>
                  )}
                  {presets.map(p => (
                    <option key={p.id} value={p.id}>
                      {getInstrumentPresetDisplay(p, edition).name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <TrackRhythmControls layer={layer} edition={edition} compact />
            <div className="compact-track-vol">
              {midiMode ? <SlidersHorizontal size={12} /> : <Volume2 size={12} />}
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={layer.volume}
                aria-label={`${layer.name} ${midiMode ? 'MIDI velocity' : 'volume'}`}
                onClick={e => e.stopPropagation()}
                onChange={e => engine.updateLayer(layer.id, { volume: Number(e.target.value) })}
              />
              <span>{midiMode ? `Vel ${Math.round(35 + layer.volume * 85)}` : Math.round(layer.volume * 100)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type ToolId = 'soundscape' | 'sequencer' | 'rhythms' | 'eq' | 'fxchain' | 'chaos' | 'atmosphere' | 'custommacros';

export function ToolDrawerContent({
  tool,
  session,
  position,
  onClose,
}: {
  tool: ToolId;
  session: JamSession;
  position: JamPosition;
  onClose?: () => void;
}) {
  if (tool === 'soundscape') return <SoundscapeDeck session={session} position={position} onClose={onClose} />;
  if (tool === 'sequencer') return <SequencerDeck session={session} position={position} onClose={onClose} />;
  if (tool === 'rhythms') return <RhythmPoolDeck session={session} position={position} onClose={onClose} />;
  if (tool === 'eq') return <EqualizerDeck session={session} onClose={onClose} />;
  if (tool === 'fxchain') return <EffectChainDeck session={session} />;
  if (tool === 'chaos') {
    return (
      <ChaosModulatorDeck
        session={session}
        enabled={!!session.chaosEnabled}
        onToggleEnabled={next => engine.setChaosEnabled(next)}
      />
    );
  }
  if (tool === 'atmosphere') return <AtmosphereFlow session={session} />;
  return <CustomMacroDeck session={session} enabled={session.customMacrosEnabled !== false} />;
}
