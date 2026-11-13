import { useState } from 'react';
import { Music2, Activity } from 'lucide-react';
import { PianoRoll } from '../jam/PianoRoll';
import { QuickMixerDeck } from '../jam/QuickMixerDeck';
import { SequencerDeck, SoundscapeDeck } from '../jam/ArrangementHub';
import { HarmonyHeroCard, MacroDeckCard } from './LayoutShared';
import type { ClipNote, JamEvent, JamPosition, JamSession } from '../../types/jam';
import type { UiEdition } from '../../types/ui';

interface CommandGridLayoutProps {
  session: JamSession;
  position: JamPosition;
  edition: UiEdition;
  rollNotes: Array<ClipNote | JamEvent>;
  startBeat: number;
  span: number;
  live: boolean;
  onAudition: (note: number) => void;
}

export function CommandGridLayout({
  session,
  position,
  edition,
  rollNotes,
  startBeat,
  span,
  live,
  onAudition,
}: CommandGridLayoutProps) {
  const min = edition === 'minimal';
  const [bottomRightTab, setBottomRightTab] = useState<'roll' | 'sequencer' | 'soundscape'>('roll');

  return (
    <div className="layout-command-grid">
      {/* Q1: Harmony, Key, BPM */}
      <div className="grid-quadrant">
        <HarmonyHeroCard session={session} position={position} edition={edition} compact />
      </div>

      {/* Q2: 8-Channel Studio Mixer */}
      <div className="grid-quadrant">
        <section className="plugin-card grid-mixer-card">
          <header className="plugin-card-head">
            <div>
              <span className="plugin-eyebrow">{min ? '8-CHANNEL CONSOLE' : '8-KANAL MISCHPULT'}</span>
              <h3 className="plugin-card-title">{min ? 'Mixer' : 'Studio-Mixer'}</h3>
            </div>
          </header>
          <QuickMixerDeck session={session} position={position} />
        </section>
      </div>

      {/* Q3: Core Macros */}
      <div className="grid-quadrant">
        <MacroDeckCard session={session} edition={edition} />
      </div>

      {/* Q4: Live Piano Roll / Arrangement / Soundscape */}
      <div className="grid-quadrant">
        <section className="plugin-card grid-score-card">
          <header className="plugin-card-head">
            <div>
              <span className="plugin-eyebrow">{min ? 'WORKSPACE MONITOR' : 'LIVE-ANSICHT'}</span>
              <h3 className="plugin-card-title">
                {bottomRightTab === 'roll'
                  ? (min ? 'Piano Roll' : 'Pianorolle')
                  : bottomRightTab === 'sequencer'
                    ? (min ? 'Arrangement' : 'Sequenzer')
                    : (min ? 'Soundscape' : 'Klangwelt')}
              </h3>
            </div>
            <div className="segmented">
              <button type="button" className={bottomRightTab === 'roll' ? 'selected' : ''} onClick={() => setBottomRightTab('roll')}>
                <Music2 size={12} /> {min ? 'Score' : 'Noten'}
              </button>
              <button type="button" className={bottomRightTab === 'sequencer' ? 'selected' : ''} onClick={() => setBottomRightTab('sequencer')}>
                <Activity size={12} /> {min ? 'Arrange' : 'Ablauf'}
              </button>
              <button type="button" className={bottomRightTab === 'soundscape' ? 'selected' : ''} onClick={() => setBottomRightTab('soundscape')}>
                {min ? 'Chords' : 'Klangwelt'}
              </button>
            </div>
          </header>

          {bottomRightTab === 'roll' && (
            <PianoRoll
              rootPitchClass={((position.chordRoot % 12) + 12) % 12}
              chordTones={position.chordNotes}
              notes={rollNotes}
              tracks={session.layers}
              startBeat={startBeat}
              span={span}
              cursor={live ? position.beat : undefined}
              height={240}
              onAudition={onAudition}
            />
          )}
          {bottomRightTab === 'sequencer' && (
            <SequencerDeck session={session} position={position} onClose={() => setBottomRightTab('roll')} />
          )}
          {bottomRightTab === 'soundscape' && (
            <SoundscapeDeck session={session} position={position} onClose={() => setBottomRightTab('roll')} />
          )}
        </section>
      </div>
    </div>
  );
}
