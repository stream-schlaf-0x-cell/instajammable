import test from 'node:test';
import assert from 'node:assert/strict';
import { JamEngine, migrateSession } from '../engine/jam/JamEngine';
import { createSession } from '../engine/jam/scenes';
import { MusicalClock } from '../engine/clock';
import { AmbientSynth } from '../engine/audio/ambientSynth';
import type { StepContext } from '../types';
import type { JamEvent } from '../types/jam';

function testEngine() {
  let now = 0; const state = createSession(); state.outputMode = 'midi'; state.swing = 0;
  const engine = new JamEngine(state); const internal = engine as any;
  internal.audio = { getTime: () => now, ctx: { get currentTime() { return now; } }, setVolume() {} };
  internal.running = true;
  return { engine, internal, setNow: (v: number) => { now = v; }, tick: (step: number, time: number, bpm = state.bpm) => {
    const ctx: StepContext = { step, subStep: step % 16, bar: Math.floor(step / 16), beat: Math.floor((step % 16) / 4), time, perfTime: time * 1000, bpm, swing: 0, swingOffset: 0 };
    internal.processStep(ctx);
  } };
}

test('production Clock preserves paired swing duration over 1000 actual scheduled steps', () => {
  let now = 0; const calls: StepContext[] = [];
  const ctx = { get currentTime() { return now; }, state: 'running' } as unknown as AudioContext;
  const clock = new MusicalClock(ctx); clock.setBpm(120); clock.setSwing(0.75); clock.setCallbacks(c => calls.push(c));
  clock.start();
  for (let i = 0; i < 1000; i++) { now = i * 0.125; clock.schedulerLoop(); }
  clock.stop(); assert.ok(calls.length >= 998);
  for (let i = 0; i < calls.length - 2; i += 2) assert.ok(Math.abs(calls[i + 2].time - calls[i].time - 0.25) < 1e-9);
  assert.ok(calls[1].time - calls[0].time > 0.125);
});

test('capture never includes scheduled future notes, even while scheduler looks ahead', () => {
  const t = testEngine(); t.tick(0, 0.05); t.setNow(0.02);
  assert.equal(t.engine.getRecentEvents().length, 0); assert.equal(t.engine.createClip().notes.length, 0);
  t.setNow(0.2); assert.ok(t.engine.getRecentEvents().length > 0);
  const clip = t.engine.createClip(); assert.ok(clip.notes.every(n => n.startBeat < clip.lengthBeats));
});

test('stop retains played capture and clips future or sustained notes', () => {
  const t = testEngine(); t.tick(0, 0.05); t.setNow(2); t.engine.stop();
  const pos = t.engine.getPosition(); assert.equal(pos.playing, false); assert.ok(pos.beat > 2);
  const clip = t.engine.createClip(); assert.ok(clip.notes.length > 0); assert.ok(clip.notes.every(n => n.startBeat + n.durationBeats <= clip.lengthBeats + 1e-9));
});

test('mutate -> undo -> redo restores exact settings and composer state', () => {
  const engine = new JamEngine(createSession()); const before = engine.saveSession(); engine.mutate(); const after = engine.saveSession();
  engine.undo(); assert.deepEqual(engine.saveSession().layers, before.layers); assert.deepEqual(engine.saveSession().runtime?.composer, before.runtime?.composer);
  engine.redo(); assert.deepEqual(engine.saveSession().layers, after.layers); assert.deepEqual(engine.saveSession().runtime?.composer, after.runtime?.composer);
});

test('mutations keep locked/frozen settings and global harmonic anchors', () => {
  const engine = new JamEngine(createSession()); engine.updateLayer('chords', { locked: true }); engine.updateLayer('melody', { frozen: true });
  const before = engine.getState(); for (let i = 0; i < 20; i++) engine.mutate(); const after = engine.getState();
  assert.deepEqual(after.layers.find(l => l.id === 'chords'), before.layers.find(l => l.id === 'chords'));
  assert.deepEqual(after.layers.find(l => l.id === 'melody'), before.layers.find(l => l.id === 'melody'));
  assert.equal(after.root, before.root); assert.equal(after.scale, before.scale); assert.equal(after.bpm, before.bpm);
});

