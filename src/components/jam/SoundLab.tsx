import { useEffect, useRef, useState } from 'react';
import { Pin, PinOff, RotateCcw, SlidersHorizontal, Plus, Trash2 } from 'lucide-react';
import { JamEngine, ambientPatch, drumPatch, effectiveEffects } from '../../engine/jam/JamEngine';
import { AUDIO_PATCH_RANGES, drumPatchRanges, EFFECT_PATCH_RANGES, OSC_WAVES } from '../../engine/jam/sound';
import type { AmbientSynthParams, DrumVoiceParams, EffectsParams, ModulationRoute } from '../../types';
import type { JamLayer, JamSession, LayerSettings } from '../../types/jam';

const engine = JamEngine.getInstance();
type AudioKey = Exclude<keyof AmbientSynthParams, 'rootNote' | 'scale'>;
type WaveKey = 'osc1Wave' | 'osc2Wave' | 'osc3Wave';
type NumericAudioKey = Exclude<AudioKey, WaveKey>;
interface Spec { key: string; label: string; unit?: string; step?: number; logarithmic?: boolean; percent?: boolean }
const AUDIO_SPECS: (Spec & { key: AudioKey })[] = [
  { key: 'osc1Wave', label: 'Oszillator 1' }, { key: 'osc2Wave', label: 'Oszillator 2' }, { key: 'osc3Wave', label: 'Oszillator 3' },
  { key: 'detuneSpread', label: 'Verstimmung', unit: 'ct', step: .5 }, { key: 'subLevel', label: 'Sub-Oszillator', percent: true },
  { key: 'filterCutoff', label: 'Filter Cutoff', unit: 'Hz', step: 1, logarithmic: true },
  { key: 'filterResonance', label: 'Filterresonanz Q', step: .1 }, { key: 'filterEnvAmount', label: 'Filterhüllkurve', percent: true },
  { key: 'attack', label: 'Attack', unit: 's', step: .005, logarithmic: true },
  { key: 'decay', label: 'Decay', unit: 's', step: .01, logarithmic: true },
  { key: 'sustain', label: 'Sustain', percent: true }, { key: 'release', label: 'Release', unit: 's', step: .01, logarithmic: true },
  { key: 'lfoRate', label: 'LFO-Rate', unit: 'Hz', step: .01 }, { key: 'lfoDepth', label: 'LFO-Tiefe', percent: true },
  { key: 'driftAmount', label: 'Drift', percent: true }, { key: 'voiceSpread', label: 'Stereobreite', percent: true },
  { key: 'volume', label: 'Synth-Pegel', percent: true },
];
const DRUM_SPECS: (Spec & { key: keyof DrumVoiceParams })[] = [
  { key: 'pitch', label: 'Tonhöhenwert', step: 1 }, { key: 'decay', label: 'Decay', unit: 's', step: .01 },
  { key: 'tone', label: 'Klanghelligkeit', percent: true }, { key: 'drive', label: 'Drive', percent: true },
  { key: 'volume', label: 'Drum-Pegel', percent: true }, { key: 'pan', label: 'Panorama', percent: true },
  { key: 'midiNote', label: 'MIDI-Notennummer', step: 1 },
];
const EFFECT_SPECS: (Spec & { key: keyof EffectsParams })[] = [
  { key: 'delayTime', label: 'Delay-Zeit', unit: 's', step: .01 },
  { key: 'delayFeedback', label: 'Delay Feedback', percent: true }, { key: 'delayMix', label: 'Delay Mix', percent: true },
  { key: 'delayFlutter', label: 'Tape Flutter', percent: true }, { key: 'reverbSize', label: 'Raumgröße', percent: true },
  { key: 'reverbDecay', label: 'Reverb Decay', unit: 's', step: .1 }, { key: 'reverbMix', label: 'Reverb Mix', percent: true },
  { key: 'masterDrive', label: 'Master Drive', percent: true },
  { key: 'reverbDamping', label: 'Reverb Dämpfung (dunkel)', percent: true }, { key: 'delayTone', label: 'Delay Klang (offen)', percent: true },
];
interface Control {
  id: string; context: string; spec: Spec; value: number | string; bounds?: readonly [number, number];
  options?: readonly string[]; overridden: boolean; update: (value: number | string) => void; reset: () => void;
}
const has = (value: object | undefined, key: string) => !!value && Object.prototype.hasOwnProperty.call(value, key);

