import type { Character } from '../../types';

/**
 * Character Consistency Prompt Builder
 * Builds detailed, ComfyUI-ready prompts that lock character appearance.
 */

export interface CharacterConsistencyPrompt {
  positive: string;
  negative: string;
}

// =================================================================
// ================ STYLE TRANSLATION SYSTEM =======================
// =================================================================

/**
 * Map style categories to SDXL-friendly visual keywords (English only)
 */
const STYLE_SDXL_MAP: Record<string, string> = {
  pixar: 'Pixar-style 3D animated character, Disney-style 3D family movie, stylized 3D render, volumetric lighting, soft cinematic lighting, subsurface scattering, high-end animated film, 3D stylized face, rounded facial features, large expressive eyes, smooth skin shading, toy-like materials, global illumination, stylized hair strands, cinematic DOF, rendered in Unreal Engine style, high quality 3D animation frame',
  disney: 'Disney-style 3D family movie, magical animation style, disney character design, disney feature film, clean stylized rendering, beautiful animated character, disney princess or hero quality, 3D stylized face, rounded facial features, large expressive eyes, smooth skin shading, toy-like materials, global illumination, stylized hair strands, cinematic DOF, high quality 3D animation frame',
  cinematic_3d: 'cinematic 3D render, realistic detailed character, high quality CGI, unreal engine 5 quality, octane render, ray tracing, detailed skin texture, subsurface scattering, hyper realistic',
  anime: 'anime style, anime character design, cel shaded, toon shaded, japanese animation style, clean lineart, vibrant anime colors, manga aesthetic, studio ghibli inspired',
  realistic: 'photorealistic, ultra realistic, detailed skin texture, real person, portrait photography, professional photography, dslr camera, sharp focus, natural skin,毛孔 visible, real human',
  semi_realistic: 'semi realistic, stylized realism, painterly, digital painting, artstation quality, concept art, detailed but stylized, beautiful rendering, video game cinematic',
  kids_educational: 'childrens educational 3D cartoon, friendly cute character, bright cheerful colors, simple clean design, safe for kids, pbs kids style, 3D animated educational show, stylized 3D render, rounded features, toy-like materials, soft lighting',
  fantasy: 'fantasy art, magical atmosphere, epic fantasy scene, mystical lighting, fantasy illustration, dungeons and dragons style, world of warcraft style, final fantasy inspired',
  arabic_kids: 'middle eastern animation, arabic cartoon style, friendly cartoon character, bright colors, educational cartoon, 2D animation, kids show, cultural animation',
  french_kids: 'french animation style, european cartoon, artistic childrens show, beautiful simple animation, french comic style, ligne claire',
  watercolor: 'watercolor painting style, soft colors, artistic brush strokes, hand painted, wet on wet technique, watercolor paper texture, beautiful washes',
  clay: 'claymation style, clay animation, stop motion, plasticine characters, handmade feel, clay texture, laika studios style, 3D clay figures',
  stop_motion: 'stop motion animation, frame by frame, puppet animation, miniature set, stop motion character, coraline style, practical effects',
  youtube_kids: 'youtube animated series, cozy cartoon style, 2D digital animation, cute characters, bright studio lighting, childrens content',
  custom: 'custom art style, unique artistic vision, mixed media, creative direction, distinctive visual style',
};

/**
 * Convert a style category ID into SDXL-friendly English style keywords
 */
export function getStyleKeywords(styleCategory: string | null | undefined): string {
  if (!styleCategory) return 'cinematic quality, professional production, high detail, dramatic lighting';
  const key = styleCategory.toLowerCase().replace(/[\s_-]+/g, '_');
  if (STYLE_SDXL_MAP[key]) return STYLE_SDXL_MAP[key];
  for (const [cat, tags] of Object.entries(STYLE_SDXL_MAP)) {
    if (key.includes(cat) || cat.includes(key)) return tags;
  }
  return 'cinematic quality, professional production, high detail';
}

/**
 * Clean a prompt for SDXL: remove Arabic chars, deduplicate, remove markers, limit length
 */
