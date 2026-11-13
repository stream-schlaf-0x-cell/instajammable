import test from 'node:test';
import assert from 'node:assert/strict';
import { MidiFileReader } from '../engine/midi/midiReader';
import { JamEngine, ambientPatch, createSceneSequence, validateSession } from '../engine/jam/JamEngine';
import { JamComposer } from '../engine/jam/music';
import { createSession } from '../engine/jam/scenes';
import type { StepContext } from '../types';
import type { CustomMacro, SequenceBlock } from '../types/jam';
import { DEFAULT_CUSTOM_THEME, LAYOUT_OPTIONS, resolveThemeTokens, STUDIO_THEMES } from '../types/ui';

function makeUnmatchedNoteOffMidi(eventCount: number): Uint8Array {
  const bytes: number[] = [
    // MThd: format 0, 1 track, 96 PPQ
    0x4d, 0x54, 0x68, 0x64,
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x00,
    0x00, 0x01,
    0x00, 0x60,
  ];
  const trackData: number[] = [];
  for (let i = 0; i < eventCount; i++) {
    trackData.push(0x00, 0x80, 60, 64);
  }
  trackData.push(0x00, 0xff, 0x2f, 0x00);
  const len = trackData.length;
  bytes.push(
    0x4d, 0x54, 0x72, 0x6b,
    (len >>> 24) & 0xff,
    (len >>> 16) & 0xff,
    (len >>> 8) & 0xff,
    len & 0xff,
    ...trackData,
  );
  return new Uint8Array(bytes);
}

test('MidiFileReader caps warnings cleanly without infinite recursion when >120 warnings occur', () => {
  const parsed = MidiFileReader.parse(makeUnmatchedNoteOffMidi(135));
  assert.equal(parsed.warnings.length, 121);
  assert.ok(parsed.warnings[120].includes('15 additional MIDI warnings omitted'));
});

test('Arrangement sequencer steps exact bars per block and loadScene resets sequencer runtime', async () => {
  let now = 0;
  const session = createSession('moss-pulse', 42);
  session.outputMode = 'midi';
  session.swing = 0;
  const engine = new JamEngine(session);
  const internal = engine as any;
  internal.audio = { getTime: () => now, ctx: { get currentTime() { return now; } }, setVolume() {} };
  internal.running = true;

  const blocks: SequenceBlock[] = [
    { id: 'b0', section: 'groove', bars: 2 },
    { id: 'b1', section: 'breakdown', bars: 3 },
  ];
  engine.setSequence(blocks);
  engine.toggleSequencer(true);

  const tick = (step: number) => {
    now = step * 0.125;
    const ctx: StepContext = {
      step,
      subStep: step % 16,
      bar: Math.floor(step / 16),
      beat: Math.floor((step % 16) / 4),
      time: now,
      perfTime: now * 1000,
      bpm: session.bpm,
      swing: 0,
      swingOffset: 0,
    };
    internal.processStep(ctx);
  };

  // Block 0 is 2 bars (steps 0..31). Bar 0 -> blockBarProgress 0, Bar 1 -> blockBarProgress 1.
  for (let step = 0; step < 32; step++) {
    tick(step);
    const pos = engine.getPosition();
    assert.equal(pos.sequencer?.activeBlockIndex, 0, `Step ${step} must stay in block 0`);
  }
  assert.equal(engine.getPosition().sequencer?.blockBarProgress, 1);

  // Step 32 enters bar 2 -> immediate transition to block 1 (index 1, progress 0), never an off-by-one 3rd bar in block 0.
  tick(32);
  assert.equal(engine.getPosition().sequencer?.activeBlockIndex, 1);
  assert.equal(engine.getPosition().sequencer?.blockBarProgress, 0);

  internal.running = false;
  await engine.loadScene('dusty-keys');
  const postLoad = engine.getPosition().sequencer;
  assert.equal(postLoad?.activeBlockIndex, 0);
  assert.equal(postLoad?.blockBarProgress, 0);
});

