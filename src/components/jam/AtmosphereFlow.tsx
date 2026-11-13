import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { JamEngine } from '../../engine/jam/JamEngine';
import { ATMOSPHERE_LABELS, ATMOSPHERE_SOURCES } from '../../engine/audio/atmosphere';
import { useUiEdition } from '../../contexts/UiEditionContext';
import { MINIMAL_ATMOSPHERE_DESC, MINIMAL_ATMOSPHERE_LABELS } from '../../engine/jam/minimalCatalog';
import { ATMOSPHERE_KINDS, type AtmosphereSettings, type FlowSettings, type JamSession } from '../../types/jam';

const engine = JamEngine.getInstance();
const OFF: AtmosphereSettings = { kind: 'off', level: 0.08, tone: 0.5, movement: 0.4 };
const FLOW_OFF: FlowSettings = { enabled: false, bars: 16, depth: 0.5 };
const MAX_SAMPLE_BYTES = 60_000_000;
const describe = (kind: AtmosphereSettings['kind'], isMinimal: boolean) => {
  if (isMinimal) {
    if (kind === 'off') return 'No background layer.';
    if (kind === 'sample') return 'Local audio loop (stays on your device).';
    return MINIMAL_ATMOSPHERE_DESC[kind];
  }
  return kind === 'off' ? 'Kein Hintergrund.' : kind === 'sample' ? 'Dein eigener Loop. Die Datei bleibt auf deinem Rechner und wird nicht gespeichert.' : ATMOSPHERE_SOURCES[kind].description;
};

function Slider({ label, value, onChange, hint, max = 1, step = 0.01 }: { label: string; value: number; onChange: (n: number) => void; hint?: string; max?: number; step?: number }) {
  return <label className="atmo-slider"><span>{label}<output>{Math.round(value * 100)}%</output></span>
    <input type="range" min={0} max={max} step={step} value={value} aria-valuetext={Math.round(value * 100) + '%'} onChange={e => onChange(Number(e.target.value))} />{hint && <small>{hint}</small>}</label>;
}