export function cleanPromptForSDXL(raw: string): string {
  if (!raw) return '';
  // Remove Arabic Unicode ranges
  let cleaned = raw.replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '');
  // Remove markers
  cleaned = cleaned.replace(/---.*?---/g, '').replace(/Characters?:/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/^[,\s]+/, '').replace(/[,\s]+$/, '');
  // Fix 4: deduplicate words, but never remove critical identity tokens.
  // Tokens like 'bald', 'beard', 'suit' must survive even if they appear twice.
  const IDENTITY_PROTECTED = new Set([
    'bald', 'beard', 'mustache', 'glasses', 'scar', 'tattoo', 'suit',
    'hijab', 'turban', 'freckles', 'eyebrows', 'wrinkles', 'uniform',
    'jacket', 'overshirt', 'stubble', 'goatee', 'mohawk', 'dreadlocks',
  ]);
  const words = cleaned.split(/\s+/);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    const lower = w.toLowerCase().replace(/[^a-z]/g, '');
    const isProtected = IDENTITY_PROTECTED.has(lower);
    if (isProtected || lower.length < 3 || !seen.has(lower)) {
      unique.push(w);
      if (lower.length >= 3 && !isProtected) seen.add(lower);
    }
  }
  return unique.slice(0, 200).join(' ');
}

/**
 * Validate character gender matches name
 */
export function validateGenderConsistency(character: Character): { valid: boolean; warning?: string } {
  const gender = detectGender(character);
  const name = (character.name || '').toLowerCase();
  const maleNames = ['samir', 'ahmed', 'mohamed', 'mohammed', 'ali', 'hassan', 'hussain', 'omar', 'khalid',
    'abdullah', 'youssef', 'yusuf', 'ibrahim', 'ismail', 'adam', 'amir', 'karim', 'jamal',
    'tariq', 'bilal', 'anas', 'saad', 'hadi', 'mazin',
    'سمير', 'أحمد', 'محمد', 'علي', 'حسن', 'حسين', 'عمر', 'خالد', 'عبدالله', 'يوسف', 'إبراهيم',
    'إسماعيل', 'آدم', 'أمير', 'كريم', 'جمال', 'وليد', 'ماجد', 'فهد', 'سعود', 'بدر', 'أيمن',
    'طارق', 'بلال', 'أنس', 'سعد', 'هادي', 'مازن'];
  const femaleNames = ['fatima', 'aisha', 'layla', 'mariam', 'maryam', 'sara', 'sarah',
    'huda', 'amira', 'zainab', 'khadija', 'salma', 'nadia', 'rana', 'dina', 'hala', 'lina',
    'فاطمة', 'عائشة', 'ليلى', 'نور', 'مريم', 'سارة', 'هدى', 'أميرة', 'زينب', 'خديجة',
    'سلمى', 'نادية', 'رنا', 'دينا', 'هالة', 'لينا'];
  const isMaleName = maleNames.some(n => name.includes(n));
  const isFemaleName = femaleNames.some(n => name.includes(n));
  if (gender === 'male' && isFemaleName) return { valid: false, warning: `Character "${character.name}" marked male but name is typically female.` };
  if (gender === 'female' && isMaleName) return { valid: false, warning: `Character "${character.name}" marked female but name is typically male.` };
  if (gender === 'person' && isMaleName) return { valid: false, warning: `Character "${character.name}" appears male (by name) but description lacks gender keywords. Add 'man'/'boy'/'شاب'/'رجل'.` };
  if (gender === 'person' && isFemaleName) return { valid: false, warning: `Character "${character.name}" appears female (by name) but description lacks gender keywords. Add 'woman'/'girl'/'امرأة'/'بنت'.` };
  return { valid: true };
}

// =================================================================
// ================ MAIN PROMPT BUILDER (PATCHED) ==================
// =================================================================

/**
 * Build a full, detailed consistency prompt for a character.
 * Output is ALWAYS English-only, optimized for SDXL/ComfyUI.
 */
