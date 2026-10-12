# ECHO GARDEN — Autonomous Generative Music Laboratory

**ECHO GARDEN** is a lightweight, real-time computational generative instrument and experimental laboratory designed for discovering, manipulating, evolving, and capturing complex musical systems.

Engineered for responsive, low-CPU operation on macOS (including vintage Intel hardware like the 2014 MacBook Pro), it features built-in analog-style Web Audio synthesis (audible standalone without external DAWs) and seamless real-time Web MIDI integration with **Ableton Live 12 Standard** and external synthesizers such as the **Behringer DeepMind 6**.

---

## 1. Quickstart

### Start the Application
```bash
# Install dependencies (already completed)
npm install

# Start local laboratory server
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in Google Chrome.

### Run Verification Test Suite
```bash
npm test
```
Executes 22 automated unit and integration tests across PRNG determinism, all 5 rhythm algorithms, modal harmonic quantization, bounded mutation constraints, undo/redo history, inter-engine modulation, and binary Standard MIDI File (.mid) generation.

---

## 2. Core Capabilities

### A. Sound Synthesis (Standalone Audible Operation)
Generates audio independently with no plugins required:
- **Kick Drum Voice**: Dual-stage sine pitch envelope with rapid transient click, sub-bass sustain, and saturation.
- **Snare Drum Voice**: Resonant dual-tone body oscillator blended with filtered white noise and snappy decay.
- **Hi-Hat Voice**: Inharmonic metallic frequency cluster with resonant bandpass filtering and variable decay.
- **Percussion / Woodblock / Rim Voice**: Inharmonic FM synthesis pair producing organic clicks and bells.
- **Ambient Drone & Pad Synthesizer**: 6-voice polyphonic detuned multi-oscillator architecture (Sawtooth, Triangle, Sine + Sub-bass) with cascading 24dB resonant lowpass filter, analog pitch drift, and long ADSR envelopes (up to 15s release tails).
- **Master Effects & Protection**:
  - Stereo Ping-Pong Tape Delay with cross-feedback, damping filter, and wow/flutter drift.
  - Algorithmic Diffusion Reverb based on a 4-comb + 2-allpass prime delay network.
  - Master Dynamics Limiter & Analog Soft-Saturation shaper to guarantee zero digital clipping or ear fatigue.
  - Live Audio Recorder: Captures sessions directly to high-quality audio files (`.webm`).

### B. Generative Rhythm Engines
Each drum layer can be independently assigned to any of 5 distinct algorithms:
1. **Euclidean Rhythm (Bjorklund Algorithm)**: Mathematical distribution of $k$ pulses across $n$ steps with phase rotation (Afro-Cuban, Balkan, and African polyrhythms).
2. **Weighted Probabilistic Sequencer**: Individual 16-step trigger probabilities, metric accents, ghost notes, and microtiming swing/jitter.
3. **Polymetric & Polyrhythmic Engine**: Odd-meter loop lengths (e.g. 5, 7, 11 steps) shifting against the 4/4 grid to create evolving, hypnotic long-period cycles.
4. **Markov Transition Matrix**: 4-state probabilistic transition machine (Rest $\rightarrow$ Hit $\rightarrow$ Accent $\rightarrow$ Ghost) conditioned on metric downbeats.
5. **Stochastic Density & Burst Engine**: Poisson-style event clustering and spacious silence inspired by IDM, glitch, and natural water droplets.

### C. Generative Ambient Engines
- **Harmonic Drone & Voice Leading**: Modal scale quantization (Dorian, Phrygian, Lydian, Aeolian, Major Pentatonic, Minor Pentatonic, Hirajoshi, Microtonal) with gentle chord inversions and voice-leading transitions over user-defined bars.
- **Granular Drift Cloud**: Microtonal harmonic grains floating organically around selectable center registers.

### D. Bounded Randomness & Mutation System
- **Parameter Boundaries**: Every musical and synthesis parameter specifies `[min, max]` permitted limits, mutation probability, mutation magnitude, and lock status.
- **Mutate**: Instant controlled shift within boundaries.
- **Evolve**: Gradual continuous drift every 2 bars.
- **Freeze**: Protect individual layers from all mutation.
- **Lock**: Permanently protect specific parameters from global mutations.
- **Regenerate**: Re-roll parameters using deterministic PRNG seeds (Mulberry32).
- **Unlimited Undo/Redo**: Full state history tree to recall any moment.

### E. Inter-Engine Cross-Modulation Matrix
Dynamic bi-directional influence between rhythm and ambient engines:
- **Drum Density** $\rightarrow$ Modulates Ambient Filter Cutoff (+3000 Hz dynamic sweep).
- **Rhythmic Accents** $\rightarrow$ Dynamically ducks/excites Reverb Send.
- **Ambient Brightness** $\rightarrow$ Influences Percussion Fill Probability.
- **Global Chaos Index** $\rightarrow$ Modulates Delay Feedback.

---

## 3. Ableton Live 12 Standard Integration

### Step 1: Enable macOS IAC Virtual MIDI Driver
1. Open Spotlight (`Cmd + Space`), type **Audio MIDI Setup**, and press Enter.
2. In the top menu, select **Window → Show MIDI Studio** (or `Cmd + 2`).
3. Double-click the red **IAC Driver** icon.
4. Check the box **"Device is online"**.
5. Ensure a port named **"Bus 1"** is listed. Click **Apply**.
6. In ECHO GARDEN's header bar, select **"IAC Driver Bus 1"** from the MIDI dropdown.

### Step 2: Configure Ableton Live 12 Preferences
1. Open Ableton Live 12 and open Preferences (`Cmd + ,`).
2. Navigate to **Link / Tempo / MIDI**.
3. Under **MIDI Inputs**, find **IAC Driver (Bus 1)**:
   - Set **Track** = `ON`
   - Set **Remote** = `ON`

### Step 3: Track Routing in Ableton
- **Track 1 (Drums)**: Set **MIDI From** to `IAC Driver (Bus 1)`, Channel `10`. Set **Monitor** to `In`. Drop an Ableton Drum Rack or **AIR Xpand!2** (preset: Drums & Percussion).
- **Track 2 (Keys / Harmonies)**: Set **MIDI From** to `IAC Driver (Bus 1)`, Channel `2`. Set **Monitor** to `In`. Drop **AIR Essential Keyboards**.
- **Track 3 (Drone / Pad)**: Set **MIDI From** to `IAC Driver (Bus 1)`, Channel `1`. Set **Monitor** to `In`. Drop **AIR Hype** or route directly to **Behringer DeepMind 6**.
- **Return A (Effects)**: Insert **Valhalla Supermassive** for expansive ambient reverb tails.

### Step 4: Standard MIDI File (.mid) Export
Click the **Bookmark / Memory** icon in ECHO GARDEN to download:
- **Full Multitrack Session (.mid)**: Formatted as Standard MIDI File Type 1 with exact tempo metadata, notes, velocities, and lengths. Drag directly into Ableton's Arrangement view.
- **Individual Stems (.mid)**: Isolate Kick, Snare, Hats, Perc, or Drone stems.

---

## 4. Behringer DeepMind 6 Hardware Integration

Connect your DeepMind 6 via USB or Scarlett MIDI Out:
- **MIDI Channel**: Set to Channel 1.
- **Pre-mapped Control Changes (CC)**:
  - `CC 74`: Analog VCF Cutoff Frequency
  - `CC 71`: Analog VCF Resonance (Q)
  - `CC 73`: VCF Envelope Depth
  - `CC 75`: VCF LFO Modulation Depth
  - `CC 79`: VCA Envelope Decay Time
  - `CC 72`: VCA Envelope Release Time
  - `CC 1`: Mod Wheel / Vibrato LFO Depth

---

## 5. Adding New Generative Algorithms

ECHO GARDEN is designed for effortless algorithmic expansion. To add a new generator:

1. Create a class implementing the `IGenerator` interface in `src/engine/generators/`:
```typescript
import { IGenerator, GeneratedEvent } from './types';
import { StepContext, ParameterBoundary } from '../../types';

