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

test('shiftLayerOctave transposes melodic layers by +-12 semitones and releases layer notes', () => {
  const port = createMockPort('IAC Driver Bus 1');
  const h = createHarness('dorian-dawn');
  const engine = h.engine;
  engine.midi.setMockMidiAccess({ outputs: new Map([[port.id, port]]) } as unknown as MIDIAccess);
  engine.updateSession({ outputMode: 'midi', globalOutputId: port.id });

  const bassBefore = engine.getState().layers.find(l => l.id === 'bass')!;
  const prevMin = bassBefore.settings.minNote;
  const prevMax = bassBefore.settings.maxNote;

  // Trigger a step so notes are active on MIDI channel
  h.tick(0, 0.05);
  port.sent.length = 0;

  engine.shiftLayerOctave('bass', 1);
  const bassAfterUp = engine.getState().layers.find(l => l.id === 'bass')!;
  assert.equal(bassAfterUp.settings.minNote, prevMin + 12);
  assert.equal(bassAfterUp.settings.maxNote, prevMax + 12);
  assert.ok(port.sent.some(m => (m.bytes[0] & 0xf0) === 0x80), 'shifting octave should send Note Off for held layer notes');

  engine.shiftLayerOctave('bass', -1);
  const bassBack = engine.getState().layers.find(l => l.id === 'bass')!;
  assert.equal(bassBack.settings.minNote, prevMin);
  assert.equal(bassBack.settings.maxNote, prevMax);
});

test('manual arrangement section buttons, templates, and block jumps keep Sequencer OFF when disabled', () => {
  const h = createHarness('dorian-dawn');
  const engine = h.engine;
  engine.toggleSequencer(false);
  assert.equal(engine.getPosition().sequencer?.enabled, false);

  engine.setManualArrangementByEnergy('high');
  assert.equal(engine.getPosition().sequencer?.enabled, false);
  assert.equal(engine.getPosition().arrangementSection, 'chorus');
  assert.equal(engine.getPosition().sequencer?.currentSection, 'chorus');

  engine.setManualArrangementByEnergy('down');
  assert.equal(engine.getPosition().sequencer?.enabled, false);
  assert.equal(engine.getPosition().arrangementSection, 'breakdown');
  assert.equal(engine.getPosition().sequencer?.currentSection, 'breakdown');

  const blockId = engine.getSequencerState().blocks[0].id;
  engine.setBlockSectionByEnergy(blockId, 'up');
  assert.equal(engine.getPosition().sequencer?.enabled, false);
  assert.equal(engine.getPosition().arrangementSection, 'buildup');

  engine.stepBlockBars(blockId, 1);
  assert.equal(engine.getPosition().sequencer?.enabled, false);

  // Applying a template or jumping to a block in SequencerDeck must NOT turn Sequencer ON when OFF
  engine.applySequenceTemplate('four-bars-flow');
  assert.equal(engine.getPosition().sequencer?.enabled, false);
  assert.equal(engine.getState().sequencerEnabled, false);

  engine.jumpToSequenceBlock(1);
  assert.equal(engine.getPosition().sequencer?.enabled, false);
  assert.equal(engine.getState().sequencerEnabled, false);
});

