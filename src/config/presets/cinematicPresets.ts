export const cinematicPresets = [
  { id: 'cinematic', label: 'Cinematic', description: 'Professional film quality', imageStylePrompt: 'cinematic film still, anamorphic lens', lightingStyle: 'dramatic film lighting', cameraStyle: 'cinematic camera movement', motionStyle: 'smooth cinematic motion' },
  { id: 'pixar', label: 'Pixar 3D', description: 'Pixar animation style', imageStylePrompt: 'pixar 3d animation, disney pixar style', lightingStyle: 'soft animated lighting', cameraStyle: 'animated camera', motionStyle: 'animated character movement' },
  { id: 'disney', label: 'Disney 2D', description: 'Classic Disney animation', imageStylePrompt: 'disney 2d animation, hand drawn style', lightingStyle: 'traditional animation lighting', cameraStyle: 'classic animation framing', motionStyle: 'fluid character animation' },
  { id: 'anime', label: 'Anime', description: 'Japanese anime style', imageStylePrompt: 'anime style, studio ghibli quality', lightingStyle: 'anime lighting', cameraStyle: 'anime camera angles', motionStyle: 'dynamic anime action' },
  { id: 'realistic', label: 'Realistic', description: 'Photorealistic rendering', imageStylePrompt: 'photorealistic, lifelike, real photo', lightingStyle: 'natural realistic lighting', cameraStyle: 'documentary camera', motionStyle: 'realistic human movement' },
  { id: 'noir', label: 'Film Noir', description: 'Black and white noir', imageStylePrompt: 'film noir, black and white, high contrast', lightingStyle: 'dramatic noir shadows', cameraStyle: 'noir camera angles', motionStyle: 'slow dramatic motion' },
  { id: 'documentary', label: 'Documentary', description: 'Documentary style', imageStylePrompt: 'documentary footage, natural', lightingStyle: 'available light', cameraStyle: 'handheld documentary', motionStyle: 'natural movement' }
];

console.log('[STYLE PRESET REGISTRY LOADED]', cinematicPresets.length, 'presets');