test('new scene changes active composer and defaults; old-format import migrates', () => {
  const engine = new JamEngine(); engine.loadScene('dusty-keys'); const state = engine.getState(); assert.equal(state.style, 'lofi'); assert.equal(state.bpm, 82);
  assert.equal(engine.previewScene('dusty-keys').notes.filter(n => n.layerId === 'snare').length >= 16, true);
  const old = migrateSession({ name: 'Legacy', bpm: 99, seed: 0, ambientParams: { rootNote: 48, scale: 'aeolian' }, layers: [{ type: 'drum', drumVoice: 'kick', volume: 0.2, midiChannel: 12 }] });
  assert.equal(old.seed, 0); assert.equal(old.bpm, 99); assert.equal(old.root, 48); assert.equal(old.layers[4].channel, 12);
});

test('capture preserves tempo segments and realized long-note length across tempo change', () => {
  const t = testEngine(); t.tick(0, 0.05, 60); t.setNow(4.05); t.tick(16, 4.05, 120); t.setNow(8.05);
  const event: JamEvent = { id: 'held', layerId: 'melody', note: 60, velocity: 80, channel: 2, startBeat: 0, durationBeats: 6, bpm: 60, audioTime: 0.05, performanceTime: 50 };
  t.internal.events.push(event); t.internal.eventEnds.set('held', 6.05);
  const clip = t.engine.createClip(8); assert.ok(clip.tempos.some(v => v.bpm === 60)); assert.ok(clip.tempos.some(v => v.bpm === 120));
  assert.equal(clip.notes.find(n => n.id === 'held')!.durationBeats, 8);
});

test('captured swing is not applied a second time by clip override', () => {
  const t = testEngine(); const clip = t.engine.previewScene('dorian-dawn', 1); clip.notes = [{ id: 'a', layerId: 'melody', note: 65, channel: 2, velocity: 90, startBeat: 0.3, durationBeats: 1 }]; clip.tracks = clip.tracks.filter(v => v.id === 'melody');
  t.internal.override = { clip, originBeat: 0 }; t.setNow(0);
  t.internal.processStep({ step: 1, subStep: 1, bar: 0, beat: 0, time: 0.3 * 60 / 78, perfTime: 300, bpm: 78, swing: 0.5, swingOffset: 0.05 * 60 / 78 });
  assert.ok(Math.abs(t.internal.events.find((e: JamEvent) => e.layerId === 'melody').startBeat - 0.3) < 1e-9);
});

