// Pure TypeScript Standard MIDI File (SMF Type 1) Binary Exporter

export interface MidiNoteEvent {
  startTicks: number;   // Absolute tick position from start
  durationTicks: number;
  note: number;         // 0-127
  velocity: number;     // 1-127
  channel: number;      // 0-15
}

export interface MidiTrackData {
  name: string;
  channel: number;      // 0-15
  notes: MidiNoteEvent[];
}

export class MidiFileWriter {
  private ticksPerQuarterNote: number = 480;

  constructor(ticksPerBeat: number = 480) {
    this.ticksPerQuarterNote = ticksPerBeat;
  }

  // Convert BPM to microseconds per quarter note (tempo meta event)
  public static bpmToMicroseconds(bpm: number): number {
    return Math.round(60000000 / bpm);
  }

  // Variable-Length Quantity (VLQ) encoder required by SMF specification
  private encodeVLQ(value: number): number[] {
    let buffer = value & 0x7f;
    const bytes: number[] = [];

    while ((value >>= 7) > 0) {
      buffer <<= 8;
      buffer |= 0x80;
      buffer += value & 0x7f;
    }

    while (true) {
      bytes.push(buffer & 0xff);
      if (buffer & 0x80) {
        buffer >>= 8;
      } else {
        break;
      }
    }
    return bytes;
  }

  // Builds binary Type 1 Multitrack MIDI file
  public createMidiFile(bpm: number, tracks: MidiTrackData[]): Uint8Array {
    const fileBytes: number[] = [];

    // Header Chunk: 'MThd', length 6, format 1, numTracks (tempo track + track count), ticksPerQuarter
    const totalTracks = tracks.length + 1; // 1 tempo conductor track + N instrument tracks
    fileBytes.push(
      0x4d, 0x54, 0x68, 0x64, // 'MThd'
      0x00, 0x00, 0x00, 0x06, // chunk length = 6
      0x00, 0x01,             // Format 1 (multitrack)
      (totalTracks >> 8) & 0xff, totalTracks & 0xff,
      (this.ticksPerQuarterNote >> 8) & 0xff, this.ticksPerQuarterNote & 0xff
    );

    // Track 0: Conductor Track (Tempo & Time Signature)
    const tempoTrackBytes = this.buildTempoTrack(bpm);
    fileBytes.push(...this.buildTrackChunk(tempoTrackBytes));

    // Tracks 1..N: Instrument Tracks
    tracks.forEach((track) => {
      const trackBytes = this.buildInstrumentTrack(track);
      fileBytes.push(...this.buildTrackChunk(trackBytes));
    });

    return new Uint8Array(fileBytes);
  }

  private buildTrackChunk(trackData: number[]): number[] {
    const chunk: number[] = [
      0x4d, 0x54, 0x72, 0x6b, // 'MTrk'
      (trackData.length >> 24) & 0xff,
      (trackData.length >> 16) & 0xff,
      (trackData.length >> 8) & 0xff,
      trackData.length & 0xff,
      ...trackData,
    ];
    return chunk;
  }

  private buildTempoTrack(bpm: number): number[] {
    const bytes: number[] = [];
    const mpqn = MidiFileWriter.bpmToMicroseconds(bpm);

    // Delta-time 0: Set Tempo meta event (FF 51 03)
    bytes.push(0x00, 0xff, 0x51, 0x03);
    bytes.push((mpqn >> 16) & 0xff, (mpqn >> 8) & 0xff, mpqn & 0xff);

    // Delta-time 0: Track name 'Tempo / Conductor'
    const nameBytes = new TextEncoder().encode('ECHO GARDEN Conductor');
    bytes.push(0x00, 0xff, 0x03, ...this.encodeVLQ(nameBytes.length), ...nameBytes);

    // End of Track meta event (FF 2F 00)
    bytes.push(0x00, 0xff, 0x2f, 0x00);
    return bytes;
  }

  private buildInstrumentTrack(track: MidiTrackData): number[] {
    const bytes: number[] = [];

    // Track name meta event
    const nameBytes = new TextEncoder().encode(track.name);
    bytes.push(0x00, 0xff, 0x03, ...this.encodeVLQ(nameBytes.length), ...nameBytes);

    // Flatten notes into distinct NoteOn and NoteOff events with absolute ticks
    interface FlatEvent {
      tick: number;
      type: 'on' | 'off';
      note: number;
      velocity: number;
      channel: number;
    }

    const flatEvents: FlatEvent[] = [];
    const ch = Math.max(0, Math.min(15, track.channel));

    track.notes.forEach((n) => {
      flatEvents.push({
        tick: n.startTicks,
        type: 'on',
        note: n.note,
        velocity: Math.max(1, Math.min(127, n.velocity)),
        channel: ch,
      });
      flatEvents.push({
        tick: n.startTicks + Math.max(10, n.durationTicks),
        type: 'off',
        note: n.note,
        velocity: 0,
        channel: ch,
      });
    });

    // Sort chronologically by tick (noteOff before noteOn if same tick)
    flatEvents.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      return a.type === 'off' ? -1 : 1;
    });

    let lastTick = 0;
    flatEvents.forEach((ev) => {
      const delta = ev.tick - lastTick;
      lastTick = ev.tick;

      // Delta time in VLQ
      bytes.push(...this.encodeVLQ(delta));

      if (ev.type === 'on') {
        bytes.push(0x90 | ev.channel, ev.note, ev.velocity);
      } else {
        bytes.push(0x80 | ev.channel, ev.note, 0x00);
      }
    });

    // End of Track meta event
    bytes.push(0x00, 0xff, 0x2f, 0x00);
    return bytes;
  }

  // Trigger browser download of standard MIDI file
  public static downloadMidi(midiBytes: Uint8Array, filename = 'echo-garden-export.mid'): void {
    const blob = new Blob([midiBytes.buffer as ArrayBuffer], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}
