import type { JamSession, MidiClip } from '../../types/jam';
import type { MusicalScale } from '../../types';

const LIBRARY_KEY = 'instajammable.library.v1';
const SESSION_KEY = 'instajammable.session.v2';
const MAX_CLIPS = 128;
const MAX_JSON_LENGTH = 16 * 1024 * 1024;
const MAX_EVENTS = 100_000;
const MAX_BEATS = 1_048_576;
const SCALES: MusicalScale[] = ['dorian', 'phrygian', 'lydian', 'aeolian', 'majorPentatonic', 'minorPentatonic', 'hirajoshi', 'microtonal'];

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max = 256): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) throw new Error(`${label} must be a nonempty string of at most ${max} characters.`);
  return value;
}
function number(value: unknown, label: string, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${label} must be ${integer ? 'an integer' : 'a finite number'} between ${min} and ${max}.`);
  }
  return value;
}
function array(value: unknown, label: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${label} must be an array with at most ${max} entries.`);
  return value;
}
function color(value: unknown): string {
  if (typeof value !== 'string' || !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) throw new Error('Track color must be a hexadecimal RGB color.');
  return value;
}

/** Validate untrusted clip JSON and return a detached, whitelisted object. */
export function validateClip(value: unknown): MidiClip {
  const clip = record(value, 'Clip');
  if (clip.version !== 1) throw new Error('Unsupported clip version. Expected version 1.');
  if (clip.style !== 'ambient' && clip.style !== 'lofi' && clip.style !== 'techno') throw new Error('Unsupported clip style.');
  if (!SCALES.includes(clip.scale as MusicalScale)) throw new Error('Unsupported musical scale.');
  const lengthBeats = number(clip.lengthBeats, 'Clip length', Number.EPSILON, MAX_BEATS);
  const trackIds = new Set<string>();
  const tracks = array(clip.tracks, 'Tracks', 256).map((value, index) => {
    const track = record(value, `Track ${index + 1}`);
    const id = text(track.id, 'Track ID');
    if (trackIds.has(id)) throw new Error(`Duplicate track ID: ${id}`);
    trackIds.add(id);
    return { id, name: text(track.name, 'Track name'), channel: number(track.channel, 'Track channel', 1, 16, true), color: color(track.color) };
  });
  const noteIds = new Set<string>();
  const notes = array(clip.notes, 'Notes', MAX_EVENTS).map((value, index) => {
    const note = record(value, `Note ${index + 1}`);
    const id = text(note.id, 'Note ID');
    if (noteIds.has(id)) throw new Error(`Duplicate note ID: ${id}`);
    noteIds.add(id);
    const layerId = text(note.layerId, 'Note layer');
    if (!trackIds.has(layerId)) throw new Error(`Unknown note layer: ${layerId}`);
    const startBeat = number(note.startBeat, 'Note start', 0, lengthBeats);
    const durationBeats = number(note.durationBeats, 'Note duration', Number.EPSILON, MAX_BEATS);
    if (startBeat + durationBeats > lengthBeats + 1e-7) throw new Error('A note extends beyond the clip end.');
    return { id, layerId, note: number(note.note, 'MIDI pitch', 0, 127, true), velocity: number(note.velocity, 'Velocity', 1, 127, true), channel: number(note.channel, 'Note channel', 1, 16, true), startBeat, durationBeats };
  });
  const tempos = array(clip.tempos, 'Tempo events', MAX_EVENTS).map((value, index) => {
    const tempo = record(value, `Tempo ${index + 1}`);
    return { beat: number(tempo.beat, 'Tempo position', 0, lengthBeats), bpm: number(tempo.bpm, 'Tempo', 1, 1000) };
  });
  for (let i = 1; i < tempos.length; i++) if (tempos[i].beat < tempos[i - 1].beat) throw new Error('Tempo events must be in chronological order.');
  const extraEvents = array(clip.extraEvents, 'Additional MIDI events', MAX_EVENTS).map((value, index) => {
    const event = record(value, `MIDI event ${index + 1}`);
    const layerId = text(event.layerId, 'MIDI event layer');
    if (!trackIds.has(layerId)) throw new Error(`Unknown MIDI event layer: ${layerId}`);
    const bytes = array(event.bytes, 'MIDI event bytes', 65_536).map((byte) => number(byte, 'MIDI byte', 0, 255, true));
    if (bytes.length === 0) throw new Error('MIDI event bytes cannot be empty.');
    return { layerId, beat: number(event.beat, 'MIDI event position', 0, lengthBeats), bytes };
  });
  const warnings = clip.warnings === undefined ? undefined : array(clip.warnings, 'Warnings', 128).map((warning) => text(warning, 'Warning', 2000));
  return { version: 1, id: text(clip.id, 'Clip ID'), name: text(clip.name, 'Clip name'), createdAt: number(clip.createdAt, 'Creation date', 0, Number.MAX_SAFE_INTEGER), style: clip.style, root: number(clip.root, 'Root note', 0, 127, true), scale: clip.scale as MusicalScale, bpm: number(clip.bpm, 'Clip tempo', 1, 1000), lengthBeats, notes, tempos, extraEvents, tracks, ...(warnings ? { warnings } : {}) };
}

