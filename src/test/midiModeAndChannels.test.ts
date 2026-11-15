import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JamEngine,
  DEFAULT_LAYER_CHANNELS,
  LEGACY_LAYER_CHANNELS,
  validateSession,
  migrateSession,
} from '../engine/jam/JamEngine';
import { createSession } from '../engine/jam/scenes';
import { JamComposer } from '../engine/jam/music';
import { WebMidiManager } from '../engine/midi/webMidi';
import type { StepContext } from '../types';

function createMockPort(id: string) {
  const sent: Array<{ bytes: number[]; timestamp?: number }> = [];
  return {
    id,
    name: id,
    state: 'connected',
    sent,
    send(bytes: number[], timestamp?: number) {
      sent.push({ bytes: [...bytes], timestamp });
    },
    clear() {
      sent.length = 0;
    },
  };
}

function createHarness(sceneId = 'dorian-dawn') {
  let now = 0;
  const state = createSession(sceneId, 42);
  state.outputMode = 'midi';
  state.swing = 0;
  const engine = new JamEngine(state);
  const internal = engine as unknown as {
    audio: { getTime: () => number; ctx: { currentTime: number }; setVolume: () => void };
    running: boolean;
    processStep: (ctx: StepContext) => void;
  };
  internal.audio = {
    getTime: () => now,
    ctx: { get currentTime() { return now; } },
    setVolume() {},
  };
  internal.running = true;

  return {
    engine,
    tick(step: number, time: number, bpm = state.bpm) {
      now = time;
      const ctx: StepContext = {
        step,
        subStep: step % 16,
        bar: Math.floor(step / 16),
        beat: Math.floor((step % 16) / 4),
        time,
        perfTime: (typeof performance !== 'undefined' ? performance.now() : 0) + time * 1000,
        bpm,
        swing: 0,
        swingOffset: 0,
      };
      internal.processStep(ctx);
    },
  };
}

