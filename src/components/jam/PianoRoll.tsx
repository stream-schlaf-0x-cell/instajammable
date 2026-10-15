import { useRef, useMemo, useState, useEffect } from 'react';
import type { ClipNote } from '../../types/jam';

export const noteName = (n: number) => ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'][((Math.round(n) % 12) + 12) % 12] + (Math.floor(n / 12) - 2);
export interface PianoRollProps {
  notes: ClipNote[];
  tracks: { id: string; name: string; color: string; channel: number; role?: string }[];
  startBeat?: number;
  span?: number;
  cursor?: number;
  drums?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onChange?: (note: ClipNote) => void;
  onAdd?: (beat: number, note: number) => void;
  onAudition?: (note: number) => void;
  grid?: number;
  height?: number;
  focusedTrack?: string;
  /** Pitch class (0-11) of the sounding chord's root; its lanes are tinted amber. */
  rootPitchClass?: number;
  /** MIDI notes of the sounding chord; their pitch classes get a soft tint. */
  chordTones?: number[];
}

export function PianoRoll({ notes, tracks, startBeat = 0, span = 32, cursor, drums = false, selectedId, onSelect, onChange, onAdd, onAudition, grid = 0.25, height = 330, focusedTrack, rootPitchClass, chordTones }: PianoRollProps) {
  const svg = useRef<SVGSVGElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [hover, setHover] = useState<ClipNote | null>(null);
  useEffect(() => {
    if (!holder.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(260, entries[0].contentRect.width)));
    observer.observe(holder.current);
    return () => observer.disconnect();
  }, []);
  const isDrum = (n: ClipNote) => { const t = tracks.find(t => t.id === n.layerId); return t?.role ? t.role === 'drum' : n.channel === 10; };
  const displayed = focusedTrack ? notes.filter(n => n.layerId === focusedTrack) : notes;
  const laneNotes = useMemo(() => {
    if (drums) return [...new Set([46, 42, 39, 38, 37, 36, ...displayed.filter(isDrum).map(n => n.note)])].sort((a,b) => b-a);
    const pitches = displayed.filter(n => !isDrum(n)).map(n => n.note);
    const lowest = pitches.length ? pitches.reduce((a,b)=>Math.min(a,b),127) : 48;
    const highest = pitches.length ? pitches.reduce((a,b)=>Math.max(a,b),0) : 79;
    const min = Math.max(0, Math.floor((lowest - 2) / 12) * 12);
    const max = Math.min(127, Math.max(min + 23, Math.ceil((highest + 1) / 12) * 12 - 1));
    return Array.from({ length: max - min + 1 }, (_, i) => max - i);
  }, [notes, drums, tracks, focusedTrack]);
  const tonePcs = useMemo(() => new Set((chordTones || []).map(n => ((n % 12) + 12) % 12)), [chordTones]);
  const labelW = 58;
  const top = 27;
  const bottom = 34;
  const plotH = height - top - bottom;
  const rowH = plotH / laneNotes.length;
  const plotW = width - labelW - 12;
  const x = (beat: number) => labelW + (beat - startBeat) / span * plotW;
  const y = (note: number) => top + Math.max(0, laneNotes.indexOf(note)) * rowH;
  const visible = displayed.filter(n => n.startBeat + n.durationBeats > startBeat && n.startBeat < startBeat + span && (drums ? isDrum(n) : !isDrum(n))).slice(-2200);
  const color = (id: string) => tracks.find(t => t.id === id)?.color || '#d5b58a';
  const location = (clientX: number, clientY: number) => {
    const rect = svg.current!.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width * width;
    const py = (clientY - rect.top) / rect.height * height;
    const beat = Math.max(0, startBeat + (px - labelW) / plotW * span);
    const lane = Math.min(laneNotes.length - 1, Math.max(0, Math.floor((py - top) / rowH)));
    return { beat: Math.round(beat / grid) * grid, note: laneNotes[lane] };
  };
  const drag = useRef<{ note: ClipNote; x: number; y: number; resize: boolean } | null>(null);
  return <div className="piano-holder" ref={holder}>
    <svg ref={svg} viewBox={'0 0 ' + width + ' ' + height} role={onSelect ? 'group' : 'img'} aria-label={drums ? 'Drumspuren mit Velocity' : 'Piano Roll: Tonhöhe, Notenlänge und Velocity'}
      onDoubleClick={e => { if (onAdd && e.clientX > svg.current!.getBoundingClientRect().left + labelW) { const p = location(e.clientX, e.clientY); onAdd(p.beat, p.note); } }}
      onPointerMove={e => {
        if (!drag.current || !onChange) return;
        const d = drag.current;
        const initial = location(d.x, d.y), current = location(e.clientX, e.clientY);
        onChange({ ...d.note, startBeat: d.resize ? d.note.startBeat : Math.max(0, d.note.startBeat + current.beat - initial.beat), durationBeats: d.resize ? Math.max(grid, d.note.durationBeats + current.beat - initial.beat) : d.note.durationBeats, note: d.resize ? d.note.note : Math.max(0, Math.min(127, d.note.note + current.note - initial.note)) });
      }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <defs><clipPath id={onChange ? 'clip-edit' : 'clip-live'}><rect x={labelW} y={top} width={plotW} height={plotH + bottom} /></clipPath></defs>
      {laneNotes.map((n, i) => {
        const black = [1, 3, 6, 8, 10].includes(n % 12);
        const drumLabel = ({ 36: 'Kick', 37: 'Perc', 38: 'Snare', 39: 'Clap', 42: 'Hat', 46: 'Open' } as Record<number, string>)[n];
        return <g key={n} onClick={() => onAudition?.(n)} className="piano-key">
          <rect x={0} y={top + i * rowH} width={labelW - 1} height={rowH} fill={black && !drums ? '#171b1d' : '#252a2b'} />
          <rect x={labelW} y={top + i * rowH} width={plotW} height={rowH} fill={black && !drums ? '#161a1b' : '#1b2021'} />
          {!drums && !onChange && rootPitchClass !== undefined && n % 12 === rootPitchClass && <rect x={labelW} y={top + i * rowH} width={plotW} height={rowH} fill="#e4be76" opacity={0.16} />}
          {!drums && !onChange && n % 12 !== rootPitchClass && tonePcs.has(n % 12) && <rect x={labelW} y={top + i * rowH} width={plotW} height={rowH} fill="#9bbba7" opacity={0.08} />}
          <line x1={labelW} x2={width - 12} y1={top + i * rowH} y2={top + i * rowH} stroke={n % 12 === 0 ? '#4b5352' : '#2b3131'} strokeWidth={0.5} />
          {(drums || n % 12 === 0 || (!onChange && rootPitchClass !== undefined && n % 12 === rootPitchClass)) && <text x={8} y={top + i * rowH + Math.min(rowH - 1, 12)} className="roll-label">{drums ? drumLabel || 'MIDI ' + n : noteName(n)}</text>}
        </g>;
      })}
      {Array.from({ length: Math.ceil(span) + 1 }, (_, i) => {
        const beat = startBeat + i;
        const bar = Math.round(beat) % 4 === 0;
        return <g key={i}>
          <line x1={x(beat)} x2={x(beat)} y1={top} y2={height - bottom} stroke={bar ? '#596160' : '#333a39'} strokeWidth={bar ? 1 : .5} />
          {bar && <text x={x(beat) + 5} y={16} className="roll-label">{String(Math.floor(beat / 4) + 1).padStart(2, '0')}</text>}
        </g>;
      })}
      <g clipPath={'url(#' + (onChange ? 'clip-edit' : 'clip-live') + ')'}>
        {visible.map(n => <g key={n.id}>
          <rect x={x(n.startBeat)} y={y(n.note) + Math.min(1.5, rowH / 6)} width={Math.max(3, n.durationBeats / span * plotW - 1)} height={Math.max(3, rowH - 3)} rx={2} fill={color(n.layerId)} opacity={n.velocity / 127 * .45 + .5} stroke={selectedId === n.id ? '#fff8e8' : 'none'} strokeWidth={2}
            role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={noteName(n.note) + ', Velocity ' + n.velocity + ', ' + n.durationBeats.toFixed(2) + ' Beats'}
            onFocus={() => setHover(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(null)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(n.id); } }}
            onPointerDown={e => { e.stopPropagation(); onSelect?.(n.id); if (onChange) { svg.current?.setPointerCapture(e.pointerId); const right = x(n.startBeat + n.durationBeats); const clientRight = svg.current!.getBoundingClientRect().left + right / width * svg.current!.getBoundingClientRect().width; drag.current = { note: n, x: e.clientX, y: e.clientY, resize: e.clientX > clientRight - 9 }; } }}>
            <title>{noteName(n.note) + ' · Velocity ' + n.velocity + ' · ' + n.durationBeats.toFixed(2) + ' Beats'}</title>
          </rect>
          <rect x={x(n.startBeat)} y={height - 5 - n.velocity / 127 * 22} width={3} height={n.velocity / 127 * 22} rx={1} fill={color(n.layerId)} opacity={.65} />
        </g>)}
      </g>
      <line x1={labelW} x2={width - 12} y1={height - bottom} y2={height - bottom} stroke="#48504d" />
      {cursor !== undefined && cursor >= startBeat && cursor <= startBeat + span && <g>
        <line x1={x(cursor)} x2={x(cursor)} y1={top - 4} y2={height - 3} stroke="#f3e5c9" strokeWidth={1.5} />
        <path d={'M ' + (x(cursor) - 4) + ' 21 L ' + (x(cursor) + 4) + ' 21 L ' + x(cursor) + ' 27 Z'} fill="#f3e5c9" />
      </g>}
      {!visible.length && <text x={width / 2} y={height / 2} textAnchor="middle" className="roll-empty">{drums ? 'Raum für Rhythmus.' : 'Deine nächsten Noten beginnen hier.'}</text>}
    </svg>
    <div className="roll-readout"><span>{hover ? noteName(hover.note) + ' · MIDI ' + hover.note + ' · Vel ' + hover.velocity + ' · Ch ' + hover.channel : 'Tonhöhe ↑   ·   Zeit →'}</span><span>Velocity</span></div>
  </div>;
}
