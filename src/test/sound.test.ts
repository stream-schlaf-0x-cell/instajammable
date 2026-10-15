import test from 'node:test';
import assert from 'node:assert/strict';
import { EffectsRack } from '../engine/audio/effects';
import { AtmosphereBed, ATMOSPHERE_SOURCES } from '../engine/audio/atmosphere';
import { AmbientSynth } from '../engine/audio/ambientSynth';
import { JamEngine, TIMBRE_PALETTES, effectiveEffects, validateSession, voiceBudget } from '../engine/jam/JamEngine';
import { MusicalClock } from '../engine/clock';
import { createSession, SCENES } from '../engine/jam/scenes';
import { JamComposer, SCALE_INTERVALS, holdBarsFor } from '../engine/jam/music';
import type { JamEvent } from '../types/jam';
import { sanitizeAtmosphere, sanitizeFlow } from '../engine/jam/sound';
import { ATMOSPHERE_KINDS } from '../types/jam';

interface Recorded { name: string; args: number[] }
function param(log: Recorded[], name: string) {
  return { value: 0.5, setValueAtTime(...a: number[]) { log.push({ name: name + '.set', args: a }); }, setTargetAtTime(...a: number[]) { log.push({ name: name + '.target', args: a }); },
    linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues(...a: number[]) { log.push({ name: name + '.cancel', args: a }); } };
}
function fakeNode(log: Recorded[], kind: string, extra: Record<string, unknown> = {}) {
  const node: any = { kind, connections: [] as unknown[], disconnected: false, type: '', loop: false, started: undefined as number | undefined, stopped: undefined as number | undefined, onended: null as null | (() => void),
    gain: param(log, kind + '.gain'), frequency: param(log, kind + '.frequency'), delayTime: param(log, kind + '.delayTime'), Q: param(log, kind + '.Q'), detune: param(log, kind + '.detune'), pan: param(log, kind + '.pan'),
    connect(target: unknown) { node.connections.push(target); return target; }, disconnect() { node.disconnected = true; }, start(t?: number, offset?: number) { node.started = t; node.offset = offset; }, stop(t?: number) { node.stopped = t; }, ...extra };
  return node;
}
function fakeContext(log: Recorded[], extras: Record<string, unknown> = {}) {
  const nodes: any[] = []; const make = (kind: string, extra?: Record<string, unknown>) => () => { const n = fakeNode(log, kind, extra); nodes.push(n); return n; };
  const ctx = { currentTime: 0, sampleRate: 8000, nodes, createGain: make('gain'), createBiquadFilter: make('filter'), createOscillator: make('osc'), createStereoPanner: make('pan'), createWaveShaper: make('shaper'),
    createDelay: (max: number) => { const n = fakeNode(log, 'delay', { max }); nodes.push(n); return n; }, ...extras };
  return ctx as any;
}

test('reverb size never automates a delay line (a click source); decay follows the RT60 formula and stays below self-oscillation', () => {
  const log: Recorded[] = []; const ctx = fakeContext(log); const rack = new EffectsRack(ctx, fakeNode(log, 'dest'), () => {});
  const params = { delayTime: 0.4, delayFeedback: 0.5, delayMix: 0.2, delayFlutter: 0.1, reverbSize: 0.2, reverbDecay: 6, reverbMix: 0.3, masterDrive: 0 };
  rack.updateParams(params); const delayAutomation = (before: number) => log.slice(before).filter(e => e.name === 'delay.delayTime.target').length;
  const combs = ctx.nodes.filter((n: any) => n.kind === 'delay' && n.max === 0.25); assert.equal(combs.length, 12, 'six damped combs per channel');
  const mark = log.length; rack.updateParams({ ...params, reverbSize: 1 }); rack.updateParams({ ...params, reverbSize: 0.5, reverbDecay: 12 });
  assert.equal(log.slice(mark).filter(e => /delay\.delayTime/.test(e.name)).length, 4, 'only the tape delay time glides: two lines per update, never the reverb combs');
  assert.ok(delayAutomation(mark) >= 0);
  for (const e of log.filter(e => e.name === 'gain.gain.target')) assert.ok(e.args[0] <= 0.975 + 1e-9 || e.args[0] <= 1, 'gain targets are bounded');
  rack.updateParams({ ...params, reverbDecay: 14, reverbSize: 1 });
  const feedbackTargets = log.filter(e => e.name === 'gain.gain.target' && e.args[0] > 0.9 && e.args[0] <= 0.975); assert.ok(feedbackTargets.length >= 12, 'long tails reach high but safe feedback');
  assert.ok(log.filter(e => e.name === 'gain.gain.target').every(e => e.args[0] < 1 || e.args[0] <= 1));
});

