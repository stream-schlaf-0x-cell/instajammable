import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Dices,
  Lock,
  Radio,
  Snowflake,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { JamEngine } from '../../engine/jam/JamEngine';
import { detectActiveInstrumentPreset, getInstrumentPresets } from '../../engine/jam/instrumentPresets';
import {
  MINIMAL_MACROS,
  getDrumModelDisplayName,
  getInstrumentPresetDisplay,
  getTimbreDisplayName,
} from '../../engine/jam/minimalCatalog';
import { noteName } from '../jam/PianoRoll';
import { ChordBarStepMeter, SCALES_LIST, useSmoothBeat } from './LayoutShared';
import type { ArrangementSection, ClipNote, JamLayer, JamPosition, JamSession, MacroName } from '../../types/jam';
import type { UiEdition } from '../../types/ui';

const engine = JamEngine.getInstance();
const PITCHES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const pitch = (n: number) => noteName(n).replace(/-?\d+$/, '');

interface OrbitLayoutProps {
  session: JamSession;
  position: JamPosition;
  edition: UiEdition;
  rollNotes: ClipNote[];
  live?: boolean;
  onAudition?: (note: number) => void;
}

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + Math.cos(angleRad) * r,
    y: cy + Math.sin(angleRad) * r,
  };
}