function setAudio(layerId: string, key: AudioKey, value?: number | string): void {
  const layer = engine.getState().layers.find(item => item.id === layerId); if (!layer) return;
  const audioPatch = { ...layer.settings.audioPatch };
  if (value === undefined) delete audioPatch[key];
  else Object.assign(audioPatch, { [key]: value });
  engine.setLayerSettings(layerId, { audioPatch });
}
function setDrum(layerId: string, key: keyof DrumVoiceParams, value?: number | string): void {
  const layer = engine.getState().layers.find(item => item.id === layerId); if (!layer) return;
  const patch = { ...layer.settings.drumPatch };
  if (value === undefined) delete patch[key]; else Object.assign(patch, { [key]: value });
  engine.setLayerSettings(layerId, { drumPatch: patch });
}
function setEffect(key: keyof EffectsParams, value?: number | string): void {
  const effectsPatch = { ...engine.getState().effectsPatch };
  if (value === undefined) delete effectsPatch[key]; else Object.assign(effectsPatch, { [key]: value });
  engine.updateSession({ effectsPatch });
}
function registry(session: JamSession): Control[] {
  const controls: Control[] = [];
  const beat = engine.getPosition().beat;
  for (const layer of session.layers) {
    if (layer.role === 'drum') {
      const patch = drumPatch(layer.drumVoice || 'perc', session, layer);
      const ranges = drumPatchRanges(layer.drumVoice || 'perc');
      for (const spec of DRUM_SPECS) {
        controls.push({ id: `drum:${layer.id}:${spec.key}`, context: layer.name, spec,
          value: patch[spec.key], bounds: ranges[spec.key], overridden: has(layer.settings.drumPatch, spec.key),
          update: value => setDrum(layer.id, spec.key, value), reset: () => setDrum(layer.id, spec.key) });
      }
    } else {
      const patch = ambientPatch(layer, session, beat);
      for (const spec of AUDIO_SPECS) {
        const wave = spec.key === 'osc1Wave' || spec.key === 'osc2Wave' || spec.key === 'osc3Wave';
        controls.push({ id: `sound:${layer.id}:${spec.key}`, context: layer.name, spec,
          value: patch[spec.key], options: wave ? OSC_WAVES : undefined,
          bounds: wave ? undefined : AUDIO_PATCH_RANGES[spec.key as NumericAudioKey], overridden: has(layer.settings.audioPatch, spec.key),
          update: value => setAudio(layer.id, spec.key, value), reset: () => setAudio(layer.id, spec.key) });
      }
    }
  }
  const effects = effectiveEffects(session);
  for (const spec of EFFECT_SPECS) controls.push({ id: `fx:${spec.key}`, context: 'Effekte', spec,
    value: effects[spec.key] ?? 0, bounds: EFFECT_PATCH_RANGES[spec.key], overridden: has(session.effectsPatch, spec.key),
    update: value => setEffect(spec.key, value), reset: () => setEffect(spec.key) });
  return controls;
}
function togglePin(id: string): void {
  const pins = engine.getState().pinnedParams || [];
  engine.updateSession({ pinnedParams: pins.includes(id) ? pins.filter(value => value !== id) : [...pins, id] });
}
const cleanNumber = (value: number, step: number) => Number(value.toFixed(step < .01 ? 3 : step < 1 ? 2 : 0));
const waveName = (value: string) => ({ sine: 'Sinus', triangle: 'Dreieck', sawtooth: 'Sägezahn', square: 'Rechteck' } as Record<string, string>)[value] || value;