/** Background texture, kick-breathing and slow automatic transitions. Everything here is a real engine control. */
export function AtmosphereFlow({ session }: { session: JamSession }) {
  const uiEdition = useUiEdition();
  const isMinimal = uiEdition === 'minimal';
  const atmosphere = session.atmosphere ?? OFF; const flow = session.flow ?? FLOW_OFF;
  const file = useRef<HTMLInputElement>(null); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const maxAtmoLevel = 0.10;
  const setAtmosphere = (patch: Partial<AtmosphereSettings>) => engine.updateSession({ atmosphere: { ...atmosphere, ...patch } });
  const setFlow = (patch: Partial<FlowSettings>) => engine.updateSession({ flow: { ...flow, ...patch } });
  const chooseKind = (kind: AtmosphereSettings['kind']) => {
    if (kind === 'sample' && !engine.getAtmosphereSampleName()) { file.current?.click(); return; }
    const cap = 0.10;
    setAtmosphere({ kind, level: atmosphere.kind === 'off' && atmosphere.level < 0.03 ? 0.06 : Math.min(cap, atmosphere.level) });
  };
  const loadSample = async (picked?: File) => {
    if (!picked) return; setMessage('');
    if (picked.size > MAX_SAMPLE_BYTES) {
      setMessage(isMinimal ? 'File exceeds 60 MB. Choose a shorter loop.' : 'Die Datei ist größer als 60 MB. Nimm einen kürzeren Loop.');
      return;
    }
    setBusy(true);
    try { await engine.loadAtmosphereSample(await picked.arrayBuffer(), picked.name); setMessage((isMinimal ? 'Loaded: ' : 'Geladen: ') + picked.name); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const sampleMissing = atmosphere.kind === 'sample' && !engine.getAtmosphereSampleName();
  return <section className="atmo-panel" aria-label={isMinimal ? 'Atmosphere, Pump and Flow' : 'Atmosphäre, Atmung und Fluss'}>
    <div className="atmo-block">
      <header>
        <span className="eyebrow">{isMinimal ? 'ATMOSPHERE' : 'ATMOSPHÄRE'}</span>
        <h2>{isMinimal ? 'Background Texture' : 'Ein Boden unter allem.'}</h2>
      </header>
      <label className="atmo-select">{isMinimal ? 'Texture' : 'Textur'}
        <select value={atmosphere.kind} onChange={e => chooseKind(e.target.value as AtmosphereSettings['kind'])}>
          {ATMOSPHERE_KINDS.map(kind => (
            <option key={kind} value={kind}>
              {isMinimal ? MINIMAL_ATMOSPHERE_LABELS[kind] : ATMOSPHERE_LABELS[kind]}
            </option>
          ))}
        </select>
      </label>
      <p className="helper">{describe(atmosphere.kind, isMinimal)}</p>
      {atmosphere.kind !== 'off' && <>
        <Slider
          label={isMinimal ? 'Level (max 10%)' : 'Pegel (max. 10%)'}
          value={Math.min(maxAtmoLevel, atmosphere.level)}
          max={maxAtmoLevel}
          step={0.005}
          hint={isMinimal ? undefined : 'Strikter 10%-Filter: dezentes Hintergrund-Bett, kein dominantes Rauschen.'}
          onChange={level => setAtmosphere({ level: Math.min(maxAtmoLevel, level) })}
        />
        <Slider label={isMinimal ? 'Tone (Dark – Bright)' : 'Klang (dunkel bis offen)'} value={atmosphere.tone} onChange={tone => setAtmosphere({ tone })} />
        <Slider label={isMinimal ? 'Movement' : 'Bewegung'} value={atmosphere.movement} onChange={movement => setAtmosphere({ movement })} />
      </>}
      <div className="atmo-sample">
        <button type="button" className="button" disabled={busy} onClick={() => file.current?.click()}>
          <Upload /> {busy ? (isMinimal ? 'Loading…' : 'Lädt …') : (isMinimal ? 'Load Custom Sample' : 'Eigenes Sample laden')}
        </button>
        <span className="helper" role="status">
          {sampleMissing
            ? (isMinimal ? 'Sample needs re-selecting after reload.' : 'Das Sample ist nach dem Neuladen nicht mehr da. Bitte erneut wählen.')
            : message || (atmosphere.sampleName
              ? (isMinimal ? 'Active: ' : 'Aktuell: ') + atmosphere.sampleName
              : (isMinimal ? 'WAV, MP3, OGG or M4A loop.' : 'WAV, MP3, OGG oder M4A. Läuft als Loop, mit Hall und Delay.'))}
        </span>
      </div>
      <input ref={file} className="file-input" type="file" accept="audio/*" onChange={e => { void loadSample(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
    <div className="atmo-block">
      <header>
        <span className="eyebrow">{isMinimal ? 'SIDECHAIN PUMP' : 'ATMUNG'}</span>
        <h2>{isMinimal ? 'Kick Ducking' : 'Lässt Pads auf den Kick antworten.'}</h2>
      </header>
      <Slider
        label={isMinimal ? 'Pump Depth' : 'Kick-Atmung'}
        value={session.pump ?? 0}
        onChange={pump => engine.updateSession({ pump })}
        hint={isMinimal ? undefined : 'Pads und Atmosphäre geben bei jedem Kick kurz nach und schwellen wieder an. Dezent bei 10 bis 30 %.'}
      />
    </div>
    <div className="atmo-block">
      <header>
        <span className="eyebrow">{isMinimal ? 'FLOW' : 'FLUSS'}</span>
        <h2>{isMinimal ? 'Autonomous Transitions' : 'Sanfte Übergänge von allein.'}</h2>
      </header>
      <label className="atmo-check">
        <input type="checkbox" checked={flow.enabled} onChange={e => setFlow({ enabled: e.target.checked })} />
        {isMinimal ? 'Flow active' : 'Fluss aktiv'}
      </label>
      <label className="atmo-select">
        {isMinimal ? 'Interval' : 'Alle'}
        <select value={flow.bars} onChange={e => setFlow({ bars: Number(e.target.value) })}>
          {[4, 8, 16, 32].map(n => <option key={n} value={n}>{n} {isMinimal ? 'Bars' : 'Takte'}</option>)}
        </select>
      </label>
      <Slider label={isMinimal ? 'Depth' : 'Tiefe'} value={flow.depth} onChange={depth => setFlow({ depth })} />
      {!isMinimal && (
        <p className="helper">Alle paar Takte kommt eine ruhige Veränderung: der Raum öffnet sich, der Klang dunkelt ab, die Drums treten zurück und kehren wieder. Tonart und Tempo bleiben stehen. Deine eigenen Reglerbewegungen bleiben erhalten.</p>
      )}
    </div>
  </section>;
}
