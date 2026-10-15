import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, Download, Upload, Radio, SlidersHorizontal, Circle, ArrowUpRight, LockKeyhole, Snowflake, Volume2, Pin, X, Music2, Save, Trash2, Headphones, Compass, Activity, Disc, Waves, Cpu, Cloud, Sparkles } from 'lucide-react';
import { JamEngine } from './engine/jam/JamEngine';
import { SCENES } from './engine/jam/scenes';
import { clipToMidi, midiToClip } from './engine/jam/clipMidi';
import { downloadBytes, exportJson, loadLibrary, loadSavedSession, persistSession, saveLibrary, validateClip } from './engine/jam/storage';
import { PianoRoll, noteName } from './components/jam/PianoRoll';
import { ClipEditor } from './components/jam/ClipEditor';
import { SoundLab, PinnedParameters } from './components/jam/SoundLab';
import { AtmosphereFlow } from './components/jam/AtmosphereFlow';
import { SoundscapeDeck, SequencerDeck, RhythmPoolDeck } from './components/jam/ArrangementHub';
import { WorkspaceBar, type ViewDensityMode } from './components/jam/WorkspaceBar';
import { EqualizerDeck } from './components/jam/EqualizerDeck';
import { DistanceStageHUD } from './components/jam/DistanceStageHUD';
import { CustomMacroDeck } from './components/jam/CustomMacroDeck';
import { EffectChainDeck } from './components/jam/EffectChainDeck';
import { ChaosModulatorDeck } from './components/jam/ChaosModulatorDeck';
import { EssentialMasterBar } from './components/jam/EssentialMasterBar';
import { PresetsSettingsModal } from './components/jam/PresetsSettingsModal';
import { QuickMixerDeck, MiniMixerPreview } from './components/jam/QuickMixerDeck';
import { PluginRackUnit } from './components/jam/PluginRackUnit';
import {
  MiniChaosPreview,
  MiniEqPreview,
  MiniSoundscapePreview,
  MiniSequencerPreview,
  MiniRhythmPoolPreview,
  MiniFxChainPreview,
  MiniCustomMacroPreview,
  MiniAtmospherePreview,
  MiniScorePreview,
} from './components/jam/PluginMiniViews';
import { findParamOption } from './engine/jam/customMacros';
import { TIMBRES, type JamLayer, type JamSession, type MacroName, type MidiClip } from './types/jam';
import type { MusicalScale } from './types';
import type { RecorderState } from './engine/audio/recorder';

const engine = JamEngine.getInstance();
const hot = (import.meta as ImportMeta & {hot?: {dispose: (callback: () => void) => void}}).hot;
hot?.dispose(() => engine.panic());
const MACROS: { id: MacroName; name: string; text: string }[] = [
  { id: 'movement', name: 'Bewegung', text: 'Wie weit Motive und Voicings wandern.' },
  { id: 'density', name: 'Dichte', text: 'Mehr Noten, ohne den Raum zu verlieren.' },
  { id: 'warmth', name: 'Wärme', text: 'Klangfarbe des internen Instruments.' },
  { id: 'space', name: 'Raum', text: 'Weite, Delay und Nachklang.' },
];
const SCALES: [MusicalScale, string][] = [['dorian','Dorian'], ['aeolian','Natural Minor'], ['lydian','Lydian'], ['phrygian','Phrygian'], ['majorPentatonic','Major Pentatonic'], ['minorPentatonic','Minor Pentatonic'], ['hirajoshi','Hirajoshi']];
const pitch = (n: number) => noteName(n).replace(/-?\d+$/, '');
const fileName = (s: string) => s.replace(/[^a-z0-9-]/gi, '-');

