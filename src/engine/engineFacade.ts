// Unified Engine Facade: Coordinates Audio, Clock, MIDI, Generators, Mutation, and State

import {
  ProjectState,
  StepContext,
  RhythmAlgorithmType,
  AmbientAlgorithmType,
} from '../types';
import { MasterAudio } from './audio/audioContext';
import { EffectsRack } from './audio/effects';
import { DrumSynth } from './audio/drumSynth';
import { AmbientSynth } from './audio/ambientSynth';
import { AudioRecorder } from './audio/recorder';
import { MusicalClock } from './clock';
import { WebMidiManager } from './midi/webMidi';
import { MidiFileWriter, MidiTrackData, MidiNoteEvent } from './midi/midiWriter';
import { ModulationMatrix, ModulationSources } from './modulation/modMatrix';
import { BoundarySystem } from './mutation/boundarySystem';
import { HistoryManager } from './mutation/history';
import { IGenerator } from './generators/types';
import { EuclideanGenerator } from './generators/rhythm/euclidean';
import { ProbabilisticGenerator } from './generators/rhythm/probabilistic';
import { PolymetricGenerator } from './generators/rhythm/polymetric';
import { MarkovGenerator } from './generators/rhythm/markov';
import { DensityBurstGenerator } from './generators/rhythm/densityBurst';
import { HarmonicDroneGenerator } from './generators/ambient/harmonicDrone';
import { GranularDriftGenerator } from './generators/ambient/granularDrift';
import { PRESET_WARM_ANALOG_DRONE } from './presets/defaultPresets';

export class EngineFacade {
  private static instance: EngineFacade | null = null;
  public masterAudio: MasterAudio;
  public effectsRack!: EffectsRack;
  public drumSynth!: DrumSynth;
  public ambientSynth!: AmbientSynth;
  public recorder!: AudioRecorder;
  public clock!: MusicalClock;
  public midiManager: WebMidiManager;
  public modMatrix: ModulationMatrix;
  public boundarySystem: BoundarySystem;
  public historyManager: HistoryManager;

  public state: ProjectState;
  private generators: Map<string, IGenerator> = new Map();
  private stateChangeListeners: ((state: ProjectState) => void)[] = [];
  private stepListeners: ((step: number, bar: number) => void)[] = [];
  private isInitialized: boolean = false;

  // Real-time tracking for modulation sources
  private recentDrumTriggers: number[] = [];
  private lastAccentTime: number = 0;

  // MIDI Export Session Tracking (records active session for export)
  private sessionTracks: Map<string, MidiNoteEvent[]> = new Map();

  private constructor() {
    this.state = JSON.parse(JSON.stringify(PRESET_WARM_ANALOG_DRONE));
    this.masterAudio = MasterAudio.getInstance();
    this.midiManager = new WebMidiManager();
    this.modMatrix = new ModulationMatrix(this.state.modRoutes);
    this.boundarySystem = new BoundarySystem(this.state.seed);
    this.historyManager = new HistoryManager(this.state);
  }

  public static getInstance(): EngineFacade {
    if (!EngineFacade.instance) {
      EngineFacade.instance = new EngineFacade();
    }
    return EngineFacade.instance;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    // 1. Initialize Web Audio context
    const ctx = this.masterAudio.init();

    // 2. Setup Effects Rack connected to master gain
    this.effectsRack = new EffectsRack(ctx, this.masterAudio.masterGain!);

    // 3. Setup Synths connected to effects input
    this.drumSynth = new DrumSynth(ctx, this.effectsRack.inputNode);
    this.ambientSynth = new AmbientSynth(ctx, this.effectsRack.inputNode);

    // 4. Setup Audio Recorder
    this.recorder = new AudioRecorder(this.masterAudio.streamDest!);

    // 5. Setup Clock
    this.clock = new MusicalClock(ctx);
    this.clock.setBpm(this.state.bpm);
    this.clock.setSwing(this.state.swing);
    this.clock.setCallbacks(
      (stepCtx) => this.processStep(stepCtx),
      (step, bar) => this.dispatchTick(step, bar)
    );

    // 6. Initialize Web MIDI
    await this.midiManager.init();

    // 7. Instantiate Generators
    this.rebuildGenerators();

    this.isInitialized = true;
  }

  // Instantiates or updates generators from current layer configurations
  public rebuildGenerators(): void {
    this.generators.clear();
    this.state.layers.forEach((layer) => {
      const gen = this.createGenerator(layer.id, layer.algorithmType, layer.settings);
      if (gen) {
        this.generators.set(layer.id, gen);
      }
    });
  }