export function buildCharacterConsistencyPrompt(character: Character, outfitId?: string, userOverrideOutfit?: boolean): CharacterConsistencyPrompt {
  const gender = detectGender(character);
  const traits = character.tags?.join(', ') || '';

  const selectedOutfit = outfitId
    ? character.outfits?.find(o => o.id === outfitId)
    : character.outfits?.[0];
  const outfit = selectedOutfit?.name || '';
  const outfitDesc = selectedOutfit?.description || '';

  // ---------- POSITIVE PROMPT (ENGLISH ONLY) ----------
  const positiveParts: string[] = [];

  // STRONG gender anchor
  if (gender === 'male') {
    positiveParts.push('adult male character, man, masculine facial features, masculine appearance');
  } else if (gender === 'female') {
    positiveParts.push('adult female character, woman, feminine facial features, feminine appearance');
  }

  // Clean description (strip Arabic)
  if (character.description) {
    const desc = cleanPromptForSDXL(character.description);
    if (desc) positiveParts.push(desc);
  }

  // Outfit
  if (outfit) {
    const cleanOutfit = cleanPromptForSDXL(outfit);
    const cleanOutfitDesc = outfitDesc ? cleanPromptForSDXL(outfitDesc) : '';
    positiveParts.push(`wearing ${cleanOutfit}${cleanOutfitDesc ? ': ' + cleanOutfitDesc : ''}`);
  }

  // Tags
  if (traits) positiveParts.push(cleanPromptForSDXL(traits));

  // Personality notes (visual only)
  if (character.personality_notes) {
    const notes = cleanPromptForSDXL(character.personality_notes);
    if (notes) positiveParts.push(notes);
  }

  // Cinematic notes
  if (character.cinematic_notes) {
    const notes = cleanPromptForSDXL(character.cinematic_notes);
    if (notes) positiveParts.push(notes);
  }

  // Style preset -> SDXL style keywords
  if (character.style_preset_id) {
    positiveParts.push(getStyleKeywords(character.style_preset_id));
  }

  // Consistency locks
  const locked = character.consistency_settings;
  const isStrict = character.consistency_lock;
  if (locked && isStrict) {
    if (locked.face) positiveParts.push('same face, identical facial features, same facial structure');
    if (locked.hairstyle) positiveParts.push('same hairstyle, same hair color, same hair length');
    if (locked.eye_color) positiveParts.push('same eye color, same iris color');
    if (locked.clothing && !outfitId && !userOverrideOutfit) positiveParts.push('same clothing, same outfit, same colors');
    if (locked.body_proportions) positiveParts.push('same body type, same proportions, same height, same build');
    if (locked.animation_style) positiveParts.push('same art style, same rendering style');
    if (locked.color_palette) positiveParts.push('same color palette, same skin tone, same hair color, same eye color');
  } else {
    positiveParts.push('consistent character identity, same character design');
  }

  // ---------- NEGATIVE PROMPT ----------
  const negativeParts: string[] = [
    'blurry, low quality, distorted, deformed',
    'different character, different person, wrong character',
    'different face, different hairstyle, different hair color',
    'different outfit, different clothes, wrong clothing',
    'mutated anatomy, extra fingers, extra limbs, missing fingers',
    'duplicate body, clone, multiple characters, two people',
    'character mutation, identity change, face change',
    'inconsistent character, inconsistent design',
    'amateur, bad anatomy, ugly, poorly drawn',
  ];

  // STRONG gender blocking
  if (gender === 'male') {
    negativeParts.push('female, woman, girl, feminine face, feminine features, long feminine hair, makeup, lipstick, blush, mascara, eyeliner, breasts, curvy body, feminine curves, high heels, dress, skirt, earrings, nail polish, cleavage');
  } else if (gender === 'female') {
    negativeParts.push('male, man, boy, masculine face, beard, mustache, masculine features, broad shoulders, deep voice, stubble');
  }

  // Consistency negatives
  if (locked && isStrict) {
    if (locked.face) negativeParts.push('different face, changed face, face mutation');
    if (locked.hairstyle) negativeParts.push('different hairstyle, different hair color, bald, hat covering hair');
    if (locked.eye_color) negativeParts.push('different eye color, heterochromia');
    if (locked.clothing && !outfitId && !userOverrideOutfit) negativeParts.push('different clothing, no outfit, naked, costume change');
    if (locked.body_proportions) negativeParts.push('different body type, different height, different build');
  }

  // Style-appropriate negative blocking
  if (character.style_preset_id) {
    const sk = character.style_preset_id.toLowerCase();
    if (['pixar', 'disney', 'cinematic_3d', 'kids', 'cartoon', 'stylized'].some(s => sk.includes(s))) {
      negativeParts.push('photorealistic, realistic skin texture, pores, realistic proportions, live action, real human');
    }
    if (['anime'].some(s => sk.includes(s))) {
      negativeParts.push('3D render, photorealistic, Pixar style, Disney style, realistic proportions, subsurface scattering, ray tracing, unreal engine, CGI, live action, real human');
    }
    if (['realistic', 'semi_realistic'].some(s => sk.includes(s))) {
      negativeParts.push('cartoon, 3D render, claymation, anime, cel shaded, toon shaded, stylized');
    }
  }

  return {
    positive: cleanPromptForSDXL(positiveParts.join(', ')),
    negative: cleanPromptForSDXL(negativeParts.join(', ')),
  };
}

