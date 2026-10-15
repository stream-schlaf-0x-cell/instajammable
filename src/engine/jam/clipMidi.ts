import type { MidiClip } from '../../types/jam';
import { MidiFileReader } from '../midi/midiReader';
import { MidiFileWriter } from '../midi/midiWriter';
const PPQ = 960;
const palette = ['#c99a57', '#92b7af', '#b69fc4', '#b2bb84', '#d98b79', '#79a8c9'];

/** Export at a common origin and length, retaining the silence of single-layer stems. */
export function clipToMidi(clip: MidiClip, layerId?: string): Uint8Array {
  if (!Number.isFinite(clip.lengthBeats) || clip.lengthBeats < 0) throw new Error('Clip length must be nonnegative and finite.');
  const ids = new Set([...clip.tracks.map(t => t.id), ...clip.notes.map(n => n.layerId), ...clip.extraEvents.map(e => e.layerId)]);
  const tracks = [...ids].filter(id => id !== '__conductor__' && (layerId === undefined || layerId === id)).map(id => {
    const track = clip.tracks.find(t => t.id === id);
    const rawEvents = clip.extraEvents.filter(e => e.layerId === id && e.beat >= 0 && e.beat <= clip.lengthBeats)
      .filter(e => !(e.bytes[0] === 0xff && [0x2f, 0x51].includes(e.bytes[1])))
      .map(e => ({ tick: Math.round(e.beat * PPQ), bytes: e.bytes }));
    return {
      name: track?.name ?? id, channel: Math.max(0, Math.min(15, (track?.channel ?? 1) - 1)),
      lengthTicks: Math.round(clip.lengthBeats * PPQ),
      notes: clip.notes.filter(n => n.layerId === id && n.startBeat >= 0 && n.startBeat < clip.lengthBeats).map(n => ({
        startTicks: Math.round(n.startBeat * PPQ),
        durationTicks: Math.max(1, Math.round(Math.min(n.durationBeats, clip.lengthBeats - n.startBeat) * PPQ)),
        note: n.note, velocity: n.velocity, channel: n.channel - 1,
      })), rawEvents,
    };
  });
  const changes = clip.tempos.filter(t => t.beat >= 0 && t.beat <= clip.lengthBeats).map(t => ({ tick: Math.round(t.beat * PPQ), bpm: t.bpm }));
  const conductor = clip.extraEvents.filter(e => e.layerId === '__conductor__').map(e => ({ tick: Math.round(e.beat * PPQ), bytes: e.bytes }));
  return new MidiFileWriter(PPQ).createMidiFile(clip.bpm, tracks, changes, Math.round(clip.lengthBeats * PPQ), conductor);
}
export function midiToClip(bytes: Uint8Array, name = 'Imported MIDI'): MidiClip {
  const parsed = MidiFileReader.parse(bytes);
  const ppq = parsed.ticksPerQuarterNote;
  const id = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let hasConductor = false;
  const trackIds = parsed.tracks.map((track, i) => {
    if (!hasConductor && track.notes.length === 0 && track.tempoEvents.length > 0 && track.rawEvents.every(e => e.bytes[0] === 0xff)) { hasConductor = true; return '__conductor__'; }
    return `midi-track-${i}`;
  });
  const tracks = parsed.tracks.map((track, i) => ({ id: trackIds[i], name: track.name, channel: (track.notes[0]?.channel ?? 0) + 1, color: trackIds[i] === '__conductor__' ? '#79818a' : palette[i % palette.length] }));
  const notes = parsed.tracks.flatMap((track, i) => track.notes.map((note, j) => ({
    id: `${id}-${i}-${j}`, layerId: trackIds[i], note: note.note, channel: note.channel + 1, velocity: note.velocity,
    startBeat: note.startTicks / ppq, durationBeats: note.durationTicks / ppq,
  })));
  const tempos = parsed.tracks.flatMap(t => t.tempoEvents.map(e => ({ beat: e.tick / ppq, bpm: e.bpm }))).sort((a, b) => a.beat - b.beat);
  if (!tempos.some(t => t.beat === 0)) tempos.unshift({ beat: 0, bpm: 120 });
  const extraEvents = parsed.tracks.flatMap((track, i) => track.rawEvents.map(e => ({ layerId: trackIds[i], beat: e.tick / ppq, bytes: e.bytes })));
  const lengthBeats = Math.max(parsed.tracks.reduce((length, t) => Math.max(length, t.endTicks / ppq), 1 / ppq), notes.reduce((length, n) => Math.max(length, n.startBeat + n.durationBeats), 0));
  const warnings = [...parsed.warnings];
  if (extraEvents.some(e => e.bytes[0] === 0xf0 || e.bytes[0] === 0xf7)) warnings.push('SysEx is preserved for export but not sent during browser audition.');
  return { version: 1, id, name, createdAt: Date.now(), style: 'ambient', root: 62, scale: 'dorian', bpm: tempos[0].bpm,
    lengthBeats, notes, tempos, extraEvents, tracks, warnings };
}
export function downloadClipMidi(clip: MidiClip, layerId?: string): void {
  const track = clip.tracks.find(t => t.id === layerId);
  const filename = `${clip.name}${track ? `-${track.name}` : ''}`.replace(/[^\p{L}\p{N}_-]+/gu, '-');
  MidiFileWriter.downloadMidi(clipToMidi(clip, layerId), `${filename || 'instajammable-capture'}.mid`);
}
