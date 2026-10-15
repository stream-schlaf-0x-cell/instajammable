import { useState } from 'react';
import { SlidersHorizontal, Plus, Trash2, ChevronDown, ChevronUp, Sparkles, Check, X } from 'lucide-react';
import { JamEngine } from '../../engine/jam/JamEngine';
import { TARGET_PARAM_OPTIONS, findParamOption, INITIAL_CUSTOM_MACROS } from '../../engine/jam/customMacros';
import type { CustomMacro, CustomMacroTarget, JamSession, MacroTargetParam } from '../../types/jam';

const engine = JamEngine.getInstance();

const COLOR_PALETTE = [
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#10b981', // Emerald
  '#ec4899', // Pink / Rose
  '#f97316', // Orange
  '#6366f1', // Indigo
];

export function CustomMacroDeck({ session }: { session: JamSession }) {
  const customMacros = session.customMacros || [];
  const [expandedMacroId, setExpandedMacroId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // New Macro Form State
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0]);
  const [newTargetParam, setNewTargetParam] = useState<MacroTargetParam>('fx:reverbMix');
  const [newTargetMin, setNewTargetMin] = useState(0.1);
  const [newTargetMax, setNewTargetMax] = useState(0.75);
  const [newTargetInverted, setNewTargetInverted] = useState(false);

  // Add Target Form State for existing macro
  const [targetParamToAdd, setTargetParamToAdd] = useState<MacroTargetParam>('fx:delayMix');
  const [targetMinToAdd, setTargetMinToAdd] = useState(0.1);
  const [targetMaxToAdd, setTargetMaxToAdd] = useState(0.6);
  const [targetInvertToAdd, setTargetInvertToAdd] = useState(false);

  const handleSliderChange = (macroId: string, val: number) => {
    engine.setCustomMacro(macroId, val);
  };

  const handleCreateMacro = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim() || 'Mein Makro';
    const opt = findParamOption(newTargetParam);
    const newMacro: CustomMacro = {
      id: `custom-macro-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      color: newColor,
      value: 0.5,
      targets: [
        {
          id: `target-${Date.now()}-1`,
          param: newTargetParam,
          label: opt.label,
          min: newTargetMin,
          max: newTargetMax,
          inverted: newTargetInverted,
        },
      ],
    };
    engine.addCustomMacro(newMacro);
    setNewName('');
    setIsCreating(false);
    setExpandedMacroId(newMacro.id);
  };

  const handleAddTemplate = (templateIndex: number) => {
    const tmpl = INITIAL_CUSTOM_MACROS[templateIndex];
    if (!tmpl) return;
    const newMacro: CustomMacro = {
      ...tmpl,
      id: `custom-macro-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${tmpl.name} (Kopie)`,
    };
    engine.addCustomMacro(newMacro);
  };

  const handleAddTargetToMacro = (macroId: string) => {
    const macro = customMacros.find(m => m.id === macroId);
    if (!macro) return;
    const opt = findParamOption(targetParamToAdd);
    const newTarget: CustomMacroTarget = {
      id: `target-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      param: targetParamToAdd,
      label: opt.label,
      min: targetMinToAdd,
      max: targetMaxToAdd,
      inverted: targetInvertToAdd,
    };
    engine.updateCustomMacro(macroId, {
      targets: [...macro.targets, newTarget],
    });
  };

  const handleRemoveTarget = (macroId: string, targetId: string) => {
    const macro = customMacros.find(m => m.id === macroId);
    if (!macro) return;
    engine.updateCustomMacro(macroId, {
      targets: macro.targets.filter(t => t.id !== targetId),
    });
  };

  const handleDeleteMacro = (macroId: string) => {
    engine.deleteCustomMacro(macroId);
  };

  return (
    <section className="custom-macro-deck" aria-label="Eigene Makros">
      <header className="custom-macro-header">
        <div>
          <span className="eyebrow">DEINE EIGENEN MAKROS</span>
          <h2>Verbinde mehrere Parameter mit einem einzigen Dreh.</h2>
          <p className="helper">Erstelle deine eigenen Makro-Regler. Ein Regler kann gleichzeitig Hall öffnen, die Kick leiser drehen und Tape-Drive hinzufügen.</p>
        </div>
        <div className="macro-deck-actions">
          <button
            type="button"
            className="button primary-btn"
            onClick={() => setIsCreating(!isCreating)}
          >
            {isCreating ? <><X size={15} /> Abbrechen</> : <><Plus size={15} /> Neues Makro erstellen</>}
          </button>
        </div>
      </header>

      {/* Creation Modal / Inline Drawer */}
      {isCreating && (
        <form className="new-macro-drawer" onSubmit={handleCreateMacro}>
          <div className="new-macro-grid">
            <label className="field-group">
              <span>Makro-Name</span>
              <input
                type="text"
                placeholder="z. B. Space & Schimmer, Dreck-Drop ..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
                required
              />
            </label>

            <div className="field-group">
              <span>Signatur-Farbe</span>
              <div className="color-swatches">
                {COLOR_PALETTE.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={'color-swatch ' + (newColor === c ? 'selected' : '')}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewColor(c)}
                    aria-label={`Farbe ${c}`}
                  >
                    {newColor === c && <Check size={12} color="#000" />}
                  </button>
                ))}
              </div>
            </div>

            <label className="field-group">
              <span>Erstes Ziel-Parameter</span>
              <select
                value={newTargetParam}
                onChange={e => {
                  const p = e.target.value as MacroTargetParam;
                  setNewTargetParam(p);
                  const opt = findParamOption(p);
                  setNewTargetMin(opt.defaultMin);
                  setNewTargetMax(opt.defaultMax);
                }}
              >
                {['Effekte', 'Makros', 'Atmosphäre', 'Spuren'].map(cat => (
                  <optgroup key={cat} label={cat}>
                    {TARGET_PARAM_OPTIONS.filter(o => o.category === cat).map(o => (
                      <option key={o.param} value={o.param}>{o.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <div className="field-row-range">
              <label>
                <span>Min-Wert</span>
                <input
                  type="number"
                  step="0.01"
                  value={newTargetMin}
                  onChange={e => setNewTargetMin(Number(e.target.value))}
                />
              </label>
              <label>
                <span>Max-Wert</span>
                <input
                  type="number"
                  step="0.01"
                  value={newTargetMax}
                  onChange={e => setNewTargetMax(Number(e.target.value))}
                />
              </label>
              <label className="invert-check">
                <input
                  type="checkbox"
                  checked={newTargetInverted}
                  onChange={e => setNewTargetInverted(e.target.checked)}
                />
                <span>Gegenläufig (Invertiert)</span>
              </label>
            </div>
          </div>

          <div className="new-macro-footer">
            <div className="macro-starter-chips">
              <span className="helper">Oder Vorlage übernehmen:</span>
              <button type="button" className="starter-chip" onClick={() => handleAddTemplate(0)}>+ Psybient Shimmer</button>
              <button type="button" className="starter-chip" onClick={() => handleAddTemplate(1)}>+ Dreck & Space</button>
              <button type="button" className="starter-chip" onClick={() => handleAddTemplate(2)}>+ Breakdown Drop</button>
            </div>
            <button type="submit" className="button finish-create-btn">
              <Sparkles size={15} /> Makro anlegen
            </button>
          </div>
        </form>
      )}

      {/* Custom Macros Grid */}
      <div className="custom-macro-cards-grid">
        {customMacros.length === 0 ? (
          <div className="empty-macro-notice">
            <SlidersHorizontal size={24} />
            <p>Du hast noch keine eigenen Makros angelegt. Erstelle dein erstes oder wähle eine Vorlage!</p>
            <div className="macro-template-btns">
              <button type="button" className="button" onClick={() => handleAddTemplate(0)}>+ Vorlage: Psybient Shimmer</button>
              <button type="button" className="button" onClick={() => handleAddTemplate(1)}>+ Vorlage: Dreck & Space</button>
              <button type="button" className="button" onClick={() => handleAddTemplate(2)}>+ Vorlage: Breakdown Drop</button>
            </div>
          </div>
        ) : (
          customMacros.map(macro => {
            const isExpanded = expandedMacroId === macro.id;
            return (
              <article
                key={macro.id}
                className="custom-macro-card"
                style={{ '--macro-theme': macro.color } as React.CSSProperties}
              >
                <div className="macro-card-top">
                  <div className="macro-title-group">
                    <span className="macro-color-pill" />
                    <strong>{macro.name}</strong>
                    <span className="macro-targets-count">{macro.targets.length} {macro.targets.length === 1 ? 'Ziel' : 'Ziele'}</span>
                  </div>
                  <div className="macro-card-buttons">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setExpandedMacroId(isExpanded ? null : macro.id)}
                      title={isExpanded ? 'Ziele einklappen' : 'Ziele bearbeiten'}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button
                      type="button"
                      className="icon-button delete-btn"
                      onClick={() => handleDeleteMacro(macro.id)}
                      title="Makro löschen"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Big Live Slider */}
                <div className="macro-slider-wrapper">
                  <div className="slider-header-info">
                    <span className="macro-intensity">Intensität</span>
                    <output className="macro-output">{Math.round(macro.value * 100)}%</output>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={macro.value}
                    aria-label={`Eigenes Makro: ${macro.name}`}
                    onChange={e => handleSliderChange(macro.id, Number(e.target.value))}
                    className="macro-custom-slider"
                  />
                </div>

                {/* Target Chips preview */}
                <div className="macro-targets-preview">
                  {macro.targets.map(t => {
                    const opt = findParamOption(t.param);
                    return (
                      <span key={t.id} className={'target-pill ' + (t.inverted ? 'inverted' : '')}>
                        {opt.label}: {t.min} ➔ {t.max} {t.inverted && '(gegenläufig)'}
                      </span>
                    );
                  })}
                </div>

                {/* Expanded Target Editor Drawer */}
                {isExpanded && (
                  <div className="macro-targets-editor">
                    <h4>Zuweisungen für "{macro.name}":</h4>
                    <div className="targets-list">
                      {macro.targets.map(t => {
                        const opt = findParamOption(t.param);
                        return (
                          <div key={t.id} className="target-item-row">
                            <span className="target-name">{opt.label}</span>
                            <span className="target-range">
                              {t.min} bis {t.max} {t.inverted ? '(Invertiert)' : ''}
                            </span>
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => handleRemoveTarget(macro.id, t.id)}
                              title="Ziel entfernen"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add another target form */}
                    <div className="add-target-form">
                      <span className="helper">Weiteres Ziel hinzufügen:</span>
                      <div className="add-target-controls">
                        <select
                          value={targetParamToAdd}
                          onChange={e => {
                            const p = e.target.value as MacroTargetParam;
                            setTargetParamToAdd(p);
                            const opt = findParamOption(p);
                            setTargetMinToAdd(opt.defaultMin);
                            setTargetMaxToAdd(opt.defaultMax);
                          }}
                        >
                          {['Effekte', 'Makros', 'Atmosphäre', 'Spuren'].map(cat => (
                            <optgroup key={cat} label={cat}>
                              {TARGET_PARAM_OPTIONS.filter(o => o.category === cat).map(o => (
                                <option key={o.param} value={o.param}>{o.label}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Min"
                          value={targetMinToAdd}
                          onChange={e => setTargetMinToAdd(Number(e.target.value))}
                          style={{ width: '65px' }}
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Max"
                          value={targetMaxToAdd}
                          onChange={e => setTargetMaxToAdd(Number(e.target.value))}
                          style={{ width: '65px' }}
                        />
                        <label className="invert-check-mini">
                          <input
                            type="checkbox"
                            checked={targetInvertToAdd}
                            onChange={e => setTargetInvertToAdd(e.target.checked)}
                          />
                          <span>Inv</span>
                        </label>
                        <button
                          type="button"
                          className="button"
                          onClick={() => handleAddTargetToMacro(macro.id)}
                        >
                          <Plus size={14} /> Ziel addieren
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
