import { Sparkles, Dice5, Volume2, LockKeyhole, Snowflake, SkipForward } from 'lucide-react';
import { JamEngine, SCENES } from '../../engine/jam/JamEngine';
import { getSceneDisplay, MINIMAL_MACROS } from '../../engine/jam/minimalCatalog';
import { SoundscapeDeck, SequencerDeck, RhythmPoolDeck } from '../jam/ArrangementHub';
import { EqualizerDeck } from '../jam/EqualizerDeck';
import { EffectChainDeck } from '../jam/EffectChainDeck';
import { ChaosModulatorDeck } from '../jam/ChaosModulatorDeck';
import { AtmosphereFlow } from '../jam/AtmosphereFlow';
import { CustomMacroDeck } from '../jam/CustomMacroDeck';
import { noteName } from '../jam/PianoRoll';
import type { JamLayer, JamPosition, JamSession, MacroName } from '../../types/jam';
import type { MusicalScale } from '../../types';
import type { UiEdition } from '../../types/ui';

const engine = JamEngine.getInstance();
const pitch = (n: number) => noteName(n).replace(/-?\d+$/, '');

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
  const holdBars = position.chordHoldBars || 4;
  const progress = holdBars ? Math.max(0, Math.min(1, 1 - position.chordBarsLeft / holdBars)) : 0;

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
          <div className="harmony-progress-track" aria-hidden="true">
            <div className="harmony-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span className="harmony-submeta">
            {min ? `${position.chordBarsLeft} bars left` : `noch ${position.chordBarsLeft} Takte`}
          </span>
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
            value={session.root}
            onChange={e => engine.transposeRoot(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => 43 + i).map(midi => (
              <option key={midi} value={midi}>{pitch(midi)}</option>
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
  const macroIds: MacroName[] = ['movement', 'density', 'warmth', 'space'];

  return (
    <section className="plugin-card macro-deck-card" aria-label={min ? 'Sound Macros' : 'Klang-Makros'}>
      <header className="plugin-card-head">
        <div>
          <span className="plugin-eyebrow">{min ? 'EXPRESSION' : 'AUSDRUCK'}</span>
          <h3 className="plugin-card-title">{min ? 'Core Macros' : 'Kern-Makros'}</h3>
        </div>
      </header>
      <div className="macro-deck-grid">
        {macroIds.map(id => {
          const info = min ? MINIMAL_MACROS[id] : CLASSIC_MACROS[id];
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
  return (
    <div className="compact-track-matrix" role="list" aria-label={min ? 'Tracks' : 'Spuren'}>
      {session.layers.map((layer: JamLayer) => {
        const selected = selectedLayerId === layer.id;
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
              <div className="compact-track-btns">
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
            <div className="compact-track-vol">
              <Volume2 size={12} />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={layer.volume}
                aria-label={`${layer.name} volume`}
                onClick={e => e.stopPropagation()}
                onChange={e => engine.updateLayer(layer.id, { volume: Number(e.target.value) })}
              />
              <span>{Math.round(layer.volume * 100)}</span>
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
  onClose: () => void;
}) {
  if (tool === 'soundscape') return <SoundscapeDeck session={session} position={position} onClose={onClose} />;
  if (tool === 'sequencer') return <SequencerDeck session={session} position={position} onClose={onClose} />;
  if (tool === 'rhythms') return <RhythmPoolDeck session={session} position={position} onClose={onClose} />;
  if (tool === 'eq') return <EqualizerDeck session={session} onClose={onClose} />;
  if (tool === 'fxchain') return <EffectChainDeck session={session} />;
  if (tool === 'chaos') return <ChaosModulatorDeck session={session} enabled={true} onToggleEnabled={() => {}} />;
  if (tool === 'atmosphere') return <AtmosphereFlow session={session} />;
  return <CustomMacroDeck session={session} />;
}
