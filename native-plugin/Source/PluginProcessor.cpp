#include "PluginProcessor.h"
#include "PluginEditor.h"

InstajammableAudioProcessor::InstajammableAudioProcessor()
    : AudioProcessor(BusesProperties()
                         .withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      pcmRingLeft(kPcmCapacityFrames, 0.0f),
      pcmRingRight(kPcmCapacityFrames, 0.0f) {
  virtualMidiOut = juce::MidiOutput::createNewDevice("Instajammable VST3 Bus");
  if (virtualMidiOut) {
    virtualMidiOut->startBackgroundThread();
  }
  virtualMidiIn = juce::MidiInput::createNewDevice("Instajammable VST3 In", this);
  if (virtualMidiIn) {
    virtualMidiIn->start();
  }
}

InstajammableAudioProcessor::~InstajammableAudioProcessor() {
  if (virtualMidiIn) {
    virtualMidiIn->stop();
  }
  if (virtualMidiOut) {
    virtualMidiOut->stopBackgroundThread();
  }
}

const juce::String InstajammableAudioProcessor::getName() const {
  return JucePlugin_Name;
}

bool InstajammableAudioProcessor::acceptsMidi() const { return true; }
bool InstajammableAudioProcessor::producesMidi() const { return true; }
bool InstajammableAudioProcessor::isMidiEffect() const { return false; }
double InstajammableAudioProcessor::getTailLengthSeconds() const { return 0.0; }

int InstajammableAudioProcessor::getNumPrograms() { return 1; }
int InstajammableAudioProcessor::getCurrentProgram() { return 0; }
void InstajammableAudioProcessor::setCurrentProgram(int) {}
const juce::String InstajammableAudioProcessor::getProgramName(int) { return {}; }
void InstajammableAudioProcessor::changeProgramName(int, const juce::String&) {}

void InstajammableAudioProcessor::prepareToPlay(double sampleRate, int) {
  currentSampleRate = sampleRate > 0.0 ? sampleRate : 44100.0;
  pcmFifo.reset();
}

void InstajammableAudioProcessor::releaseResources() {
  pcmFifo.reset();
}

bool InstajammableAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const {
  if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono() &&
      layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo()) {
    return false;
  }
  return true;
}

void InstajammableAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer,
                                               juce::MidiBuffer& midiMessages) {
  juce::ScopedNoDenormals noDenormals;

  // 1. Read incoming DAW track MIDI notes for MIDI Input Follower
  if (!midiMessages.isEmpty()) {
    const juce::SpinLock::ScopedTryLockType lock(incomingMidiLock);
    if (lock.isLocked()) {
      for (const auto metadata : midiMessages) {
        const auto msg = metadata.getMessage();
        const auto* raw = msg.getRawData();
        const int sz = msg.getRawDataSize();
        if (sz >= 1) {
          IncomingMidiEventItem item;
          item.status = raw[0];
          item.data1 = sz >= 2 ? raw[1] : 0;
          item.data2 = sz >= 3 ? raw[2] : 0;
          if (incomingMidiQueue.size() < 512) {
            incomingMidiQueue.push_back(item);
          }
        }
      }
    }
    midiMessages.clear();
  }

  // 2. Poll DAW PlayHead transport
  if (auto* playHead = getPlayHead()) {
    if (auto pos = playHead->getPosition()) {
      const bool playing = pos->getIsPlaying();
      const bool recording = pos->getIsRecording();
      const double bpm = pos->getBpm().orFallback(hostBpm.load(std::memory_order_relaxed));
      const double ppq = pos->getPpqPosition().orFallback(0.0);
      int64_t bar = static_cast<int64_t>(std::floor(ppq / 4.0));
      if (auto barCount = pos->getBarCount()) {
        bar = *barCount;
      }
      if (playing != hostPlaying.load(std::memory_order_relaxed) ||
          recording != hostRecording.load(std::memory_order_relaxed) ||
          std::abs(bpm - hostBpm.load(std::memory_order_relaxed)) > 0.05) {
        hostPlaying.store(playing, std::memory_order_relaxed);
        hostRecording.store(recording, std::memory_order_relaxed);
        hostBpm.store(bpm, std::memory_order_relaxed);
        hostPpq.store(ppq, std::memory_order_relaxed);
        hostBar.store(bar, std::memory_order_relaxed);
        transportDirty.store(true, std::memory_order_release);
      } else {
        hostPpq.store(ppq, std::memory_order_relaxed);
        hostBar.store(bar, std::memory_order_relaxed);
      }
    }
  }

  // 3. Emit queued outgoing MIDI notes to VST3 host buffer
  const double nowMs = juce::Time::getMillisecondCounterHiRes();
  const int numSamples = buffer.getNumSamples();
  {
    const juce::SpinLock::ScopedTryLockType lock(hostMidiOutLock);
    if (lock.isLocked() && !hostMidiOutQueue.empty()) {
      std::vector<OutgoingHostMidiItem> remaining;
      remaining.reserve(hostMidiOutQueue.size());
      const double blockDurationMs = (numSamples * 1000.0) / currentSampleRate;
      for (const auto& item : hostMidiOutQueue) {
        if (item.dueTimeMs <= nowMs + blockDurationMs) {
          const double offsetMs = juce::jmax(0.0, item.dueTimeMs - nowMs);
          int samplePos = static_cast<int>(std::llround((offsetMs / 1000.0) * currentSampleRate));
          samplePos = juce::jlimit(0, juce::jmax(0, numSamples - 1), samplePos);
          midiMessages.addEvent(item.message, samplePos);
        } else {
          remaining.push_back(item);
        }
      }
      hostMidiOutQueue.swap(remaining);
    }
  }

  // 4. Drain PCM ring buffer streamed from WebAudio (internal synth in VST3 mode)
  buffer.clear();
  const int ready = pcmFifo.getNumReady();
  const int toRead = juce::jmin(ready, numSamples);
  if (toRead > 0) {
    const auto scope = pcmFifo.read(toRead);
    auto* left = buffer.getWritePointer(0);
    auto* right = buffer.getNumChannels() > 1 ? buffer.getWritePointer(1) : nullptr;
    if (scope.blockSize1 > 0) {
      std::copy_n(pcmRingLeft.data() + scope.startIndex1, scope.blockSize1, left);
      if (right) {
        std::copy_n(pcmRingRight.data() + scope.startIndex1, scope.blockSize1, right);
      }
    }
    if (scope.blockSize2 > 0) {
      std::copy_n(pcmRingLeft.data() + scope.startIndex2, scope.blockSize2, left + scope.blockSize1);
      if (right) {
        std::copy_n(pcmRingRight.data() + scope.startIndex2, scope.blockSize2, right + scope.blockSize1);
      }
    }
  }
}