test('engine.evolve() is bar-quantized during mid-bar playback and immediate when stopped', () => {
  const h = createHarness('dorian-dawn');
  const engine = h.engine;
  const internal = engine as unknown as {
    running: boolean;
    nextStep: number;
    composer: { getRuntime: () => { epoch: number } };
    processStep: (ctx: { step: number; bpm: number; swingOffset: number; time: number; beat: number }) => void;
    pads: Map<string, { triggerNote: () => void; stopAllVoices: () => void; fadeOutAll: () => void; updateParams: () => void; getActiveVoiceCount: () => { sounding: number; releasing: number } }>;
    secondaryPads: Map<string, { triggerNote: () => void; stopAllVoices: () => void; fadeOutAll: () => void; updateParams: () => void; getActiveVoiceCount: () => { sounding: number; releasing: number } }>;
    drums: { triggerKick: () => void; triggerSnare: () => void; triggerHiHat: () => void; triggerPerc: () => void; stopAllVoices: () => void; stopVoiceKind: () => void };
  };
  for (const l of engine.getState().layers) {
    const stub = { triggerNote() {}, stopAllVoices() {}, fadeOutAll() {}, updateParams() {}, getActiveVoiceCount: () => ({ sounding: 0, releasing: 0 }) };
    internal.pads.set(l.id, stub);
    internal.secondaryPads.set(l.id, stub);
  }
  internal.drums = { triggerKick() {}, triggerSnare() {}, triggerHiHat() {}, triggerPerc() {}, stopAllVoices() {}, stopVoiceKind() {} };

  // When stopped, evolve runs immediately
  engine.evolve();
  assert.equal(engine.getPosition().evolvePending, false);
  const epochAfterImmediate = internal.composer.getRuntime().epoch;
  assert.ok(epochAfterImmediate >= 1);

  // When running mid-bar (nextStep % 16 !== 0), evolve waits until bar downbeat (step 16)
  internal.running = true;
  internal.nextStep = 5;
  engine.evolve();
  assert.equal(engine.getPosition().evolvePending, true);
  assert.equal(internal.composer.getRuntime().epoch, epochAfterImmediate);

  internal.processStep({ step: 15, bpm: 120, swingOffset: 0, time: 1.0, beat: 15 / 4 });
  assert.equal(engine.getPosition().evolvePending, true, 'still armed at step 15');

  internal.processStep({ step: 16, bpm: 120, swingOffset: 0, time: 1.12, beat: 4 });
  assert.equal(engine.getPosition().evolvePending, false, 'clears armed state at bar boundary step 16');
  assert.ok(internal.composer.getRuntime().epoch > epochAfterImmediate, 'epoch increments at bar boundary');
  internal.running = false;
});

test('restartFromBarOne rewinds beat to 0 and emits MIDI SPP 0 ([0xf2,0,0]) before Start (0xfa)', async () => {
  const port = createMockPort('IAC Driver Bus 1');
  const h = createHarness('dorian-dawn');
  const engine = h.engine;
  engine.midi.setMockMidiAccess({ outputs: new Map([[port.id, port]]) } as unknown as MIDIAccess);
  engine.updateSession({ outputMode: 'midi', globalOutputId: port.id, midiClockEnabled: true });

  const internal = engine as unknown as {
    stoppedBeat: number;
    stepOffset: number;
    nextStep: number;
    init: () => Promise<void>;
    stopPreview: () => void;
    resetFlow: () => void;
    audio: { ctx: { currentTime: number; resume: () => Promise<void> }; getTime: () => number; setVolume: (v: number) => void };
    clock: { reset: () => void; start: () => void; stop: () => void; setBpm: (b: number) => void; setSwing: (s: number) => void };
    pads: Map<string, { triggerNote: () => void; stopAllVoices: () => void; fadeOutAll: () => void; updateParams: () => void; getActiveVoiceCount: () => { sounding: number; releasing: number } }>;
    secondaryPads: Map<string, { triggerNote: () => void; stopAllVoices: () => void; fadeOutAll: () => void; updateParams: () => void; getActiveVoiceCount: () => { sounding: number; releasing: number } }>;
    drums: { triggerKick: () => void; triggerSnare: () => void; triggerHiHat: () => void; triggerPerc: () => void; stopAllVoices: () => void; stopVoiceKind: () => void };
  };
  for (const l of engine.getState().layers) {
    const stub = { triggerNote() {}, stopAllVoices() {}, fadeOutAll() {}, updateParams() {}, getActiveVoiceCount: () => ({ sounding: 0, releasing: 0 }) };
    internal.pads.set(l.id, stub);
    internal.secondaryPads.set(l.id, stub);
  }
  internal.drums = { triggerKick() {}, triggerSnare() {}, triggerHiHat() {}, triggerPerc() {}, stopAllVoices() {}, stopVoiceKind() {} };
  internal.init = async () => {};
  internal.stopPreview = () => {};
  internal.resetFlow = () => {};
  internal.audio = { ctx: { currentTime: 0, resume: async () => {} }, getTime: () => 0, setVolume() {} };
  internal.stoppedBeat = 11.5;
  internal.stepOffset = 46;
  internal.nextStep = 47;
  internal.clock = { reset() {}, start() {}, stop() {}, setBpm() {}, setSwing() {} };

  port.sent.length = 0;
  await engine.restartFromBarOne();

  const pos = engine.getPosition();
  assert.equal(pos.beat, 0);
  assert.equal(pos.bar, 0);

  const sppIndex = port.sent.findIndex(m => m.bytes[0] === 0xf2 && m.bytes[1] === 0x00 && m.bytes[2] === 0x00);
  const startIndex = port.sent.findIndex(m => m.bytes[0] === 0xfa);
  assert.ok(sppIndex >= 0, 'expected Song Position Pointer 0xf2 0x00 0x00');
  assert.ok(startIndex > sppIndex, 'expected MIDI Start 0xfa right after SPP 0');

  await engine.stop();
});