function SoundControl({ control, pinned, compact = false, pinLimit = false }: { control: Control; pinned: boolean; compact?: boolean; pinLimit?: boolean }) {
  const { spec } = control;
  const field = control.id.replace(/:/g, '-');
  const value = typeof control.value === 'number' && Number.isFinite(control.value) ? control.value : 0;
  const [min, max] = control.bounds || [0, 1];
  const step = spec.step || .01;
  const scale = spec.percent ? 100 : 1;
  const logarithmic = !!spec.logarithmic && min > 0;
  const sliderValue = logarithmic ? Math.log(Math.max(min, value) / min) / Math.log(max / min) : value;
  const formatted = cleanNumber(value * scale, step * scale) + (spec.percent ? '%' : spec.unit ? ` ${spec.unit}` : '');
  const shownNumber = String(cleanNumber(value * scale, step * scale));
  const [draft, setDraft] = useState(shownNumber);
  const numberFocused = useRef(false), draftChanged = useRef(false);
  useEffect(() => { if (!numberFocused.current) setDraft(shownNumber); }, [shownNumber]);
  const commitNumber = () => {
    numberFocused.current = false;
    if (!draftChanged.current) { setDraft(shownNumber); return; }
    draftChanged.current = false;
    const next = draft.trim() ? Number(draft) / scale : NaN;
    if (!Number.isFinite(next)) { setDraft(shownNumber); return; }
    const bounded = Math.max(min, Math.min(max, next));
    control.update(bounded); setDraft(String(cleanNumber(bounded * scale, step * scale)));
  };
  return <div className={'sound-control' + (compact ? ' sound-control-compact' : '')}>
    <div className="sound-control-heading"><label htmlFor={field + '-value'}>{compact ? control.context + ' · ' : ''}{spec.label}</label><div>
      {control.overridden && <button type="button" className="icon-button sound-reset" title="Szenenwert und Makrosteuerung wiederherstellen" aria-label={`${control.context} ${spec.label}: Szenenwert wiederherstellen`} onClick={control.reset}><RotateCcw /></button>}
      <button type="button" className={'icon-button sound-pin' + (pinned ? ' active' : '')} aria-label={`${control.context} ${spec.label} ${pinned ? 'von der Jam-Seite lösen' : 'auf der Jam-Seite anheften'}`} aria-pressed={pinned} disabled={!pinned && pinLimit} title={!pinned && pinLimit ? 'Maximal 64 angeheftete Klangregler. Löse zuerst einen anderen Pin.' : undefined} onClick={() => togglePin(control.id)}>{pinned ? <PinOff /> : <Pin />}</button>
    </div></div>
    {control.options ? <select id={field + '-value'} value={String(control.value)} onChange={e => control.update(e.target.value)}>{control.options.map(option => <option key={option} value={option}>{waveName(option)}</option>)}</select> : <div className="sound-control-input">
      <input type="range" aria-label={`${control.context} ${spec.label}`} aria-valuetext={formatted}
        min={logarithmic ? 0 : min} max={logarithmic ? 1 : max} step={logarithmic ? .002 : step} value={sliderValue}
        onChange={e => control.update(logarithmic ? min * Math.pow(max / min, Number(e.target.value)) : Number(e.target.value))} />
      <input id={field + '-value'} className="sound-number" type="number" aria-label={`${control.context} ${spec.label} Zahlenwert${spec.percent ? ' in Prozent' : spec.unit ? ' in ' + spec.unit : ''}`}
        min={min * scale} max={max * scale} step={step * scale} value={draft}
        onFocus={() => { numberFocused.current = true; }}
        onChange={e => { draftChanged.current = true; setDraft(e.target.value); }} onBlur={commitNumber}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitNumber(); e.currentTarget.blur(); } else if (e.key === 'Escape') { e.preventDefault(); draftChanged.current = false; setDraft(shownNumber); e.currentTarget.blur(); } }} />
      {spec.percent || spec.unit ? <span className="sound-unit" aria-hidden="true">{spec.percent ? '%' : spec.unit}</span> : null}
    </div>}
    {!compact && <span className="sound-origin">{control.overridden ? 'Dein Basiswert' : 'Szene / Makro'}</span>}
  </div>;
}

