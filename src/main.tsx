import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { MasterAudio } from './engine/audio/audioContext';

// iOS Safari / iPadOS Web Audio unlocker on first user gesture
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const master = MasterAudio.getInstance();
    if (master.ctx && master.ctx.state === 'suspended') {
      master.ctx.resume().catch(() => {});
    }
  };
  window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
  window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
  window.addEventListener('keydown', unlockAudio, { once: true, passive: true });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