export class MyCustomGenerator implements IGenerator {
  public id: string;
  public name = 'My Custom Algorithm';
  public description = 'Explains how the algorithm creates musical structure';

  constructor(id: string, initialSettings?: any, seed?: number) { ... }

  public generateStep(context: StepContext): GeneratedEvent[] {
    // Generate events for context.step (0-15)
    return [];
  }

  public mutate(boundaries: Record<string, ParameterBoundary>, intensity: number): void { ... }
  public regenerate(): void { ... }
  public getSettings(): Record<string, any> { ... }
  public setSettings(settings: Record<string, any>): void { ... }
}
```
2. Register the algorithm in `src/engine/engineFacade.ts` under `createGenerator()`.
3. Add the algorithm definition to `PlaygroundView.tsx` for immediate A/B auditioning.

---

## 6. Architecture & Resource Performance

- **Lookahead Audio Scheduler**: Decouples audio from the main UI thread using a 25ms timer scanning a 100ms `AudioContext.currentTime` window (Chris Wilson Web Audio Clock model). Timing remains rock-solid even during heavy DOM operations.
- **Intel 2014 MBP CPU Optimization**: Dynamic voice stealing, low-overhead biquad filter nodes, lightweight analytical math, and canvas rendering capped at requestAnimationFrame. Zero CPU-intensive AI inference models.
- **Emergency Safety**: Global Panic button sends All Notes Off (CC 123) and All Sound Off (CC 120) across all 16 MIDI channels simultaneously.
