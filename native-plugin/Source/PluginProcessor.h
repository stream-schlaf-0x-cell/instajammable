#pragma once

#include <atomic>
#include <cstdint>
#include <memory>
#include <vector>
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_audio_utils/juce_audio_utils.h>

struct OutgoingHostMidiItem {
  juce::MidiMessage message;
  double dueTimeMs = 0.0;
};

struct IncomingMidiEventItem {
  uint8_t status = 0;
  uint8_t data1 = 0;
  uint8_t data2 = 0;
};

struct HostTransportSnapshot {
  bool playing = false;
  bool recording = false;
  double bpm = 120.0;
  double ppqPosition = 0.0;
  int64_t bar = 0;
};

class InstajammableAudioProcessor final
    : public juce::AudioProcessor,
      private juce::MidiInputCallback {
 public:
  InstajammableAudioProcessor();
  ~InstajammableAudioProcessor() override;

  void prepareToPlay(double sampleRate, int samplesPerBlock) override;
  void releaseResources() override;

  bool isBusesLayoutSupported(const BusesLayout& layouts) const override;
  void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
  using AudioProcessor::processBlock;

  juce::AudioProcessorEditor* createEditor() override;
  bool hasEditor() const override;

  const juce::String getName() const override;

  bool acceptsMidi() const override;
  bool producesMidi() const override;
  bool isMidiEffect() const override;
  double getTailLengthSeconds() const override;

  int getNumPrograms() override;
  int getCurrentProgram() override;
  void setCurrentProgram(int index) override;
  const juce::String getProgramName(int index) override;
  void changeProgramName(int index, const juce::String& newName) override;

  void getStateInformation(juce::MemoryBlock& destData) override;
  void setStateInformation(const void* data, int sizeInBytes) override;

  // Bridge hooks called from PluginEditor / WebBrowserComponent
  void queueMidiFromJs(const juce::String& portId,
                       const std::vector<uint8_t>& bytes,
                       double delayMs);
  std::vector<IncomingMidiEventItem> popIncomingMidiEvents();
  bool consumeHostTransportIfChanged(HostTransportSnapshot& outSnapshot);
  void pushAudioPcmFromJs(const juce::String& base64Float32, double jsSampleRate);

  void setSessionStateJson(const juce::String& json);
  juce::String getSessionStateJson() const;
  bool peekPendingStateLoadForJs(juce::String& outJson) const;
  void clearPendingStateLoadForJs();
  void requestStatePushToJsIfNonEmpty();

 private:
  void handleIncomingMidiMessage(juce::MidiInput* source,
                                 const juce::MidiMessage& message) override;

  std::unique_ptr<juce::MidiOutput> virtualMidiOut;
  std::unique_ptr<juce::MidiInput> virtualMidiIn;

  juce::SpinLock hostMidiOutLock;
  std::vector<OutgoingHostMidiItem> hostMidiOutQueue;

  juce::SpinLock incomingMidiLock;
  std::vector<IncomingMidiEventItem> incomingMidiQueue;

  std::atomic<bool> hostPlaying{false};
  std::atomic<bool> hostRecording{false};
  std::atomic<double> hostBpm{120.0};
  std::atomic<double> hostPpq{0.0};
  std::atomic<int64_t> hostBar{0};
  std::atomic<bool> transportDirty{false};

  double currentSampleRate = 44100.0;
  static constexpr int kPcmCapacityFrames = 65536;
  juce::AbstractFifo pcmFifo{kPcmCapacityFrames};
  std::vector<float> pcmRingLeft;
  std::vector<float> pcmRingRight;

  mutable juce::CriticalSection stateLock;
  juce::String sessionStateJson;
  std::atomic<bool> pendingStateLoadForJs{false};

  JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(InstajammableAudioProcessor)
};