/**
 * Build a compact character prompt for use in scene prompts.
 * English-only, SDXL-optimized.
 */
export function buildCompactCharacterPrompt(character: Character, outfitId?: string): string {
  const gender = detectGender(character);
  const selectedOutfit = outfitId
    ? character.outfits?.find(o => o.id === outfitId)
    : character.outfits?.[0];
  const outfit = selectedOutfit?.name || '';
  const genderPrefix = gender === 'male' ? 'male character' : gender === 'female' ? 'female character' : 'character';
  const parts: string[] = [
    genderPrefix,
    character.description ? cleanPromptForSDXL(character.description) : '',
  ];
  if (outfit) parts.push(`wearing ${cleanPromptForSDXL(outfit)}`);
  if (character.consistency_lock) parts.push('same appearance, locked design');
  return cleanPromptForSDXL(parts.filter(Boolean).join(', '));
}

/**
 * Inject character consistency into a scene prompt.
 * Output is ENGLISH-ONLY, SDXL-optimized.
 */
export function injectCharacterConsistency(
  scenePrompt: string,
  characters: Character[],
  characterOutfits?: Record<string, string>
): { prompt: string; negative: string; referenceImages: string[] } {
  if (characters.length === 0) {
    return { prompt: cleanPromptForSDXL(scenePrompt), negative: '', referenceImages: [] };
  }

  const userMentionsOutfit = hasOutfitDescription(scenePrompt);

  const referenceImages: string[] = [];
  for (const ch of characters) {
    if (ch.image_url && !referenceImages.includes(ch.image_url)) referenceImages.push(ch.image_url);
    if (ch.reference_images?.length) {
      for (const img of ch.reference_images) {
        if (!referenceImages.includes(img)) referenceImages.push(img);
      }
    }
  }

  const charPrompts = characters.map(ch =>
    userMentionsOutfit
      ? buildCharacterConsistencyPrompt(ch, characterOutfits?.[ch.id], true)
      : buildCharacterConsistencyPrompt(ch, characterOutfits?.[ch.id])
  );
  const charNegatives = charPrompts.map(p => p.negative);
  const combinedNegative = [...new Set(charNegatives.flatMap(n => n.split(', ').map(s => s.trim())))].join(', ');

  // Build English-only character visual summary
  // Patch A: style removed from scene augment.
  // Style is carried by buildCharacterConsistencyPrompt only.
  // Adding style here caused triple Pixar/Disney injection per scene.
  const sceneAugmentParts = characters.map((ch, i) => {
    const gender = detectGender(ch);
    const prefix = gender === 'male' ? 'male character' : gender === 'female' ? 'female character' : 'character';
    const desc = ch.description ? cleanPromptForSDXL(ch.description) : '';
    return `${prefix}: ${desc}`;
  });
  const sceneAugment = sceneAugmentParts.join('; ');

  // Clean scene prompt (strip Arabic, markers)
  const cleanScene = cleanPromptForSDXL(scenePrompt);
  const finalPrompt = [cleanScene, sceneAugment].filter(Boolean).join('. ');

  return {
    prompt: finalPrompt,
    negative: combinedNegative,
    referenceImages,
  };
}

/**
 * Detect if the user's prompt contains clothing/outfit descriptions.
 * Checks for common clothing keywords.
 */
export function hasOutfitDescription(prompt: string): boolean {
  if (!prompt) return false;
  const lower = prompt.toLowerCase();
  const clothingKeywords = [
    'wearing', 'dressed in', 'clothed in', 'outfit', 'costume',
    'shirt', 't-shirt', 'pants', 'jeans', 'dress', 'skirt', 'jacket', 'coat',
    'shoes', 'boots', 'hat', 'cap', 'scarf', 'socks', 'gloves',
    'قميص', 'بنطال', 'جينز', 'فستان', 'تنورة', 'جاكيت', 'قبعة', 'حذاء',
    'robe', 'uniform', 'armor', 'suit', 'tie', 'belt',
    'red shirt', 'blue shirt', 'white shirt', 'black shirt',
    'قميص أحمر', 'قميص أزرق', 'فستان أحمر',
  ];
  return clothingKeywords.some(keyword => lower.includes(keyword));
}

