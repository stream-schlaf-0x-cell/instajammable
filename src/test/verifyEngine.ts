// Autonomous Test Suite for ECHO GARDEN Generative Music Laboratory

import { PRNG } from '../engine/prng';
import { EuclideanGenerator } from '../engine/generators/rhythm/euclidean';
import { ProbabilisticGenerator } from '../engine/generators/rhythm/probabilistic';
import { PolymetricGenerator } from '../engine/generators/rhythm/polymetric';
import { MarkovGenerator } from '../engine/generators/rhythm/markov';
import { DensityBurstGenerator } from '../engine/generators/rhythm/densityBurst';
import { HarmonicDroneGenerator, SCALE_INTERVALS } from '../engine/generators/ambient/harmonicDrone';
import { GranularDriftGenerator } from '../engine/generators/ambient/granularDrift';
import { BoundarySystem } from '../engine/mutation/boundarySystem';
import { HistoryManager } from '../engine/mutation/history';
import { MidiFileWriter, MidiTrackData } from '../engine/midi/midiWriter';
import { ModulationMatrix } from '../engine/modulation/modMatrix';
import { PRESET_WARM_ANALOG_DRONE } from '../engine/presets/defaultPresets';
import { StepContext } from '../types';

function runTestSuite() {
  console.log('====================================================');
  console.log('   ECHO GARDEN ENGINE VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // 1. PRNG Determinism
  const prng1 = new PRNG(12345);
  const prng2 = new PRNG(12345);
  const seq1 = [prng1.next(), prng1.next(), prng1.rangeInt(1, 10)];
  const seq2 = [prng2.next(), prng2.next(), prng2.rangeInt(1, 10)];
  assert(
    seq1[0] === seq2[0] && seq1[1] === seq2[1] && seq1[2] === seq2[2],
    'Mulberry32 PRNG is strictly deterministic with identical seeds'
  );

  // 2. Bjorklund Euclidean Algorithm
  const e16_5 = EuclideanGenerator.bjorklund(16, 5);
  const hits16_5 = e16_5.filter(Boolean).length;
  assert(hits16_5 === 5 && e16_5.length === 16, 'Euclidean algorithm generates exact pulse count (5/16)');

  const e8_3 = EuclideanGenerator.bjorklund(8, 3);
  const hits8_3 = e8_3.filter(Boolean).length;
  assert(hits8_3 === 3 && e8_3.length === 8, 'Euclidean algorithm generates exact pulse count (3/8 Tresillo)');

  // 3. Probabilistic Sequencer
  const probGen = new ProbabilisticGenerator('test_prob', { density: 1.0, velocity: 100 }, 42);
  const dummyCtx: StepContext = { step: 0, subStep: 0, beat: 0, bar: 0, time: 0, bpm: 120 };
  const probEvents = probGen.generateStep(dummyCtx);
  assert(probEvents.length > 0 && probEvents[0].velocity > 0, 'Probabilistic generator generates valid step events');

  // 4. Polymetric Phasing Generator
  const polyGen = new PolymetricGenerator('test_poly', { loopLength: 7, activeHits: [0, 3] }, 42);
  const polyStep0 = polyGen.generateStep({ ...dummyCtx, step: 0 });
  const polyStep1 = polyGen.generateStep({ ...dummyCtx, step: 1 });
  const polyStep7 = polyGen.generateStep({ ...dummyCtx, step: 7 }); // loop repeat
  assert(polyStep0.length === 1, 'Polymetric step 0 triggers hit');
  assert(polyStep1.length === 0, 'Polymetric step 1 is a rest');
  assert(polyStep7.length === 1, 'Polymetric step 7 aligns with cycle loop start');

  // 5. Markov Transition Engine
  const markovGen = new MarkovGenerator('test_markov', {}, 42);
  let markovEventsTotal = 0;
  for (let s = 0; s < 32; s++) {
    const evs = markovGen.generateStep({ ...dummyCtx, step: s });
    markovEventsTotal += evs.length;
  }
  assert(markovEventsTotal > 0 && markovEventsTotal < 32, 'Markov generator transitions between hits and rests');

  // 6. Density & Burst Generator
  const burstGen = new DensityBurstGenerator('test_burst', { baseDensity: 0.8, burstChance: 0.5 }, 42);
  let burstHits = 0;
  for (let s = 0; s < 16; s++) {
    const evs = burstGen.generateStep({ ...dummyCtx, step: s });
    burstHits += evs.length;
  }
  assert(burstHits > 0, 'Density & burst engine generates rhythmic clusters');

  // 7. Harmonic Drone & Voice Leading
  const droneGen = new HarmonicDroneGenerator('test_drone', { rootNote: 36, scale: 'dorian', holdBars: 2 }, 42);
  const bar0Events = droneGen.generateStep({ ...dummyCtx, step: 0 });
  assert(bar0Events.length >= 3, 'Harmonic drone triggers full polyphonic chord voicing on bar start');
  const midiNotes = bar0Events.map((e) => e.midiNote);
  // Verify notes fall within Dorian scale pitch classes
  const dorianIntervals = SCALE_INTERVALS.dorian;
  const allInScale = midiNotes.every((note) => {
    const pc = (note - 36) % 12;
    return dorianIntervals.includes(pc < 0 ? pc + 12 : pc);
  });
  assert(allInScale, 'Harmonic drone chord notes strictly quantize to Dorian modal degrees');

  // 8. Granular Drift
  const grainGen = new GranularDriftGenerator('test_grain', { density: 1.0, centerPitch: 60 }, 42);
  const grainEvents = grainGen.generateStep(dummyCtx);
  assert(grainEvents.length === 1 && grainEvents[0].duration > 0.5, 'Granular drift spawns ambient sound grain');

  // 9. Bounded Mutation System
  const boundarySys = new BoundarySystem(999);
  const stateClone = JSON.parse(JSON.stringify(PRESET_WARM_ANALOG_DRONE));
  // Lock kick pulses
  stateClone.layers[0].boundaries.pulses.locked = true;
  const origPulses = stateClone.layers[0].settings.pulses;
  const mutatedState = boundarySys.mutateProject(stateClone, 0.8);

  assert(
    mutatedState.layers[0].settings.pulses === origPulses,
    'Locked parameter is strictly protected against mutation'
  );

  // Check filterCutoff stayed strictly within defined bounds [60, 8000]
  assert(
    mutatedState.ambientParams.filterCutoff >= 60 && mutatedState.ambientParams.filterCutoff <= 8000,
    'Filter Cutoff mutation respects min/max boundary constraints'
  );

  // 10. History Manager & Undo
  const histManager = new HistoryManager(stateClone);
  histManager.pushState('Mutate 1', mutatedState);
  assert(histManager.canUndo(), 'History manager tracks undoable state changes');
  const restored = histManager.undo();
  assert(
    restored !== null && restored.ambientParams.filterCutoff === stateClone.ambientParams.filterCutoff,
    'Undo restores exact prior parameter state'
  );

  // 11. Inter-Engine Modulation Matrix
  const modMatrix = new ModulationMatrix();
  const offsets = modMatrix.process({
    drumDensity: 0.8,
    rhythmicAccent: 1.0,
    ambientBrightness: 0.5,
    globalChaos: 0.5,
  });
  assert(offsets.ambientCutoffOffset > 0, 'Drum density dynamically opens ambient filter cutoff');
  assert(offsets.reverbMixOffset > 0, 'Rhythmic accent dynamically modulates reverb send');

  // 12. Standard MIDI File (.mid) Binary Writer
  const writer = new MidiFileWriter(480);
  const testTracks: MidiTrackData[] = [
    {
      name: 'Kick Track',
      channel: 9, // MIDI Ch 10 (0-indexed 9)
      notes: [
        { startTicks: 0, durationTicks: 120, note: 36, velocity: 100, channel: 9 },
        { startTicks: 480, durationTicks: 120, note: 36, velocity: 110, channel: 9 },
      ],
    },
    {
      name: 'Ambient Chord',
      channel: 0, // MIDI Ch 1
      notes: [
        { startTicks: 0, durationTicks: 1920, note: 48, velocity: 85, channel: 0 },
        { startTicks: 0, durationTicks: 1920, note: 52, velocity: 80, channel: 0 },
        { startTicks: 0, durationTicks: 1920, note: 55, velocity: 80, channel: 0 },
      ],
    },
  ];

  const midiBytes = writer.createMidiFile(120, testTracks);
  assert(midiBytes.length > 50, 'Standard MIDI file generated with valid byte length');

  // Verify Header Chunk 'MThd'
  const isMThd =
    midiBytes[0] === 0x4d &&
    midiBytes[1] === 0x54 &&
    midiBytes[2] === 0x68 &&
    midiBytes[3] === 0x64;
  assert(isMThd, 'MIDI file begins with valid "MThd" header chunk magic bytes');

  // Verify Format 1 (multitrack) bytes at offset 8 and 9: 0x00, 0x01
  const isFormat1 = midiBytes[8] === 0x00 && midiBytes[9] === 0x01;
  assert(isFormat1, 'MIDI file correctly specifies SMF Format 1 (multitrack)');

  // Verify 3 tracks total (1 conductor tempo track + 2 instrument tracks)
  const trackCount = (midiBytes[10] << 8) | midiBytes[11];
  assert(trackCount === 3, 'MIDI file header specifies 3 tracks (conductor + 2 instrument tracks)');

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