const SOURCES: [ModulationRoute['source'], string][] = [['drumDensity', 'Drumdichte'], ['rhythmicAccent', 'Rhythmische Akzente'], ['ambientBrightness', 'Klanghelligkeit'], ['globalChaos', 'Bewegung']];
const DESTINATIONS: [ModulationRoute['destination'], string][] = [['ambientCutoff', 'Filter Cutoff'], ['delayFeedback', 'Delay Feedback'], ['reverbMix', 'Reverb Mix'], ['drumProbability', 'Drumwahrscheinlichkeit'], ['accentLikelihood', 'Akzentstärke']];
function routeChange(id: string, patch: Partial<ModulationRoute>): void {
  engine.updateSession({ modRoutes: (engine.getState().modRoutes || []).map(route => route.id === id ? { ...route, ...patch } : route) });
}
function ModulationControls({ session }: { session: JamSession }) {
  const routes = session.modRoutes || [];
  return <details className="sound-section"><summary>Modulation<span className="helper">{routes.length} Verbindungen</span></summary><div className="sound-section-content">
    <p className="helper">Verbinde die tatsächliche Aktivität des Jams mit Klang und Rhythmus. Positive und negative Tiefe erlauben gegenläufige Bewegung.</p>
    <div className="sound-routes">{routes.map((route, index) => <div className="sound-route" key={route.id}>
      <label className="sound-route-enabled"><input type="checkbox" checked={route.enabled} onChange={e => routeChange(route.id, { enabled: e.target.checked })} />Route {index + 1}</label>
      <label>Quelle<select value={route.source} onChange={e => routeChange(route.id, { source: e.target.value as ModulationRoute['source'] })}>{SOURCES.map(([value, name]) => <option value={value} key={value}>{name}</option>)}</select></label>
      <label>Ziel<select value={route.destination} onChange={e => routeChange(route.id, { destination: e.target.value as ModulationRoute['destination'] })}>{DESTINATIONS.map(([value, name]) => <option value={value} key={value}>{name}</option>)}</select></label>
      <label>Tiefe<input type="range" min={-1} max={1} step={.01} value={route.depth} aria-label={`Route ${index + 1} Tiefe`} aria-valuetext={Math.round(route.depth * 100) + '%'} onChange={e => routeChange(route.id, { depth: Number(e.target.value) })} /><output>{Math.round(route.depth * 100)}%</output></label>
      <button className="icon-button" aria-label={`Modulationsroute ${index + 1} löschen`} onClick={() => engine.updateSession({ modRoutes: (engine.getState().modRoutes || []).filter(item => item.id !== route.id) })}><Trash2 /></button>
    </div>)}</div>
    <button className="button" disabled={routes.length >= 16} onClick={() => engine.updateSession({ modRoutes: [...(engine.getState().modRoutes || []), { id: 'route-' + crypto.randomUUID(), source: 'drumDensity', destination: 'ambientCutoff', depth: .2, enabled: true }] })}><Plus /> Verbindung hinzufügen</button>
  </div></details>;
}

function resetLayer(layer: JamLayer): void {
  const patch: Partial<LayerSettings> = layer.role === 'drum' ? { drumPatch: {} } : { audioPatch: {} };
  engine.setLayerSettings(layer.id, patch);
}

/** Complete native synthesis controls, disclosed on demand rather than crowding the Jam. */
export function SoundLab({ session }: { session: JamSession }) {
  const controls = registry(session);
  const pins = session.pinnedParams || [];
  return <><SoundStyles /><details className="layer-detail sound-lab"><summary><SlidersHorizontal /><strong>Klanglabor</strong><span className="helper">Synthese, Drums, Effekte und Modulation</span></summary><div className="sound-lab-content">
    <p className="helper">Hier gestaltest du die internen Klänge. Eigene Basiswerte ersetzen die entsprechende Makrosteuerung, bis du sie zurücksetzt. Modulationsrouten können diese Werte weiterhin bewegen. Der Pin holt einzelne Regler auf deine Jam-Seite. Neue Wellenformen und Hüllkurven hörst du an den nachfolgenden Noten. Die MIDI-Notennummer der Drums verändert auch die externe Zuordnung.</p>
    {session.layers.map(layer => <details className="sound-section" key={layer.id}><summary><span className="layer-color" style={{ background: layer.color }} /><strong>{layer.name}</strong><span className="helper">{layer.role === 'drum' ? 'Drumstimme' : 'Synthesizer'}</span></summary><div className="sound-section-content">{layer.role === 'drone' && <div className="sound-algorithm"><label htmlFor={'texture-algorithm-' + layer.id}>Texture-Generator<select id={'texture-algorithm-' + layer.id} value={layer.settings.ambientAlgorithm || 'harmonicDrone'} onChange={e => engine.setLayerSettings(layer.id, { ambientAlgorithm: e.target.value as LayerSettings['ambientAlgorithm'] })}><option value="harmonicDrone">Harmonic Drone · lange Liegetöne</option><option value="granularDrift">Notenwolke · Granular Drift</option></select></label><p className="helper">Die Notenwolke verteilt kurze Tonereignisse im gewählten Register. Sie arbeitet mit MIDI-Noten und Synthesizerstimmen.</p></div>}<div className="sound-controls">{controls.filter(control => control.id.startsWith(`${layer.role === 'drum' ? 'drum' : 'sound'}:${layer.id}:`)).map(control => <SoundControl key={control.id} control={control} pinned={pins.includes(control.id)} pinLimit={pins.length >= 64} />)}</div><button className="button" onClick={() => resetLayer(layer)}><RotateCcw /> Eigene Klangwerte zurücksetzen</button></div></details>)}
    <details className="sound-section"><summary><strong>Effekte</strong><span className="helper">Delay, Reverb und Master</span></summary><div className="sound-section-content"><div className="sound-controls">{controls.filter(control => control.id.startsWith('fx:')).map(control => <SoundControl key={control.id} control={control} pinned={pins.includes(control.id)} pinLimit={pins.length >= 64} />)}</div><button className="button" onClick={() => engine.updateSession({ effectsPatch: {} })}><RotateCcw /> Eigene Effektwerte zurücksetzen</button></div></details>
    <ModulationControls session={session} />
  </div></details></>;
}

