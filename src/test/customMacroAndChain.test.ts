import test from 'node:test';
import assert from 'node:assert/strict';
import { JamEngine } from '../engine/jam/JamEngine';
import { createSession } from '../engine/jam/scenes';
import { validateSession } from '../engine/jam/JamEngine';
import type { CustomMacro } from '../types/jam';

test('Custom Macros: can be created, manipulated, and smoothly drive multiple targets', () => {
  const engine = new JamEngine(createSession('moss-pulse'));

  const newMacro: CustomMacro = {
    id: 'test-macro-1',
    name: 'Dreck & Space Test',
    color: '#f59e0b',
    value: 0.0,
    targets: [
      { id: 't1', param: 'macro:space', min: 0.2, max: 0.9 },
      { id: 't2', param: 'fx:reverbMix', min: 0.1, max: 0.75 },
      { id: 't3', param: 'layer:kick:volume', min: 0.2, max: 0.8, inverted: true },
    ],
  };

  engine.addCustomMacro(newMacro);
  let session = engine.getState();
  const found = session.customMacros?.find(m => m.id === 'test-macro-1');
  assert.ok(found, 'custom macro was added to session');

  // Value at 0.0:
  // space -> 0.2
  // reverbMix -> 0.1
  // kick volume (inverted) -> 0.8 (since inverted: max - 0*(max-min) = 0.8)
  assert.equal(session.macros.space, 0.2);
  assert.equal(session.effectsPatch?.reverbMix, 0.1);
  const kickLayer = session.layers.find(l => l.id === 'kick')!;
  assert.equal(kickLayer.volume, 0.8);

  // Turn macro to 1.0 (100%):
  engine.setCustomMacro('test-macro-1', 1.0);
  session = engine.getState();
  assert.ok(Math.abs(session.macros.space - 0.9) < 1e-6);
  assert.ok(Math.abs((session.effectsPatch?.reverbMix ?? 0) - 0.75) < 1e-6);
  const kickLayerFull = session.layers.find(l => l.id === 'kick')!;
  assert.ok(Math.abs(kickLayerFull.volume - 0.2) < 1e-6); // inverted down to min

  // Turn macro to 0.5 (50%):
  engine.setCustomMacro('test-macro-1', 0.5);
  session = engine.getState();
  assert.equal(Math.round(session.macros.space * 100), 55); // 0.2 + 0.5 * 0.7 = 0.55
  assert.equal(Math.round((session.effectsPatch?.reverbMix ?? 0) * 100), 43); // 0.1 + 0.5 * 0.65 = 0.425 -> 43

  // Update macro
  engine.updateCustomMacro('test-macro-1', { name: 'Renamed Space' });
  session = engine.getState();
  assert.equal(session.customMacros?.find(m => m.id === 'test-macro-1')?.name, 'Renamed Space');

  // Delete macro
  engine.deleteCustomMacro('test-macro-1');
  session = engine.getState();
  assert.ok(!session.customMacros?.some(m => m.id === 'test-macro-1'), 'macro was deleted');
});

test('Effect Chain: supports routing modes (parallel, delay-into-reverb, reverb-into-delay) and bypass', () => {
  const engine = new JamEngine(createSession('cbl-hydroponic'));
  let chain = engine.getEffectChain();
  assert.equal(chain.mode, 'parallel');

  // Switch to delay-into-reverb (Psybient Wash)
  engine.setEffectChainMode('delay-into-reverb');
  chain = engine.getEffectChain();
  assert.equal(chain.mode, 'delay-into-reverb');

  // Toggle bypass on delay
  engine.toggleEffectBypass('delay');
  chain = engine.getEffectChain();
  const delayMod = chain.modules.find(m => m.id === 'delay')!;
  assert.equal(delayMod.bypassed, true);

  // Unbypass delay
  engine.toggleEffectBypass('delay');
  chain = engine.getEffectChain();
  assert.equal(chain.modules.find(m => m.id === 'delay')!.bypassed, false);

  // Reorder chain
  engine.reorderEffectChain(['reverb', 'delay', 'warmth', 'flutter', 'pump']);
  chain = engine.getEffectChain();
  assert.equal(chain.modules[0].id, 'reverb');
  assert.equal(chain.modules[1].id, 'delay');
});

test('Workspace Modules: user can toggle open modules and switch presets', () => {
  const engine = new JamEngine(createSession('symphonic-dawn'));
  let modules = engine.getWorkspaceModules();
  assert.ok(modules.includes('soundscape'));

  // Toggle off soundscape
  engine.toggleWorkspaceModule('soundscape');
  modules = engine.getWorkspaceModules();
  assert.ok(!modules.includes('soundscape'), 'soundscape was toggled off');

  // Toggle back on
  engine.toggleWorkspaceModule('soundscape');
  modules = engine.getWorkspaceModules();
  assert.ok(modules.includes('soundscape'), 'soundscape was toggled back on');

  // Set minimal preset
  engine.setWorkspaceModules(['pianoroll', 'custommacros']);
  modules = engine.getWorkspaceModules();
  assert.deepEqual(modules, ['pianoroll', 'custommacros']);
});

test('Chaos & Drift Modulator: smoothly perturbs coordinates and applies organic pulse', () => {
  const engine = new JamEngine(createSession('ultimae-drift'));
  engine.setChaosDrift(0.42, 0.77);
  let session = engine.getState();
  assert.equal(session.macros.movement, 0.42);
  assert.equal(session.macros.space, 0.77);

  // Trigger organic impulse
  engine.applyChaosImpulse();
  session = engine.getState();
  assert.ok(session.macros.movement >= 0.1 && session.macros.movement <= 0.95);
  assert.ok(session.macros.space >= 0.2 && session.macros.space <= 0.98);
});

test('Session validation roundtrip preserves custom macros, effect chain, and workspace modules', () => {
  const rawSession = createSession('moss-pulse');
  rawSession.customMacros = [
    {
      id: 'saved-macro-1',
      name: 'Ethereal Cloud',
      color: '#06b6d4',
      value: 0.65,
      targets: [{ id: 't-1', param: 'macro:space', min: 0.3, max: 0.95 }],
    },
  ];
  rawSession.effectChain = {
    mode: 'delay-into-reverb',
    modules: [
      { id: 'delay', name: 'Stereo Delay', bypassed: false },
      { id: 'reverb', name: 'Cathedral Reverb', bypassed: false },
    ],
  };
  rawSession.workspaceModules = ['pianoroll', 'fxchain'];

  const validated = validateSession(rawSession);
  assert.equal(validated.customMacros?.length, 1);
  assert.equal(validated.customMacros?.[0].name, 'Ethereal Cloud');
  assert.equal(validated.effectChain?.mode, 'delay-into-reverb');
  assert.deepEqual(validated.workspaceModules, ['pianoroll', 'fxchain']);
});
