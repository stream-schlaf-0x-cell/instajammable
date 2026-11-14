import { useState, useRef, useEffect } from 'react';
import { X, Play, Square, Download, Save, Copy, Trash2, Undo2, Redo2, Plus, Repeat2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MidiClip, ClipNote } from '../../types/jam';
import { JamEngine } from '../../engine/jam/JamEngine';
import { PianoRoll, noteName } from './PianoRoll';
import { useUiEdition } from '../../contexts/UiEditionContext';

interface Props {
  clip: MidiClip;
  onClose: () => void;
  onSave: (clip: MidiClip) => void;
  onExport: (clip: MidiClip, layerId?: string) => void;
  onPreview: (clip: MidiClip) => void;
  onStopPreview: () => void;
  onApply: (clip: MidiClip) => void;
  onAudition: (note: number) => void;
}
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const uid = () => 'note-' + crypto.randomUUID();
const DRUM_TRACK_IDS = new Set(['kick', 'snare', 'hihat', 'perc', 'editor-drums']);
const isDrumTrack = (t: MidiClip['tracks'][number]): boolean =>
  t.channel === 10 || DRUM_TRACK_IDS.has(t.id) || /kick|snare|hat|perc|drum/i.test(t.name);

export function ClipEditor({ clip: original, onClose, onSave, onExport, onPreview, onStopPreview, onApply, onAudition }: Props) {
  const isMinimal = useUiEdition() === 'minimal';
  const [clip, setClip] = useState(() => copy(original));
  const [selected, setSelected] = useState<string | null>(null);
  const [grid, setGrid] = useState(.25);
  const [drums, setDrums] = useState(false);
  const [focus, setFocus] = useState('');
  const [viewStart, setViewStart] = useState(0);
  const [span, setSpan] = useState(32);
  const [trackId, setTrackId] = useState((original.tracks.find(t=>t.id==='melody')||original.tracks.find(t => !isDrumTrack(t)))?.id || original.tracks[0]?.id || 'melody');
  const [preview, setPreview] = useState(false);
  const [selectedAll, setSelectedAll] = useState(false);
  const [revision, setRevision] = useState(0);
  const past = useRef<MidiClip[]>([]), future = useRef<MidiClip[]>([]);
  const note = clip.notes.find(n => n.id === selected);
  const track = clip.tracks.find(t => t.id === trackId) || clip.tracks[0];
  const snapshot = () => { past.current.push(copy(clip)); past.current = past.current.slice(-40); future.current = []; setRevision(r => r + 1); };
  const replace = (next: MidiClip) => { snapshot(); setClip(next); };
  const changeNote = (next: ClipNote, record = true) => {
    const prev = clip.notes.find(v => v.id === next.id);
    const rawNote = Number.isFinite(next.note) ? next.note : (prev?.note ?? 60);
    const rawVelocity = Number.isFinite(next.velocity) ? next.velocity : (prev?.velocity ?? 80);
    const rawStart = Number.isFinite(next.startBeat) ? next.startBeat : (prev?.startBeat ?? 0);
    const rawDuration = Number.isFinite(next.durationBeats) ? next.durationBeats : (prev?.durationBeats ?? 0.5);
    const rawChannel = Number.isFinite(next.channel) ? next.channel : (prev?.channel ?? 1);
    if (record) snapshot();
    const n = { ...next, note: Math.round(Math.min(127, Math.max(0, rawNote))), velocity: Math.round(Math.min(127, Math.max(1, rawVelocity))), startBeat: Math.max(0, rawStart), durationBeats: Math.max(.0625, rawDuration), channel: Math.round(Math.min(16, Math.max(1, rawChannel))) };
    setClip(current => ({ ...current, lengthBeats: Math.max(current.lengthBeats, Math.ceil((n.startBeat + n.durationBeats) / 4) * 4), notes: current.notes.map(v => v.id === n.id ? n : v) }));
  };
  const add = (beat = viewStart, pitch = drums ? 36 : 62) => {
    if (!track) return;
    let target = track;
    let tracks = clip.tracks;
    if (drums && !isDrumTrack(track)) { target = clip.tracks.find(isDrumTrack) || {id:'editor-drums',name:'Drums',channel:10,color:'#dba377'}; if(!tracks.some(t=>t.id===target.id))tracks=[...tracks,target]; setTrackId(target.id); }
    const n: ClipNote = { id: uid(), layerId: target.id, channel: target.channel, note: pitch, velocity: 85, startBeat: beat, durationBeats: drums ? .25 : 1 };
    replace({ ...clip, tracks, lengthBeats: Math.max(clip.lengthBeats, Math.ceil((beat + n.durationBeats) / 4) * 4), notes: [...clip.notes, n] });
    setSelected(n.id); setSelectedAll(false);
  };
  const remove = () => { replace({ ...clip, notes: selectedAll ? [] : clip.notes.filter(n => n.id !== selected) }); setSelected(null); setSelectedAll(false); };
  const duplicate = () => {
    const source = selectedAll ? clip.notes : note ? [note] : [];
    if (!source.length) return;
    const shift = selectedAll ? clip.lengthBeats : Math.max(grid, note!.durationBeats);
    const extras = source.map(n => ({ ...n, id: uid(), startBeat: n.startBeat + shift }));
    replace({ ...clip, lengthBeats: extras.reduce((end,n)=>Math.max(end,Math.ceil((n.startBeat+n.durationBeats)/4)*4),clip.lengthBeats), notes: [...clip.notes, ...extras] });
    setSelected(extras[0].id);
  };
  const undo = () => { const previous = past.current.pop(); if (previous) { future.current.push(copy(clip)); setClip(previous); setRevision(r => r + 1); } };
  const redo = () => { const next = future.current.pop(); if (next) { past.current.push(copy(clip)); setClip(next); setRevision(r => r + 1); } };
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandlerRef.current = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if ((e.target as HTMLElement)?.matches('input,select,textarea')) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelectedAll(true); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); if (note || selectedAll) remove(); }
    if (note && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault(); changeNote({ ...note, startBeat: note.startBeat + (e.key === 'ArrowLeft' ? -grid : e.key === 'ArrowRight' ? grid : 0), note: note.note + (e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0) });
    }
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  useEffect(() => JamEngine.getInstance().onPreviewChange(setPreview), []);
  useEffect(() => () => onStopPreview(), [onStopPreview]);
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    const dialog = document.querySelector<HTMLElement>('.clip-editor');
    dialog?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,[tabindex="0"]')];
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    dialog?.addEventListener('keydown', trap);
    return () => { dialog?.removeEventListener('keydown', trap); before?.focus(); };
  }, []);
  return <div className="modal-scrim">
    <section className="clip-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title" tabIndex={-1} data-revision={revision}>
      <header className="editor-header"><div><span className="eyebrow">{isMinimal ? 'MIDI EDITOR' : 'DEIN MOMENT · MIDI EDITOR'}</span><h2 id="editor-title">{isMinimal ? 'Edit MIDI' : 'MIDI bearbeiten'}</h2><input className="clip-name-input" aria-label={isMinimal ? 'Clip name' : 'Clipname'} value={clip.name} onChange={e=>replace({...clip,name:e.target.value})}/></div><button className="icon-button" aria-label={isMinimal ? 'Close editor' : 'Editor schließen'} onClick={onClose}><X /></button></header>
      <div className="editor-toolbar">
        <button className={'button ' + (preview ? 'active' : '')} onClick={() => { if (preview) onStopPreview(); else onPreview(clip); setPreview(!preview); }}>{preview ? <Square /> : <Play />} {isMinimal ? (preview ? 'Stop Preview' : 'Preview') : (preview ? 'Vorhören stoppen' : 'Vorhören')}</button>
        <div className="segmented"><button className={!drums ? 'selected' : ''} onClick={() => {setDrums(false);setFocus('');const t=clip.tracks.find(tr=>!isDrumTrack(tr));if(t)setTrackId(t.id);}}>Keys</button><button className={drums ? 'selected' : ''} onClick={() => {setDrums(true);setFocus('');const t=clip.tracks.find(isDrumTrack);if(t)setTrackId(t.id);}}>Drums</button></div>
        <label>{isMinimal ? 'Target track' : 'Neue Noten auf'} <select value={trackId} onChange={e => setTrackId(e.target.value)}>{clip.tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label>{isMinimal ? 'Grid' : 'Raster'} <select value={grid} onChange={e => setGrid(Number(e.target.value))}><option value={.0625}>1/64</option><option value={.125}>1/32</option><option value={.25}>1/16</option><option value={.5}>1/8</option><option value={1}>1/4</option></select></label>
        <button className="icon-button" disabled={!past.current.length} onClick={undo} aria-label={isMinimal ? 'Undo edit' : 'Bearbeitung rückgängig'}><Undo2 /></button><button className="icon-button" disabled={!future.current.length} onClick={redo} aria-label={isMinimal ? 'Redo edit' : 'Bearbeitung wiederholen'}><Redo2 /></button>
        <button className="button" onClick={() => add()}><Plus /> Note</button>
      </div>
      {clip.warnings?.length ? <p className="notice">{clip.warnings.join(' · ')}</p> : null}
      <div className="roll-focus"><label>{isMinimal ? 'Focus' : 'Fokus'} <select aria-label={isMinimal ? 'Track focus' : 'Editor-Spurfokus'} value={focus} onChange={e=>setFocus(e.target.value)}><option value="">{isMinimal ? 'All tracks' : 'Alle Spuren'}</option>{clip.tracks.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>{!isMinimal && <span>Die Auswahl oben bestimmt das Ziel neuer Noten.</span>}</div><PianoRoll focusedTrack={focus || undefined} notes={clip.notes} tracks={clip.tracks} startBeat={viewStart} span={span} drums={drums} height={430} grid={grid} selectedId={selectedAll ? undefined : selected} onSelect={id => { snapshot(); setSelected(id); setSelectedAll(false); }} onChange={n => changeNote(n, false)} onAdd={add} onAudition={onAudition} />
      <div className="editor-navigation"><button className="icon-button" aria-label={isMinimal ? 'Previous bars' : 'Vorherige Takte'} onClick={() => setViewStart(Math.max(0, viewStart - span))}><ChevronLeft /></button><span>{isMinimal ? 'Bar' : 'Takt'} {Math.floor(viewStart / 4) + 1}–{Math.ceil((viewStart + span) / 4)} · {clip.notes.length} {isMinimal ? 'Notes' : 'Noten'} · {clip.bpm} BPM</span><button className="icon-button" aria-label={isMinimal ? 'Next bars' : 'Nächste Takte'} onClick={() => setViewStart(Math.min(Math.max(0, clip.lengthBeats - span), viewStart + span))}><ChevronRight /></button><label>{isMinimal ? 'View' : 'Ansicht'} <select value={span} onChange={e => { const nextSpan = Number(e.target.value); setSpan(nextSpan); setViewStart(v => Math.min(v, Math.max(0, clip.lengthBeats - nextSpan))); }}><option value={8}>2 {isMinimal ? 'Bars' : 'Takte'}</option><option value={16}>4 {isMinimal ? 'Bars' : 'Takte'}</option><option value={32}>8 {isMinimal ? 'Bars' : 'Takte'}</option><option value={64}>16 {isMinimal ? 'Bars' : 'Takte'}</option></select></label></div>
      <div className="note-inspector">
        <div><span className="eyebrow">{isMinimal ? (selectedAll ? 'ALL NOTES SELECTED' : 'SELECTED NOTE') : (selectedAll ? 'ALLE NOTEN AUSGEWÄHLT' : 'AUSGEWÄHLTE NOTE')}</span><strong>{note ? noteName(note.note) + ' / MIDI ' + note.note : (isMinimal ? 'Click or add a note' : 'Note anklicken oder hinzufügen')}</strong></div>
        {note && <>
          <label>{isMinimal ? 'Pitch' : 'Tonhöhe'}<input aria-label={isMinimal ? 'Note pitch' : 'Tonhöhe der Note'} type="number" min={0} max={127} value={note.note} onChange={e => { const v = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(v)) changeNote({ ...note, note: v }); }} /></label>
          <label>{isMinimal ? 'Start (Beats)' : 'Beginn (Beats)'}<input aria-label={isMinimal ? 'Note start' : 'Beginn der Note'} type="number" min={0} step={grid} value={Number(note.startBeat.toFixed(3))} onChange={e => { const v = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(v)) changeNote({ ...note, startBeat: v }); }} /></label>
          <label>{isMinimal ? 'Length (Beats)' : 'Länge (Beats)'}<input aria-label={isMinimal ? 'Note length' : 'Länge der Note'} type="number" min={.0625} step={grid} value={Number(note.durationBeats.toFixed(3))} onChange={e => { const v = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(v)) changeNote({ ...note, durationBeats: v }); }} /></label>
          <label>Velocity<input aria-label={isMinimal ? 'Note velocity' : 'Velocity der Note'} type="number" min={1} max={127} value={note.velocity} onChange={e => { const v = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(v)) changeNote({ ...note, velocity: v }); }} /></label>
          <label>{isMinimal ? 'Channel' : 'Kanal'}<input aria-label={isMinimal ? 'Note MIDI channel' : 'MIDI-Kanal der Note'} type="number" min={1} max={16} value={note.channel} onChange={e => { const v = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(v)) changeNote({ ...note, channel: v }); }} /></label>
        </>}
        <button className="icon-button" disabled={!note && !selectedAll} onClick={duplicate} aria-label={isMinimal ? 'Duplicate selection' : 'Notenauswahl duplizieren'}><Copy /></button><button className="icon-button" disabled={!note && !selectedAll} onClick={remove} aria-label={isMinimal ? 'Delete selection' : 'Notenauswahl löschen'}><Trash2 /></button>
      </div>
      <footer className="editor-footer"><span className="helper">{isMinimal ? 'Double-click: add note · Arrows: move · Drag: move or resize' : 'Doppelklick: Note hinzufügen · Pfeiltasten: verschieben · Ziehen: bewegen oder Länge ändern'}</span><div><button className="button" onClick={() => { snapshot(); setClip(current => { const notes = current.notes.map(n => ({ ...n, startBeat: Math.max(0, Math.round(n.startBeat / grid) * grid) })); return {...current, notes, lengthBeats: notes.reduce((end,n)=>Math.max(end,Math.ceil((n.startBeat+n.durationBeats)/4)*4),current.lengthBeats)}; }); }}>{isMinimal ? 'Quantize' : 'Quantisieren'}</button><button className="button" onClick={() => onExport(clip)}><Download /> MIDI</button><button className="button" onClick={() => onExport(clip, trackId)}>{isMinimal ? 'Track MIDI' : 'Spur-MIDI'}</button><button className="button" onClick={() => { onSave(clip); }}><Save /> {isMinimal ? 'Save' : 'Speichern'}</button><button className="button primary" onClick={() => { onApply(clip); onClose(); }}><Repeat2 /> {isMinimal ? 'Jam as Loop' : 'Als Loop jammen'}</button></div></footer>
    </section>
  </div>;
}
