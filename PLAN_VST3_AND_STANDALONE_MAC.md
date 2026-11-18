# Technical Architecture & Build Plan: Instajammable VST3 + Standalone App (Intel Mac / Ableton Live 12 Standard)

> **Target Machine (Verified)**: Intel Mac (`x86_64`), macOS `13.7.8` (Build `22H730`), Apple Clang `14.0.3` (`/Library/Developer/CommandLineTools`), CMake `4.4.4` (`/usr/local/bin/cmake`), Node + npm installed.  
> **Target DAW**: Ableton Live 12 **Standard** (no Max for Live).  
> **Note**: Full Xcode.app (or at minimum Xcode Command Line Tools + `macosx` SDK + Metal/WebKit frameworks; full Xcode from App Store makes JUCE bundle signing & scheme testing effortless).

---

## 1. Framework & Strategy Decision: JUCE 8 + WebView (`juce::WebBrowserComponent`) + Native C++ Audio/MIDI Bridge

Why wrap the existing React/Vite/TypeScript engine in **JUCE 8** instead of Electron or rewriting all DSP in C++ immediately:
1. **Ableton Live 12 Standard Compatibility**: Electron builds standalone apps only — it cannot produce a VST3 plugin (`*.vst3`) or synchronize sample-accurately with `juce::AudioPlayHead` inside Ableton. JUCE 8 compiles the **same codebase** into both **`Instajammable.vst3`**, **`Instajammable.component` (AU)**, and **`Instajammable.app` (Standalone CoreAudio)**.
2. **100% UI & Generative Logic Preservation**: All 8 experimental visual layouts (Orbit, Synesthesia, Patchbay, Groovebox, Split, Stage, Grid, Console), presets, MIDI safety logic, and `JamComposer` stay in TypeScript/React bundled offline via `vite build` (`dist/`), hosted inside `juce::WebBrowserComponent` (macOS native `WKWebView`) with custom CMake `ResourceProvider` (zero localhost port needed, works offline, zero firewall prompts).
3. **Solved Ableton VST3 Multi-Channel Limitation**:
   - **Standard VST3 behavior in Ableton Live**: Ableton Live 12 accepts a VST3 instrument's internal MIDI output (`juce::MidiBuffer` in `processBlock`), *but* Live's track `MIDI From` chooser after a VST3 plugin typically merges or limits channel routing compared to separate hardware/IAC MIDI ports.
   - **Dual-Output Architecture (Best of Both Worlds)**:
     - **Path A (Direct VST3 `MidiBuffer` + Audio Bus)**: Emits sample-accurate MIDI into Ableton's VST3 host buffer (for recording 1 instrument track or single MIDI clip directly from the plugin) AND mixes the internal synth audio directly into Ableton's stereo VST3 audio output (Phase 2) without needing virtual audio cables.
     - **Path B (Built-in Native CoreMIDI Virtual Bus)**: When running on macOS inside Ableton 12 Standard, the VST3 C++ side opens a dedicated native virtual CoreMIDI device (`juce::MidiOutput::createNewDevice("Instajammable Bus")`). All 8 instruments keep their independent **Channels 1–8 + 10** natively inside the plugin — zero Safari/Firefox browser tabs, zero manual Audio-MIDI-Setup IAC clicking required — and Ableton 12 Standard receives `Ch 1..8, 10` on separate MIDI tracks cleanly alongside sample-accurate DAW transport sync (`juce::AudioPlayHead`).

---

## 2. Repository Structure (`native-plugin/`)

```text
/Users/studio/Desktop/gen music/
├── src/
│   └── native/
│       └── nativeBridge.ts        # Transport/MIDI/Audio/State bridge over window.__JUCE__
├── native-plugin/
│   ├── CMakeLists.txt             # JUCE 8 via FetchContent (VST3 + AU + Standalone, x86_64)
│   ├── Source/
│   │   ├── PluginProcessor.h/.cpp # AudioProcessor, AudioPlayHead sync, MidiBuffer + CoreMIDI virtual port, PCM ring buffer
│   │   ├── PluginEditor.h/.cpp    # juce::WebBrowserComponent (WKWebView) + ResourceProvider for dist/
│   │   ├── CoreMidiBridge.h/.cpp  # juce::MidiOutput::createNewDevice("Instajammable VST3")
│   │   └── PcmRingBuffer.h        # Lock-free SPSC ring buffer for WebAudio -> processBlock PCM audio
│   └── scripts/
│       └── build-mac.sh           # Runs npm run build -> embeds dist/ -> cmake x86_64 Release -> installs to ~/Library/Audio/Plug-Ins/VST3/
```

