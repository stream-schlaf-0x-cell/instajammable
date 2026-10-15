import test from 'node:test';
import assert from 'node:assert/strict';
import { MidiFileReader } from '../engine/midi/midiReader';
import { MidiFileWriter } from '../engine/midi/midiWriter';
import { clipToMidi, midiToClip } from '../engine/jam/clipMidi';
import type { MidiClip } from '../types/jam';
import { validateClip } from '../engine/jam/storage';

function smf(track: number[], format = 0, division = 96): Uint8Array {
  return Uint8Array.from([0x4d,0x54,0x68,0x64,0,0,0,6,0,format,0,1,division >> 8,division & 255,
    0x4d,0x54,0x72,0x6b,track.length >>> 24,(track.length >>> 16) & 255,(track.length >>> 8) & 255,track.length & 255,...track]);
}
const fixture = smf([
  0,0xff,3,4,75,101,121,115,
  0,0xff,0x58,4,4,2,24,8,
  0,0xff,0x51,3,7,0xa1,0x20,
  0,0xc1,5, 0,0xb1,1,22, 0,0xe1,0,80, 0,0xa1,60,45, 0,0xd1,55,
  0,0xf0,3,0x7d,1,0xf7, 0,0xf7,2,2,0xf7,
  0,0x91,60,100,
  48,60,90, // running-status overlapping note-on
  48,0x81,60,12,
  48,60,1, // running-status note-off, FIFO pairing
  48,0xff,0x51,3,9,0x27,0xc0,
  0,0xff,6,4,104,101,114,101,
  0,0xff,0x2f,0,
]);

test('SMF0 import decodes running status, overlapping notes, channel and exact tempo changes', () => {
  const parsed = MidiFileReader.parse(fixture);
  assert.equal(parsed.format, 0); assert.equal(parsed.ticksPerQuarterNote, 96);
  assert.deepEqual(parsed.tracks[0].notes, [
    { startTicks: 0, durationTicks: 96, channel: 1, note: 60, velocity: 100 },
    { startTicks: 48, durationTicks: 96, channel: 1, note: 60, velocity: 90 },
  ]);
  assert.deepEqual(parsed.tracks[0].tempoEvents, [{ tick: 0, bpm: 120 }, { tick: 192, bpm: 100 }]);
  assert.deepEqual(parsed.warnings, []);
});

test('Clip edit/export roundtrip retains non-note metadata, SysEx, channel messages and common duration', () => {
  const clip = midiToClip(fixture, 'Keys');
  clip.notes[1].note = 65; clip.notes[1].velocity = 76; clip.notes[1].durationBeats = 0.75;
  const result = midiToClip(clipToMidi(clip));
  assert.equal(validateClip(result).notes.length, 2, 'imported conductor metadata passes persisted clip validation');
  assert.deepEqual(result.notes.map(n => [n.startBeat, n.durationBeats, n.note, n.velocity, n.channel]), [[0,1,60,100,2],[0.5,0.75,65,76,2]]);
  assert.equal(result.lengthBeats, 2);
  assert.deepEqual(result.tempos, [{beat:0,bpm:120},{beat:2,bpm:100}]);
  for (const message of [[0xb1,1,22],[0xe1,0,80],[0xa1,60,45],[0xd1,55],[0xc1,5],[0xf0,3,0x7d,1,0xf7],[0xf7,2,2,0xf7],[0xff,0x58,4,4,2,24,8],[0xff,6,4,104,101,114,101]]) {
    assert.ok(result.extraEvents.some(e => JSON.stringify(e.bytes) === JSON.stringify(message)), `preserved ${message}`);
  }
  assert.ok(result.warnings?.some(w => w.includes('SysEx')));
  assert.equal(midiToClip(clipToMidi(result)).tracks.length, result.tracks.length, 'conductor tracks do not multiply on each edit/export cycle');
});

test('SMF1 single-layer stems retain initial silence and identical end position', () => {
  const clip: MidiClip = { version:1,id:'test',name:'Jam',createdAt:0,style:'ambient',root:62,scale:'dorian',bpm:78,lengthBeats:32,
    tracks:[{id:'a',name:'Chords',channel:1,color:'#fff'},{id:'b',name:'Melody',channel:3,color:'#fff'}],
    notes:[{id:'a',layerId:'a',note:60,velocity:88,channel:1,startBeat:0,durationBeats:4},{id:'b',layerId:'b',note:72,velocity:65,channel:3,startBeat:13.3125,durationBeats:2.625}],
    tempos:[{beat:0,bpm:78},{beat:16,bpm:90}],extraEvents:[] };
  const stem = MidiFileReader.parse(clipToMidi(clip,'b'));
  assert.equal(stem.tracks[1].notes[0].startTicks,13.3125*960);
  assert.equal(stem.tracks[1].notes[0].durationTicks,2.625*960);
  assert.equal(stem.tracks[1].notes[0].channel,2);
  assert.ok(stem.tracks.every(track => track.endTicks === 32*960));
  assert.equal(midiToClip(clipToMidi(clip,'a')).lengthBeats,32);
});

test('MIDI parser rejects every truncated fixture, malformed running status, oversized VLQ and SMPTE', () => {
  for(let length=0;length<fixture.length;length++) assert.throws(() => MidiFileReader.parse(fixture.subarray(0,length)), /Invalid MIDI/, `truncation ${length}`);
  assert.throws(() => MidiFileReader.parse(smf([0,60,100,0,0xff,0x2f,0])), /running status/);
  assert.throws(() => MidiFileReader.parse(smf([0x81,0x81,0x81,0x81,0,0xff,0x2f,0])), /four bytes/);
  assert.throws(() => MidiFileReader.parse(smf([0,0xff,0x2f,0],0,0xe728)), /SMPTE/);
  assert.throws(() => MidiFileReader.parse(smf([0,0x90,60])), /truncated/);
  assert.throws(() => MidiFileReader.parse(smf([0,0xff,0x51,3,0,0,0])), /tempo value/);
  assert.throws(() => MidiFileReader.parse(smf([0,0xff,0x2f,0],2)), /type 2/);
});

test('Long MIDI exports do not overflow argument stacks and preserve mixed channels', () => {
  const notes = Array.from({length:20000}, (_,i) => ({startTicks:i*60,durationTicks:30,note:60+i%12,velocity:80,channel:i%4}));
  const bytes = new MidiFileWriter().createMidiFile(120,[{name:'Long take',channel:0,notes}]);
  assert.ok(bytes.length>100000);
  const parsed = MidiFileReader.parse(bytes);
  assert.equal(parsed.tracks[1].notes.length,20000);
  assert.equal(parsed.tracks[1].notes[19999].channel,3);
});