/**
 * Detect character gender from description, tags, and name — handles Arabic + English + name inference
 */
function detectGender(character: Character): string {
  const text = `${character.description} ${character.tags?.join(' ')} ${character.personality_notes || ''}`.toLowerCase();
  const name = (character.name || '').toLowerCase();

  // Keywords with scoring for robust detection
  const femaleEn = ['female', 'woman', 'girl', 'feminine', 'mother', 'sister', 'daughter', 'princess', 'queen', 'lady'];
  const femaleAr = ['أنثى', 'امرأة', 'بنت', 'فتاة', 'أنثوية', 'أم', 'أخت', 'ابنة', 'ملكة', 'أميرة', 'سيدة'];
  const maleEn = ['male', 'man', 'boy', 'masculine', 'father', 'brother', 'son', 'prince', 'king', 'young man', 'handsome', 'gentleman'];
  const maleAr = ['ذكر', 'رجل', 'ولد', 'فتى', 'شاب', 'أب', 'أخ', 'ابن', 'ملك', 'أمير', 'وسيم', 'مهذب'];

  let femaleScore = 0;
  let maleScore = 0;

  for (const kw of femaleEn) { if (text.includes(kw)) femaleScore++; }
  for (const kw of femaleAr) { if (text.includes(kw)) femaleScore++; }
  for (const kw of maleEn) { if (text.includes(kw)) maleScore++; }
  for (const kw of maleAr) { if (text.includes(kw)) maleScore++; }

  if (femaleScore > maleScore) return 'female';
  if (maleScore > femaleScore) return 'male';

  // Fallback: known male names
  const maleNames = ['samir', 'ahmed', 'mohamed', 'mohammed', 'ali', 'hassan', 'hussain', 'omar', 'khalid',
    'abdullah', 'youssef', 'yusuf', 'ibrahim', 'ismail', 'adam', 'amir', 'karim', 'jamal',
    'tariq', 'bilal', 'anas', 'saad', 'hadi', 'mazin', 'noor',
    'سمير', 'أحمد', 'محمد', 'علي', 'حسن', 'حسين', 'عمر', 'خالد', 'عبدالله', 'يوسف', 'إبراهيم',
    'إسماعيل', 'آدم', 'أمير', 'كريم', 'جمال', 'وليد', 'ماجد', 'فهد', 'سعود', 'بدر', 'أيمن',
    'طارق', 'بلال', 'أنس', 'سعد', 'هادي', 'مازن'];

  const femaleNames = ['fatima', 'aisha', 'layla', 'leila', 'mariam', 'maryam', 'sara', 'sarah',
    'huda', 'amira', 'zainab', 'khadija', 'salma', 'nadia', 'rana', 'dina', 'hala', 'lina',
    'فاطمة', 'عائشة', 'ليلى', 'نور', 'مريم', 'سارة', 'هدى', 'أميرة', 'زينب', 'خديجة',
    'سلمى', 'نادية', 'رنا', 'دينا', 'هالة', 'لينا'];

  if (maleNames.some(n => name.includes(n))) return 'male';
  if (femaleNames.some(n => name.includes(n))) return 'female';

  return 'person';
}

/**
 * Validate character has required consistency fields
 */
export function validateCharacterConsistency(character: Character): {
  isValid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  if (!character.description) missingFields.push('description');
  if (!character.image_url) missingFields.push('reference_image');

  const isValid = missingFields.length === 0;

  if (isValid) {
    console.log('[CHARACTER CONSISTENCY READY]', character.name);
  } else {
    console.warn('[CHARACTER INCOMPLETE]', character.name, 'Missing:', missingFields.join(', '));
  }

  return { isValid, missingFields };
}

/**
 * Link reference image to character
 */
export function linkCharacterReference(
  character: Character,
  imagePath: string
): Character {
  console.log('[REFERENCE LINKED]', character.name, '→', imagePath);
  
  return {
    ...character,
    image_url: imagePath,
    updated_at: new Date().toISOString()
  };
}

/**
 * Generate character asset filename
 */
export function generateCharacterAssetFilename(characterName: string, extension: string = 'png'): string {
  const sanitized = characterName.replace(/[^a-zA-Z0-9\u0600-\u06FF_]/g, '_');
  const timestamp = Date.now();
  return `char-${sanitized}-${timestamp}.${extension}`;
}

/**
 * Get character asset path
 */
export function getCharacterAssetPath(filename: string): string {
  return `data/projects/default-project/assets/characters/${filename}`;
}

