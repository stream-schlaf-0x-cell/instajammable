import { useEffect, useRef, useState } from 'react';
import { Sparkles, Zap, Compass, RefreshCw } from 'lucide-react';
import { JamEngine } from '../../engine/jam/JamEngine';
import { useUiEdition } from '../../contexts/UiEditionContext';
import type { JamSession } from '../../types/jam';

const engine = JamEngine.getInstance();

type DriftMode = 'manual' | 'calm' | 'pulse' | 'wild';

export function ChaosModulatorDeck({
  session,
  enabled = true,
  onToggleEnabled,
}: {
  session: JamSession;
  enabled?: boolean;
  onToggleEnabled?: (next: boolean) => void;
}) {
  const uiEdition = useUiEdition();
  const isMinimal = uiEdition === 'minimal';
  const [driftMode, setDriftMode] = useState<DriftMode>('calm');
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrame = useRef<number | null>(null);

  // Position state (0..1)
  const posRef = useRef({
    x: session.macros.movement,
    y: session.macros.space,
  });

  const trailsRef = useRef<Array<{ x: number; y: number; alpha: number }>>([]);
  const phaseRef = useRef(0);

  // Animation loop for organic drift and trail rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Update position if enabled, auto-drifting, and not manually dragging
      if (enabled && !isDragging && driftMode !== 'manual') {
        const speed = driftMode === 'calm' ? 0.35 : driftMode === 'pulse' ? 0.8 : 1.7;
        phaseRef.current += dt * speed;

        // Two harmonic non-integer oscillators for smooth, never-repeating quasi-chaotic trajectory
        const t = phaseRef.current;
        const targetX = 0.5 + 0.38 * Math.sin(t * 1.1) + 0.12 * Math.cos(t * 2.7);
        const targetY = 0.5 + 0.38 * Math.cos(t * 0.9) + 0.12 * Math.sin(t * 2.3);

        const current = posRef.current;
        const lerp = Math.min(1, dt * 2.5);
        current.x += (targetX - current.x) * lerp;
        current.y += (targetY - current.y) * lerp;

        engine.setChaosDrift(current.x, current.y);
      }

      // Record trail
      const current = posRef.current;
      trailsRef.current.push({ x: current.x, y: current.y, alpha: 1.0 });
      if (trailsRef.current.length > 36) trailsRef.current.shift();

      // Render on canvas
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Draw subtle grid & axis markers
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height);
      ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Draw trails
      if (trailsRef.current.length > 1) {
        ctx.beginPath();
        for (let i = 0; i < trailsRef.current.length - 1; i++) {
          const p1 = trailsRef.current[i];
          const p2 = trailsRef.current[i + 1];
          p1.alpha = Math.max(0, p1.alpha - dt * 0.6);
          ctx.strokeStyle = `rgba(6, 182, 212, ${0.12 + 0.6 * (i / trailsRef.current.length)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p1.x * width, p1.y * height);
          ctx.lineTo(p2.x * width, p2.y * height);
          ctx.stroke();
        }
      }

      // Draw cursor puck
      const cx = current.x * width;
      const cy = current.y * height;

      // Glow circle
      const gradient = ctx.createRadialGradient(cx, cy, 2, cx, cy, 24);
      gradient.addColorStop(0, 'rgba(6, 182, 212, 0.85)');
      gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.35)');
      gradient.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, 24, 0, Math.PI * 2);
      ctx.fill();

      // Center core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();

      animFrame.current = requestAnimationFrame(loop);
    };

    animFrame.current = requestAnimationFrame(loop);

    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, [driftMode, isDragging, enabled]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!enabled && onToggleEnabled) onToggleEnabled(true);
    setIsDragging(true);
    updateFromPointer(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    updateFromPointer(e);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const updateFromPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    posRef.current = { x, y };
    engine.setChaosDrift(x, y);
  };

  const handleSpontaneousPulse = () => {
    if (!enabled && onToggleEnabled) onToggleEnabled(true);
    engine.applyChaosImpulse();
    // Jolt visual position
    posRef.current = {
      x: session.macros.movement,
      y: session.macros.space,
    };
  };

  const selectMode = (mode: DriftMode) => {
    if (!enabled && onToggleEnabled) onToggleEnabled(true);
    setDriftMode(mode);
  };

  return (
    <section className={`chaos-modulator-deck ${!enabled ? 'is-disabled' : ''}`} aria-label={isMinimal ? 'Chaos & Drift Modulator' : 'Chaos- und Drift-Modulator'}>
      <header className="chaos-deck-header">
        <div>
          <span className="eyebrow">{isMinimal ? 'ATTRACTOR' : 'ORGANISCHER ATTRACTOR'}</span>
          <h2>{isMinimal ? 'Chaos & Drift' : 'Chaos & lebendige Bewegung.'}</h2>
          {!isMinimal && <p className="helper">Gegen die starre Kälte: Ein mathematisch schwebender Attraktor wandert durch den 2D-Klangraum und moduliert Bewegung und Hall organisch.</p>}
        </div>
        <div className="chaos-deck-actions">
          {onToggleEnabled && (
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              className={`hardware-switch-pill ${enabled ? 'is-on' : 'is-off'}`}
              onClick={() => onToggleEnabled(!enabled)}
              title={isMinimal
                ? (enabled ? 'Turn attractor off' : 'Turn attractor on')
                : (enabled ? 'Attraktor ausschalten' : 'Attraktor einschalten')}
            >
              <span className="switch-dot" />
              <span>{enabled ? 'ON' : 'OFF'}</span>
            </button>
          )}
          <button
            type="button"
            className="button impulse-btn"
            onClick={handleSpontaneousPulse}
            title={isMinimal ? 'Trigger organic sound pulse' : 'Löst einen spontanen organischen Klangimpuls aus'}
          >
            <Zap size={15} /> {isMinimal ? 'Pulse' : '⚡ Spontaner Impuls'}
          </button>
        </div>
      </header>

      <div className="chaos-main-grid">
        {/* Interactive 2D Pad Canvas */}
        <div className="chaos-pad-wrapper">
          <canvas
            ref={canvasRef}
            width={340}
            height={240}
            className="chaos-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            title={isMinimal ? 'Drag to steer X/Y timbre coordinates' : 'Klicke und ziehe, um den Klangpunkt in 2D zu steuern'}
          />
          <div className="pad-axis-labels">
            <span className="axis-label x-axis">{isMinimal ? `X: Movement (${Math.round(session.macros.movement * 100)}%)` : `X: Bewegung / Motive (${Math.round(session.macros.movement * 100)}%)`}</span>
            <span className="axis-label y-axis">{isMinimal ? `Y: Space & Reverb (${Math.round(session.macros.space * 100)}%)` : `Y: Raum & Hall (${Math.round(session.macros.space * 100)}%)`}</span>
          </div>
        </div>

        {/* Controls & Mode selection */}
        <div className="chaos-controls-side">
          <div className="drift-mode-picker">
            <span className="picker-title">{isMinimal ? 'Drift Mode:' : 'Drift-Modus:'}</span>
            <div className="mode-btn-group">
              <button
                type="button"
                className={'button mode-btn ' + (enabled && driftMode === 'manual' ? 'active' : '')}
                onClick={() => selectMode('manual')}
              >
                {isMinimal ? 'Manual' : 'Manuell (Halten)'}
              </button>
              <button
                type="button"
                className={'button mode-btn ' + (enabled && driftMode === 'calm' ? 'active' : '')}
                onClick={() => selectMode('calm')}
              >
                <Compass size={14} /> {isMinimal ? 'Calm Glide' : 'Sanft schwebend (CBL)'}
              </button>
              <button
                type="button"
                className={'button mode-btn ' + (enabled && driftMode === 'pulse' ? 'active' : '')}
                onClick={() => selectMode('pulse')}
              >
                <RefreshCw size={14} /> {isMinimal ? 'Pulse' : 'Pulsierend'}
              </button>
              <button
                type="button"
                className={'button mode-btn ' + (enabled && driftMode === 'wild' ? 'active' : '')}
                onClick={() => selectMode('wild')}
              >
                <Sparkles size={14} /> {isMinimal ? 'Wild' : 'Wild & Chaotisch'}
              </button>
            </div>
          </div>

          <div className="chaos-live-readout">
            <div className="readout-card">
              <span className="readout-label">{isMinimal ? 'X Coordinate' : 'Aktuelle X-Koordinate'}</span>
              <strong>{isMinimal ? `Movement: ${Math.round(session.macros.movement * 100)}%` : `Bewegung: ${Math.round(session.macros.movement * 100)}%`}</strong>
              {!isMinimal && <small>Variiert Melodiemotive und Phrasen</small>}
            </div>
            <div className="readout-card">
              <span className="readout-label">{isMinimal ? 'Y Coordinate' : 'Aktuelle Y-Koordinate'}</span>
              <strong>{isMinimal ? `Space / Reverb: ${Math.round(session.macros.space * 100)}%` : `Raum / Hall: ${Math.round(session.macros.space * 100)}%`}</strong>
              {!isMinimal && <small>Steuert Kathedral-Hall & Space-Delay</small>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
