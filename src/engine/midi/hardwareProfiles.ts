// Hardware Controller Profiles (Behringer DeepMind 6 & Akai APC40)

export interface HardwareControlMapping {
  name: string;
  cc: number;
  min: number;
  max: number;
  description: string;
}

export const DEEPMIND_6_PROFILE = {
  name: 'Behringer DeepMind 6',
  type: 'Analog Synthesizer',
  defaultMidiChannel: 1,
  description:
    '6-voice true analog synthesizer with dual DCOs, 2-pole/4-pole resonant analog lowpass filter, 3 ADSR envelopes, and 2 LFOs.',
  bestUsage:
    'Ideal for warm analog drones, slowly modulating pad soundscapes, resonant filter sweeps, and polyphonic harmonic foundation.',
  controls: [
    { name: 'Mod Wheel / Vibrato', cc: 1, min: 0, max: 127, description: 'LFO to Pitch Depth' },
    { name: 'Portamento Time', cc: 5, min: 0, max: 127, description: 'Glide time between notes' },
    { name: 'VCF Cutoff', cc: 74, min: 0, max: 127, description: 'Analog Filter Cutoff frequency' },
    { name: 'VCF Resonance', cc: 71, min: 0, max: 127, description: 'Analog Filter Resonance (Q)' },
    { name: 'VCF Env Depth', cc: 73, min: 0, max: 127, description: 'Envelope modulation to cutoff' },
    { name: 'VCF LFO Depth', cc: 75, min: 0, max: 127, description: 'LFO 1/2 modulation to cutoff' },
    { name: 'VCA Decay', cc: 79, min: 0, max: 127, description: 'Amplifier Envelope Decay time' },
    { name: 'VCA Release', cc: 72, min: 0, max: 127, description: 'Amplifier Envelope Release time' },
    { name: 'FX Param 1', cc: 12, min: 0, max: 127, description: 'Digital FX slot 1 primary mix' },
    { name: 'FX Param 2', cc: 13, min: 0, max: 127, description: 'Digital FX slot 2 primary mix' },
  ] as HardwareControlMapping[],
};

export const APC40_PROFILE = {
  name: 'Akai APC40',
  type: 'Performance MIDI Controller',
  description:
    'Grid matrix and fader controller. Adaptable for toggling layer mute/solo, triggering mutations, and macro fader control.',
  mappings: [
    { name: 'Track Faders 1-4', cc: 7, description: 'Layer Volumes (Kick, Snare, Hats, Perc)' },
    { name: 'Master Fader', cc: 14, description: 'Master Output Level' },
    { name: 'Device Control Knobs 1-4', cc: 16, description: 'ECHO GARDEN Macros 1 to 4' },
    { name: 'Clip Stop / Mute Buttons', note: 50, description: 'Freeze / Mutate layer trigger' },
  ],
};