  private createGenerator(
    id: string,
    type: RhythmAlgorithmType | AmbientAlgorithmType,
    settings: any
  ): IGenerator | null {
    switch (type) {
      case 'euclidean':
        return new EuclideanGenerator(id, settings, this.state.seed);
      case 'probabilistic':
        return new ProbabilisticGenerator(id, settings, this.state.seed);
      case 'polymetric':
        return new PolymetricGenerator(id, settings, this.state.seed);
      case 'markov':
        return new MarkovGenerator(id, settings, this.state.seed);
      case 'densityBurst':
        return new DensityBurstGenerator(id, settings, this.state.seed);
      case 'harmonicDrone':
        return new HarmonicDroneGenerator(id, settings, this.state.seed);
      case 'granularDrift':
        return new GranularDriftGenerator(id, settings, this.state.seed);
      default:
        return null;
    }
  }

  // Main per-step audio and MIDI generation logic
  private processStep(context: StepContext): void {
    if (!this.isInitialized) return;

    // Check Solo state: if any layer is soloed, only play soloed layers
    const hasSolo = this.state.layers.some((l) => l.solo);

    // Process inter-engine modulation sources
    const now = this.masterAudio.getTime();
    this.recentDrumTriggers = this.recentDrumTriggers.filter((t) => now - t < 1.0); // within 1 sec
    const drumDensitySignal = Math.min(1.0, this.recentDrumTriggers.length / 8);
    const accentSignal = now - this.lastAccentTime < 0.2 ? 1.0 : 0.0;
    const brightnessSignal = (this.state.ambientParams.filterCutoff - 200) / 10000;

    const modSources: ModulationSources = {
      drumDensity: drumDensitySignal,
      rhythmicAccent: accentSignal,
      ambientBrightness: Math.max(0, Math.min(1, brightnessSignal)),
      globalChaos: this.state.globalEvolveActive ? 0.8 : 0.2,
    };

    const modOffsets = this.modMatrix.process(modSources);

    // Update dynamic effect parameters with modulation
    this.effectsRack.updateParams({
      ...this.state.effectsParams,
      delayFeedback: Math.max(0, Math.min(0.92, this.state.effectsParams.delayFeedback + modOffsets.delayFeedbackOffset)),
      reverbMix: Math.max(0, Math.min(0.85, this.state.effectsParams.reverbMix + modOffsets.reverbMixOffset)),
    });

    // Check global continuous evolution
    if (this.state.globalEvolveActive && context.step % 16 === 0) {
      const bar = Math.floor(context.step / 16);
      if (bar % 2 === 0) {
        // Evolve gently every 2 bars
        this.evolve();
      }
    }

    // Process all active layers
    this.state.layers.forEach((layer) => {
      if (layer.muted) return;
      if (hasSolo && !layer.solo) return;

      const gen = this.generators.get(layer.id);
      if (!gen) return;

      const events = gen.generateStep(context);
      events.forEach((ev) => {
        const eventTime = context.time + ev.microOffset;
        const midiChannel = layer.midiChannel || 1;

        if (ev.type === 'drum' && layer.drumVoice) {
          const drumParams = this.state.drumParams[layer.drumVoice];
          const midiNote = drumParams.midiNote;

          // Track drum trigger for modulation
          this.recentDrumTriggers.push(now);
          if (ev.velocity > 115) {
            this.lastAccentTime = now;
          }

          // 1. Synthesize Native Web Audio
          switch (layer.drumVoice) {
            case 'kick':
              this.drumSynth.triggerKick(eventTime, ev.velocity, drumParams);
              break;
            case 'snare':
              this.drumSynth.triggerSnare(eventTime, ev.velocity, drumParams);
              break;
            case 'hihat':
              this.drumSynth.triggerHiHat(eventTime, ev.velocity, drumParams);
              break;
            case 'perc':
              this.drumSynth.triggerPerc(eventTime, ev.velocity, drumParams);
              break;
          }

          // 2. Transmit Web MIDI
          const durationMs = Math.round(ev.duration * 1000);
          this.midiManager.sendNoteOn(midiChannel, midiNote, ev.velocity, durationMs, layer.id);

          // 3. Record to Session MIDI Tracks
          this.recordSessionNote(layer.id, context.step, midiNote, ev.velocity, 120, midiChannel);
        } else if (ev.type === 'note') {
          // Ambient Synthesizer voice
          const ambParams = {
            ...this.state.ambientParams,
            filterCutoff: Math.max(
              40,
              Math.min(18000, this.state.ambientParams.filterCutoff + modOffsets.ambientCutoffOffset)
            ),
          };

          // 1. Synthesize Native Web Audio
          this.ambientSynth.triggerNote(
            eventTime,
            ev.midiNote,
            ev.velocity,
            ev.duration,
            ambParams
          );

          // 2. Transmit Web MIDI
          const durationMs = Math.round(ev.duration * 1000);
          this.midiManager.sendNoteOn(midiChannel, ev.midiNote, ev.velocity, durationMs, layer.id);

          // 3. Record to Session MIDI Tracks
          const durationTicks = Math.round(ev.duration * (context.bpm / 60) * 480);
          this.recordSessionNote(layer.id, context.step, ev.midiNote, ev.velocity, durationTicks, midiChannel);
        }
      });
    });
  }

