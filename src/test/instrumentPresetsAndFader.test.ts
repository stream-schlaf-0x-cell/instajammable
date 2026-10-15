import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JamEngine,
  INSTRUMENT_PRESETS,
  getInstrumentPresets,
  getInstrumentPresetById,
  detectActiveInstrumentPreset
} from '../engine/jam/JamEngine';
import { createSession } from '../engine/jam/scenes';
import type { DrumVoice, LayerRole } from '../types/jam';

test('Instrument Presets: comprehensive creative catalog exists for all 8 mixer channels', () => {
  const roles: LayerRole[] = ['drone', 'chords', 'bass', 'melody', 'drum'];
  const drumVoices: DrumVoice[] = ['kick', 'snare', 'hihat', 'perc'];

  assert.ok(INSTRUMENT_PRESETS.length >= 40, `Catalog should have a rich collection of presets (found ${INSTRUMENT_PRESETS.length})`);

  // Verify non-drum tonal roles have presets
  for (const role of roles.filter(r => r !== 'drum')) {
    const presets = getInstrumentPresets(role);
    assert.ok(presets.length >= 5, `Role ${role} should have at least 5 presets (found ${presets.length})`);
    for (const p of presets) {
      assert.ok(p.id.length > 0);
      assert.ok(p.name.length > 0);
      assert.ok(p.category.length > 0);
      assert.ok(p.description.length > 0);
      assert.equal(p.role, role);
    }
  }

  // Verify each drum voice has presets
  for (const voice of drumVoices) {
    const presets = getInstrumentPresets('drum', voice);
    assert.ok(presets.length >= 5, `Drum voice ${voice} should have at least 5 presets (found ${presets.length})`);
    for (const p of presets) {
      assert.ok(p.id.length > 0);
      assert.ok(p.name.length > 0);
      assert.equal(p.role, 'drum');
      assert.equal(p.drumVoice, voice);
      assert.ok(p.settings.drumPatch);
    }
  }

  // Verify getInstrumentPresetById lookup
  const foundWoody = getInstrumentPresetById('bass-woody-upright');
  assert.ok(foundWoody);
  assert.equal(foundWoody.name, 'Woody Upright');
  assert.equal(foundWoody.role, 'bass');
});

test('Fast Bass Morphing: user can switch annoying bass sounds immediately', () => {
  const engine = new JamEngine(createSession('dusty-keys'));
  const bassLayer = engine.getState().layers.find(l => l.role === 'bass');
  assert.ok(bassLayer, 'Bass layer must exist');

  // 1. Switch to Woody Upright (acoustic double bass)
  engine.applyInstrumentPreset(bassLayer.id, 'bass-woody-upright');
  const woodyBass = engine.getState().layers.find(l => l.id === bassLayer.id)!;
  assert.equal(woodyBass.settings.timbre, 'warm');
  assert.equal(woodyBass.settings.audioPatch?.osc1Wave, 'triangle');
  assert.equal(woodyBass.settings.audioPatch?.filterResonance, 1.25);
  assert.ok(woodyBass.settings.audioPatch?.driftAmount! >= 0.10, 'Woody bass should have organic wow & flutter');

  // 2. Switch to Deep Sub 808
  engine.applyInstrumentPreset(bassLayer.id, 'bass-deep-sub-808');
  const subBass = engine.getState().layers.find(l => l.id === bassLayer.id)!;
  assert.equal(subBass.settings.timbre, 'root');
  assert.equal(subBass.settings.audioPatch?.osc1Wave, 'sine');
  assert.ok(subBass.settings.audioPatch?.subLevel! >= 0.35, 'Sub 808 should have heavy subLevel');
  assert.ok(subBass.settings.audioPatch?.filterCutoff! <= 200, 'Sub 808 should be deeply lowpassed');

  // 3. Switch to Acid 303 Reso
  engine.applyInstrumentPreset(bassLayer.id, 'bass-acid-303');
  const acidBass = engine.getState().layers.find(l => l.id === bassLayer.id)!;
  assert.equal(acidBass.settings.timbre, 'dub');
  assert.ok(acidBass.settings.audioPatch?.filterResonance! >= 2.0, 'Acid 303 must have screaming resonance');

  // 4. Switch to Moog 24dB Ladder
  engine.applyInstrumentPreset(bassLayer.id, 'bass-moog-24db');
  const moogBass = engine.getState().layers.find(l => l.id === bassLayer.id)!;
  assert.equal(moogBass.settings.timbre, 'warm');
  assert.equal(moogBass.settings.audioPatch?.osc1Wave, 'sawtooth');
  assert.equal(moogBass.settings.audioPatch?.osc2Wave, 'sawtooth');
});

