#include "PluginEditor.h"
#include "EmbeddedWebAssets.h"

namespace {
std::optional<juce::WebBrowserComponent::Resource> serveEmbeddedResource(const juce::String& url) {
  const auto* asset = instajammable_assets::findEmbeddedAsset(url);
  if (!asset) return std::nullopt;
  juce::WebBrowserComponent::Resource resource;
  resource.data.resize(asset->size);
  const auto* srcBytes = reinterpret_cast<const std::byte*>(asset->data);
  std::copy(srcBytes, srcBytes + asset->size, resource.data.begin());
  resource.mimeType = asset->mimeType;
  return resource;
}
} // namespace

InstajammableAudioProcessorEditor::InstajammableAudioProcessorEditor(InstajammableAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p) {
  const bool isVst3 = processorRef.wrapperType == juce::AudioProcessor::wrapperType_VST3;
  const juce::String initScript =
      "window.__INSTAJAMMABLE_NATIVE__ = true;"
      "window.__INSTAJAMMABLE_IS_VST3__ = " +
      juce::String(isVst3 ? "true;" : "false;");

  auto options =
      juce::WebBrowserComponent::Options{}
          .withNativeIntegrationEnabled()
          .withUserScript(initScript)
          .withResourceProvider(
              [](const juce::String& url) { return serveEmbeddedResource(url); })
          .withEventListener("__instajammable_midi_out",
                             [this](const juce::var& payload) {
                               const auto portId = payload["portId"].toString();
                               const double delayMs = static_cast<double>(payload["delayMs"]);
                               std::vector<uint8_t> bytes;
                               if (const auto* arr = payload["bytes"].getArray()) {
                                 bytes.reserve(static_cast<size_t>(arr->size()));
                                 for (const auto& v : *arr) {
                                   bytes.push_back(static_cast<uint8_t>(static_cast<int>(v) & 0xff));
                                 }
                               }
                               processorRef.queueMidiFromJs(portId, bytes, delayMs);
                             })
          .withEventListener("__instajammable_state_save",
                             [this](const juce::var& payload) {
                               const auto json = payload["json"].toString();
                               if (json.isNotEmpty()) {
                                 processorRef.setSessionStateJson(json);
                               }
                             })
          .withEventListener("__instajammable_pcm_out",
                             [this](const juce::var& payload) {
                               const auto b64 = payload["data"].toString();
                               const double sr = static_cast<double>(payload["sampleRate"]);
                               if (b64.isNotEmpty()) {
                                 processorRef.pushAudioPcmFromJs(b64, sr);
                               }
                             });

  webView = std::make_unique<juce::WebBrowserComponent>(options);
  addAndMakeVisible(*webView);
  webView->goToURL(juce::WebBrowserComponent::getResourceProviderRoot());

  setResizable(true, true);
  setResizeLimits(960, 620, 2560, 1600);
  setSize(1340, 860);

  processorRef.requestStatePushToJsIfNonEmpty();
  startTimerHz(60);
}

InstajammableAudioProcessorEditor::~InstajammableAudioProcessorEditor() {
  stopTimer();
}

void InstajammableAudioProcessorEditor::paint(juce::Graphics& g) {
  g.fillAll(juce::Colour(0xff0b0f17));
}

void InstajammableAudioProcessorEditor::resized() {
  if (webView) {
    webView->setBounds(getLocalBounds());
  }
}

void InstajammableAudioProcessorEditor::pushSavedStateIfReady() {
  juce::String restoredJson;
  if (!processorRef.peekPendingStateLoadForJs(restoredJson)) return;
  const auto escaped = juce::JSON::toString(juce::var(restoredJson));
  juce::Component::SafePointer<InstajammableAudioProcessorEditor> safeThis(this);
  webView->evaluateJavascript(
      "(function(){ if (typeof window.__instajammableOnHostLoadState === 'function') { "
      "window.__instajammableOnHostLoadState(" +
          escaped +
          "); return true; } return false; })();",
      [safeThis](juce::WebBrowserComponent::EvaluationResult result) {
        if (safeThis == nullptr) return;
        if (const auto* val = result.getResult(); val != nullptr && static_cast<bool>(*val)) {
          safeThis->processorRef.clearPendingStateLoadForJs();
        }
      });
}

void InstajammableAudioProcessorEditor::timerCallback() {
  if (!webView) return;

  if (warmupTicks < 20) {
    ++warmupTicks;
  } else if (warmupTicks % 10 == 0) {
    ++warmupTicks;
    pushSavedStateIfReady();
  } else {
    ++warmupTicks;
  }

  HostTransportSnapshot tr;
  if (processorRef.consumeHostTransportIfChanged(tr)) {
    juce::DynamicObject::Ptr obj = new juce::DynamicObject();
    obj->setProperty("playing", tr.playing);
    obj->setProperty("recording", tr.recording);
    obj->setProperty("bpm", tr.bpm);
    obj->setProperty("ppqPosition", tr.ppqPosition);
    obj->setProperty("bar", static_cast<juce::int64>(tr.bar));
    const auto json = juce::JSON::toString(juce::var(obj.get()));
    webView->evaluateJavascript(
        "if (window.__instajammableOnHostTransport) { window.__instajammableOnHostTransport(" +
        json + "); }");
  }

  auto midiEvents = processorRef.popIncomingMidiEvents();
  if (!midiEvents.empty()) {
    juce::Array<juce::var> arr;
    arr.ensureStorageAllocated(static_cast<int>(midiEvents.size()));
    for (const auto& ev : midiEvents) {
      juce::DynamicObject::Ptr item = new juce::DynamicObject();
      item->setProperty("status", static_cast<int>(ev.status));
      item->setProperty("data1", static_cast<int>(ev.data1));
      item->setProperty("data2", static_cast<int>(ev.data2));
      arr.add(juce::var(item.get()));
    }
    const auto json = juce::JSON::toString(juce::var(arr));
    webView->evaluateJavascript(
        "if (window.__instajammableOnHostMidi) { window.__instajammableOnHostMidi(" + json +
        "); }");
  }
}