// =================================================================
// ================ CHARACTER BIBLE / PORTRAIT PROMPTS ==============
// =================================================================

import type { CharacterBibleEntry } from '../../types';

/**
 * Build a portrait (reference image) prompt for a CharacterBibleEntry.
 * This is used ONCE to generate the master character reference image.
 * Output: clean, full-body or half-body portrait, neutral pose, simple background.
 */
export function buildCharacterPortraitPrompt(entry: CharacterBibleEntry, styleFamily?: string): string {
  // Patch A-1: normalize gender before building prompt.
  // LLM extraction may return 'man'/'boy' instead of canonical 'male'.
  const rawGender = (entry.gender || '').toLowerCase();
  const resolvedGender =
    ['male', 'man', 'boy', 'masculine'].includes(rawGender) ? 'male' :
    ['female', 'woman', 'girl', 'feminine'].includes(rawGender) ? 'female' : 'person';

  // Fix 2: age-aware gender anchor — adult male must not say 'boy', adult female must not say 'girl'.
  const isAdultChar = entry.age >= 18;
  const genderAnchor =
    resolvedGender === 'male'
      ? isAdultChar
        ? 'male character, man, masculine, adult male face, adult male features'
        : 'male character, boy, masculine, child face, child facial features'
      : resolvedGender === 'female'
        ? isAdultChar
          ? 'female character, woman, feminine, adult female face, adult female features'
          : 'female character, girl, feminine, child face, child facial features'
        : 'person';

  const ageLabel = entry.age > 0 ? `${entry.age} year old` : '';
  // Phase 1: trait hierarchy reorder.
  // SDXL weights tokens by position. Order: gender+age, hair+eyes, description, outfit, style, prompt.
  // Before: outfit before hair/eyes; art_style immediately after eyes.
  // After:  [1] gender+age  [2] hair+eyes  [3] description  [4] outfit  [5] style  [6] prompt
  const parts: string[] = [
    // [1] Gender + age + character_type anchor (highest positional weight)
    // character_type ('teenager', 'boy', 'child') resists Pixar softening toward generic child.
    `${genderAnchor}${ageLabel ? `, ${ageLabel}` : ''}${entry.character_type ? `, ${entry.character_type}` : ''}`,
    // [2a] Structured face traits from appearance_traits (locked fields, highest specificity)
    entry.appearance_traits?.hairstyle ? entry.appearance_traits.hairstyle + ' hair' : '',
    entry.appearance_traits?.hair_color ? entry.appearance_traits.hair_color + ' hair color' : '',
    entry.appearance_traits?.eye_color ? entry.appearance_traits.eye_color + ' eyes' : '',
    entry.appearance_traits?.facial_structure ? entry.appearance_traits.facial_structure : '',
    entry.appearance_traits?.age_range ? entry.appearance_traits.age_range : '',
    // [2b] Top-level face traits (fallback when appearance_traits empty)
    entry.hair ? `${entry.hair} hair` : '',
    entry.eyes ? `${entry.eyes} eyes` : '',
    // [3] General visual description
    entry.visual_description,
    // [4] Outfit before style (identity beats generic archetype)
    entry.outfit ? `wearing ${entry.outfit}` : '',
    entry.appearance_traits?.outfit ? entry.appearance_traits.outfit : '',
    // [5] Art style (after all identity tokens)
    entry.art_style,
    // [6] Outfit re-anchor after style: paraphrased to survive cleanPromptForSDXL deduplication.
    // 'dressed in' vs 'wearing' = different word tokens = both survive dedup = double outfit weight.
    entry.outfit ? `dressed in ${entry.outfit}` : '',
    // [7] Full character prompt (cinematic/quality tokens last)
    entry.character_prompt,
    // Portrait intent: single character, single pose, single view.
    // Must appear explicitly to prevent SDXL from interpreting reinforced identity
    // as a character turnaround/reference sheet request.
    'single character portrait, one character only, one pose, one view, centered composition, upper body portrait',
    // Style-family constraints
    ...(styleFamily === 'cartoon'
      ? [
          'Pixar-style 3D animated character, Disney-inspired expressive face, 3D stylized render, volumetric lighting, soft cinematic lighting, subsurface scattering, high-end animated film',
          'cute proportions, slightly larger head, big expressive eyes, smooth plastic-like 3D shading',
          'colorful family animation movie style, rounded features, stylized anatomy, toy-like materials',
          'clean simple background, solid color or gradient background',
        ]
      : [
          'clean simple background, solid color or gradient background',
          'consistent lighting, high quality, detailed, sharp focus',
        ]
    ),
  ].filter(Boolean);
  return cleanPromptForSDXL(parts.join(', '));
}

