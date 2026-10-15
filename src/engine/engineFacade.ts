// Unified Engine Facade: High-Precision Orchestrator for Audio, Clock, MIDI, Generators, Mutation & State

import {
  ProjectState,
  StepContext,
  MusicalEvent,
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
import { MidiFileWriter, MidiTrackData, MidiNoteEvent, TempoEvent } from './midi/midiWriter';
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
import { PRNG } from './prng';

export class EngineFacade {
  private static instance: EngineFacade | null = null;
  public masterAudio: MasterAudio;
  public effectsRack: EffectsRack | null = null;
  public drumSynth: DrumSynth | null = null;
  public ambientSynth: AmbientSynth | null = null;
  public recorder: AudioRecorder;
  public clock: MusicalClock;
  public midiManager: WebMidiManager;
  public modMatrix: ModulationMatrix;
  public boundarySystem: BoundarySystem;
  public historyManager: HistoryManager;

  public state: ProjectState;
  private generators: Map<string, IGenerator> = new Map();
  private masterPrng: PRNG;
  private stateChangeListeners: ((state: ProjectState) => void)[] = [];
  private stepListeners: ((step: number, bar: number) => void)[] = [];
  private eventListeners: ((event: MusicalEvent) => void)[] = [];
  public isAudioInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  // Real-time modulation tracking
  private recentDrumTriggers: number[] = [];
  private lastAccentTime: number = 0;

  // Authoritative Captured Session Events with Common Origin
  private capturedEvents: MusicalEvent[] = [];
  private captureStartStep: number = 0;
  public getCaptureStartStep(): number { return this.captureStartStep; }
  private isCapturing: boolean = true;
  private maxCaptureEvents: number = 2048;

  // DeepMind CC Rate Limiting
  private lastDeepMindCCTimestamp: number = 0;

  private constructor() {
    this.state = JSON.parse(JSON.stringify(PRESET_WARM_ANALOG_DRONE));
    this.masterAudio = MasterAudio.getInstance();
    this.midiManager = new WebMidiManager();
    this.modMatrix = new ModulationMatrix(this.state.modRoutes);
    this.masterPrng = new PRNG(this.state.seed);
    this.boundarySystem = new BoundarySystem(this.state.seed);
    this.historyManager = new HistoryManager(this.state);

    // Eagerly construct recorder with lazy getters so UI can subscribe before user clicks Play
    this.recorder = new AudioRecorder(
      () => this.masterAudio.streamDest,
      () => this.masterAudio.ctx,
      () => this.masterAudio.analyser
    );

    // Create dummy clock with AudioContext reference available on init
    this.clock = new MusicalClock({
      currentTime: 0,
      state: 'suspended',
      resume: () => Promise.resolve(),
    } as any);

    // Pre-instantiate initial generators
    this.rebuildGenerators();
  }

  public static getInstance(): EngineFacade {
    if (!EngineFacade.instance) {
      EngineFacade.instance = new EngineFacade();
    }
    return EngineFacade.instance;
  }

  // Idempotent initialization separating native audio from optional MIDI permissions
  public async init(requestMidi: boolean = true): Promise<void> {
    if (this.isAudioInitialized) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      // 1. Initialize native Web Audio context
      const ctx = await this.masterAudio.init();

      // 2. Setup Effects Rack connected to master gain
      this.effectsRack = new EffectsRack(ctx, this.masterAudio.masterGain!);

      // 3. Setup Synths connected to effects input
      this.drumSynth = new DrumSynth(ctx, this.effectsRack.inputNode);
      this.ambientSynth = new AmbientSynth(ctx, this.effectsRack.inputNode);

      // 4. Setup Musical Clock
      this.clock = new MusicalClock(ctx);
      this.clock.setBpm(this.state.bpm);
      this.clock.setSwing(this.state.swing);
      this.clock.setCallbacks(
        (stepCtx) => this.processStep(stepCtx),
        (step, bar) => this.dispatchTick(step, bar)
      );

      // 5. Apply current effects parameters
      this.effectsRack.updateParams(this.state.effectsParams);

      this.isAudioInitialized = true;

      // 6. Optional MIDI initialization (non-blocking, does not fail audio if denied)
      if (requestMidi) {
        this.midiManager.init().catch(() => {});
      }
    })();

    return this.initPromise;
  }

  public isReady(): boolean {
    return this.isAudioInitialized;
  }

  // Instantiates generators with stable independent random streams per layer
  public rebuildGenerators(): void {
    this.generators.clear();
    this.state.layers.forEach((layer, idx) => {
      const layerPrng = this.masterPrng.fork(idx);
      const gen = this.createGenerator(layer.id, layer.algorithmType, layer.settings, layerPrng.getSeed());
      if (gen) {
        this.generators.set(layer.id, gen);
      }
    });
  }

  public createGenerator(
    id: string,
    type: RhythmAlgorithmType | AmbientAlgorithmType,
    settings: any,
    seed: number = 42
  ): IGenerator | null {
    switch (type) {
      case 'euclidean':
        return new EuclideanGenerator(id, settings, seed);
      case 'probabilistic':
        return new ProbabilisticGenerator(id, settings, seed);
      case 'polymetric':
        return new PolymetricGenerator(id, settings, seed);
      case 'markov':
        return new MarkovGenerator(id, settings, seed);
      case 'densityBurst':
        return new DensityBurstGenerator(id, settings, seed);
      case 'harmonicDrone':
        return new HarmonicDroneGenerator(id, settings, seed);
      case 'granularDrift':
        return new GranularDriftGenerator(id, settings, seed);
      default:
        return null;
    }
  }

  // Core audio and MIDI processing loop for each step
  public processStep(context: StepContext): void {
    if (!this.isAudioInitialized) return;

    const hasSolo = this.state.layers.some((l) => l.solo);
    const nowAudioTime = this.masterAudio.getTime();

    // 1. Process inter-engine cross-modulation
    this.recentDrumTriggers = this.recentDrumTriggers.filter((t) => nowAudioTime - t < 1.0);
    const drumDensitySignal = Math.min(1.0, this.recentDrumTriggers.length / 8.0);
    const accentSignal = nowAudioTime - this.lastAccentTime < 0.2 ? 1.0 : 0.0;
    const brightnessSignal = (this.state.ambientParams.filterCutoff - 100.0) / 10000.0;

    const modSources: ModulationSources = {
      drumDensity: drumDensitySignal,
      rhythmicAccent: accentSignal,
      ambientBrightness: Math.max(0, Math.min(1, brightnessSignal)),
      globalChaos: this.state.globalEvolveActive ? 0.75 : 0.2,
    };

    const modOffsets = this.modMatrix.process(modSources);

    // 2. Update dynamic effects with modulation
    if (this.effectsRack) {
      this.effectsRack.updateParams({
        ...this.state.effectsParams,
        delayFeedback: Math.max(
          0,
          Math.min(0.92, this.state.effectsParams.delayFeedback + modOffsets.delayFeedbackOffset)
        ),
        reverbMix: Math.max(
          0,
          Math.min(0.85, this.state.effectsParams.reverbMix + modOffsets.reverbMixOffset)
        ),
      });
    }

    // 3. Global evolution every 2 bars if active
    if (this.state.globalEvolveActive && context.subStep === 0 && context.bar % 2 === 0 && context.bar > 0) {
      this.evolve();
    }

    // 4. Process all active layers
    this.state.layers.forEach((layer) => {
      if (layer.muted) return;
      if (hasSolo && !layer.solo) return;

      const gen = this.generators.get(layer.id);
      if (!gen) return;

      const events = gen.generateStep(context);

      events.forEach((rawEv) => {
        // Compute authoritative timings:
        // audioTime = context.time + swingOffset + microOffset
        // performanceTime = context.perfTime + (swingOffset + microOffset) * 1000
        const audioTime = context.time + (rawEv.microOffset || 0);
        const perfTime = context.perfTime + (rawEv.microOffset || 0) * 1000;
        const midiChannel = layer.midiChannel || 1;
        const noteDuration = Math.max(0.04, rawEv.duration);

        if (rawEv.type === 'drum' && layer.drumVoice && this.drumSynth) {
          const drumParams = this.state.drumParams[layer.drumVoice];
          const midiNote = drumParams.midiNote;

          this.recentDrumTriggers.push(nowAudioTime);
          if (rawEv.velocity > 115) {
            this.lastAccentTime = nowAudioTime;
          }

          // Authoritative Musical Event
          const musicalEvent: MusicalEvent = {
            id: `ev_${context.step}_${layer.id}_${Math.random().toString(36).substring(2, 6)}`,
            layerId: layer.id,
            type: 'drum',
            drumType: layer.drumVoice,
            midiNote,
            frequency: drumParams.pitch,
            velocity: rawEv.velocity,
            duration: noteDuration,
            audioTime,
            performanceTime: perfTime,
            channel: midiChannel,
            step: context.step,
            subStep: context.subStep,
            bar: context.bar,
            swingOffsetSec: context.swingOffset,
            microOffsetSec: rawEv.microOffset || 0,
          };

          // 1. Synthesize Native Web Audio
          switch (layer.drumVoice) {
            case 'kick':
              this.drumSynth.triggerKick(audioTime, rawEv.velocity, drumParams, layer.volume);
              break;
            case 'snare':
              this.drumSynth.triggerSnare(audioTime, rawEv.velocity, drumParams, layer.volume);
              break;
            case 'hihat':
              this.drumSynth.triggerHiHat(audioTime, rawEv.velocity, drumParams, layer.volume);
              break;
            case 'perc':
              this.drumSynth.triggerPerc(audioTime, rawEv.velocity, drumParams, layer.volume);
              break;
          }

          // 2. Schedule Hardware-Timestamped Web MIDI
          const durationMs = Math.round(noteDuration * 1000);
          this.midiManager.scheduleNote(
            midiChannel,
            midiNote,
            rawEv.velocity,
            perfTime,
            durationMs,
            layer.id
          );

          // 3. Record in Authoritative Capture Buffer & notify listeners
          this.recordMusicalEvent(musicalEvent);

        } else if (rawEv.type === 'note' && this.ambientSynth) {
          const modulatedCutoff = Math.max(
            30,
            Math.min(18000, this.state.ambientParams.filterCutoff + modOffsets.ambientCutoffOffset)
          );
          const ambParams = {
            ...this.state.ambientParams,
            filterCutoff: modulatedCutoff,
          };

          const musicalEvent: MusicalEvent = {
            id: `ev_${context.step}_${layer.id}_${Math.random().toString(36).substring(2, 6)}`,
            layerId: layer.id,
            type: 'note',
            midiNote: rawEv.midiNote,
            frequency: AmbientSynth.midiToFreq(rawEv.midiNote),
            velocity: rawEv.velocity,
            duration: noteDuration,
            audioTime,
            performanceTime: perfTime,
            channel: midiChannel,
            step: context.step,
            subStep: context.subStep,
            bar: context.bar,
            swingOffsetSec: context.swingOffset,
            microOffsetSec: rawEv.microOffset || 0,
          };

          // 1. Synthesize Native Web Audio with audible layer volume
          this.ambientSynth.triggerNote(
            audioTime,
            rawEv.midiNote,
            rawEv.velocity,
            noteDuration,
            ambParams,
            layer.volume
          );

          // 2. Schedule Hardware-Timestamped Web MIDI
          const durationMs = Math.round(noteDuration * 1000);
          this.midiManager.scheduleNote(
            midiChannel,
            rawEv.midiNote,
            rawEv.velocity,
            perfTime,
            durationMs,
            layer.id
          );

          // 3. Record in Authoritative Capture Buffer
          this.recordMusicalEvent(musicalEvent);
        }
      });
    });

    // 5. DeepMind 6 Hardware CC Transmission (if enabled)
    if (this.state.deepMindEnabled && context.subStep === 0) {
      this.sendDeepMindAutomation();
    }
  }

  private recordMusicalEvent(event: MusicalEvent): void {
    if (this.isCapturing) {
      this.capturedEvents.push(event);
      if (this.capturedEvents.length > this.maxCaptureEvents) {
        this.capturedEvents.shift();
      }
    }
    this.eventListeners.forEach((l) => l(event));
  }

  // Rate-limited DeepMind 6 CC automation transmission
  private sendDeepMindAutomation(): void {
    const now = Date.now();
    if (now - this.lastDeepMindCCTimestamp < 50) return; // rate limit 20 msgs/sec
    this.lastDeepMindCCTimestamp = now;

    // Send Cutoff (CC 29) modulated by ambient filter cutoff
    const cutoffCc = Math.max(0, Math.min(127, Math.round((this.state.ambientParams.filterCutoff / 10000) * 127)));
    this.midiManager.sendCC(this.state.deepMindChannel, 29, cutoffCc);

    // Send Resonance (CC 30)
    const resCc = Math.max(0, Math.min(127, Math.round((this.state.ambientParams.filterResonance / 12) * 127)));
    this.midiManager.sendCC(this.state.deepMindChannel, 30, resCc);
  }

  // --- Transport Controls ---
  public togglePlay(): boolean {
    if (!this.clock) return false;
    if (this.clock.getIsRunning()) {
      this.stop();
      return false;
    } else {
      this.effectsRack?.updateParams(this.state.effectsParams);
      this.clock.start();
      this.notifyState();
      return true;
    }
  }

  // Unified Stop: stops generation, silences active voices, panics MIDI notes
  public stop(): void {
    if (this.clock) {
      this.clock.stop();
      this.clock.reset();
    }
    if (this.ambientSynth) {
      this.ambientSynth.stopAllVoices();
    }
    if (this.midiManager) {
      this.midiManager.panic();
    }
    this.notifyState();
  }

  // Unified Panic: stops generation, cancels scheduled notes, sends CC 123/120, kills effect tails
  public panic(): void {
    this.stop();
    if (this.effectsRack) {
      this.effectsRack.killTail();
    }
  }

  public setBpm(bpm: number): void {
    this.state.bpm = Math.max(20, Math.min(300, bpm));
    if (this.clock) this.clock.setBpm(this.state.bpm);
    this.notifyState();
  }

  public setSwing(swing: number): void {
    this.state.swing = Math.max(0, Math.min(0.75, swing));
    if (this.clock) this.clock.setSwing(this.state.swing);
    this.notifyState();
  }

  // --- Explicit Validated Updates (replaces mutate(0)) ---
  public updateDrumParam(voice: 'kick' | 'snare' | 'hihat' | 'perc', param: string, value: number): void {
    if (voice in this.state.drumParams && param in (this.state.drumParams as any)[voice]) {
      (this.state.drumParams[voice] as any)[param] = value;
      this.notifyState();
    }
  }

  public updateAmbientParam(param: string, value: any): void {
    if (param in this.state.ambientParams) {
      (this.state.ambientParams as any)[param] = value;
      // If scale or root note changed, sync to HarmonicDroneGenerator
      if (param === 'rootNote' || param === 'scale') {
        const droneLayer = this.state.layers.find((l) => l.algorithmType === 'harmonicDrone');
        if (droneLayer) {
          droneLayer.settings.rootNote = this.state.ambientParams.rootNote;
          droneLayer.settings.scale = this.state.ambientParams.scale;
          const gen = this.generators.get(droneLayer.id);
          if (gen) {
            gen.setSettings({ rootNote: this.state.ambientParams.rootNote, scale: this.state.ambientParams.scale });
          }
        }
      }
      this.notifyState();
    }
  }

  public updateEffectsParam(param: string, value: number): void {
    if (param in this.state.effectsParams) {
      (this.state.effectsParams as any)[param] = value;
      if (this.effectsRack) {
        this.effectsRack.updateParams(this.state.effectsParams);
      }
      this.notifyState();
    }
  }

  public updateLayerSetting(layerId: string, param: string, value: any): void {
    const layer = this.state.layers.find((l) => l.id === layerId);
    if (!layer) return;

    layer.settings[param] = value;
    const gen = this.generators.get(layerId);
    if (gen) {
      gen.setSettings({ [param]: value });
    }
    this.notifyState();
  }

  public setMacroValue(macroId: string, value: number): void {
    const macro = this.state.macros.find((m) => m.id === macroId);
    if (!macro) return;

    macro.value = Math.max(0, Math.min(1, value));

    macro.mappings.forEach((mapping) => {
      const targetVal = mapping.min + macro.value * (mapping.max - mapping.min);
      const [category, param] = mapping.target.split('.');

      if (category === 'ambient') {
        this.updateAmbientParam(param, targetVal);
      } else if (category === 'effects') {
        this.updateEffectsParam(param, targetVal);
      } else if (category === 'layers' && param === 'density') {
        // Sync density to layers AND their active generators
        this.state.layers.forEach((layer) => {
          if (layer.settings.density !== undefined) {
            layer.settings.density = targetVal;
            const gen = this.generators.get(layer.id);
            if (gen) gen.setSettings({ density: targetVal });
          }
          if (layer.settings.baseDensity !== undefined) {
            layer.settings.baseDensity = targetVal;
            const gen = this.generators.get(layer.id);
            if (gen) gen.setSettings({ baseDensity: targetVal });
          }
        });
      }
    });

    this.notifyState();
  }

  // --- Bounded Randomness Operations ---
  public mutate(intensity: number = 0.5): void {
    this.historyManager.pushState('Mutate', this.state);
    const nextState = this.boundarySystem.mutateProject(this.state, intensity);
    this.applyState(nextState, false);
    this.historyManager.pushState('Mutate', this.state);
  }

  public evolve(): void {
    const nextState = this.boundarySystem.evolveStep(this.state, this.state.globalEvolveRate);
    this.applyState(nextState, false); // update active generator settings without restarting their streams
    this.historyManager.pushState('Evolve', this.state);
  }

  public regenerate(): void {
    this.historyManager.pushState('Regenerate All', this.state);
    this.generators.forEach((gen, layerId) => {
      const layer = this.state.layers.find((l) => l.id === layerId);
      // Strictly respect layer freeze & lock
      if (layer && !layer.frozen && !layer.locked) {
        gen.regenerate();
        layer.settings = gen.getSettings();
      }
    });
    this.historyManager.pushState('Regenerate All', this.state);
    this.notifyState();
  }

  public regenerateLayer(layerId: string): void {
    const layer = this.state.layers.find((l) => l.id === layerId);
    const gen = this.generators.get(layerId);
    if (layer && gen && !layer.frozen && !layer.locked) {
      this.historyManager.pushState(`Regenerate ${layer.name}`, this.state);
      gen.regenerate();
      layer.settings = gen.getSettings();
      this.historyManager.pushState(`Regenerate ${layer.name}`, this.state);
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
      // Compatibility guard: do not assign drum algo to ambient layer or vice-versa
      const isAmbientAlgo = algorithmType === 'harmonicDrone' || algorithmType === 'granularDrift';
      const isDrumLayer = layer.type === 'drum';
      if ((isDrumLayer && isAmbientAlgo) || (!isDrumLayer && !isAmbientAlgo)) {
        console.warn(`Cannot assign ${algorithmType} to ${layer.type} layer.`);
        return;
      }

      this.historyManager.pushState(`Switch Algorithm: ${layer.name}`, this.state);
      layer.algorithmType = algorithmType;
      const newGen = this.createGenerator(layer.id, algorithmType, {});
      if (newGen) {
        layer.settings = newGen.getSettings();
        this.generators.set(layer.id, newGen);
      }
      this.historyManager.pushState(`Switch Algorithm: ${layer.name}`, this.state);
      this.notifyState();
    }
  }

  public setLayerSetting(layerId: string, key: string, value: any): void {
    const layer = this.state.layers.find((l) => l.id === layerId);
    if (!layer) return;
    layer.settings[key] = value;
    const gen = this.generators.get(layerId);
    if (gen) {
      gen.setSettings({ [key]: value });
    }
    this.notifyState();
  }

  // Auditions a single sound event in isolation (for playground or audition preview)
  public auditionSound(type: 'drum' | 'note', voiceOrNote: string | number, velocity: number = 100): void {
    if (!this.isAudioInitialized) {
      this.init(false);
    }
    const now = this.masterAudio.getTime();
    if (type === 'drum' && this.drumSynth) {
      const drumVoice = voiceOrNote as any;
      const params = this.state.drumParams[drumVoice as keyof typeof this.state.drumParams] || this.state.drumParams.kick;
      switch (drumVoice) {
        case 'kick':
          this.drumSynth.triggerKick(now, velocity, params, 0.9);
          break;
        case 'snare':
          this.drumSynth.triggerSnare(now, velocity, params, 0.9);
          break;
        case 'hihat':
          this.drumSynth.triggerHiHat(now, velocity, params, 0.9);
          break;
        case 'perc':
          this.drumSynth.triggerPerc(now, velocity, params, 0.9);
          break;
      }
    } else if (type === 'note' && this.ambientSynth) {
      const note = typeof voiceOrNote === 'number' ? voiceOrNote : 60;
      this.ambientSynth.triggerNote(
        now,
        note,
        velocity,
        1.5,
        this.state.ambientParams,
        0.8
      );
    }
  }

  public undo(): boolean {
    const prevState = this.historyManager.undo();
    if (prevState) {
      this.applyState(prevState);
      return true;
    }
    return false;
  }

  public redo(): boolean {
    const nextState = this.historyManager.redo();
    if (nextState) {
      this.applyState(nextState);
      return true;
    }
    return false;
  }

  public loadPreset(preset: ProjectState): void {
    this.historyManager.pushState(`Load Preset: ${preset.name}`, this.state);
    this.applyState(preset);
    this.historyManager.pushState(`Load Preset: ${preset.name}`, this.state);
  }

  private applyState(newState: ProjectState, rebuild = true): void {
    const previous = this.state;
    this.state = JSON.parse(JSON.stringify(newState));
    if (rebuild || previous.seed !== this.state.seed) {
      this.masterPrng = new PRNG(this.state.seed);
      this.boundarySystem = new BoundarySystem(this.state.seed);
      this.rebuildGenerators();
    } else {
      for (const id of this.generators.keys()) if (!this.state.layers.some(layer => layer.id === id)) this.generators.delete(id);
      for (const layer of this.state.layers) {
        const oldLayer = previous.layers.find(old => old.id === layer.id);
        const existing = this.generators.get(layer.id);
        if (existing && oldLayer?.algorithmType === layer.algorithmType) existing.setSettings(layer.settings);
        else {
          const created = this.createGenerator(layer.id, layer.algorithmType, layer.settings, this.state.seed);
          if (created) this.generators.set(layer.id, created);
        }
      }
    }
    if (JSON.stringify(previous.modRoutes) !== JSON.stringify(this.state.modRoutes) || rebuild) this.modMatrix = new ModulationMatrix(this.state.modRoutes);
    this.clock.setBpm(this.state.bpm); this.clock.setSwing(this.state.swing);
    this.effectsRack?.updateParams(this.state.effectsParams);
    this.notifyState();
  }

  // --- Capture & Standard MIDI File Export ---
  public clearCapture(): void {
    this.capturedEvents = [];
    this.captureStartStep = this.clock ? this.clock.getCurrentStep() : 0;
  }

  public getCapturedEvents(): MusicalEvent[] {
    return [...this.capturedEvents];
  }

  // Generates Type 1 Standard MIDI file with accurate tick offsets preserving swing and microtiming
  public exportMidiFile(layerId?: string, lastNBars?: number): Uint8Array {
    let events = [...this.capturedEvents];

    if (events.length === 0) {
      // Fallback: generate a clean 4-bar take from current active generators
      events = this.generateOfflineTake(4);
    }

    if (lastNBars && lastNBars > 0) {
      const maxBar = Math.max(...events.map((e) => e.bar));
      const minBar = Math.max(0, maxBar - lastNBars + 1);
      events = events.filter((e) => e.bar >= minBar);
    }

    if (layerId) {
      events = events.filter((e) => e.layerId === layerId);
    }

    // Common origin: align earliest step to tick 0
    const minStep = events.length > 0 ? Math.min(...events.map((e) => e.step)) : 0;

    const tracksMap: Map<string, MidiNoteEvent[]> = new Map();

    events.forEach((ev) => {
      if (!tracksMap.has(ev.layerId)) {
        tracksMap.set(ev.layerId, []);
      }

      // Exact tick calculation preserving swing and microtiming:
      // 1 16th note = 120 ticks at 480 PPQ
      const stepOffset = ev.step - minStep;
      const baseTick = stepOffset * 120;
      const microTicks = Math.round(((ev.swingOffsetSec || 0) + (ev.microOffsetSec || 0)) * (this.state.bpm / 60) * 480);
      const startTicks = Math.max(0, baseTick + microTicks);
      const durationTicks = Math.max(20, Math.round(ev.duration * (this.state.bpm / 60) * 480));

      tracksMap.get(ev.layerId)!.push({
        startTicks,
        durationTicks,
        note: ev.midiNote,
        velocity: ev.velocity,
        channel: Math.max(0, Math.min(15, ev.channel - 1)),
      });
    });

    const tracks: MidiTrackData[] = [];
    tracksMap.forEach((notes, lId) => {
      const layer = this.state.layers.find((l) => l.id === lId);
      tracks.push({
        name: layer ? layer.name : 'Track',
        channel: layer ? Math.max(0, Math.min(15, layer.midiChannel - 1)) : 0,
        notes,
      });
    });

    const writer = new MidiFileWriter(480);
    const tempoChanges: TempoEvent[] = [{ tick: 0, bpm: this.state.bpm }];
    return writer.createMidiFile(this.state.bpm, tracks, tempoChanges);
  }

  // Generates offline synthetic take for export if user hasn't played in realtime yet
  private generateOfflineTake(bars: number = 4): MusicalEvent[] {
    const offlineEvents: MusicalEvent[] = [];
    const totalSteps = bars * 16;
    const baseCtx: StepContext = {
      step: 0,
      subStep: 0,
      beat: 0,
      bar: 0,
      time: 0,
      perfTime: 0,
      bpm: this.state.bpm,
      swing: this.state.swing,
      swingOffset: 0,
    };

    for (let s = 0; s < totalSteps; s++) {
      const subStep = s % 16;
      const bar = Math.floor(s / 16);
      const beat = Math.floor(subStep / 4);
      const ctx: StepContext = { ...baseCtx, step: s, subStep, bar, beat };

      this.state.layers.forEach((layer) => {
        if (layer.muted) return;
        const gen = this.generators.get(layer.id);
        if (!gen) return;

        const evs = gen.generateStep(ctx);
        evs.forEach((ev) => {
          const midiNote = ev.type === 'drum' && layer.drumVoice ? this.state.drumParams[layer.drumVoice].midiNote : ev.midiNote;
          offlineEvents.push({
            id: `off_${s}_${layer.id}`,
            layerId: layer.id,
            type: ev.type,
            midiNote,
            frequency: 440,
            velocity: ev.velocity,
            duration: ev.duration,
            audioTime: 0,
            performanceTime: 0,
            channel: layer.midiChannel || 1,
            step: s,
            subStep,
            bar,
            swingOffsetSec: 0,
            microOffsetSec: ev.microOffset || 0,
          });
        });
      });
    }

    return offlineEvents;
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

  public onMusicalEvent(listener: (event: MusicalEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== listener);
    };
  }

  private notifyState(): void {
    this.stateChangeListeners.forEach((l) => l(this.state));
  }

  private dispatchTick(step: number, bar: number): void {
    this.stepListeners.forEach((l) => l(step, bar));
  }
}