/** Only registry-verified parameter IDs can produce controls on the main screen. */
export function PinnedParameters({ session }: { session: JamSession }) {
  const pins = session.pinnedParams || [];
  const controls = registry(session).filter(control => pins.includes(control.id));
  if (!controls.length) return null;
  return <><SoundStyles /><section className="pinned-sound-strip" aria-label="Deine angehefteten Klangregler"><header><Pin /><h2>Deine Regler.</h2><span className="helper">Aus dem Klanglabor</span></header><div className="sound-controls">{controls.map(control => <SoundControl key={control.id} control={control} pinned compact pinLimit={pins.length >= 64} />)}</div></section></>;
}

function SoundStyles() {
  return <style>{`
.sound-lab>summary{gap:12px;flex-wrap:wrap}.sound-lab>summary>svg{width:18px;height:18px;color:var(--amber)}.sound-lab-content{padding:0 22px 22px}.sound-lab-content>.helper{margin:2px 0 18px;max-width:850px}.sound-section{border-top:1px solid var(--line)}.sound-section>summary{display:flex;align-items:center;gap:12px;padding:17px 0;cursor:pointer;list-style:none;font-size:15px}.sound-section>summary::after{content:'+';margin-left:auto;font-size:19px;color:var(--muted)}.sound-section[open]>summary::after{content:'−'}.sound-section-content{padding:0 0 22px}.sound-algorithm{display:flex;align-items:center;gap:20px;flex-wrap:wrap;margin-bottom:20px}.sound-algorithm>label{display:flex;flex-direction:column;gap:6px;font-size:14px;min-width:240px}.sound-algorithm>p{max-width:450px}.sound-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px 26px;margin-bottom:22px}.sound-control{min-width:0}.sound-control-heading{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:5px}.sound-control-heading>label{font-size:13px;font-weight:500;color:var(--text)}.sound-control-heading>div{display:flex;align-items:center}.sound-control-heading .icon-button{width:44px;height:44px}.sound-control-heading .icon-button svg{width:17px;height:17px}.sound-pin.active{color:var(--amber)}.sound-control-input{display:flex;align-items:center;gap:8px}.sound-control-input input[type=range]{min-width:40px}.sound-control .sound-number{width:76px;flex:0 0 76px;padding:5px 7px;font-size:13px}.sound-unit{font-size:13px;color:var(--muted);min-width:13px}.sound-control select{width:100%;min-height:35px}.sound-origin{display:block;color:var(--muted);font-size:13px;margin-top:3px}.sound-routes{margin:18px 0;display:grid;gap:16px}.sound-route{display:grid;grid-template-columns:105px 1fr 1fr 150px 32px;align-items:center;gap:14px;border-bottom:1px solid var(--line);padding-bottom:15px}.sound-route>label{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--muted)}.sound-route .sound-route-enabled{flex-direction:row;align-items:center;color:var(--text)}.sound-route output{font-family:var(--mono);font-size:13px}.pinned-sound-strip{padding:20px 0;border-bottom:1px solid var(--line);margin-bottom:24px}.pinned-sound-strip>header{display:flex;align-items:center;gap:9px;margin-bottom:14px}.pinned-sound-strip>header svg{width:15px;height:15px;color:var(--amber)}.pinned-sound-strip h2{font-size:17px;font-weight:500}.pinned-sound-strip .sound-controls{margin-bottom:0}.sound-control-compact .sound-control-heading>label{font-size:13px}@media(max-width:1050px){.sound-controls{grid-template-columns:repeat(2,minmax(0,1fr))}.sound-route{grid-template-columns:1fr 1fr}.sound-route>button{justify-self:end}.sound-route-enabled{grid-column:1/-1}}@media(max-width:560px){.sound-lab-content{padding:0 16px 16px}.sound-controls{grid-template-columns:1fr;gap:17px}.sound-section>summary{flex-wrap:wrap}.sound-section>summary>.helper{font-size:13px}.pinned-sound-strip>header{flex-wrap:wrap}.sound-route{grid-template-columns:1fr}.sound-route-enabled{grid-column:auto}}`}</style>;
}