test('Harmony Pace (1/2/4/8-bars & dynamic) and Chord Loop Mode (A/AB/ABC/ABCD) control progression & chord triggers', () => {
  const port = createMockPort('IAC Driver Bus 1');
  const h = createHarness('dorian-dawn');
  const engine = h.engine;
  engine.midi.setMockMidiAccess({ outputs: new Map([[port.id, port]]) } as unknown as MIDIAccess);
  engine.updateSession({ outputMode: 'midi', globalOutputId: port.id });

  // 1-bar Pace should hold 1 bar and emit chord Note On at step 0 and step 16 (next chord)
  engine.setChordPace('1-bar');
  assert.equal(engine.getPosition().chordHoldBars, 1);
  port.sent.length = 0;
  h.tick(0, 0.05);
  const chordChannel = engine.getState().layers.find(l => l.role === 'chords')!.channel;
  assert.ok(port.sent.some(m => (m.bytes[0] & 0xf0) === 0x90 && (m.bytes[0] & 0x0f) + 1 === chordChannel), 'expected chord Note On at step 0');

  port.sent.length = 0;
  h.tick(16, 2.05);
  assert.ok(port.sent.some(m => (m.bytes[0] & 0xf0) === 0x90 && (m.bytes[0] & 0x0f) + 1 === chordChannel), 'expected chord Note On at step 16 under 1-bar pace');

  // 8-bars Pace
  engine.setChordPace('8-bars');
  h.tick(32, 4.05);
  assert.equal(engine.getPosition().chordHoldBars, 8);

  const composer = (engine as unknown as {
    composer: {
      harmonyAt: (step: number, session: ReturnType<JamEngine['getState']>) => { index: number; degree: number; name: string; root: number; notes: number[] };
      vary: () => void;
      planStep: (step: number, session: ReturnType<JamEngine['getState']>) => Array<{ layerId: string; note: number }>;
    };
  }).composer;

  // Dynamic Pace [1, 2, 1, 4] across 8-bar cycle
  engine.setChordPace('dynamic');
  const slot0 = composer.harmonyAt(0, engine.getState());
  const slot1 = composer.harmonyAt(16, engine.getState());
  const slot2 = composer.harmonyAt(48, engine.getState());
  const slot3 = composer.harmonyAt(64, engine.getState());
  assert.equal(slot0.index, 0);
  assert.equal(slot1.index, 1);
  assert.equal(slot2.index, 2);
  assert.equal(slot3.index, 3);

  // Chord Loop Mode 'A' latches exact voicing/notes endlessly across bars & Flow/Evolve epochs
  engine.setChordPace('1-bar');
  engine.setChordLoopMode('A');
  const held = composer.harmonyAt(0, engine.getState());
  assert.ok(engine.getState().latchedHarmony, 'latchedHarmony stored when switching to Hold A');
  composer.vary();
  for (const step of [16, 32, 48, 64, 80, 128, 256]) {
    const atStep = composer.harmonyAt(step, engine.getState());
    assert.equal(atStep.degree, held.degree, `Loop A should hold degree ${held.degree} at step ${step}`);
    assert.equal(atStep.name, held.name, `Loop A should hold chord ${held.name} at step ${step}`);
    assert.deepEqual(atStep.notes, held.notes, `Loop A should freeze exact voicing notes at step ${step}`);
  }
  // Explicit chord step updates latched chord and holds the new one
  engine.cycleChord(1);
  const nextHeld = composer.harmonyAt(160, engine.getState());
  assert.notEqual(nextHeld.degree, held.degree, 'explicit cycleChord moves held chord');
  assert.deepEqual(composer.harmonyAt(176, engine.getState()).notes, nextHeld.notes);

  // Loop Mode 'AB' unlatches and cycles at most 2 distinct degrees across bars 0..3
  engine.setChordLoopMode('AB');
  assert.equal(engine.getState().latchedHarmony, null);
  const abDegrees = new Set([0, 16, 32, 48].map(s => composer.harmonyAt(s, engine.getState()).degree));
  assert.ok(abDegrees.size <= 2, 'Loop AB should cycle at most 2 chord degrees');
});

