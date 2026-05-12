export const voicePresets = [
  { id: 'narrator_male', label: 'Male Narrator', tone: 'calm', age: 'adult', gender: 'male', ttsHint: 'deep professional narrator voice' },
  { id: 'narrator_female', label: 'Female Narrator', tone: 'warm', age: 'adult', gender: 'female', ttsHint: 'warm professional narrator voice' },
  { id: 'child_boy', label: 'Child Boy', tone: 'energetic', age: 'child', gender: 'male', ttsHint: 'young boy voice, excited' },
  { id: 'child_girl', label: 'Child Girl', tone: 'cheerful', age: 'child', gender: 'female', ttsHint: 'young girl voice, cheerful' },
  { id: 'epic_trailer', label: 'Epic Trailer', tone: 'dramatic', age: 'adult', gender: 'male', ttsHint: 'deep epic movie trailer voice' }
];

console.log('[VOICE PRESET REGISTRY LOADED]', voicePresets.length, 'presets');
