import { useMemo, useState } from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Dices,
  Lock,
  Power,
  Snowflake,
  Sparkles,
  Zap,
} from 'lucide-react';
import { JamEngine } from '../../engine/jam/JamEngine';
import { detectActiveInstrumentPreset, getInstrumentPresets } from '../../engine/jam/instrumentPresets';
import {
  MINIMAL_ATMOSPHERE_LABELS,
  MINIMAL_EFFECT_MODULES,
  MINIMAL_MACROS,
  getCustomMacroDisplayName,
  getDrumModelDisplayName,
  getInstrumentPresetDisplay,
  getTimbreDisplayName,
} from '../../engine/jam/minimalCatalog';
import { ChordBarStepMeter, SCALES_LIST } from './LayoutShared';
import type {
  AtmosphereKind,
  ChaosMode,
  ClipNote,
  EffectChainMode,
  EffectModuleId,
  JamLayer,
  JamPosition,
  JamSession,
  MacroName,
} from '../../types/jam';
import type { UiEdition } from '../../types/ui';

const engine = JamEngine.getInstance();
const PITCHES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

interface PatchbayLayoutProps {
  session: JamSession;
  position: JamPosition;
  edition: UiEdition;
  rollNotes: ClipNote[];
}

const DEFAULT_MODULES: Array<{ id: EffectModuleId; name: string; bypassed: boolean }> = [
  { id: 'eq', name: '3-Band EQ', bypassed: false },
  { id: 'warmth', name: 'Tape Drive', bypassed: false },
  { id: 'delay', name: 'Stereo Delay', bypassed: false },
  { id: 'reverb', name: 'Hall Reverb', bypassed: false },
  { id: 'pump', name: 'Sidechain Pump', bypassed: false },
];

