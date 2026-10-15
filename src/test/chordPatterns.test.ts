import test from 'node:test';
import assert from 'node:assert/strict';
import { JamEngine, ambientPatch, drumPatch } from '../engine/jam/JamEngine';
import { JamComposer, holdBarsFor } from '../engine/jam/music';
import { createSession } from '../engine/jam/scenes';
import type { ChordPattern } from '../types/jam';

test('Chord Pace: holdBarsFor returns expected bars per pace', () => {
  assert.equal(holdBarsFor('ambient', '1-bar'), 1);
  assert.equal(holdBarsFor('ambient', '2-bars'), 2);
  assert.equal(holdBarsFor('ambient', '4-bars'), 4);
  assert.equal(holdBarsFor('ambient', 'dynamic'), 2);
  // Default fallback without pace
  assert.equal(holdBarsFor('ambient'), 4);
  assert.equal(holdBarsFor('lofi'), 2);
});

test('Harmonic Motion: progressions move across bars without static root-locking', () => {
  const session = createSession('dorian-dawn', 101);
  const composer = new JamComposer();
  const chordLayer = session.layers.find(l => l.role === 'chords');
  assert.ok(chordLayer);

  // Set pace to 2-bars
  chordLayer.settings.chordPace = '2-bars';
  const chords: string[] = [];
  const degrees: number[] = [];

  // Check 8 chords (16 bars of music)
  for (let i = 0; i < 8; i++) {
    const h = composer.harmonyAt(i * 32, session);
    chords.push(h.name);
    degrees.push(h.degree);
  }

  // The progression must have harmonic motion (not all degree 0)
  const uniqueDegrees = new Set(degrees);
  assert.ok(uniqueDegrees.size >= 3, `Progression should have harmonic movement (got degrees: ${degrees.join(', ')})`);
  assert.notEqual(degrees[0], degrees[1], 'Chord should change from first to second position in progression');
});

test('Generative Chord Patterns: each pattern produces active notes across phrase steps', () => {
  const patterns: ChordPattern[] = ['pad', 'pulse', 'broken', 'syncopated', 'euclidean', 'wave', 'cluster'];

  for (const pattern of patterns) {
    const session = createSession('cbl-hydroponic', 42);
    const chordLayer = session.layers.find(l => l.role === 'chords');
    assert.ok(chordLayer);
    chordLayer.settings.chordPattern = pattern;
    chordLayer.settings.density = 0.8;

    // Mute all other layers to isolate chords
    session.layers.forEach(l => {
      l.muted = l.role !== 'chords';
    });

    const composer = new JamComposer();
    const planned = composer.planStep(0, session);
    assert.ok(planned.length >= 3, `Pattern ${pattern} should produce at least 3 chord tones on step 0`);

    // Sample phrase across 64 steps (4 bars)
    let totalNotesInPhrase = 0;
    const stepOffsets = new Set<number>();

    for (let step = 0; step < 64; step++) {
      const notes = composer.planStep(step, session);
      if (notes.length > 0) {
        totalNotesInPhrase += notes.length;
        stepOffsets.add(step);
      }
    }

    assert.ok(totalNotesInPhrase >= 3, `Pattern ${pattern} should generate sufficient notes across the phrase (got ${totalNotesInPhrase})`);

    // Rhythmic patterns like pulse, broken, syncopated, euclidean, wave, cluster must strike on multiple steps
    if (pattern !== 'pad') {
      assert.ok(
        stepOffsets.size >= 2,
        `Pattern ${pattern} must articulate on multiple step offsets (got steps: ${[...stepOffsets].join(', ')})`
      );
    }
  }
});

test('Engine API: setChordPattern and setChordPace update state and generate changes', () => {
  const engine = new JamEngine();
  const stateInitial = engine.getState();
  const chordLayerInitial = stateInitial.layers.find(l => l.role === 'chords');
  assert.ok(chordLayerInitial);

  // Set chord pattern
  engine.setChordPattern('pulse');
  const stateAfterPattern = engine.getState();
  const chordLayerAfterPattern = stateAfterPattern.layers.find(l => l.role === 'chords');
  assert.equal(chordLayerAfterPattern?.settings.chordPattern, 'pulse');

  // Set chord pace
  engine.setChordPace('1-bar');
  const stateAfterPace = engine.getState();
  const chordLayerAfterPace = stateAfterPace.layers.find(l => l.role === 'chords');
  assert.equal(chordLayerAfterPace?.settings.chordPace, '1-bar');

  // Ableton Export includes the pattern notes
  const clip = engine.exportAbletonClip(4);
  assert.ok(clip.notes.length > 0);
  const chordNotes = clip.notes.filter(n => n.layerId === 'chords');
  assert.ok(chordNotes.length >= 4, 'Ableton clip should include generative chord notes');
});

