import { useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Dices,
  Dice5,
  Sparkles,
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
import { ChordBarStepMeter, SCALES_LIST } from './LayoutShared';
import type { ClipNote, JamPosition, JamSession, MacroName } from '../../types/jam';
import type { UiEdition } from '../../types/ui';

const engine = JamEngine.getInstance();
const PITCHES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const pitch = (n: number) => noteName(n).replace(/-?\d+$/, '');

interface SynesthesiaLayoutProps {
  session: JamSession;
  position: JamPosition;
  edition: UiEdition;
  rollNotes: ClipNote[];
  onAudition?: (note: number) => void;
}

interface XYPadProps {
  title: string;
  xLabel: string;
  yLabel: string;
  xValue: number;
  yValue: number;
  accentColor: string;
  onChange: (x: number, y: number) => void;
}

function StageXYPad({
  title,
  xLabel,
  yLabel,
  xValue,
  yValue,
  accentColor,
  onChange,
}: XYPadProps) {
  const padRef = useRef<HTMLDivElement | null>(null);

  const emitFromEvent = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const ny = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / Math.max(1, rect.height)));
    onChange(nx, ny);
  };

  return (
    <div className="syn-xy-card">
      <div className="syn-xy-head">
        <span className="eyebrow">{title}</span>
        <small>
          {Math.round(xValue * 100)}% / {Math.round(yValue * 100)}%
        </small>
      </div>
      <div
        ref={padRef}
        className="syn-xy-surface"
        role="slider"
        tabIndex={0}
        aria-label={`${title}: ${xLabel} ${Math.round(xValue * 100)}%, ${yLabel} ${Math.round(yValue * 100)}%`}
        aria-valuetext={`${Math.round(xValue * 100)}% × ${Math.round(yValue * 100)}%`}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          emitFromEvent(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 0 && !e.currentTarget.hasPointerCapture(e.pointerId)) return;
          emitFromEvent(e.clientX, e.clientY);
        }}
      >
        <div className="syn-xy-crosshair-v" style={{ left: `${xValue * 100}%` }} />
        <div className="syn-xy-crosshair-h" style={{ bottom: `${yValue * 100}%` }} />
        <div
          className="syn-xy-puck"
          style={{
            left: `${xValue * 100}%`,
            bottom: `${yValue * 100}%`,
            borderColor: accentColor,
            boxShadow: `0 0 18px ${accentColor}`,
          }}
        />
        <span className="syn-xy-axis-x">{xLabel}</span>
        <span className="syn-xy-axis-y">{yLabel}</span>
      </div>
    </div>
  );
}

