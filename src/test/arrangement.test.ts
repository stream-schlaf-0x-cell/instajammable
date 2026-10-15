import test from 'node:test';
import assert from 'node:assert/strict';
import { JamEngine, ambientPatch, effectiveEffects } from '../engine/jam/JamEngine';
import { createSession, SCENES } from '../engine/jam/scenes';
import { RHYTHM_POOL, findRhythmPreset } from '../engine/jam/rhythms';

test('Arrangement actions update layer states, volumes and macros live', () => {
  const engine = new JamEngine(createSession('moss-pulse'));

  // 1. Chorus: lifts macros and un-mutes/boosts energy
  engine.applyArrangement('chorus');
  let session = engine.getState();
  let pos = engine.getPosition();
  assert.equal(pos.arrangementSection, 'chorus');
  assert.ok(session.macros.warmth >= 0.5, 'chorus warms the synth');
  assert.ok(session.macros.density >= 0.5, 'chorus increases macro density');
  const kick = session.layers.find(l => l.id === 'kick')!;
  assert.equal(kick.muted, false, 'drums are un-muted in chorus');
  assert.ok(kick.volume >= 0.5, 'kick volume is boosted in chorus');

  // 2. Breakdown: mutes drums, lifts space so pads float
  const spaceBefore = session.macros.space;
  engine.applyArrangement('breakdown');
  session = engine.getState();
  pos = engine.getPosition();
  assert.equal(pos.arrangementSection, 'breakdown');
  for (const layer of session.layers.filter(l => l.role === 'drum')) {
    assert.equal(layer.muted, true, `${layer.id} is muted in breakdown`);
  }
  const chordLayer = session.layers.find(l => l.role === 'chords')!;
  assert.equal(chordLayer.muted, false, 'chords stay sounding in breakdown');
  assert.ok(session.macros.space >= spaceBefore, 'reverb/space opens up during breakdown');

  // 3. Silent: intimate ambient part
  engine.applyArrangement('silent');
  session = engine.getState();
  pos = engine.getPosition();
  assert.equal(pos.arrangementSection, 'silent');
  for (const layer of session.layers.filter(l => l.role === 'drum')) {
    assert.equal(layer.muted, true, `${layer.id} is muted in silent part`);
  }
  assert.ok(session.macros.density <= 0.45, 'density is kept low in silent part');

  // 4. Buildup: sets 4-bar countdown and activates tension
  engine.applyArrangement('buildup');
  session = engine.getState();
  pos = engine.getPosition();
  assert.equal(pos.arrangementSection, 'buildup');
  assert.equal(pos.buildupCountdown, 4, 'buildup initiates 4-bar countdown');
  const hihat = session.layers.find(l => l.id === 'hihat')!;
  assert.equal(hihat.muted, false, 'hihat is active during buildup');
  assert.ok(hihat.settings.density >= 0.7, 'hihat density is high for roll');

  // 5. Drop In (Groove): releases tension, restores full beat
  engine.applyArrangement('groove');
  session = engine.getState();
  pos = engine.getPosition();
  assert.equal(pos.arrangementSection, 'groove');
  assert.equal(pos.buildupCountdown, undefined);
  for (const layer of session.layers) {
    assert.equal(layer.muted, false, `${layer.id} is active in full groove`);
  }
  assert.ok(session.layers.find(l => l.id === 'kick')!.volume >= 0.8, 'kick has full volume on drop in');

  // 6. Spontaneous decision works reliably
  engine.applyArrangement('spontaneous');
  pos = engine.getPosition();
  assert.ok(['chorus', 'breakdown', 'buildup', 'groove', 'silent'].includes(pos.arrangementSection!));

  // 7. Undo restores prior arrangement state
  engine.undo();
  assert.equal(engine.getPosition().arrangementSection, 'groove');
});

