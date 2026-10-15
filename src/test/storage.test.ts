import assert from 'node:assert/strict';
import { loadLibrary, loadSavedSession, persistSession, saveLibrary, validateClip } from '../engine/jam/storage';
import type { JamSession, MidiClip } from '../types/jam';

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const memory = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memory });
const fixture: MidiClip = {
  version: 1, id: 'clip-1', name: 'Captured phrase', createdAt: 1700000000000,
  style: 'ambient', root: 62, scale: 'dorian', bpm: 78, lengthBeats: 32,
  tracks: [{ id: 'chords', name: 'Chords', channel: 1, color: '#98b6cb' }],
  notes: [{ id: 'n1', layerId: 'chords', note: 62, velocity: 80, channel: 1, startBeat: 0, durationBeats: 8 }],
  tempos: [{ beat: 0, bpm: 78 }, { beat: 16, bpm: 90 }],
  extraEvents: [{ layerId: 'chords', beat: 0, bytes: [0xb0, 64, 0] }],
};
try {
  assert.equal(saveLibrary([fixture]), null);
  assert.deepEqual(loadLibrary(), [fixture], 'Validated library roundtrips note timing, tempo and MIDI events');
  const detached = validateClip(fixture);
  detached.notes[0].note = 74;
  assert.equal(fixture.notes[0].note, 62, 'Validator does not retain references to untrusted input');
  for (const malformed of [
    { ...fixture, version: 2 }, { ...fixture, bpm: NaN },
    { ...fixture, notes: [{ ...fixture.notes[0], note: 128 }] },
    { ...fixture, notes: [{ ...fixture.notes[0], channel: 0 }] },
    { ...fixture, notes: [{ ...fixture.notes[0], velocity: 0 }] },
    { ...fixture, notes: [{ ...fixture.notes[0], durationBeats: -1 }] },
    { ...fixture, notes: [{ ...fixture.notes[0], startBeat: 30 }] },
    { ...fixture, notes: [{ ...fixture.notes[0], layerId: 'missing' }] },
    { ...fixture, notes: [fixture.notes[0], fixture.notes[0]] },
    { ...fixture, tracks: [{ ...fixture.tracks[0], color: 'url(javascript:bad)' }] },
    { ...fixture, extraEvents: [{ ...fixture.extraEvents[0], bytes: [256] }] },
    { ...fixture, tempos: [{ beat: 16, bpm: 78 }, { beat: 0, bpm: 90 }] },
  ]) assert.throws(() => validateClip(malformed));
  assert.ok(saveLibrary([{ ...fixture, lengthBeats: -1 }]), 'Malformed save reports an error');
  assert.deepEqual(loadLibrary(), [fixture], 'Failed save leaves prior data untouched');
  memory.setItem('instajammable.library.v1', JSON.stringify({ version: 1, clips: [{ ...fixture, bpm: null }, fixture] }));
  assert.deepEqual(loadLibrary(), [fixture], 'One corrupt clip does not hide a valid clip');
  const many = Array.from({ length: 140 }, (_, i) => ({ ...fixture, id: `clip-${i}` }));
  assert.equal(saveLibrary(many), null);
  assert.equal(loadLibrary().length, 128, 'Persistent library caps retained clips');
  memory.setItem('instajammable.library.v1', '{broken');
  assert.deepEqual(loadLibrary(), [], 'Corrupt stored JSON is recoverable');
  const session = { version: 2, id: 'session-1', layers: [], runtime: { phraseIndex: 4 } } as unknown as JamSession;
  assert.equal(persistSession(session), null);
  assert.deepEqual(loadSavedSession(), session, 'Versioned session preserves runtime state');
  assert.ok(persistSession({ ...session, bpm: Infinity }), 'Non-finite session state is rejected');
  assert.deepEqual(loadSavedSession(), session, 'Invalid state does not replace saved session');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('SecurityError'); } });
  assert.deepEqual(loadLibrary(), []);
  assert.equal(loadSavedSession(), null);
  assert.ok(saveLibrary([fixture]), 'Unavailable storage returns actionable failure');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => null,
    setItem: () => { const error = new Error('Full'); error.name = 'QuotaExceededError'; throw error; },
  } });
  assert.match(saveLibrary([fixture])!, /full/i, 'Quota failure is visible to the caller');
  console.log('Storage tests passed: validated roundtrip, malformed imports, corruption recovery, library cap, session runtime, unavailable storage, quota failure.');
} finally {
  if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
  else Reflect.deleteProperty(globalThis, 'localStorage');
}
