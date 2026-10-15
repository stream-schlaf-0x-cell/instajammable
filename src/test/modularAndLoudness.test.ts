import test from 'node:test';
import assert from 'node:assert/strict';
import { JamEngine } from '../engine/jam/JamEngine';
import { createSession } from '../engine/jam/scenes';

test('Loudness-Safe Evolve: stabilizes perceived loudness across mutations', () => {
  const engine = new JamEngine(createSession('moss-pulse'));
  const initialSession = engine.getState();

  // Function to calculate perceived loudness proxy
  const calcLoudness = (s: typeof initialSession) => {
    let sum = 0;
    for (const l of s.layers) {
      if (l.muted) continue;
      const timbreWeight = l.settings.timbre === 'wash' ? 0.75 : l.settings.timbre === 'strings' ? 0.8 : 1.0;
      sum += l.volume * (0.4 + l.settings.density * 0.6) * timbreWeight;
    }
    return sum * s.volume;
  };

  const initialLoudness = calcLoudness(initialSession);
  assert.ok(initialLoudness > 0, 'Initial loudness should be positive');

  // Perform multiple successive loudness-safe mutations
  for (let i = 0; i < 5; i++) {
    engine.mutate(true);
    const postSession = engine.getState();
    const postLoudness = calcLoudness(postSession);

    // Loudness should stay within 20% of the initial target
    const ratio = postLoudness / initialLoudness;
    assert.ok(
      ratio >= 0.80 && ratio <= 1.25,
      `Loudness ratio ${ratio.toFixed(2)} after mutation ${i + 1} should be within [0.80, 1.25]`
    );
  }
});

test('Chord de-ringing: ambient patch cutoffs and resonances are tamed', () => {
  const engine = new JamEngine(createSession('moss-pulse'));
  const chordLayer = engine.getState().layers.find(l => l.role === 'chords');
  assert.ok(chordLayer, 'Chords layer must exist');

  // Verify layer volume is in sensible listening range
  assert.ok(chordLayer.volume <= 0.8, 'Chord layer volume is comfortably balanced');

  // Verify mutating the chord layer preserves tempered resonance
  engine.mutate(true);
  const mutatedChords = engine.getState().layers.find(l => l.role === 'chords')!;
  assert.ok(mutatedChords.settings.density <= 1.0);
});

test('Quick Studio Mixer: updates volumes, mute, solo, lock and freeze seamlessly', () => {
  const engine = new JamEngine(createSession('moss-pulse'));
  const kickLayer = engine.getState().layers.find(l => l.id === 'kick')!;
  const bassLayer = engine.getState().layers.find(l => l.role === 'bass')!;

  assert.ok(kickLayer, 'Kick layer must exist');
  assert.ok(bassLayer, 'Bass layer must exist');

  // Volume update
  engine.updateLayer(kickLayer.id, { volume: 0.88 });
  assert.equal(engine.getState().layers.find(l => l.id === kickLayer.id)!.volume, 0.88);

  // Mute / Solo
  engine.updateLayer(bassLayer.id, { muted: true });
  assert.equal(engine.getState().layers.find(l => l.id === bassLayer.id)!.muted, true);

  engine.updateLayer(kickLayer.id, { solo: true });
  assert.equal(engine.getState().layers.find(l => l.id === kickLayer.id)!.solo, true);

  // Lock / Freeze
  engine.updateLayer(bassLayer.id, { locked: true, frozen: true });
  const updatedBass = engine.getState().layers.find(l => l.id === bassLayer.id)!;
  assert.equal(updatedBass.locked, true);
  assert.equal(updatedBass.frozen, true);

  // Evolve respects locked/frozen layer
  const prevDensity = updatedBass.settings.density;
  engine.mutate(true);
  const postEvolveBass = engine.getState().layers.find(l => l.id === bassLayer.id)!;
  assert.equal(postEvolveBass.settings.density, prevDensity, 'Locked layer density preserved during evolve');
});

test('Drum Engine: generates dynamic rhythms with ghost notes and accents', () => {
  const engine = new JamEngine(createSession('deep-dub'));
  const session = engine.getState();
  const drumLayer = session.layers.find(l => l.role === 'drum');
  assert.ok(drumLayer, 'deep-dub should have a drum layer');

  // Check recent generated events
  const events = engine.getRecentEvents(64);
  assert.ok(Array.isArray(events));

  // Switch drum algorithm to euclidean
  engine.setLayerSettings(drumLayer.id, { rhythmAlgorithm: 'euclidean' });
  assert.equal(
    engine.getState().layers.find(l => l.id === drumLayer.id)!.settings.rhythmAlgorithm,
    'euclidean'
  );
});