test('setChordHall pushes undo history and undo restores previous reverb state', () => {
  const engine = new JamEngine(createSession('moss-pulse'));
  const beforeMix = engine.getState().effectsPatch?.reverbMix;
  const beforeSpace = engine.getState().macros.space;

  engine.setChordHall(0.92);
  assert.notEqual(engine.getState().effectsPatch?.reverbMix, beforeMix);

  engine.undo();
  assert.equal(engine.getState().effectsPatch?.reverbMix, beforeMix);
  assert.equal(engine.getState().macros.space, beforeSpace);
});

test('duck respects pump bypass in effectChain', () => {
  const session = createSession('dusty-keys', 9);
  session.pump = 0.5;
  const engine = new JamEngine(session);
  const internal = engine as any;
  let scheduledTargets = 0;
  internal.padBus = {
    gain: {
      cancelScheduledValues() {},
      setTargetAtTime() { scheduledTargets++; },
    },
  };

  internal.duck(1.0);
  assert.equal(scheduledTargets, 2);

  engine.toggleEffectBypass('pump');
  internal.duck(2.0);
  assert.equal(scheduledTargets, 2, 'bypassed pump must not schedule padBus gain ducking');

  engine.toggleEffectBypass('pump');
  internal.duck(3.0);
  assert.equal(scheduledTargets, 4);
});

test('Custom macros protect against NaN, obey atmo 10% cap, update live, and respect master bypass + session persistence', () => {
  const base = createSession('moss-pulse');
  base.atmosphere = { kind: 'off', level: 0, tone: 0.5, movement: 0.4 };
  const engine = new JamEngine(base);
  const custom: CustomMacro = {
    id: 'test-atmo',
    name: 'Test Atmo',
    color: '#2dd4bf',
    value: 0.5,
    targets: [
      { id: 't1', param: 'atmo:level', min: 0, max: 0.5 },
      { id: 't2', param: 'fx:reverbMix', min: 0.1, max: 0.7 },
    ],
  };

  engine.addCustomMacro(custom);
  engine.setCustomMacro('test-atmo', 1);
  assert.equal(engine.getState().atmosphere?.kind, 'air', 'raising atmo:level from off activates air bed');
  assert.ok((engine.getState().atmosphere?.level ?? 1) <= 0.10 + 1e-9, 'atmo:level must stay capped at 10%');

  // Guard NaN writes and target updates
  engine.setCustomMacro('test-atmo', Number.NaN);
  assert.equal(Number.isFinite(engine.getState().effectsPatch?.reverbMix), true);

  engine.updateCustomMacro('test-atmo', {
    targets: [
      { id: 't1', param: 'atmo:level', min: Number.NaN, max: 0.08 },
      { id: 't2', param: 'fx:reverbMix', min: 0.4, max: 0.4 },
    ],
  });
  assert.equal(engine.getState().effectsPatch?.reverbMix, 0.4, 'updating targets immediately re-evaluates target params');
  assert.ok((engine.getState().atmosphere?.level ?? 1) <= 0.08 + 1e-9);

  // Bypass blocks macro value changes and persists across validateSession
  engine.setCustomMacrosEnabled(false);
  assert.equal(engine.getState().customMacrosEnabled, false);
  const valBefore = engine.getState().customMacros?.find(m => m.id === 'test-atmo')?.value;
  engine.setCustomMacro('test-atmo', 0.2);
  assert.equal(engine.getState().customMacros?.find(m => m.id === 'test-atmo')?.value, valBefore);

  const saved = validateSession(engine.saveSession());
  assert.equal(saved.customMacrosEnabled, false);
});

