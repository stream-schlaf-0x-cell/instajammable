// High-Performance Audio Canvas Visualizer (Oscilloscope + Spectrum + Rhythmic Clock)

import React, { useEffect, useRef } from 'react';
import { MasterAudio } from '../engine/audio/audioContext';

interface VisualizerProps {
  currentStep: number;
  bpm: number;
}

export const Visualizer: React.FC<VisualizerProps> = ({ currentStep, bpm }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const masterAudio = MasterAudio.getInstance();
    const analyser = masterAudio.analyser;

    const bufferLength = analyser ? analyser.frequencyBinCount : 256;
    const timeData = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;

      // Dark translucent background for phosphor persistence trail
      ctx.fillStyle = 'rgba(12, 10, 9, 0.35)';
      ctx.fillRect(0, 0, width, height);

      if (analyser) {
        analyser.getByteTimeDomainData(timeData);
        analyser.getByteFrequencyData(freqData);

        // 1. Draw Subtle Spectrum Glow in Background
        const barWidth = (width / bufferLength) * 2.5;
        for (let i = 0; i < bufferLength / 2; i++) {
          const barHeight = (freqData[i] / 255) * (height * 0.45);
          const x = i * barWidth;
          const hue = 155 + (i / bufferLength) * 60; // Emerald to Cyan
          ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.12)`;
          ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
        }

        // 2. Draw Sharp Center Oscilloscope Waveform
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = '#10b981'; // Emerald 500
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 6;
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0; // 0 to 2
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      } else {
        // Flat center line when idle
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }

      // 3. Draw 16-Step Rhythmic Pulse Orbit / Timeline on top
      const subStep = currentStep % 16;
      const stepWidth = width / 16;
      for (let s = 0; s < 16; s++) {
        const isCurrent = s === subStep;
        const isBeat = s % 4 === 0;
        const dotX = s * stepWidth + stepWidth / 2;
        const dotY = 16;

        ctx.beginPath();
        ctx.arc(dotX, dotY, isCurrent ? 4.5 : isBeat ? 2.5 : 1.5, 0, Math.PI * 2);
        if (isCurrent) {
          ctx.fillStyle = '#34d399'; // Bright mint green
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 8;
        } else if (isBeat) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.shadowBlur = 0;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [currentStep, bpm]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-stone-800/80 bg-stone-950/80 shadow-2xl backdrop-blur-md">
      <div className="absolute top-2 left-4 text-[11px] font-mono tracking-widest text-stone-500 uppercase flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        ACOUSTIC WAVEFORM & METRIC SPECTRUM
      </div>
      <div className="absolute top-2 right-4 text-[11px] font-mono text-stone-400">
        STEP {((currentStep % 16) + 1).toString().padStart(2, '0')}/16 · BAR {Math.floor(currentStep / 16) + 1}
      </div>
      <canvas
        ref={canvasRef}
        width={960}
        height={130}
        className="w-full h-32 block"
      />
    </div>
  );
};