---

## 3. Technical Implementation Phases (Executable Self-Prompt)

### Phase 1: Native Bridge Adapter in TypeScript (`src/native/nativeBridge.ts` + `WebMidiManager`)
1. Detect native host via `const isJuceHost = Boolean((window as any).__JUCE__?.backend);`.
2. **MIDI Routing Abstraction**:
   - In `src/engine/midi/webMidi.ts`: when `isJuceHost` is true, bypass `navigator.requestMIDIAccess()` (note: WKWebView does not expose Web MIDI API!) and route `dispatch(output, bytes, timestamp)` directly via `window.__JUCE__.backend.emitEvent('midiOut', { portId, bytes, timestampMs })` to C++.
   - Expose two virtual ports to `WebMidiManager` in C++:
     - `'vst3-host'` (`"Ableton Host VST3 MIDI Out"`) — pushes into `processBlock` `juce::MidiBuffer`.
     - `'coremidi-bus'` (`"Instajammable Multichannel Bus (Ch 1-16)"`) — sends via native CoreMIDI virtual device created by `CoreMidiBridge`.
     - Hardware macOS MIDI ports (`juce::MidiOutput::getAvailableDevices()`) also selectable.
3. **Host Tempo & Transport Slave (`HostSync`)**:
   - Add optional `hostSyncEnabled` mode on `JamEngine`:
   - C++ `PluginProcessor::processBlock` reads `getPlayHead()->getPosition()`:
     - Extracts `bpm`, `isPlaying`, `isRecording`, `ppqPosition`.
     - On transition `stopped -> playing` (or `ppqPosition` rewind to `0`), notifies JS (`window.__JUCE__.backend.emitEvent('hostTransport', { playing: true, bpm, ppq: 0, restartBarOne: true })`).
     - Pushes clock/step cadence derived from DAW `ppqPosition` (or drives high-resolution C++ timer / AudioContext synced to DAW BPM).
   - **Benefit for Ableton Recording**: Pressing Record + Play inside Ableton 12 automatically starts `JamEngine` cleanly on beat `1.1.1` in exact tempo lock with Ableton!

### Phase 2: JUCE 8 CMake Plugin Target (`native-plugin/CMakeLists.txt`)
1. Fetch JUCE `8.0.x` via CMake `FetchContent`:
   ```cmake
   cmake_minimum_required(VERSION 3.22)
   project(Instajammable VERSION 2.0.0)
   set(CMAKE_CXX_STANDARD 20)
   set(CMAKE_OSX_ARCHITECTURES "x86_64") # User's Intel Mac (expand to "x86_64;arm64" later if desired)
   set(CMAKE_OSX_DEPLOYMENT_TARGET "13.0")

   FetchContent_Declare(JUCE GIT_REPOSITORY https://github.com/juce-framework/JUCE.git GIT_TAG 8.0.6)
   FetchContent_MakeAvailable(JUCE)

   juce_add_plugin(Instajammable
     COMPANY_NAME "Atem Studio"
     PLUGIN_MANUFACTURER_CODE AtSt
     PLUGIN_CODE Ijmb
     FORMATS VST3 AU Standalone
     PRODUCT_NAME "Instajammable"
     IS_SYNTH TRUE
     NEEDS_MIDI_INPUT TRUE
     PRODUCES_MIDI_OUTPUT TRUE
     IS_MIDI_EFFECT FALSE
     NEEDS_WEB_BROWSER TRUE)
   ```