test('Chaos state, mode, drift clamping, drag pause, and FX chain master toggle behave safely and persist', () => {
  const engine = new JamEngine(createSession('moss-pulse'));
  engine.setChaosEnabled(true);
  engine.setChaosMode('pulse');
  const startMovement = engine.getState().macros.movement;

  // Dragging pauses autonomous drift
  engine.setChaosDragging(true);
  engine.stepChaosDrift(0.5);
  assert.equal(engine.getState().macros.movement, startMovement);

  engine.setChaosDragging(false);
  engine.stepChaosDrift(0.5);
  assert.notEqual(engine.getState().macros.movement, startMovement);

  // Invalid drift inputs never produce NaN
  (engine as any).setChaosDrift(Number.NaN, 0.5);
  assert.equal(Number.isFinite(engine.getState().macros.movement), true);
  assert.equal(Number.isFinite(engine.getState().macros.space), true);

  // FX master toggle switches all non-EQ chain modules and restores previous snapshot
  assert.equal(engine.isFxChainActive(), true);
  engine.toggleEffectBypass('delay'); // remember delay was already bypassed
  engine.toggleFxChainActive();
  assert.equal(engine.isFxChainActive(), false);
  const nonEqOff = engine.getState().effectChain!.modules.filter(m => m.id !== 'eq');
  assert.ok(nonEqOff.every(m => m.bypassed));

  engine.toggleFxChainActive();
  assert.equal(engine.isFxChainActive(), true);
  assert.equal(engine.getState().effectChain!.modules.find(m => m.id === 'delay')?.bypassed, true);

  const roundtripped = validateSession(engine.saveSession());
  assert.equal(roundtripped.chaosEnabled, true);
  assert.equal(roundtripped.chaosMode, 'pulse');
});

test('applyArrangement orchestrates melody mute/unmute across sections and respects locked layers', () => {
  const session = createSession('dusty-keys', 42);
  const engine = new JamEngine(session);
  const melody = () => engine.getState().layers.find(l => l.role === 'melody')!;

  assert.equal(melody().muted, false);

  engine.applyArrangement('breakdown');
  assert.equal(melody().muted, true);

  engine.applyArrangement('groove');
  assert.equal(melody().muted, false);

  engine.applyArrangement('buildup');
  assert.equal(melody().muted, true);

  engine.applyArrangement('chorus');
  assert.equal(melody().muted, false);

  engine.applyArrangement('silent');
  assert.equal(melody().muted, true);

  // Locked melody must not be toggled by applyArrangement
  const lockedSession = createSession('dusty-keys', 42);
  const lockedMelody = lockedSession.layers.find(l => l.role === 'melody')!;
  lockedMelody.locked = true;
  lockedMelody.muted = false;
  const lockedEngine = new JamEngine(lockedSession);
  lockedEngine.applyArrangement('breakdown');
  assert.equal(lockedEngine.getState().layers.find(l => l.role === 'melody')!.muted, false);
});

test('ambientPatch applies warmth breathing even when custom audioPatch.filterCutoff is configured', () => {
  const base = createSession('dusty-keys', 7);
  const lowWarmth = { ...structuredClone(base), macros: { ...base.macros, warmth: 0.0, movement: 0 } };
  const highWarmth = { ...structuredClone(base), macros: { ...base.macros, warmth: 1.0, movement: 0 } };

  const lowChords = lowWarmth.layers.find(l => l.role === 'chords')!;
  const highChords = highWarmth.layers.find(l => l.role === 'chords')!;
  const lowPatch = ambientPatch(lowChords, lowWarmth, 0);
  const highPatch = ambientPatch(highChords, highWarmth, 0);

  assert.ok(
    lowPatch.filterCutoff > highPatch.filterCutoff,
    `Expected warmth=0 cutoff (${lowPatch.filterCutoff}) > warmth=1 cutoff (${highPatch.filterCutoff})`
  );
  assert.notEqual(lowPatch.filterCutoff, lowChords.settings.audioPatch?.filterCutoff);
});

