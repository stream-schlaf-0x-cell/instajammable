import test from 'node:test';
import assert from 'node:assert/strict';
import { JamComposer, SCALE_INTERVALS } from '../engine/jam/music';
import { createSession } from '../engine/jam/scenes';
import { generatePreview } from '../engine/jam/JamEngine';

function collectMelodySteps(sceneId: string, melodyStyle?: 'motif' | 'ostinato' | 'bellDrops' | 'neoclassical' | 'lofiHook' | 'off', bars = 16) {
  const session = createSession(sceneId, 142857);
  session.evolving = false;
  const melodyLayer = session.layers.find(l => l.role === 'melody')!;
  if (melodyStyle) melodyLayer.settings.melodyStyle = melodyStyle;
  melodyLayer.settings.density = Math.max(0.5, melodyLayer.settings.density);
  const clip = generatePreview(session, bars);
  const composer = new JamComposer();
  const events = clip.notes
    .filter(n => n.layerId === 'melody')
    .map(n => {
      const step = Math.round(n.startBeat * 4);
      const harmony = composer.harmonyAt(step, session);
      return { bar: Math.floor(step / 16), pos: ((step % 16) + 16) % 16, note: n.note, harmonyNotes: harmony.notes };
    });
  return { session, melodyLayer, events };
}

test('Phase 5: repeats rhythmic cell positions >= 60% across bars in motif mode', () => {
  const { events } = collectMelodySteps('dorian-dawn', 'motif', 8);
  const bar0 = new Set(events.filter(e => e.bar === 0).map(e => e.pos));
  const bar1 = new Set(events.filter(e => e.bar === 1).map(e => e.pos));
  assert.ok(bar0.size > 0);
  const shared = [...bar0].filter(p => bar1.has(p)).length;
  assert.ok(shared / bar0.size >= 0.6, `expected >= 0.6 shared rhythmic positions, got ${shared / bar0.size}`);
});

test('Phase 5: snaps >= 80% of melody notes on strong beats (pos 0 and 8) to current harmony chord tones', () => {
  for (const style of ['motif', 'neoclassical', 'lofiHook', 'bellDrops'] as const) {
    const { events } = collectMelodySteps(style === 'lofiHook' ? 'dusty-keys' : 'dorian-dawn', style, 16);
    const strong = events.filter(e => e.pos === 0 || e.pos === 8);
    assert.ok(strong.length > 0, `expected strong beat notes for ${style}`);
    const chordToneHits = strong.filter(e => {
      const pcs = new Set(e.harmonyNotes.map(n => ((n % 12) + 12) % 12));
      return pcs.has(((e.note % 12) + 12) % 12);
    });
    assert.ok(chordToneHits.length / strong.length >= 0.8, `${style}: ${chordToneHits.length}/${strong.length} chord tones`);
  }
});

test('Phase 5: keeps ostinato rhythmic positions and relative contour identical across 16 bars without Evolve', () => {
  const { events } = collectMelodySteps('moss-pulse', 'ostinato', 16);
  const byBar = Array.from({ length: 16 }, (_, b) => events.filter(e => e.bar === b));
  const refPos = byBar[0].map(e => e.pos);
  assert.ok(refPos.length >= 8);
  for (let b = 1; b < 16; b++) {
    assert.deepEqual(byBar[b].map(e => e.pos), refPos);
    if (b < 4) {
      assert.deepEqual(byBar[b].map(e => e.note), byBar[0].map(e => e.note));
    }
  }
});

test('Phase 5: keeps all generated melody notes in-scale and within layer register', () => {
  const styles: Array<'motif' | 'ostinato' | 'bellDrops' | 'neoclassical' | 'lofiHook'> = ['motif', 'ostinato', 'bellDrops', 'neoclassical', 'lofiHook'];
  for (const style of styles) {
    const { session, melodyLayer, events } = collectMelodySteps(style === 'lofiHook' ? 'dusty-keys' : 'ultimae-drift', style, 8);
    const scale = SCALE_INTERVALS[session.scale];
    for (const e of events) {
      assert.ok(e.note >= melodyLayer.settings.minNote && e.note <= melodyLayer.settings.maxNote);
      assert.ok(scale.includes(((e.note - session.root) % 12 + 12) % 12));
    }
  }
});