function storage(): Storage | null {
  try { return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage; }
  catch { return null; }
}
function readJson(key: string): unknown | null {
  try {
    const raw = storage()?.getItem(key);
    if (!raw || raw.length > MAX_JSON_LENGTH) return null;
    return JSON.parse(raw) as unknown;
  } catch { return null; }
}
function writeJson(key: string, value: unknown): string | null {
  try {
    const target = storage();
    if (!target) return 'Local storage is unavailable. Export your work as a file to keep it.';
    const encoded = JSON.stringify(value);
    if (encoded.length > MAX_JSON_LENGTH) return 'This project is too large for local storage. Export it as a file.';
    target.setItem(key, encoded);
    return null;
  } catch (error) {
    return error instanceof Error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') ? 'Local storage is full. Export your work, then remove older clips.' : 'Your browser could not save this project. Export it as a file to keep it.';
  }
}

export function loadLibrary(): MidiClip[] {
  const value = readJson(LIBRARY_KEY);
  if (!value || typeof value !== 'object') return [];
  const envelope = value as { version?: unknown; clips?: unknown };
  const candidates = Array.isArray(value) ? value : envelope.version === 1 && Array.isArray(envelope.clips) ? envelope.clips : [];
  const ids = new Set<string>();
  const clips: MidiClip[] = [];
  for (const candidate of candidates.slice(0, MAX_CLIPS)) {
    try { const clip = validateClip(candidate); if (!ids.has(clip.id)) { clips.push(clip); ids.add(clip.id); } }
    catch { /* A corrupt clip must not hide the rest of the library. */ }
  }
  return clips;
}

export function saveLibrary(clips: MidiClip[]): string | null {
  try {
    if (!Array.isArray(clips)) throw new Error('Clip library must be an array.');
    const ids = new Set<string>();
    const valid = clips.slice(0, MAX_CLIPS).map((clip) => {
      const result = validateClip(clip);
      if (ids.has(result.id)) throw new Error('Clip IDs must be unique.');
      ids.add(result.id);
      return result;
    });
    return writeJson(LIBRARY_KEY, { version: 1, clips: valid });
  } catch (error) { return error instanceof Error ? error.message : 'Invalid clip library.'; }
}

/** Parsed data remains untrusted: the session engine validates and migrates it. */
export function loadSavedSession(): unknown | null { return readJson(SESSION_KEY); }

export function persistSession(session: JamSession): string | null {
  if (!session || session.version !== 2 || !Array.isArray(session.layers)) return 'Unsupported session format.';
  try {
    const encoded = JSON.stringify(session, (_key, value: unknown) => {
      if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Session contains a non-finite value.');
      return value;
    });
    return writeJson(SESSION_KEY, JSON.parse(encoded) as unknown);
  } catch { return 'This session could not be saved because it contains invalid data.'; }
}

function filename(name: string): string { return name.replace(/[\\/\x00-\x1f\x7f]/g, '_').slice(0, 240) || 'instajammable-export'; }

export function downloadBytes(bytes: Uint8Array, name: string, mime: string): void {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') throw new Error('File download is unavailable in this environment.');
  const objectUrl = URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename(name);
  anchor.hidden = true;
  try { document.body.appendChild(anchor); anchor.click(); }
  finally {
    anchor.remove();
    // Keep the URL alive until the browser has consumed the download click.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  }
}

export function exportJson(data: unknown, name: string): void {
  const encoded = JSON.stringify(data, null, 2);
  if (encoded === undefined) throw new Error('No JSON data to export.');
  downloadBytes(new TextEncoder().encode(encoded), name, 'application/json');
}