void InstajammableAudioProcessor::handleIncomingMidiMessage(juce::MidiInput*,
                                                            const juce::MidiMessage& message) {
  const auto* raw = message.getRawData();
  const int sz = message.getRawDataSize();
  if (sz < 1) return;
  const juce::SpinLock::ScopedLockType lock(incomingMidiLock);
  if (incomingMidiQueue.size() < 512) {
    incomingMidiQueue.push_back({raw[0], sz >= 2 ? raw[1] : uint8_t{0}, sz >= 3 ? raw[2] : uint8_t{0}});
  }
}

void InstajammableAudioProcessor::queueMidiFromJs(const juce::String& portId,
                                                  const std::vector<uint8_t>& bytes,
                                                  double delayMs) {
  if (bytes.empty()) return;
  const juce::MidiMessage msg(bytes.data(), static_cast<int>(bytes.size()));
  const double clampedDelay = juce::jmax(0.0, delayMs);

  const bool sendVst3 = portId == "all-native" || portId == "vst3-host";
  const bool sendCoreMidi = portId == "all-native" || portId == "coremidi-bus";

  if (sendVst3) {
    const double dueMs = juce::Time::getMillisecondCounterHiRes() + clampedDelay;
    const juce::SpinLock::ScopedLockType lock(hostMidiOutLock);
    if (hostMidiOutQueue.size() < 2048) {
      hostMidiOutQueue.push_back({msg, dueMs});
    }
  }

  if (sendCoreMidi && virtualMidiOut) {
    if (clampedDelay <= 0.5) {
      virtualMidiOut->sendMessageNow(msg);
    } else {
      juce::MidiBuffer single;
      single.addEvent(msg, 0);
      virtualMidiOut->sendBlockOfMessages(
          single, juce::Time::getMillisecondCounterHiRes() + clampedDelay, 44100.0);
    }
  }
}

std::vector<IncomingMidiEventItem> InstajammableAudioProcessor::popIncomingMidiEvents() {
  const juce::SpinLock::ScopedLockType lock(incomingMidiLock);
  std::vector<IncomingMidiEventItem> result;
  result.swap(incomingMidiQueue);
  return result;
}

