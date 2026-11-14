import { useState } from 'react';
import { SlidersHorizontal, X, Music2, Compass, Disc, Waves, Activity } from 'lucide-react';
import { PianoRoll } from '../jam/PianoRoll';
import { QuickMixerDeck } from '../jam/QuickMixerDeck';
import { HarmonyHeroCard, MacroDeckCard, CompactTrackMatrix, ToolDrawerContent, isMidiOnlyMode, type ToolId } from './LayoutShared';
import type { ClipNote, JamEvent, JamPosition, JamSession } from '../../types/jam';
import type { UiEdition } from '../../types/ui';

interface FocusStageLayoutProps {
  session: JamSession;
  position: JamPosition;
  edition: UiEdition;
  rollNotes: Array<ClipNote | JamEvent>;
  startBeat: number;
  span: number;
  live: boolean;
  onAudition: (note: number) => void;
}

type InspectorTab = 'mixer' | 'score' | ToolId;

export function FocusStageLayout({
  session,
  position,
  edition,
  rollNotes,
  startBeat,
  span,
  live,
  onAudition,
}: FocusStageLayoutProps) {
  const min = edition === 'minimal';
  const midiMode = isMidiOnlyMode(session);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('soundscape');
  const activeInspectorTab: InspectorTab = midiMode && inspectorTab === 'fxchain' ? 'rhythms' : inspectorTab;

  return (
    <div className="layout-focus-stage">
      {/* Centered clean performance stage */}
      <div className="stage-center-column">
        <div className="stage-top-toolbar">
          <span className="plugin-eyebrow">
            {min ? 'FOCUS STAGE · DISTRACTION-FREE JAMMING' : 'FOKUS-BÜHNE · FREIES JAMMEN'}
          </span>
          <button
            type="button"
            className={`plugin-chip-btn ${inspectorOpen ? 'is-accent' : ''}`}
            onClick={() => setInspectorOpen(prev => !prev)}
          >
            <SlidersHorizontal size={14} />
            <span>{inspectorOpen ? (min ? 'Hide Inspector' : 'Inspector schließen') : (min ? 'More Tools & Mixer' : 'Mixer & Werkzeuge')}</span>
          </button>
        </div>

        <HarmonyHeroCard session={session} position={position} edition={edition} />
        <MacroDeckCard session={session} edition={edition} />

        <section className="plugin-card">
          <header className="plugin-card-head">
            <div>
              <span className="plugin-eyebrow">{min ? 'ENSEMBLE BALANCE' : 'SPUREN IM BLICK'}</span>
              <h3 className="plugin-card-title">{min ? 'Track Strip' : 'Spur-Leiste'}</h3>
            </div>
          </header>
          <CompactTrackMatrix session={session} edition={edition} />
        </section>
      </div>

      {/* Slide-Over Inspector Panel */}
      {inspectorOpen && (
        <aside className="stage-inspector-drawer" aria-label={min ? 'Inspector' : 'Detail-Inspector'}>
          <header className="inspector-drawer-head">
            <strong>{min ? 'Studio Inspector' : 'Studio-Inspector'}</strong>
            <button type="button" className="icon-button" onClick={() => setInspectorOpen(false)} aria-label="Close">
              <X size={16} />
            </button>
          </header>
          <div className="inspector-tab-strip">
            {([
              ['soundscape', Compass, min ? 'Soundscape' : 'Klangwelt'],
              ['mixer', SlidersHorizontal, min ? 'Full Mixer' : 'Mischpult'],
              ['score', Music2, min ? 'Piano Roll' : 'Pianorolle'],
              ['rhythms', Disc, min ? 'Drums' : 'Rhythmus'],
              ...(!midiMode ? [['fxchain', Waves, min ? 'Effects' : 'Effekte'] as const] : []),
              ['sequencer', Activity, min ? 'Arrangement' : 'Sequenzer'],
            ] as const).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                className={`plugin-chip-btn ${activeInspectorTab === id ? 'is-accent' : ''}`}
                onClick={() => setInspectorTab(id)}
              >
                <Icon size={13} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="inspector-drawer-body">
            {activeInspectorTab === 'mixer' ? (
              <QuickMixerDeck session={session} position={position} />
            ) : activeInspectorTab === 'score' ? (
              <PianoRoll
                rootPitchClass={((position.chordRoot % 12) + 12) % 12}
                chordTones={position.chordNotes}
                notes={rollNotes}
                tracks={session.layers}
                startBeat={startBeat}
                span={span}
                cursor={live ? position.beat : undefined}
                height={320}
                onAudition={onAudition}
              />
            ) : (
              <ToolDrawerContent tool={activeInspectorTab} session={session} position={position} onClose={() => setInspectorOpen(false)} />
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
