// Verified Hardware Controller Profiles (Behringer DeepMind 6 & Akai APC40)

export interface HardwareControlMapping {
  name: string;
  cc: number;
  min: number;
  max: number;
  defaultValue: number;
  description: string;
}

export interface DeepMindHardwareState {
  enabled: boolean;
  midiChannel: number;
  sendRateLimitMs: number; // rate-limit CC transmission to avoid MIDI buffer saturation
  lastSentValues: Record<number, number>;
  lastSentTimestamps: Record<number, number>;
}

export const DEEPMIND_6_PROFILE = {
  name: 'Behringer DeepMind 6',
  type: 'Analog Synthesizer',
  defaultMidiChannel: 1,
  manualCitation: 'Behringer DeepMind 6 User Manual, pp. 132–133 (CC Mode)',
  description:
    '6-voice true analog synthesizer. When DeepMind 6 is set to MIDI CC Mode in Global Settings, these standard CCs control the actual analog filters and VCAs.',
  connectionNote:
    'Connect DeepMind 6 directly via USB to Mac (or via a dedicated MIDI interface). A standard Scarlett 2i2 has no 5-pin MIDI jacks; connect DeepMind analog audio outputs to Scarlett audio inputs 1 & 2.',
  // Verified from DeepMind 6 Manual pp. 132-133:
  controls: [
    { name: 'VCF Frequency / Cutoff', cc: 29, min: 0, max: 127, defaultValue: 64, description: 'Analog Lowpass Filter Cutoff (Manual p. 132)' },
    { name: 'VCF Resonance', cc: 30, min: 0, max: 127, defaultValue: 20, description: 'Analog Filter Resonance (Q) (Manual p. 132)' },
    { name: 'VCF Env Mod Depth', cc: 31, min: 0, max: 127, defaultValue: 40, description: 'VCF Envelope Modulation Depth (Manual p. 132)' },
    { name: 'VCF LFO Mod Depth', cc: 33, min: 0, max: 127, defaultValue: 15, description: 'LFO to VCF Cutoff Depth (Manual p. 132)' },
    { name: 'VCA Env Decay', cc: 39, min: 0, max: 127, defaultValue: 70, description: 'VCA Envelope Decay Time (Manual p. 133)' },
    { name: 'VCA Env Release', cc: 41, min: 0, max: 127, defaultValue: 80, description: 'VCA Envelope Release Time (Manual p. 133)' },
    { name: 'Modulation Wheel', cc: 1, min: 0, max: 127, defaultValue: 0, description: 'Pitch LFO Vibrato Depth' },
    { name: 'Portamento Time', cc: 5, min: 0, max: 127, defaultValue: 0, description: 'Polyphonic Portamento Glide Speed' },
  ] as HardwareControlMapping[],
};

export const APC40_PROFILE = {
  name: 'Akai APC40',
  type: 'Performance MIDI Controller',
  description:
    'Physical controller mapping for live performance manipulation in ECHO GARDEN.',
  mappings: [
    { name: 'Track Faders 1-5', cc: 7, description: 'Channel volumes for Kick, Snare, Hats, Perc, Drone' },
    { name: 'Master Fader', cc: 14, description: 'Master Output Volume' },
    { name: 'Device Knobs 1-4', cc: 16, description: 'Performance Macros 1 to 4' },
    { name: 'Track Stop Buttons', note: 52, description: 'Toggle Layer Freeze' },
  ],
};
