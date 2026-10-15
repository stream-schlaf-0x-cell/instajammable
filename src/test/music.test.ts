import test from 'node:test';
import assert from 'node:assert/strict';
import { JamComposer, SCALE_INTERVALS, captureNotes, chordSuffix, clipEventsAtStep, voiceLead } from '../engine/jam/music';
import { createSession, SCENES } from '../engine/jam/scenes';
import { generatePreview } from '../engine/jam/JamEngine';
import type { ClipNote } from '../types/jam';

test('every scene generates bounded, in-scale repeatable notes including seed zero', () => {
  for (const scene of SCENES) {
    const session = createSession(scene.id, 0); const a = generatePreview(session, 16); const b = generatePreview(session, 16);
    assert.deepEqual(a, b); assert.ok(a.notes.length > 12);
    const scale = SCALE_INTERVALS[session.scale];
    for (const n of a.notes) {
      const layer = session.layers.find(l => l.id === n.layerId)!;
      assert.ok(Number.isInteger(n.note) && Number.isInteger(n.velocity)); assert.ok(n.note >= 0 && n.note <= 127);
      assert.ok(n.velocity >= 1 && n.velocity <= 127); assert.ok(n.durationBeats > 0 && n.startBeat < a.lengthBeats);
      if (layer.role !== 'drum') { assert.ok(n.note >= layer.settings.minNote && n.note <= layer.settings.maxNote); assert.ok(scale.includes(((n.note - session.root) % 12 + 12) % 12)); }
    }
  }
});

test('independent layer seeds preserve other layers when melody settings change', () => {
  const a = createSession('dusty-keys', 23); const b = structuredClone(a); b.layers.find(l => l.id === 'melody')!.settings.density = 0.9;
  assert.deepEqual(generatePreview(a).notes.filter(n => n.layerId !== 'melody'), generatePreview(b).notes.filter(n => n.layerId !== 'melody'));
});

test('lofi backbeat has structural kick and snare anchors for every bar', () => {
  const clip = generatePreview(createSession('dusty-keys'), 8);
  for (let bar = 0; bar < 8; bar++) {
    assert.ok(clip.notes.some(n => n.layerId === 'kick' && Math.abs(n.startBeat - bar * 4) < 0.025));
    for (const offset of [1, 3]) assert.ok(clip.notes.some(n => n.layerId === 'snare' && Math.abs(n.startBeat - bar * 4 - offset) < 0.025));
  }
});

test('drone has sustained phrases rather than re-triggering every bar', () => {
  const clip = generatePreview(createSession(), 16); const notes = clip.notes.filter(n => n.layerId === 'drone');
  assert.ok(notes.length > 0 && notes.length <= 8); assert.ok(notes.every(n => n.durationBeats >= 15));
  assert.ok(notes.every(n => Math.abs(n.startBeat % 16) < 0.001));
});

test('voice leading lowers total movement while respecting voicing register', () => {
  const previous = [50, 57, 65]; const next = voiceLead([55, 62, 58], previous, 48, 74);
  assert.ok(next.every(n => n >= 48 && n <= 74)); assert.equal(new Set(next).size, next.length);
  assert.ok(next.reduce((sum, n, i) => sum + Math.abs(n - previous[i]), 0) < 20);
});

test('capture includes held notes, uses common origin and excludes future onsets', () => {
  const event = (id: string, startBeat: number, durationBeats: number): ClipNote => ({ id, startBeat, durationBeats, note: 60, velocity: 80, channel: 1, layerId: id });
  const notes = captureNotes([event('held', 0, 24), event('other', 9, 2), event('future', 16.1, 1), event('old', 0, 1)], 8, 16);
  assert.equal(notes.length, 2); assert.equal(notes[0].startBeat, 0); assert.equal(notes[0].durationBeats, 8); assert.equal(notes[1].startBeat, 1);
});

test('freeze repeats captured fractional timing without consulting live harmony', () => {
  const session = createSession(); session.layers.forEach(l => { l.muted = l.id !== 'melody'; }); session.layers.find(l => l.id === 'melody')!.frozen = true;
  const composer = new JamComposer(); composer.setFrozen('melody', [{ id: 'f', layerId: 'melody', note: 73, velocity: 70, channel: 2, startBeat: 0.08, durationBeats: 1.3 }], 4);
  assert.deepEqual(composer.planStep(0, session), []);
  for (const step of [16, 80, 144]) { const notes = composer.planStep(step, session); assert.equal(notes.length, 1); assert.equal(notes[0].note, 73); assert.equal(notes[0].offsetBeats, 0.08); }
});

test('clip playback uses recorded onset offsets instead of regenerating notes', () => {
  const clip = generatePreview(createSession('dusty-keys'), 2); clip.notes = [{ id: 'a', layerId: 'melody', note: 67, velocity: 64, channel: 2, startBeat: 0.1, durationBeats: 1 }];
  const notes = clipEventsAtStep(clip, 8, 8); assert.equal(notes[0].offsetBeats, 0.1); assert.equal(notes[0].note, 67);
  assert.equal(clipEventsAtStep(clip, 8, 8.25).length, 0);
});