export function PatchbayLayout({ session, position, edition, rollNotes }: PatchbayLayoutProps) {
  const isMin = edition === 'minimal';
  const [focusedLayerId, setFocusedLayerId] = useState<string | null>(null);
  const [focusedMacro, setFocusedMacro] = useState<MacroName | null>(null);

  const beatPos = Math.max(0, position.beat);
  const stepBeat = Math.floor(beatPos * 4) / 4;
  const rootPc = ((session.root % 12) + 12) % 12;

  const activeLayerIds = useMemo(() => {
    const set = new Set<string>();
    const recent = rollNotes.slice(-260);
    const stepEnd = stepBeat + 0.24;
    for (const n of recent) {
      if (n.startBeat <= stepEnd && stepBeat <= n.startBeat + Math.max(0.24, n.durationBeats)) {
        set.add(n.layerId);
      }
    }
    return set;
  }, [rollNotes, stepBeat]);

  const fxMode: EffectChainMode = session.effectChain?.mode ?? 'delay-into-reverb';
  const fxActive = engine.isFxChainActive();
  const modules = session.effectChain?.modules?.length ? session.effectChain.modules : DEFAULT_MODULES;
  const isBypassed = (id: EffectModuleId) =>
    !fxActive || (modules.find((m) => m.id === id)?.bypassed ?? false);

  const fx = session.effectsPatch || {};
  const reverbMix = fx.reverbMix ?? 0.35;
  const reverbSize = fx.reverbSize ?? 0.65;
  const delayMix = fx.delayMix ?? 0.28;
  const delayFeedback = fx.delayFeedback ?? 0.35;
  const masterDrive = fx.masterDrive ?? 0.12;
  const eqLow = fx.eqLow ?? 0;
  const eqMid = fx.eqMid ?? 0;
  const eqHigh = fx.eqHigh ?? 0;
  const pumpAmt = session.pump ?? 0;
  const atmo = session.atmosphere ?? { kind: 'off' as AtmosphereKind, level: 0, tone: 0.5, movement: 0.3 };

  const chaosModes: Array<{ id: ChaosMode; en: string; de: string }> = [
    { id: 'manual', en: 'Manual', de: 'Manuell' },
    { id: 'calm', en: 'Calm', de: 'Sanft' },
    { id: 'pulse', en: 'Pulse', de: 'Puls' },
    { id: 'wild', en: 'Wild', de: 'Wild' },
  ];

  const macroRows: Array<{ key: MacroName; classicName: string; affects: string }> = [
    { key: 'movement', classicName: 'Bewegung', affects: 'Chords · Melody · Filter LFO' },
    { key: 'density', classicName: 'Dichte', affects: 'Arp · Percussion · Ghost Steps' },
    { key: 'warmth', classicName: 'Wärme', affects: 'Drive · Cutoff · Bass Body' },
    { key: 'space', classicName: 'Raum', affects: 'Reverb · Delay · Texture Halo' },
  ];

  const fxModes: Array<{ id: EffectChainMode; en: string; de: string }> = [
    { id: 'parallel', en: 'Parallel Split', de: 'Parallel-Split' },
    { id: 'delay-into-reverb', en: 'Delay → Reverb', de: 'Delay → Reverb' },
    { id: 'reverb-into-delay', en: 'Reverb → Delay', de: 'Reverb → Delay' },
  ];

  const cableSpeedSec = `${Math.max(0.6, Math.min(2.6, 120 / Math.max(40, session.bpm))).toFixed(2)}s`;

  // Proportional normalized SVG coordinates (0..1000 x 0..640) matching the 3 modular columns
  const genAnchors = [108, 250, 392, 530]; // Harmony/Clock, Macros, Chaos, Custom/Arc
  const trackAnchors = session.layers.map((_, idx) => 56 + idx * 75);
  const fxAnchors = [86, 204, 322, 440, 558]; // EQ/Drive, Delay, Reverb, Pump, Atmosphere

  const macroLayerTargetIndices = (macro: MacroName | null): Set<number> => {
    if (!macro) return new Set();
    if (macro === 'movement') return new Set([1, 3, 6, 7]);
    if (macro === 'density') return new Set([2, 3, 4, 5, 6, 7]);
    if (macro === 'warmth') return new Set([0, 1, 2, 4]);
    return new Set([0, 1, 3, 5]);
  };
  const macroTargets = macroLayerTargetIndices(focusedMacro);

  return (
    <section
      className="layout-patchbay"
      style={{ '--cable-speed': cableSpeedSec } as React.CSSProperties}
      aria-label={isMin ? 'Modular Signal Patchbay' : 'Modulares Signal-Patchbay'}
    >
      {/* Top Signal Flow Topology Header */}
      <div className="patchbay-topology-bar">
        <div className="patchbay-topo-title">
          <span className="eyebrow">{isMin ? '7 · SIGNAL PATCHBAY' : '7 · SIGNAL-PATCHBAY'}</span>
          <strong>
            {isMin
              ? 'Clock & Macros → 8 Instrument Nodes → Modular FX Bus'
              : 'Clock & Makros → 8 Instrumenten-Nodes → Modulares Effekt-Routing'}
          </strong>
        </div>

        <div className="patchbay-routing-pills" role="group" aria-label="FX Routing">
          {fxModes.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`button quiet ${fxMode === m.id ? 'active' : ''}`}
              onClick={() => engine.setEffectChainMode(m.id)}
            >
              {isMin ? m.en : m.de}
            </button>
          ))}
          <button
            type="button"
            className={`button quiet ${fxActive ? 'active' : ''}`}
            onClick={() => engine.toggleFxChainActive()}
            title={isMin ? 'Master FX Active / Bypass' : 'Effekt-Bus Aktiv / Bypass'}
          >
            <Power size={13} />
            <span>{fxActive ? 'FX On' : 'FX Bypass'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Patch Matrix with Reactive Bezier Cable Field */}
      <div className="patchbay-canvas-grid">
        {/* Background Live SVG Bezier Patch Cables */}
        <svg
          className="patchbay-cable-overlay"
          viewBox="0 0 1000 640"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Left -> Middle Cables: Harmony & Macros feeding all 8 tracks */}
          {session.layers.map((layer, idx) => {
            const ty = trackAnchors[idx] ?? 320;
            const sy = idx < 4 ? genAnchors[0] : genAnchors[1];
            const firing = activeLayerIds.has(layer.id);
            const highlighted =
              focusedLayerId === layer.id || macroTargets.has(idx) || firing;
            const d = `M 285 ${sy} C 330 ${sy}, 330 ${ty}, 365 ${ty}`;
            return (
              <path
                key={`g-${layer.id}`}
                d={d}
                className={`patch-cable ${!layer.muted && highlighted ? 'hot' : ''} ${layer.muted ? 'muted' : ''}`}
                stroke={layer.muted ? 'var(--line)' : layer.color}
                strokeWidth={highlighted && !layer.muted ? 2.4 : 1.2}
                strokeOpacity={layer.muted ? 0.16 : highlighted ? 0.85 : 0.28}
              />
            );
          })}

          {/* Middle -> Right Cables: Tracks feeding EQ, Delay, Reverb, Pump, Atmosphere */}
          {session.layers.map((layer, idx) => {
            const sy = trackAnchors[idx] ?? 320;
            const firing = activeLayerIds.has(layer.id);
            const targetFxIdx =
              layer.role === 'drum'
                ? layer.drumVoice === 'kick'
                  ? 3 // Kick triggers Sidechain Pump!
                  : 0 // Drums -> EQ/Drive
                : layer.role === 'drone' || layer.role === 'chords'
                  ? 2 // Pads/Chords -> Reverb
                  : 1; // Melody/Bass -> Delay
            const ty = fxAnchors[targetFxIdx] ?? 200;
            const fxModId: EffectModuleId =
              targetFxIdx === 0 ? 'eq' : targetFxIdx === 1 ? 'delay' : targetFxIdx === 2 ? 'reverb' : 'pump';
            const activeCable = !layer.muted && !isBypassed(fxModId);
            const hot = activeCable && (firing || focusedLayerId === layer.id);
            const d = `M 635 ${sy} C 680 ${sy}, 680 ${ty}, 715 ${ty}`;
            return (
              <path
                key={`t-${layer.id}`}
                d={d}
                className={`patch-cable ${hot ? 'hot' : ''} ${!activeCable ? 'muted' : ''}`}
                stroke={!activeCable ? 'var(--line)' : layer.color}
                strokeWidth={hot ? 2.6 : 1.2}
                strokeOpacity={!activeCable ? 0.16 : hot ? 0.88 : 0.3}
              />
            );
          })}

          {/* Inter-FX Serial Cable between Delay and Reverb depending on fxMode */}
          {fxMode !== 'parallel' && !isBypassed('delay') && !isBypassed('reverb') && (
            <path
              d={
                fxMode === 'delay-into-reverb'
                  ? `M 955 ${fxAnchors[1]} C 990 ${fxAnchors[1]}, 990 ${fxAnchors[2]}, 955 ${fxAnchors[2]}`
                  : `M 955 ${fxAnchors[2]} C 990 ${fxAnchors[2]}, 990 ${fxAnchors[1]}, 955 ${fxAnchors[1]}`
              }
              className="patch-cable hot"
              stroke="var(--accent-2)"
              strokeWidth="2.6"
              strokeOpacity="0.9"
            />
          )}
        </svg>

        {/* COLUMN 1: Generators, Clock Brain & Macros */}
        <div className="patch-col patch-col-gen">
          <div className="patch-node">
            <div className="patch-node-head">
              <div>
                <span className="eyebrow">{isMin ? 'BRAIN · CLOCK' : 'GEN · HARMONIE'}</span>
                <strong>
                  {position.chord || '—'} <small>→ {position.nextChord || '—'}</small>
                </strong>
              </div>
              <button
                type="button"
                className="button quiet"
                onClick={() => engine.mutate(true)}
                title={isMin ? 'Evolve pattern' : 'Variieren'}
              >
                <Sparkles size={12} />
                <span>{isMin ? 'Evolve' : 'Var'}</span>
              </button>
            </div>

            <ChordBarStepMeter position={position} edition={edition} />

            <div className="patch-inline-controls">
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
                <ChevronLeft size={13} />
              </button>
              <button type="button" className="button quiet" onClick={() => engine.cycleChord(1)}>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>

          <div className="patch-node">
            <div className="patch-node-head">
              <div>
                <span className="eyebrow">{isMin ? 'MACRO MODULATORS' : 'MAKRO-MODULATOREN'}</span>
                <strong>{isMin ? 'Global Shapers' : 'Klang-Makros'}</strong>
              </div>
              <span className="patch-jack-out" title="Signal Out" />
            </div>

            <div className="patch-macro-list">
              {macroRows.map(({ key, classicName, affects }) => {
                const pct = Math.round((session.macros[key] ?? 0.5) * 100);
                return (
                  <label
                    key={key}
                    className={`patch-macro-item ${focusedMacro === key ? 'active' : ''}`}
                    onMouseEnter={() => setFocusedMacro(key)}
                    onMouseLeave={() => setFocusedMacro(null)}
                  >
                    <div className="patch-macro-meta">
                      <span>{isMin ? MINIMAL_MACROS[key].name : classicName}</span>
                      <small>{affects}</small>
                      <b>{pct}%</b>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={pct}
                      onChange={(e) => engine.setMacro(key, Number(e.target.value) / 100)}
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <div className="patch-node">
            <div className="patch-node-head">
              <div>
                <span className="eyebrow">{isMin ? 'DRIFT ENGINE' : 'DRIFT / CHAOS'}</span>
                <strong>{isMin ? 'Generative Chaos' : 'Klang-Chaos'}</strong>
              </div>
              <button
                type="button"
                className={`button quiet ${session.chaosEnabled ? 'active' : ''}`}
                onClick={() => engine.setChaosEnabled(!session.chaosEnabled)}
              >
                <Zap size={12} />
                <span>{session.chaosEnabled ? 'On' : 'Off'}</span>
              </button>
            </div>
            <div className="patch-chip-row">
              {chaosModes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`button quiet ${(session.chaosMode ?? 'manual') === m.id ? 'active' : ''}`}
                  onClick={() => {
                    if (!session.chaosEnabled) engine.setChaosEnabled(true);
                    engine.setChaosMode(m.id);
                  }}
                >
                  {isMin ? m.en : m.de}
                </button>
              ))}
            </div>
          </div>

          {session.customMacros && session.customMacros.length > 0 && (
            <div className="patch-node">
              <div className="patch-node-head">
                <div>
                  <span className="eyebrow">{isMin ? 'SCENE PATCHES' : 'SZENEN-PATCHES'}</span>
                  <strong>{isMin ? 'Custom Macros' : 'Szenen-Makros'}</strong>
                </div>
              </div>
              <div className="patch-macro-list">
                {session.customMacros.slice(0, 3).map((cm) => {
                  const pct = Math.round(cm.value * 100);
                  return (
                    <label key={cm.id} className="patch-macro-item">
                      <div className="patch-macro-meta">
                        <span>{getCustomMacroDisplayName(cm.name, edition)}</span>
                        <b>{pct}%</b>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={pct}
                        onChange={(e) => engine.setCustomMacro(cm.id, Number(e.target.value) / 100)}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* COLUMN 2: 8 Instrument Nodes */}
        <div className="patch-col patch-col-tracks">
          {session.layers.map((layer: JamLayer) => {
            const firing = activeLayerIds.has(layer.id);
            const presets = getInstrumentPresets(layer.role, layer.drumVoice);
            const activePreset = detectActiveInstrumentPreset(layer);
            const volPct = Math.round(layer.volume * 100);
            const densPct = Math.round((layer.settings?.density ?? 0.5) * 100);

            return (
              <div
                key={layer.id}
                className={`patch-node patch-track-node ${firing && !layer.muted ? 'firing' : ''} ${layer.muted ? 'muted' : ''} ${focusedLayerId === layer.id ? 'selected' : ''}`}
                style={{ '--node-color': layer.color } as React.CSSProperties}
                onMouseEnter={() => setFocusedLayerId(layer.id)}
                onMouseLeave={() => setFocusedLayerId(null)}
              >
                <div className="patch-track-top">
                  <div className="patch-track-id">
                    <span className="patch-jack-in" />
                    <span className={`patch-led ${firing && !layer.muted ? 'on' : ''}`} style={{ background: layer.color }} />
                    <div>
                      <strong>{layer.name}</strong>
                      <small>
                        {layer.role === 'drum'
                          ? getDrumModelDisplayName(layer.settings?.drumModel ?? layer.drumVoice, edition)
                          : getTimbreDisplayName(layer.settings?.timbre ?? 'warm', edition)}
                      </small>
                    </div>
                  </div>

                  <div className="patch-track-actions">
                    <button
                      type="button"
                      className="mini-dice-btn"
                      onClick={() => engine.randomizeInstrumentPreset(layer.id)}
                      title={isMin ? `Dice preset for ${layer.name}` : `Zufalls-Sound für ${layer.name}`}
                    >
                      <Dices size={12} />
                    </button>
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
                    <button
                      type="button"
                      className={`track-btn ${layer.locked ? 'active' : ''}`}
                      onClick={() => engine.updateLayer(layer.id, { locked: !layer.locked })}
                    >
                      <Lock size={10} />
                    </button>
                    <button
                      type="button"
                      className={`track-btn ${layer.frozen ? 'active' : ''}`}
                      onClick={() => engine.updateLayer(layer.id, { frozen: !layer.frozen })}
                    >
                      <Snowflake size={10} />
                    </button>
                    <span className="patch-jack-out" />
                  </div>
                </div>

                <div className="patch-track-controls">
                  <select
                    className="patch-preset-select"
                    value={activePreset?.id ?? ''}
                    aria-label={isMin ? `${layer.name} instrument` : `${layer.name} Instrument`}
                    onChange={(e) => {
                      if (e.target.value) engine.applyInstrumentPreset(layer.id, e.target.value);
                    }}
                  >
                    <option value="" disabled>
                      {isMin ? 'Preset…' : 'Instrument…'}
                    </option>
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {getInstrumentPresetDisplay(p, edition).name}
                      </option>
                    ))}
                  </select>

                  <label className="patch-mini-slider">
                    <span>Vol {volPct}%</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={volPct}
                      onChange={(e) => engine.updateLayer(layer.id, { volume: Number(e.target.value) / 100 })}
                    />
                  </label>
                  <label className="patch-mini-slider">
                    <span>Dens {densPct}%</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={densPct}
                      onChange={(e) => engine.setLayerSettings(layer.id, { density: Number(e.target.value) / 100 })}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {/* COLUMN 3: Master FX Nodes */}
        <div className="patch-col patch-col-fx">
          {/* EQ + Warmth */}
          <div className={`patch-node ${isBypassed('eq') && isBypassed('warmth') ? 'bypassed' : ''}`}>
            <div className="patch-node-head">
              <div className="patch-fx-title">
                <span className="patch-jack-in" />
                <div>
                  <span className="eyebrow">FX · 01</span>
                  <strong>{isMin ? MINIMAL_EFFECT_MODULES.eq : '3-Band EQ & Drive'}</strong>
                </div>
              </div>
              <button
                type="button"
                className={`button quiet ${!isBypassed('eq') ? 'active' : ''}`}
                onClick={() => engine.toggleEffectBypass('eq')}
              >
                {isBypassed('eq') ? 'Bypass' : 'Active'}
              </button>
            </div>
            <div className="patch-fx-sliders">
              <label>
                <span>Low {eqLow > 0 ? `+${eqLow.toFixed(1)}` : eqLow.toFixed(1)} dB</span>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={eqLow}
                  onChange={(e) => engine.setEq({ low: Number(e.target.value) })}
                />
              </label>
              <label>
                <span>Mid {eqMid > 0 ? `+${eqMid.toFixed(1)}` : eqMid.toFixed(1)} dB</span>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={eqMid}
                  onChange={(e) => engine.setEq({ mid: Number(e.target.value) })}
                />
              </label>
              <label>
                <span>High {eqHigh > 0 ? `+${eqHigh.toFixed(1)}` : eqHigh.toFixed(1)} dB</span>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={eqHigh}
                  onChange={(e) => engine.setEq({ high: Number(e.target.value) })}
                />
              </label>
              <label>
                <span>Drive {Math.round(masterDrive * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(masterDrive * 100)}
                  onChange={(e) =>
                    engine.updateSession({
                      effectsPatch: { ...session.effectsPatch, masterDrive: Number(e.target.value) / 100 },
                    })
                  }
                />
              </label>
            </div>
          </div>

          {/* Stereo Delay */}
          <div className={`patch-node ${isBypassed('delay') ? 'bypassed' : ''}`}>
            <div className="patch-node-head">
              <div className="patch-fx-title">
                <span className="patch-jack-in" />
                <div>
                  <span className="eyebrow">FX · 02</span>
                  <strong>{isMin ? MINIMAL_EFFECT_MODULES.delay : 'Stereo Delay'}</strong>
                </div>
              </div>
              <button
                type="button"
                className={`button quiet ${!isBypassed('delay') ? 'active' : ''}`}
                onClick={() => engine.toggleEffectBypass('delay')}
              >
                {isBypassed('delay') ? 'Bypass' : 'Active'}
              </button>
            </div>
            <div className="patch-fx-sliders">
              <label>
                <span>Mix {Math.round(delayMix * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(delayMix * 100)}
                  onChange={(e) =>
                    engine.updateSession({
                      effectsPatch: { ...session.effectsPatch, delayMix: Number(e.target.value) / 100 },
                    })
                  }
                />
              </label>
              <label>
                <span>Feedback {Math.round(delayFeedback * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={90}
                  value={Math.round(delayFeedback * 100)}
                  onChange={(e) =>
                    engine.updateSession({
                      effectsPatch: { ...session.effectsPatch, delayFeedback: Number(e.target.value) / 100 },
                    })
                  }
                />
              </label>
            </div>
          </div>

          {/* Hall Reverb */}
          <div className={`patch-node ${isBypassed('reverb') ? 'bypassed' : ''}`}>
            <div className="patch-node-head">
              <div className="patch-fx-title">
                <span className="patch-jack-in" />
                <div>
                  <span className="eyebrow">FX · 03</span>
                  <strong>{isMin ? MINIMAL_EFFECT_MODULES.reverb : 'Hall Reverb'}</strong>
                </div>
              </div>
              <button
                type="button"
                className={`button quiet ${!isBypassed('reverb') ? 'active' : ''}`}
                onClick={() => engine.toggleEffectBypass('reverb')}
              >
                {isBypassed('reverb') ? 'Bypass' : 'Active'}
              </button>
            </div>
            <div className="patch-fx-sliders">
              <label>
                <span>Mix {Math.round(reverbMix * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(reverbMix * 100)}
                  onChange={(e) =>
                    engine.updateSession({
                      effectsPatch: { ...session.effectsPatch, reverbMix: Number(e.target.value) / 100 },
                    })
                  }
                />
              </label>
              <label>
                <span>Size {Math.round(reverbSize * 100)}%</span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={Math.round(reverbSize * 100)}
                  onChange={(e) =>
                    engine.updateSession({
                      effectsPatch: { ...session.effectsPatch, reverbSize: Number(e.target.value) / 100 },
                    })
                  }
                />
              </label>
            </div>
          </div>

          {/* Sidechain Pump */}
          <div className={`patch-node ${isBypassed('pump') ? 'bypassed' : ''}`}>
            <div className="patch-node-head">
              <div className="patch-fx-title">
                <span className="patch-jack-in" />
                <div>
                  <span className="eyebrow">FX · 04</span>
                  <strong>{isMin ? MINIMAL_EFFECT_MODULES.pump : 'Sidechain Pump'}</strong>
                </div>
              </div>
              <button
                type="button"
                className={`button quiet ${!isBypassed('pump') ? 'active' : ''}`}
                onClick={() => engine.toggleEffectBypass('pump')}
              >
                {isBypassed('pump') ? 'Bypass' : 'Active'}
              </button>
            </div>
            <div className="patch-fx-sliders">
              <label>
                <span>{isMin ? 'Duck Depth' : 'Pump-Tiefe'} {Math.round(pumpAmt * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(pumpAmt * 100)}
                  onChange={(e) => engine.updateSession({ pump: Number(e.target.value) / 100 })}
                />
              </label>
            </div>
          </div>

          {/* Atmosphere Bed */}
          <div className="patch-node">
            <div className="patch-node-head">
              <div className="patch-fx-title">
                <span className="patch-jack-in" />
                <div>
                  <span className="eyebrow">ATMOS</span>
                  <strong>
                    {isMin
                      ? `Background: ${MINIMAL_ATMOSPHERE_LABELS[atmo.kind] ?? atmo.kind}`
                      : `Atmosphäre: ${atmo.kind}`}
                  </strong>
                </div>
              </div>
              <Activity size={14} className="patch-atmo-icon" />
            </div>
            <div className="patch-fx-sliders">
              <label>
                <span>Level {Math.round((atmo.level ?? 0) * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((atmo.level ?? 0) * 100)}
                  onChange={(e) =>
                    engine.updateSession({
                      atmosphere: { ...atmo, level: Number(e.target.value) / 100 },
                    })
                  }
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