test('effects rack keeps working without optional nodes (no panner, shaper, oscillator)', () => {
  const log: Recorded[] = []; const ctx = fakeContext(log); delete ctx.createStereoPanner; delete ctx.createWaveShaper; delete ctx.createOscillator;
  const rack = new EffectsRack(ctx, fakeNode(log, 'dest'), () => {}); rack.updateParams({ delayTime: 0.3, delayFeedback: 0.4, delayMix: 0.2, delayFlutter: 0.1, reverbSize: 0.5, reverbDecay: 4, reverbMix: 0.2, masterDrive: 0 });
  rack.killTail(); assert.ok(rack.delayLeft);
});

function bufferContext(log: Recorded[]) {
  const sources: any[] = []; const buffers: any[] = [];
  const ctx = fakeContext(log, {
    createBuffer: (channels: number, length: number, sampleRate: number) => { const data = new Float32Array(length); const b = { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: () => data }; buffers.push(b); return b; },
    createBufferSource: () => { const s = fakeNode(log, 'source', { buffer: null, loopStart: 0, loopEnd: 0 }); sources.push(s); return s; },
    decodeAudioData: async (data: ArrayBuffer) => { if (data.byteLength < 4) throw new Error('bad'); return { duration: data.byteLength / 100, length: data.byteLength, sampleRate: 8000, numberOfChannels: 1, getChannelData: () => new Float32Array(1) }; },
  });
  return { ctx, sources, buffers };
}

test('generated atmosphere beds are finite, normalised and loop-safe', () => {
  const log: Recorded[] = []; const { ctx } = bufferContext(log); ctx.sampleRate = 22050;
  for (const [kind, def] of Object.entries(ATMOSPHERE_SOURCES)) {
    const buffer = def.make(ctx, (() => { let a = 1; return () => (a = (a * 16807) % 2147483647) / 2147483647; })()); const data = buffer.getChannelData(0); let peak = 0;
    for (const v of data) { assert.ok(Number.isFinite(v), kind); peak = Math.max(peak, Math.abs(v)); }
    assert.ok(peak > 0.45 && peak <= 0.5001, `${kind} peak ${peak}`);
  }
});

test('atmosphere sounds only while active, switches kind with a fade, and stops immediately on Panic', () => {
  const log: Recorded[] = []; const { ctx, sources } = bufferContext(log); const bed = new AtmosphereBed(ctx, fakeNode(log, 'out'));
  bed.configure({ kind: 'tape', level: 0.3, tone: 0.5, movement: 0.4 }); assert.equal(sources.length, 0, 'configured but not active: silent');
  bed.setActive(true); assert.equal(sources.length, 1); assert.equal(sources[0].loop, true); assert.ok(sources[0].loopEnd > 0 && sources[0].loopEnd < sources[0].buffer.duration);
  bed.configure({ kind: 'tape', level: 0.5, tone: 0.2, movement: 0.4 }); assert.equal(sources.length, 1, 'level and tone changes reuse the source');
  bed.configure({ kind: 'rain', level: 0.5, tone: 0.2, movement: 0.4 }); assert.equal(sources.length, 2); assert.ok(sources[0].stopped !== undefined, 'old bed fades out');
  bed.configure({ kind: 'off', level: 0.5, tone: 0.2, movement: 0.4 }); assert.equal(sources.length, 2, 'off creates nothing');
  bed.configure({ kind: 'vinyl', level: 0.4, tone: 0.5, movement: 0.4 }); assert.equal(sources.length, 3);
  bed.setActive(false); assert.ok(sources[2].stopped !== undefined); bed.setActive(true); assert.equal(sources.length, 4);
  bed.stopNow(); assert.ok(sources[3].stopped !== undefined);
  bed.configure({ kind: 'tape', level: 0.4, tone: 0.5, movement: 0.4 }); assert.equal(sources.length, 4, 'stopNow leaves the bed inactive until the jam restarts');
});

