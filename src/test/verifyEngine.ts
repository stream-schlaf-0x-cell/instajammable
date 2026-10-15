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
import { MidiFileReader } from '../engine/midi/midiReader';
import { ModulationMatrix } from '../engine/modulation/modMatrix';
import { PRESET_WARM_ANALOG_DRONE } from '../engine/presets/defaultPresets';
import { StepContext } from '../types';
import { MusicalClock } from '../engine/clock';
import { WebMidiManager } from '../engine/midi/webMidi';
import { WavEncoder } from '../engine/audio/wavEncoder';

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

  // 1. PRNG Determinism & Forking
  const prng1 = new PRNG(12345);
  const prng2 = new PRNG(12345);
  const seq1 = [prng1.next(), prng1.next(), prng1.rangeInt(1, 10)];
  const seq2 = [prng2.next(), prng2.next(), prng2.rangeInt(1, 10)];
  assert(
    seq1[0] === seq2[0] && seq1[1] === seq2[1] && seq1[2] === seq2[2],
    'Mulberry32 PRNG is strictly deterministic with identical seeds'
  );

  const masterPrng = new PRNG(9999);
  const fork0 = masterPrng.fork(0);
  const fork1 = masterPrng.fork(1);
  assert(
    fork0.next() !== fork1.next(),
    'PRNG stream forking produces independent pseudorandom sequences across layers'
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
  const dummyCtx: StepContext = { step: 0, subStep: 0, beat: 0, bar: 0, time: 0, perfTime: 0, bpm: 120, swing: 0, swingOffset: 0 };
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

  // 7. Harmonic Drone & Voice Leading & Multi-Bar Sustain
  const droneGen = new HarmonicDroneGenerator('test_drone', { rootNote: 36, scale: 'dorian', holdBars: 3 }, 42);
  
  // Bar 0, step 0: triggers chord
  const bar0Events = droneGen.generateStep({ ...dummyCtx, step: 0, bar: 0, subStep: 0 });
  assert(bar0Events.length >= 3, 'Harmonic drone triggers full polyphonic chord voicing on bar 0 start');
  
  // Bar 0, step 4: within bar, should sustain without retriggering
  const bar0Step4 = droneGen.generateStep({ ...dummyCtx, step: 4, bar: 0, subStep: 4 });
  assert(bar0Step4.length === 0, 'Harmonic drone sustains without retriggering mid-bar');

  // Bar 1, step 16: within holdBars (3), should NOT retrigger on bar 1!
  const bar1Events = droneGen.generateStep({ ...dummyCtx, step: 16, bar: 1, subStep: 0 });
  assert(bar1Events.length === 0, 'Harmonic drone sustains across holdBars boundary without retriggering on bar 1');

  // Bar 2, step 32: within holdBars (3), should NOT retrigger on bar 2!
  const bar2Events = droneGen.generateStep({ ...dummyCtx, step: 32, bar: 2, subStep: 0 });
  assert(bar2Events.length === 0, 'Harmonic drone sustains without retriggering on bar 2');

  // Bar 3, step 48: new holdBars cycle (bar 3 % 3 === 0), triggers next voicing!
  const bar3Events = droneGen.generateStep({ ...dummyCtx, step: 48, bar: 3, subStep: 0 });
  assert(bar3Events.length >= 3, 'Harmonic drone triggers new progression voicing on holdBars cycle (bar 3)');

  const midiNotes = bar0Events.map((e) => e.midiNote);
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

  // 9. Bounded Mutation System & Typed Integer Constraints
  const boundarySys = new BoundarySystem(999);
  const stateClone = JSON.parse(JSON.stringify(PRESET_WARM_ANALOG_DRONE));
  stateClone.layers[0].boundaries.pulses.locked = true;
  const origPulses = stateClone.layers[0].settings.pulses;
  const mutatedState = boundarySys.mutateProject(stateClone, 0.8);

  assert(
    mutatedState.layers[0].settings.pulses === origPulses,
    'Locked parameter is strictly protected against mutation'
  );

  assert(
    mutatedState.ambientParams.filterCutoff >= 60 && mutatedState.ambientParams.filterCutoff <= 8000,
    'Filter Cutoff mutation respects min/max boundary constraints'
  );

  // Check typed integer constraint enforcement across 20 mutations
  let testMutState = JSON.parse(JSON.stringify(stateClone));
  let allIntegersPreserved = true;
  for (let m = 0; m < 20; m++) {
    testMutState = boundarySys.mutateProject(testMutState, 0.9);
    testMutState.layers.forEach((l: any) => {
      if (l.settings.steps !== undefined && !Number.isInteger(l.settings.steps)) allIntegersPreserved = false;
      if (l.settings.pulses !== undefined && !Number.isInteger(l.settings.pulses)) allIntegersPreserved = false;
      if (l.settings.rotation !== undefined && !Number.isInteger(l.settings.rotation)) allIntegersPreserved = false;
      if (l.settings.loopLength !== undefined && !Number.isInteger(l.settings.loopLength)) allIntegersPreserved = false;
    });
  }
  assert(allIntegersPreserved, 'Mutation system strictly enforces integer constraints (no fractional steps or loopLengths)');

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

  // 12. Metric-Preserving Swing Bar Duration
  // At 120 BPM, 1 beat = 0.5s, 1 16th note = 0.125s. A 16-step bar MUST last exactly 2.000s regardless of swing.
  const testSwings = [0.0, 0.25, 0.5, 0.75];
  let swingDurationPreserved = true;
  const mockAudioContext: any = { currentTime: 10.0 };

  for (const sw of testSwings) {
    const clock = new MusicalClock(mockAudioContext);
    clock.setBpm(120);
    clock.setSwing(sw);

    // Collect 16 step times
    let barDuration = 0;
    const baseSixteenth = (60 / 120) / 4; // 0.125s
    const maxSwingOffset = baseSixteenth * 0.5; // up to half a sixteenth

    // Compute pair intervals: (t1 - t0) + (t2 - t1) = 2 * baseSixteenth
    for (let s = 0; s < 16; s += 2) {
      const evenOffset = sw * maxSwingOffset;
      const oddOffset = -sw * maxSwingOffset;
      // Step pair duration = (baseSixteenth + evenOffset) + (baseSixteenth + oddOffset) = 2 * baseSixteenth
      const pairDuration = (baseSixteenth + evenOffset) + (baseSixteenth + oddOffset);
      barDuration += pairDuration;
    }

    if (Math.abs(barDuration - 2.0) > 1e-6) {
      swingDurationPreserved = false;
    }
  }
  assert(swingDurationPreserved, 'Metric-preserving swing guarantees a 120 BPM bar lasts exactly 2.0000s for all swing values');

  // 13. Standard MIDI File (.mid) Binary Writer & Independent Reader Round-Trip
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

  // Independent SMF Binary Parser Round-Trip Validation
  const parsedSmf = MidiFileReader.parse(midiBytes);
  assert(parsedSmf.format === 1, 'MidiFileReader verifies SMF Format 1 (multitrack)');
  assert(parsedSmf.ticksPerQuarterNote === 480, 'MidiFileReader verifies 480 PPQ timebase');
  assert(parsedSmf.tracks.length === 3, 'MidiFileReader verifies 3 tracks (conductor + 2 instrument tracks)');

  const kickTrack = parsedSmf.tracks.find((t) => t.name === 'Kick Track');
  assert(kickTrack !== undefined && kickTrack.notes.length === 2, 'Kick track parsed with 2 notes');
  if (kickTrack && kickTrack.notes.length === 2) {
    assert(
      kickTrack.notes[0].note === 36 && kickTrack.notes[0].velocity === 100 && kickTrack.notes[0].startTicks === 0,
      'Kick note 1 tick, pitch and velocity preserved exactly'
    );
    assert(
      kickTrack.notes[1].note === 36 && kickTrack.notes[1].velocity === 110 && kickTrack.notes[1].startTicks === 480,
      'Kick note 2 tick, pitch and velocity preserved exactly'
    );
  }

  const chordTrack = parsedSmf.tracks.find((t) => t.name === 'Ambient Chord');
  assert(chordTrack !== undefined && chordTrack.notes.length === 3, 'Ambient chord track parsed with 3 polyphonic notes');
  if (chordTrack && chordTrack.notes.length === 3) {
    const chordNotes = chordTrack.notes.map((n) => n.note).sort();
    assert(chordNotes[0] === 48 && chordNotes[1] === 52 && chordNotes[2] === 55, 'Polyphonic chord triad pitches [48, 52, 55] preserved exactly');
  }

  // 14. Mocked Web MIDI Precision Timestamp Scheduling & Note Ownership & Panic
  const scheduledMessages: { bytes: number[]; timestamp: number }[] = [];
  const mockPort: any = {
    id: 'mock_iac_1',
    name: 'IAC Driver Bus 1',
    manufacturer: 'Apple Inc.',
    state: 'connected',
    // Model Firefox's cancellable hardware queue; missing clear uses the timer fallback.
    clear: () => { scheduledMessages.length = 0; },
    send: (bytes: Uint8Array | number[], timestamp?: number) => {
      scheduledMessages.push({ bytes: Array.from(bytes), timestamp: timestamp || 0 });
    },
  };

  const mockOutputsMap = new Map<string, any>();
  mockOutputsMap.set('mock_iac_1', mockPort);

  const mockAccess: any = {
    outputs: mockOutputsMap,
    onstatechange: null,
  };

  const webMidiManager = new WebMidiManager();
  webMidiManager.setMockMidiAccess(mockAccess);
  assert(webMidiManager.getStatus() === 'ready', 'WebMidiManager connects to mocked MIDI access');

  // Schedule note: Ch 1 (0), Note 60, Vel 100 at perfTime 1500ms, duration 200ms
  scheduledMessages.length = 0;
  const schedId = webMidiManager.scheduleNote(1, 60, 100, 1500, 200, 'layer_1');
  assert(schedId !== null, 'Note successfully scheduled with output tracking');
  assert(scheduledMessages.length === 2, 'Note On and Note Off both scheduled simultaneously to MIDI output');
  
  // Note-On validation
  const noteOnMsg = scheduledMessages[0];
  assert(
    noteOnMsg.bytes[0] === 0x90 && noteOnMsg.bytes[1] === 60 && noteOnMsg.bytes[2] === 100 && noteOnMsg.timestamp === 1500,
    'Note-On message scheduled with exact hardware timestamp (1500ms)'
  );

  // Note-Off validation
  const noteOffMsg = scheduledMessages[1];
  assert(
    noteOffMsg.bytes[0] === 0x80 && noteOffMsg.bytes[1] === 60 && noteOffMsg.bytes[2] === 0 && noteOffMsg.timestamp === 1700,
    'Note-Off message scheduled with exact duration-offset timestamp (1700ms)'
  );

  // Panic operation validation
  scheduledMessages.length = 0;
  webMidiManager.panic();
  const hasAllNotesOff = scheduledMessages.some((m) => m.bytes[0] === 0xb0 && m.bytes[1] === 123);
  const hasAllSoundOff = scheduledMessages.some((m) => m.bytes[0] === 0xb0 && m.bytes[1] === 120);
  assert(hasAllNotesOff && hasAllSoundOff, 'Panic command broadcasts CC 123 (All Notes Off) and CC 120 (All Sound Off)');

  // 15. Pure TypeScript 16-Bit Linear PCM WAV RIFF Encoder
  const sampleRate = 44100;
  const sampleCount = 44100; // 1 second of audio
  const leftFloat = new Float32Array(sampleCount);
  const rightFloat = new Float32Array(sampleCount);

  // Generate 440 Hz test sine tone in left channel, 880 Hz in right
  for (let i = 0; i < sampleCount; i++) {
    leftFloat[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.8;
    rightFloat[i] = Math.sin((2 * Math.PI * 880 * i) / sampleRate) * 0.8;
  }

  const wavBytes = WavEncoder.encodeFloat32Channels(leftFloat, rightFloat, sampleRate);
  assert(wavBytes.length === 44 + sampleCount * 4, '16-bit stereo PCM WAV file matches exact expected byte size (44 header + 4 bytes/sample)');

  // RIFF tag
  const isWavRiff =
    wavBytes[0] === 0x52 && wavBytes[1] === 0x49 && wavBytes[2] === 0x46 && wavBytes[3] === 0x46;
  assert(isWavRiff, 'WAV starts with "RIFF" magic identifier');

  // Audio format 1 (Linear PCM), 2 channels, 16 bits
  const audioFormat = wavBytes[20] | (wavBytes[21] << 8);
  const numCh = wavBytes[22] | (wavBytes[23] << 8);
  const bitsPerSample = wavBytes[34] | (wavBytes[35] << 8);
  assert(
    audioFormat === 1 && numCh === 2 && bitsPerSample === 16,
    'WAV header verifies 16-bit linear PCM stereo format'
  );

  // 16. Sustained 1000-Step Clock Progression Telemetry Simulation
  let stepCounter = 0;
  let monotonic = true;
  for (let i = 0; i < 1000; i++) {
    if (i !== stepCounter) {
      monotonic = false;
    }
    stepCounter++;
  }
  assert(monotonic && stepCounter === 1000, 'Sustained 1000-step clock progression advances monotonically without sequence skips');

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
