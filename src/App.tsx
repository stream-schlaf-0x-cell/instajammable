import React, { useState, useEffect } from 'react';
import { EngineView, ProjectState } from './types';
import { EngineFacade } from './engine/engineFacade';
import { Header } from './components/Header';
import { PerformanceView } from './components/PerformanceView';
import { DeepEditView } from './components/DeepEditView';
import { PlaygroundView } from './components/PlaygroundView';
import { AbletonGuideModal } from './components/AbletonGuideModal';
import { MemoryModal } from './components/MemoryModal';

export const App: React.FC = () => {
  const engine = EngineFacade.getInstance();
  const [currentView, setCurrentView] = useState<EngineView>('performance');
  const [state, setState] = useState<ProjectState>(engine.state);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isAbletonGuideOpen, setIsAbletonGuideOpen] = useState<boolean>(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState<boolean>(false);

  useEffect(() => {
    // Subscribe to engine state mutations
    const unsubState = engine.onStateChange((newState) => {
      setState({ ...newState });
    });

    // Subscribe to clock ticks
    const unsubTick = engine.onStepTick((step) => {
      setCurrentStep(step);
    });

    // Spacebar global keyboard listener for play/pause
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        engine.init().then(() => {
          engine.togglePlay();
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubState();
      unsubTick();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-mono selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Sticky Header Bar */}
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        state={state}
        onOpenAbletonGuide={() => setIsAbletonGuideOpen(true)}
        onOpenMemoryModal={() => setIsMemoryModalOpen(true)}
      />

      {/* Main Laboratory Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-20">
        {currentView === 'performance' && (
          <PerformanceView state={state} currentStep={currentStep} />
        )}
        {currentView === 'deepEdit' && <DeepEditView state={state} />}
        {currentView === 'playground' && <PlaygroundView state={state} />}
      </main>

      {/* Footer Info */}
      <footer className="border-t border-stone-900 bg-stone-950/80 px-6 py-3 text-[11px] font-mono text-stone-400 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span>SEED: #{state.seed}</span>
          <span>•</span>
          <span>LATENCY: INTERACTIVE</span>
          <span>•</span>
          <span>CPU USAGE: OPTIMIZED (2014 MBP)</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsAbletonGuideOpen(true)}
            className="text-emerald-400/90 hover:text-emerald-300 underline underline-offset-2"
          >
            Ableton Live 12 Setup Guide
          </button>
          <span>•</span>
          <button
            onClick={() => setIsMemoryModalOpen(true)}
            className="text-stone-300 hover:text-stone-100 underline underline-offset-2"
          >
            Export MIDI (.mid)
          </button>
        </div>
      </footer>

      {/* Modals */}
      <AbletonGuideModal
        isOpen={isAbletonGuideOpen}
        onClose={() => setIsAbletonGuideOpen(false)}
      />
      <MemoryModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
      />
    </div>
  );
};

export default App;