test('atmosphere sample loading reports unreadable and out-of-range files and never plays a missing sample', async () => {
  const log: Recorded[] = []; const { ctx, sources } = bufferContext(log); const bed = new AtmosphereBed(ctx, fakeNode(log, 'out'));
  await assert.rejects(bed.loadSample(new ArrayBuffer(2), 'x.wav'), /nicht als Audio/);
  await assert.rejects(bed.loadSample(new ArrayBuffer(10), 'short.wav'), /zu kurz/);
  await assert.rejects(bed.loadSample(new ArrayBuffer(70_000), 'long.wav'), /zu lang/);
  bed.setActive(true); bed.configure({ kind: 'sample', level: 0.4, tone: 0.5, movement: 0.3 }); assert.equal(sources.length, 0, 'no sample loaded: nothing plays');
  await bed.loadSample(new ArrayBuffer(400), 'loop.wav'); assert.equal(bed.getSampleName(), 'loop.wav'); assert.equal(sources.length, 1);
  assert.equal(sources[0].loop, true);
  const unsupported = new AtmosphereBed(fakeContext(log), fakeNode(log, 'out')); await assert.rejects(unsupported.loadSample(new ArrayBuffer(400), 'a.wav'), /kann keine Samples/);
});

test('atmosphere, flow and pump settings are validated and survive a session round trip', () => {
  assert.throws(() => sanitizeAtmosphere({ kind: 'wind' }), /Unbekannte/); assert.throws(() => sanitizeAtmosphere({ kind: 'tape', level: Infinity }), /Ungültiger/);
  assert.deepEqual(sanitizeAtmosphere({ kind: 'rain', level: 5, tone: -1, movement: 0.2, sampleName: 'x'.repeat(300) }).sampleName!.length, 120);
  assert.equal(sanitizeAtmosphere({ kind: 'rain', level: 5, tone: -1, movement: 0.2 }).level, 0.10);
  assert.throws(() => sanitizeFlow({ enabled: 'yes' }), /Flow/); assert.equal(sanitizeFlow({ enabled: true, bars: 500, depth: 2 }).bars, 64);
  for (const scene of SCENES) {
    const session = createSession(scene.id, 7); const again = validateSession(structuredClone(session));
    assert.deepEqual(again.atmosphere, session.atmosphere, scene.id); assert.deepEqual(again.flow, session.flow, scene.id); assert.equal(again.pump, session.pump, scene.id);
    for (const layer of again.layers) assert.ok(layer.settings.timbre, scene.id);
  }
  const bad = createSession(); (bad as any).atmosphere = { kind: 'bogus' }; assert.throws(() => validateSession(bad), /Unbekannte Atmosphäre/);
  const old = createSession('dusty-keys'); delete (old as any).atmosphere; delete (old as any).flow; delete (old as any).pump; assert.ok(validateSession(old).atmosphere, 'sessions from before atmosphere gain the scene default');
  assert.ok(ATMOSPHERE_KINDS.includes('sample'));
});

test('deep techno scenes lay a four-on-the-floor kick, off-beat hats and an off-beat sub', () => {
  for (const id of ['deep-dub', 'night-rumble']) {
    const session = createSession(id, 11); assert.equal(session.style, 'techno'); const composer = new JamComposer(); const notes: Array<{ layerId: string; step: number }> = [];
    for (let step = 0; step < 16 * 8; step++) for (const n of composer.planStep(step, session)) notes.push({ layerId: n.layerId, step });
    for (let bar = 0; bar < 8; bar++) { for (const pos of [0, 4, 8, 12]) { const kick = notes.some(n => n.layerId === 'kick' && n.step === bar * 16 + pos); if (pos === 0) assert.ok(kick, `${id} bar ${bar} downbeat kick`); } }
    const kickPositions = new Set(notes.filter(n => n.layerId === 'kick').map(n => n.step % 16)); for (const pos of [0, 4, 8, 12]) assert.ok(kickPositions.has(pos), `${id} kick at ${pos}`);
    assert.ok(notes.filter(n => n.layerId === 'hihat' && [2, 6, 10, 14].includes(n.step % 16)).length >= 20, `${id} off-beat hats`);
    const bass = notes.filter(n => n.layerId === 'bass'); assert.ok(bass.length > 0 && bass.every(n => [2, 6, 10, 14].includes(n.step % 16)), `${id} bass sits between kicks`);
    assert.ok(notes.some(n => n.layerId === 'chords'), `${id} has chord stabs`);
  }
  assert.equal(holdBarsFor('techno'), 4); assert.equal(holdBarsFor('lofi'), 2);
});

