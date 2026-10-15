// Strict, bounded Standard MIDI File reader. Channel notes are paired FIFO so
// overlapping same-pitch notes survive an import instead of overwriting each other.
export interface ParsedMidiNote {
  startTicks: number;
  durationTicks: number;
  channel: number;
  note: number;
  velocity: number;
}
export interface ParsedMidiRawEvent { tick: number; bytes: number[] }
export interface ParsedMidiTrack {
  trackIndex: number;
  name: string;
  notes: ParsedMidiNote[];
  tempoEvents: { tick: number; bpm: number }[];
  rawEvents: ParsedMidiRawEvent[];
  endTicks: number;
}
export interface ParsedMidiFile {
  format: number;
  numTracks: number;
  ticksPerQuarterNote: number;
  tracks: ParsedMidiTrack[];
  warnings: string[];
}

export class MidiFileReader {
  public static parse(data: Uint8Array): ParsedMidiFile {
    if (data.length > 32 * 1024 * 1024) throw new Error('MIDI file exceeds the 32 MB import limit.');
    let offset = 0;
    let limit = data.length;
    let eventCount = 0;
    const warnings: string[] = [];
    let warningCount = 0;
    const warn = (message: string) => { warningCount++; if (warnings.length < 120) warn(message); };
    const fail = (message: string): never => { throw new Error(`Invalid MIDI at byte ${offset}: ${message}`); };
    const requireBytes = (count: number) => {
      if (count < 0 || offset + count > limit) fail('truncated event or chunk.');
    };
    const read = () => { requireBytes(1); return data[offset++]; };
    const text = (length: number) => {
      requireBytes(length);
      const result = String.fromCharCode(...data.subarray(offset, offset + length));
      offset += length;
      return result;
    };
    const u16 = () => (read() * 256) + read();
    const u32 = () => read() * 0x1000000 + read() * 0x10000 + read() * 0x100 + read();
    const vlq = (): number => {
      let value = 0;
      for (let count = 0; count < 4; count++) {
        const byte = read();
        value = value * 128 + (byte & 127);
        if (!(byte & 128)) return value;
      }
      return fail('variable-length quantity exceeds four bytes.');
    };
    const encodeLength = (value: number): number[] => {
      const bytes = [value & 127];
      while ((value = Math.floor(value / 128)) > 0) bytes.unshift((value & 127) | 128);
      return bytes;
    };
    if (text(4) !== 'MThd') fail('expected MThd header.');
    const headerLength = u32();
    if (headerLength < 6) fail('MThd header must contain at least six bytes.');
    requireBytes(headerLength);
    const format = u16();
    const numTracks = u16();
    const division = u16();
    if (format !== 0 && format !== 1) fail(`unsupported SMF type ${format}; use type 0 or 1.`);
    if (numTracks < 1 || (format === 0 && numTracks !== 1)) fail('invalid track count for SMF format.');
    if (division & 0x8000) fail('SMPTE time division is not supported; export PPQ MIDI.');
    if (!division) fail('PPQ must be greater than zero.');
    offset += headerLength - 6;
    const tracks: ParsedMidiTrack[] = [];
    for (let t = 0; t < numTracks; t++) {
      limit = data.length;
      if (text(4) !== 'MTrk') fail(`expected MTrk header for track ${t + 1}.`);
      const length = u32();
      requireBytes(length);
      limit = offset + length;
      let tick = 0;
      let status = 0;
      let ended = false;
      let name = `Track ${t + 1}`;
      const notes: ParsedMidiNote[] = [];
      const tempos: ParsedMidiTrack['tempoEvents'] = [];
      const rawEvents: ParsedMidiRawEvent[] = [];
      const open = new Map<number, { tick: number; velocity: number }[]>();
      const closeNote = (channel: number, note: number) => {
        const key = channel * 128 + note;
        const queue = open.get(key);
        const start = queue?.shift();
        if (start) notes.push({ startTicks: start.tick, durationTicks: Math.max(1, tick - start.tick), channel, note, velocity: start.velocity });
        else warn(`Track ${t + 1}: unmatched note-off for ${note} at tick ${tick}.`);
        if (queue && queue.length === 0) open.delete(key);
      };
      while (offset < limit) {
        if (++eventCount > 1_000_000) fail('too many events (limit 1,000,000).');
        tick += vlq();
        if (!Number.isSafeInteger(tick)) fail('event time exceeds the safe integer range.');
        requireBytes(1);
        let eventStatus = data[offset];
        if (eventStatus >= 128) {
          offset++;
          status = eventStatus < 0xf0 ? eventStatus : 0;
        } else {
          if (!status) fail('data byte without a valid running status.');
          eventStatus = status;
        }
        if (eventStatus === 0xff) {
          const type = read();
          if (type >= 128) fail('invalid meta event type.');
          const size = vlq();
          requireBytes(size);
          const payload = data.subarray(offset, offset + size);
          offset += size;
          rawEvents.push({ tick, bytes: [0xff, type, ...encodeLength(size), ...payload] });
          if (type === 3) name = new TextDecoder().decode(payload);
          if (type === 0x51) {
            if (size !== 3) fail('tempo event must have three bytes.');
            const mpqn = payload[0] * 65536 + payload[1] * 256 + payload[2];
            if (!mpqn) fail('tempo value cannot be zero.');
            tempos.push({ tick, bpm: 60_000_000 / mpqn });
          }
          if (type === 0x2f) {
            if (size !== 0) fail('end-of-track event must have zero length.');
            ended = true;
            if (offset < limit) warn(`Track ${t + 1}: ignored bytes after end-of-track.`);
            offset = limit;
          }
        } else if (eventStatus === 0xf0 || eventStatus === 0xf7) {
          const size = vlq();
          requireBytes(size);
          const payload = data.subarray(offset, offset + size);
          offset += size;
          rawEvents.push({ tick, bytes: [eventStatus, ...encodeLength(size), ...payload] });
        } else if (eventStatus >= 0x80 && eventStatus <= 0xef) {
          const kind = eventStatus & 0xf0;
          const channel = eventStatus & 15;
          const a = read();
          const b = kind === 0xc0 || kind === 0xd0 ? undefined : read();
          if (a > 127 || (b !== undefined && b > 127)) fail('channel event contains a non-data byte.');
          if (kind === 0x90 && b! > 0) {
            const key = channel * 128 + a;
            const queue = open.get(key) ?? [];
            queue.push({ tick, velocity: b! });
            open.set(key, queue);
          } else if (kind === 0x80 || kind === 0x90) closeNote(channel, a);
          else rawEvents.push({ tick, bytes: b === undefined ? [eventStatus, a] : [eventStatus, a, b] });
        } else fail(`unsupported status 0x${eventStatus.toString(16)}.`);
      }
      if (!ended) warn(`Track ${t + 1}: no end-of-track marker; used chunk end.`);
      open.forEach((queue, key) => {
        for (const start of queue) {
          notes.push({ startTicks: start.tick, durationTicks: Math.max(1, tick - start.tick), channel: Math.floor(key / 128), note: key % 128, velocity: start.velocity });
          warn(`Track ${t + 1}: closed dangling note ${key % 128} at track end.`);
        }
      });
      tracks.push({ trackIndex: t, name, notes: notes.sort((a, b) => a.startTicks - b.startTicks), tempoEvents: tempos, rawEvents, endTicks: tick });
    }
    if (offset < data.length) warn('Ignored trailing bytes after the declared MIDI tracks.');
    if (warningCount > warnings.length) warnings.push(`${warningCount - warnings.length} additional MIDI warnings omitted.`);
    return { format, numTracks, ticksPerQuarterNote: division, tracks, warnings };
  }
}
