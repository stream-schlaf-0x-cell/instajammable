import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENES } from '../engine/jam/scenes';
import { SOUNDSCAPE_PRESETS } from '../engine/jam/soundscapes';
import { RHYTHM_POOL } from '../engine/jam/rhythms';
import { SEQUENCE_TEMPLATES } from '../engine/jam/sequencer';
import { INSTRUMENT_PRESETS } from '../engine/jam/instrumentPresets';
import { TARGET_PARAM_OPTIONS, EQ_PRESETS, INITIAL_CUSTOM_MACROS } from '../engine/jam/customMacros';
import { TIMBRES, DRUM_MODELS } from '../types/jam';
import {
  getSceneDisplay,
  getSoundscapeDisplay,
  getRhythmDisplay,
  getSequenceTemplateDisplay,
  getInstrumentPresetDisplay,
  getParamOptionDisplay,
  getEqPresetDisplay,
  getCustomMacroDisplayName,
  getSequenceBlockLabel,
  getPresetCategoryDisplay,
  getTimbreDisplayName,
  getDrumModelDisplayName,
  getClipTitleDisplay,
  getChangeDisplay,
} from '../engine/jam/minimalCatalog';

const FORBIDDEN_MINIMAL =
  /[äöüÄÖÜß]|\b(cbl|carbon based|s1gns|asura|aes dana|kupla|no spirit|ultimae|frahm|hopkins|solar fields|brian eno|steve reich|dilla|chilledcow|cell|spotify|vangelis|koan|groß|streich|hölzern|schwebend|klangwelt|takte|und|mit|für|auf|aus|einem|einer|eine|sanft|tiefe|hauchzart|kathedrale|dreck|klang|makro|makros|spuren|spur|effekte|jaco|motown)\b/i;

function assertCleanEnglish(label: string, values: string[]): void {
  for (const v of values) {
    assert.equal(FORBIDDEN_MINIMAL.test(v), false, `${label} leaked German or artist term: "${v}"`);
  }
}

test('Minimal EN catalog translates 100% of scenes, presets, and params without artist refs', () => {
  for (const s of SCENES) {
    const min = getSceneDisplay(s, 'minimal');
    assert.ok(min.name.length > 0 && min.mood.length > 0);
    assertCleanEnglish(`scene:${s.id}`, [min.name, min.mood, min.description]);
    assert.deepEqual(getSceneDisplay(s, 'classic').name, s.name);
  }

  for (const p of SOUNDSCAPE_PRESETS) {
    const min = getSoundscapeDisplay(p, 'minimal');
    assert.ok(min.tags.length <= 2, `soundscape:${p.id} minimal tags should be <= 2`);
    assertCleanEnglish(`soundscape:${p.id}`, [min.name, min.subtitle, min.description, ...min.tags]);
    assert.equal(getSoundscapeDisplay(p, 'classic').name, p.name);
  }

  for (const r of RHYTHM_POOL) {
    const min = getRhythmDisplay(r, 'minimal');
    assert.equal(min.artistInspiration, '', `rhythm:${r.id} should omit artistInspiration in minimal`);
    assertCleanEnglish(`rhythm:${r.id}`, [min.name, min.genre, min.description]);
    assert.equal(getRhythmDisplay(r, 'classic').artistInspiration, r.artistInspiration);
  }

  for (const t of SEQUENCE_TEMPLATES) {
    const min = getSequenceTemplateDisplay(t, 'minimal');
    assertCleanEnglish(`seq:${t.id}`, [min.name, min.description]);
    for (const b of t.blocks) {
      if (b.label) assertCleanEnglish(`seqBlock:${t.id}`, [getSequenceBlockLabel(b.label, 'minimal')]);
    }
  }

  for (const inst of INSTRUMENT_PRESETS) {
    const min = getInstrumentPresetDisplay(inst, 'minimal');
    assertCleanEnglish(`inst:${inst.id}`, [min.name, min.description]);
    assert.equal(getInstrumentPresetDisplay(inst, 'classic').name, inst.name);
  }

  for (const opt of TARGET_PARAM_OPTIONS) {
    const min = getParamOptionDisplay(opt, 'minimal');
    assertCleanEnglish(`param:${opt.param}`, [min.label, min.category]);
  }

  for (const eq of EQ_PRESETS) {
    const min = getEqPresetDisplay(eq, 'minimal');
    assertCleanEnglish(`eq:${eq.id}`, [min.name, min.subtitle]);
  }

  for (const m of INITIAL_CUSTOM_MACROS) {
    assertCleanEnglish(`macro:${m.id}`, [getCustomMacroDisplayName(m.name, 'minimal')]);
  }
});

test('minimalCatalog dynamic labels, categories, timbres, drum models, clips and change log stay clean in Minimal EN', () => {
  const dynamicBlocks = [
    '4T Chorus (Peak)',
    '4T Buildup (Spannung)',
    '8T Voller Groove',
    '4T Breakdown (Drums aus)',
    '16T Stille (Minimal)',
  ];
  for (const label of dynamicBlocks) {
    assertCleanEnglish(`dynamicBlock:${label}`, [getSequenceBlockLabel(label, 'minimal')]);
    assert.equal(getSequenceBlockLabel(label, 'classic'), label);
  }

  for (const inst of INSTRUMENT_PRESETS) {
    assertCleanEnglish(`presetCategory:${inst.category}`, [getPresetCategoryDisplay(inst.category, 'minimal')]);
  }
  assertCleanEnglish('presetCategory:ultimae', [getPresetCategoryDisplay('Cell-Grade Ultimae', 'minimal')]);

  for (const timbre of TIMBRES) {
    assertCleanEnglish(`timbre:${timbre}`, [getTimbreDisplayName(timbre, 'minimal')]);
  }

  for (const model of [...DRUM_MODELS, 'kick', 'snare', 'hihat', 'perc'] as const) {
    assertCleanEnglish(`drumModel:${model}`, [getDrumModelDisplayName(model, 'minimal')]);
  }

  const clipTitles = [
    'Berlin 4AM Dub · 8.0 Takte',
    'Dorian Dawn · Vorschau',
    'Aufnahme 4.0 Takte',
  ];
  for (const title of clipTitles) {
    const min = getClipTitleDisplay(title, 'minimal');
    assertCleanEnglish(`clip:${title}`, [min]);
    assert.ok(!/Takte|Vorschau|Aufnahme/.test(min), `Expected German clip words removed from "${min}"`);
  }

  const changeLabels = [
    'Tempo 118 BPM',
    'Panic · Stimmen und MIDI gestoppt',
    'Bearbeitete Phrase übernommen',
    'Arrangement: ⚡ Buildup gestartet (Drop in 4 Takten)',
    'Effekt-Kette: Modus Parallel',
    'Chords Zufalls-Sound · Solar Fields Space',
    '🎲 Radical Random · Deep Space',
  ];
  for (const label of changeLabels) {
    assertCleanEnglish(`change:${label}`, [getChangeDisplay(label, 'minimal')]);
  }
});