test('calm scenes are drum-free and the ambient melody sustains into the next onset', () => {
  for (const id of ['still-water', 'rain-window']) { const s = createSession(id); assert.ok(s.layers.filter(l => l.role === 'drum').every(l => l.muted), id); assert.equal(s.atmosphere!.kind === 'off', false); }
  const session = createSession('ultimae-drift', 5); session.layers.forEach(l => { l.muted = l.id !== 'melody'; }); const composer = new JamComposer(); const notes: Array<{ step: number; durationBeats: number }> = [];
  for (let step = 0; step < 16 * 16; step++) for (const n of composer.planStep(step, session)) notes.push({ step, durationBeats: n.durationBeats });
  assert.ok(notes.length > 8); assert.ok(new Set(notes.map(n => n.step % 16)).size >= 3, 'melody uses more than one rhythmic position');
  assert.ok(notes.some(n => n.durationBeats > 1), 'ambient melody notes are long');
});

test('Flow drifts macros gently, adds to the user value instead of overwriting it, and relaxes when disabled', () => {
  const state = createSession('blue-hour', 3); state.outputMode = 'midi'; const engine = new JamEngine(state); const e = engine as any;
  e.audio = { getTime: () => 0, ctx: { currentTime: 0 }, setVolume() {} }; e.running = true;
  e.state.flow = { enabled: true, bars: 64, depth: 0.5 }; // one boundary every 1024 steps keeps the test deterministic
  const start = engine.getState().macros.space; e.flowTick(0, 0); // first section: nothing yet
  assert.equal(e.state.macros.space, start);
  e.flowTick(1024, 256); assert.equal(e.flow.section, 1); assert.ok(Object.values(e.flow.target).some(v => v !== 0) || e.flow.drumsTarget < 1, 'a move was chosen at the section boundary');
  e.flow.target = { movement: 0, density: 0, warmth: 0, space: 0.2 }; e.flow.offset = { movement: 0, density: 0, warmth: 0, space: 0 }; e.flow.drumsTarget = 1; e.state.macros.space = start;
  for (let step = 1025; step < 1025 + 4 * 40; step++) e.flowTick(step, step / 4);
  assert.ok(e.state.macros.space > start + 0.05 && e.state.macros.space <= start + 0.2 + 1e-9, 'space moved toward the target and stopped there');
  e.state.macros.space += 0.1; const afterUser = e.state.macros.space; e.flowTick(1300, 325); assert.ok(Math.abs(e.state.macros.space - afterUser) < 0.01, "the user's own move is preserved");
  e.state.flow.enabled = false; for (let step = 2000; step < 2000 + 4 * 60; step++) e.flowTick(step, step / 4);
  assert.ok(Math.abs(e.flow.offset.space) < 0.01 && e.flow.drums === 1, 'switching Flow off returns the offsets');
});

test('Flow strip-back softens drums on copies and drops snare and percussion first', () => {
  const state = createSession('deep-dub', 3); state.outputMode = 'midi'; state.swing = 0; const engine = new JamEngine(state); const e = engine as any; let now = 0;
  e.audio = { getTime: () => now, ctx: { currentTime: now }, setVolume() {} }; e.running = true; e.flow.drums = 0.3; e.flow.drumsTarget = 0.3;
  for (let step = 0; step < 32; step++) { now = step * 0.13; e.processStep({ step, subStep: step % 16, bar: Math.floor(step / 16), beat: 0, time: now + 0.01, perfTime: now * 1000, bpm: state.bpm, swing: 0, swingOffset: 0 }); }
  const played = e.events as Array<{ layerId: string; velocity: number }>;
  assert.ok(played.some(n => n.layerId === 'kick')); assert.ok(!played.some(n => n.layerId === 'snare' || n.layerId === 'perc'), 'snare and percussion fall away in a strip-back');
  const original = new JamComposer().planStep(0, state).find(n => n.layerId === 'kick')!; assert.ok(played.filter(n => n.layerId === 'kick')[0].velocity < original.velocity, 'kick softened'); 
  const again = new JamComposer().planStep(0, state).find(n => n.layerId === 'kick')!; assert.equal(again.velocity, original.velocity, 'cached plan notes are not mutated');
});

