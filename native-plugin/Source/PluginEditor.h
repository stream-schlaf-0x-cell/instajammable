#pragma once

#include <memory>
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_gui_extra/juce_gui_extra.h>
#include "PluginProcessor.h"

class InstajammableAudioProcessorEditor final
    : public juce::AudioProcessorEditor,
      private juce::Timer {
 public:
  explicit InstajammableAudioProcessorEditor(InstajammableAudioProcessor&);
  ~InstajammableAudioProcessorEditor() override;

  void paint(juce::Graphics&) override;
  void resized() override;

 private:
  void timerCallback() override;
  void pushSavedStateIfReady();

  InstajammableAudioProcessor& processorRef;
  std::unique_ptr<juce::WebBrowserComponent> webView;
  int warmupTicks = 0;

  JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(InstajammableAudioProcessorEditor)
};
