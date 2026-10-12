// Generative Engine Interfaces & Base Types

import { StepContext, ParameterBoundary } from '../../types';

export interface GeneratedEvent {
  type: 'drum' | 'note';
  drumType?: 'kick' | 'snare' | 'hihat' | 'perc';
  midiNote: number;
  velocity: number;
  duration: number; // in seconds
  probability: number;
  microOffset: number; // in seconds (for swing / humanization)
}

export interface IGenerator {
  id: string;
  name: string;
  description: string;
  generateStep(context: StepContext): GeneratedEvent[];
  mutate(boundaries: Record<string, ParameterBoundary>, intensity: number): void;
  regenerate(): void;
  getSettings(): Record<string, any>;
  setSettings(settings: Record<string, any>): void;
}