test('Pump ducks pads smoothly on the audio clock and is silent at zero', () => {
  const log: Recorded[] = []; const state = createSession('deep-dub'); const engine = new JamEngine(state); const e = engine as any; e.padBus = fakeNode(log, 'bus');
  e.duck(2); const targets = log.filter(l => l.name === 'bus.gain.target'); assert.equal(targets.length, 2); assert.ok(targets[0].args[0] < 1 && targets[0].args[0] > 0.5, 'dips, but never gates'); assert.equal(targets[1].args[0], 1); assert.ok(targets[1].args[1] > targets[0].args[1]);
  assert.ok(log.some(l => l.name === 'bus.gain.cancel' && l.args[0] === 2), 'earlier future recovery is replaced, not stacked');
  log.length = 0; engine.updateSession({ pump: 0 }); e.duck(3); assert.equal(log.filter(l => l.name === 'bus.gain.target').length, 0);
});

test('chord stage data: root, hold length, countdown and a different next chord', () => {
  for (const id of ['moss-pulse', 'deep-dub', 'blue-hour']) {
    const engine = new JamEngine(createSession(id, 9)); const position = engine.getPosition(); const style = engine.getState().style;
    assert.equal(position.chordHoldBars, holdBarsFor(style)); assert.ok(position.chordBarsLeft > 0 && position.chordBarsLeft <= position.chordHoldBars);
    assert.ok(position.nextChord.length > 0, id); assert.ok(position.chordNotes.length >= 3); assert.equal(position.chordRoot % 12 >= 0, true);
    assert.deepEqual(engine.getPosition().chordNotes, position.chordNotes, 'peeking the next chord does not disturb the current voicing');
  }
});

test('effects react to style: techno echoes darker and longer than lo-fi, and size controls decay not delay length', () => {
  const techno = effectiveEffects(createSession('deep-dub')); const lofi = effectiveEffects(createSession('dusty-keys')); const calm = effectiveEffects(createSession('still-water'));
  assert.ok(techno.delayFeedback > lofi.delayFeedback); assert.ok(techno.delayTone! < lofi.delayTone!); assert.ok(calm.reverbDecay > lofi.reverbDecay * 1.5); assert.ok(calm.reverbMix > lofi.reverbMix);
});

test('pad voices get generous release budgets so long tails are not cut', () => {
  const engine = new JamEngine(createSession()); const layers = engine.getState().layers;
  const chords = voiceBudget(layers.find(l => l.role === 'chords')!, false); assert.ok(chords[0] >= 5 && chords[1] >= 6);
  const low = voiceBudget(layers.find(l => l.role === 'chords')!, true); assert.ok(low[0] <= chords[0] && low[1] <= 4);
});

test('theft of a releasing pad voice fades out instead of cutting, and is not counted as a sounding voice', () => {
  const log: Recorded[] = []; const ctx = fakeContext(log); const synth = new AmbientSynth(ctx, fakeNode(log, 'out'), 1, 1);
  const params = { osc1Wave: 'sine', osc2Wave: 'sine', osc3Wave: 'sine', detuneSpread: 0, subLevel: 0, filterCutoff: 1000, filterResonance: 1, filterEnvAmount: 0, attack: 0.01, decay: 0.2, sustain: 0.8, release: 5, lfoRate: 0, lfoDepth: 0, driftAmount: 0, voiceSpread: 0, volume: 1, rootNote: 50, scale: 'dorian' } as any;
  ctx.currentTime = 0; synth.triggerNote(0, 60, 80, 0.2, params); ctx.currentTime = 0.3; synth.triggerNote(0.3, 62, 80, 0.2, params); ctx.currentTime = 0.6; synth.triggerNote(0.6, 64, 80, 0.2, params);
  const counts = synth.getActiveVoiceCount(); assert.ok(counts.releasing <= 1 && counts.sounding <= 1);
  const firstVoice = ctx.nodes.slice(0, 8); assert.ok(firstVoice.every((n: any) => !n.disconnected), 'the stolen tail has not been hard-cut yet');
  ctx.currentTime = 1; synth.getActiveVoiceCount(); assert.ok(ctx.nodes.slice(0, 8).every((n: any) => n.disconnected), 'it is cleaned up once the fade has finished');
});