2. Package `dist/` via `juce_add_binary_data(InstajammableWebAssets SOURCES ...)` (generated from a CMake helper globbing `dist/` or zip-in-memory `juce::ZipFile`) and serve MIME-typed `.html`, `.js`, `.css` inside `WebBrowserComponent::Options().withResourceProvider(...)` + `JUCE_WEB_BROWSER=1`.
3. Configure C++ -> JS native functions via `juce::WebBrowserComponent::Options::withNativeFunction(...)`:
   - `sendMidi(channel, bytesArray, delayMs)`
   - `getMidiOutputs()`
   - `setStateSnapshot(jsonString)` -> stored in `lastSessionJson` for DAW `.als` project save.

### Phase 3: Ableton Project Recall (`getStateInformation` / `setStateInformation`)
1. Whenever `JamEngine` notifies state changes (`subscribe` debounced at ~500 ms), call JS -> C++ `updateSessionSnapshot(JSON.stringify(engine.saveSession()))`.
2. In `PluginProcessor::getStateInformation(MemoryBlock& destData)`: serialize `lastSessionJson` cleanly with header tag + UTF-8 JSON.
3. In `PluginProcessor::setStateInformation(const void* data, int sizeInBytes)`: restore `lastSessionJson`, emit `'restoreSession'` event once `WebBrowserComponent` signals ready -> `engine.loadSession(JSON.parse(json))`. Saving the Ableton Live Set `.als` preserves every scene, octave, rhythm, channel, and custom macro automatically!

### Phase 4: Internal Audio inside VST3 (`processBlock` PCM Bridge) — Optional vs Pure CoreAudio/MIDI
- **Step 4A (Standalone App + MIDI-Generator VST3 first)**:
  - Standalone `Instajammable.app` plays internal WebAudio directly through macOS CoreAudio + CoreMIDI with zero extra DSP work.
  - VST3 MIDI-Generator mode runs all 8 channels out to Ableton Xpand!2 / Serum / Diva / Drum Rack tracks.
- **Step 4B (Internal Synth Audio inside Ableton VST3 Track)**:
  - Insert a lightweight `AudioWorkletNode` tap in `MasterAudio` (`src/engine/audio/audioContext.ts`) before `ctx.destination` that streams interleaved Float32 stereo frames across JS -> C++ via shared message / `WebBrowserComponent` binary event (or JUCE AudioProcessor C++ DSP port for zero-latency offline bounce).
  - *Best Practice Note*: For Ableton Offline Render / Freeze (`Export Audio`), real-time `WKWebView` JS scheduling runs asynchronously from offline `processBlock` callbacks. Add a deterministic **Lookahead/Step Render Mode** (either via `OfflineAudioContext` pre-render per bar or gradual C++ port of `AmbientSynth`/`DrumSynth` in Phase 5) if Ableton **Freeze Track / Offline Bounce** is needed; real-time **Bounce via Resampling / Track Record** works immediately.

### Phase 5: Build & Install Pipeline for Intel Mac (`native-plugin/scripts/build-mac.sh`)
```bash
npm run build
cmake -B native-plugin/build -G "Unix Makefiles" -DCMAKE_BUILD_TYPE=Release
cmake --build native-plugin/build -j$(sysctl -n hw.ncpu)
```
Artifacts installed to:
- `~/Library/Audio/Plug-Ins/VST3/Instajammable.vst3` (scanned directly by Ableton Live 12 Standard)
- `~/Library/Audio/Plug-Ins/Components/Instajammable.component` (Audio Unit)
- `~/Applications/Instajammable.app` (Standalone Desktop App)

Note on macOS Gatekeeper / Code Signing: local ad-hoc signing (`codesign --force --deep --sign - ~/Library/Audio/Plug-Ins/VST3/Instajammable.vst3`) allows immediate loading on the local Intel Mac without a Paid Apple Developer ID.

---

## 4. Prerequisites Checklist Before Execution
1. Install full **Xcode** (or verify `WebKit.framework` & `AudioToolbox.framework` link cleanly via `/Library/Developer/CommandLineTools` — tested at start of Phase 2 build).
2. Confirm GitHub access to clone `juce-framework/JUCE` during CMake `FetchContent`.
3. Verify Ableton Live 12 Standard VST3 Custom Folder (`~/Library/Audio/Plug-Ins/VST3`) is enabled in **Voreinstellungen → Plug-Ins**.