test('Cycle and Randomize: fast navigation through presets in channel strip', () => {
  const engine = new JamEngine(createSession('ultimae-drift'));
  const chordsLayer = engine.getState().layers.find(l => l.role === 'chords');
  assert.ok(chordsLayer);

  // Set initial preset
  engine.applyInstrumentPreset(chordsLayer.id, 'chords-cell-solina');
  const initial = detectActiveInstrumentPreset(engine.getState().layers.find(l => l.id === chordsLayer.id)!);
  assert.equal(initial?.id, 'chords-cell-solina');

  // Cycle forward (+1)
  const nextPreset = engine.cycleInstrumentPreset(chordsLayer.id, 1);
  assert.ok(nextPreset);
  assert.notEqual(nextPreset.id, 'chords-cell-solina');
  const activeAfterNext = detectActiveInstrumentPreset(engine.getState().layers.find(l => l.id === chordsLayer.id)!);
  assert.equal(activeAfterNext?.id, nextPreset.id);

  // Cycle backward (-1) returns to previous
  const prevPreset = engine.cycleInstrumentPreset(chordsLayer.id, -1);
  assert.ok(prevPreset);
  assert.equal(prevPreset.id, 'chords-cell-solina');

  // Randomize picks a valid preset
  const randomPreset = engine.randomizeInstrumentPreset(chordsLayer.id);
  assert.ok(randomPreset);
  const presets = getInstrumentPresets('chords');
  assert.ok(presets.some(p => p.id === randomPreset.id), 'Random preset must be in the chords catalog');
});

test('Drum Voices Presets: kick, snare, hihat, perc update sound parameters', () => {
  const engine = new JamEngine(createSession('blue-hour'));

  // Kick SP-404 Pillow
  engine.applyInstrumentPreset('kick', 'kick-sp404-pillow');
  const kick = engine.getState().layers.find(l => l.id === 'kick')!;
  assert.equal(kick.settings.drumPatch?.pitch, 48);
  assert.equal(kick.settings.drumPatch?.decay, 0.36);
  assert.equal(kick.settings.drumPatch?.drive, 0.22);

  // Snare SP-404 Body Thwack
  engine.applyInstrumentPreset('snare', 'snare-sp404-thwack');
  const snare = engine.getState().layers.find(l => l.id === 'snare')!;
  assert.equal(snare.settings.drumPatch?.pitch, 168);
  assert.equal(snare.settings.drumPatch?.decay, 0.20);
  assert.equal(snare.settings.drumPatch?.drive, 0.14);

  // HiHat Tape Sizzle
  engine.applyInstrumentPreset('hihat', 'hat-tape-sizzle');
  const hihat = engine.getState().layers.find(l => l.id === 'hihat')!;
  assert.equal(hihat.settings.drumPatch?.pitch, 38);
  assert.equal(hihat.settings.drumPatch?.decay, 0.04);

  // Perc Woodblock Pop
  engine.applyInstrumentPreset('perc', 'perc-woodblock-pop');
  const perc = engine.getState().layers.find(l => l.id === 'perc')!;
  assert.equal(perc.settings.drumPatch?.pitch, 58);
  assert.equal(perc.settings.drumPatch?.decay, 0.12);
});

test('Calibrated Fader Decibel Grid: monotonic scale with exact reference points', () => {
  const formatDb = (volume: number): string => {
    if (volume <= 0.001) return '-∞ dB';
    const db = 20 * Math.log10(volume);
    return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
  };

  assert.equal(formatDb(1.0), '+0.0 dB');
  assert.equal(formatDb(0.7079), '-3.0 dB');
  assert.equal(formatDb(0.50), '-6.0 dB');
  assert.equal(formatDb(0.25), '-12.0 dB');
  assert.equal(formatDb(0.10), '-20.0 dB');
  assert.equal(formatDb(0.0), '-∞ dB');

  // Verify engine volume setting with fader snaps
  const engine = new JamEngine(createSession('moss-pulse'));
  const kick = engine.getState().layers.find(l => l.id === 'kick')!;

  engine.updateLayer(kick.id, { volume: 1.0 }); // 0 dB
  assert.equal(engine.getState().layers.find(l => l.id === kick.id)!.volume, 1.0);

  engine.updateLayer(kick.id, { volume: 0.5 }); // -6 dB
  assert.equal(engine.getState().layers.find(l => l.id === kick.id)!.volume, 0.5);

  engine.updateLayer(kick.id, { volume: 0.0 }); // -inf
  assert.equal(engine.getState().layers.find(l => l.id === kick.id)!.volume, 0.0);
});