test('techno bass styles generate distinct patterns for dubOffbeat, pulse8, and psyRoll', () => {
  const composer = new JamComposer();
  const collectSteps = (sceneId: string, override?: 'dubOffbeat' | 'pulse8' | 'psyRoll') => {
    const s = createSession(sceneId, 11);
    const bass = s.layers.find(l => l.role === 'bass')!;
    bass.muted = false;
    bass.settings.density = 1.0;
    if (override) bass.settings.bassStyle = override;
    const steps: number[] = [];
    for (let step = 0; step < 16; step++) {
      const notes = composer.planStep(step, s).filter(e => e.layerId === 'bass');
      if (notes.length > 0) steps.push(step);
    }
    return steps;
  };

  const dubSteps = collectSteps('deep-dub');
  const pulse8Steps = collectSteps('deep-dub', 'pulse8');
  const psyRollSteps = collectSteps('berlin-dub-techno');

  assert.deepEqual(dubSteps, [2, 6, 10, 14]);
  assert.ok(pulse8Steps.length > dubSteps.length, `Expected pulse8 (${pulse8Steps}) denser than dubOffbeat (${dubSteps})`);
  assert.ok(psyRollSteps.length > dubSteps.length, `Expected psyRoll (${psyRollSteps}) denser than dubOffbeat (${dubSteps})`);
  assert.notDeepEqual(pulse8Steps, dubSteps);
  assert.notDeepEqual(psyRollSteps, dubSteps);
  assert.notDeepEqual(psyRollSteps, pulse8Steps);
});

test('createSceneSequence assigns distinct genre-matched templates and initializes JamEngine', () => {
  const shape = (seq: SequenceBlock[]) => seq.map(b => `${b.section}:${b.bars}`);

  const lofi = createSceneSequence('dusty-keys', 'lofi');
  const dub = createSceneSequence('deep-dub', 'techno');
  const symphonic = createSceneSequence('cathedral-adagio', 'ambient');
  const cbl = createSceneSequence('cbl-hydroponic', 'ambient');

  for (const [name, seq] of [['lofi', lofi], ['dub', dub], ['symphonic', symphonic], ['cbl', cbl]] as const) {
    assert.ok(seq.length >= 2, `${name} sequence must contain multiple blocks`);
    assert.ok(seq.every(b => b.bars > 0), `${name} bars must be positive`);
  }

  const shapes = new Set([
    shape(lofi).join(','),
    shape(dub).join(','),
    shape(symphonic).join(','),
    shape(cbl).join(','),
  ]);
  assert.equal(shapes.size, 4, 'Each scene archetype should map to a distinct sequence shape');

  const engine = new JamEngine(createSession('dusty-keys', 5));
  assert.deepEqual(shape(engine.getState().sequence ?? []), shape(lofi));
});

test('updating session root or scale immediately recalculates position chord & chordRoot while stopped', () => {
  const session = createSession('dorian-dawn', 1);
  session.root = 60; // C
  session.scale = 'dorian';
  const engine = new JamEngine(session);

  const initialPos = engine.getPosition();
  assert.equal(initialPos.playing, false);

  engine.setRoot(67); // G
  const afterRootPos = engine.getPosition();
  assert.equal(engine.getState().root, 67);
  assert.equal(((afterRootPos.chordRoot % 12) + 12) % 12, 7, 'chordRoot should follow G tonic when on degree 0');
  assert.notEqual(afterRootPos.chord, initialPos.chord);

  engine.updateSession({ scale: 'phrygian' });
  const afterScalePos = engine.getPosition();
  assert.equal(engine.getState().scale, 'phrygian');
  assert.ok(afterScalePos.chord.length > 0);
  assert.ok(afterScalePos.chordNotes.length >= 2);
});

test('theme palette presets, custom luminance token derivation, and 8 layout options are consistent', () => {
  assert.equal(STUDIO_THEMES.length, 8);
  assert.deepEqual(
    LAYOUT_OPTIONS.map((o) => o.id),
    ['console', 'split', 'stage', 'grid', 'groovebox', 'orbit', 'patchbay', 'synesthesia'],
  );

  const paper = resolveThemeTokens('paper', DEFAULT_CUSTOM_THEME);
  assert.equal(paper.isLight, true);

  const customLight = resolveThemeTokens('custom', {
    bg: '#f8f5ef',
    accent: '#d97706',
    accent2: '#0f766e',
  });
  assert.equal(customLight.isLight, true);
  assert.equal(customLight.accent, '#d97706');

  const customDark = resolveThemeTokens('custom', {
    bg: '#101420',
    accent: '#ff6699',
    accent2: '#38bdf8',
  });
  assert.equal(customDark.isLight, false);
  assert.equal(customDark.bg, '#101420');
});
