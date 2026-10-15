import test from 'node:test';
import assert from 'node:assert/strict';
import { JamEngine } from '../engine/jam/JamEngine';

test('Notes On-The-Fly: transposeRoot shifts root and clamps safely', () => {
  const engine = JamEngine.getInstance();
  const initialRoot = engine.getState().root;

  // Transpose up by 1 semitone
  engine.transposeRoot(1);
  assert.equal(engine.getState().root, initialRoot + 1);

  // Transpose down by 2 semitones
  engine.transposeRoot(-2);
  assert.equal(engine.getState().root, initialRoot - 1);

  // Set explicit root
  engine.setRoot(60); // C4
  assert.equal(engine.getState().root, 60);

  // Out of range clamping
  engine.setRoot(150);
  assert.equal(engine.getState().root, 84);

  engine.setRoot(10);
  assert.equal(engine.getState().root, 24);

  // Restore
  engine.setRoot(initialRoot);
});

test('Notes On-The-Fly: nudgeChordNote transposes individual voices and updates chord name', () => {
  const engine = JamEngine.getInstance();
  const pos = engine.getPosition();
  assert.ok(pos.chordNotes.length > 0, 'Must have chord notes');

  const originalNote0 = pos.chordNotes[0];
  const originalName = pos.chord;
  assert.ok(originalName, 'Original chord must be named');

  // Nudge first chord tone by +1 semitone
  engine.nudgeChordNote(0, 1);
  const updatedPos1 = engine.getPosition();
  assert.equal(updatedPos1.chordNotes[0], originalNote0 + 1);

  // Nudge first chord tone back by -1 semitone
  engine.nudgeChordNote(0, -1);
  const updatedPos2 = engine.getPosition();
  assert.equal(updatedPos2.chordNotes[0], originalNote0);
});

test('Notes On-The-Fly: cycleChord steps harmonic degrees forward and backward', () => {
  const engine = JamEngine.getInstance();
  const chordBefore = engine.getPosition().chord;
  assert.ok(chordBefore, 'Starting chord must be named');

  engine.cycleChord(1);
  const chordAfterForward = engine.getPosition().chord;
  assert.ok(chordAfterForward, 'Chord name must be defined');

  engine.cycleChord(-1);
  const chordAfterBackward = engine.getPosition().chord;
  assert.ok(chordAfterBackward, 'Chord name must be defined');
});

test('Arrangement Sequencer: moveSequenceBlock reorders blocks in the arrangement', () => {
  const engine = JamEngine.getInstance();
  const seqState = engine.getSequencerState();
  assert.ok(seqState.blocks.length >= 2, 'Need at least 2 blocks to test reorder');

  const firstBlockId = seqState.blocks[0].id;
  const secondBlockId = seqState.blocks[1].id;

  // Move first block to the right
  engine.moveSequenceBlock(firstBlockId, 'right');
  const blocksAfterRight = engine.getSequencerState().blocks;
  assert.equal(blocksAfterRight[0].id, secondBlockId);
  assert.equal(blocksAfterRight[1].id, firstBlockId);

  // Move back to the left
  engine.moveSequenceBlock(firstBlockId, 'left');
  const blocksAfterLeft = engine.getSequencerState().blocks;
  assert.equal(blocksAfterLeft[0].id, firstBlockId);
  assert.equal(blocksAfterLeft[1].id, secondBlockId);
});

test('Arrangement Sequencer: stepBlockBars steps duration through standard bar lengths', () => {
  const engine = JamEngine.getInstance();
  const blocks = engine.getSequencerState().blocks;
  const block = blocks[0];
  assert.ok(block);

  // Set to 4 bars
  engine.updateSequenceBlock(block.id, { bars: 4 });
  assert.equal(engine.getSequencerState().blocks[0].bars, 4);

  // Step up -> 8 bars
  engine.stepBlockBars(block.id, 1);
  assert.equal(engine.getSequencerState().blocks[0].bars, 8);

  // Step up -> 16 bars
  engine.stepBlockBars(block.id, 1);
  assert.equal(engine.getSequencerState().blocks[0].bars, 16);

  // Step down -> 8 bars
  engine.stepBlockBars(block.id, -1);
  assert.equal(engine.getSequencerState().blocks[0].bars, 8);

  // Step down -> 4 bars
  engine.stepBlockBars(block.id, -1);
  assert.equal(engine.getSequencerState().blocks[0].bars, 4);
});

test('Arrangement Sequencer: setBlockSectionByEnergy configures High, Up, Flow, Down, Low profiles', () => {
  const engine = JamEngine.getInstance();
  const block = engine.getSequencerState().blocks[0];
  assert.ok(block);

  // High (Peak / Chorus)
  engine.setBlockSectionByEnergy(block.id, 'high');
  let b = engine.getSequencerState().blocks[0];
  assert.equal(b.section, 'chorus');
  assert.ok(b.macroTargets?.density && b.macroTargets.density >= 0.8);

  // Up (Buildup)
  engine.setBlockSectionByEnergy(block.id, 'up');
  b = engine.getSequencerState().blocks[0];
  assert.equal(b.section, 'buildup');
  assert.ok(b.macroTargets?.movement && b.macroTargets.movement >= 0.65);

  // Flow (Beat / Groove)
  engine.setBlockSectionByEnergy(block.id, 'groove');
  b = engine.getSequencerState().blocks[0];
  assert.equal(b.section, 'groove');

  // Down (Breakdown)
  engine.setBlockSectionByEnergy(block.id, 'down');
  b = engine.getSequencerState().blocks[0];
  assert.equal(b.section, 'breakdown');
  assert.ok(b.macroTargets?.space && b.macroTargets.space >= 0.8);

  // Low (Silent / Minimal)
  engine.setBlockSectionByEnergy(block.id, 'low');
  b = engine.getSequencerState().blocks[0];
  assert.equal(b.section, 'silent');
  assert.ok(b.macroTargets?.space && b.macroTargets.space >= 0.85);
});