test('Rhythm pool presets update drum algorithms, density and swing live', () => {
  const engine = new JamEngine(createSession('moss-pulse'));

  // Test CBL Psybient preset
  assert.ok(RHYTHM_POOL.length >= 7, 'rhythm pool has at least 7 curated presets');
  const cbl = findRhythmPreset('cbl-psybient')!;
  assert.ok(cbl, 'CBL preset exists');
  engine.applyRhythmPreset('cbl-psybient');
  let session = engine.getState();
  assert.equal(session.swing, cbl.swing);
  const hihat = session.layers.find(l => l.id === 'hihat')!;
  assert.equal(hihat.settings.rhythmAlgorithm, 'polymetric', 'CBL uses polymetric hi-hat');
  const perc = session.layers.find(l => l.id === 'perc')!;
  assert.equal(perc.settings.rhythmAlgorithm, 'densityBurst', 'CBL uses densityBurst perc');

  // Test Aes Dana Dub preset
  engine.applyRhythmPreset('aes-dana-dub');
  session = engine.getState();
  const kick = session.layers.find(l => l.id === 'kick')!;
  assert.ok(kick.settings.density >= 0.9, 'Aes Dana has solid 4-on-the-floor kick');

  // Test Euclidean Interlock preset
  engine.applyRhythmPreset('euclidean-interlock');
  session = engine.getState();
  for (const layer of session.layers.filter(l => l.role === 'drum')) {
    assert.equal(layer.settings.rhythmAlgorithm, 'euclidean', `${layer.id} uses euclidean rhythm`);
  }

  // Test Markov Organic preset
  engine.applyRhythmPreset('markov-organic');
  session = engine.getState();
  for (const layer of session.layers.filter(l => l.role === 'drum')) {
    assert.equal(layer.settings.rhythmAlgorithm, 'markov', `${layer.id} uses markov rhythm`);
  }
});

test('Carbon Based Lifeforms scene presets generate valid harmony and capped atmosphere', () => {
  for (const sceneId of ['cbl-hydroponic', 'cbl-interloper']) {
    const sceneDef = SCENES.find(s => s.id === sceneId);
    assert.ok(sceneDef, `${sceneId} is catalogued`);
    assert.ok(sceneDef.description.includes('Carbon Based Lifeforms') || sceneDef.mood?.includes('CBL'));

    const session = createSession(sceneId);
    assert.ok(session.atmosphere, `${sceneId} has atmosphere`);
    assert.ok(session.atmosphere.level <= 0.20, `${sceneId} atmosphere is capped <= 0.20`);
    assert.ok(session.layers.length >= 8);

    // Verify generative notes are produced in scale
    const notes = session.layers.map(l => l.settings.minNote);
    assert.ok(notes.every(n => Number.isFinite(n)));
  }
});

test('Auto-arrangement toggle updates position and logs change', () => {
  const engine = new JamEngine(createSession('moss-pulse'));
  assert.equal(engine.getPosition().autoArrangement, false);

  engine.toggleAutoArrangement(true, 16);
  assert.equal(engine.getPosition().autoArrangement, true);
  const state = engine.getArrangementState();
  assert.equal(state.auto, true);
  assert.equal(state.autoBars, 16);

  engine.toggleAutoArrangement(false);
  assert.equal(engine.getPosition().autoArrangement, false);
});

test('Large String Orchestra synthesizes rich symphonic ensemble chords with massive hall', () => {
  const session = createSession('symphonic-dawn');
  const chordLayer = session.layers.find(l => l.role === 'chords')!;
  assert.equal(chordLayer.settings.timbre, 'strings', 'symphonic scene defaults to strings');

  // Verify synth patch characteristics
  const synthPatch = ambientPatch(chordLayer, session);
  assert.equal(synthPatch.osc1Wave, 'sawtooth');
  assert.equal(synthPatch.osc2Wave, 'sawtooth');
  assert.equal(synthPatch.osc3Wave, 'triangle');
  assert.ok(synthPatch.detuneSpread >= 18, 'rich ensemble detune');
  assert.ok(synthPatch.subLevel >= 0.1, 'warm cello/contrabass foundational body');
  assert.ok(synthPatch.attack >= 2.0, 'slow symphonic bow attack');
  assert.ok(synthPatch.release >= 5.0, 'massive orchestral hall release');
  assert.equal(synthPatch.voiceSpread, 0.95, 'ultra-wide orchestral stereo panorama');

  // Verify hall reverb sizing for strings
  const fx = effectiveEffects(session);
  assert.ok(fx.reverbDecay >= 6.0, 'extended cathedral hall reverb decay');
  assert.ok(fx.reverbSize >= 0.8, 'massive concert hall room size');
});