export default function App() {
  const [session, setSession] = useState<JamSession>(() => engine.getState());
  const [position, setPosition] = useState(() => engine.getPosition());
  const [events, setEvents] = useState(() => engine.getRecentEvents(32));
  const [tab, setTab] = useState<'jam' | 'library' | 'details'>('jam');
  const [library, setLibrary] = useState<MidiClip[]>(loadLibrary);
  const [editor, setEditor] = useState<MidiClip | null>(null);
  const captureBars = 8;
  const [drums, setDrums] = useState(false);
  const [focusTrack, setFocusTrack] = useState('');
  const [routing, setRouting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [outputs, setOutputs] = useState(() => engine.midi.getAvailableOutputs());
  const [outputId, setOutputId] = useState(engine.midi.getSelectedOutputId() || '');
  const [midiStatus, setMidiStatus] = useState(engine.midi.getStatus());
  const [recording, setRecording] = useState<RecorderState>(() => engine.recorder.getState());
  const [viewMode, setViewMode] = useState<ViewDensityMode>('compact');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    mixer: false,
    chaos: false,
    eq: false,
    score: false,
    soundscape: true,
    sequencer: true,
    rhythms: true,
    fxchain: true,
    custommacros: true,
    atmosphere: true,
  });

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const allCollapsed = useMemo(() => Object.values(collapsed).every(Boolean), [collapsed]);
  const expandAll = useCallback(() => {
    setCollapsed(prev => {
      const next = { ...prev };
      for (const k in next) next[k] = false;
      return next;
    });
  }, []);
  const collapseAll = useCallback(() => {
    setCollapsed(prev => {
      const next = { ...prev };
      for (const k in next) next[k] = true;
      return next;
    });
  }, []);

  const midiInput = useRef<HTMLInputElement>(null), sessionInput = useRef<HTMLInputElement>(null);
  const restored = useRef(false);
  const message = useCallback((value: string) => setToast(value), []);
  const act = useCallback(async (action: () => unknown | Promise<unknown>) => { try { return await action(); } catch (e) { message(e instanceof Error ? e.message : String(e)); return undefined; } }, [message]);
  const stopPreview = useCallback(() => engine.stopPreview(), []);
  const closeRouting = useCallback(() => setRouting(false), []);
  const changeOutputMode = useCallback((outputMode: JamSession['outputMode']) => { void act(async () => { const resume = engine.getPosition().playing; if(resume)engine.stop(); engine.updateSession({outputMode}); if(resume)await engine.start(); }); }, [act]);
  const live = events.length > 0;
  // The scene preview is only needed before the first note has played. Computing eight bars of eight layers on every slider
  // tick blocks the main thread, which also drives the audio look-ahead scheduler, and can cause dropouts on older laptops.
  const previewKey = useDeferredValue(live ? '' : JSON.stringify([session.sceneId, session.seed, session.root, session.scale, session.bpm, session.swing, session.layers, session.macros]));
  const preview = useMemo(() => previewKey ? engine.previewScene(session.sceneId, 8) : null, [previewKey]);
  const span = 32;
  const startBeat = live ? Math.max(0, Math.floor(position.beat / 16) * 16 - 16) : 0;
  const rollNotes = live ? events : preview?.notes ?? [];

  useEffect(() => {
    const unsub = engine.subscribe(setSession);
    const recUnsub = engine.recorder.subscribe(setRecording);
    engine.midi.setCallbacks(devices => { setOutputs(devices); setOutputId(engine.midi.getSelectedOutputId() || ''); }, status => { setMidiStatus(status); if (engine.midi.getErrorMessage()) message(engine.midi.getErrorMessage()!); });
    if (!restored.current) { restored.current = true; const saved = loadSavedSession(); if (saved) void act(() => engine.loadSession(saved)); }
    return () => { unsub(); recUnsub(); };
  }, [act, message]);
  useEffect(() => { const timer = setInterval(() => { setPosition(engine.getPosition()); setEvents(engine.getRecentEvents(64)); }, session.lowResource ? 120 : 80); return () => clearInterval(timer); }, [session.lowResource]);
  useEffect(() => { if(session.globalOutputId!==undefined)setOutputId(session.globalOutputId||''); }, [session.globalOutputId]);
  useEffect(() => { const timer = setTimeout(() => { const error = persistSession(engine.saveSession()); if (error) message(error); }, 700); return () => clearTimeout(timer); }, [session, message]);
  const toggle = useCallback(async () => { await act(() => engine.getPosition().playing ? engine.stop() : engine.start()); setPosition(engine.getPosition()); }, [act]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (editor || routing || e.repeat || (e.target as HTMLElement)?.matches('input,textarea,select,button,[contenteditable]')) return; if (e.code === 'Space') { e.preventDefault(); void toggle(); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [toggle, editor, routing]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 6500); return () => clearTimeout(timer); }, [toast]);
  const keepClip = (clip: MidiClip) => { try { const valid = validateClip(clip); const next = [valid, ...library.filter(c => c.id !== valid.id)].slice(0, 128); const error = saveLibrary(next); if (error) { message(error); return; } setLibrary(next); message('Clip in deiner Sammlung gespeichert.'); } catch(e) { message(String(e)); } };
  const exportClip = (clip: MidiClip, layerId?: string) => { void act(() => { downloadBytes(clipToMidi(clip, layerId), fileName(clip.name + (layerId ? '-' + layerId : '')) + '.mid', 'audio/midi'); message('MIDI exportiert · gemeinsame Zeitachse für alle Spuren.'); }); };
  const capture = () => { void act(() => { const clip = engine.createClip(captureBars); if (!clip.notes.length) { message('Noch keine gespielten Noten. Starte den Jam und halte einen Moment fest.'); return; } keepClip(clip); setEditor(clip); }); };
  const importMidi = async (file?: File) => { if (!file) return; await act(async () => { if (file.size > 10_000_000) throw new Error('MIDI-Datei ist zu groß (max. 10 MB).'); const clip = validateClip(midiToClip(new Uint8Array(await file.arrayBuffer()), file.name.replace(/\.mid[i]?$/i, ''))); setEditor(clip); message('MIDI geöffnet. Speichern übernimmt den Clip in die Sammlung.'); }); };
  const record = async () => { if (!recording.isRecording && session.outputMode === 'midi') { message('WAV nimmt die internen Klänge auf. Wähle Audio intern oder Audio + MIDI; externe Instrumente nimmst du in Ableton auf. Für Noten nutze Capture.'); return; } if (recording.isRecording) { await act(async () => { const result = await engine.recorder.stop(); if (result.wavBytes) { downloadBytes(result.wavBytes, 'instajammable-take.wav', 'audio/wav'); message('WAV-Aufnahme gespeichert.'); } else if (result.webmBlob) { const blob = result.webmBlob; const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm'; downloadBytes(new Uint8Array(await blob.arrayBuffer()), 'instajammable-take.' + ext, blob.type); message('Komprimierte Aufnahme gespeichert; PCM war nicht verfügbar.'); } else message(engine.recorder.getState().lastError || 'Keine Audiodaten aufgezeichnet.'); }); } else { await act(async () => { if (!engine.getPosition().playing) await engine.start(); if (!engine.recorder.start()) throw new Error(engine.recorder.getState().lastError || 'Aufnahme konnte nicht starten.'); }); } };
  const connectMidi = async () => { await act(async () => { const ok = await engine.midi.init(); if (ok) { setOutputs(engine.midi.getAvailableOutputs()); const saved = engine.getState().globalOutputId; const preserve = new Set(engine.getState().layers.filter(l=>l.outputId!==null).map(l=>l.id)); if(saved === null) engine.midi.selectOff(preserve); else if(typeof saved === 'string') engine.midi.selectOutput(saved,preserve); else engine.updateSession({globalOutputId:engine.midi.getSelectedOutputId()}); setOutputId(engine.midi.getSelectedOutputId() || ''); } }); };
  const pinned = MACROS.filter(m => session.pinned.includes(m.id));

  return <div className={`instrument-shell view-${viewMode} density-${viewMode}`}>
    <header className="app-header">
      <a className="wordmark" href="#jam" onClick={e => { e.preventDefault(); setTab('jam'); }} aria-label="instajammable — Jam öffnen"><span className="brand-symbol"><i /><i /><i /><i /></span>instajammable<span className="brand-dot">.</span></a>
      <nav className="primary-nav" aria-label="Hauptnavigation">{([['jam','Jam'],['library','Sammlung'],['details','Details']] as const).map(([id,label]) => <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'selected' : ''}>{label}{id === 'library' && library.length ? <span>{library.length}</span> : null}</button>)}</nav>
      <div className="header-actions"><button className="button quiet" onClick={() => setRouting(true)}><Radio /><span>{session.outputMode === 'internal' ? 'Audio intern' : session.outputMode === 'both' ? 'Audio + MIDI' : 'MIDI'}</span><span className={'status-dot ' + (midiStatus === 'ready' ? 'connected' : '')} /></button><button className={'record-button ' + (recording.isRecording ? 'recording' : '')} onClick={() => void record()} aria-label={recording.isRecording ? 'Aufnahme stoppen und speichern' : 'Audio aufnehmen'}><Circle />{recording.isRecording ? recording.durationSec + 's' : 'Rec'}</button></div>
    </header>
    <main className="workspace">
      {/* 1. Essential Master Bar: Big Name + Preset Selector, Transport, BPM, Harmonies, Sequence Status & Loudness-Safe Evolve */}
      <EssentialMasterBar
        session={session}
        position={position}
        midiStatus={midiStatus}
        onOpenRouting={() => setRouting(true)}
        onCapture={capture}
        onOpenSettings={() => setSettingsOpen(true)}
        allCollapsed={allCollapsed}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
      />

      {position.clipOverride && (
        <div className="loop-banner">
          <Music2 /> Dein Clip spielt als Loop. <button onClick={() => engine.clearClipOverride()}>Zurück zum Generator <X size={15}/></button>
        </div>
      )}

      {tab === 'jam' && (
        <>
          {viewMode === 'distance' && (
            <DistanceStageHUD session={session} position={position} onClose={() => setViewMode('compact')} />
          )}

          {/* View density and display settings bar */}
          <WorkspaceBar session={session} viewMode={viewMode} onViewModeChange={setViewMode} />

          {/* Core & Custom Macros Ribbon */}
          <section className="macro-strip" aria-label="Musikalische Makros">
            {pinned.length ? pinned.map(m => (
              <label className="macro" key={m.id}>
                <span>{m.name}<output>{Math.round(session.macros[m.id]*100)}</output></span>
                <input aria-label={m.name} type="range" min={0} max={1} step={.01} value={session.macros[m.id]} onChange={e => engine.setMacro(m.id, Number(e.target.value))}/>
                <small>{m.text}</small>
              </label>
            )) : <p className="helper">Deine Makros kannst du unter Details anheften.</p>}

            {/* User Custom Macros on Main Strip */}
            {session.customMacros && session.customMacros.map(cm => (
              <label className="macro custom-strip-macro" key={cm.id} style={{ '--macro-theme': cm.color } as React.CSSProperties}>
                <span className="macro-label-top">
                  <span className="user-macro-tag" style={{ background: cm.color }}>Eigen</span>
                  <strong>{cm.name}</strong>
                  <output>{Math.round(cm.value * 100)}</output>
                </span>
                <input
                  aria-label={`Eigenes Makro: ${cm.name}`}
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={cm.value}
                  onChange={e => engine.setCustomMacro(cm.id, Number(e.target.value))}
                />
                <small title={cm.targets.map(t => findParamOption(t.param).label).join(', ')}>
                  {cm.targets.length} {cm.targets.length === 1 ? 'Ziel' : 'Ziele'}: {cm.targets.map(t => findParamOption(t.param).label).slice(0, 2).join(', ')}{cm.targets.length > 2 ? ' ...' : ''}
                </small>
              </label>
            ))}
          </section>

          {/* Modular Plugin Rack: Ableton-style rack with individual minimize buttons and live background previews */}
          <div className={`modular-plugin-rack density-${viewMode}`}>
            {/* 1. Studio-Mischpult */}
            <PluginRackUnit
              id="mixer"
              title="Studio-Mischpult"
              subtitle="8-Kanal Fader, Mute, Solo, Lock & Freeze"
              icon={SlidersHorizontal}
              badge="8 Spuren"
              themeColor="#38bdf8"
              isCollapsed={!!collapsed.mixer}
              onToggleCollapse={() => toggleCollapse('mixer')}
              miniContent={<MiniMixerPreview session={session} />}
            >
              <QuickMixerDeck session={session} position={position} />
            </PluginRackUnit>

            {/* 2. Organischer Attraktor */}
            <PluginRackUnit
              id="chaos"
              title="Organischer Attraktor"
              subtitle="Nichtlineare Chaossysteme für Timbre- & Modulationsdrift"
              icon={Sparkles}
              badge="LORENZ"
              themeColor="#ec4899"
              isCollapsed={!!collapsed.chaos}
              onToggleCollapse={() => toggleCollapse('chaos')}
              miniContent={<MiniChaosPreview session={session} />}
            >
              <ChaosModulatorDeck session={session} />
            </PluginRackUnit>

            {/* 3. 4-Band Studio-EQ & Low-Cut */}
            {(() => {
              const eqModule = engine.getEffectChain().modules.find(m => m.id === 'eq');
              const isBypassed = eqModule?.bypassed ?? false;
              return (
                <PluginRackUnit
                  id="eq"
                  title="4-Band Studio-EQ & Low-Cut"
                  subtitle="Frequenzkurve, Resonanz-Dämpfung & Sub-Bereinigung"
                  icon={SlidersHorizontal}
                  badge={`${session.effectsPatch?.eqHighpass || 20}Hz LC`}
                  themeColor="#10b981"
                  isBypassed={isBypassed}
                  onToggleBypass={() => engine.toggleEffectBypass('eq')}
                  isCollapsed={!!collapsed.eq}
                  onToggleCollapse={() => toggleCollapse('eq')}
                  miniContent={<MiniEqPreview session={session} />}
                >
                  <EqualizerDeck session={session} onClose={() => toggleCollapse('eq')} />
                </PluginRackUnit>
              );
            })()}

            {/* 4. Pianorolle & Ensemble */}
            <PluginRackUnit
              id="score"
              title="Pianorolle & Ensemble"
              subtitle="Visualisierte Melodien, Akkorde & Noten-Spuren"
              icon={Music2}
              badge={`${position.voices} Stimmen`}
              themeColor="#6366f1"
              isCollapsed={!!collapsed.score}
              onToggleCollapse={() => toggleCollapse('score')}
              miniContent={<MiniScorePreview session={session} position={position} />}
            >
              <div className="jam-layout">
                <section className="score-panel">
                  <header className="panel-heading">
                    <div>
                      <span className="eyebrow">{live ? 'GESPIELTE NOTEN' : 'SZENENVORSCHAU · NOCH NICHT GESPIELT'}</span>
                      <h2>Platz für deine Melodie.</h2>
                    </div>
                    <div className="segmented">
                      <button className={!drums ? 'selected' : ''} onClick={() => { setDrums(false); setFocusTrack(''); }}>Keys</button>
                      <button className={drums ? 'selected' : ''} onClick={() => { setDrums(true); setFocusTrack(''); }}>Drums</button>
                    </div>
                  </header>
                  <div className="roll-focus">
                    <label>
                      Fokus{' '}
                      <select aria-label="Pianorollen-Fokus" value={focusTrack} onChange={e => setFocusTrack(e.target.value)}>
                        <option value="">Alle Spuren</option>
                        {session.layers.filter(l => drums ? l.role === 'drum' : l.role !== 'drum').map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </label>
                    <span>Oktaven wie in Ableton · MIDI 60 = C3</span>
                  </div>
                  <PianoRoll
                    rootPitchClass={((position.chordRoot % 12) + 12) % 12}
                    chordTones={position.chordNotes}
                    notes={rollNotes}
                    tracks={session.layers}
                    focusedTrack={focusTrack || undefined}
                    startBeat={startBeat}
                    span={span}
                    cursor={live ? position.beat : undefined}
                    drums={drums}
                    height={345}
                    onAudition={n => { void act(() => engine.auditionNote(n)); }}
                  />
                  <footer className="score-footer">
                    <div className="chord-display">
                      <span className="helper">Jetzt</span>
                      <strong>{position.chord || pitch(session.root) + ' ' + session.scale}</strong>
                    </div>
                    <span className="helper">
                      {live ? `Live · 8 Takte · ${position.voices} Stimmen` : 'Starte den Jam, um den tatsächlichen Verlauf zu sehen.'}
                    </span>
                  </footer>
                </section>
                <aside className="layers-panel">
                  <header className="panel-heading">
                    <div>
                      <span className="eyebrow">DAS ENSEMBLE</span>
                      <h2>In Balance.</h2>
                    </div>
                    <button className="icon-button" aria-label="Spurdetails öffnen" onClick={() => setTab('details')}>
                      <SlidersHorizontal />
                    </button>
                  </header>
                  <div className="layers-list">
                    {session.layers.map(layer => (
                      <LayerRow key={layer.id} layer={layer} />
                    ))}
                  </div>
                  <footer className="helper layer-legend">
                    <LockKeyhole size={13} /> Parameter schützen <Snowflake size={13} /> Phrase wiederholen
                  </footer>
                </aside>
              </div>
            </PluginRackUnit>

            {/* 5. Klanglandschaft & Streicher */}
            <PluginRackUnit
              id="soundscape"
              title="Klanglandschaft & Orchester"
              subtitle="Großes Streichorchester, Hall-Räume & harmonische Stimmung"
              icon={Compass}
              badge={session.layers.find(l => l.role === 'chords')?.settings.timbre === 'strings' ? 'Großes Orchester' : 'Akkorde'}
              themeColor="#f59e0b"
              isCollapsed={!!collapsed.soundscape}
              onToggleCollapse={() => toggleCollapse('soundscape')}
              miniContent={<MiniSoundscapePreview session={session} />}
            >
              <SoundscapeDeck session={session} position={position} onClose={() => toggleCollapse('soundscape')} />
            </PluginRackUnit>

            {/* 6. Arrangement-Sequenzer */}
            <PluginRackUnit
              id="sequencer"
              title="Arrangement-Sequenzer"
              subtitle="Strophe, Refrain, Break & Drop im 4/8-Takt-Verlauf"
              icon={Activity}
              badge={position.sequencer?.enabled ? 'Aktiv' : 'Frei'}
              themeColor="#a855f7"
              isBypassed={!session.sequencerEnabled}
              onToggleBypass={() => engine.toggleSequencer(!session.sequencerEnabled)}
              isCollapsed={!!collapsed.sequencer}
              onToggleCollapse={() => toggleCollapse('sequencer')}
              miniContent={<MiniSequencerPreview session={session} position={position} />}
            >
              <SequencerDeck session={session} position={position} onClose={() => toggleCollapse('sequencer')} />
            </PluginRackUnit>

            {/* 7. Rhythmus-Pool & Drums */}
            <PluginRackUnit
              id="rhythms"
              title="Rhythmus-Pool & Groove"
              subtitle="Euclidean, Markov, Polyrhythmen & CBL Grooves"
              icon={Disc}
              badge={session.layers.find(l => l.role === 'drum')?.settings.rhythmAlgorithm?.toUpperCase() || 'COMPOSED'}
              themeColor="#06b6d4"
              isCollapsed={!!collapsed.rhythms}
              onToggleCollapse={() => toggleCollapse('rhythms')}
              miniContent={<MiniRhythmPoolPreview session={session} />}
            >
              <RhythmPoolDeck session={session} position={position} onClose={() => toggleCollapse('rhythms')} />
            </PluginRackUnit>

            {/* 8. Studio-Effektkette */}
            <PluginRackUnit
              id="fxchain"
              title="Studio-Effektkette"
              subtitle="Ping-Pong Delay, Damped Reverb, Chorus & Bandsättigung"
              icon={Waves}
              badge={session.effectChain?.mode === 'delay-into-reverb' ? 'Delay ➔ Hall' : 'Hall ➔ Delay'}
              themeColor="#14b8a6"
              isCollapsed={!!collapsed.fxchain}
              onToggleCollapse={() => toggleCollapse('fxchain')}
              miniContent={<MiniFxChainPreview session={session} />}
            >
              <EffectChainDeck session={session} />
            </PluginRackUnit>

            {/* 9. Eigene Makros */}
            <PluginRackUnit
              id="custommacros"
              title="Eigene Makros (Ableton-Style)"
              subtitle="Selbst konfigurierte Multi-Parameter-Regler"
              icon={Cpu}
              badge={`${session.customMacros?.length || 0} Makros`}
              themeColor="#e11d48"
              isCollapsed={!!collapsed.custommacros}
              onToggleCollapse={() => toggleCollapse('custommacros')}
              miniContent={<MiniCustomMacroPreview session={session} />}
            >
              <CustomMacroDeck session={session} />
            </PluginRackUnit>

            {/* 10. Atmosphären-Generator */}
            <PluginRackUnit
              id="atmosphere"
              title="Atmosphären-Generator"
              subtitle="Subtiler Rauschteppich & Sidechain (Gedeckelt auf max. 20%)"
              icon={Cloud}
              badge={`Pegel ${Math.round(Math.min(0.2, session.atmosphere?.level ?? 0.12) * 100)}%`}
              themeColor="#8b5cf6"
              isBypassed={session.atmosphere?.kind === 'off'}
              onToggleBypass={() => {
                const isOff = session.atmosphere?.kind === 'off';
                engine.updateSession({
                  atmosphere: {
                    kind: isOff ? 'air' : 'off',
                    level: Math.min(0.2, session.atmosphere?.level ?? 0.14),
                    tone: session.atmosphere?.tone ?? 0.5,
                    movement: session.atmosphere?.movement ?? 0.4,
                  },
                });
              }}
              isCollapsed={!!collapsed.atmosphere}
              onToggleCollapse={() => toggleCollapse('atmosphere')}
              miniContent={<MiniAtmospherePreview session={session} />}
            >
              <AtmosphereFlow session={session} />
            </PluginRackUnit>

            <PinnedParameters session={session} />
          </div>

          {/* 16 Ausgangspunkte / Szenen */}
          <section className="scene-section">
            <div className="section-intro">
              <span className="eyebrow">WO SOLL ES HINGEHEN?</span>
              <h2>Sechzehn Ausgangspunkte.<br/>Unzählige Abzweigungen.</h2>
              <p>Eine Szene gibt dem Jam einen Charakter. Evolve erkundet ihn weiter.</p>
            </div>
            <div className="scene-list">
              {SCENES.map((s, i) => (
                <button
                  key={s.id}
                  className={'scene-row ' + (s.id === session.sceneId ? 'selected' : '')}
                  onClick={() => {
                    void act(async () => {
                      await engine.loadScene(s.id);
                      message('Szene geladen · Tonart und Tempo aus dem Preset.');
                    });
                  }}
                >
                  <span className="mono scene-index">{String(i + 1).padStart(2, '0')}</span>
                  <strong>{s.name}</strong>
                  <span className="scene-style">{s.mood || s.style} · {s.bpm}</span>
                  <ArrowUpRight />
                </button>
              ))}
            </div>
          </section>
        </>
      )}
      {tab === 'library' && <section className="library-section"><header className="panel-heading"><div><span className="eyebrow">DEINE MOMENTE</span><h2>Was bleiben soll.</h2><p className="helper">Capture hält gespielte Noten fest, inklusive Tempo und gemeinsamer Spurposition.</p></div><button className="button" onClick={() => midiInput.current?.click()}><Upload /> MIDI öffnen</button></header>{library.length ? <div className="clip-list">{library.map(clip => <article className="clip-row" key={clip.id}><span className="clip-symbol"><Music2 /></span><div><h3>{clip.name}</h3><p>{Number((clip.lengthBeats/4).toFixed(1))} Takte · {clip.notes.length} Noten · {clip.bpm} BPM · {new Date(clip.createdAt).toLocaleDateString('de-DE')}</p></div><button className="button" onClick={() => setEditor(clip)}>Öffnen <ArrowUpRight /></button><button className="icon-button" aria-label={'MIDI exportieren: '+clip.name} onClick={() => exportClip(clip)}><Download /></button><button className="icon-button" aria-label={'Clip löschen: '+clip.name} onClick={() => { const next = library.filter(c => c.id !== clip.id); const error = saveLibrary(next); if(error) message(error); else setLibrary(next); }}><Trash2 /></button></article>)}</div> : <div className="empty-library"><Music2 /><h3>Ein guter Moment verdient ein Zuhause.</h3><p>Starte einen Jam und drücke Capture. Oder öffne eine MIDI-Datei.</p><button className="button" onClick={() => { setTab('jam'); void toggle(); }}><Play /> Zurück zum Jam</button></div>}<p className="helper">Lokal in diesem Browser gespeichert · maximal 128 Clips. Exportiere wichtige Takes als MIDI, bevor du Browserdaten löschst.</p></section>}
      {tab === 'details' && <section className="details-section"><div className="details-intro"><span className="eyebrow">DEIN INSTRUMENT, DEINE REGELN</span><h2>Mehr Kontrolle.<br/>Wenn du sie brauchst.</h2><p>Tonart und Tempo bleiben bei Evolve stabil. Lock schützt Parameter; Freeze hält eine Vier-Takt-Phrase fest.</p></div><div className="global-settings"><h3>Musikalischer Rahmen</h3><div className="settings-grid"><label>Grundton<select value={((session.root % 12)+12)%12} onChange={e => engine.updateSession({root:Math.floor(session.root/12)*12+Number(e.target.value)})}>{Array.from({length:12},(_,i)=>48+i).map(n=><option key={n} value={n%12}>{pitch(n)}</option>)}</select></label><label>Skala<select value={session.scale} onChange={e => engine.updateSession({scale:e.target.value as MusicalScale})}>{SCALES.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>Swing<Range value={session.swing} max={.6} onChange={n=>engine.updateSession({swing:n})}/></label><label>Master (Audio)<Range value={session.volume} onChange={n=>engine.updateSession({volume:n})}/></label></div><div className="toggle-row"><label><input type="checkbox" checked={session.evolving} onChange={e=>engine.updateSession({evolving:e.target.checked})}/> Langsame Entwicklung</label><label><input type="checkbox" checked={session.lowResource} onChange={e=>engine.updateSession({lowResource:e.target.checked})}/> Ressourcen sparen</label></div><h3>Makros auf der Hauptseite</h3><div className="pin-list">{MACROS.map(m=><button className={'button '+(session.pinned.includes(m.id)?'active':'')} key={m.id} onClick={()=>engine.updateSession({pinned:session.pinned.includes(m.id)?session.pinned.filter(id=>id!==m.id):[...session.pinned,m.id]})}><Pin />{m.name}</button>)}</div><div className="details-actions"><button className="button" onClick={()=>{const error=persistSession(engine.saveSession()); message(error||'Session gespeichert.');}}><Save/>Session sichern</button><button className="button" onClick={()=>exportJson(engine.saveSession(),'instajammable-session.json')}><Download/>Session exportieren</button><button className="button" onClick={()=>sessionInput.current?.click()}><Upload/>Session öffnen</button><button className="button" onClick={()=>{engine.panic();message('Alle von der App gesendeten Noten beendet.');}}><Square/>Panic</button></div><div className="change-history"><h3>Zuletzt im Jam</h3>{session.changes.length?session.changes.slice(-5).reverse().map(c=><p key={c.id}><span className="mono">Takt {Math.floor(c.beat/4)+1}</span>{c.label}</p>):<p>Änderungen an Motiven, Harmonie und Freeze erscheinen hier.</p>}</div></div><div className="layer-details">{session.layers.map(layer=><LayerDetails key={layer.id} layer={layer} outputs={outputs}/>)}<SoundLab session={session}/></div></section>}
      <footer className="app-footer"><span>Made for the moment.</span><span className="mono">Seed {session.seed} · {position.capturedBars.toFixed(1)} Takte im Capture</span><button onClick={()=>setRouting(true)}>Ableton & MIDI <ArrowUpRight size={14}/></button></footer>
    </main>
    <input ref={midiInput} className="file-input" type="file" accept=".mid,.midi,audio/midi" onChange={e=>{void importMidi(e.target.files?.[0]);e.target.value='';}}/>
    <input ref={sessionInput} className="file-input" type="file" accept=".json" onChange={e=>{const file=e.target.files?.[0]; if(file)void act(async()=>{if(file.size>10_000_000)throw new Error('Session zu groß.');engine.loadSession(JSON.parse(await file.text()));message('Session geladen.');});e.target.value='';}}/>
    <div className={'toast '+(toast?'visible':'')} role="status" aria-live="polite">{toast}</div>
    {recording.lastError && <div className="recording-notice" role="status">{recording.lastError}</div>}
    {editor && <ClipEditor key={editor.id} clip={editor} onClose={()=>setEditor(null)} onSave={keepClip} onExport={(clip,layerId)=>exportClip(clip,layerId)} onPreview={clip=>{void act(()=>engine.previewClip(clip));}} onStopPreview={stopPreview} onApply={clip=>{void act(async()=>{engine.setClipOverride(validateClip(clip));if(!engine.getPosition().playing)await engine.start();message('Dein Clip übernimmt ab dem nächsten Takt.');});}} onAudition={n=>{void act(()=>engine.auditionNote(n));}}/>}
    {routing && <Routing session={session} outputs={outputs} outputId={outputId} midiStatus={midiStatus} onClose={closeRouting} onMode={changeOutputMode} onConnect={()=>void connectMidi()} onOutput={id=>{engine.updateSession({globalOutputId:id||null});setOutputId(id);}} onTest={()=>{const r=engine.midi.sendTestNote();message(r.success?'Testnoten gesendet an '+r.portName:r.error||'MIDI-Test fehlgeschlagen.');}}/>}
    <PresetsSettingsModal
      isOpen={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      session={session}
      onToast={message}
    />
  </div>;
}

function Range({value,onChange,max=1}:{value:number;onChange:(n:number)=>void;max?:number}) {return <div className="range-value"><input type="range" min={0} max={max} step={.01} value={value} onChange={e=>onChange(Number(e.target.value))}/><output>{Math.round(value*100)}%</output></div>;}
function LayerRow({layer}:{layer:JamLayer}) {return <div className={'layer-row '+(layer.muted?'muted':'')} style={{'--layer-color':layer.color} as React.CSSProperties}><span className="layer-color"/><div className="layer-main"><strong>{layer.name}</strong><input aria-label={layer.name+' Lautstärke intern'} type="range" min={0} max={1} step={.01} value={Math.min(1,layer.volume)} onChange={e=>engine.updateLayer(layer.id,{volume:Number(e.target.value)})}/></div><div className="layer-controls"><button className={layer.muted?'active':''} aria-label={layer.name+' stummschalten'} aria-pressed={layer.muted} onClick={()=>engine.updateLayer(layer.id,{muted:!layer.muted})}>M</button><button className={layer.solo?'active':''} aria-label={layer.name+' solo'} aria-pressed={layer.solo} onClick={()=>engine.updateLayer(layer.id,{solo:!layer.solo})}>S</button><button className={layer.locked?'active':''} aria-label={layer.name+' Parameter schützen'} aria-pressed={layer.locked} onClick={()=>engine.updateLayer(layer.id,{locked:!layer.locked})}><LockKeyhole size={13}/></button><button className={layer.frozen?'active':''} aria-label={layer.name+' Phrase einfrieren'} aria-pressed={layer.frozen} onClick={()=>engine.updateLayer(layer.id,{frozen:!layer.frozen})}><Snowflake size={13}/></button></div></div>;}
function LayerDetails({layer,outputs}:{layer:JamLayer;outputs:{id:string;name:string}[]}) {const s=layer.settings;return <details className="layer-detail"><summary><span style={{background:layer.color}} className="layer-color"/><strong>{layer.name}</strong><span className="helper">{layer.role} · Kanal {layer.channel}</span><SlidersHorizontal size={16}/></summary><div className="settings-grid"><label>Dichte<Range value={s.density} onChange={n=>engine.setLayerSettings(layer.id,{density:n})}/></label>{layer.role==='drum'&&<label>Rhythmusgenerator<select value={s.rhythmAlgorithm||'composed'} onChange={e=>engine.setLayerSettings(layer.id,{rhythmAlgorithm:e.target.value as typeof s.rhythmAlgorithm})}>{[['composed','Komponierter Groove'],['euclidean','Euclidean'],['probabilistic','Probabilistic'],['polymetric','Polymetric'],['markov','Markov'],['densityBurst','Density Burst']].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>}<label>Evolve-Dichte von<Range value={s.mutationDensityMin??0} onChange={n=>engine.setLayerSettings(layer.id,{mutationDensityMin:Math.min(n,s.mutationDensityMax??1)})}/></label><label>Evolve-Dichte bis<Range value={s.mutationDensityMax??1} onChange={n=>engine.setLayerSettings(layer.id,{mutationDensityMax:Math.max(n,s.mutationDensityMin??0)})}/></label><label>Register von<input type="number" min={0} max={s.maxNote} value={s.minNote} onChange={e=>engine.setLayerSettings(layer.id,{minNote:Math.min(s.maxNote,Math.max(0,Number(e.target.value)))})}/></label><label>Register bis<input type="number" min={s.minNote} max={127} value={s.maxNote} onChange={e=>engine.setLayerSettings(layer.id,{maxNote:Math.max(s.minNote,Math.min(127,Number(e.target.value)))})}/></label><label>Phrase<select value={s.phraseBars} onChange={e=>engine.setLayerSettings(layer.id,{phraseBars:Number(e.target.value)})}>{[2,4,8,16].map(n=><option key={n} value={n}>{n} Takte</option>)}</select></label><label>Velocity von<input type="number" min={1} max={s.velocityMax} value={s.velocityMin} onChange={e=>engine.setLayerSettings(layer.id,{velocityMin:Math.min(s.velocityMax,Math.max(1,Number(e.target.value)))})}/></label><label>Velocity bis<input type="number" min={s.velocityMin} max={127} value={s.velocityMax} onChange={e=>engine.setLayerSettings(layer.id,{velocityMax:Math.max(s.velocityMin,Math.min(127,Number(e.target.value)))})}/></label><label>Humanize (ms)<input type="number" min={0} max={30} value={s.humanizeMs} onChange={e=>engine.setLayerSettings(layer.id,{humanizeMs:Math.min(30,Math.max(0,Number(e.target.value)))})}/></label><label>Klangfarbe<select value={s.timbre} onChange={e=>engine.setLayerSettings(layer.id,{timbre:e.target.value as typeof s.timbre})}>{TIMBRES.map(t=><option key={t} value={t}>{TIMBRE_NAMES[t]}</option>)}</select></label><label>MIDI-Kanal<input type="number" min={1} max={16} value={layer.channel} onChange={e=>engine.updateLayer(layer.id,{channel:Math.max(1,Math.min(16,Number(e.target.value)))})}/></label><label>MIDI-Ausgang<select value={layer.outputId||''} onChange={e=>engine.updateLayer(layer.id,{outputId:e.target.value||null})}><option value="">Globaler Ausgang</option>{layer.outputId&&!outputs.some(o=>o.id===layer.outputId)&&<option value={layer.outputId}>Gespeicherter Port · nicht verbunden</option>}{outputs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label></div></details>;}
function Routing({session,outputs,outputId,midiStatus,onClose,onMode,onConnect,onOutput,onTest}:{session:JamSession;outputs:{id:string;name:string}[];outputId:string;midiStatus:string;onClose:()=>void;onMode:(mode:JamSession['outputMode'])=>void;onConnect:()=>void;onOutput:(id:string)=>void;onTest:()=>void}) {
  const ref=useRef<HTMLElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement;ref.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const nodes=[...ref.current!.querySelectorAll<HTMLElement>('button,input,select')];const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};ref.current?.addEventListener('keydown',key);const current=ref.current;return()=>{current?.removeEventListener('keydown',key);previous?.focus();};},[onClose]);
  return <div className="modal-scrim"><section ref={ref} className="routing-dialog" role="dialog" aria-modal="true" aria-labelledby="routing-title" tabIndex={-1}><header className="editor-header"><div><span className="eyebrow">DEIN SIGNALWEG</span><h2 id="routing-title">Vom Browser ins Studio.</h2></div><button className="icon-button" aria-label="Routing schließen" onClick={onClose}><X/></button></header><div className="routing-content"><label>Wiedergabe<select value={session.outputMode} onChange={e=>onMode(e.target.value as JamSession['outputMode'])}><option value="internal">Internes Audio</option><option value="midi">MIDI</option><option value="both">Audio + MIDI</option></select></label><div className="midi-connect"><button className="button" onClick={onConnect}><Radio/>{midiStatus==='ready'?'MIDI aktualisieren':'MIDI verbinden'}</button><span className="helper">Status: {midiStatus}</span></div><label>Globaler MIDI-Ausgang<select value={outputId} onChange={e=>onOutput(e.target.value)}><option value="">Aus</option>{outputId&&!outputs.some(o=>o.id===outputId)&&<option value={outputId}>Gespeicherter Port · nicht verbunden</option>}{outputs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><button className="button" disabled={!outputId} onClick={onTest}><Volume2/>Testnote (Kanal 1 + 10)</button><div className="toggle-row"><label><input type="checkbox" checked={session.deepMindEnabled} onChange={e=>engine.updateSession({deepMindEnabled:e.target.checked})}/> DeepMind-CC-Modulation aktivieren</label><label>Kanal<input type="number" min={1} max={16} value={session.deepMindChannel} onChange={e=>engine.updateSession({deepMindChannel:Math.max(1,Math.min(16,Number(e.target.value)))})}/></label></div><p className="helper">Pegel, Synthese und Effekte formen das interne Audio. MIDI-Klang und Lautstärke steuerst du in deinem Instrument; die Velocity-Grenzen unter Details verändern gesendete Noten.</p><p className="helper">CC-Modulation nur aktivieren, wenn das empfangende Gerät und seine CC-Zuordnung stimmen. Einzelne Spur-Ausgänge findest du unter Details.</p><div className="connection-guide"><h3><Headphones/>Ableton Live Standard</h3><ol><li>Audio-MIDI-Setup → MIDI-Studio → IAC-Treiber → „Gerät ist online“.</li><li>In Live: IAC-Eingang <strong>Track</strong> einschalten. <strong>Remote</strong> nur für deine eigenen MIDI-Zuweisungen einschalten.</li><li>Instrumentenspuren: MIDI From IAC, Kanal 1 für Texture/Chords, 2 für Melody, 3 für Bass, 10 für Drums. Monitor In oder Auto + Aufnahmebereitschaft.</li><li>In der App MIDI verbinden und IAC wählen. Danach Live aufnehmen oder MIDI aus der Sammlung importieren.</li></ol><p>Die App läuft frei. Ableton-Transport und Tempo werden noch nicht automatisch synchronisiert. Für exakt ausgerichtete Clips nutze den MIDI-Export.</p><p>Firefox braucht Web-MIDI-Unterstützung und die Port-Berechtigung. Falls „unsupported“ erscheint, bleibt internes Audio verfügbar. Ein Button kann Firefox-Einstellungen nicht selbst ändern.</p></div></div></section></div>;
}

const TIMBRE_NAMES: Record<(typeof TIMBRES)[number], string> = { warm: 'Warm', air: 'Luftig', keys: 'Keys', bell: 'Glocke', strings: 'Streicher', wash: 'Wash · breite Fläche', dub: 'Dub · Akkord-Stab', root: 'Root · tiefer Anker', glass: 'Glass · glasig, schimmernd', organ: 'Orgel · weich, tragend', solina: 'Solina · analoges Ensemble', shimmer: 'Shimmer · kristalline Obertöne', celeste: 'Celeste · gefilztes Piano/Glocke' };