test('continuous melody plays in every bar, seamless legato bass holds full duration, and all 16/14/12/10/12 styles work', async () => {
  const { BASS_STYLES, CHORD_PATTERNS, MELODY_STYLES, DRONE_STYLES, RHYTHM_ALGORITHMS } = await import('../types/jam');
  const port = createMockPort('IAC Driver Bus 1');
  const h = createHarness('dorian-dawn');
  const engine = h.engine;
  engine.midi.setMockMidiAccess({ outputs: new Map([[port.id, port]]) } as unknown as MIDIAccess);
  engine.updateSession({ outputMode: 'midi', globalOutputId: port.id });

  const composer = (engine as unknown as {
    composer: { planStep: (step: number, session: ReturnType<JamEngine['getState']>) => Array<{ layerId: string; durationBeats: number }> };
  }).composer;

  // 1. Melody never drops a whole bar silent even at low density (0.28)
  engine.setLayerSettings('melody', { density: 0.28, melodyStyle: 'motif' });
  for (let bar = 0; bar < 8; bar++) {
    let barMelodyNotes = 0;
    for (let pos = 0; pos < 16; pos++) {
      barMelodyNotes += composer.planStep(bar * 16 + pos, engine.getState()).filter(n => n.layerId === 'melody').length;
    }
    assert.ok(barMelodyNotes >= 2, `Melody bar ${bar} must keep singing (got ${barMelodyNotes} notes)`);
  }

  // 2. Seamless legato pedal/infiniteDrone/breathingSub bass keeps full duration in MIDI mode even with low space macro
  engine.setMacro('space', 0.25);
  engine.setLayerSettings('bass', { bassStyle: 'pedal', density: 0.8 });
  const pedalNote = composer.planStep(0, engine.getState()).find(n => n.layerId === 'bass');
  assert.ok(pedalNote && pedalNote.durationBeats >= 4.0, `Expected seamless >= 4 beats for pedal bass (got ${pedalNote?.durationBeats})`);

  engine.setLayerSettings('bass', { bassStyle: 'infiniteDrone', density: 0.8 });
  const droneBassNote = composer.planStep(0, engine.getState()).find(n => n.layerId === 'bass');
  assert.ok(droneBassNote && droneBassNote.durationBeats >= 16, `Expected full phrase infiniteDrone bass (got ${droneBassNote?.durationBeats})`);

  // Verify WebMidiManager preserves full durationMs (>= 4 full beats in ms at 120 BPM = 2000ms) without gateMult shrink
  engine.setLayerSettings('bass', { bassStyle: 'pedal', density: 0.8 });
  port.sent.length = 0;
  h.tick(0, 0.05);
  const bassRec = engine.midi.getRecentHistory().find(e => e.layerId === 'bass' && e.type === 'noteOn');
  const expectedFourBeatsMs = (4 * 60000) / engine.getState().bpm;
  assert.ok(typeof bassRec?.durationMs === 'number' && bassRec.durationMs >= expectedFourBeatsMs - 1, `Expected un-gated seamless MIDI bass duration (got ${bassRec?.durationMs}ms)`);

  // 3. Verify all 16 bass, 14 chord, 11 active melody, 10 drone, 12 drum styles produce valid notes across a 4-bar phrase
  const hasNotesFor = (fn: () => void, layerId: string, label: string) => {
    fn();
    let count = 0;
    for (let step = 0; step < 64; step++) {
      count += composer.planStep(step, engine.getState()).filter(n => n.layerId === layerId).length;
    }
    assert.ok(count > 0, `Expected notes for ${label} on layer ${layerId}`);
  };

  for (const bs of BASS_STYLES) hasNotesFor(() => engine.setLayerSettings('bass', { bassStyle: bs, density: 0.75 }), 'bass', `bass:${bs}`);
  for (const cp of CHORD_PATTERNS) hasNotesFor(() => engine.setLayerSettings('chords', { chordPattern: cp, density: 0.75 }), 'chords', `chords:${cp}`);
  for (const ms of MELODY_STYLES.filter(m => m !== 'off')) hasNotesFor(() => engine.setLayerSettings('melody', { melodyStyle: ms, density: 0.75 }), 'melody', `melody:${ms}`);
  for (const ds of DRONE_STYLES) hasNotesFor(() => engine.setLayerSettings('drone', { droneStyle: ds, density: 0.75 }), 'drone', `drone:${ds}`);
  for (const ra of RHYTHM_ALGORITHMS) hasNotesFor(() => engine.setLayerSettings('kick', { rhythmAlgorithm: ra, density: 0.8 }), 'kick', `drum:${ra}`);
});