test('long generator simulation keeps only one plan per layer and coherent roles', () => {
  const composer = new JamComposer(); const session = createSession('dusty-keys'); let count = 0;
  for (let step = 0; step < 16 * 2000; step++) { const notes = composer.planStep(step, session); count += notes.length; assert.ok(notes.every(n => n.note >= 0 && n.note <= 127)); }
  assert.ok(count > 30000); assert.equal((composer as any).plans.size, 8);
});

test('harmonic labels describe the actual voiced chord, including diminished and ninth qualities', () => {
  const seen = new Set<string>();
  for (const scene of ['dorian-dawn', 'dusty-keys', 'deep-dub', 'ultimae-drift']) {
    const session = createSession(scene); const composer = new JamComposer(); let foundDiminished = false;
    for (let step = 0; step < 4096; step += 16) {
      const h = composer.harmonyAt(step, session);
      const pitchClasses = [...new Set(h.notes.map(n => (((n - h.root) % 12) + 12) % 12))];
      assert.ok(h.name.endsWith(chordSuffix(pitchClasses)), `${h.name} must match its notes ${h.notes}`); seen.add(h.name.replace(/^[A-G][♯♭]?/, ''));
      if (h.degree === 5 && scene === 'dusty-keys') { assert.match(h.name, /m7♭5/); foundDiminished = true; }
    }
    if (scene === 'dusty-keys') assert.equal(foundDiminished, true);
  }
  assert.ok([...seen].some(name => /9/.test(name)), 'ambient and techno voicings include ninth chords');
});
test('chord symbols follow the interval content', () => {
  assert.equal(chordSuffix([0, 3, 7, 10, 14]), 'm9'); assert.equal(chordSuffix([0, 3, 10, 14]), 'm9');
  assert.equal(chordSuffix([0, 4, 7, 11]), 'maj7'); assert.equal(chordSuffix([0, 4, 7, 10, 14]), '9');
  assert.equal(chordSuffix([0, 3, 6]), 'dim'); assert.equal(chordSuffix([0, 3, 6, 10]), 'm7♭5');
  assert.equal(chordSuffix([0, 2, 7, 10]), '7sus2'); assert.equal(chordSuffix([0, 5, 7]), 'sus4'); assert.equal(chordSuffix([0, 7]), '5');
  assert.equal(chordSuffix([0, 3, 7, 14]), 'madd9');
});

test('unplayable narrow register stays silent instead of creating an out-of-scale note', () => {
  const session = createSession(); session.layers.forEach(l => { l.muted = l.id !== 'melody'; });
  session.layers[3].settings = { ...session.layers[3].settings, minNote: 61, maxNote: 61, density: 1 };
  assert.equal(generatePreview(session, 16).notes.length, 0);
  session.layers[3].settings.minNote = 62; session.layers[3].settings.maxNote = 62;
  const clip = generatePreview(session, 16); assert.ok(clip.notes.length > 0); assert.ok(clip.notes.every(n => n.note === 62));
});

test('all preserved rhythm algorithms produce deterministic, distinct actual phrases', () => {
  const patterns = new Set<string>();
  for (const algorithm of ['composed', 'euclidean', 'probabilistic', 'polymetric', 'markov', 'densityBurst'] as const) {
    const session = createSession('dusty-keys', 0); session.layers.forEach(l => { l.muted = l.id !== 'hihat'; });
    session.layers[6].settings.rhythmAlgorithm = algorithm; session.layers[6].settings.density = 0.95;
    const a = generatePreview(session, 8); const b = generatePreview(session, 8); assert.deepEqual(a, b); assert.ok(a.notes.length > 0);
    patterns.add(a.notes.map(n => n.startBeat.toFixed(2)).join(',')); assert.ok(a.notes.every(n => n.velocity <= session.layers[6].settings.velocityMax));
  }
  assert.equal(patterns.size, 6);
});

test('fractional-length captured loops retain events crossing the scheduling-cell boundary', () => {
  const clip = generatePreview(createSession(), 2); clip.lengthBeats = 4.3;
  clip.notes = [{ id: 'a', layerId: 'melody', note: 60, channel: 2, velocity: 90, startBeat: 0.1, durationBeats: 0.4 }];
  const nextCycle = clipEventsAtStep(clip, 0, 4.25); assert.equal(nextCycle.length, 1);
  assert.ok(Math.abs(nextCycle[0].offsetBeats - 0.15) < 1e-8);
});

test('valid single-note drone register produces one unison with unique exportable IDs', () => {
  const session = createSession(); session.layers.forEach(l => { l.muted = l.id !== 'drone'; });
  session.layers[0].settings = { ...session.layers[0].settings, minNote: 50, maxNote: 50, density: 1 }; session.macros.density = 1;
  const clip = generatePreview(session, 4); assert.equal(clip.notes.length, 1); assert.equal(clip.notes[0].note, 50);
  assert.equal(new Set(clip.notes.map(n => n.id)).size, clip.notes.length);
});

test('legacy granular drift option creates an in-scale cloud distinct from held drones', () => {
  const a = createSession(); a.layers.forEach(l => { l.muted = l.id !== 'drone'; }); const b = structuredClone(a); b.layers[0].settings.ambientAlgorithm = 'granularDrift';
  const held = generatePreview(a, 8); const cloud = generatePreview(b, 8);
  assert.ok(cloud.notes.length > held.notes.length); assert.ok(cloud.notes.every(n => n.durationBeats <= 2 && SCALE_INTERVALS[b.scale].includes(((n.note - b.root) % 12 + 12) % 12)));
});