test('Soundscapes match chords, hall reverb, and background atmosphere', () => {
  const engine = new JamEngine(createSession('dorian-dawn'));

  // 1. Apply Symphonic Strings soundscape
  engine.applySoundscapePreset('symphonic-strings');
  let state = engine.getState();
  const chords = state.layers.find(l => l.role === 'chords')!;
  assert.equal(chords.settings.timbre, 'strings');
  assert.ok(state.atmosphere);
  assert.equal(state.atmosphere.kind, 'air', 'orchestra pairs with concert hall air atmosphere');
  assert.ok(state.atmosphere.level <= 0.20, 'atmosphere pegel is strictly capped <= 0.20');
  assert.ok(state.macros.space >= 0.8, 'space macro is wide for orchestra hall');

  // 2. Direct chord timbre change with matching atmosphere coupling
  engine.setChordTimbre('wash', true);
  state = engine.getState();
  assert.equal(state.layers.find(l => l.role === 'chords')!.settings.timbre, 'wash');
  assert.equal(state.atmosphere!.kind, 'tape', 'wash pairs with tape atmosphere');

  // 3. Direct Hall slider adjustment
  engine.setChordHall(0.92);
  state = engine.getState();
  assert.equal(state.macros.space, 0.92);
  assert.ok(state.effectsPatch!.reverbDecay! >= 8.0);
});

test('Arrangement Sequencer executes "4 Takte dies, 4 Takte jenes" and glides arrangable macros', () => {
  const engine = new JamEngine(createSession('moss-pulse'));
  assert.equal(engine.getPosition().sequencer, undefined);

  // 1. Activate Sequencer
  engine.toggleSequencer(true);
  let pos = engine.getPosition();
  assert.ok(pos.sequencer);
  assert.equal(pos.sequencer.enabled, true);

  // 2. Apply "4 Takte Dies & Jenes (Flow)" template
  engine.applySequenceTemplate('four-bars-flow');
  const seqState = engine.getSequencerState();
  assert.equal(seqState.blocks.length, 4);
  assert.equal(seqState.blocks[0].section, 'groove');
  assert.equal(seqState.blocks[0].bars, 4);
  assert.equal(seqState.blocks[1].section, 'breakdown');
  assert.equal(seqState.blocks[1].bars, 4);

  // 3. Jump to breakdown block and verify target macros
  engine.jumpToSequenceBlock(1);
  pos = engine.getPosition();
  assert.equal(pos.sequencer?.activeBlockIndex, 1);
  assert.equal(pos.arrangementSection, 'breakdown');
  let session = engine.getState();
  assert.ok(session.macros.space >= 0.8, 'breakdown block target space is high for floating strings');

  // 4. Update block and add new block
  const block0Id = seqState.blocks[0].id;
  engine.updateSequenceBlock(block0Id, { bars: 8, macroTargets: { space: 0.65, warmth: 0.75 } });
  assert.equal(engine.getSequencerState().blocks[0].bars, 8);

  engine.addSequenceBlock('chorus', 8);
  assert.equal(engine.getSequencerState().blocks.length, 5);

  // 5. Verify roundtrip persistence
  const saved = engine.saveSession();
  assert.ok(saved.sequence && saved.sequence.length === 5);
  assert.equal(saved.sequencerEnabled, true);

  const engine2 = new JamEngine(saved);
  assert.equal(engine2.getSequencerState().blocks.length, 5);
  assert.equal(engine2.getSequencerState().enabled, true);
});

