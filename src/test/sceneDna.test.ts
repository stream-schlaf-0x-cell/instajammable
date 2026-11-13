import test from 'node:test';
import assert from 'node:assert/strict';
import { holdBarsFor, JamComposer } from '../engine/jam/music';
import { createSession, SCENES } from '../engine/jam/scenes';

test('Phase 6: all 24 scenes have unique Sound-Bibel DNA tuples', () => {
  const tuples = new Map<string, string>();
  for (const scene of SCENES) {
    const s = createSession(scene.id, 142857);
    const chords = s.layers.find(l => l.role === 'chords')!.settings;
    const drone = s.layers.find(l => l.role === 'drone')!.settings;
    const bass = s.layers.find(l => l.role === 'bass')!.settings;
    const melody = s.layers.find(l => l.role === 'melody')!.settings;
    const perc = s.layers.find(l => l.id === 'perc')!.settings;
    const tuple = [
      chords.timbre,
      chords.secondaryTimbre ?? 'none',
      chords.chordPattern ?? 'def',
      chords.secondaryPattern ?? 'def',
      drone.droneStyle ?? 'rootFifth',
      bass.bassStyle ?? 'pedal',
      melody.melodyStyle ?? 'motif',
      perc.drumModel ?? 'woodblock',
    ].join('|');
    assert.ok(!tuples.has(tuple), `Duplicate DNA tuple between ${tuples.get(tuple)} and ${scene.id}: ${tuple}`);
    tuples.set(tuple, scene.id);
  }
});

test('Phase 3 & 6: woodblock used in <= 2 scenes, no perc model > 4 scenes, unique drum model combos', () => {
  const percCounts = new Map<string, number>();
  const activeDrumCombos = new Map<string, string>();
  for (const scene of SCENES) {
    const s = createSession(scene.id, 142857);
    const perc = s.layers.find(l => l.id === 'perc')!;
    const hat = s.layers.find(l => l.id === 'hihat')!;
    const snare = s.layers.find(l => l.id === 'snare')!;
    const percModel = perc.settings.drumModel ?? 'woodblock';
    percCounts.set(percModel, (percCounts.get(percModel) ?? 0) + 1);
    if (!perc.muted || !hat.muted || !snare.muted) {
      const combo = `${perc.muted ? 'muted' : percModel}|${hat.muted ? 'muted' : hat.settings.drumModel ?? 'closedHat'}|${snare.muted ? 'muted' : snare.settings.drumModel ?? 'rim'}`;
      assert.ok(!activeDrumCombos.has(combo), `Duplicate drum model combo between ${activeDrumCombos.get(combo)} and ${scene.id}: ${combo}`);
      activeDrumCombos.set(combo, scene.id);
    }
  }
  assert.ok((percCounts.get('woodblock') ?? 0) <= 2, `woodblock used ${percCounts.get('woodblock')} times`);
  for (const [model, count] of percCounts) {
    assert.ok(count <= 4, `perc model ${model} used in ${count} scenes (> 4)`);
  }
});

test('Phase 6: every scene produces >= 3 distinct chord names in 32 bars (night-rumble/night-orbit >= 2) and unique ambient 4-hold sequences', () => {
  const ambientSeqs = new Map<string, string>();
  for (const scene of SCENES) {
    const s = createSession(scene.id, 142857);
    assert.equal(s.atmosphere?.level ?? 0, 0, `${scene.id} atmosphere.level must default to 0`);
    const composer = new JamComposer();
    const names32 = new Set<string>();
    const first4: string[] = [];
    const holdBars = holdBarsFor(s.style, s.layers.find(l => l.role === 'chords')?.settings.chordPace);
    for (let bar = 0; bar < 32; bar += holdBars) {
      const h = composer.harmonyAt(bar * 16, s);
      names32.add(h.name);
      if (first4.length < 4) first4.push(h.name);
    }
    const minDistinct = scene.id === 'night-rumble' || scene.id === 'night-orbit' ? 2 : 3;
    assert.ok(names32.size >= minDistinct, `${scene.id} only produced ${names32.size} distinct chords: ${[...names32].join(', ')}`);
    if (scene.style === 'ambient') {
      const seqKey = first4.join(' -> ');
      assert.ok(!ambientSeqs.has(seqKey), `Ambient scenes ${ambientSeqs.get(seqKey)} and ${scene.id} share first 4 hold chords: ${seqKey}`);
      ambientSeqs.set(seqKey, scene.id);
    }
  }
});