export function OrbitLayout({
  session,
  position,
  edition,
  rollNotes,
  live = true,
  onAudition,
}: OrbitLayoutProps) {
  const isMin = edition === 'minimal';
  const [selectedId, setSelectedId] = useState<string>(session.layers[1]?.id ?? session.layers[0]?.id ?? 'chords');

  const selectedLayer: JamLayer = useMemo(
    () => session.layers.find((l) => l.id === selectedId) ?? session.layers[0],
    [session.layers, selectedId],
  );

  const selectedPresets = useMemo(
    () => (selectedLayer ? getInstrumentPresets(selectedLayer.role, selectedLayer.drumVoice) : []),
    [selectedLayer?.id, selectedLayer?.role, selectedLayer?.drumVoice],
  );

  const activePreset = useMemo(
    () => (selectedLayer ? detectActiveInstrumentPreset(selectedLayer) : undefined),
    [selectedLayer],
  );

  const rootPc = ((session.root % 12) + 12) % 12;
  const chordRootPc = ((position.chordRoot % 12) + 12) % 12;
  const chordPcs = useMemo(
    () => Array.from(new Set((position.chordNotes || []).map((n) => ((n % 12) + 12) % 12))),
    [position.chordNotes],
  );

  // Beat phase & pulse for cosmic sweep (smooth 60fps interpolated beat)
  const beatPos = Math.max(0, useSmoothBeat(position, session.lowResource, session.bpm));
  const stepKey = Math.floor(beatPos * 4);
  const stepBeat = stepKey / 4;
  const beatFrac = beatPos % 1;
  const beatPulse = position.playing ? Math.exp(-beatFrac * 3.8) : 0.18;
  const sweepAngle = -Math.PI / 2 + ((beatPos % 16) / 16) * Math.PI * 2;
  const chordHold = Math.max(1, position.chordHoldBars || 2);
  const dtBars = position.playing ? Math.max(0, (beatPos - (position.beat || 0)) / 4) : 0;
  const smoothLeft = Math.max(0, (position.chordBarsLeft || 0) - dtBars);
  const chordProgress = Math.max(0, Math.min(1, 1 - smoothLeft / chordHold));

  // Recent/active notes quantized on 16th-note boundaries to avoid per-frame filter churn
  const loopWindowStart = Math.floor(beatPos / 16) * 16;
  const recentNotes = useMemo(
    () =>
      rollNotes
        .filter((n) => n.startBeat >= Math.max(0, stepBeat - 16) && n.startBeat <= stepBeat + 16)
        .slice(-240),
    [rollNotes, stepBeat],
  );

  const notesByLayer = useMemo(() => {
    const map = new Map<string, ClipNote[]>();
    for (const n of recentNotes) {
      let arr = map.get(n.layerId);
      if (!arr) {
        arr = [];
        map.set(n.layerId, arr);
      }
      arr.push(n);
    }
    for (const [id, arr] of map) {
      if (arr.length > 24) map.set(id, arr.slice(-24));
    }
    return map;
  }, [recentNotes]);

  const activeLayerIds = useMemo(() => {
    const active = new Set<string>();
    const stepEnd = stepBeat + 0.24;
    for (const n of recentNotes) {
      if (n.startBeat <= stepEnd && stepBeat <= n.startBeat + Math.max(0.22, n.durationBeats)) {
        active.add(n.layerId);
      }
    }
    return active;
  }, [recentNotes, stepBeat]);

  const chordPolygonPoints = useMemo(() => {
    const sorted = [...chordPcs].sort((a, b) => a - b);
    if (sorted.length < 2) return '';
    return sorted
      .map((pc) => {
        const angle = -Math.PI / 2 + (pc / 12) * Math.PI * 2;
        const p = polarToCartesian(380, 380, 342, angle);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(' ');
  }, [chordPcs]);

  const macroCards: Array<{ key: MacroName; classicName: string; corner: string }> = [
    { key: 'movement', classicName: 'Bewegung', corner: 'tl' },
    { key: 'density', classicName: 'Dichte', corner: 'tr' },
    { key: 'warmth', classicName: 'Wärme', corner: 'bl' },
    { key: 'space', classicName: 'Raum', corner: 'br' },
  ];

  const arrangementButtons: Array<{ id: ArrangementSection; en: string; de: string }> = [
    { id: 'chorus', en: 'High', de: 'Peak' },
    { id: 'buildup', en: 'Up', de: 'Aufbau' },
    { id: 'groove', en: 'Flow', de: 'Groove' },
    { id: 'breakdown', en: 'Down', de: 'Break' },
    { id: 'silent', en: 'Low', de: 'Minimal' },
  ];

  const cx = 380;
  const cy = 380;

  return (
    <section className="layout-orbit" aria-label={isMin ? 'Orbit Harmonic Orrery' : 'Orbit Harmonie-System'}>
      {/* Left/Main Cosmic Orrery Stage */}
      <div className="orbit-stage-card">
        <div className="orbit-stage-header">
          <div className="orbit-stage-title">
            <span className="eyebrow">{isMin ? '6 · ORBITAL ORRERY' : '6 · ORBITAL-SYSTEM'}</span>
            <strong>
              {isMin ? 'Harmonic Solar Map & Step Gravity' : 'Harmonisches Sonnensystem & Step-Umlauf'}
            </strong>
          </div>
          <div className="orbit-stage-pills">
            <span className="orbit-meta-badge">
              {isMin ? 'Voices' : 'Stimmen'}: <b>{position.voices}</b>
            </span>
            <span className="orbit-meta-badge">
              {PITCHES[rootPc]} {SCALES_LIST.find(([id]) => id === session.scale)?.[1] ?? session.scale}
            </span>
          </div>
        </div>

        <div className="orbit-canvas-shell">
          <svg
            viewBox="0 0 760 760"
            className="orbit-svg"
            role="img"
            aria-label={isMin ? 'Interactive harmonic solar system' : 'Interaktives harmonisches Planetensystem'}
          >
            <defs>
              <radialGradient id="orbitSunGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--amber)" stopOpacity={0.34 + beatPulse * 0.28} />
                <stop offset="55%" stopColor="var(--accent-2)" stopOpacity={0.12 + (session.macros.space ?? 0.5) * 0.12} />
                <stop offset="100%" stopColor="var(--bg)" stopOpacity="0" />
              </radialGradient>
              <filter id="orbitBlur" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="8" />
              </filter>
            </defs>

            {/* Ambient Space Nebula Glow driven by Warmth + Space macros */}
            <circle
              cx={cx}
              cy={cy}
              r={260 + (session.macros.space ?? 0.5) * 90}
              fill="url(#orbitSunGlow)"
            />

            {/* Outer Pitch Dial Guide Ring */}
            <circle cx={cx} cy={cy} r={342} fill="none" stroke="var(--line)" strokeWidth="1" strokeDasharray="3 5" opacity="0.7" />

            {/* Live Chord Geometry Polygon */}
            {chordPolygonPoints && (
              <polygon
                points={chordPolygonPoints}
                className="orbit-chord-polygon"
                fill="var(--amber)"
                fillOpacity={0.07 + beatPulse * 0.08}
                stroke="var(--amber)"
                strokeWidth="1.6"
                strokeOpacity="0.6"
              />
            )}

            {/* Rotating Clock Sweep Beam */}
            <line
              x1={cx}
              y1={cy}
              x2={polarToCartesian(cx, cy, 342, sweepAngle).x}
              y2={polarToCartesian(cx, cy, 342, sweepAngle).y}
              stroke="var(--amber)"
              strokeWidth={position.playing ? 1.8 : 1}
              strokeOpacity={position.playing ? 0.36 : 0.14}
            />

            {/* 8 Layer Orbits */}
            {session.layers.map((layer, idx) => {
              const orbitRadius = 118 + idx * 25;
              const isSelected = layer.id === selectedLayer?.id;
              const isFiring = activeLayerIds.has(layer.id);
              const density = Math.max(0.05, layer.settings?.density ?? 0.5);
              const vol = layer.muted ? 0.08 : Math.max(0.12, layer.volume);
              const speedFactor = 1 + (idx % 3) * 0.35 + (session.macros.movement ?? 0.5) * 0.6;
              const planetAngle =
                -Math.PI / 2 +
                (((beatPos / 16) * speedFactor + idx * 0.13) % 1) * Math.PI * 2;
              const planetPos = polarToCartesian(cx, cy, orbitRadius, planetAngle);
              const planetRadius = 8 + vol * 11 + (isFiring ? 3 : 0);

              // Notes belonging to this layer around the ring
              const layerNotes = notesByLayer.get(layer.id) ?? [];

              return (
                <g key={layer.id} className="orbit-ring-group">
                  <circle
                    cx={cx}
                    cy={cy}
                    r={orbitRadius}
                    fill="none"
                    stroke={layer.color}
                    strokeWidth={isSelected ? 2 : isFiring ? 1.6 : 1}
                    strokeOpacity={layer.muted ? 0.15 : isSelected ? 0.72 : 0.28 + vol * 0.32}
                    strokeDasharray={layer.role === 'drum' ? '4 4' : undefined}
                  />

                  {/* Harmonic Filament to Sun when layer fires */}
                  {isFiring && !layer.muted && (
                    <line
                      x1={cx}
                      y1={cy}
                      x2={planetPos.x}
                      y2={planetPos.y}
                      stroke={layer.color}
                      strokeWidth="1.4"
                      strokeOpacity="0.45"
                    />
                  )}

                  {/* Step Note Flares along Orbit */}
                  {layerNotes.map((n) => {
                    const localBeat = ((n.startBeat - loopWindowStart) % 16 + 16) % 16;
                    const flareAngle = -Math.PI / 2 + (localBeat / 16) * Math.PI * 2;
                    const flarePos = polarToCartesian(cx, cy, orbitRadius, flareAngle);
                    const isNow = beatPos >= n.startBeat && beatPos <= n.startBeat + Math.max(0.28, n.durationBeats);
                    return (
                      <circle
                        key={n.id}
                        cx={flarePos.x}
                        cy={flarePos.y}
                        r={isNow ? 4.8 : 2.3}
                        fill={layer.color}
                        fillOpacity={isNow ? 0.95 : 0.42}
                      />
                    );
                  })}

                  {/* Clickable Planet Node */}
                  <g
                    className={`orbit-planet-node ${isSelected ? 'selected' : ''} ${layer.muted ? 'muted' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedId(layer.id)}
                  >
                    {/* Density Atmosphere Halo */}
                    <circle
                      cx={planetPos.x}
                      cy={planetPos.y}
                      r={planetRadius + 4 + density * 7}
                      fill={layer.color}
                      fillOpacity={layer.muted ? 0.04 : isFiring ? 0.24 : 0.11}
                      stroke={isSelected ? '#ffffff' : layer.color}
                      strokeWidth={isSelected ? 1.5 : 0.8}
                      strokeOpacity={isSelected ? 0.85 : 0.45}
                    />
                    {/* Planet Core */}
                    <circle
                      cx={planetPos.x}
                      cy={planetPos.y}
                      r={planetRadius}
                      fill={layer.muted ? 'var(--surface-inset)' : layer.color}
                      stroke={layer.color}
                      strokeWidth="1.6"
                    />
                    <text
                      x={planetPos.x}
                      y={planetPos.y - planetRadius - 6}
                      textAnchor="middle"
                      className="orbit-planet-label"
                      fill="var(--text)"
                    >
                      {layer.name}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* 12 Interactive Pitch Class Nodes around Outer Dial */}
            {PITCHES.map((label, pc) => {
              const angle = -Math.PI / 2 + (pc / 12) * Math.PI * 2;
              const pos = polarToCartesian(cx, cy, 342, angle);
              const isKey = pc === rootPc;
              const isChordRoot = pc === chordRootPc;
              const inChord = chordPcs.includes(pc);
              return (
                <g
                  key={label}
                  className="orbit-pitch-node"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    const octaveBase = Math.floor(session.root / 12) * 12;
                    engine.setRoot(octaveBase + pc);
                    onAudition?.(octaveBase + pc);
                  }}
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isKey || isChordRoot ? 18 : inChord ? 15 : 13}
                    fill={
                      isKey
                        ? 'var(--amber)'
                        : isChordRoot
                          ? 'var(--accent-2)'
                          : inChord
                            ? 'var(--surface-high)'
                            : 'var(--surface)'
                    }
                    stroke={isKey ? 'var(--amber)' : inChord ? 'var(--accent-2)' : 'var(--line)'}
                    strokeWidth={isKey || isChordRoot ? 2 : 1.1}
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 4}
                    textAnchor="middle"
                    className={`orbit-pitch-label ${isKey || isChordRoot ? 'active' : ''}`}
                    fill={isKey || isChordRoot ? '#111315' : 'var(--text)'}
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Center Harmonic Sun Core */}
            <circle
              cx={cx}
              cy={cy}
              r={84 + beatPulse * 4}
              fill="var(--surface)"
              stroke="var(--line)"
              strokeWidth="1.5"
            />
            <circle
              cx={cx}
              cy={cy}
              r={78}
              fill="none"
              stroke="var(--amber)"
              strokeWidth="4"
              strokeOpacity="0.85"
              strokeLinecap="round"
              strokeDasharray={`${Math.round(chordProgress * 2 * Math.PI * 78)} ${Math.round(2 * Math.PI * 78)}`}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
            <text x={cx} y={cy - 22} textAnchor="middle" className="orbit-sun-eyebrow" fill="var(--muted)">
              {isMin ? 'CHORD' : 'AKKORD'}
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" className="orbit-sun-chord" fill="var(--text)">
              {position.chord || '—'}
            </text>
            <text x={cx} y={cy + 28} textAnchor="middle" className="orbit-sun-next" fill="var(--accent-2)">
              → {position.nextChord || '—'}
            </text>
          </svg>

          {/* 4 Corner Macro Gravity Wells */}
          <div className="orbit-gravity-overlay">
            {macroCards.map(({ key, classicName, corner }) => {
              const val = Math.round((session.macros[key] ?? 0.5) * 100);
              const label = isMin ? MINIMAL_MACROS[key].name : classicName;
              return (
                <div key={key} className={`orbit-gravity-well pos-${corner}`}>
                  <div className="orbit-gravity-head">
                    <span>{label}</span>
                    <b>{val}%</b>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={val}
                    aria-label={label}
                    onChange={(e) => engine.setMacro(key, Number(e.target.value) / 100)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Control Orbit Sidebar */}
      <aside className="orbit-sidebar">
        {/* Harmonic Orbit Transport & Key Pod */}
        <section className="orbit-side-card">
          <div className="orbit-side-head">
            <div>
              <span className="eyebrow">{isMin ? 'HARMONIC CORE' : 'HARMONIE-KERN'}</span>
              <strong>
                {position.chord} <span className="orbit-muted-inline">({isMin ? 'Key' : 'Tonart'} {pitch(session.root)})</span>
              </strong>
            </div>
            <div className="orbit-side-actions">
              <button
                type="button"
                className="button quiet"
                onClick={() => engine.mutate(true)}
                title={isMin ? 'Evolve pattern & motifs' : 'Variation erzeugen'}
              >
                <Sparkles size={13} />
                <span>{isMin ? 'Evolve' : 'Variieren'}</span>
              </button>
              <button
                type="button"
                className="button quiet"
                onClick={() => engine.cycleChord(-1)}
                title={isMin ? 'Previous chord' : 'Vorheriger Akkord'}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                className="button quiet"
                onClick={() => engine.cycleChord(1)}
                title={isMin ? 'Step to next chord' : 'Nächster Akkord'}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <ChordBarStepMeter position={position} edition={edition} />

          <div className="orbit-key-row">
            <label>
              <span>{isMin ? 'Key' : 'Tonart'}</span>
              <select
                value={rootPc}
                onChange={(e) => {
                  const oct = Math.floor(session.root / 12) * 12;
                  engine.setRoot(oct + Number(e.target.value));
                }}
              >
                {PITCHES.map((p, idx) => (
                  <option key={p} value={idx}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{isMin ? 'Scale' : 'Skala'}</span>
              <select
                value={session.scale}
                onChange={(e) => engine.updateSession({ scale: e.target.value as JamSession['scale'] })}
              >
                {SCALES_LIST.map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>BPM</span>
              <input
                type="number"
                min={40}
                max={180}
                value={session.bpm}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) engine.updateSession({ bpm: Math.max(40, Math.min(180, Math.round(v))) });
                }}
              />
            </label>
          </div>
        </section>

        {/* Selected Planet Pod */}
        {selectedLayer && (
          <section className="orbit-side-card">
            <div className="orbit-layer-pills" role="tablist" aria-label={isMin ? 'Select orbit track' : 'Spur wählen'}>
              {session.layers.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  role="tab"
                  aria-selected={layer.id === selectedLayer.id}
                  className={`orbit-layer-pill ${layer.id === selectedLayer.id ? 'active' : ''} ${layer.muted ? 'muted' : ''}`}
                  onClick={() => setSelectedId(layer.id)}
                >
                  <span className="dot" style={{ background: layer.color }} />
                  <span>{layer.name}</span>
                </button>
              ))}
            </div>

            <div className="orbit-selected-head">
              <div className="orbit-selected-title">
                <span className="dot" style={{ background: selectedLayer.color }} />
                <div>
                  <strong>{selectedLayer.name}</strong>
                  <small>
                    {selectedLayer.role === 'drum'
                      ? getDrumModelDisplayName(selectedLayer.settings?.drumModel ?? selectedLayer.drumVoice, edition)
                      : getTimbreDisplayName(selectedLayer.settings?.timbre ?? 'warm', edition)}
                  </small>
                </div>
              </div>
              <div className="orbit-ms-group">
                <button
                  type="button"
                  className={`track-btn ${selectedLayer.muted ? 'active mute' : ''}`}
                  onClick={() => engine.updateLayer(selectedLayer.id, { muted: !selectedLayer.muted })}
                >
                  M
                </button>
                <button
                  type="button"
                  className={`track-btn ${selectedLayer.solo ? 'active solo' : ''}`}
                  onClick={() => engine.updateLayer(selectedLayer.id, { solo: !selectedLayer.solo })}
                >
                  S
                </button>
                <button
                  type="button"
                  className={`track-btn ${selectedLayer.locked ? 'active' : ''}`}
                  onClick={() => engine.updateLayer(selectedLayer.id, { locked: !selectedLayer.locked })}
                  title={isMin ? 'Lock pattern' : 'Muster sperren'}
                >
                  <Lock size={11} />
                </button>
                <button
                  type="button"
                  className={`track-btn ${selectedLayer.frozen ? 'active' : ''}`}
                  onClick={() => engine.updateLayer(selectedLayer.id, { frozen: !selectedLayer.frozen })}
                  title={isMin ? 'Freeze notes' : 'Noten einfrieren'}
                >
                  <Snowflake size={11} />
                </button>
              </div>
            </div>

            <div className="orbit-preset-bar">
              <button
                type="button"
                className="button quiet orbit-dice-btn"
                onClick={() => engine.randomizeInstrumentPreset(selectedLayer.id)}
                title={isMin ? `Random preset for ${selectedLayer.name}` : `Zufälliges Instrument für ${selectedLayer.name}`}
              >
                <Dices size={14} />
                <span>{isMin ? 'Dice Sound' : 'Würfel'}</span>
              </button>
              <select
                className="orbit-preset-select"
                value={activePreset?.id ?? ''}
                onChange={(e) => {
                  if (e.target.value) engine.applyInstrumentPreset(selectedLayer.id, e.target.value);
                }}
              >
                <option value="" disabled>
                  {isMin ? 'Choose instrument preset…' : 'Instrument wählen…'}
                </option>
                {selectedPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {getInstrumentPresetDisplay(preset, edition).name}
                  </option>
                ))}
              </select>
            </div>

            <div className="orbit-slider-stack">
              <label className="orbit-slider-field">
                <div className="orbit-slider-label">
                  <span><Volume2 size={12} /> {isMin ? 'Orbit Volume' : 'Lautstärke'}</span>
                  <b>{Math.round(selectedLayer.volume * 100)}%</b>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(selectedLayer.volume * 100)}
                  onChange={(e) => engine.updateLayer(selectedLayer.id, { volume: Number(e.target.value) / 100 })}
                />
              </label>

              <label className="orbit-slider-field">
                <div className="orbit-slider-label">
                  <span><Radio size={12} /> {isMin ? 'Activity / Density' : 'Dichte / Aktivität'}</span>
                  <b>{Math.round((selectedLayer.settings?.density ?? 0.5) * 100)}%</b>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((selectedLayer.settings?.density ?? 0.5) * 100)}
                  onChange={(e) => engine.setLayerSettings(selectedLayer.id, { density: Number(e.target.value) / 100 })}
                />
              </label>
            </div>
          </section>
        )}

        {/* Arrangement Orbit Jumps */}
        <section className="orbit-side-card">
          <div className="orbit-side-head">
            <div>
              <span className="eyebrow">{isMin ? 'DYNAMIC ARC' : 'DRAMATURGIE'}</span>
              <strong>{isMin ? 'Energy Snapshots' : 'Energie-Sprünge'}</strong>
            </div>
            <button
              type="button"
              className="button quiet"
              onClick={() => engine.applyArrangement('spontaneous', true)}
            >
              Auto
            </button>
          </div>
          <div className="orbit-arc-row">
            {arrangementButtons.map((btn) => (
              <button
                key={btn.id}
                type="button"
                className={`button quiet ${session.arrangement === btn.id ? 'active' : ''}`}
                onClick={() => engine.applyArrangement(btn.id, true)}
              >
                {isMin ? btn.en : btn.de}
              </button>
            ))}
          </div>
        </section>

        {!live && (
          <div className="orbit-paused-hint">
            {isMin ? 'Press Play in top bar to orbit live.' : 'Starte Play oben für Live-Umlauf.'}
          </div>
        )}
      </aside>
    </section>
  );
}