test('a tempo change takes effect on the very next step', () => {
  let now = 0; const ctx = { get currentTime() { return now; }, state: 'running' } as unknown as AudioContext; const calls: number[] = [];
  const clock = new MusicalClock(ctx); clock.setBpm(60); clock.setSwing(0); clock.setCallbacks(c => calls.push(c.time)); clock.start();
  try { // the clock owns a real interval, so it must always be stopped, even when an assertion fails
    for (let i = 0; i < 40; i++) { now = i * 0.05; clock.schedulerLoop(); }
    const slow = calls.at(-1)! - calls.at(-2)!; assert.ok(Math.abs(slow - 0.25) < 1e-9, 'a sixteenth at 60 BPM lasts 250 ms');
    clock.setBpm(120); const before = calls.length; for (let i = 40; i < 120; i++) { now = i * 0.05; clock.schedulerLoop(); }
    const fast = calls.at(-1)! - calls.at(-2)!; assert.ok(Math.abs(fast - 0.125) < 1e-9, 'and 125 ms at 120 BPM'); assert.ok(calls.length - before > 25, `steps after the change: ${calls.length - before}`);
  } finally { clock.stop(); }
});

function runningEngine(sceneId: string, mutateState?: (s: ReturnType<typeof createSession>) => void) {
  let now = 0; const state = createSession(sceneId, 21); state.outputMode = 'midi'; state.swing = 0; mutateState?.(state);
  const engine = new JamEngine(state); const e = engine as any; e.audio = { getTime: () => now, ctx: { currentTime: now }, setVolume() {} }; e.running = true;
  const fades: Array<{ layer: string; time: number; seconds: number }> = []; const released: string[] = [];
  for (const layer of state.layers) if (layer.role !== 'drum') e.pads.set(layer.id, { fadeOutAll: (time: number, seconds: number) => fades.push({ layer: layer.id, time, seconds }), stopAllVoices() {}, updateParams() {}, getActiveVoiceCount: () => ({ sounding: 0, releasing: 0 }) });
  engine.midi.releaseNotesForLayer = (id: string) => { released.push(id); };
  const tick = (step: number) => { const time = 0.05 + step * 60 / state.bpm / 4; now = time + 0.001; e.processStep({ step, subStep: step % 16, bar: Math.floor(step / 16), beat: Math.floor((step % 16) / 4), time, perfTime: time * 1000, bpm: state.bpm, swing: 0, swingOffset: 0 }); return time; };
  return { engine, e, fades, released, tick };
}

test('Evolve while playing crossfades chords, bass and melody at the next step and leaves drone, drums and locked layers alone', () => {
  const t = runningEngine('ultimae-drift'); for (let step = 0; step < 21; step++) t.tick(step);
  const chordsBefore = t.e.events.filter((ev: JamEvent) => ev.layerId === 'chords' && ev.audioTime < 3); assert.ok(chordsBefore.length > 0);
  t.engine.mutate(); assert.equal(t.e.pendingEvolve, true); assert.equal(t.fades.length, 0, 'nothing is cut at the moment of the click');
  const time = t.tick(21); assert.equal(t.e.pendingEvolve, false);
  assert.deepEqual(t.fades.map(f => f.layer).sort(), ['bass', 'chords', 'melody'], 'drone and drums are not faded'); assert.ok(t.fades.every(f => f.time === time && f.seconds > 0.1 && f.seconds < 0.5), 'a short fade that starts exactly at the next step');
  assert.deepEqual([...t.released].sort(), ['bass', 'chords', 'melody']);
  assert.ok(t.e.events.some((ev: JamEvent) => ev.layerId === 'chords' && Math.abs(ev.audioTime - time) < 0.2), 'the rearranged chord enters at that step');
  for (const old of chordsBefore) assert.ok(t.e.eventEnds.get(old.id) <= time + 1e-9, 'captured notes end where the fade starts');
  t.tick(22); assert.equal(t.fades.length, 3, 'the transition happens once');
});

