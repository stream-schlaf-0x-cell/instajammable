// Timestamped MIDI scheduling with explicit port ownership and queue cancellation.
import type { RecordedMidiEvent } from '../../types';
export interface MidiDeviceOption { id: string; name: string; manufacturer?: string; state: string }
export type MidiSupportStatus = 'uninitialized' | 'requesting' | 'ready' | 'denied' | 'unsupported' | 'error';
export interface ScheduledMidiNote {
  id: string; output: MIDIOutput; outputId: string; channel: number; note: number; velocity: number;
  onPerformanceTime: number; offPerformanceTime: number; layerId: string;
}
const now = () => typeof performance === 'undefined' ? 0 : performance.now();
export class WebMidiManager {
  private midiAccess: MIDIAccess | null = null;
  private selectedOutputId: string | null = null;
  private outputExplicitlyOff = false;
  private preferredOutputId: string | null | undefined;
  private availableOutputs: MidiDeviceOption[] = [];
  private eventHistory: RecordedMidiEvent[] = [];
  private status: MidiSupportStatus = 'uninitialized';
  private errorMessage: string | null = null;
  private initPromise: Promise<boolean> | null = null;
  private activeNotes = new Map<string, ScheduledMidiNote>();
  private ownedPorts = new Map<string, { output: MIDIOutput; channels: Set<number> }>();
  private pendingCC: { output: MIDIOutput; outputId: string; bytes: number[]; time: number }[] = [];
  private noteCounter = 0;
  private softwareTimers = new Map<string, Set<ReturnType<typeof setTimeout>>>();
  private warnedTimerPorts = new Set<string>();
  private onDevicesChanged?: (devices: MidiDeviceOption[]) => void;
  private onStatusChanged?: (status: MidiSupportStatus, error: string | null) => void;
  private onEventRecorded?: (event: RecordedMidiEvent) => void;
  constructor() { this.checkSupport(); }
  public checkSupport(): boolean {
    const supported = typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
    if (!supported && this.status === 'uninitialized') {
      this.status = 'unsupported';
      this.errorMessage = 'Web MIDI is unavailable in this browser/context. Use a current desktop browser on localhost or HTTPS. Internal audio still works.';
    } else if (supported && this.status === 'unsupported') { this.status = 'uninitialized'; this.errorMessage = null; }
    return supported;
  }
  public getStatus(): MidiSupportStatus { return this.status; }
  public getErrorMessage(): string | null { return this.errorMessage; }
  public init(): Promise<boolean> {
    if (this.midiAccess && this.status === 'ready') return Promise.resolve(true);
    if (this.initPromise) return this.initPromise;
    if (!this.checkSupport()) { this.notifyStatus(); return Promise.resolve(false); }
    this.status = 'requesting'; this.notifyStatus();
    this.initPromise = (async () => {
      try {
        this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        this.status = 'ready'; this.errorMessage = null;
        this.updateOutputsList();
        this.midiAccess.onstatechange = () => this.updateOutputsList();
        this.notifyStatus(); return true;
      } catch (error) {
        this.status = error instanceof Error && error.name === 'NotAllowedError' ? 'denied' : 'error';
        this.errorMessage = error instanceof Error ? error.message : 'MIDI access failed.';
        this.notifyStatus(); return false;
      } finally { this.initPromise = null; }
    })();
    return this.initPromise;
  }
  private notifyStatus(): void { this.onStatusChanged?.(this.status, this.errorMessage); }
  private getOutput(id?: string | null): MIDIOutput | null {
    const actual = id === undefined ? this.selectedOutputId : id;
    if (!actual || !this.midiAccess) return null;
    let output: MIDIOutput | null = null;
    this.midiAccess.outputs.forEach(out => { if (out.id === actual && out.state !== 'disconnected') output = out; });
    return output;
  }
  public updateOutputsList(): void {
    if (!this.midiAccess) return;
    const list: MidiDeviceOption[] = [];
    this.midiAccess.outputs.forEach(output => {
      if (output.state !== 'disconnected') list.push({ id: output.id, name: output.name || `MIDI Output (${output.id})`, manufacturer: output.manufacturer ?? '', state: output.state });
    });
    for (const id of this.ownedPorts.keys()) if (!list.some(port => port.id === id)) this.releaseNotesForOutput(id);
    if (this.selectedOutputId && !list.some(port => port.id === this.selectedOutputId) && this.preferredOutputId === undefined) this.selectedOutputId = null;
    this.availableOutputs = list;
    if (this.preferredOutputId !== undefined) this.selectedOutputId = this.preferredOutputId;
    else if (!this.selectedOutputId && !this.outputExplicitlyOff && list.length) {
      this.selectedOutputId = (list.find(port => port.name.toLowerCase().includes('iac')) ?? list[0]).id;
      this.preferredOutputId = this.selectedOutputId; // pin initial discovery; unplugging never redirects a live route
    }
    if (this.selectedOutputId && list.some(port => port.id === this.selectedOutputId) && this.errorMessage?.startsWith('MIDI output ')) { this.errorMessage = null; this.notifyStatus(); }
    this.onDevicesChanged?.([...list]);
  }
  public getAvailableOutputs(): MidiDeviceOption[] { return [...this.availableOutputs]; }
  public getSelectedOutputId(): string | null { return this.selectedOutputId; }
  public selectOutput(id: string, preserveLayerIds?: Set<string>): void {
    if (this.selectedOutputId && this.selectedOutputId !== id) this.releaseGlobalRoute(this.selectedOutputId, preserveLayerIds);
    this.outputExplicitlyOff = false; this.preferredOutputId = id; this.selectedOutputId = id;
    if (!this.getOutput(id)) { this.errorMessage = `MIDI output ${id} is unavailable. Its route is retained without selecting a different device.`; this.notifyStatus(); }
    else if (this.errorMessage?.startsWith('MIDI output ')) { this.errorMessage = null; this.notifyStatus(); }
  }
  public selectOff(preserveLayerIds?: Set<string>): void {
    if (this.selectedOutputId) this.releaseGlobalRoute(this.selectedOutputId, preserveLayerIds);
    this.selectedOutputId = null; this.preferredOutputId = null; this.outputExplicitlyOff = true;
  }
  /** Global routing changes must not silence explicit per-layer routes on the old port. */
  private releaseGlobalRoute(outputId: string, preserveLayerIds?: Set<string>): void {
    if (!preserveLayerIds?.size) { this.releaseNotesForOutput(outputId); return; }
    const owner = this.ownedPorts.get(outputId);
    if (!owner) return;
    const time = now(); this.prune(time);
    const cleared = this.clearQueue(owner.output);
    // These CCs belong to the global hardware modulation route. They must not
    // follow the old global output after a switch. Explicit notes stay put.
    this.pendingCC = this.pendingCC.filter(cc => cc.outputId !== outputId);
    for (const [id, note] of this.activeNotes) {
      if (note.outputId !== outputId) continue;
      if (preserveLayerIds.has(note.layerId)) {
        if (cleared) { try { this.sendNote(note, time); } catch { /* unplugged */ } }
      } else {
        if (note.onPerformanceTime <= time) { try { owner.output.send([0x80 | note.channel, note.note, 0]); } catch { /* unplugged */ } }
        this.activeNotes.delete(id);
      }
    }
  }
  public setMockMidiAccess(access: MIDIAccess): void { this.midiAccess = access; this.status = 'ready'; this.updateOutputsList(); }
  public setCallbacks(onDevices?: (devices: MidiDeviceOption[]) => void, onStatus?: (status: MidiSupportStatus, error: string | null) => void, onEvent?: (event: RecordedMidiEvent) => void): void {
    if (onDevices) this.onDevicesChanged = onDevices;
    if (onStatus) this.onStatusChanged = onStatus;
    if (onEvent) this.onEventRecorded = onEvent;
  }
  private own(output: MIDIOutput, channel: number): void {
    const owner = this.ownedPorts.get(output.id) ?? { output, channels: new Set<number>() };
    owner.channels.add(channel); this.ownedPorts.set(output.id, owner);
  }
  private prune(time: number): void {
    for (const [id, note] of this.activeNotes) if (note.offPerformanceTime <= time) this.activeNotes.delete(id);
    this.pendingCC = this.pendingCC.filter(cc => cc.time > time);
  }
  public getTimingMode(outputId?: string | null): 'timestamped' | 'timer' | 'off' {
    const output = this.getOutput(outputId);
    return !output ? 'off' : typeof (output as MIDIOutput & {clear?: () => void}).clear === 'function' ? 'timestamped' : 'timer';
  }
  private dispatch(output: MIDIOutput, bytes: number[], timestamp?: number): void {
    // Chromium currently omits MIDIOutput.clear(). Avoid its uncancellable
    // hardware queue: retain future events in cancellable app-owned timers.
    if (timestamp !== undefined && timestamp > now() && typeof (output as MIDIOutput & {clear?: () => void}).clear !== 'function') {
      if (!this.warnedTimerPorts.has(output.id)) {
        this.warnedTimerPorts.add(output.id);
        this.errorMessage = 'This output uses cancellable browser-timer MIDI scheduling. UI/background stalls can affect timing; Firefox provides cancellable timestamped scheduling.';
        this.notifyStatus();
      }
      const timers = this.softwareTimers.get(output.id) ?? new Set<ReturnType<typeof setTimeout>>();
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (timers.size === 0) this.softwareTimers.delete(output.id);
        try { output.send(bytes); } catch (error) {
          this.errorMessage = error instanceof Error ? error.message : 'MIDI timer send failed.'; this.notifyStatus();
        }
      }, Math.max(0, timestamp - now()));
      timers.add(timer); this.softwareTimers.set(output.id, timers);
    } else output.send(bytes, timestamp);
  }
  private clearQueue(output: MIDIOutput): boolean {
    for (const timer of this.softwareTimers.get(output.id) ?? []) clearTimeout(timer);
    this.softwareTimers.delete(output.id);
    const clear = (output as MIDIOutput & {clear?: () => void}).clear;
    if (typeof clear !== 'function') return true; // this port only has app-owned timers
    try { clear.call(output); return true; }
    catch (error) {
      this.errorMessage = error instanceof Error ? `MIDI cancellation: ${error.message}` : 'MIDI output queue could not be cleared.';
      this.notifyStatus(); return false;
    }
  }
  private sendNote(note: ScheduledMidiNote, time: number, includePastOn = false): void {
    if (note.onPerformanceTime > time || includePastOn) this.dispatch(note.output, [0x90 | note.channel, note.note, note.velocity], Math.max(time, note.onPerformanceTime));
    this.dispatch(note.output, [0x80 | note.channel, note.note, 0], Math.max(time, note.offPerformanceTime));
  }
  /** Same-port/channel/pitch overlaps retrigger: truncate the previous voice at
   * the new onset, then rebuild this app's queue so stale note-offs cannot kill it. */
  public scheduleNote(channel: number, note: number, velocity: number, onPerformanceTime: number, durationMs: number, layerId = 'unknown', outputId?: string | null): string | null {
    const output = this.getOutput(outputId);
    if (!output || ![channel, note, velocity, onPerformanceTime, durationMs].every(Number.isFinite)) return null;
    const time = now(); this.prune(time);
    const on = Math.max(time, onPerformanceTime);
    const scheduled: ScheduledMidiNote = {
      id: `${output.id}-${++this.noteCounter}`, output, outputId: output.id,
      channel: Math.round(Math.max(0, Math.min(15, channel - 1))), note: Math.round(Math.max(0, Math.min(127, note))),
      velocity: Math.round(Math.max(1, Math.min(127, velocity))), onPerformanceTime: on,
      offPerformanceTime: on + Math.max(10, durationMs), layerId,
    };
    const overlaps = [...this.activeNotes.values()].filter(n => n.outputId === output.id && n.channel === scheduled.channel && n.note === scheduled.note && n.offPerformanceTime > on && n.onPerformanceTime < scheduled.offPerformanceTime);
    try {
      this.own(output, scheduled.channel);
      if (overlaps.length) {
        // clear before modifying the app-owned queue; other browser apps have independent outputs.
        if (!this.clearQueue(output)) return null;
        for (const previous of overlaps) {
          if (previous.onPerformanceTime >= on) this.activeNotes.delete(previous.id);
          else previous.offPerformanceTime = on;
        }
        for (const previous of this.activeNotes.values()) if (previous.outputId === output.id) this.sendNote(previous, time);
        for (const cc of this.pendingCC) if (cc.outputId === output.id) this.dispatch(output, cc.bytes, cc.time);
      }
      this.sendNote(scheduled, time, true);
      this.activeNotes.set(scheduled.id, scheduled);
      this.recordEvent({ timestamp: Date.now(), type: 'noteOn', channel: scheduled.channel + 1, note: scheduled.note, velocity: scheduled.velocity, durationMs: scheduled.offPerformanceTime - on, layerId });
      return scheduled.id;
    } catch (error) {
      this.activeNotes.delete(scheduled.id);
      this.errorMessage = error instanceof Error ? error.message : 'MIDI send failed.';
      this.notifyStatus(); return null;
    }
  }
  public sendCC(channel: number, controller: number, value: number, sendTime?: number, outputId?: string | null): void {
    const output = this.getOutput(outputId);
    if (!output || ![channel, controller, value].every(Number.isFinite)) return;
    const ch = Math.round(Math.max(0, Math.min(15, channel - 1)));
    const bytes = [0xb0 | ch, Math.round(Math.max(0, Math.min(127, controller))), Math.round(Math.max(0, Math.min(127, value)))];
    try {
      this.own(output, ch);
      this.prune(now());
      this.dispatch(output, bytes, sendTime);
      if (sendTime !== undefined && sendTime > now()) this.pendingCC.push({ output, outputId: output.id, bytes, time: sendTime });
    } catch (error) { this.errorMessage = error instanceof Error ? error.message : 'MIDI CC send failed.'; this.notifyStatus(); }
  }
  public sendTestNote(): { success: boolean; portName?: string; error?: string } {
    const output = this.getOutput();
    if (!output) return { success: false, error: 'Kein MIDI-Ausgang aktiv oder ausgewählt.' };
    const time = now();
    const success = !!this.scheduleNote(1, 60, 100, time, 400, 'test') && !!this.scheduleNote(10, 36, 110, time, 400, 'test');
    return { success, portName: output.name ?? 'MIDI Port', error: success ? undefined : this.errorMessage ?? 'Senden fehlgeschlagen.' };
  }
  /** Cancel a layer without silencing other layers that share its MIDI port. */
  public releaseNotesForLayer(layerId: string): void {
    const time = now(); this.prune(time);
    const affected = [...this.activeNotes.values()].filter(note => note.layerId === layerId);
    const outputs = new Map(affected.map(note => [note.outputId, note.output]));
    for (const [outputId, output] of outputs) {
      const cleared = this.clearQueue(output);
      for (const note of affected) {
        if (note.outputId !== outputId) continue;
        // A queued note-on has never sounded; its note-off must not silence an
        // already-sounding voice from another layer with the same channel/pitch.
        if (note.onPerformanceTime <= time) {
          try { output.send([0x80 | note.channel, note.note, 0]); } catch { /* disconnected */ }
        }
        this.activeNotes.delete(note.id);
      }
      for (const note of this.activeNotes.values()) if (cleared && note.outputId === outputId) {
        try { this.sendNote(note, time); } catch { /* disconnected */ }
      }
      for (const cc of this.pendingCC) if (cleared && cc.outputId === outputId) {
        try { this.dispatch(output, cc.bytes, cc.time); } catch { /* disconnected */ }
      }
    }
  }
  /** Clear scheduled messages before sending immediate releases, only on owned channels. */
  public releaseNotesForOutput(outputId: string): void {
    const owner = this.ownedPorts.get(outputId);
    if (!owner) return;
    this.clearQueue(owner.output);
    for (const [id, note] of this.activeNotes) {
      if (note.outputId !== outputId) continue;
      try { note.output.send([0x80 | note.channel, note.note, 0]); } catch { /* unplugged devices cannot receive releases */ }
      this.activeNotes.delete(id);
    }
    for (const channel of owner.channels) {
      try {
        owner.output.send([0xb0 | channel, 64, 0]); // release sustain
        owner.output.send([0xb0 | channel, 120, 0]);
        owner.output.send([0xb0 | channel, 123, 0]);
      } catch { /* device may have been unplugged */ }
    }
    this.pendingCC = this.pendingCC.filter(cc => cc.outputId !== outputId);
    this.ownedPorts.delete(outputId);
  }
  public panic(): void { for (const id of [...this.ownedPorts.keys()]) this.releaseNotesForOutput(id); }
  private recordEvent(event: RecordedMidiEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > 256) this.eventHistory.shift();
    this.onEventRecorded?.(event);
  }
  public getRecentHistory(): RecordedMidiEvent[] { return [...this.eventHistory]; }
  public clearHistory(): void { this.eventHistory = []; }
  public getActiveNoteCount(): number { this.prune(now()); return this.activeNotes.size; }
}
