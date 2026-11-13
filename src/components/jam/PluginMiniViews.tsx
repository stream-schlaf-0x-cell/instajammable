import { useUiEdition } from '../../contexts/UiEditionContext';
import { JamEngine, effectiveEffects } from '../../engine/jam/JamEngine';
import { getCustomMacroDisplayName, getSequenceBlockLabel, MINIMAL_ATMOSPHERE_LABELS } from '../../engine/jam/minimalCatalog';
import type { JamPosition, JamSession } from '../../types/jam';

/**
 * Mini preview for the Organic Chaos Attractor.
 * Shows dynamic 2D coordinates dot and orbit based on movement and space macros.
 */
export function MiniChaosPreview({ session }: { session: JamSession }) {
  const isMinimal = useUiEdition() === 'minimal';
  const px = Math.min(90, Math.max(10, Math.round(session.macros.movement * 100)));
  const py = Math.min(90, Math.max(10, Math.round(session.macros.space * 100)));

  return (
    <div className="mini-plugin-view mini-chaos-view" title={isMinimal ? `Organic Drift: Motion ${px}% · Space ${py}%` : `Organischer Drift: Bewegung ${px}% · Raum ${py}%`}>
      <div className="mini-attractor-orbit">
        <svg viewBox="0 0 40 24" className="mini-orbit-svg">
          <ellipse cx="20" cy="12" rx="14" ry="8" className="orbit-track" />
          <circle cx={6 + px * 0.28} cy={4 + py * 0.16} r="3" className="orbit-dot" />
        </svg>
      </div>
      <div className="mini-tag-group">
        <span className="mini-pill highlight">LORENZ / QUASI</span>
        <span className="mini-pill mono">Drift {px}%</span>
        <span className="mini-pill">{isMinimal ? 'Space' : 'Raum'} {py}%</span>
      </div>
    </div>
  );
}

/**
 * Mini preview for the 4-Band Equalizer & Low Cut.
 */
export function MiniEqPreview({ session }: { session: JamSession }) {
  const isMinimal = useUiEdition() === 'minimal';
  const patch = session.effectsPatch || {};
  const lowCut = patch.eqHighpass ?? 20;
  const lowGain = patch.eqLow ?? 0;
  const midGain = patch.eqMid ?? 0;
  const highGain = patch.eqHigh ?? 0;

  const fmt = (v: number) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1));

  return (
    <div className="mini-plugin-view mini-eq-view" title={isMinimal ? 'EQ Bands & Low-Cut' : 'EQ Frequenzbänder & Low-Cut'}>
      <div className="mini-eq-bars">
        <span className="mini-band-pill sub">Low {fmt(lowGain)}dB</span>
        <span className="mini-band-pill mid">Mid {fmt(midGain)}dB</span>
        <span className="mini-band-pill high">Hi {fmt(highGain)}dB</span>
      </div>
      <span className="mini-pill mono cut-pill">LC {lowCut}Hz</span>
    </div>
  );
}

/**
 * Mini preview for Soundscape & Harmonic Match.
 */
export function MiniSoundscapePreview({ session }: { session: JamSession }) {
  const isMinimal = useUiEdition() === 'minimal';
  const chordLayer = session.layers.find(l => l.role === 'chords');
  const timbre = chordLayer?.settings.timbre || 'wash';
  const space = Math.round(session.macros.space * 100);

  return (
    <div className="mini-plugin-view mini-soundscape-view" title={isMinimal ? `Soundscape: ${timbre.toUpperCase()} · Reverb ${space}%` : `Klangwelt: ${timbre.toUpperCase()} · Hall ${space}%`}>
      <span className="mini-pill highlight">🎻 {timbre === 'strings' ? (isMinimal ? 'String Ensemble' : 'Großes Orchester') : timbre.toUpperCase()}</span>
      <span className="mini-pill">{isMinimal ? 'Reverb' : 'Hall'} {space}%</span>
      <span className="mini-pill success">{isMinimal ? 'Harmonic Link' : 'Harmonie-Bindung'}</span>
    </div>
  );
}

/**
 * Mini preview for the Arrangement Sequencer.
 */
export function MiniSequencerPreview({
  session,
  position,
}: {
  session: JamSession;
  position: JamPosition;
}) {
  const uiEdition = useUiEdition();
  const isMinimal = uiEdition === 'minimal';
  const seq = position.sequencer;
  const isEnabled = session.sequencerEnabled ?? true;

  if (!isEnabled || !seq) {
    return (
      <div className="mini-plugin-view mini-seq-view">
        <span className="mini-pill idle">{isMinimal ? 'Sequencer idle (Free Jam)' : 'Sequencer pausiert (Freier Jam)'}</span>
      </div>
    );
  }

  const curLabel = getSequenceBlockLabel(seq.currentBlockLabel || seq.currentSection.toUpperCase(), uiEdition);
  const nextLabel = seq.nextBlockLabel ? getSequenceBlockLabel(seq.nextBlockLabel, uiEdition) : '';

  return (
    <div className="mini-plugin-view mini-seq-view" title={isMinimal ? `Block: ${curLabel} · Bar ${seq.blockBarProgress + 1} of ${seq.totalBlockBars}` : `Block: ${curLabel} · Takt ${seq.blockBarProgress + 1} von ${seq.totalBlockBars}`}>
      <span className="mini-pill highlight active-block">
        #{seq.activeBlockIndex + 1} {curLabel}
      </span>
      <div className="mini-seq-progress-track">
        <div
          className="mini-seq-progress-fill"
          style={{ width: `${Math.round(((seq.blockBarProgress + 1) / Math.max(1, seq.totalBlockBars)) * 100)}%` }}
        />
      </div>
      <span className="mini-pill mono">
        {seq.blockBarProgress + 1}/{seq.totalBlockBars}{isMinimal ? 'B' : 'T'}
      </span>
      {nextLabel && (
        <span className="mini-pill next-cue">
          ➔ {nextLabel} ({seq.barsUntilNextBlock}{isMinimal ? 'B' : 'T'})
        </span>
      )}
    </div>
  );
}