/**
 * Build a negative prompt for a character portrait generation.
 */
export function buildCharacterPortraitNegative(entry: CharacterBibleEntry, styleFamily?: string): string {
  // Patch A-2: opposite-gender blocking added. Previously absent.
  // Without this the model had no instruction to avoid opposite-gender features.
  const rawGender = (entry.gender || '').toLowerCase();
  const resolvedGender =
    ['male', 'man', 'boy', 'masculine'].includes(rawGender) ? 'male' :
    ['female', 'woman', 'girl', 'feminine'].includes(rawGender) ? 'female' : 'person';

  const genderNegative =
    resolvedGender === 'male'
      ? 'female, woman, girl, feminine face, feminine features, long feminine hair, makeup, lipstick, mascara, breasts, feminine curves, dress, skirt, cleavage'
      : resolvedGender === 'female'
      ? 'male, man, boy, masculine face, beard, mustache, masculine features, broad shoulders, stubble'
      : '';

  // Patch 3: anti-beautification negatives.
  // Prevents SDXL+LoRA+style from drifting toward generic cinematic perfection.
  const antiBeautification = 'perfect face, flawless skin, beauty makeup, hyper attractive, glamour portrait, airbrushed, perfect symmetry, idealized features, disney princess face';

  const negs = [
    genderNegative,
    antiBeautification,
    entry.negative_prompt,
    'complex background, messy background, multiple characters',
    'action pose, running, jumping, fighting',
    // Patch 3: outfit-collapse negatives. Prevents SDXL from defaulting to generic clothing.
    // 'generic hoodie' instead of 'hoodie' to avoid blocking legitimate hoodie outfits.
    'generic hoodie, plain jacket, simple outfit, plain clothing, generic clothes, no accessories, bare neck',
    'blurry, low quality, deformed, bad anatomy',
    'extra limbs, missing limbs, distorted face',
    'nsfw, nude, explicit',
    // Portrait intent negatives: prevent turnaround/reference sheet interpretation.
    // Added after reinforced identity traits caused SDXL to interpret prompt as ref sheet.
    'character sheet, turnaround sheet, reference sheet, multiple poses, multiple angles, front side back views, model sheet, lineup sheet, concept board, pose sheet, expression sheet, multiple views, orthographic views, rotation sheet, character rotation',
    ...(styleFamily === 'cartoon'
      ? [
          'anime, manga, 2D, illustration, comic, sketch, line art, flat shading, cel shading, black outline, monochrome, drawing, ink, panel, comic page, photorealistic, real human, realistic skin, skin pores',
          'live action, fashion catalog, studio photo, portrait photography',
          'documentary, realistic proportions, adult proportions',
        ]
      : []
    ),
  ].filter(Boolean);
  return cleanPromptForSDXL(negs.join(', '));
}

/**
 * Build a scene injection prompt from a CharacterBibleEntry.
 * This is a short descriptor injected into scene prompts to maintain consistency.
 * It references the saved reference image and locks age/outfit/hair/eyes/style.
 *
 * Uses locked appearance_traits if available for stronger consistency.
 * Always appends consistency tokens: "same character, same face, same hairstyle..."
 */
