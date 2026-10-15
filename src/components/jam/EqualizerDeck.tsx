import { useId, useMemo } from 'react';
import { Sliders, X, Sparkles, Power } from 'lucide-react';
import { JamEngine } from '../../engine/jam/JamEngine';
import { EQ_PRESETS, type EqPreset } from '../../engine/jam/customMacros';
import type { JamSession } from '../../types/jam';

interface EqualizerDeckProps {
  session: JamSession;
  onClose?: () => void;
}

const engine = JamEngine.getInstance();

export function EqualizerDeck({ session, onClose }: EqualizerDeckProps) {
  const patch = session.effectsPatch || {};
  const isBypassed = engine.getEffectChain().modules.find(m => m.id === 'eq')?.bypassed ?? false;

  const lowCut = patch.eqHighpass ?? 20;
  const lowGain = patch.eqLow ?? 0;
  const midGain = patch.eqMid ?? 0;
  const midFreq = patch.eqMidFreq ?? 1000;
  const midQ = patch.eqMidQ ?? 1.0;
  const highGain = patch.eqHigh ?? 0;

  const svgId = useId();

  // Compute 64-point frequency response curve for SVG visualization
  const curvePoints = useMemo(() => {
    const points: string[] = [];
    const width = 640;
    const height = 120;
    const minF = 20;
    const maxF = 20000;
    const minDb = -18;
    const maxDb = 18;

    const numPoints = 80;
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      // Logarithmic frequency scale
      const f = minF * Math.pow(maxF / minF, t);

      let totalDb = 0;

      if (!isBypassed) {
        // Highpass (Low-Cut) 12dB/octave Butterworth approximation
        if (f < lowCut) {
          const ratio = f / Math.max(1, lowCut);
          totalDb += 40 * Math.log10(Math.max(1e-3, ratio));
        }

        // Low Shelf (85Hz center)
        const lowF = 85;
        const lowWeight = 1 / (1 + Math.pow(f / lowF, 2));
        totalDb += lowGain * lowWeight;

        // Peaking Mid
        const midRatio = f / Math.max(1, midFreq);
        const octDiff = Math.abs(Math.log2(Math.max(1e-3, midRatio)));
        const bw = 1 / Math.max(0.2, midQ);
        const midWeight = Math.exp(-Math.pow(octDiff / (0.8 * bw), 2));
        totalDb += midGain * midWeight;

        // High Shelf (7500Hz center)
        const highF = 7500;
        const highWeight = 1 / (1 + Math.pow(highF / Math.max(1, f), 2));
        totalDb += highGain * highWeight;
      }

      // Clamp db between -18 and +18 for plotting
      const clampedDb = Math.max(minDb, Math.min(maxDb, totalDb));
      const x = t * width;
      const y = height / 2 - (clampedDb / maxDb) * (height / 2 - 8);

      points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }

    return points.join(' ');
  }, [lowCut, lowGain, midGain, midFreq, midQ, highGain, isBypassed]);

  const applyPreset = (preset: EqPreset) => {
    engine.setEq({
      highpass: preset.highpass,
      low: preset.low,
      mid: preset.mid,
      midFreq: preset.midFreq,
      midQ: preset.midQ,
      high: preset.high,
    });
  };

  const toggleBypass = () => {
    engine.toggleEffectBypass('eq');
  };

  return (
    <section className={'deck-card eq-deck-card ' + (isBypassed ? 'is-bypassed' : '')}>
      <header className="deck-card-header">
        <div className="deck-header-title">
          <div className="deck-icon-badge" style={{ background: '#0284c722', color: '#38bdf8' }}>
            <Sliders size={18} />
          </div>
          <div>
            <div className="deck-eyebrow">MASTER OUT · ANALOG CURVE</div>
            <h2 className="deck-title">Studio 3-Band Parametric EQ & Filter</h2>
          </div>
        </div>

        <div className="deck-header-actions">
          <button
            type="button"
            className={'button eq-bypass-btn ' + (!isBypassed ? 'active-power' : 'bypassed-power')}
            onClick={toggleBypass}
            title={isBypassed ? 'EQ aktivieren' : 'EQ Bypass (Linear 0 dB)'}
          >
            <Power size={14} />
            <span>{isBypassed ? 'Bypass' : 'Aktiv'}</span>
          </button>
          {onClose && (
            <button
              type="button"
              className="icon-button close-deck-btn"
              onClick={onClose}
              title="Deck schließen"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Real-time Frequency Response Canvas / SVG */}
      <div className="eq-graph-container">
        <svg viewBox="0 0 640 120" className="eq-svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`${svgId}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.32" />
              <stop offset="60%" stopColor="#0284c7" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1="60" x2="640" y2="60" className="eq-grid-zero" />
          <line x1="0" y1="24" x2="640" y2="24" className="eq-grid-line" />
          <line x1="0" y1="96" x2="640" y2="96" className="eq-grid-line" />

          {/* Vertical Freq Grid (100Hz, 1kHz, 10kHz) */}
          <line x1="148" y1="0" x2="148" y2="120" className="eq-grid-freq" />
          <text x="152" y="15" className="eq-grid-label">100 Hz</text>

          <line x1="363" y1="0" x2="363" y2="120" className="eq-grid-freq" />
          <text x="367" y="15" className="eq-grid-label">1 kHz</text>

          <line x1="578" y1="0" x2="578" y2="120" className="eq-grid-freq" />
          <text x="582" y="15" className="eq-grid-label">10 kHz</text>

          {/* DB indicators */}
          <text x="6" y="28" className="eq-db-label">+12 dB</text>
          <text x="6" y="64" className="eq-db-label">0 dB</text>
          <text x="6" y="100" className="eq-db-label">-12 dB</text>

          {/* Filled area under curve */}
          <path d={`${curvePoints} L 640 120 L 0 120 Z`} fill={`url(#${svgId}-fill)`} />

          {/* Active response stroke */}
          <path d={curvePoints} className="eq-curve-line" />
        </svg>

        {isBypassed && (
          <div className="eq-bypassed-overlay">
            <span>EQ BYPASSED (LINEAR 0 dB)</span>
          </div>
        )}
      </div>

      {/* Preset Chips */}
      <div className="eq-presets-strip">
        <span className="eq-preset-label">
          <Sparkles size={12} /> Vorlagen:
        </span>
        <div className="eq-preset-pills">
          {EQ_PRESETS.map(p => (
            <button
              key={p.id}
              type="button"
              className="eq-preset-pill"
              onClick={() => applyPreset(p)}
              title={p.subtitle}
            >
              <strong>{p.name}</strong>
            </button>
          ))}
        </div>
      </div>

      {/* 4 Interactive Band Columns */}
      <div className="eq-controls-grid">
        {/* Band 1: Low-Cut (Highpass) */}
        <div className="eq-band-card">
          <div className="band-header">
            <span className="band-name">Low-Cut / Sub-Filter</span>
            <span className="band-val">{lowCut > 20 ? `${Math.round(lowCut)} Hz` : 'Flat (20 Hz)'}</span>
          </div>
          <div className="band-slider-row">
            <input
              type="range"
              min={20}
              max={350}
              step={5}
              value={lowCut}
              aria-label="Low-Cut Highpass Frequenz"
              onChange={e => engine.setEq({ highpass: Number(e.target.value) })}
              disabled={isBypassed}
            />
          </div>
          <small className="band-helper">Räumt Sub-Rumpeln auf oder kreiert Radio-Sound</small>
        </div>

        {/* Band 2: Low Shelf */}
        <div className="eq-band-card">
          <div className="band-header">
            <span className="band-name">Bass / Low Shelf (85 Hz)</span>
            <span className="band-val">{lowGain > 0 ? `+${lowGain.toFixed(1)} dB` : `${lowGain.toFixed(1)} dB`}</span>
          </div>
          <div className="band-slider-row">
            <input
              type="range"
              min={-12}
              max={12}
              step={0.5}
              value={lowGain}
              aria-label="Bass Low Shelf Gain"
              onChange={e => engine.setEq({ low: Number(e.target.value) })}
              disabled={isBypassed}
            />
          </div>
          <small className="band-helper">Wärme, Fundament und Kick-Druck</small>
        </div>

        {/* Band 3: Parametric Mid (Gain + Freq + Q) */}
        <div className="eq-band-card eq-mid-band">
          <div className="band-header">
            <span className="band-name">Mitten / Parametrischer Peak</span>
            <span className="band-val">{midGain > 0 ? `+${midGain.toFixed(1)} dB` : `${midGain.toFixed(1)} dB`}</span>
          </div>
          <div className="band-slider-row">
            <input
              type="range"
              min={-12}
              max={12}
              step={0.5}
              value={midGain}
              aria-label="Mitten Gain"
              onChange={e => engine.setEq({ mid: Number(e.target.value) })}
              disabled={isBypassed}
            />
          </div>
          <div className="mid-params-row">
            <label className="mid-sub-param">
              <span>Freq: <strong>{midFreq < 1000 ? `${Math.round(midFreq)} Hz` : `${(midFreq / 1000).toFixed(1)} kHz`}</strong></span>
              <input
                type="range"
                min={250}
                max={5000}
                step={25}
                value={midFreq}
                aria-label="Mitten-Frequenz"
                onChange={e => engine.setEq({ midFreq: Number(e.target.value) })}
                disabled={isBypassed}
              />
            </label>
            <label className="mid-sub-param">
              <span>Q / Güte: <strong>{midQ.toFixed(1)}</strong></span>
              <input
                type="range"
                min={0.4}
                max={3.0}
                step={0.1}
                value={midQ}
                aria-label="Mitten Q-Faktor"
                onChange={e => engine.setEq({ midQ: Number(e.target.value) })}
                disabled={isBypassed}
              />
            </label>
          </div>
        </div>

        {/* Band 4: High Shelf */}
        <div className="eq-band-card">
          <div className="band-header">
            <span className="band-name">Höhen / Air Shelf (7.5 kHz)</span>
            <span className="band-val">{highGain > 0 ? `+${highGain.toFixed(1)} dB` : `${highGain.toFixed(1)} dB`}</span>
          </div>
          <div className="band-slider-row">
            <input
              type="range"
              min={-12}
              max={12}
              step={0.5}
              value={highGain}
              aria-label="Höhen High Shelf Gain"
              onChange={e => engine.setEq({ high: Number(e.target.value) })}
              disabled={isBypassed}
            />
          </div>
          <small className="band-helper">Glanz, Seidigkeit oder samtiges Vintage-Tape</small>
        </div>
      </div>
    </section>
  );
}