/**
 * Mini preview for the Rhythm Pool & Drum Engine.
 */
export function MiniRhythmPoolPreview({ session }: { session: JamSession }) {
  const isMinimal = useUiEdition() === 'minimal';
  const drumLayer = session.layers.find(l => l.role === 'drum');
  const algo = drumLayer?.settings.rhythmAlgorithm || 'composed';

  return (
    <div className="mini-plugin-view mini-rhythms-view" title={isMinimal ? `Drum Engine: ${algo}` : `Drum-Engine: ${algo} · Carbon Based Lifeforms Inspiration`}>
      <span className="mini-pill highlight">🥁 {algo.toUpperCase()}</span>
      <span className="mini-pill">{isMinimal ? 'Syncopation On' : 'Syncopation An'}</span>
      <span className="mini-pill mono">Ghost Notes & Fills</span>
    </div>
  );
}

/**
 * Mini preview for the Effect Chain.
 */
export function MiniFxChainPreview({ session }: { session: JamSession }) {
  const isMinimal = useUiEdition() === 'minimal';
  const mode = session.effectChain?.mode || 'parallel';
  const fx = effectiveEffects(session);
  const reverbMix = Math.round(fx.reverbMix * 100);
  const delayMix = Math.round(fx.delayMix * 100);
  void JamEngine;

  return (
    <div className="mini-plugin-view mini-fx-view" title={isMinimal ? 'FX Chain Live Mix' : 'Effektkette Live-Mix'}>
      <span className="mini-pill highlight">
        {mode === 'delay-into-reverb'
          ? (isMinimal ? 'Delay ➔ Reverb' : 'Delay ➔ Hall')
          : mode === 'reverb-into-delay'
            ? (isMinimal ? 'Reverb ➔ Delay' : 'Hall ➔ Delay')
            : 'Parallel'}
      </span>
      <span className="mini-pill">Delay {delayMix}%</span>
      <span className="mini-pill">{isMinimal ? 'Reverb' : 'Hall'} {reverbMix}%</span>
    </div>
  );
}

/**
 * Mini preview for Custom User Macros.
 */
export function MiniCustomMacroPreview({ session }: { session: JamSession }) {
  const uiEdition = useUiEdition();
  const isMinimal = uiEdition === 'minimal';
  const macros = session.customMacros || [];

  return (
    <div className="mini-plugin-view mini-macros-view" title={isMinimal ? `${macros.length} Custom Macros configured` : `${macros.length} Eigene Makros konfiguriert`}>
      <span className="mini-pill highlight">{macros.length} {isMinimal ? 'Macros' : 'Makros'}</span>
      <div className="mini-macro-dots">
        {macros.slice(0, 5).map(m => {
          const dispName = getCustomMacroDisplayName(m.name, uiEdition);
          return (
            <span
              key={m.id}
              className="mini-macro-pip"
              style={{ backgroundColor: m.color }}
              title={`${dispName}: ${Math.round(m.value * 100)}%`}
            />
          );
        })}
      </div>
      {macros.length > 0 && (
        <span className="mini-pill mono">
          {getCustomMacroDisplayName(macros[0].name, uiEdition).slice(0, 8)}: {Math.round(macros[0].value * 100)}%
        </span>
      )}
    </div>
  );
}

/**
 * Mini preview for Atmosphere Flow.
 */
export function MiniAtmospherePreview({ session }: { session: JamSession }) {
  const isMinimal = useUiEdition() === 'minimal';
  const atmo = session.atmosphere || {
    kind: 'off' as const,
    level: 0.10,
  };

  const pct = Math.round(Math.min(0.10, atmo.level) * 100);
  const ducking = Math.round((session.pump ?? 0) * 100);

  return (
    <div className="mini-plugin-view mini-atmo-view" title={isMinimal ? `Atmosphere: ${pct}% Level` : `Atmosphäre: ${pct}% Pegel (Max 10% geschützt)`}>
      <span className="mini-pill highlight">
        {isMinimal
          ? (atmo.kind === 'off' ? 'Off' : MINIMAL_ATMOSPHERE_LABELS[atmo.kind] || atmo.kind.toUpperCase())
          : (atmo.kind === 'off' ? 'Aus' : atmo.kind.toUpperCase())}
      </span>
      <span className="mini-pill max-cap">{pct}%</span>
      <span className="mini-pill mono">Ducking {ducking}%</span>
    </div>
  );
}

/**
 * Mini preview for the Pianoroll / Ensemble Score.
 */
export function MiniScorePreview({
  position,
}: {
  session: JamSession;
  position: JamPosition;
}) {
  const isMinimal = useUiEdition() === 'minimal';
  return (
    <div className="mini-plugin-view mini-score-view" title={isMinimal ? 'Piano Roll & Ensemble Voices' : 'Pianorolle & Ensemble Stimmen'}>
      <span className="mini-pill highlight">🎹 {position.chord || (isMinimal ? 'Chord' : 'Akkord')}</span>
      <span className="mini-pill mono">{position.voices} {isMinimal ? 'voices live' : 'Stimmen live'}</span>
      <span className="mini-pill">{isMinimal ? '8 Tracks' : '8 Spuren'}</span>
    </div>
  );
}
