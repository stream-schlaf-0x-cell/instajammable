import { useState, useRef, useEffect } from 'react';
import { X, Play, Square, Download, Save, Copy, Trash2, Undo2, Redo2, Plus, Repeat2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MidiClip, ClipNote } from '../../types/jam';
import { PianoRoll, noteName } from './PianoRoll';

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

export function ClipEditor({ clip: original, onClose, onSave, onExport, onPreview, onStopPreview, onApply, onAudition }: Props) {
  const [clip, setClip] = useState(() => copy(original));
  const [selected, setSelected] = useState<string | null>(null);
  const [grid, setGrid] = useState(.25);
  const [drums, setDrums] = useState(false);
  const [focus, setFocus] = useState('');
  const [viewStart, setViewStart] = useState(0);
  const [span, setSpan] = useState(32);
  const [trackId, setTrackId] = useState((original.tracks.find(t=>t.id==='melody')||original.tracks.find(t => t.channel !== 10))?.id || original.tracks[0]?.id || 'melody');
  const [preview, setPreview] = useState(false);
  const [selectedAll, setSelectedAll] = useState(false);
  const [revision, setRevision] = useState(0);
  const past = useRef<MidiClip[]>([]), future = useRef<MidiClip[]>([]);
  const note = clip.notes.find(n => n.id === selected);
  const track = clip.tracks.find(t => t.id === trackId) || clip.tracks[0];
  const snapshot = () => { past.current.push(copy(clip)); past.current = past.current.slice(-40); future.current = []; setRevision(r => r + 1); };
  const replace = (next: MidiClip) => { snapshot(); setClip(next); };
  const changeNote = (next: ClipNote, record = true) => {
    if (record) snapshot();
    const n = { ...next, note: Math.round(Math.min(127, Math.max(0, next.note))), velocity: Math.round(Math.min(127, Math.max(1, next.velocity))), startBeat: Math.max(0, next.startBeat), durationBeats: Math.max(.0625, next.durationBeats), channel: Math.round(Math.min(16, Math.max(1, next.channel))) };
    setClip(current => ({ ...current, lengthBeats: Math.max(current.lengthBeats, Math.ceil((n.startBeat + n.durationBeats) / 4) * 4), notes: current.notes.map(v => v.id === n.id ? n : v) }));
  };
  const add = (beat = viewStart, pitch = drums ? 36 : 62) => {
    if (!track) return;
    let target = track;
    let tracks = clip.tracks;
    if (drums && track.channel !== 10) { target = clip.tracks.find(t=>t.channel===10) || {id:'editor-drums',name:'Drums',channel:10,color:'#dba377'}; if(!tracks.some(t=>t.id===target.id))tracks=[...tracks,target]; setTrackId(target.id); }
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
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if ((e.target as HTMLElement)?.matches('input,select,textarea')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelectedAll(true); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); if (note || selectedAll) remove(); }
      if (note && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault(); changeNote({ ...note, startBeat: note.startBeat + (e.key === 'ArrowLeft' ? -grid : e.key === 'ArrowRight' ? grid : 0), note: note.note + (e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0) });
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  });
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
      <header className="editor-header"><div><span className="eyebrow">DEIN MOMENT · MIDI EDITOR</span><h2 id="editor-title">MIDI bearbeiten</h2><input className="clip-name-input" aria-label="Clipname" value={clip.name} onChange={e=>replace({...clip,name:e.target.value})}/></div><button className="icon-button" aria-label="Editor schließen" onClick={onClose}><X /></button></header>
      <div className="editor-toolbar">
        <button className={'button ' + (preview ? 'active' : '')} onClick={() => { if (preview) onStopPreview(); else onPreview(clip); setPreview(!preview); }}>{preview ? <Square /> : <Play />} {preview ? 'Vorhören stoppen' : 'Vorhören'}</button>
        <div className="segmented"><button className={!drums ? 'selected' : ''} onClick={() => {setDrums(false);setFocus('');const t=clip.tracks.find(t=>t.channel!==10);if(t)setTrackId(t.id);}}>Keys</button><button className={drums ? 'selected' : ''} onClick={() => {setDrums(true);setFocus('');const t=clip.tracks.find(t=>t.channel===10);if(t)setTrackId(t.id);}}>Drums</button></div>
        <label>Neue Noten auf <select value={trackId} onChange={e => setTrackId(e.target.value)}>{clip.tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label>Raster <select value={grid} onChange={e => setGrid(Number(e.target.value))}><option value={.0625}>1/64</option><option value={.125}>1/32</option><option value={.25}>1/16</option><option value={.5}>1/8</option><option value={1}>1/4</option></select></label>
        <button className="icon-button" disabled={!past.current.length} onClick={undo} aria-label="Bearbeitung rückgängig"><Undo2 /></button><button className="icon-button" disabled={!future.current.length} onClick={redo} aria-label="Bearbeitung wiederholen"><Redo2 /></button>
        <button className="button" onClick={() => add()}><Plus /> Note</button>
      </div>
      {clip.warnings?.length ? <p className="notice">{clip.warnings.join(' · ')}</p> : null}
      <div className="roll-focus"><label>Fokus <select aria-label="Editor-Spurfokus" value={focus} onChange={e=>setFocus(e.target.value)}><option value="">Alle Spuren</option>{clip.tracks.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><span>Die Auswahl oben bestimmt das Ziel neuer Noten.</span></div><PianoRoll focusedTrack={focus || undefined} notes={clip.notes} tracks={clip.tracks} startBeat={viewStart} span={span} drums={drums} height={430} grid={grid} selectedId={selectedAll ? undefined : selected} onSelect={id => { snapshot(); setSelected(id); setSelectedAll(false); }} onChange={n => changeNote(n, false)} onAdd={add} onAudition={onAudition} />
      <div className="editor-navigation"><button className="icon-button" aria-label="Vorherige Takte" onClick={() => setViewStart(Math.max(0, viewStart - span))}><ChevronLeft /></button><span>Takt {Math.floor(viewStart / 4) + 1}–{Math.ceil((viewStart + span) / 4)} · {clip.notes.length} Noten · {clip.bpm} BPM</span><button className="icon-button" aria-label="Nächste Takte" onClick={() => setViewStart(Math.min(Math.max(0, clip.lengthBeats - 4), viewStart + span))}><ChevronRight /></button><label>Ansicht <select value={span} onChange={e => setSpan(Number(e.target.value))}><option value={8}>2 Takte</option><option value={16}>4 Takte</option><option value={32}>8 Takte</option><option value={64}>16 Takte</option></select></label></div>
      <div className="note-inspector">
        <div><span className="eyebrow">{selectedAll ? 'ALLE NOTEN AUSGEWÄHLT' : 'AUSGEWÄHLTE NOTE'}</span><strong>{note ? noteName(note.note) + ' / MIDI ' + note.note : 'Note anklicken oder hinzufügen'}</strong></div>
        {note && <>
          <label>Tonhöhe<input aria-label="Tonhöhe der Note" type="number" min={0} max={127} value={note.note} onChange={e => changeNote({ ...note, note: Number(e.target.value) })} /></label>
          <label>Beginn (Beats)<input aria-label="Beginn der Note" type="number" min={0} step={grid} value={Number(note.startBeat.toFixed(3))} onChange={e => changeNote({ ...note, startBeat: Number(e.target.value) })} /></label>
          <label>Länge (Beats)<input aria-label="Länge der Note" type="number" min={.0625} step={grid} value={Number(note.durationBeats.toFixed(3))} onChange={e => changeNote({ ...note, durationBeats: Number(e.target.value) })} /></label>
          <label>Velocity<input aria-label="Velocity der Note" type="number" min={1} max={127} value={note.velocity} onChange={e => changeNote({ ...note, velocity: Number(e.target.value) })} /></label>
          <label>Kanal<input aria-label="MIDI-Kanal der Note" type="number" min={1} max={16} value={note.channel} onChange={e => changeNote({ ...note, channel: Number(e.target.value) })} /></label>
        </>}
        <button className="icon-button" disabled={!note && !selectedAll} onClick={duplicate} aria-label="Notenauswahl duplizieren"><Copy /></button><button className="icon-button" disabled={!note && !selectedAll} onClick={remove} aria-label="Notenauswahl löschen"><Trash2 /></button>
      </div>
      <footer className="editor-footer"><span className="helper">Doppelklick: Note hinzufügen · Pfeiltasten: verschieben · Ziehen: bewegen oder Länge ändern</span><div><button className="button" onClick={() => { snapshot(); setClip(current => { const notes = current.notes.map(n => ({ ...n, startBeat: Math.max(0, Math.round(n.startBeat / grid) * grid) })); return {...current, notes, lengthBeats: notes.reduce((end,n)=>Math.max(end,Math.ceil((n.startBeat+n.durationBeats)/4)*4),current.lengthBeats)}; }); }}>Quantisieren</button><button className="button" onClick={() => onExport(clip)}><Download /> MIDI</button><button className="button" onClick={() => onExport(clip, trackId)}>Spur-MIDI</button><button className="button" onClick={() => { onSave(clip); }}><Save /> Speichern</button><button className="button primary" onClick={() => { onApply(clip); onClose(); }}><Repeat2 /> Als Loop jammen</button></div></footer>
    </section>
  </div>;
}
