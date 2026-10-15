import { AmbientSynth } from '../audio/ambientSynth';
import { DrumSynth } from '../audio/drumSynth';
import { EffectsRack } from '../audio/effects';
import { PRNG } from '../prng';
import { ambientPatch, drumPatch, effectiveEffects, generatePreview } from './JamEngine';
import { streamSeed } from './music';
import { createSession, SCENES } from './scenes';

/** Short, authentic offline previews of the same scene generator and native
 * synthesis patches. They never initialize or alter the live audio/MIDI graph.
 * Independent per-note synths avoid live allocator cleanup before offline rendering. */
export async function renderScenePreview(sceneId: string, bars = 4, sampleRate = 32000): Promise<AudioBuffer> {
  if (!SCENES.some(scene => scene.id === sceneId)) throw new Error(`Unknown scene: ${sceneId}`);
  if (!Number.isFinite(bars) || bars < 1 || bars > 8) throw new Error('Offline previews support one to eight bars.');
  if (!Number.isInteger(sampleRate) || sampleRate < 16000 || sampleRate > 96000) throw new Error('Preview sample rate must be an integer from 16000 to 96000.');
  const OfflineContext = globalThis.OfflineAudioContext;
  if (!OfflineContext) throw new Error('This browser does not provide OfflineAudioContext.');
  const session = createSession(sceneId);
  const clip = generatePreview(session, Math.round(bars));
  const secondsPerBeat = 60 / session.bpm;
  const origin = 0.04;
  const tailSeconds = 3;
  const length = Math.ceil((origin + clip.lengthBeats * secondsPerBeat + tailSeconds) * sampleRate);
  const offline = new OfflineContext(2, length, sampleRate);
  const ctx = offline as unknown as AudioContext;
  const master = offline.createGain(), drive = offline.createGain();
  const softClip = offline.createWaveShaper(), limiter = offline.createDynamicsCompressor();
  master.gain.setValueAtTime(session.volume, 0); drive.gain.setValueAtTime(1, 0);
  const curve = new Float32Array(44100), degrees = Math.PI / 180;
  for (let i = 0; i < curve.length; i++) {
    const x = i * 2 / curve.length - 1;
    curve[i] = 4.5 * x * 20 * degrees / (Math.PI + 1.5 * Math.abs(x * 20 * degrees));
  }
  softClip.curve = curve; softClip.oversample = '2x';
  limiter.threshold.setValueAtTime(-1, 0); limiter.knee.setValueAtTime(0, 0);
  limiter.ratio.setValueAtTime(20, 0); limiter.attack.setValueAtTime(0.001, 0); limiter.release.setValueAtTime(0.05, 0);
  master.connect(drive); drive.connect(softClip); softClip.connect(limiter); limiter.connect(offline.destination);
  const rack = new EffectsRack(ctx, master, value => drive.gain.setTargetAtTime(1 + Math.max(0, Math.min(1, value)) * 1.8, 0, 0.05));
  rack.updateParams(effectiveEffects(session));
  const random = new Map(session.layers.map(layer => [layer.id, new PRNG(streamSeed(session.seed, `${layer.id}-audio`))]));
  const drumRandom = new PRNG(streamSeed(session.seed, 'drum-audio'));
  const keep: (AmbientSynth | DrumSynth)[] = [];
  for (const note of clip.notes) {
    const layer = session.layers.find(item => item.id === note.layerId);
    if (!layer || layer.muted || note.durationBeats <= 0) continue;
    const time = origin + note.startBeat * secondsPerBeat;
    if (layer.role === 'drum') {
      const synth = new DrumSynth(ctx, rack.inputNode, drumRandom), voice = layer.drumVoice || 'perc';
      const patch = drumPatch(voice, session, layer);
      if (voice === 'kick') synth.triggerKick(time, note.velocity, patch, layer.volume);
      else if (voice === 'snare') synth.triggerSnare(time, note.velocity, patch, layer.volume);
      else if (voice === 'hihat') synth.triggerHiHat(time, note.velocity, patch, layer.volume);
      else synth.triggerPerc(time, note.velocity, patch, layer.volume);
      keep.push(synth);
    } else {
      const budget = layer.role === 'chords' ? 4 : layer.role === 'drone' ? 2 : layer.role === 'bass' ? 1 : 3;
      const synth = new AmbientSynth(ctx, rack.inputNode, budget, 2, random.get(layer.id));
      synth.triggerNote(time, note.note, note.velocity, note.durationBeats * secondsPerBeat, ambientPatch(layer, session, note.startBeat), layer.volume);
      keep.push(synth);
    }
  }
  try { return await offline.startRendering(); }
  finally { for (const synth of keep) synth.stopAllVoices(); }
}
