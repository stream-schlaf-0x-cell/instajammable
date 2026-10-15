import { ArrowRight, ArrowLeft, Power, Sparkles } from 'lucide-react';
import { JamEngine } from '../../engine/jam/JamEngine';
import type { EffectChainMode, EffectModuleId, JamSession } from '../../types/jam';

const engine = JamEngine.getInstance();

export function EffectChainDeck({ session }: { session: JamSession }) {
  const chain = engine.getEffectChain();
  const currentMode = chain.mode;
  const modules = chain.modules;
  const fxPatch = session.effectsPatch || {};
  const currentDrive = fxPatch.masterDrive ?? (session.macros.warmth * 0.12);
  const currentFlutter = fxPatch.delayFlutter ?? (session.macros.warmth * 0.12);
  const currentDelayMix = fxPatch.delayMix ?? (session.macros.space * 0.28);
  const currentDelayFeedback = fxPatch.delayFeedback ?? (0.3 + session.macros.space * 0.35);
  const currentReverbMix = fxPatch.reverbMix ?? (session.macros.space * 0.45);
  const currentReverbSize = fxPatch.reverbSize ?? (0.4 + session.macros.space * 0.5);
  const currentPump = session.pump ?? 0;

  const handleModeChange = (mode: EffectChainMode) => {
    engine.setEffectChainMode(mode);
  };

  const handleToggleBypass = (id: EffectModuleId) => {
    engine.toggleEffectBypass(id);
  };

  const handleMoveModule = (index: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= modules.length) return;
    const ids = modules.map(m => m.id);
    const temp = ids[index];
    ids[index] = ids[targetIdx];
    ids[targetIdx] = temp;
    engine.reorderEffectChain(ids);
  };

  const updateParam = (key: string, val: number) => {
    engine.updateSession({
      effectsPatch: {
        ...(session.effectsPatch || {}),
        [key]: val,
      },
    });
  };

  return (
    <section className="effect-chain-deck" aria-label="Modulare Effekt-Kette">
      <header className="effect-chain-header">
        <div className="header-text">
          <div className="title-row">
            <span className="eyebrow">MODULARE SIGNALKETTE</span>
            <h2>Audiosignal & Effekt-Routing.</h2>
          </div>
          <p className="helper">Befreie dich vom starren Aufbau. Schalte Module ein/aus, vertausche die Reihenfolge und wähle zwischen parallelem Hall oder ineinanderfließenden Psybient-Echos.</p>
        </div>

        {/* Routing Mode Buttons */}
        <div className="routing-mode-selector" role="group" aria-label="Signalweg-Modus">
          <span className="mode-label">Signalweg:</span>
          <button
            type="button"
            className={'button routing-btn ' + (currentMode === 'parallel' ? 'active' : '')}
            onClick={() => handleModeChange('parallel')}
            title="Delay und Reverb laufen unabhängig parallel"
          >
            Parallel (Klassisch)
          </button>
          <button
            type="button"
            className={'button routing-btn ' + (currentMode === 'delay-into-reverb' ? 'active' : '')}
            onClick={() => handleModeChange('delay-into-reverb')}
            title="Delays fließen direkt in den Reverb (Carbon Based Lifeforms / Psybient Wash)"
          >
            <Sparkles size={14} /> Delay ➔ Reverb (Psybient Wash)
          </button>
          <button
            type="button"
            className={'button routing-btn ' + (currentMode === 'reverb-into-delay' ? 'active' : '')}
            onClick={() => handleModeChange('reverb-into-delay')}
            title="Die Hallfahne wird vom Delay rhythmisch zerschnitten"
          >
            Reverb ➔ Delay (Echo-Wash)
          </button>
        </div>
      </header>

      {/* Visual Signal Flow Chain */}
      <div className="signal-chain-container">
        <div className="chain-node-port input-port">
          <span className="port-dot" />
          <span className="port-label">Audio In</span>
        </div>

        <div className="chain-modules-list">
          {modules.map((mod, idx) => {
            const isBypassed = mod.bypassed;
            return (
              <div key={mod.id} className="chain-slot-wrapper">
                {idx > 0 && (
                  <div className="chain-cable-link">
                    <span className="cable-line" />
                    <ArrowRight size={14} className="cable-arrow" />
                  </div>
                )}

                <article className={'chain-module-card ' + (isBypassed ? 'bypassed' : 'active-module')}>
                  <div className="module-card-header">
                    <div className="module-status">
                      <span className={'status-led ' + (isBypassed ? 'off' : 'on')} />
                      <strong>{mod.name}</strong>
                    </div>
                    <div className="module-actions">
                      <button
                        type="button"
                        className={'icon-button bypass-toggle ' + (isBypassed ? 'is-bypassed' : 'is-active')}
                        onClick={() => handleToggleBypass(mod.id)}
                        title={isBypassed ? 'Modul aktivieren' : 'Modul auf Bypass schalten'}
                        aria-pressed={!isBypassed}
                      >
                        <Power size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-button move-btn"
                        disabled={idx === 0}
                        onClick={() => handleMoveModule(idx, 'left')}
                        title="Nach links verschieben"
                      >
                        <ArrowLeft size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-button move-btn"
                        disabled={idx === modules.length - 1}
                        onClick={() => handleMoveModule(idx, 'right')}
                        title="Nach rechts verschieben"
                      >
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Module Specific Controls */}
                  <div className="module-controls">
                    {mod.id === 'warmth' && (
                      <div className="ctrl-item">
                        <div className="ctrl-label">
                          <span>Sättigung / Drive</span>
                          <output>{Math.round(currentDrive * 100)}%</output>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={0.5}
                          step={0.01}
                          disabled={isBypassed}
                          value={currentDrive}
                          onChange={e => updateParam('masterDrive', Number(e.target.value))}
                        />
                      </div>
                    )}

                    {mod.id === 'flutter' && (
                      <div className="ctrl-item">
                        <div className="ctrl-label">
                          <span>Tape-Flutter (Leiern)</span>
                          <output>{Math.round(currentFlutter * 100)}%</output>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={0.8}
                          step={0.01}
                          disabled={isBypassed}
                          value={currentFlutter}
                          onChange={e => updateParam('delayFlutter', Number(e.target.value))}
                        />
                      </div>
                    )}

                    {mod.id === 'delay' && (
                      <>
                        <div className="ctrl-item">
                          <div className="ctrl-label">
                            <span>Delay Mix</span>
                            <output>{Math.round(currentDelayMix * 100)}%</output>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={0.7}
                            step={0.01}
                            disabled={isBypassed}
                            value={currentDelayMix}
                            onChange={e => updateParam('delayMix', Number(e.target.value))}
                          />
                        </div>
                        <div className="ctrl-item">
                          <div className="ctrl-label">
                            <span>Feedback (Echos)</span>
                            <output>{Math.round(currentDelayFeedback * 100)}%</output>
                          </div>
                          <input
                            type="range"
                            min={0.1}
                            max={0.88}
                            step={0.01}
                            disabled={isBypassed}
                            value={currentDelayFeedback}
                            onChange={e => updateParam('delayFeedback', Number(e.target.value))}
                          />
                        </div>
                      </>
                    )}

                    {mod.id === 'reverb' && (
                      <>
                        <div className="ctrl-item">
                          <div className="ctrl-label">
                            <span>Reverb Mix</span>
                            <output>{Math.round(currentReverbMix * 100)}%</output>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={0.8}
                            step={0.01}
                            disabled={isBypassed}
                            value={currentReverbMix}
                            onChange={e => updateParam('reverbMix', Number(e.target.value))}
                          />
                        </div>
                        <div className="ctrl-item">
                          <div className="ctrl-label">
                            <span>Raumgröße</span>
                            <output>{Math.round(currentReverbSize * 100)}%</output>
                          </div>
                          <input
                            type="range"
                            min={0.2}
                            max={1}
                            step={0.01}
                            disabled={isBypassed}
                            value={currentReverbSize}
                            onChange={e => updateParam('reverbSize', Number(e.target.value))}
                          />
                        </div>
                      </>
                    )}

                    {mod.id === 'eq' && (
                      <>
                        <div className="ctrl-item">
                          <div className="ctrl-label">
                            <span>Bass / Low Shelf</span>
                            <output>{(fxPatch.eqLow ?? 0) > 0 ? `+${(fxPatch.eqLow ?? 0).toFixed(1)}` : (fxPatch.eqLow ?? 0).toFixed(1)} dB</output>
                          </div>
                          <input
                            type="range"
                            min={-12}
                            max={12}
                            step={0.5}
                            disabled={isBypassed}
                            value={fxPatch.eqLow ?? 0}
                            onChange={e => engine.setEq({ low: Number(e.target.value) })}
                          />
                        </div>
                        <div className="ctrl-item">
                          <div className="ctrl-label">
                            <span>Mitten / Mid</span>
                            <output>{(fxPatch.eqMid ?? 0) > 0 ? `+${(fxPatch.eqMid ?? 0).toFixed(1)}` : (fxPatch.eqMid ?? 0).toFixed(1)} dB</output>
                          </div>
                          <input
                            type="range"
                            min={-12}
                            max={12}
                            step={0.5}
                            disabled={isBypassed}
                            value={fxPatch.eqMid ?? 0}
                            onChange={e => engine.setEq({ mid: Number(e.target.value) })}
                          />
                        </div>
                        <div className="ctrl-item">
                          <div className="ctrl-label">
                            <span>Höhen / High</span>
                            <output>{(fxPatch.eqHigh ?? 0) > 0 ? `+${(fxPatch.eqHigh ?? 0).toFixed(1)}` : (fxPatch.eqHigh ?? 0).toFixed(1)} dB</output>
                          </div>
                          <input
                            type="range"
                            min={-12}
                            max={12}
                            step={0.5}
                            disabled={isBypassed}
                            value={fxPatch.eqHigh ?? 0}
                            onChange={e => engine.setEq({ high: Number(e.target.value) })}
                          />
                        </div>
                      </>
                    )}

                    {mod.id === 'pump' && (
                      <div className="ctrl-item">
                        <div className="ctrl-label">
                          <span>Kick-Pump Ducking</span>
                          <output>{Math.round(currentPump * 100)}%</output>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={0.8}
                          step={0.01}
                          disabled={isBypassed}
                          value={currentPump}
                          onChange={e => engine.updateSession({ pump: Number(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>
                </article>
              </div>
            );
          })}
        </div>

        <div className="chain-node-port output-port">
          <span className="port-dot" />
          <span className="port-label">Master Out</span>
        </div>
      </div>
    </section>
  );
}