test('default sessions route every instrument to separate MIDI channels 1..8', () => {
  const session = createSession('moss-pulse', 7);
  const byId = Object.fromEntries(session.layers.map(l => [l.id, l.channel]));
  assert.deepEqual(byId, DEFAULT_LAYER_CHANNELS);
  assert.deepEqual(Object.values(byId), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('classic [1,1,3,2,10,10,10,10] and custom channels are preserved across migrateSession, validateSession, and updateSession', () => {
  const base = createSession('dorian-dawn', 5);
  const classicRaw = {
    ...base,
    layers: base.layers.map(l => ({ ...l, channel: LEGACY_LAYER_CHANNELS[l.id] })),
  };
  const migrated = migrateSession(classicRaw);
  assert.deepEqual(
    migrated.layers.map(l => l.channel),
    [1, 1, 3, 2, 10, 10, 10, 10],
  );

  const customRaw = {
    ...base,
    layers: base.layers.map(l =>
      l.id === 'chords' ? { ...l, channel: 11 } : l.id === 'kick' ? { ...l, channel: 12 } : l,
    ),
  };
  const preserved = validateSession(customRaw);
  assert.equal(preserved.layers.find(l => l.id === 'chords')?.channel, 11);
  assert.equal(preserved.layers.find(l => l.id === 'kick')?.channel, 12);
});

test('applyMidiChannelPreset switches cleanly between Classic Ableton, Ch 1..8, and GM Drums Ch 10 and survives updateSession', () => {
  const engine = new JamEngine(createSession('dorian-dawn', 9));
  engine.applyMidiChannelPreset('ableton-classic');
  assert.deepEqual(
    engine.getState().layers.map(l => l.channel),
    [1, 1, 3, 2, 10, 10, 10, 10],
  );
  // Subsequent slider/session edits must never overwrite ableton-classic channels
  engine.updateSession({ bpm: 96, swing: 0.12 });
  assert.deepEqual(
    engine.getState().layers.map(l => l.channel),
    [1, 1, 3, 2, 10, 10, 10, 10],
  );
  assert.deepEqual(
    validateSession(engine.getState()).layers.map(l => l.channel),
    [1, 1, 3, 2, 10, 10, 10, 10],
  );

  engine.applyMidiChannelPreset('gm-drums-10');
  assert.deepEqual(
    engine.getState().layers.map(l => l.channel),
    [1, 2, 3, 4, 10, 10, 10, 10],
  );
  engine.updateSession({ bpm: 102 });
  assert.deepEqual(
    validateSession(engine.getState()).layers.map(l => l.channel),
    [1, 2, 3, 4, 10, 10, 10, 10],
  );

  engine.applyMidiChannelPreset('separate-1-8');
  assert.deepEqual(
    engine.getState().layers.map(l => l.channel),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  engine.updateSession({ bpm: 105 });
  assert.deepEqual(
    engine.getState().layers.map(l => l.channel),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
});

test('new bass styles generate in-range notes and randomizeLayerRhythm / shiftLayerOctave mutate layers cleanly', () => {
  const composer = new JamComposer();
  for (const style of ['breathingSub', 'syncopatedGroove', 'minimalArp'] as const) {
    const session = createSession('deep-dub', 11);
    const bass = session.layers.find(l => l.id === 'bass')!;
    bass.settings.bassStyle = style;
    bass.settings.density = 0.72;
    const notes = [];
    for (let step = 0; step < 32; step++) {
      notes.push(...composer.planStep(step, session).filter(n => n.layerId === 'bass'));
    }
    assert.ok(notes.length > 0, `expected notes for bassStyle ${style}`);
    for (const n of notes) {
      assert.ok(n.note >= bass.settings.minNote && n.note <= bass.settings.maxNote);
    }
  }

  const engine = new JamEngine(createSession('deep-dub', 12));
  const beforeBassStyle = engine.getState().layers.find(l => l.id === 'bass')!.settings.bassStyle;
  engine.randomizeLayerRhythm('bass');
  const afterBassStyle = engine.getState().layers.find(l => l.id === 'bass')!.settings.bassStyle;
  assert.notEqual(afterBassStyle, beforeBassStyle);

  const beforeBassMin = engine.getState().layers.find(l => l.id === 'bass')!.settings.minNote;
  engine.shiftLayerOctave('bass', 1);
  assert.equal(engine.getState().layers.find(l => l.id === 'bass')!.settings.minNote, beforeBassMin + 12);

  const beforeKickNote = engine.getState().layers.find(l => l.id === 'kick')!.settings.minNote;
  engine.shiftLayerOctave('kick', 1);
  assert.equal(engine.getState().layers.find(l => l.id === 'kick')!.settings.minNote, beforeKickNote + 1);
});

test('pure MIDI mode scales velocity with layer.volume and tonal sustain gate with macros.space', () => {
  const h = createHarness('dorian-dawn');
  const scheduled: Array<{ channel: number; velocity: number; durationMs: number; layerId: string }> = [];
  h.engine.midi.scheduleNote = ((channel: number, _note: number, velocity: number, _on: number, durationMs: number, layerId = 'unknown') => {
    scheduled.push({ channel, velocity, durationMs, layerId });
    return `id-${scheduled.length}`;
  }) as unknown as WebMidiManager['scheduleNote'];

  h.engine.updateLayer('chords', { volume: 1.0 });
  h.engine.updateSession({ macros: { ...h.engine.getState().macros, space: 1.0 } });
  h.tick(0, 0.05);
  const loudWide = scheduled.filter(n => n.layerId === 'chords');
  assert.ok(loudWide.length > 0);
  const maxDurWide = Math.max(...loudWide.map(n => n.durationMs));
  const maxVelLoud = Math.max(...loudWide.map(n => n.velocity));

  scheduled.length = 0;
  const hShort = createHarness('dorian-dawn');
  hShort.engine.midi.scheduleNote = ((channel: number, _note: number, velocity: number, _on: number, durationMs: number, layerId = 'unknown') => {
    scheduled.push({ channel, velocity, durationMs, layerId });
    return `id-${scheduled.length}`;
  }) as unknown as WebMidiManager['scheduleNote'];
  hShort.engine.updateLayer('chords', { volume: 0.1 });
  hShort.engine.updateSession({ macros: { ...hShort.engine.getState().macros, space: 0.0 } });
  hShort.tick(0, 0.05);
  const quietShort = scheduled.filter(n => n.layerId === 'chords');
  assert.ok(quietShort.length > 0);
  assert.ok(Math.max(...quietShort.map(n => n.durationMs)) < maxDurWide);
  assert.ok(Math.max(...quietShort.map(n => n.velocity)) < maxVelLoud);
});

test('WebMidiManager clock sync emits 24 PPQN ticks (6 per 16th step) plus Start (0xFA) and Stop (0xFC)', () => {
  const port = createMockPort('IAC Driver Bus 1');
  const midi = new WebMidiManager();
  midi.setMockMidiAccess({ outputs: new Map([[port.id, port]]) } as unknown as MIDIAccess);

  midi.sendRealtime(0xfa, port.id);
  const baseTime = (typeof performance !== 'undefined' ? performance.now() : 0) + 50;
  midi.scheduleClockStep(baseTime, 120, port.id);
  midi.sendRealtime(0xfc, port.id);

  assert.deepEqual(port.sent[0].bytes, [0xfa]);
  const clockTicks = port.sent.filter(msg => msg.bytes.length === 1 && msg.bytes[0] === 0xf8);
  assert.equal(clockTicks.length, 6);
  for (let i = 1; i < clockTicks.length; i++) {
    assert.ok(Math.abs((clockTicks[i].timestamp! - clockTicks[i - 1].timestamp!) - 20) < 1e-6);
  }
  assert.deepEqual(port.sent.at(-1)?.bytes, [0xfc]);
});

test('reconnectMidi recovers from null or stale globalOutputId and upgrades internal mode to both', async () => {
  const other = createMockPort('External Synth');
  const iac = createMockPort('IAC Driver Bus 1');
  const state = createSession('dorian-dawn', 77);
  state.outputMode = 'internal';
  state.globalOutputId = null;

  const engine = new JamEngine(state);
  engine.midi.setMockMidiAccess({ outputs: new Map([[other.id, other], [iac.id, iac]]) } as unknown as MIDIAccess);

  const resNull = await engine.reconnectMidi();
  assert.equal(resNull.ok, true);
  assert.equal(resNull.portId, iac.id);
  assert.equal(resNull.portName, 'IAC Driver Bus 1');
  assert.equal(engine.getState().globalOutputId, iac.id);
  assert.equal(engine.getState().outputMode, 'both');
  assert.equal(engine.midi.getSelectedOutputId(), iac.id);

  // Also recover from a stale/disconnected port ID from a previous session
  engine.updateSession({ outputMode: 'internal', globalOutputId: 'stale-disconnected-port-id' });
  const resStale = await engine.reconnectMidi();
  assert.equal(resStale.ok, true);
  assert.equal(resStale.portId, iac.id);
  assert.equal(engine.getState().globalOutputId, iac.id);
  assert.equal(engine.getState().outputMode, 'both');
  assert.equal(engine.midi.getSelectedOutputId(), iac.id);
});

test('switching outputMode to midi or selecting globalOutputId applies routing and sends MIDI notes immediately', () => {
  const iac = createMockPort('IAC Driver Bus 1');
  const h = createHarness('dorian-dawn');
  const internal = h.engine as unknown as {
    pads: Map<string, { triggerNote: () => void; stopAllVoices: () => void; fadeOutAll: () => void; updateParams: () => void; getActiveVoiceCount: () => { sounding: number; releasing: number } }>;
    secondaryPads: Map<string, { triggerNote: () => void; stopAllVoices: () => void; fadeOutAll: () => void; updateParams: () => void; getActiveVoiceCount: () => { sounding: number; releasing: number } }>;
    drums: { triggerKick: () => void; triggerSnare: () => void; triggerHiHat: () => void; triggerPerc: () => void; stopAllVoices: () => void; stopVoiceKind: () => void };
  };
  for (const l of h.engine.getState().layers) {
    const stub = { triggerNote() {}, stopAllVoices() {}, fadeOutAll() {}, updateParams() {}, getActiveVoiceCount: () => ({ sounding: 0, releasing: 0 }) };
    internal.pads.set(l.id, stub);
    internal.secondaryPads.set(l.id, stub);
  }
  internal.drums = { triggerKick() {}, triggerSnare() {}, triggerHiHat() {}, triggerPerc() {}, stopAllVoices() {}, stopVoiceKind() {} };

  // Put harness back into 'internal' with no port selected first
  h.engine.updateSession({ outputMode: 'internal', globalOutputId: null });
  h.engine.midi.setMockMidiAccess({ outputs: new Map([[iac.id, iac]]) } as unknown as MIDIAccess);

  // Selecting globalOutputId in internal mode upgrades outputMode to 'both' and routes the port
  h.engine.updateSession({ globalOutputId: iac.id });
  assert.equal(h.engine.getState().outputMode, 'both');
  assert.equal(h.engine.midi.getSelectedOutputId(), iac.id);
  h.tick(0, 0.05);
  assert.ok(iac.sent.some(msg => (msg.bytes[0] & 0xf0) === 0x90), 'expected Note On after selecting port');

  // Re-switching via outputMode: 'midi' after selectOff still re-binds best available port and sends notes
  iac.sent.length = 0;
  h.engine.updateSession({ outputMode: 'internal', globalOutputId: null });
  h.engine.updateSession({ outputMode: 'midi' });
  assert.equal(h.engine.getState().outputMode, 'midi');
  assert.equal(h.engine.getState().globalOutputId, iac.id);
  for (let step = 1; step <= 16; step++) {
    h.tick(step, 0.05 + step * 0.12);
  }
  assert.ok(iac.sent.some(msg => (msg.bytes[0] & 0xf0) === 0x90), 'expected Note On in midi mode');
});

test('browser mode uses 1-argument output.send(bytes) without Firefox clear(), and sendTestNote hits Ch 1..8 + Ch 10', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  let clearCalls = 0;
  let openCalls = 0;
  const argCounts: number[] = [];
  const sent: number[][] = [];
  const iac = {
    id: 'iac-1',
    name: 'IAC-Treiber Bus 1',
    state: 'connected',
    open: async () => { openCalls++; },
    send(bytes: number[], ...rest: unknown[]) {
      argCounts.push(1 + rest.length);
      sent.push([...bytes]);
    },
    clear() { clearCalls++; },
  };
  try {
    const midi = new WebMidiManager();
    midi.setMockMidiAccess({ outputs: new Map([[iac.id, iac]]) } as unknown as MIDIAccess);
    midi.selectOutput(iac.id);
    assert.ok(openCalls >= 1, 'should call open() when available');

    const res = midi.sendTestNote();
    assert.equal(res.success, true);
    assert.equal(midi.getSentNoteCount(), 12);
    assert.equal(midi.getLastSentNote()?.channel, 10);
    assert.ok(argCounts.length >= 12);
    assert.ok(argCounts.every(c => c === 1), 'must use 1-arg output.send(bytes) in browser mode');
    assert.equal(clearCalls, 0, 'must not call output.clear() in browser timer mode');

    // Verify all channels 1..8 and 10 received a Note On
    const noteOnChannels = new Set(
      sent.filter(b => (b[0] & 0xf0) === 0x90).map(b => (b[0] & 0x0f) + 1),
    );
    for (const ch of [1, 2, 3, 4, 5, 6, 7, 8, 10]) {
      assert.ok(noteOnChannels.has(ch), `expected test Note On on channel ${ch}`);
    }
    midi.panic();
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
