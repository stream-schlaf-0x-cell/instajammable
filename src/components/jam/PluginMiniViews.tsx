import type { JamPosition, JamSession } from '../../types/jam';

/**
 * Mini preview for the Organic Chaos Attractor.
 * Shows dynamic 2D coordinates dot and orbit based on movement and space macros.
 */
export function MiniChaosPreview({ session }: { session: JamSession }) {
  const px = Math.min(90, Math.max(10, Math.round(session.macros.movement * 100)));
  const py = Math.min(90, Math.max(10, Math.round(session.macros.space * 100)));

  return (
    <div className="mini-plugin-view mini-chaos-view" title={`Organischer Drift: Bewegung ${px}% · Raum ${py}%`}>
      <div className="mini-attractor-orbit">
        <svg viewBox="0 0 40 24" className="mini-orbit-svg">
          <ellipse cx="20" cy="12" rx="14" ry="8" className="orbit-track" />
          <circle cx={6 + px * 0.28} cy={4 + py * 0.16} r="3" className="orbit-dot" />
        </svg>
      </div>
      <div className="mini-tag-group">
        <span className="mini-pill highlight">LORENZ / QUASI</span>
        <span className="mini-pill mono">Drift {px}%</span>
        <span className="mini-pill">Raum {py}%</span>
      </div>
    </div>
  );
}

/**
 * Mini preview for the 4-Band Equalizer & Low Cut.
 */
export function MiniEqPreview({ session }: { session: JamSession }) {
  const patch = session.effectsPatch || {};
  const lowCut = patch.eqHighpass ?? 20;
  const lowGain = patch.eqLow ?? 0;
  const midGain = patch.eqMid ?? 0;
  const highGain = patch.eqHigh ?? 0;

  const fmt = (v: number) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1));

  return (
    <div className="mini-plugin-view mini-eq-view" title="EQ Frequenzbänder & Low-Cut">
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
  const chordLayer = session.layers.find(l => l.role === 'chords');
  const timbre = chordLayer?.settings.timbre || 'wash';
  const space = Math.round(session.macros.space * 100);

  return (
    <div className="mini-plugin-view mini-soundscape-view" title={`Klangwelt: ${timbre.toUpperCase()} · Hall ${space}%`}>
      <span className="mini-pill highlight">🎻 {timbre === 'strings' ? 'Großes Orchester' : timbre.toUpperCase()}</span>
      <span className="mini-pill">Hall {space}%</span>
      <span className="mini-pill success">Harmonie-Bindung</span>
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
  const seq = position.sequencer;
  const isEnabled = session.sequencerEnabled ?? true;

  if (!isEnabled || !seq) {
    return (
      <div className="mini-plugin-view mini-seq-view">
        <span className="mini-pill idle">Sequencer pausiert (Freier Jam)</span>
      </div>
    );
  }

  return (
    <div className="mini-plugin-view mini-seq-view" title={`Block: ${seq.currentBlockLabel} · Takt ${seq.blockBarProgress + 1} von ${seq.totalBlockBars}`}>
      <span className="mini-pill highlight active-block">
        #{seq.activeBlockIndex + 1} {seq.currentBlockLabel || seq.currentSection.toUpperCase()}
      </span>
      <div className="mini-seq-progress-track">
        <div
          className="mini-seq-progress-fill"
          style={{ width: `${Math.round(((seq.blockBarProgress + 1) / Math.max(1, seq.totalBlockBars)) * 100)}%` }}
        />
      </div>
      <span className="mini-pill mono">
        {seq.blockBarProgress + 1}/{seq.totalBlockBars}T
      </span>
      {seq.nextBlockLabel && (
        <span className="mini-pill next-cue">
          ➔ {seq.nextBlockLabel} ({seq.barsUntilNextBlock}T)
        </span>
      )}
    </div>
  );
}

/**
 * Mini preview for the Rhythm Pool & Drum Engine.
 */
export function MiniRhythmPoolPreview({ session }: { session: JamSession }) {
  const drumLayer = session.layers.find(l => l.role === 'drum');
  const algo = drumLayer?.settings.rhythmAlgorithm || 'composed';

  return (
    <div className="mini-plugin-view mini-rhythms-view" title={`Drum-Engine: ${algo} · Carbon Based Lifeforms Inspiration`}>
      <span className="mini-pill highlight">🥁 {algo.toUpperCase()}</span>
      <span className="mini-pill">Syncopation An</span>
      <span className="mini-pill mono">Ghost Notes & Fills</span>
    </div>
  );
}

/**
 * Mini preview for the Effect Chain.
 */
export function MiniFxChainPreview({ session }: { session: JamSession }) {
  const mode = session.effectChain?.mode || 'delay-into-reverb';
  const reverbMix = Math.round((session.effectsPatch?.reverbMix ?? 0.35) * 100);
  const delayMix = Math.round((session.effectsPatch?.delayMix ?? 0.25) * 100);

  return (
    <div className="mini-plugin-view mini-fx-view" title="Effektkette Live-Mix">
      <span className="mini-pill highlight">
        {mode === 'delay-into-reverb' ? 'Delay ➔ Hall' : mode === 'reverb-into-delay' ? 'Hall ➔ Delay' : 'Parallel'}
      </span>
      <span className="mini-pill">Delay {delayMix}%</span>
      <span className="mini-pill">Hall {reverbMix}%</span>
    </div>
  );
}

/**
 * Mini preview for Custom User Macros.
 */
export function MiniCustomMacroPreview({ session }: { session: JamSession }) {
  const macros = session.customMacros || [];

  return (
    <div className="mini-plugin-view mini-macros-view" title={`${macros.length} Eigene Makros konfiguriert`}>
      <span className="mini-pill highlight">{macros.length} Makros</span>
      <div className="mini-macro-dots">
        {macros.slice(0, 5).map(m => (
          <span
            key={m.id}
            className="mini-macro-pip"
            style={{ backgroundColor: m.color }}
            title={`${m.name}: ${Math.round(m.value * 100)}%`}
          />
        ))}
      </div>
      {macros.length > 0 && (
        <span className="mini-pill mono">
          {macros[0].name.slice(0, 8)}: {Math.round(macros[0].value * 100)}%
        </span>
      )}
    </div>
  );
}

/**
 * Mini preview for Atmosphere Flow.
 */
export function MiniAtmospherePreview({ session }: { session: JamSession }) {
  const atmo = session.atmosphere || {
    kind: 'off',
    level: 0.12,
  };

  const pct = Math.round(Math.min(0.2, atmo.level) * 100);
  const ducking = Math.round((session.pump ?? 0) * 100);

  return (
    <div className="mini-plugin-view mini-atmo-view" title={`Atmosphäre: ${pct}% Pegel (Max 20% geschützt)`}>
      <span className="mini-pill highlight">{atmo.kind === 'off' ? 'Aus' : atmo.kind.toUpperCase()}</span>
      <span className="mini-pill max-cap">{pct}% (Max 20%)</span>
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
  return (
    <div className="mini-plugin-view mini-score-view" title="Pianorolle & Ensemble Stimmen">
      <span className="mini-pill highlight">🎹 {position.chord || 'Akkord'}</span>
      <span className="mini-pill mono">{position.voices} Stimmen live</span>
      <span className="mini-pill">8 Spuren</span>
    </div>
  );
}