test('MIDI Input follower supports followHarmony, captureMotif, and native JUCE bridge virtual ports', async () => {
  const h = createHarness('dorian-dawn');
  const engine = h.engine;

  // 1. followHarmony with single bass note (C3 = 48)
  engine.setMidiInputMode('followHarmony');
  engine.handleIncomingMidiMessage(0x90, 48, 100);
  let state = engine.getState();
  assert.equal(state.chordLoopMode, 'A');
  assert.equal(state.latchedHarmony?.root, 48);
  assert.ok(state.latchedHarmony?.name.startsWith('C'), `Expected C-rooted chord name, got ${state.latchedHarmony?.name}`);
  engine.handleIncomingMidiMessage(0x80, 48, 0);

  // 2. followHarmony with 3-note Am triad (57, 60, 64)
  engine.handleIncomingMidiMessage(0x90, 57, 100);
  engine.handleIncomingMidiMessage(0x90, 60, 100);
  engine.handleIncomingMidiMessage(0x90, 64, 100);
  state = engine.getState();
  assert.equal(state.latchedHarmony?.name, 'Am');

  // 3. captureMotif accumulates up to 8 notes and clearCustomMotif resets
  engine.setMidiInputMode('captureMotif');
  engine.handleIncomingMidiMessage(0x90, 62, 100);
  engine.handleIncomingMidiMessage(0x90, 65, 95);
  engine.handleIncomingMidiMessage(0x90, 69, 105);
  state = engine.getState();
  assert.equal(state.customMotifNotes?.length, 3);
  engine.clearCustomMotif();
  assert.equal(engine.getState().customMotifNotes?.length, 0);

  // 4. nativeBridge exposes virtual ports & dispatches __instajammable_midi_out
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const emitted: Array<{ eventId: string; payload: unknown }> = [];
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      __INSTAJAMMABLE_NATIVE__: true,
      __JUCE__: {
        backend: {
          emitEvent(eventId: string, payload: unknown) {
            emitted.push({ eventId, payload });
          },
        },
      },
    },
  });
  try {
    const nativeMidi = new WebMidiManager();
    const ok = await nativeMidi.init();
    assert.equal(ok, true);
    const outIds = nativeMidi.getAvailableOutputs().map(o => o.id);
    assert.ok(outIds.includes('all-native'));
    assert.ok(outIds.includes('vst3-host'));
    assert.ok(outIds.includes('coremidi-bus'));
    const res = nativeMidi.sendTestNote();
    assert.equal(res.success, true);
    assert.ok(emitted.some(e => e.eventId === '__instajammable_midi_out'), 'expected native MIDI out event');
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete (globalThis as { window?: unknown }).window;
  }
});
