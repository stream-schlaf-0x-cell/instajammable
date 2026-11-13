import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, Download, Upload, Radio, SlidersHorizontal, ArrowUpRight, LockKeyhole, Snowflake, Volume2, Pin, X, Music2, Save, Trash2, Headphones, Compass, Activity, Disc, Waves, Cpu, Cloud, Sparkles } from 'lucide-react';
import { JamEngine } from './engine/jam/JamEngine';
import { SCENES } from './engine/jam/scenes';
import { clipToMidi, midiToClip } from './engine/jam/clipMidi';
import { downloadBytes, exportJson, loadLibrary, loadSavedSession, persistSession, saveLibrary, validateClip } from './engine/jam/storage';
import { PianoRoll, noteName } from './components/jam/PianoRoll';
import { ClipEditor } from './components/jam/ClipEditor';
import { SoundLab, PinnedParameters } from './components/jam/SoundLab';
import { AtmosphereFlow } from './components/jam/AtmosphereFlow';
import { SoundscapeDeck, SequencerDeck, RhythmPoolDeck } from './components/jam/ArrangementHub';
import { type ViewDensityMode } from './components/jam/WorkspaceBar';
import { EqualizerDeck } from './components/jam/EqualizerDeck';
import { DistanceStageHUD } from './components/jam/DistanceStageHUD';
import { CustomMacroDeck } from './components/jam/CustomMacroDeck';
import { EffectChainDeck } from './components/jam/EffectChainDeck';
import { ChaosModulatorDeck } from './components/jam/ChaosModulatorDeck';
import { EssentialMasterBar } from './components/jam/EssentialMasterBar';
import { PresetsSettingsModal } from './components/jam/PresetsSettingsModal';
import { QuickMixerDeck, MiniMixerPreview } from './components/jam/QuickMixerDeck';
import { SplitLayout } from './components/layouts/SplitLayout';
import { FocusStageLayout } from './components/layouts/FocusStageLayout';
import { CommandGridLayout } from './components/layouts/CommandGridLayout';
import { GrooveboxLayout } from './components/layouts/GrooveboxLayout';
import { MINIMAL_MACROS, getSceneDisplay } from './engine/jam/minimalCatalog';
import { UiEditionContext, useUiEdition } from './contexts/UiEditionContext';
import type { LayoutVariant, UiEdition } from './types/ui';
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
  const [uiEdition, setUiEdition] = useState<UiEdition>(() => {
    try { return localStorage.getItem('instajammable.uiEdition') === 'minimal' ? 'minimal' : 'classic'; } catch { return 'classic'; }
  });
  const [layoutVariant, setLayoutVariant] = useState<LayoutVariant>(() => {
    try {
      const v = localStorage.getItem('instajammable.layoutVariant');
      return v === 'split' || v === 'stage' || v === 'grid' || v === 'groovebox' ? v : 'console';
    } catch { return 'console'; }
  });
  useEffect(() => { try { localStorage.setItem('instajammable.uiEdition', uiEdition); } catch { /* ignore */ } }, [uiEdition]);
  useEffect(() => { try { localStorage.setItem('instajammable.layoutVariant', layoutVariant); } catch { /* ignore */ } }, [layoutVariant]);
  const [activeDrawer, setActiveDrawer] = useState<string | null>('soundscape');
  const [mixerExpanded, setMixerExpanded] = useState<boolean>(true);
  const [chaosEnabled, setChaosEnabled] = useState<boolean>(true);
  const [customMacrosEnabled, setCustomMacrosEnabled] = useState<boolean>(true);


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
  const isMinimal = uiEdition === 'minimal';

  return <UiEditionContext.Provider value={uiEdition}><div className={`instrument-shell view-${viewMode} density-${viewMode}`}>
    <main className="workspace">
      {/* 1. Unified Master Top Console: Brand, Nav, Preset Selector, Transport, BPM, Harmonies, Always-Editable Sequence & Actions */}
      <EssentialMasterBar
        session={session}
        position={position}
        midiStatus={midiStatus}
        onOpenRouting={() => setRouting(true)}
        onCapture={capture}
        onOpenSettings={() => setSettingsOpen(true)}
        tab={tab}
        onTabChange={setTab}
        libraryCount={library.length}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        recording={recording}
        onRecord={record}
        onTogglePlay={toggle}
        uiEdition={uiEdition}
        onUiEditionChange={setUiEdition}
        layoutVariant={layoutVariant}
        onLayoutVariantChange={setLayoutVariant}
      />

      {position.clipOverride && (
        <div className="loop-banner">
          <Music2 /> {uiEdition === 'minimal' ? 'Playing captured loop.' : 'Dein Clip spielt als Loop.'} <button onClick={() => engine.clearClipOverride()}>{uiEdition === 'minimal' ? 'Back to Generator' : 'Zurück zum Generator'} <X size={15}/></button>
        </div>
      )}

      {tab === 'jam' && layoutVariant === 'split' && (
        <SplitLayout
          session={session}
          position={position}
          edition={uiEdition}
          rollNotes={rollNotes}
          startBeat={startBeat}
          span={span}
          live={live}
          onAudition={n => { void act(() => engine.auditionNote(n)); }}
        />
      )}

      {tab === 'jam' && layoutVariant === 'stage' && (
        <FocusStageLayout
          session={session}
          position={position}
          edition={uiEdition}
          rollNotes={rollNotes}
          startBeat={startBeat}
          span={span}
          live={live}
          onAudition={n => { void act(() => engine.auditionNote(n)); }}
        />
      )}

      {tab === 'jam' && layoutVariant === 'grid' && (
        <CommandGridLayout
          session={session}
          position={position}
          edition={uiEdition}
          rollNotes={rollNotes}
          startBeat={startBeat}
          span={span}
          live={live}
          onAudition={n => { void act(() => engine.auditionNote(n)); }}
        />
      )}

      {tab === 'jam' && layoutVariant === 'groovebox' && (
        <GrooveboxLayout
          session={session}
          position={position}
          edition={uiEdition}
        />
      )}

      {tab === 'jam' && layoutVariant === 'console' && (
        <>
          {viewMode === 'distance' && (
            <DistanceStageHUD session={session} position={position} onClose={() => setViewMode('compact')} />
          )}

          {/* Core & Custom Macros Ribbon */}
          <section className="macro-strip" aria-label={uiEdition === 'minimal' ? 'Sound Macros' : 'Musikalische Makros'}>
            {pinned.length ? pinned.map(m => {
              const label = uiEdition === 'minimal' ? MINIMAL_MACROS[m.id] : m;
              return (
                <label className="macro" key={m.id}>
                  <span>{label.name}<output>{Math.round(session.macros[m.id]*100)}</output></span>
                  <input aria-label={label.name} type="range" min={0} max={1} step={.01} value={session.macros[m.id]} onChange={e => engine.setMacro(m.id, Number(e.target.value))}/>
                  <small>{label.text}</small>
                </label>
              );
            }) : <p className="helper">{uiEdition === 'minimal' ? 'Pin macros in Details.' : 'Deine Makros kannst du unter Details anheften.'}</p>}

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

          {/* Central 8-Channel Studio Mixing Desk */}
          <section className="central-mixer-stage" aria-label={isMinimal ? '8-Channel Studio Mixer' : '8-Kanal Studio-Mischpult'}>
            <header className="mixer-stage-header">
              <div className="mixer-stage-title">
                <SlidersHorizontal size={15} style={{ color: '#38bdf8' }} />
                <strong>{isMinimal ? '8-Channel Studio Mixer' : '8-Kanal Studio-Mischpult'}</strong>
                <span className="mixer-stage-badge">Fader, Mute, Solo, Lock & Freeze</span>
              </div>
              <div className="mixer-stage-actions">
                <button
                  type="button"
                  className="button quiet mixer-collapse-btn"
                  onClick={() => setMixerExpanded(prev => !prev)}
                  title={isMinimal ? (mixerExpanded ? 'Minimize mixer' : 'Open mixer') : (mixerExpanded ? 'Mischpult minimieren' : 'Mischpult öffnen')}
                >
                  <span>{isMinimal ? (mixerExpanded ? 'Minimize' : 'Open') : (mixerExpanded ? 'Minimieren' : 'Öffnen')}</span>
                </button>
              </div>
            </header>
            {mixerExpanded ? (
              <QuickMixerDeck session={session} position={position} />
            ) : (
              <div className="mini-mixer-collapsed-bar" onClick={() => setMixerExpanded(true)}>
                <MiniMixerPreview session={session} />
                <span className="click-to-expand-hint">{isMinimal ? 'Click to open 8-channel mixer' : 'Klicken zum Öffnen des 8-Kanal-Mischpults'}</span>
              </div>
            )}
          </section>

          {/* Single-Drawer Console: Clean tab bar with explicit ON/OFF hardware switch on every tab */}
          <section className="single-drawer-console" aria-label={isMinimal ? 'Module Console' : 'Single-Drawer Modul-Konsole'}>
            <div className="drawer-tabs-bar" role="tablist">
              {[
                {
                  id: 'soundscape',
                  title: isMinimal ? 'Chords & Progression' : 'Klangwelt & Chords',
                  icon: Compass,
                  color: '#f59e0b',
                  isOn: session.layers.find(l => l.role === 'chords')?.settings.secondaryEnabled ?? true,
                  onToggle: () => {
                    const l = session.layers.find(ly => ly.role === 'chords');
                    engine.setSecondaryChord({ enabled: !(l?.settings.secondaryEnabled ?? true) });
                  },
                },
                {
                  id: 'sequencer',
                  title: isMinimal ? 'Arrangement Sequencer' : 'Arrangement-Sequenzer',
                  icon: Activity,
                  color: '#a855f7',
                  isOn: session.sequencerEnabled ?? true,
                  onToggle: () => engine.toggleSequencer(!session.sequencerEnabled),
                },
                {
                  id: 'score',
                  title: isMinimal ? 'Piano Roll & Ensemble' : 'Pianorolle & Ensemble',
                  icon: Music2,
                  color: '#6366f1',
                  isOn: !session.layers.find(l => l.role === 'melody')?.muted,
                  onToggle: () => {
                    const l = session.layers.find(ly => ly.role === 'melody');
                    if (l) engine.updateLayer(l.id, { muted: !l.muted });
                  },
                },
                {
                  id: 'rhythms',
                  title: isMinimal ? 'Rhythm & Drums' : 'Rhythmus & Drums',
                  icon: Disc,
                  color: '#06b6d4',
                  isOn: session.layers.some(l => l.role === 'drum' && !l.muted),
                  onToggle: () => {
                    const anyDrumUnmuted = session.layers.some(l => l.role === 'drum' && !l.muted);
                    for (const l of session.layers) {
                      if (l.role === 'drum') engine.updateLayer(l.id, { muted: anyDrumUnmuted });
                    }
                  },
                },
                {
                  id: 'eq',
                  title: isMinimal ? '4-Band Studio EQ' : '4-Band Studio-EQ',
                  icon: SlidersHorizontal,
                  color: '#10b981',
                  isOn: !engine.getEffectChain().modules.find(m => m.id === 'eq')?.bypassed,
                  onToggle: () => engine.toggleEffectBypass('eq'),
                },
                {
                  id: 'fxchain',
                  title: isMinimal ? 'Effects Chain' : 'Effektkette',
                  icon: Waves,
                  color: '#14b8a6',
                  isOn: !engine.getEffectChain().modules.find(m => m.id === 'reverb')?.bypassed,
                  onToggle: () => engine.toggleEffectBypass('reverb'),
                },
                {
                  id: 'chaos',
                  title: isMinimal ? 'Organic Modulator' : 'Organischer Attraktor',
                  icon: Sparkles,
                  color: '#ec4899',
                  isOn: chaosEnabled,
                  onToggle: () => setChaosEnabled(prev => !prev),
                },
                {
                  id: 'atmosphere',
                  title: isMinimal ? 'Atmosphere (≤10%)' : 'Atmosphäre (≤10%)',
                  icon: Cloud,
                  color: '#8b5cf6',
                  isOn: session.atmosphere?.kind !== 'off',
                  onToggle: () => {
                    const isOff = session.atmosphere?.kind === 'off';
                    engine.updateSession({
                      atmosphere: {
                        kind: isOff ? 'air' : 'off',
                        level: Math.min(0.10, session.atmosphere?.level ?? 0.06),
                        tone: session.atmosphere?.tone ?? 0.5,
                        movement: session.atmosphere?.movement ?? 0.4,
                      },
                    });
                  },
                },
                {
                  id: 'custommacros',
                  title: isMinimal ? 'Custom Macros' : 'Eigene Makros',
                  icon: Cpu,
                  color: '#e11d48',
                  isOn: customMacrosEnabled,
                  onToggle: () => setCustomMacrosEnabled(prev => !prev),
                },
              ].map(d => {
                const IconComponent = d.icon;
                const isSelected = activeDrawer === d.id;
                return (
                  <div
                    key={d.id}
                    className={`drawer-tab-item ${isSelected ? 'is-active' : ''} ${!d.isOn ? 'is-module-off' : ''}`}
                    onClick={() => setActiveDrawer(isSelected ? null : d.id)}
                    role="tab"
                    aria-selected={isSelected}
                    title={isMinimal ? `${d.title} (Click to open)` : `${d.title} (Klicken zum Öffnen)`}
                  >
                    <div className="drawer-tab-main">
                      <IconComponent size={14} style={{ color: d.color }} />
                      <span className="drawer-tab-title">{d.title}</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={d.isOn}
                      className={`hardware-switch-pill ${d.isOn ? 'is-on' : 'is-off'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        d.onToggle();
                      }}
                      title={isMinimal ? `Turn ${d.title} ${d.isOn ? 'off' : 'on'}` : `${d.title} ${d.isOn ? 'ausschalten' : 'einschalten'}`}
                    >
                      <span className="switch-dot" />
                      <span>{d.isOn ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Active Drawer Panel Container */}
            {activeDrawer && (
              <div className="drawer-panel-body" role="tabpanel">
                {activeDrawer === 'soundscape' && (
                  <SoundscapeDeck session={session} position={position} onClose={() => setActiveDrawer(null)} />
                )}
                {activeDrawer === 'sequencer' && (
                  <SequencerDeck session={session} position={position} onClose={() => setActiveDrawer(null)} />
                )}
                {activeDrawer === 'score' && (
                  <div className="jam-layout">
                    <section className="score-panel">
                      <header className="panel-heading">
                        <div>
                          <span className="eyebrow">{isMinimal ? (live ? 'PLAYED NOTES' : 'SCENE PREVIEW · NOT YET PLAYED') : (live ? 'GESPIELTE NOTEN' : 'SZENENVORSCHAU · NOCH NICHT GESPIELT')}</span>
                          <h2>{isMinimal ? 'Space for your melody.' : 'Platz für deine Melodie.'}</h2>
                        </div>
                        <div className="segmented">
                          <button className={!drums ? 'selected' : ''} onClick={() => { setDrums(false); setFocusTrack(''); }}>Keys</button>
                          <button className={drums ? 'selected' : ''} onClick={() => { setDrums(true); setFocusTrack(''); }}>Drums</button>
                        </div>
                      </header>
                      <div className="roll-focus">
                        <label>
                          {isMinimal ? 'Focus' : 'Fokus'}{' '}
                          <select aria-label={isMinimal ? 'Piano roll focus' : 'Pianorollen-Fokus'} value={focusTrack} onChange={e => setFocusTrack(e.target.value)}>
                            <option value="">{isMinimal ? 'All Tracks' : 'Alle Spuren'}</option>
                            {session.layers.filter(l => drums ? l.role === 'drum' : l.role !== 'drum').map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                        </label>
                        <span>{isMinimal ? 'Octaves as in Ableton · MIDI 60 = C3' : 'Oktaven wie in Ableton · MIDI 60 = C3'}</span>
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
                          <span className="helper">{isMinimal ? 'Now' : 'Jetzt'}</span>
                          <strong>{position.chord || pitch(session.root) + ' ' + session.scale}</strong>
                        </div>
                        <span className="helper">
                          {isMinimal
                            ? (live ? `Live · 8 Bars · ${position.voices} Voices` : 'Start the jam to see the live sequence.')
                            : (live ? `Live · 8 Takte · ${position.voices} Stimmen` : 'Starte den Jam, um den tatsächlichen Verlauf zu sehen.')}
                        </span>
                      </footer>
                    </section>
                    <aside className="layers-panel">
                      <header className="panel-heading">
                        <div>
                          <span className="eyebrow">{isMinimal ? 'THE ENSEMBLE' : 'DAS ENSEMBLE'}</span>
                          <h2>{isMinimal ? 'In Balance.' : 'In Balance.'}</h2>
                        </div>
                        <button className="icon-button" aria-label={isMinimal ? 'Open track details' : 'Spurdetails öffnen'} onClick={() => setTab('details')}>
                          <SlidersHorizontal />
                        </button>
                      </header>
                      <div className="layers-list">
                        {session.layers.map(layer => (
                          <LayerRow key={layer.id} layer={layer} />
                        ))}
                      </div>
                      <footer className="helper layer-legend">
                        <LockKeyhole size={13} /> {isMinimal ? 'Protect parameters' : 'Parameter schützen'} <Snowflake size={13} /> {isMinimal ? 'Repeat phrase' : 'Phrase wiederholen'}
                      </footer>
                    </aside>
                  </div>
                )}
                {activeDrawer === 'rhythms' && (
                  <RhythmPoolDeck session={session} position={position} onClose={() => setActiveDrawer(null)} />
                )}
                {activeDrawer === 'eq' && (
                  <EqualizerDeck session={session} onClose={() => setActiveDrawer(null)} />
                )}
                {activeDrawer === 'fxchain' && (
                  <EffectChainDeck session={session} />
                )}
                {activeDrawer === 'chaos' && (
                  <ChaosModulatorDeck session={session} enabled={chaosEnabled} onToggleEnabled={setChaosEnabled} />
                )}
                {activeDrawer === 'atmosphere' && (
                  <AtmosphereFlow session={session} />
                )}
                {activeDrawer === 'custommacros' && (
                  <CustomMacroDeck session={session} />
                )}
              </div>
            )}
          </section>

          <PinnedParameters session={session} />

          {/* 24 Ausgangspunkte / Szenen */}
          <section className="scene-section">
            <div className="section-intro">
              <span className="eyebrow">{isMinimal ? 'WHERE TO GO?' : 'WO SOLL ES HINGEHEN?'}</span>
              <h2>{isMinimal ? <>Twenty-four starting points.<br/>Countless paths.</> : <>Sechzehn Ausgangspunkte.<br/>Unzählige Abzweigungen.</>}</h2>
              <p>{isMinimal ? 'A scene gives the jam its character. Evolve explores it further.' : 'Eine Szene gibt dem Jam einen Charakter. Evolve erkundet ihn weiter.'}</p>
            </div>
            <div className="scene-list">
              {SCENES.map((s, i) => {
                const disp = getSceneDisplay(s, uiEdition);
                return (
                <button
                  key={s.id}
                  className={'scene-row ' + (s.id === session.sceneId ? 'selected' : '')}
                  onClick={() => {
                    void act(async () => {
                      await engine.loadScene(s.id);
                      message(isMinimal ? 'Scene loaded · Key and tempo from preset.' : 'Szene geladen · Tonart und Tempo aus dem Preset.');
                    });
                  }}
                >
                  <span className="mono scene-index">{String(i + 1).padStart(2, '0')}</span>
                  <strong>{disp.name}</strong>
                  <span className="scene-style">{disp.mood || s.style} · {s.bpm}</span>
                  <ArrowUpRight />
                </button>
                );
              })}
            </div>
          </section>
        </>
      )}
      {tab === 'library' && <section className="library-section"><header className="panel-heading"><div><span className="eyebrow">{isMinimal ? 'YOUR MOMENTS' : 'DEINE MOMENTE'}</span><h2>{isMinimal ? 'What should stay.' : 'Was bleiben soll.'}</h2><p className="helper">{isMinimal ? 'Capture records played notes, including tempo and shared track timing.' : 'Capture hält gespielte Noten fest, inklusive Tempo und gemeinsamer Spurposition.'}</p></div><button className="button" onClick={() => midiInput.current?.click()}><Upload /> {isMinimal ? 'Open MIDI' : 'MIDI öffnen'}</button></header>{library.length ? <div className="clip-list">{library.map(clip => <article className="clip-row" key={clip.id}><span className="clip-symbol"><Music2 /></span><div><h3>{clip.name}</h3><p>{Number((clip.lengthBeats/4).toFixed(1))} {isMinimal ? 'bars' : 'Takte'} · {clip.notes.length} {isMinimal ? 'notes' : 'Noten'} · {clip.bpm} BPM · {new Date(clip.createdAt).toLocaleDateString(isMinimal ? 'en-US' : 'de-DE')}</p></div><button className="button" onClick={() => setEditor(clip)}>{isMinimal ? 'Open' : 'Öffnen'} <ArrowUpRight /></button><button className="icon-button" aria-label={(isMinimal ? 'Export MIDI: ' : 'MIDI exportieren: ')+clip.name} onClick={() => exportClip(clip)}><Download /></button><button className="icon-button" aria-label={(isMinimal ? 'Delete clip: ' : 'Clip löschen: ')+clip.name} onClick={() => { const next = library.filter(c => c.id !== clip.id); const error = saveLibrary(next); if(error) message(error); else setLibrary(next); }}><Trash2 /></button></article>)}</div> : <div className="empty-library"><Music2 /><h3>{isMinimal ? 'A good moment deserves a home.' : 'Ein guter Moment verdient ein Zuhause.'}</h3><p>{isMinimal ? 'Start a jam and press Capture, or open a MIDI file.' : 'Starte einen Jam und drücke Capture. Oder öffne eine MIDI-Datei.'}</p><button className="button" onClick={() => { setTab('jam'); void toggle(); }}><Play /> {isMinimal ? 'Back to Jam' : 'Zurück zum Jam'}</button></div>}<p className="helper">{isMinimal ? 'Stored locally in this browser · max 128 clips. Export important takes as MIDI before clearing browser data.' : 'Lokal in diesem Browser gespeichert · maximal 128 Clips. Exportiere wichtige Takes als MIDI, bevor du Browserdaten löschst.'}</p></section>}
      {tab === 'details' && <section className="details-section"><div className="details-intro"><span className="eyebrow">{isMinimal ? 'YOUR INSTRUMENT, YOUR RULES' : 'DEIN INSTRUMENT, DEINE REGELN'}</span><h2>{isMinimal ? <>More control.<br/>When you need it.</> : <>Mehr Kontrolle.<br/>Wenn du sie brauchst.</>}</h2><p>{isMinimal ? 'Key and tempo stay locked during Evolve. Lock protects parameters; Freeze holds a four-bar phrase.' : 'Tonart und Tempo bleiben bei Evolve stabil. Lock schützt Parameter; Freeze hält eine Vier-Takt-Phrase fest.'}</p></div><div className="global-settings"><h3>{isMinimal ? 'Musical Framework' : 'Musikalischer Rahmen'}</h3><div className="settings-grid"><label>{isMinimal ? 'Root' : 'Grundton'}<select value={((session.root % 12)+12)%12} onChange={e => engine.updateSession({root:Math.floor(session.root/12)*12+Number(e.target.value)})}>{Array.from({length:12},(_,i)=>48+i).map(n=><option key={n} value={n%12}>{pitch(n)}</option>)}</select></label><label>{isMinimal ? 'Scale' : 'Skala'}<select value={session.scale} onChange={e => engine.updateSession({scale:e.target.value as MusicalScale})}>{SCALES.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>Swing<Range value={session.swing} max={.6} onChange={n=>engine.updateSession({swing:n})}/></label><label>{isMinimal ? 'Master (Audio)' : 'Master (Audio)'}<Range value={session.volume} onChange={n=>engine.updateSession({volume:n})}/></label></div><div className="toggle-row"><label><input type="checkbox" checked={session.evolving} onChange={e=>engine.updateSession({evolving:e.target.checked})}/> {isMinimal ? 'Slow Evolve' : 'Langsame Entwicklung'}</label><label><input type="checkbox" checked={session.lowResource} onChange={e=>engine.updateSession({lowResource:e.target.checked})}/> {isMinimal ? 'Low Resource Mode' : 'Ressourcen sparen'}</label></div><h3>{isMinimal ? 'Macros on Main Page' : 'Makros auf der Hauptseite'}</h3><div className="pin-list">{MACROS.map(m=><button className={'button '+(session.pinned.includes(m.id)?'active':'')} key={m.id} onClick={()=>engine.updateSession({pinned:session.pinned.includes(m.id)?session.pinned.filter(id=>id!==m.id):[...session.pinned,m.id]})}><Pin />{isMinimal ? MINIMAL_MACROS[m.id].name : m.name}</button>)}</div><div className="details-actions"><button className="button" onClick={()=>{const error=persistSession(engine.saveSession()); message(error||(isMinimal ? 'Session saved.' : 'Session gespeichert.'));}}><Save/>{isMinimal ? 'Save Session' : 'Session sichern'}</button><button className="button" onClick={()=>exportJson(engine.saveSession(),'instajammable-session.json')}><Download/>{isMinimal ? 'Export Session' : 'Session exportieren'}</button><button className="button" onClick={()=>sessionInput.current?.click()}><Upload/>{isMinimal ? 'Open Session' : 'Session öffnen'}</button><button className="button" onClick={()=>{engine.panic();message(isMinimal ? 'All notes stopped.' : 'Alle von der App gesendeten Noten beendet.');}}><Square/>Panic</button></div><div className="change-history"><h3>{isMinimal ? 'Recent Changes' : 'Zuletzt im Jam'}</h3>{session.changes.length?session.changes.slice(-5).reverse().map(c=><p key={c.id}><span className="mono">{isMinimal ? 'Bar' : 'Takt'} {Math.floor(c.beat/4)+1}</span>{c.label}</p>):<p>{isMinimal ? 'Changes to motifs, harmony, and freeze appear here.' : 'Änderungen an Motiven, Harmonie und Freeze erscheinen hier.'}</p>}</div></div><div className="layer-details">{session.layers.map(layer=><LayerDetails key={layer.id} layer={layer} outputs={outputs}/>)}<SoundLab session={session}/></div></section>}
      <footer className="app-footer"><span>Made for the moment.</span><span className="mono">Seed {session.seed} · {position.capturedBars.toFixed(1)} {isMinimal ? 'bars captured' : 'Takte im Capture'}</span><button onClick={()=>setRouting(true)}>{isMinimal ? 'MIDI & Routing' : 'Ableton & MIDI'} <ArrowUpRight size={14}/></button></footer>
    </main>
    <input ref={midiInput} className="file-input" type="file" accept=".mid,.midi,audio/midi" onChange={e=>{void importMidi(e.target.files?.[0]);e.target.value='';}}/>
    <input ref={sessionInput} className="file-input" type="file" accept=".json" onChange={e=>{const file=e.target.files?.[0]; if(file)void act(async()=>{if(file.size>10_000_000)throw new Error(isMinimal ? 'Session file too large.' : 'Session zu groß.');engine.loadSession(JSON.parse(await file.text()));message(isMinimal ? 'Session loaded.' : 'Session geladen.');});e.target.value='';}}/>
    <div className={'toast '+(toast?'visible':'')} role="status" aria-live="polite">{toast}</div>
    {recording.lastError && <div className="recording-notice" role="status">{recording.lastError}</div>}
    {editor && <ClipEditor key={editor.id} clip={editor} onClose={()=>setEditor(null)} onSave={keepClip} onExport={(clip,layerId)=>exportClip(clip,layerId)} onPreview={clip=>{void act(()=>engine.previewClip(clip));}} onStopPreview={stopPreview} onApply={clip=>{void act(async()=>{engine.setClipOverride(validateClip(clip));if(!engine.getPosition().playing)await engine.start();message(isMinimal ? 'Your clip takes over at the next bar.' : 'Dein Clip übernimmt ab dem nächsten Takt.');});}} onAudition={n=>{void act(()=>engine.auditionNote(n));}}/>}
    {routing && <Routing session={session} outputs={outputs} outputId={outputId} midiStatus={midiStatus} onClose={closeRouting} onMode={changeOutputMode} onConnect={()=>void connectMidi()} onOutput={id=>{engine.updateSession({globalOutputId:id||null});setOutputId(id);}} onTest={()=>{const r=engine.midi.sendTestNote();message(r.success?(isMinimal ? 'Test notes sent to ' : 'Testnoten gesendet an ')+r.portName:r.error||(isMinimal ? 'MIDI test failed.' : 'MIDI-Test fehlgeschlagen.'));}}/>}
    <PresetsSettingsModal
      isOpen={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      session={session}
      onToast={message}
    />
  </div></UiEditionContext.Provider>;
}

function Range({value,onChange,max=1}:{value:number;onChange:(n:number)=>void;max?:number}) {return <div className="range-value"><input type="range" min={0} max={max} step={.01} value={value} onChange={e=>onChange(Number(e.target.value))}/><output>{Math.round(value*100)}%</output></div>;}
function LayerRow({layer}:{layer:JamLayer}) {const isMinimal=useUiEdition()==='minimal';return <div className={'layer-row '+(layer.muted?'muted':'')} style={{'--layer-color':layer.color} as React.CSSProperties}><span className="layer-color"/><div className="layer-main"><strong>{layer.name}</strong><input aria-label={layer.name+(isMinimal?' internal volume':' Lautstärke intern')} type="range" min={0} max={1} step={.01} value={Math.min(1,layer.volume)} onChange={e=>engine.updateLayer(layer.id,{volume:Number(e.target.value)})}/></div><div className="layer-controls"><button className={layer.muted?'active':''} aria-label={layer.name+(isMinimal?' mute':' stummschalten')} aria-pressed={layer.muted} onClick={()=>engine.updateLayer(layer.id,{muted:!layer.muted})}>M</button><button className={layer.solo?'active':''} aria-label={layer.name+' solo'} aria-pressed={layer.solo} onClick={()=>engine.updateLayer(layer.id,{solo:!layer.solo})}>S</button><button className={layer.locked?'active':''} aria-label={layer.name+(isMinimal?' lock parameters':' Parameter schützen')} aria-pressed={layer.locked} onClick={()=>engine.updateLayer(layer.id,{locked:!layer.locked})}><LockKeyhole size={13}/></button><button className={layer.frozen?'active':''} aria-label={layer.name+(isMinimal?' freeze phrase':' Phrase einfrieren')} aria-pressed={layer.frozen} onClick={()=>engine.updateLayer(layer.id,{frozen:!layer.frozen})}><Snowflake size={13}/></button></div></div>;}
function LayerDetails({layer,outputs}:{layer:JamLayer;outputs:{id:string;name:string}[]}) {const isMinimal=useUiEdition()==='minimal';const s=layer.settings;const timbreNames=isMinimal?TIMBRE_NAMES_EN:TIMBRE_NAMES;return <details className="layer-detail"><summary><span style={{background:layer.color}} className="layer-color"/><strong>{layer.name}</strong><span className="helper">{layer.role} · {isMinimal?'Ch':'Kanal'} {layer.channel}</span><SlidersHorizontal size={16}/></summary><div className="settings-grid"><label>{isMinimal?'Density':'Dichte'}<Range value={s.density} onChange={n=>engine.setLayerSettings(layer.id,{density:n})}/></label>{layer.role==='drum'&&<label>{isMinimal?'Rhythm Generator':'Rhythmusgenerator'}<select value={s.rhythmAlgorithm||'composed'} onChange={e=>engine.setLayerSettings(layer.id,{rhythmAlgorithm:e.target.value as typeof s.rhythmAlgorithm})}>{[['composed',isMinimal?'Composed Groove':'Komponierter Groove'],['euclidean','Euclidean'],['probabilistic','Probabilistic'],['polymetric','Polymetric'],['markov','Markov'],['densityBurst','Density Burst']].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>}<label>{isMinimal?'Evolve Density Min':'Evolve-Dichte von'}<Range value={s.mutationDensityMin??0} onChange={n=>engine.setLayerSettings(layer.id,{mutationDensityMin:Math.min(n,s.mutationDensityMax??1)})}/></label><label>{isMinimal?'Evolve Density Max':'Evolve-Dichte bis'}<Range value={s.mutationDensityMax??1} onChange={n=>engine.setLayerSettings(layer.id,{mutationDensityMax:Math.max(n,s.mutationDensityMin??0)})}/></label><label>{isMinimal?'Register Min':'Register von'}<input type="number" min={0} max={s.maxNote} value={s.minNote} onChange={e=>engine.setLayerSettings(layer.id,{minNote:Math.min(s.maxNote,Math.max(0,Number(e.target.value)))})}/></label><label>{isMinimal?'Register Max':'Register bis'}<input type="number" min={s.minNote} max={127} value={s.maxNote} onChange={e=>engine.setLayerSettings(layer.id,{maxNote:Math.max(s.minNote,Math.min(127,Number(e.target.value)))})}/></label><label>Phrase<select value={s.phraseBars} onChange={e=>engine.setLayerSettings(layer.id,{phraseBars:Number(e.target.value)})}>{[2,4,8,16].map(n=><option key={n} value={n}>{n} {isMinimal?'Bars':'Takte'}</option>)}</select></label><label>{isMinimal?'Velocity Min':'Velocity von'}<input type="number" min={1} max={s.velocityMax} value={s.velocityMin} onChange={e=>engine.setLayerSettings(layer.id,{velocityMin:Math.min(s.velocityMax,Math.max(1,Number(e.target.value)))})}/></label><label>{isMinimal?'Velocity Max':'Velocity bis'}<input type="number" min={s.velocityMin} max={127} value={s.velocityMax} onChange={e=>engine.setLayerSettings(layer.id,{velocityMax:Math.max(s.velocityMin,Math.min(127,Number(e.target.value)))})}/></label><label>Humanize (ms)<input type="number" min={0} max={30} value={s.humanizeMs} onChange={e=>engine.setLayerSettings(layer.id,{humanizeMs:Math.min(30,Math.max(0,Number(e.target.value)))})}/></label><label>{isMinimal?'Timbre':'Klangfarbe'}<select value={s.timbre} onChange={e=>engine.setLayerSettings(layer.id,{timbre:e.target.value as typeof s.timbre})}>{TIMBRES.map(t=><option key={t} value={t}>{timbreNames[t]}</option>)}</select></label><label>{isMinimal?'MIDI Channel':'MIDI-Kanal'}<input type="number" min={1} max={16} value={layer.channel} onChange={e=>engine.updateLayer(layer.id,{channel:Math.max(1,Math.min(16,Number(e.target.value)))})}/></label><label>{isMinimal?'MIDI Output':'MIDI-Ausgang'}<select value={layer.outputId||''} onChange={e=>engine.updateLayer(layer.id,{outputId:e.target.value||null})}><option value="">{isMinimal?'Global Output':'Globaler Ausgang'}</option>{layer.outputId&&!outputs.some(o=>o.id===layer.outputId)&&<option value={layer.outputId}>{isMinimal?'Saved port · disconnected':'Gespeicherter Port · nicht verbunden'}</option>}{outputs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label></div></details>;}
function Routing({session,outputs,outputId,midiStatus,onClose,onMode,onConnect,onOutput,onTest}:{session:JamSession;outputs:{id:string;name:string}[];outputId:string;midiStatus:string;onClose:()=>void;onMode:(mode:JamSession['outputMode'])=>void;onConnect:()=>void;onOutput:(id:string)=>void;onTest:()=>void}) {
  const isMinimal=useUiEdition()==='minimal';
  const ref=useRef<HTMLElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement;ref.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const nodes=[...ref.current!.querySelectorAll<HTMLElement>('button,input,select')];const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};ref.current?.addEventListener('keydown',key);const current=ref.current;return()=>{current?.removeEventListener('keydown',key);previous?.focus();};},[onClose]);
  return <div className="modal-scrim"><section ref={ref} className="routing-dialog" role="dialog" aria-modal="true" aria-labelledby="routing-title" tabIndex={-1}><header className="editor-header"><div><span className="eyebrow">{isMinimal?'SIGNAL PATH':'DEIN SIGNALWEG'}</span><h2 id="routing-title">{isMinimal?'From Browser to Studio.':'Vom Browser ins Studio.'}</h2></div><button className="icon-button" aria-label={isMinimal?'Close routing':'Routing schließen'} onClick={onClose}><X/></button></header><div className="routing-content"><label>{isMinimal?'Playback':'Wiedergabe'}<select value={session.outputMode} onChange={e=>onMode(e.target.value as JamSession['outputMode'])}><option value="internal">{isMinimal?'Internal Audio':'Internes Audio'}</option><option value="midi">MIDI</option><option value="both">Audio + MIDI</option></select></label><div className="midi-connect"><button className="button" onClick={onConnect}><Radio/>{midiStatus==='ready'?(isMinimal?'Refresh MIDI':'MIDI aktualisieren'):(isMinimal?'Connect MIDI':'MIDI verbinden')}</button><span className="helper">Status: {midiStatus}</span></div><label>{isMinimal?'Global MIDI Output':'Globaler MIDI-Ausgang'}<select value={outputId} onChange={e=>onOutput(e.target.value)}><option value="">{isMinimal?'Off':'Aus'}</option>{outputId&&!outputs.some(o=>o.id===outputId)&&<option value={outputId}>{isMinimal?'Saved port · disconnected':'Gespeicherter Port · nicht verbunden'}</option>}{outputs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><button className="button" disabled={!outputId} onClick={onTest}><Volume2/>{isMinimal?'Test Note (Ch 1 + 10)':'Testnote (Kanal 1 + 10)'}</button><div className="toggle-row"><label><input type="checkbox" checked={session.deepMindEnabled} onChange={e=>engine.updateSession({deepMindEnabled:e.target.checked})}/> {isMinimal?'Enable DeepMind CC Modulation':'DeepMind-CC-Modulation aktivieren'}</label><label>{isMinimal?'Channel':'Kanal'}<input type="number" min={1} max={16} value={session.deepMindChannel} onChange={e=>engine.updateSession({deepMindChannel:Math.max(1,Math.min(16,Number(e.target.value)))})}/></label></div><p className="helper">{isMinimal?'Levels, synthesis, and effects shape internal audio. External MIDI sound and volume are controlled in your DAW/synth; velocity limits in Details affect sent notes.':'Pegel, Synthese und Effekte formen das interne Audio. MIDI-Klang und Lautstärke steuerst du in deinem Instrument; die Velocity-Grenzen unter Details verändern gesendete Noten.'}</p><p className="helper">{isMinimal?'Only enable CC modulation if the receiving device matches its CC mapping. Per-track outputs are in Details.':'CC-Modulation nur aktivieren, wenn das empfangende Gerät und seine CC-Zuordnung stimmen. Einzelne Spur-Ausgänge findest du unter Details.'}</p><div className="connection-guide"><h3><Headphones/>{isMinimal?'DAW / Ableton Live Setup':'Ableton Live Standard'}</h3><ol><li>{isMinimal?'macOS Audio MIDI Setup → MIDI Studio → IAC Driver → "Device is online".':'Audio-MIDI-Setup → MIDI-Studio → IAC-Treiber → „Gerät ist online“.'}</li><li>{isMinimal?'In Live: enable Track for the IAC input. Enable Remote only for custom MIDI mappings.':'In Live: IAC-Eingang Track einschalten. Remote nur für deine eigenen MIDI-Zuweisungen einschalten.'}</li><li>{isMinimal?'Instrument tracks: MIDI From IAC, Ch 1 for Texture/Chords, 2 Melody, 3 Bass, 10 Drums.':'Instrumentenspuren: MIDI From IAC, Kanal 1 für Texture/Chords, 2 für Melody, 3 für Bass, 10 für Drums. Monitor In oder Auto + Aufnahmebereitschaft.'}</li><li>{isMinimal?'Connect MIDI here and choose IAC, then record or import exported MIDI clips.':'In der App MIDI verbinden und IAC wählen. Danach Live aufnehmen oder MIDI aus der Sammlung importieren.'}</li></ol></div></div></section></div>;
}

const TIMBRE_NAMES: Record<(typeof TIMBRES)[number], string> = { warm: 'Warm', air: 'Luftig', keys: 'Keys', bell: 'Glocke', strings: 'Streicher', wash: 'Wash · breite Fläche', dub: 'Dub · Akkord-Stab', root: 'Root · tiefer Anker', glass: 'Glass · glasig, schimmernd', organ: 'Orgel · weich, tragend', solina: 'Solina · analoges Ensemble', shimmer: 'Shimmer · kristalline Obertöne', celeste: 'Celeste · gefilztes Piano/Glocke' };
const TIMBRE_NAMES_EN: Record<(typeof TIMBRES)[number], string> = { warm: 'Warm', air: 'Airy', keys: 'Keys', bell: 'Bell', strings: 'Strings', wash: 'Wash · Wide Pad', dub: 'Dub · Chord Stab', root: 'Root · Deep Anchor', glass: 'Glass · Shimmering', organ: 'Organ · Soft Sustained', solina: 'Solina · Analog Ensemble', shimmer: 'Shimmer · Crystalline', celeste: 'Celeste · Felted Piano/Bell' };