  private recordSessionNote(
    layerId: string,
    step: number,
    note: number,
    velocity: number,
    durationTicks: number,
    channel: number
  ): void {
    if (!this.sessionTracks.has(layerId)) {
      this.sessionTracks.set(layerId, []);
    }
    const ticksPer16th = 120; // 480 / 4
    const startTicks = step * ticksPer16th;

    const notes = this.sessionTracks.get(layerId)!;
    notes.push({
      startTicks,
      durationTicks,
      note,
      velocity,
      channel: channel - 1,
    });

    // Keep session notes bounded to prevent memory growth
    if (notes.length > 512) {
      notes.shift();
    }
  }

  // --- Transport Controls ---
  public togglePlay(): boolean {
    if (!this.clock) return false;
    if (this.clock.getIsRunning()) {
      this.clock.stop();
      this.ambientSynth.stopAllVoices();
      this.midiManager.emergencyPanic();
    } else {
      this.clock.start();
    }
    this.notifyState();
    return this.clock.getIsRunning();
  }

  public stop(): void {
    if (this.clock) {
      this.clock.stop();
      this.clock.reset();
    }
    if (this.ambientSynth) {
      this.ambientSynth.stopAllVoices();
    }
    if (this.midiManager) {
      this.midiManager.emergencyPanic();
    }
    this.notifyState();
  }

  public setBpm(bpm: number): void {
    this.state.bpm = bpm;
    if (this.clock) this.clock.setBpm(bpm);
    this.notifyState();
  }

  public setSwing(swing: number): void {
    this.state.swing = swing;
    if (this.clock) this.clock.setSwing(swing);
    this.notifyState();
  }

  // --- Macro Controls ---
  public setMacroValue(macroId: string, value: number): void {
    const macro = this.state.macros.find((m) => m.id === macroId);
    if (!macro) return;

    macro.value = Math.max(0, Math.min(1, value));

    macro.mappings.forEach((mapping) => {
      const targetVal = mapping.min + macro.value * (mapping.max - mapping.min);
      const [category, param] = mapping.target.split('.');

      if (category === 'ambient' && param in this.state.ambientParams) {
        (this.state.ambientParams as any)[param] = targetVal;
      } else if (category === 'effects' && param in this.state.effectsParams) {
        (this.state.effectsParams as any)[param] = targetVal;
        this.effectsRack.updateParams(this.state.effectsParams);
      } else if (category === 'layers' && param === 'density') {
        this.state.layers.forEach((layer) => {
          if (layer.settings.density !== undefined) {
            layer.settings.density = targetVal;
          }
          if (layer.settings.baseDensity !== undefined) {
            layer.settings.baseDensity = targetVal;
          }
        });
      }
    });

    this.notifyState();
  }

  // --- Bounded Mutation Operations ---
  public mutate(intensity: number = 0.5): void {
    this.historyManager.pushState('Mutate', this.state);
    const nextState = this.boundarySystem.mutateProject(this.state, intensity);
    this.state = nextState;
    this.rebuildGenerators();
    this.notifyState();
  }

  public evolve(): void {
    const nextState = this.boundarySystem.evolveStep(this.state, this.state.globalEvolveRate);
    this.state = nextState;
    this.rebuildGenerators();
    this.notifyState();
  }

