import { useState } from 'react';
import { Compass, Activity, Disc, SlidersHorizontal, Waves, Sparkles, Cloud, Cpu } from 'lucide-react';
import { PianoRoll } from '../jam/PianoRoll';
import { QuickMixerDeck } from '../jam/QuickMixerDeck';
import { HarmonyHeroCard, MacroDeckCard, CompactTrackMatrix, ToolDrawerContent, type ToolId } from './LayoutShared';
import type { ClipNote, JamEvent, JamPosition, JamSession } from '../../types/jam';
import type { UiEdition } from '../../types/ui';

interface SplitLayoutProps {
  session: JamSession;
  position: JamPosition;
  edition: UiEdition;
  rollNotes: Array<ClipNote | JamEvent>;
  startBeat: number;
  span: number;
  live: boolean;
  onAudition: (note: number) => void;
}

const TOOL_TABS: Array<{ id: ToolId; classic: string; minimal: string; icon: typeof Compass }> = [
  { id: 'soundscape', classic: 'Klangwelt & Chords', minimal: 'Soundscape', icon: Compass },
  { id: 'rhythms', classic: 'Rhythmus & Drums', minimal: 'Drums & Groove', icon: Disc },
  { id: 'sequencer', classic: 'Sequenzer', minimal: 'Arrangement', icon: Activity },
  { id: 'eq', classic: 'Studio-EQ', minimal: 'EQ', icon: SlidersHorizontal },
  { id: 'fxchain', classic: 'Effekte', minimal: 'FX Chain', icon: Waves },
  { id: 'chaos', classic: 'Attraktor', minimal: 'Modulation', icon: Sparkles },
  { id: 'atmosphere', classic: 'Atmosphäre', minimal: 'Atmosphere', icon: Cloud },
  { id: 'custommacros', classic: 'Eigene Makros', minimal: 'Custom Macros', icon: Cpu },
];

export function SplitLayout({
  session,
  position,
  edition,
  rollNotes,
  startBeat,
  span,
  live,
  onAudition,
}: SplitLayoutProps) {
  const min = edition === 'minimal';
  const [activeTool, setActiveTool] = useState<ToolId>('soundscape');
  const [showDrumsRoll, setShowDrumsRoll] = useState(false);

  return (
    <div className="layout-split-grid">
      {/* Left Column: Harmony, Macros & Live Piano Roll */}
      <div className="split-col-left">
        <HarmonyHeroCard session={session} position={position} edition={edition} />
        <MacroDeckCard session={session} edition={edition} />
        <section className="plugin-card split-roll-card">
          <header className="plugin-card-head">
            <div>
              <span className="plugin-eyebrow">{live ? (min ? 'LIVE STREAM' : 'GESPIELTE NOTEN') : (min ? 'PREVIEW' : 'VORSCHAU')}</span>
              <h3 className="plugin-card-title">{min ? 'Piano Roll' : 'Live-Pianorolle'}</h3>
            </div>
            <div className="segmented">
              <button type="button" className={!showDrumsRoll ? 'selected' : ''} onClick={() => setShowDrumsRoll(false)}>Keys</button>
              <button type="button" className={showDrumsRoll ? 'selected' : ''} onClick={() => setShowDrumsRoll(true)}>Drums</button>
            </div>
          </header>
          <PianoRoll
            rootPitchClass={((position.chordRoot % 12) + 12) % 12}
            chordTones={position.chordNotes}
            notes={rollNotes}
            tracks={session.layers}
            startBeat={startBeat}
            span={span}
            cursor={live ? position.beat : undefined}
            drums={showDrumsRoll}
            height={220}
            onAudition={onAudition}
          />
        </section>
      </div>

      {/* Right Column: Mixer + Tool Workbench */}
      <div className="split-col-right">
        <section className="plugin-card">
          <header className="plugin-card-head">
            <div>
              <span className="plugin-eyebrow">{min ? 'LEVELS & MUTE' : '8-KANAL MIXER'}</span>
              <h3 className="plugin-card-title">{min ? 'Track Mixer' : 'Studio-Mischpult'}</h3>
            </div>
          </header>
          {min ? (
            <CompactTrackMatrix session={session} edition={edition} />
          ) : (
            <QuickMixerDeck session={session} position={position} />
          )}
        </section>

        <section className="plugin-card split-tools-card">
          <div className="split-tool-tabs" role="tablist">
            {TOOL_TABS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTool === t.id}
                  className={`plugin-chip-btn ${activeTool === t.id ? 'is-accent' : ''}`}
                  onClick={() => setActiveTool(t.id)}
                >
                  <Icon size={13} />
                  <span>{min ? t.minimal : t.classic}</span>
                </button>
              );
            })}
          </div>
          <div className="split-tool-body">
            <ToolDrawerContent tool={activeTool} session={session} position={position} />
          </div>
        </section>
      </div>
    </div>
  );
}
