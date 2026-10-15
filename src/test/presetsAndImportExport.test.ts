import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JamEngine, SCENES } from '../engine/jam/JamEngine';
import { sanitizeAtmosphere } from '../engine/jam/sound';
import { clipToMidi } from '../engine/jam/clipMidi';

test('Standardized presets: 24 presets with diverse genres and strictly capped atmosphere', () => {
  assert.equal(SCENES.length, 24, 'Expected 24 standardized factory scenes');

  const engine = new JamEngine();

  for (const scene of SCENES) {
    const session = engine.previewScene(scene.id, 4);
    assert.ok(session.notes.length > 0, `Scene ${scene.id} must generate notes`);

    // Check atmosphere level safety in scene presets (all capped to <= 0.10)
    const loaded = engine.saveSession();
    if (loaded.atmosphere && loaded.atmosphere.kind !== 'off') {
      const maxCap = 0.10;
      assert.ok(
        loaded.atmosphere.level <= maxCap + 0.0001,
        `Scene ${scene.id} atmosphere (${loaded.atmosphere.kind}) level ${loaded.atmosphere.level} must be <= ${maxCap}`
      );
    }
  }
});

test('Atmosphere level is strictly capped to maximum 10% (0.10) across all textures', () => {
  // Test direct sanitizeAtmosphere
  const highVinyl = sanitizeAtmosphere({ kind: 'vinyl', level: 0.18, tone: 0.5, movement: 0.4 });
  assert.equal(highVinyl.level, 0.10, 'Vinyl level must be clamped to 0.10');

  const safeVinyl = sanitizeAtmosphere({ kind: 'vinyl', level: 0.06, tone: 0.5, movement: 0.4 });
  assert.equal(safeVinyl.level, 0.06, 'Vinyl level below 0.10 must be preserved');

  const highTape = sanitizeAtmosphere({ kind: 'tape', level: 0.18, tone: 0.5, movement: 0.4 });
  assert.equal(highTape.level, 0.10, 'Tape noise level must be clamped to 0.10');

  // Test air/rain capped to 0.10
  const air = sanitizeAtmosphere({ kind: 'air', level: 0.25, tone: 0.5, movement: 0.4 });
  assert.equal(air.level, 0.10, 'Air level must be capped to 0.10');

  const rain = sanitizeAtmosphere({ kind: 'rain', level: 0.30, tone: 0.5, movement: 0.4 });
  assert.equal(rain.level, 0.10, 'Rain level must be capped to 0.10');
});

test('Radical Random: scrambles root, scale, timbres and effects safely with loudness compensation', () => {
  const engine = new JamEngine();
  const stateBefore = engine.getState();
  const loudnessBefore = engine.calculatePerceivedLoudness();

  // Run radical randomize
  engine.radicalRandomize();
  const stateAfter = engine.getState();
  const loudnessAfter = engine.calculatePerceivedLoudness();

  // Atmosphere must still be strictly capped (all <= 0.10)
  if (stateAfter.atmosphere && stateAfter.atmosphere.kind !== 'off') {
    const maxCap = 0.10;
    assert.ok(
      stateAfter.atmosphere.level <= maxCap + 0.0001,
      `Atmosphere level must remain <= ${maxCap}`
    );
  }

  // Perceived loudness ratio should not explode
  const loudnessRatio = loudnessAfter / loudnessBefore;
  assert.ok(
    loudnessRatio >= 0.5 && loudnessRatio <= 1.8,
    `Perceived loudness ratio (${loudnessRatio.toFixed(2)}) should remain stable`
  );

  // Undo restores cleanly
  engine.undo();
  const restored = engine.getState();
  assert.equal(restored.root, stateBefore.root);
  assert.equal(restored.scale, stateBefore.scale);
  assert.equal(restored.bpm, stateBefore.bpm);
});

test('Export to Ableton: produces valid Multitrack MIDI (SMF Type 1) with all instrument tracks', () => {
  const engine = new JamEngine();
  const clip = engine.exportAbletonClip(8);

  assert.equal(clip.version, 1);
  assert.equal(clip.lengthBeats, 32);
  assert.ok(clip.notes.length > 10, 'Ableton clip should have musical notes');

  // Binary SMF compilation
  const midiBytes = clipToMidi(clip);
  assert.ok(midiBytes instanceof Uint8Array);
  assert.ok(midiBytes.length > 100, 'MIDI file must contain SMF byte stream');

  // Standard MIDI magic header: 'MThd' (0x4D, 0x54, 0x68, 0x64)
  assert.equal(midiBytes[0], 0x4D);
  assert.equal(midiBytes[1], 0x54);
  assert.equal(midiBytes[2], 0x68);
  assert.equal(midiBytes[3], 0x64);
});

test('Import whole settings: loadSession updates state, clock BPM and swing immediately', () => {
  const engine = new JamEngine();
  const snapshot = engine.saveSession();

  // Mutate snapshot
  snapshot.name = 'Imported Custom Session';
  snapshot.bpm = 118;
  snapshot.swing = 0.22;
  snapshot.root = 46;
  snapshot.scale = 'aeolian';
  snapshot.atmosphere = { kind: 'vinyl', level: 0.15, tone: 0.6, movement: 0.3 };

  engine.loadSession(snapshot);
  const loaded = engine.getState();

  assert.equal(loaded.name, 'Imported Custom Session');
  assert.equal(loaded.bpm, 118);
  assert.equal(loaded.swing, 0.22);
  assert.equal(loaded.root, 46);
  assert.equal(loaded.scale, 'aeolian');
  // Vinyl must be capped to 0.10
  assert.equal(loaded.atmosphere?.level, 0.10);
});