  public regenerate(): void {
    this.historyManager.pushState('Regenerate All', this.state);
    this.generators.forEach((gen) => gen.regenerate());
    // Sync settings back to layers
    this.state.layers.forEach((layer) => {
      const gen = this.generators.get(layer.id);
      if (gen) {
        layer.settings = gen.getSettings();
      }
    });
    this.notifyState();
  }

  public regenerateLayer(layerId: string): void {
    const layer = this.state.layers.find((l) => l.id === layerId);
    const gen = this.generators.get(layerId);
    if (layer && gen) {
      this.historyManager.pushState(`Regenerate ${layer.name}`, this.state);
      gen.regenerate();
      layer.settings = gen.getSettings();
      this.notifyState();
    }
  }

  public toggleLayerMute(layerId: string): void {
    const layer = this.state.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.muted = !layer.muted;
      this.notifyState();
    }
  }

  public toggleLayerSolo(layerId: string): void {
    const layer = this.state.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.solo = !layer.solo;
      this.notifyState();
    }
  }

  public toggleLayerLock(layerId: string): void {
    const layer = this.state.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.locked = !layer.locked;
      this.notifyState();
    }
  }

  public toggleLayerFreeze(layerId: string): void {
    const layer = this.state.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.frozen = !layer.frozen;
      this.notifyState();
    }
  }

  public setLayerAlgorithm(layerId: string, algorithmType: RhythmAlgorithmType | AmbientAlgorithmType): void {
    const layer = this.state.layers.find((l) => l.id === layerId);
    if (layer) {
      this.historyManager.pushState(`Switch Algorithm: ${layer.name}`, this.state);
      layer.algorithmType = algorithmType;
      // Rebuild specific generator
      const newGen = this.createGenerator(layer.id, algorithmType, {});
      if (newGen) {
        layer.settings = newGen.getSettings();
        this.generators.set(layer.id, newGen);
      }
      this.notifyState();
    }
  }

  public undo(): boolean {
    const prevState = this.historyManager.undo();
    if (prevState) {
      this.state = prevState;
      this.rebuildGenerators();
      this.clock.setBpm(this.state.bpm);
      this.clock.setSwing(this.state.swing);
      this.notifyState();
      return true;
    }
    return false;
  }

  public redo(): boolean {
    const nextState = this.historyManager.redo();
    if (nextState) {
      this.state = nextState;
      this.rebuildGenerators();
      this.clock.setBpm(this.state.bpm);
      this.clock.setSwing(this.state.swing);
      this.notifyState();
      return true;
    }
    return false;
  }

  public loadPreset(preset: ProjectState): void {
    this.historyManager.pushState(`Load Preset: ${preset.name}`, this.state);
    this.state = JSON.parse(JSON.stringify(preset));
    this.rebuildGenerators();
    if (this.clock) {
      this.clock.setBpm(this.state.bpm);
      this.clock.setSwing(this.state.swing);
    }
    if (this.effectsRack) {
      this.effectsRack.updateParams(this.state.effectsParams);
    }
    this.notifyState();
  }

  // --- MIDI File (.mid) Export ---
  public exportMidiFile(layerId?: string): Uint8Array {
    const tracks: MidiTrackData[] = [];
    const writer = new MidiFileWriter(480);

    if (layerId) {
      // Single Layer Export
      const layer = this.state.layers.find((l) => l.id === layerId);
      const notes = this.sessionTracks.get(layerId) || [];
      tracks.push({
        name: layer ? layer.name : 'Layer Export',
        channel: (layer?.midiChannel || 1) - 1,
        notes,
      });
    } else {
      // Multitrack Export
      this.state.layers.forEach((layer) => {
        const notes = this.sessionTracks.get(layer.id) || [];
        tracks.push({
          name: layer.name,
          channel: (layer.midiChannel || 1) - 1,
          notes,
        });
      });
    }

    return writer.createMidiFile(this.state.bpm, tracks);
  }

  // --- Subscriptions ---
  public onStateChange(listener: (state: ProjectState) => void): () => void {
    this.stateChangeListeners.push(listener);
    listener(this.state);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter((l) => l !== listener);
    };
  }

  public onStepTick(listener: (step: number, bar: number) => void): () => void {
    this.stepListeners.push(listener);
    return () => {
      this.stepListeners = this.stepListeners.filter((l) => l !== listener);
    };
  }

  private notifyState(): void {
    this.stateChangeListeners.forEach((l) => l(this.state));
  }

  private dispatchTick(step: number, bar: number): void {
    this.stepListeners.forEach((l) => l(step, bar));
  }
}