test('Evolve transition respects locked, frozen and muted layers, and does nothing while stopped', () => {
  const t = runningEngine('ultimae-drift', s => { s.layers.find(l => l.id === 'chords')!.locked = true; s.layers.find(l => l.id === 'melody')!.muted = true; });
  for (let step = 0; step < 10; step++) t.tick(step); t.engine.mutate(); t.tick(10); assert.deepEqual(t.fades.map(f => f.layer), ['bass']);
  const stopped = runningEngine('ultimae-drift'); stopped.e.running = false; stopped.engine.mutate(); assert.equal(stopped.e.pendingEvolve, false);
  const frozen = runningEngine('ultimae-drift'); for (let step = 0; step < 4; step++) frozen.tick(step); frozen.e.state.layers.find((l: any) => l.id === 'bass').frozen = true; frozen.engine.mutate(); frozen.tick(4);
  assert.ok(!frozen.fades.some(f => f.layer === 'bass'));
});

test('undo cancels a pending Evolve transition', () => {
  const t = runningEngine('ultimae-drift'); t.engine.mutate(); assert.equal(t.e.pendingEvolve, true); t.engine.undo(); assert.equal(t.e.pendingEvolve, false);
});

test('fading every sounding pad voice leaves new voices untouched and is never counted as a stolen or sounding voice', () => {
  const log: Recorded[] = []; const ctx = fakeContext(log); const synth = new AmbientSynth(ctx, fakeNode(log, 'out'), 4, 4);
  const params = { osc1Wave: 'sine', osc2Wave: 'sine', osc3Wave: 'sine', detuneSpread: 0, subLevel: 0, filterCutoff: 1000, filterResonance: 1, filterEnvAmount: 0, attack: 0.5, decay: 0.2, sustain: 0.8, release: 3, lfoRate: 0, lfoDepth: 0, driftAmount: 0, voiceSpread: 0, volume: 1, rootNote: 50, scale: 'dorian' } as any;
  ctx.currentTime = 0; for (const n of [50, 57, 62]) synth.triggerNote(0, n, 80, 20, params);
  ctx.currentTime = 1; const before = ctx.nodes.length; synth.fadeOutAll(1.02, 0.3); const afterFade = ctx.nodes.length;
  assert.ok(log.some(l => l.name === 'gain.gain.cancel' && l.args[0] === 1.02) && log.some(l => l.name === 'gain.gain.target' && l.args[0] === 0.0001 && l.args[1] === 1.02), 'fade is scheduled on the audio clock');
  assert.deepEqual(synth.getActiveVoiceCount(), { sounding: 0, releasing: 0 }, 'fading voices are excluded from the budgets'); assert.equal(before, afterFade);
  for (const n of [55, 59]) synth.triggerNote(1.02, n, 80, 20, params); ctx.currentTime = 1.05; assert.deepEqual(synth.getActiveVoiceCount(), { sounding: 2, releasing: 0 }, 'new voices all sound; none had to steal');
  ctx.currentTime = 2; assert.deepEqual(synth.getActiveVoiceCount(), { sounding: 2, releasing: 0 }); assert.ok(ctx.nodes.slice(0, 20).some((n: any) => n.disconnected), 'faded voices are cleaned up afterwards');
});

