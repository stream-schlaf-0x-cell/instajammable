// Web MIDI Output Engine & Port Manager

import { RecordedMidiEvent } from '../../types';

export interface MidiDeviceOption {
  id: string;
  name: string;
  manufacturer?: string;
  state: string;
}

export class WebMidiManager {
  private midiAccess: MIDIAccess | null = null;
  private selectedOutputId: string | null = null;
  private selectedOutput: MIDIOutput | null = null;
  private availableOutputs: MidiDeviceOption[] = [];
  private eventHistory: RecordedMidiEvent[] = [];
  private maxHistoryLength: number = 256;
  private isSupported: boolean = false;
  private onDevicesChanged?: (devices: MidiDeviceOption[]) => void;
  private onEventRecorded?: (event: RecordedMidiEvent) => void;

  constructor() {
    this.checkSupport();
  }

  public checkSupport(): boolean {
    this.isSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
    return this.isSupported;
  }

  public async init(): Promise<boolean> {
    if (!this.checkSupport()) {
      console.warn('Web MIDI API is not supported in this environment.');
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.updateOutputsList();

      this.midiAccess.onstatechange = () => {
        this.updateOutputsList();
      };

      return true;
    } catch (err) {
      console.warn('Web MIDI permission denied or unavailable:', err);
      return false;
    }
  }

  private updateOutputsList(): void {
    if (!this.midiAccess) return;

    const list: MidiDeviceOption[] = [];
    const outputs = this.midiAccess.outputs.values();

    for (const output of outputs) {
      list.push({
        id: output.id,
        name: output.name || `MIDI Output (${output.id})`,
        manufacturer: output.manufacturer || '',
        state: output.state,
      });
    }

    this.availableOutputs = list;

    // Automatically select IAC Driver if available or first output if none selected
    if (!this.selectedOutputId && list.length > 0) {
      const iacPort = list.find((d) => d.name.toLowerCase().includes('iac'));
      this.selectOutput(iacPort ? iacPort.id : list[0].id);
    } else if (this.selectedOutputId) {
      // Re-verify current output
      this.selectOutput(this.selectedOutputId);
    }

    if (this.onDevicesChanged) {
      this.onDevicesChanged(this.availableOutputs);
    }
  }

  public getAvailableOutputs(): MidiDeviceOption[] {
    return this.availableOutputs;
  }

  public getSelectedOutputId(): string | null {
    return this.selectedOutputId;
  }

  public selectOutput(id: string): void {
    this.selectedOutputId = id;
    if (this.midiAccess) {
      this.selectedOutput = this.midiAccess.outputs.get(id) || null;
    }
  }

  public setCallbacks(
    onDevices?: (devices: MidiDeviceOption[]) => void,
    onEvent?: (event: RecordedMidiEvent) => void
  ): void {
    if (onDevices) this.onDevicesChanged = onDevices;
    if (onEvent) this.onEventRecorded = onEvent;
  }

  // Send MIDI Note On
  public sendNoteOn(
    channel: number,
    note: number,
    velocity: number,
    durationMs: number = 200,
    layerId: string = 'unknown'
  ): void {
    const ch = Math.max(1, Math.min(16, channel)) - 1; // 0-indexed 0-15
    const clampedNote = Math.max(0, Math.min(127, Math.round(note)));
    const clampedVel = Math.max(1, Math.min(127, Math.round(velocity)));

    const event: RecordedMidiEvent = {
      timestamp: Date.now(),
      type: 'noteOn',
      channel: ch + 1,
      note: clampedNote,
      velocity: clampedVel,
      durationMs,
      layerId,
    };

    this.recordEvent(event);

    if (this.selectedOutput) {
      try {
        const noteOnByte = 0x90 | ch;
        this.selectedOutput.send([noteOnByte, clampedNote, clampedVel]);

        // Schedule Note Off
        setTimeout(() => {
          this.sendNoteOff(channel, clampedNote, layerId);
        }, durationMs);
      } catch (err) {
        console.error('Failed to send MIDI note on:', err);
      }
    }
  }

  // Send MIDI Note Off
  public sendNoteOff(channel: number, note: number, layerId: string = 'unknown'): void {
    const ch = Math.max(1, Math.min(16, channel)) - 1;
    const clampedNote = Math.max(0, Math.min(127, Math.round(note)));

    const event: RecordedMidiEvent = {
      timestamp: Date.now(),
      type: 'noteOff',
      channel: ch + 1,
      note: clampedNote,
      velocity: 0,
      layerId,
    };

    this.recordEvent(event);

    if (this.selectedOutput) {
      try {
        const noteOffByte = 0x80 | ch;
        this.selectedOutput.send([noteOffByte, clampedNote, 0]);
      } catch (err) {
        // ignore
      }
    }
  }

  // Send Control Change (CC)
  public sendCC(channel: number, controller: number, value: number): void {
    if (!this.selectedOutput) return;
    const ch = Math.max(1, Math.min(16, channel)) - 1;
    const cc = Math.max(0, Math.min(127, Math.round(controller)));
    const val = Math.max(0, Math.min(127, Math.round(value)));

    try {
      this.selectedOutput.send([0xb0 | ch, cc, val]);
    } catch {
      // ignore
    }
  }

  // Emergency Panic: All Notes Off, All Sound Off on all 16 channels
  public emergencyPanic(): void {
    if (!this.selectedOutput) return;

    for (let ch = 0; ch < 16; ch++) {
      try {
        // CC 120: All Sound Off
        this.selectedOutput.send([0xb0 | ch, 120, 0]);
        // CC 123: All Notes Off
        this.selectedOutput.send([0xb0 | ch, 123, 0]);
        // CC 121: Reset All Controllers
        this.selectedOutput.send([0xb0 | ch, 121, 0]);
      } catch {
        // ignore
      }
    }
  }

  private recordEvent(event: RecordedMidiEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistoryLength) {
      this.eventHistory.shift();
    }
    if (this.onEventRecorded) {
      this.onEventRecorded(event);
    }
  }

  public getRecentHistory(): RecordedMidiEvent[] {
    return [...this.eventHistory];
  }

  public clearHistory(): void {
    this.eventHistory = [];
  }
}