export function SynesthesiaLayout({
  session,
  position,
  edition,
  rollNotes,
  onAudition,
}: SynesthesiaLayoutProps) {
  const isMin = edition === 'minimal';
  const beatPos = Math.max(0, position.beat);
  const beatPulse = position.playing ? Math.exp(-(beatPos % 1) * 3.6) : 0.16;
  const rootPc = ((session.root % 12) + 12) % 12;

  const movement = session.macros.movement ?? 0.5;
  const density = session.macros.density ?? 0.5;
  const warmth = session.macros.warmth ?? 0.5;
  const space = session.macros.space ?? 0.5;

  const windowStart = Math.floor(beatPos / 16) * 16;
  const skyNotes = useMemo(
    () =>
      rollNotes
        .filter((n) => n.startBeat >= Math.max(0, beatPos - 16) && n.startBeat <= beatPos + 12 && n.channel !== 10)
        .slice(-90),
    [rollNotes, beatPos],
  );

  const activeLayerIds = useMemo(() => {
    const active = new Set<string>();
    const recent = rollNotes.slice(-240);
    for (const n of recent) {
      if (beatPos >= n.startBeat && beatPos <= n.startBeat + Math.max(0.24, n.durationBeats)) {
        active.add(n.layerId);
      }
    }
    return active;
  }, [rollNotes, beatPos]);

  // Construct smooth multi-ribbon aurora SVG paths
  const auroraPaths = useMemo(() => {
    const phase = beatPos * (0.45 + movement * 0.85);
    return [0, 1, 2, 3].map((ribbonIdx) => {
      const baseY = 148 + ribbonIdx * 13;
      const amp = 16 + ribbonIdx * 7 + space * 26 + beatPulse * 14;
      const points: string[] = [];
      for (let i = 0; i <= 10; i++) {
        const x = i * 110;
        const y =
          baseY +
          Math.sin(phase + i * 0.65 + ribbonIdx * 1.1) * amp * 0.72 +
          Math.cos(phase * 0.55 - i * 0.4 + ribbonIdx) * amp * 0.35;
        points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y.toFixed(1)}`);
      }
      return points.join(' ');
    });
  }, [beatPos, movement, space, beatPulse]);

  // Perspective 3D chord crystal vertices
  const crystalGeometry = useMemo(() => {
    const notes = position.chordNotes?.length ? position.chordNotes : [session.root, session.root + 7];
    const cx = 550;
    const cy = 112;
    const rx = 54 + space * 28 + beatPulse * 10;
    const ry = 36 + warmth * 14 + beatPulse * 6;
    const spin = beatPos * 0.32;
    const pts = notes.map((n, idx) => {
      const angle = spin + (idx / Math.max(2, notes.length)) * Math.PI * 2;
      const pitchLift = ((n - 60) / 24) * 18;
      return {
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry - pitchLift,
        note: n,
      };
    });
    const polygon = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return { cx, cy, pts, polygon };
  }, [position.chordNotes, session.root, space, warmth, beatPulse, beatPos]);

  // Moving 3D perspective floor horizontal scanlines
  const horizonRows = useMemo(() => {
    const phase = (beatPos * 0.5) % 1;
    return [0, 1, 2, 3, 4, 5].map((i) => {
      const t = (i + phase) / 6;
      const y = 216 + Math.pow(t, 1.75) * 168;
      return { y, alpha: 0.14 + t * 0.42 };
    });
  }, [beatPos]);

  const macroLabel = (k: MacroName, de: string) => (isMin ? MINIMAL_MACROS[k].name : de);

  return (
    <section
      className="layout-synesthesia"
      aria-label={isMin ? 'Synesthesia Audiovisual Stage' : 'Synesthesia Audiovisuelle Bühne'}
    >
      {/* Upper 3D Horizon & Aurora Stage + Bilateral XY Pads */}
      <div className="syn-stage-card">
        <div className="syn-stage-top">
          <div className="syn-stage-title">
            <span className="eyebrow">{isMin ? '8 · SYNESTHESIA STAGE' : '8 · SYNESTHESIA-BÜHNE'}</span>
            <strong>
              {isMin
                ? 'Harmonic Aurora, Star Constellations & Tactile XY Morphing'
                : 'Harmonie-Aurora, Sternenbild-Melodien & Dual XY-Steuerung'}
            </strong>
          </div>
          <div className="syn-stage-legend">
            <span>{isMin ? 'Click any star to play its note' : 'Stern anklicken zum Vorhören'}</span>
          </div>
        </div>

        <div className="syn-horizon-wrap">
          <svg
            viewBox="0 0 1100 390"
            className="syn-svg"
            role="img"
            aria-label={isMin ? '3D Perspective Music Visualizer' : '3D Perspektiv-Musikvisualisierung'}
          >
            <defs>
              <linearGradient id="synSkyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--bg)" stopOpacity="0.95" />
                <stop offset="56%" stopColor="var(--surface-inset)" stopOpacity="0.85" />
                <stop offset="100%" stopColor="var(--surface)" stopOpacity="0.95" />
              </linearGradient>
              <radialGradient id="synHorizonGlow" cx="50%" cy="54%" r="48%">
                <stop offset="0%" stopColor="var(--amber)" stopOpacity={0.22 + beatPulse * 0.25} />
                <stop offset="52%" stopColor="var(--accent-2)" stopOpacity={0.14 + space * 0.16} />
                <stop offset="100%" stopColor="var(--bg)" stopOpacity="0" />
              </radialGradient>
            </defs>

            <rect x="0" y="0" width="1100" height="390" rx="14" fill="url(#synSkyGrad)" />
            <ellipse cx="550" cy="212" rx="460" ry="155" fill="url(#synHorizonGlow)" />

            {/* Harmonic Aurora Wave Ribbons */}
            {auroraPaths.map((d, idx) => (
              <path
                key={idx}
                d={d}
                fill="none"
                stroke={idx % 2 === 0 ? 'var(--amber)' : 'var(--accent-2)'}
                strokeWidth={2.4 - idx * 0.35}
                strokeOpacity={0.28 + warmth * 0.25 + (idx === 0 ? beatPulse * 0.28 : 0)}
              />
            ))}

            {/* Melodic Constellation Threads */}
            {skyNotes.length > 1 && (
              <polyline
                fill="none"
                stroke="var(--accent-2)"
                strokeWidth="0.9"
                strokeOpacity="0.28"
                points={skyNotes
                  .map((n) => {
                    const localX = (((n.startBeat - windowStart) % 16) + 16) % 16;
                    const x = 190 + (localX / 16) * 720;
                    const normY = 1 - Math.max(0, Math.min(1, (n.note - 36) / 60));
                    const y = 26 + normY * 165;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(' ')}
              />
            )}

            {/* Interactive Melodic Stars */}
            {skyNotes.map((n) => {
              const localX = (((n.startBeat - windowStart) % 16) + 16) % 16;
              const x = 190 + (localX / 16) * 720;
              const normY = 1 - Math.max(0, Math.min(1, (n.note - 36) / 60));
              const y = 26 + normY * 165;
              const isNow = beatPos >= n.startBeat && beatPos <= n.startBeat + Math.max(0.28, n.durationBeats);
              const layerColor = session.layers.find((l) => l.id === n.layerId)?.color ?? 'var(--amber)';
              return (
                <g
                  key={n.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onAudition?.(n.note)}
                >
                  <title>{`${noteName(n.note)}`}</title>
                  <circle
                    cx={x}
                    cy={y}
                    r={isNow ? 6.5 : 3.1}
                    fill={layerColor}
                    fillOpacity={isNow ? 0.96 : 0.62}
                  />
                  {isNow && (
                    <circle
                      cx={x}
                      cy={y}
                      r={13}
                      fill="none"
                      stroke={layerColor}
                      strokeWidth="1.2"
                      strokeOpacity="0.65"
                    />
                  )}
                </g>
              );
            })}

            {/* Rotating 3D Chord Crystal */}
            {crystalGeometry.polygon && (
              <polygon
                points={crystalGeometry.polygon}
                fill="var(--amber)"
                fillOpacity={0.1 + beatPulse * 0.14}
                stroke="var(--amber)"
                strokeWidth="1.6"
                strokeOpacity="0.82"
              />
            )}
            {crystalGeometry.pts.map((p, idx) => (
              <g key={`${p.note}-${idx}`} style={{ cursor: 'pointer' }} onClick={() => onAudition?.(p.note)}>
                <line
                  x1={crystalGeometry.cx}
                  y1={crystalGeometry.cy - 28}
                  x2={p.x}
                  y2={p.y}
                  stroke="var(--accent-2)"
                  strokeWidth="0.9"
                  strokeOpacity="0.45"
                />
                <circle cx={p.x} cy={p.y} r="4.5" fill="var(--text)" />
              </g>
            ))}

            {/* 3D Perspective Floor Horizon */}
            <line x1="0" y1="214" x2="1100" y2="214" stroke="var(--line)" strokeWidth="1.4" />
            {Array.from({ length: 13 }, (_, idx) => {
              const offset = idx - 6;
              const topX = 550 + offset * 34;
              const botX = 550 + offset * 145;
              return (
                <line
                  key={`ray-${idx}`}
                  x1={topX}
                  y1={214}
                  x2={botX}
                  y2={390}
                  stroke="var(--line)"
                  strokeWidth="1"
                  strokeOpacity="0.48"
                />
              );
            })}
            {horizonRows.map((row, idx) => (
              <line
                key={`row-${idx}`}
                x1="0"
                y1={row.y}
                x2="1100"
                y2={row.y}
                stroke="var(--amber)"
                strokeWidth="1"
                strokeOpacity={row.alpha * 0.45}
              />
            ))}

            {/* Layer Prisms Standing on Horizon Floor */}
            {session.layers.map((layer, idx) => {
              const spreadOffset = idx - (session.layers.length - 1) / 2;
              const px = 550 + spreadOffset * 88;
              const firing = activeLayerIds.has(layer.id) && !layer.muted;
              const h = 16 + layer.volume * 52 + (firing ? 18 : 0);
              return (
                <g key={`prism-${layer.id}`}>
                  <rect
                    x={px - 10}
                    y={238 - h * 0.4}
                    width="20"
                    height={h}
                    rx="5"
                    fill={layer.muted ? 'var(--surface-inset)' : layer.color}
                    fillOpacity={layer.muted ? 0.2 : firing ? 0.92 : 0.45}
                    stroke={layer.color}
                    strokeWidth={firing ? 1.8 : 1}
                  />
                </g>
              );
            })}
          </svg>

          {/* Left & Right Stage XY Pads */}
          <div className="syn-xy-overlay">
            <StageXYPad
              title={isMin ? 'MOTION × SPACE' : 'BEWEGUNG × RAUM'}
              xLabel={macroLabel('movement', 'Bewegung')}
              yLabel={macroLabel('space', 'Raum')}
              xValue={movement}
              yValue={space}
              accentColor="var(--accent-2)"
              onChange={(x, y) => {
                engine.setMacro('movement', x);
                engine.setMacro('space', y);
              }}
            />
            <StageXYPad
              title={isMin ? 'WARMTH × DENSITY' : 'WÄRME × DICHTE'}
              xLabel={macroLabel('warmth', 'Wärme')}
              yLabel={macroLabel('density', 'Dichte')}
              xValue={warmth}
              yValue={density}
              accentColor="var(--amber)"
              onChange={(x, y) => {
                engine.setMacro('warmth', x);
                engine.setMacro('density', y);
              }}
            />
          </div>
        </div>
      </div>

      {/* Middle: 8 Luminous Vertical Track Totems */}
      <div className="syn-totem-strip" aria-label={isMin ? 'Track Totems' : 'Spur-Totems'}>
        {session.layers.map((layer) => {
          const firing = activeLayerIds.has(layer.id) && !layer.muted;
          const volPct = Math.round(layer.volume * 100);
          const presets = getInstrumentPresets(layer.role, layer.drumVoice);
          const activePreset = detectActiveInstrumentPreset(layer);

          return (
            <div
              key={layer.id}
              className={`syn-totem-card ${firing ? 'firing' : ''} ${layer.muted ? 'muted' : ''}`}
              style={{ '--totem-color': layer.color } as React.CSSProperties}
            >
              <div className="syn-totem-head">
                <span className="dot" style={{ background: layer.color }} />
                <strong>{layer.name}</strong>
                <div className="syn-totem-ms">
                  <button
                    type="button"
                    className={`track-btn ${layer.muted ? 'active mute' : ''}`}
                    onClick={() => engine.updateLayer(layer.id, { muted: !layer.muted })}
                  >
                    M
                  </button>
                  <button
                    type="button"
                    className={`track-btn ${layer.solo ? 'active solo' : ''}`}
                    onClick={() => engine.updateLayer(layer.id, { solo: !layer.solo })}
                  >
                    S
                  </button>
                </div>
              </div>

              <div className="syn-totem-meter-area">
                <div className="syn-totem-pillar-track">
                  <div
                    className="syn-totem-pillar-fill"
                    style={{
                      height: `${volPct}%`,
                      background: layer.muted ? 'var(--line)' : layer.color,
                    }}
                  />
                </div>
                <div className="syn-totem-sliders">
                  <label>
                    <span>Vol {volPct}%</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={volPct}
                      onChange={(e) => engine.updateLayer(layer.id, { volume: Number(e.target.value) / 100 })}
                    />
                  </label>
                  <label>
                    <span>Dens {Math.round((layer.settings?.density ?? 0.5) * 100)}%</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round((layer.settings?.density ?? 0.5) * 100)}
                      onChange={(e) => engine.setLayerSettings(layer.id, { density: Number(e.target.value) / 100 })}
                    />
                  </label>
                </div>
              </div>

              <div className="syn-totem-footer">
                <button
                  type="button"
                  className="mini-dice-btn"
                  onClick={() => engine.randomizeInstrumentPreset(layer.id)}
                  title={isMin ? `Dice preset for ${layer.name}` : `Zufalls-Sound für ${layer.name}`}
                >
                  <Dices size={12} />
                </button>
                <select
                  className="compact-track-preset-select"
                  value={activePreset?.id ?? ''}
                  aria-label={isMin ? `${layer.name} instrument preset` : `${layer.name} Instrument`}
                  onChange={(e) => {
                    if (e.target.value) engine.applyInstrumentPreset(layer.id, e.target.value);
                  }}
                >
                  <option value="" disabled>
                    {layer.role === 'drum'
                      ? getDrumModelDisplayName(layer.settings?.drumModel ?? layer.drumVoice, edition)
                      : getTimbreDisplayName(layer.settings?.timbre ?? 'warm', edition)}
                  </option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {getInstrumentPresetDisplay(p, edition).name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Floating Glass Harmony & Step Dock */}
      <footer className="syn-bottom-dock">
        <div className="syn-dock-chord">
          <div>
            <span className="eyebrow">{isMin ? 'CURRENT CHORD' : 'AKTUELLER AKKORD'}</span>
            <strong>{position.chord || '—'}</strong>
          </div>
          <span className="syn-dock-arrow">→</span>
          <div>
            <span className="eyebrow">{isMin ? 'NEXT' : 'DANACH'}</span>
            <b>{position.nextChord || '—'}</b>
          </div>
          <span className="syn-dock-keybadge">
            {isMin ? 'Key' : 'Tonart'} {pitch(session.root)}
          </span>
        </div>

        <div className="syn-dock-meter">
          <ChordBarStepMeter position={position} edition={edition} />
        </div>

        <div className="syn-dock-controls">
          <select
            aria-label={isMin ? 'Key' : 'Tonart'}
            value={rootPc}
            onChange={(e) => {
              const oct = Math.floor(session.root / 12) * 12;
              engine.setRoot(oct + Number(e.target.value));
            }}
          >
            {PITCHES.map((p, idx) => (
              <option key={p} value={idx}>{isMin ? `Key ${p}` : `Tonart ${p}`}</option>
            ))}
          </select>

          <select
            aria-label={isMin ? 'Scale' : 'Skala'}
            value={session.scale}
            onChange={(e) => engine.updateSession({ scale: e.target.value as JamSession['scale'] })}
          >
            {SCALES_LIST.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>

          <button type="button" className="button quiet" onClick={() => engine.cycleChord(-1)}>
            <ChevronLeft size={14} />
          </button>
          <button type="button" className="button quiet" onClick={() => engine.cycleChord(1)}>
            <ChevronRight size={14} />
          </button>
          <button type="button" className="button quiet" onClick={() => engine.mutate(true)}>
            <Sparkles size={13} />
            <span>{isMin ? 'Evolve' : 'Variieren'}</span>
          </button>
          <button
            type="button"
            className="button quiet"
            onClick={() => engine.updateSession({ seed: Math.floor(Math.random() * 1e9) })}
          >
            <Dice5 size={13} />
            <span>{isMin ? 'New Seed' : 'Neuer Seed'}</span>
          </button>
        </div>
      </footer>
    </section>
  );
}