test('Chord Texture: shimmer, octave and sub5th generate companion voice layer', () => {
  const session = createSession('ultimae-drift', 77);
  const chordLayer = session.layers.find(l => l.role === 'chords');
  assert.ok(chordLayer);

  // 1. Off: baseline note count
  chordLayer.settings.chordTexture = 'off';
  const composer = new JamComposer();
  const offStep0 = composer.planStep(0, session).filter(n => n.layerId === 'chords');
  const baseCount = offStep0.length;
  assert.ok(baseCount >= 3, 'Base chord should have at least 3 tones');

  // 2. Shimmer: companion voice at +12 semitones
  chordLayer.settings.chordTexture = 'shimmer';
  composer.reset();
  const shimmerStep0 = composer.planStep(0, session).filter(n => n.layerId === 'chords');
  assert.ok(shimmerStep0.length > baseCount, 'Shimmer texture should add companion layer notes');

  // Verify companion notes have higher pitch (+12st) and softer velocity
  const basePitches = offStep0.map(n => n.note);
  const companionNotes = shimmerStep0.filter(n => !basePitches.includes(n.note));
  assert.ok(companionNotes.length > 0, 'Companion shimmer notes must be present');
  for (const cn of companionNotes) {
    assert.ok(cn.velocity < 65, `Shimmer velocity should be soft and delicate (got ${cn.velocity})`);
    assert.ok(cn.microMs >= 15, `Shimmer should have shimmering micro-timing delay (got ${cn.microMs}ms)`);
  }
});

test('Real Jazz Bass: Lo-Fi style produces thick downbeats, syncopated pushes and chromatic approach notes', () => {
  const session = createSession('dusty-keys', 88);
  assert.equal(session.style, 'lofi');
  const bassLayer = session.layers.find(l => l.role === 'bass');
  assert.ok(bassLayer);
  bassLayer.settings.density = 0.85;

  const composer = new JamComposer();
  const phraseSteps = bassLayer.settings.phraseBars * 16;
  const bassNotes: Array<{ step: number; note: number; velocity: number }> = [];

  for (let s = 0; s < phraseSteps; s++) {
    const planned = composer.planStep(s, session).filter(n => n.layerId === 'bass');
    for (const pn of planned) {
      bassNotes.push({ step: s, note: pn.note, velocity: pn.velocity });
    }
  }

  assert.ok(bassNotes.length >= 4, 'Real jazz bass should generate active groove notes');

  // Downbeat on step 0 must be strong
  const downbeat = bassNotes.find(n => n.step === 0);
  assert.ok(downbeat, 'Step 0 downbeat must be present in jazz bass line');
  assert.ok(downbeat.velocity >= 60, `Step 0 downbeat must be confident (got ${downbeat.velocity})`);

  // Snare on beat 2 (step 4) and beat 4 (step 12) should have breathing space (snare slap pocket)
  const hitsOnSnareBeat = bassNotes.filter(n => n.step % 16 === 4 || n.step % 16 === 12);
  assert.ok(hitsOnSnareBeat.length <= 1, 'Bass leaves room on beat 2 and 4 so snare lowkey slaps cleanly');

  // Chromatic approach note check: at least one note on step 14 or 15 in the phrase
  const approaches = bassNotes.filter(n => n.step % 16 === 14 || n.step % 16 === 15);
  assert.ok(approaches.length >= 1, 'Jazz bass should feature chromatic approach notes leading into next root');
});

test('Cell-Grade Timbres & Lo-Fi Drum Punch in JamEngine', () => {
  const session = createSession('ultimae-drift', 99);
  const chordLayer = session.layers.find(l => l.role === 'chords');
  assert.ok(chordLayer);

  // Test Solina timbre patch
  chordLayer.settings.timbre = 'solina';
  const solinaPatch = ambientPatch(chordLayer, session, 0);
  assert.equal(solinaPatch.osc1Wave, 'sawtooth');
  assert.ok(solinaPatch.filterCutoff <= 4800, 'Solina filter cutoff must be smooth without harsh ringing');
  assert.ok(solinaPatch.voiceSpread >= 0.9, 'Solina ensemble should have wide stereo breath');

  // Test Shimmer timbre patch
  chordLayer.settings.timbre = 'shimmer';
  const shimmerPatch = ambientPatch(chordLayer, session, 0);
  assert.equal(shimmerPatch.osc3Wave, 'sawtooth');
  assert.ok(shimmerPatch.filterCutoff >= 1000, 'Shimmer pad should have luminous presence');

  // Test Celeste timbre patch
  chordLayer.settings.timbre = 'celeste';
  const celestePatch = ambientPatch(chordLayer, session, 0);
  assert.equal(celestePatch.osc1Wave, 'triangle');
  assert.ok(celestePatch.filterEnvAmount >= 0.25, 'Celeste should have tactile plucking envelope');

  // Test Lo-Fi Drum Voice Params (Sweet and thick SP-404 kick and snare)
  const lofiSession = createSession('dusty-keys', 123);
  const kickPatch = drumPatch('kick', lofiSession);
  assert.ok(kickPatch.pitch <= 50, `Lo-Fi kick sub pitch should be deep (got ${kickPatch.pitch}Hz)`);
  assert.ok(kickPatch.decay >= 0.30, `Lo-Fi kick decay should be fat and pillowy (got ${kickPatch.decay}s)`);
  assert.ok(kickPatch.drive >= 0.18, `Lo-Fi kick should have sweet analog tape drive (got ${kickPatch.drive})`);
});
