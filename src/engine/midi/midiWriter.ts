// Standard MIDI File type 1 writer. Every track shares an origin and can retain
// trailing silence; per-note channels and non-note SMF events are preserved.
export interface MidiNoteEvent {
  startTicks: number; durationTicks: number; note: number; velocity: number; channel: number;
}
export interface MidiTrackData {
  name: string; channel: number; notes: MidiNoteEvent[];
  rawEvents?: { tick: number; bytes: number[] }[];
  lengthTicks?: number;
}
export interface TempoEvent { tick: number; bpm: number }

export class MidiFileWriter {
  constructor(private ticksPerQuarterNote = 480) {
    if (!Number.isInteger(ticksPerQuarterNote) || ticksPerQuarterNote < 1 || ticksPerQuarterNote > 32767) {
      throw new Error('MIDI PPQ must be an integer from 1 to 32767.');
    }
  }
  public static bpmToMicroseconds(bpm: number): number {
    if (!Number.isFinite(bpm) || bpm <= 0) throw new Error('MIDI tempo must be positive and finite.');
    const value = Math.round(60_000_000 / bpm);
    if (value < 1 || value > 0xffffff) throw new Error('MIDI tempo is outside the SMF tempo range.');
    return value;
  }
  private encodeVLQ(value: number): number[] {
    if (!Number.isInteger(value) || value < 0 || value > 0x0fffffff) throw new Error('MIDI delta time exceeds the four-byte VLQ range.');
    const bytes = [value & 127];
    while ((value = Math.floor(value / 128)) > 0) bytes.unshift((value & 127) | 128);
    return bytes;
  }
  private chunk(bytes: number[]): number[] {
    const length = bytes.length;
    return [0x4d, 0x54, 0x72, 0x6b, Math.floor(length / 0x1000000) & 255, (length >>> 16) & 255, (length >>> 8) & 255, length & 255, ...bytes];
  }
  private track(events: { tick: number; priority: number; bytes: number[] }[], lengthTicks = 0): number[] {
    events.sort((a, b) => a.tick - b.tick || a.priority - b.priority);
    const bytes: number[] = [];
    let last = 0;
    for (const event of events) {
      if (!Number.isFinite(event.tick) || event.tick < 0) throw new Error('MIDI event time must be nonnegative and finite.');
      const tick = Math.round(event.tick);
      bytes.push(...this.encodeVLQ(tick - last));
      for (const byte of event.bytes) bytes.push(byte);
      last = tick;
    }
    bytes.push(...this.encodeVLQ(Math.max(last, Math.round(lengthTicks)) - last), 0xff, 0x2f, 0);
    return this.chunk(bytes);
  }
  private name(name: string): number[] {
    const data = new TextEncoder().encode(name);
    return [0xff, 3, ...this.encodeVLQ(data.length), ...data];
  }
  public createMidiFile(bpm: number, tracks: MidiTrackData[], tempoChanges?: TempoEvent[], lengthTicks = 0, conductorRawEvents: {tick: number; bytes: number[]}[] = []): Uint8Array {
    if (tracks.length > 65534) throw new Error('Too many MIDI tracks.');
    const trackCount = tracks.length + 1;
    const result = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, trackCount >>> 8, trackCount & 255,
      this.ticksPerQuarterNote >>> 8, this.ticksPerQuarterNote & 255];
    const changes = [...(tempoChanges ?? [])];
    if (!changes.some(c => c.tick === 0)) changes.unshift({ tick: 0, bpm });
    const tempoEvents = changes.map(c => {
      const mpqn = MidiFileWriter.bpmToMicroseconds(c.bpm);
      return { tick: Math.round(c.tick), priority: 1, bytes: [0xff, 0x51, 3, (mpqn >>> 16) & 255, (mpqn >>> 8) & 255, mpqn & 255] };
    });
    if (!conductorRawEvents.some(event => event.bytes[0] === 0xff && event.bytes[1] === 3)) tempoEvents.unshift({ tick: 0, priority: 0, bytes: this.name('instajammable Conductor') });
    for (const event of conductorRawEvents) {
      if (event.bytes[0] === 0xff && [0x2f, 0x51].includes(event.bytes[1])) continue;
      this.validateRawMessage(event.bytes);
      tempoEvents.push({ tick: event.tick, priority: 0, bytes: [...event.bytes] });
    }
    for (const byte of this.track(tempoEvents, lengthTicks)) result.push(byte);
    for (const track of tracks) {
      const events: {tick: number; priority: number; bytes: number[]}[] = [];
      if (!(track.rawEvents ?? []).some(event => event.tick === 0 && event.bytes[0] === 0xff && event.bytes[1] === 3)) events.push({tick:0,priority:0,bytes:this.name(track.name)});
      for (const note of track.notes) {
        if (![note.startTicks, note.durationTicks, note.note, note.velocity, note.channel].every(Number.isFinite)) throw new Error('MIDI note contains a non-finite value.');
        const channel = Math.round(Math.max(0, Math.min(15, note.channel ?? track.channel)));
        const pitch = Math.round(Math.max(0, Math.min(127, note.note)));
        const velocity = Math.round(Math.max(1, Math.min(127, note.velocity)));
        const start = Math.max(0, Math.round(note.startTicks));
        events.push({ tick: start, priority: 3, bytes: [0x90 | channel, pitch, velocity] });
        events.push({ tick: Math.max(start + 1, Math.round(note.startTicks + Math.max(1, note.durationTicks))), priority: 2, bytes: [0x80 | channel, pitch, 0] });
      }
      for (const event of track.rawEvents ?? []) {
        if (event.bytes[0] === 0xff && event.bytes[1] === 0x2f) continue;
        this.validateRawMessage(event.bytes);
        events.push({ tick: event.tick, priority: 1, bytes: [...event.bytes] });
      }
      for (const byte of this.track(events, track.lengthTicks ?? lengthTicks)) result.push(byte);
    }
    return new Uint8Array(result);
  }
  private validateRawMessage(bytes: number[]): void {
    if (bytes.length < 2 || bytes.some(b => !Number.isInteger(b) || b < 0 || b > 255)) throw new Error('Invalid preserved MIDI event bytes.');
    const status = bytes[0];
    if (status >= 0x80 && status < 0xf0) {
      const size = (status & 0xf0) === 0xc0 || (status & 0xf0) === 0xd0 ? 2 : 3;
      if (bytes.length !== size || bytes.slice(1).some(b => b > 127)) throw new Error('Invalid preserved channel event.');
      return;
    }
    if (![0xff, 0xf0, 0xf7].includes(status)) throw new Error('Unsupported preserved MIDI status.');
    let position = status === 0xff ? 2 : 1;
    let size = 0;
    for (let i = 0; i < 4; i++) {
      if (position >= bytes.length) throw new Error('Truncated preserved MIDI event.');
      const value = bytes[position++];
      size = size * 128 + (value & 127);
      if (!(value & 128)) {
        if (position + size !== bytes.length) throw new Error('Preserved MIDI event length mismatch.');
        return;
      }
    }
    throw new Error('Invalid preserved MIDI event length.');
  }
  public static downloadMidi(bytes: Uint8Array, filename = 'instajammable-export.mid'): void {
    const blob = new Blob([bytes.slice().buffer], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.style.display = 'none';
    document.body.appendChild(link); link.click();
    setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 1000);
  }
}