bool InstajammableAudioProcessor::consumeHostTransportIfChanged(HostTransportSnapshot& outSnapshot) {
  outSnapshot.playing = hostPlaying.load(std::memory_order_relaxed);
  outSnapshot.recording = hostRecording.load(std::memory_order_relaxed);
  outSnapshot.bpm = hostBpm.load(std::memory_order_relaxed);
  outSnapshot.ppqPosition = hostPpq.load(std::memory_order_relaxed);
  outSnapshot.bar = hostBar.load(std::memory_order_relaxed);
  return transportDirty.exchange(false, std::memory_order_acq_rel);
}

void InstajammableAudioProcessor::pushAudioPcmFromJs(const juce::String& base64Float32,
                                                       double jsSampleRate) {
  juce::MemoryOutputStream decoded;
  if (!juce::Base64::convertFromBase64(decoded, base64Float32)) return;
  const int totalFloats = static_cast<int>(decoded.getDataSize() / sizeof(float));
  const int inFrames = totalFloats / 2;
  if (inFrames <= 0) return;

  const auto* src = static_cast<const float*>(decoded.getData());
  const double ratio = (jsSampleRate > 0.0 && currentSampleRate > 0.0)
                           ? (jsSampleRate / currentSampleRate)
                           : 1.0;
  const int outFrames = ratio == 1.0 ? inFrames : static_cast<int>(std::floor(inFrames / ratio));
  if (outFrames <= 0) return;

  const int freeSpace = pcmFifo.getFreeSpace();
  const int toWrite = juce::jmin(outFrames, freeSpace);
  if (toWrite <= 0) return;

  const auto scope = pcmFifo.write(toWrite);
  auto writeFrame = [&](int ringIdx, int outIdx) {
    const double srcPos = outIdx * ratio;
    const int i0 = juce::jlimit(0, inFrames - 1, static_cast<int>(srcPos));
    const int i1 = juce::jlimit(0, inFrames - 1, i0 + 1);
    const float frac = static_cast<float>(srcPos - i0);
    pcmRingLeft[ringIdx] = src[i0 * 2] * (1.0f - frac) + src[i1 * 2] * frac;
    pcmRingRight[ringIdx] = src[i0 * 2 + 1] * (1.0f - frac) + src[i1 * 2 + 1] * frac;
  };

  for (int i = 0; i < scope.blockSize1; ++i) {
    writeFrame(scope.startIndex1 + i, i);
  }
  for (int i = 0; i < scope.blockSize2; ++i) {
    writeFrame(scope.startIndex2 + i, scope.blockSize1 + i);
  }
}

void InstajammableAudioProcessor::setSessionStateJson(const juce::String& json) {
  const juce::ScopedLock lock(stateLock);
  sessionStateJson = json;
}

juce::String InstajammableAudioProcessor::getSessionStateJson() const {
  const juce::ScopedLock lock(stateLock);
  return sessionStateJson;
}

bool InstajammableAudioProcessor::peekPendingStateLoadForJs(juce::String& outJson) const {
  if (!pendingStateLoadForJs.load(std::memory_order_acquire)) {
    return false;
  }
  const juce::ScopedLock lock(stateLock);
  outJson = sessionStateJson;
  return outJson.isNotEmpty();
}

void InstajammableAudioProcessor::clearPendingStateLoadForJs() {
  pendingStateLoadForJs.store(false, std::memory_order_release);
}

void InstajammableAudioProcessor::requestStatePushToJsIfNonEmpty() {
  const juce::ScopedLock lock(stateLock);
  if (sessionStateJson.isNotEmpty()) {
    pendingStateLoadForJs.store(true, std::memory_order_release);
  }
}

void InstajammableAudioProcessor::getStateInformation(juce::MemoryBlock& destData) {
  const juce::ScopedLock lock(stateLock);
  juce::MemoryOutputStream out(destData, false);
  out.writeString(sessionStateJson);
}

void InstajammableAudioProcessor::setStateInformation(const void* data, int sizeInBytes) {
  if (!data || sizeInBytes <= 0) return;
  juce::MemoryInputStream in(data, static_cast<size_t>(sizeInBytes), false);
  const auto restored = in.readString();
  if (restored.isNotEmpty()) {
    {
      const juce::ScopedLock lock(stateLock);
      sessionStateJson = restored;
    }
    pendingStateLoadForJs.store(true, std::memory_order_release);
  }
}

bool InstajammableAudioProcessor::hasEditor() const { return true; }

juce::AudioProcessorEditor* InstajammableAudioProcessor::createEditor() {
  return new InstajammableAudioProcessorEditor(*this);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() {
  return new InstajammableAudioProcessor();
}