export function buildSceneInjectionPrompt(entry: CharacterBibleEntry): string {
  const genderLabel = entry.gender === 'male' ? 'male character' : entry.gender === 'female' ? 'female character' : 'character';
  const ageLabel = entry.age > 0 ? `${entry.age} year old` : '';
  
  // Use locked appearance traits if available
  const traits = entry.appearance_traits;
  const hasTraits = traits && (traits.hairstyle || traits.eye_color || traits.outfit);

  // Sanitize scene_injection_prompt: remove corrupted tokens like "to, to, to", repeated commas, empty attributes
  const rawInjection = entry.scene_injection_prompt || '';
  const sanitizedInjection = rawInjection
    .replace(/(\bto\b\s*,?\s*){2,}/gi, '')  // remove repeated "to, to, to"
    .replace(/,{2,}/g, ',')                       // collapse repeated commas
    .replace(/,\s*,/g, ',')                       // remove comma-space-comma
    .replace(/^[,\s]+/, '')                       // trim leading commas/spaces
    .replace(/[,\s]+$/, '')                       // trim trailing commas/spaces
    .trim();

  const parts: string[] = [
    `${genderLabel}${ageLabel ? `, ${ageLabel}` : ''}`,
    entry.visual_description,
    // Use locked traits for stronger consistency
    hasTraits ? `${traits.hairstyle}, ${traits.hair_color} hair` : (entry.hair ? `${entry.hair} hair` : ''),
    hasTraits ? `${traits.eye_color} eyes` : (entry.eyes ? `${entry.eyes} eyes` : ''),
    hasTraits ? `wearing ${traits.outfit}` : (entry.outfit ? `wearing ${entry.outfit}` : ''),
    entry.art_style,
    sanitizedInjection || undefined,
    // Lock appearance across ALL scenes - always included
    'same character, same face, same hairstyle, same eye color, same outfit, same proportions, consistent identity',
    'identical appearance to reference image, character design locked',
  ].filter(Boolean);
  return cleanPromptForSDXL(parts.join(', '));
}

/**
 * Build the full scene negative prompt that blocks character changes.
 * Uses locked appearance traits if available for stronger blocking.
 */
export function buildSceneInjectionNegative(entry: CharacterBibleEntry): string {
  const traits = entry.appearance_traits;
  const hasTraits = traits && (traits.hairstyle || traits.eye_color);
  
  const negs = [
    entry.negative_prompt,
    'different character, wrong character, different person',
    'different face, different hairstyle, different hair color',
    'different eye color, different outfit, different clothes',
    'age change, younger, older, different age',
    'character mutation, identity change, face change, inconsistent appearance',
    // Specific blocking based on locked traits
    ...(hasTraits ? [
      `different ${traits.hairstyle} hairstyle`,
      `different hair color than ${traits.hair_color}`,
      `different eye color than ${traits.eye_color}`,
      `different outfit than ${traits.outfit}`,
    ] : []),
    'blurry, low quality, deformed, bad anatomy',
  ].filter(Boolean);
  return cleanPromptForSDXL(negs.join(', '));
}

/**
 * Inject CharacterBibleEntry characters into a scene prompt.
 * This is used during scene generation (not character portrait generation).
 * Returns the augmented prompt + negative + reference images + character identity payload to use.
 */
export function injectBibleCharactersIntoScene(
  scenePrompt: string,
  bibleEntries: CharacterBibleEntry[]
): {
  prompt: string;
  negative: string;
  referenceImages: string[];
  characters: Array<{
    id: string;
    reference_image_path: string | null;
    reference_image_for_ipadapter: string | null;
    appearance_traits: CharacterAppearanceTraits;
    identityLocked: boolean;
  }>;
} {
  if (bibleEntries.length === 0) {
    return { prompt: cleanPromptForSDXL(scenePrompt), negative: '', referenceImages: [], characters: [] };
  }
  // Patch 3: hard cap at 2 characters. Callers should pre-filter by scene.characters IDs.
  if (bibleEntries.length > 2) {
    console.warn('[INJECT BIBLE] Capping ' + bibleEntries.length + ' characters at 2 to prevent prompt overflow.');
  }
  const entries = bibleEntries.slice(0, 2);

  const referenceImages: string[] = entries
    .map((e) => e.reference_image_path)
    .filter((p): p is string => p !== null);

    // Build character identity payload for scene generation
  const characterIdentityPayload = entries.map((entry) => ({
    id: entry.id,
    reference_image_path: entry.reference_image_path,
    reference_image_for_ipadapter: entry.reference_image_for_ipadapter,
    appearance_traits: entry.appearance_traits,
    identityLocked: entry.identityLocked,
  }));

  // Build character descriptors for scene
  const charParts = entries.map((entry) => buildSceneInjectionPrompt(entry));
  const sceneAugment = charParts.join('; ');

  // Combine negatives
  const allNegatives = entries.map((entry) => buildSceneInjectionNegative(entry));
  const combinedNegative = [...new Set(allNegatives.flatMap((n) => n.split(', ').map((s) => s.trim())))].join(', ');

  const cleanScene = cleanPromptForSDXL(scenePrompt);
  const finalPrompt = [cleanScene, sceneAugment].filter(Boolean).join('. ');

  return {
    prompt: finalPrompt,
    negative: combinedNegative,
    referenceImages,
    characters: characterIdentityPayload,
  };
}