// Offline audio check. Renders real audio with node-web-audio-api (install with `npm i --no-save node-web-audio-api`).
// Verifies that every scene renders finite, audible, non-clipping audio and that dragging reverb/delay/filter
// controls during a held chord stays free of discontinuities. Exits non-zero on failure.
import { OfflineAudioContext } from 'node-web-audio-api';
(globalThis as unknown as { OfflineAudioContext: unknown }).OfflineAudioContext = OfflineAudioContext;
const { EffectsRack } = await import('../src/engine/audio/effects.ts');
const { AmbientSynth } = await import('../src/engine/audio/ambientSynth.ts');
const { ambientPatch, effectiveEffects } = await import('../src/engine/jam/JamEngine.ts');
const { createSession, SCENES } = await import('../src/engine/jam/scenes.ts');
const { renderScenePreview } = await import('../src/engine/jam/renderPreview.ts');

let failures = 0; const check = (ok: boolean, message: string) => { console.log((ok ? 'PASS ' : 'FAIL ') + message); if (!ok) failures++; };
function stats(buffer: AudioBuffer, from = 0) {
  let nan = 0, peak = 0, sum = 0, n = 0, maxD2 = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) { const x = buffer.getChannelData(c);
    for (let i = from; i < x.length; i++) { const v = x[i]; if (!Number.isFinite(v)) { nan++; continue; } peak = Math.max(peak, Math.abs(v)); sum += v * v; n++; if (i >= from + 2) maxD2 = Math.max(maxD2, Math.abs(x[i] - 2 * x[i - 1] + x[i - 2])); } }
  return { nan, peak, rms: Math.sqrt(sum / Math.max(1, n)), maxD2 };
}
{
  const sr = 32000; const ctx = new (OfflineAudioContext as any)(2, sr * 10, sr); const master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
  const rack = new EffectsRack(ctx, master, () => {}); const session = createSession('ultimae-drift'); const chords = session.layers.find(l => l.id === 'chords')!;
  const fx = effectiveEffects(session); rack.updateParams(fx); const synth = new AmbientSynth(ctx, rack.inputNode, 6, 8); const base = ambientPatch(chords, session, 0);
  for (const note of [50, 57, 60, 64, 67]) synth.triggerNote(0.1, note, 90, 8.5, base, 0.6);
  for (let k = 1; k <= 160; k++) { const f = k / 160; const t = Math.round((1 + f * 7.5) * sr / 128) * 128 / sr;
    ctx.suspend(t).then(() => { rack.updateParams({ ...fx, reverbSize: 0.15 + 0.85 * Math.abs(Math.sin(f * 6)), reverbMix: 0.1 + 0.4 * f, delayFeedback: 0.3 + 0.4 * f, reverbDecay: 3 + 5 * f });
      synth.updateParams({ ...base, filterCutoff: base.filterCutoff * (0.7 + 0.6 * Math.abs(Math.sin(f * 9))) }, 0.3 + 0.7 * Math.abs(Math.sin(f * 5))); ctx.resume(); }); }
  const s = stats(await ctx.startRendering(), sr);
  check(s.nan === 0 && s.peak < 1, `slider sweep stays finite and bounded (peak ${s.peak.toFixed(3)})`);
  check(s.maxD2 < 0.05, `slider sweep has no hard discontinuity (max second difference ${s.maxD2.toFixed(4)})`);
}
for (const scene of SCENES) {
  const s = stats(await renderScenePreview(scene.id, 4));
  check(s.nan === 0 && s.peak < 0.9 && s.peak > 0.02 && s.rms > 0.005, `${scene.id}: finite, audible, headroom (peak ${s.peak.toFixed(3)}, rms ${s.rms.toFixed(4)})`);
}
process.exit(failures ? 1 : 0);