test('Evolve explores new progressions, but a locked or frozen chord layer keeps the home progression', () => {
  const names = (epochs: number, lock = false) => { const session = createSession('ultimae-drift', 4); if (lock) session.layers.find(l => l.id === 'chords')!.locked = true; const out: string[][] = [];
    const composer = new JamComposer(); for (let epoch = 0; epoch < epochs; epoch++) { const row: string[] = []; for (let i = 0; i < 12; i++) row.push(composer.harmonyAt(i * 64, session).name); out.push(row); composer.vary(); } return out; };
  const open = names(8).map(row => row.join(' ')); assert.ok(new Set(open).size >= 6, 'at least six different progressions in eight Evolve steps');
  const locked = names(8, true).map(row => row.join(' ')); assert.equal(new Set(locked).size, 1, 'locked chords never change progression'); assert.equal(locked[0], open[0], 'and it is the original one');
});

test('chords are diverse: voicings change with Evolve and pad chords are rolled instead of struck at once', () => {
  const session = createSession('ultimae-drift', 8); const signatures = new Set<string>(); let rolled = false;
  const composer = new JamComposer(); session.layers.forEach(l => { l.muted = l.id !== 'chords'; });
  for (let epoch = 0; epoch < 10; epoch++) {
    const first = composer.planStep(0, session); signatures.add(first.map(n => n.note).sort().join('-'));
    if (first.length >= 3 && new Set(first.map(n => Math.round(n.microMs))).size >= 3 && first.every(n => n.microMs >= 0 && n.microMs < 600)) rolled = true;
    composer.vary();
  }
  assert.ok(signatures.size >= 5, `distinct chord voicings across Evolve steps: ${signatures.size}`); assert.ok(rolled, 'upper notes enter slightly later than lower notes');
});

test('melody is diverse: rhythm, contour and character change with Evolve in every style and stay in scale', () => {
  for (const id of ['ultimae-drift', 'dusty-keys', 'deep-dub']) {
    const session = createSession(id, 3); session.layers.forEach(l => { l.muted = l.id !== 'melody'; }); session.layers.find(l => l.id === 'melody')!.settings.density = 0.9;
    const scale = SCALE_INTERVALS[session.scale]; const lines = new Set<string>(); const positions = new Set<number>(); const lengths = new Set<number>(); const composer = new JamComposer();
    for (let epoch = 0; epoch < 12; epoch++) {
      const line: string[] = [];
      for (let step = 0; step < 64; step++) for (const n of composer.planStep(step, session)) {
        line.push(`${step}:${n.note}`); positions.add(step % 16); lengths.add(Math.round(n.durationBeats * 4));
        assert.ok(scale.includes(((n.note - session.root) % 12 + 12) % 12) && n.note >= session.layers[3].settings.minNote && n.note <= session.layers[3].settings.maxNote, `${id} note ${n.note} in scale and register`);
      }
      lines.add(line.join(',')); composer.vary();
    }
    assert.ok(lines.size >= 9, `${id}: ${lines.size} distinct lines in 12 Evolve steps`); assert.ok(positions.size >= 7, `${id}: onset positions ${positions.size}`); assert.ok(lengths.size >= 4, `${id}: note lengths ${lengths.size}`);
  }
});

test('Evolve rotates chord and melody timbres within style palettes and respects lock and custom choices', () => {
  const engine = new JamEngine(createSession('ultimae-drift', 2)); engine.updateLayer('melody', { locked: true }); const seen = new Set<string>();
  for (let i = 0; i < 30; i++) { engine.mutate(); const chords = engine.getState().layers.find(l => l.id === 'chords')!; assert.ok(TIMBRE_PALETTES.chords.ambient.includes(chords.settings.timbre)); seen.add(chords.settings.timbre); }
  assert.ok(seen.size >= 3, 'chords visited several timbres'); assert.equal(engine.getState().layers.find(l => l.id === 'melody')!.settings.timbre, 'bell', 'locked layer unchanged');
  const custom = new JamEngine(createSession('ultimae-drift', 2)); custom.setLayerSettings('chords', { timbre: 'strings' }); for (let i = 0; i < 10; i++) custom.mutate();
  assert.equal(custom.getState().layers.find(l => l.id === 'chords')!.settings.timbre, 'strings', 'a timbre outside the palette is the user\'s choice and stays');
  const techno = new JamEngine(createSession('deep-dub', 2)); for (let i = 0; i < 20; i++) { techno.mutate(); assert.ok(TIMBRE_PALETTES.chords.techno.includes(techno.getState().layers.find(l => l.id === 'chords')!.settings.timbre)); }
});