test('native synth stops and disconnects every node when voice ends or Panic runs', () => {
  const nodes: any[] = []; let time = 0;
  const param = () => ({ value: 0.5, setValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = () => { const n = { gain: param(), frequency: param(), Q: param(), detune: param(), pan: param(), connect() {}, disconnected: false, disconnect() { this.disconnected = true; }, start() {}, stop() {}, onended: null as any }; nodes.push(n); return n; };
  const ctx = { get currentTime() { return time; }, createOscillator: node, createGain: node, createBiquadFilter: node, createStereoPanner: node } as unknown as AudioContext;
  const synth = new AmbientSynth(ctx, node() as any, 2, 1);
  const params = { osc1Wave: 'sine', osc2Wave: 'triangle', osc3Wave: 'sine', detuneSpread: 4, subLevel: 0.2, filterCutoff: 1000, filterResonance: 0.7, filterEnvAmount: 0.1, attack: 0.1, decay: 0.4, sustain: 0.8, release: 1, lfoRate: 0.1, lfoDepth: 0.1, driftAmount: 0.1, voiceSpread: 0.5, volume: 0.5 } as any;
  for (let i = 0; i < 30; i++) { time = i * 0.1; synth.triggerNote(time, 60 + i % 5, 80, 1, params); const counts = synth.getActiveVoiceCount(); assert.ok(counts.sounding <= 2 && counts.releasing <= 1); }
  synth.stopAllVoices(); assert.deepEqual(synth.getActiveVoiceCount(), { sounding: 0, releasing: 0 }); assert.ok(nodes.slice(1).every(n => n.disconnected));
});

test('untrusted imported runtime and malformed layer arrays fail clearly before mutation', () => {
  const engine = new JamEngine(); const before = engine.getState();
  for (const raw of [ { ...before, layers: [null] }, { ...before, runtime: { positionBeat: Infinity } }, { ...before, runtime: { composer: { epoch: 1e300 } } }, { ...before, runtime: { composer: { frozen: { bad: [] } } } } ]) {
    assert.throws(() => engine.loadSession(raw), /Ungültig/); assert.deepEqual(engine.getState(), before);
  }
});

test('MIDI mute, solo and channel changes release only affected layer queues', () => {
  const engine = new JamEngine(); const released: string[] = []; engine.midi.releaseNotesForLayer = layerId => { released.push(layerId); };
  engine.updateLayer('melody', { muted: true }); assert.ok(released.includes('melody'));
  released.length = 0; engine.updateLayer('chords', { solo: true }); assert.ok(!released.includes('chords') && released.includes('bass'));
  engine.updateLayer('chords', { channel: 4 }); assert.ok(released.includes('chords'));
});

test('one continuous macro gesture creates one undo transition', () => {
  const engine = new JamEngine(); const value = engine.getState().macros.density;
  for (let i = 0; i < 20; i++) engine.setMacro('density', i / 20);
  engine.undo(); assert.equal(engine.getState().macros.density, value); engine.redo(); assert.equal(engine.getState().macros.density, 0.95);
});

test('rolling performed capture and auxiliary caches remain bounded after 2000 bars', () => {
  const t = testEngine();
  for (let step = 0; step < 16 * 2000; step++) { const time = step * 60 / 78 / 4; t.setNow(time); t.tick(step, time); }
  t.setNow(16 * 2000 * 60 / 78 / 4); const clip = t.engine.createClip(128);
  assert.equal(clip.lengthBeats, 512); assert.ok(t.internal.events.length < 6000); assert.ok(t.internal.anchors.length <= 64); assert.ok(t.internal.timeline.length <= 2);
  assert.ok(clip.notes.every((n: any) => n.startBeat >= 0 && n.startBeat + n.durationBeats <= 512 + 1e-8));
});

test('user density boundaries constrain manual changes, macros and mutations', () => {
  const engine = new JamEngine(); engine.setLayerSettings('melody', { mutationDensityMin: 0.4, mutationDensityMax: 0.5, density: 0.8 });
  assert.equal(engine.getState().layers[3].settings.density, 0.5);
  engine.setMacro('density', 1); for (let i = 0; i < 100; i++) engine.mutate();
  const s = engine.getState().layers[3].settings; assert.ok(s.density >= 0.4 && s.density <= 0.5);
});

test('hardware CC capture retains the actual played cutoff/resonance values and excludes pending messages', () => {
  const t = testEngine(); t.internal.state.deepMindEnabled = true;
  t.tick(0, 0.05); t.setNow(0.02); assert.equal(t.engine.createClip().extraEvents.length, 0);
  t.setNow(1); const clip = t.engine.createClip(); assert.equal(clip.extraEvents.length, 2); assert.deepEqual(clip.extraEvents.map(c => c.bytes[1]), [29, 30]);
  t.tick(16, 2); t.engine.stop(); t.setNow(3); assert.equal(t.engine.createClip().extraEvents.length, 2);
});

test('saved sessions retain applied clip phrases and public snapshots are detached', () => {
  const engine = new JamEngine(); const clip = engine.previewScene('dorian-dawn', 4); engine.setClipOverride(clip);
  const saved = engine.saveSession(); assert.ok(saved.runtime?.pendingOverride);
  const restored = new JamEngine(); restored.loadSession(saved); assert.equal(restored.getPosition().clipOverride, true);
  const edited = saved.runtime!.pendingOverride as any; edited.notes[0].note = 1;
  assert.notEqual((engine.saveSession().runtime!.pendingOverride as any).notes[0].note, 1);
  assert.notEqual((restored.saveSession().runtime!.pendingOverride as any).notes[0].note, 1);
});

test('muting/solo and undo cancel pending musical events before they can enter capture', () => {
  const t = testEngine(); t.tick(0, 0.05); t.setNow(0.02);
  t.engine.updateLayer('chords', { solo: true }); t.setNow(0.2);
  assert.ok(t.engine.getRecentEvents().every(n => n.layerId === 'chords'));
  const u = testEngine(); u.engine.mutate(); u.tick(0, 0.05); u.setNow(0.02); u.engine.undo(); u.setNow(0.2);
  assert.equal(u.engine.getRecentEvents().length, 0);
});

test('applied imported metadata and empty track intentions persist in session snapshots', () => {
  const engine = new JamEngine(); const clip = engine.previewScene('dorian-dawn', 4);
  clip.tracks.push({ id: 'meta', name: 'Conductor', channel: 1, color: '#aabbcc' }); clip.extraEvents = [{ layerId: 'meta', beat: 0, bytes: [0xff, 0x03, 0x01, 0x41] }];
  engine.setClipOverride(clip); const saved = engine.saveSession(); const restored = new JamEngine();
  assert.doesNotThrow(() => restored.loadSession(saved));
  const pending = saved.runtime!.pendingOverride as any; assert.equal(pending.tracks.length, 8); assert.equal(pending.extraEvents[0].layerId, 'melody');
});

test('restored transport position does not claim captured bars without a restored performed buffer', () => {
  const engine = new JamEngine(); const saved = engine.saveSession(); saved.runtime!.positionBeat = 100;
  engine.loadSession(saved); assert.equal(engine.getPosition().beat, 100); assert.equal(engine.getPosition().capturedBars, 0);
});

test('sound overrides retain every original native parameter and explicit zero values', async () => {
  const { ambientPatch, drumPatch, effectiveEffects } = await import('../engine/jam/JamEngine');
  const engine = new JamEngine(); engine.setLayerSettings('drone', { audioPatch: { osc1Wave: 'square', osc2Wave: 'sine', osc3Wave: 'triangle', filterCutoff: 18000, filterResonance: 15, subLevel: 0, attack: 8, decay: 10, sustain: 0, release: 12, lfoRate: 0, lfoDepth: 1, driftAmount: 1, voiceSpread: 1, volume: 0, filterEnvAmount: 0, detuneSpread: 50 } });
  engine.setLayerSettings('kick', { drumPatch: { pitch: 150, decay: 1.5, volume: 0, tone: 0, drive: 1, pan: 0, midiNote: 48 } });
  engine.updateSession({ effectsPatch: { delayTime: 1.5, delayFeedback: 0.92, delayMix: 0, delayFlutter: 0, reverbDecay: 8, reverbMix: 0, reverbSize: 0, masterDrive: 0 } });
  const state = engine.getState(); const audio = ambientPatch(state.layers[0], state); const drums = drumPatch('kick', state, state.layers[4]); const fx = effectiveEffects(state);
  assert.equal(audio.osc1Wave, 'square'); assert.equal(audio.filterResonance, 15); assert.equal(audio.release, 12); assert.equal(audio.lfoDepth, 1); assert.equal(audio.volume, 0);
  assert.equal(drums.midiNote, 48); assert.equal(drums.volume, 0); assert.equal(drums.pan, 0); assert.equal(drums.tone, 0);
  assert.equal(fx.delayMix, 0); assert.equal(fx.reverbMix, 0); assert.equal(fx.masterDrive, 0);
  const restored = new JamEngine(); restored.loadSession(engine.saveSession()); assert.deepEqual(restored.getState().layers.map(l => l.settings), state.layers.map(l => l.settings)); assert.deepEqual(restored.getState().effectsPatch, state.effectsPatch);
});

test('custom GM drum note affects actual generated events and capture', () => {
  const t = testEngine(); t.engine.setLayerSettings('kick', { drumPatch: { midiNote: 48 } }); t.tick(0, 0.05); t.setNow(0.2);
  assert.equal(t.engine.createClip().notes.find(n => n.layerId === 'kick')!.note, 48);
});

test('audio imports reject nonfinite/unknown parameters and metadata without altering session', () => {
  const engine = new JamEngine(); const before = engine.getState();
  for (const update of [ { name: {} }, { deepMindEnabled: {} }, { scale: '__proto__' }, { layers: before.layers.map(l => l.id === 'drone' ? { ...l, name: {} } : l) }, { effectsPatch: { delayMix: Infinity } }, { layers: before.layers.map(l => l.id === 'drone' ? { ...l, settings: { ...l.settings, audioPatch: { filterCutoff: NaN } } } : l) }, { effectsPatch: { constructor: 1 } }, { modRoutes: [{ id: 'bad', source: 'window', destination: 'ambientCutoff', depth: 1, enabled: true }] } ]) {
    if ('scale' in update) { const imported = { ...before, ...update }; engine.loadSession(imported); assert.equal(engine.getState().scale, 'dorian'); engine.loadSession(before); }
    else { assert.throws(() => engine.loadSession({ ...before, ...update }), /Ungültig|Unbekannt/); assert.deepEqual(engine.getState(), before); }
  }
});

test('pins retain only existing parameter IDs and modulation changes real bounded outputs', async () => {
  const { modulationAt, effectiveEffects, ambientPatch } = await import('../engine/jam/JamEngine');
  const engine = new JamEngine(); engine.updateSession({ pinnedParams: ['sound:drone:filterCutoff', 'fx:delayMix', 'drum:kick:decay', 'sound:no:filterCutoff', 'fx:constructor', 'url(http://unsafe)'], modRoutes: [{ id: 'cutoff', source: 'globalChaos', destination: 'ambientCutoff', depth: 1, enabled: true }, { id: 'echo', source: 'globalChaos', destination: 'delayFeedback', depth: 1, enabled: true }] });
  const state = engine.getState(); assert.deepEqual(state.pinnedParams, ['sound:drone:filterCutoff', 'fx:delayMix', 'drum:kick:decay']);
  const offsets = modulationAt(state, [], 0); assert.ok(offsets.ambientCutoffOffset > 0 && offsets.delayFeedbackOffset > 0);
  assert.ok(ambientPatch(state.layers[0], state, 0, offsets.ambientCutoffOffset).filterCutoff > ambientPatch(state.layers[0], state).filterCutoff);
  assert.ok(effectiveEffects(state, offsets).delayFeedback > effectiveEffects(state).delayFeedback);
  assert.equal(effectiveEffects({ ...state, effectsPatch: { delayFeedback: 0.92 } }, offsets).delayFeedback, 0.92);
});

test('enabled drum-probability route affects actual generation rather than only displayed offsets', () => {
  const a = testEngine(); const b = testEngine();
  for (const t of [a, b]) { t.internal.state.macros.movement = 1; t.internal.state.macros.density = 1; t.internal.state.layers.forEach((l: any) => { l.muted = l.id !== 'hihat'; }); t.internal.state.layers[6].settings.rhythmAlgorithm = 'euclidean'; t.internal.state.layers[6].settings.density = 0.8; }
  b.engine.updateSession({ modRoutes: [{ id: 'prob', source: 'globalChaos', destination: 'drumProbability', depth: -1, enabled: true }] });
  for (let step = 0; step < 64; step++) for (const t of [a, b]) { const time = step * 60 / 78 / 4; t.setNow(time); t.tick(step, time); }
  assert.ok(b.internal.events.length < a.internal.events.length);
});

function fakeStartup(t: ReturnType<typeof testEngine>) {
  t.internal.running = false; t.internal.initialized = Promise.resolve(); t.internal.audio.ctx.resume = async () => undefined;
  t.internal.clock = { reset() {}, setBpm() {}, setSwing() {}, start() {}, stop() {} };
}

test('MIDI-only startup restores saved port, rejects missing/denied access and allows explicit Off', async () => {
  const ready = testEngine(); fakeStartup(ready); ready.engine.updateSession({ globalOutputId: 'saved' });
  let requests = 0; ready.engine.midi.init = async () => { requests++; return true; }; ready.engine.midi.getAvailableOutputs = () => [{ id: 'saved', name: 'Saved', state: 'connected' }];
  await ready.engine.start(); assert.equal(requests, 1); assert.equal(ready.engine.midi.getSelectedOutputId(), 'saved'); assert.equal(ready.engine.getPosition().playing, true);
  const absent = testEngine(); fakeStartup(absent); absent.engine.updateSession({ globalOutputId: 'missing' }); absent.engine.midi.init = async () => true;
  await assert.rejects(absent.engine.start(), /gespeicherte MIDI-Port/); assert.equal(absent.engine.getPosition().playing, false);
  const denied = testEngine(); fakeStartup(denied); denied.engine.midi.init = async () => false;
  await assert.rejects(denied.engine.start()); assert.equal(denied.engine.getPosition().playing, false);
  const off = testEngine(); fakeStartup(off); off.engine.updateSession({ globalOutputId: null }); off.engine.midi.init = async () => { throw new Error('Unexpected MIDI permission request'); };
  await off.engine.start(); assert.equal(off.engine.getPosition().playing, true);
});

test('midphrase resume immediately retriggers held harmony with new actual onsets and no phantom capture', async () => {
  const t = testEngine(); t.tick(0, 0.05); t.setNow(2); t.engine.stop();
  const before = t.engine.createClip().notes.map(n => n.id); fakeStartup(t); t.engine.updateSession({ globalOutputId: null });
  await t.engine.start(); const phase = t.internal.stepOffset; assert.ok(phase > 0 && phase % 64 !== 0);
  t.tick(0, 2.05); assert.ok(t.internal.events.some((e: JamEvent) => e.audioTime === 2.05 && ['drone', 'chords'].includes(e.layerId)));
  assert.ok(t.engine.createClip().notes.every(n => before.includes(n.id))); t.setNow(2.2);
  assert.ok(t.engine.createClip().notes.some(n => !before.includes(n.id) && ['drone', 'chords'].includes(n.layerId)));
});

test('long expert effects and route-depth gestures remain single undo transitions', () => {
  const engine = new JamEngine();
  for (let i = 0; i < 150; i++) engine.updateSession({ effectsPatch: { delayMix: i / 150 } });
  engine.undo(); assert.equal(engine.getState().effectsPatch, undefined); engine.redo(); assert.equal(engine.getState().effectsPatch!.delayMix, 149 / 150);
  engine.updateSession({ modRoutes: [{ id: 'route', source: 'globalChaos', destination: 'reverbMix', enabled: true, depth: 0 }] });
  for (let i = 0; i < 150; i++) engine.updateSession({ modRoutes: [{ id: 'route', source: 'globalChaos', destination: 'reverbMix', enabled: true, depth: i / 150 }] });
  engine.undo(); assert.equal(engine.getState().modRoutes![0].depth, 0); engine.redo(); assert.equal(engine.getState().modRoutes![0].depth, 149 / 150);
});

test('restored non-boundary project primes held tones and normalizes false legacy microtonal claims', async () => {
  const t = testEngine(); const session = t.engine.saveSession(); session.runtime!.positionBeat = 6.5; session.scale = 'microtonal';
  t.engine.loadSession(session); assert.equal(t.engine.getState().scale, 'dorian'); assert.equal(t.engine.getPosition().capturedBars, 0);
  fakeStartup(t); t.engine.updateSession({ globalOutputId: null }); await t.engine.start(); t.tick(0, 0.05); t.setNow(0.2);
  const notes = t.engine.createClip().notes; assert.ok(notes.some(n => ['drone', 'chords'].includes(n.layerId))); assert.ok(notes.every(n => n.startBeat >= 6.5));
});
