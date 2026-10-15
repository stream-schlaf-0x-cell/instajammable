import test from 'node:test';
import assert from 'node:assert/strict';
import { JamEngine, validateSession } from '../engine/jam/JamEngine';
import { createSession } from '../engine/jam/scenes';
import { EQ_PRESETS } from '../engine/jam/customMacros';
import type { CustomMacro } from '../types/jam';

test('Studio Equalizer: setEq updates effectsPatch with proper bounds and defaults', () => {
  const engine = new JamEngine(createSession('moss-pulse'));

  // Initial state should have default eq values
  const initPatch = engine.getState().effectsPatch || {};
  assert.equal(typeof (initPatch.eqLow ?? 0), 'number');
  assert.equal(typeof (initPatch.eqMid ?? 0), 'number');
  assert.equal(typeof (initPatch.eqHigh ?? 0), 'number');
  assert.equal(typeof (initPatch.eqHighpass ?? 20), 'number');

  // Apply custom EQ settings
  engine.setEq({
    highpass: 80,
    low: 4.5,
    mid: -3.0,
    midFreq: 1200,
    midQ: 1.8,
    high: 2.0,
  });

  let patch = engine.getState().effectsPatch!;
  assert.equal(patch.eqHighpass, 80);
  assert.equal(patch.eqLow, 4.5);
  assert.equal(patch.eqMid, -3.0);
  assert.equal(patch.eqMidFreq, 1200);
  assert.equal(patch.eqMidQ, 1.8);
  assert.equal(patch.eqHigh, 2.0);

  // Clamping check: out of range values should be clamped safely
  engine.setEq({
    highpass: 10, // below min 20
    low: 35, // above max 14
    mid: -40, // below min -14
    midFreq: 50, // below min 200
    midQ: 10, // above max 4
    high: 50, // above max 14
  });

  patch = engine.getState().effectsPatch!;
  assert.equal(patch.eqHighpass, 20, 'highpass clamped to min 20 Hz');
  assert.equal(patch.eqLow, 14, 'low gain clamped to max +14 dB');
  assert.equal(patch.eqMid, -14, 'mid gain clamped to min -14 dB');
  assert.equal(patch.eqMidFreq, 200, 'midFreq clamped to min 200 Hz');
  assert.equal(patch.eqMidQ, 4, 'midQ clamped to max 4');
  assert.equal(patch.eqHigh, 14, 'high gain clamped to max +14 dB');
});

test('Studio Equalizer: Presets can be applied cleanly', () => {
  const engine = new JamEngine(createSession('moss-pulse'));

  const lofiPreset = EQ_PRESETS.find(p => p.id === 'lofi-radio');
  assert.ok(lofiPreset, 'lofi-radio preset exists');

  engine.setEq({
    highpass: lofiPreset.highpass,
    low: lofiPreset.low,
    mid: lofiPreset.mid,
    midFreq: lofiPreset.midFreq,
    midQ: lofiPreset.midQ,
    high: lofiPreset.high,
  });

  const patch = engine.getState().effectsPatch!;
  assert.equal(patch.eqHighpass, lofiPreset.highpass);
  assert.equal(patch.eqLow, lofiPreset.low);
  assert.equal(patch.eqMid, lofiPreset.mid);
  assert.equal(patch.eqHigh, lofiPreset.high);
});

test('Effect Chain: EQ module can be bypassed and un-bypassed', () => {
  const engine = new JamEngine(createSession('moss-pulse'));

  const chain = engine.getEffectChain();
  const eqModule = chain.modules.find(m => m.id === 'eq');
  assert.ok(eqModule, 'eq module is registered in default effect chain');
  assert.equal(eqModule.bypassed, false, 'eq module is active by default');

  // Toggle bypass
  engine.toggleEffectBypass('eq');
  assert.equal(engine.getEffectChain().modules.find(m => m.id === 'eq')?.bypassed, true);

  // Toggle back
  engine.toggleEffectBypass('eq');
  assert.equal(engine.getEffectChain().modules.find(m => m.id === 'eq')?.bypassed, false);
});

test('Custom Macros: Can target Studio EQ parameters (eqLow, eqMid, eqHigh, eqHighpass)', () => {
  const engine = new JamEngine(createSession('moss-pulse'));

  const eqMacro: CustomMacro = {
    id: 'macro-eq-boost',
    name: 'EQ Air & Sub Filter',
    color: '#06b6d4',
    value: 0.0,
    targets: [
      { id: 't-hp', param: 'fx:eqHighpass', min: 20, max: 200 },
      { id: 't-low', param: 'fx:eqLow', min: -4, max: 6 },
      { id: 't-high', param: 'fx:eqHigh', min: -6, max: 8 },
    ],
  };

  engine.addCustomMacro(eqMacro);

  // At 0.0:
  let patch = engine.getState().effectsPatch!;
  assert.equal(patch.eqHighpass, 20);
  assert.equal(patch.eqLow, -4);
  assert.equal(patch.eqHigh, -6);

  // At 1.0 (100%):
  engine.setCustomMacro('macro-eq-boost', 1.0);
  patch = engine.getState().effectsPatch!;
  assert.equal(patch.eqHighpass, 200);
  assert.equal(patch.eqLow, 6);
  assert.equal(patch.eqHigh, 8);

  // At 0.5 (50%):
  engine.setCustomMacro('macro-eq-boost', 0.5);
  patch = engine.getState().effectsPatch!;
  assert.equal(patch.eqHighpass, 110);
  assert.equal(patch.eqLow, 1);
  assert.equal(patch.eqHigh, 1);
});

test('Sequencer Follow: JamPosition exposes enriched sequence tracking metrics', () => {
  const engine = new JamEngine(createSession('moss-pulse'));

  // Ensure sequencer is enabled with at least 2 blocks
  engine.toggleSequencer(true);
  const seqState = engine.getSequencerState();
  assert.ok(seqState.blocks.length >= 2, 'sequencer has multiple blocks');

  const pos = engine.getPosition();
  assert.ok(pos.sequencer, 'sequencer info present on position');
  assert.equal(pos.sequencer.enabled, true);
  assert.equal(typeof pos.sequencer.totalBlocks, 'number');
  assert.equal(pos.sequencer.totalBlocks, seqState.blocks.length);
  assert.equal(typeof pos.sequencer.barsUntilNextBlock, 'number');
  assert.ok(pos.sequencer.totalBlockBars >= 1);

  // Jump to second block
  engine.jumpToSequenceBlock(1);
  const updatedPos = engine.getPosition();
  assert.equal(updatedPos.sequencer?.activeBlockIndex, 1);
  assert.equal(updatedPos.sequencer?.blockBarProgress, 0);
  assert.equal(updatedPos.sequencer?.barsUntilNextBlock, updatedPos.sequencer?.totalBlockBars);
});

test('Session Validation: preserves EQ module and parameters without error', () => {
  const engine = new JamEngine(createSession('moss-pulse'));
  engine.setEq({ highpass: 65, low: 2, mid: -1, high: 3.5 });

  const rawSession = engine.saveSession();
  const validated = validateSession(rawSession);

  assert.ok(validated.workspaceModules?.includes('eq'), 'workspaceModules has eq');
  assert.ok(validated.effectChain?.modules.some(m => m.id === 'eq'), 'effect chain modules has eq');
  assert.equal(validated.effectsPatch?.eqHighpass, 65);
  assert.equal(validated.effectsPatch?.eqLow, 2);
  assert.equal(validated.effectsPatch?.eqMid, -1);
  assert.equal(validated.effectsPatch?.eqHigh, 3.5);
});
