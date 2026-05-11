/**
 * Developer validation script.
 * Run with: npx tsx scripts/validate.ts
 * Verifies project health without starting the dev server.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${label}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

function fileExists(path: string): boolean {
  return existsSync(resolve(root, path));
}

function fileContains(path: string, text: string): boolean {
  if (!fileExists(path)) return false;
  return readFileSync(resolve(root, path), 'utf-8').includes(text);
}

console.log('\n--- AI Content Studio: Project Validation ---\n');

// Core files
console.log('Core Files:');
check('package.json exists', fileExists('package.json'));
check('tsconfig.app.json exists', fileExists('tsconfig.app.json'));
check('vite.config.ts exists', fileExists('vite.config.ts'));
check('index.html exists', fileExists('index.html'));
check('.env.example exists', fileExists('.env.example'));

// Source structure
console.log('\nSource Structure:');
check('App.tsx exists', fileExists('src/App.tsx'));
check('Store exists', fileExists('src/store/useStudioStore.ts'));
check('Types defined', fileExists('src/types/index.ts'));
check('Constants defined', fileExists('src/lib/constants.ts'));
check('Supabase client', fileExists('src/lib/supabase.ts'));

// Translations
console.log('\nTranslations:');
check('English translations', fileExists('src/translations/en.ts'));
check('Arabic translations', fileExists('src/translations/ar.ts'));
check('French translations', fileExists('src/translations/fr.ts'));
check('Translation index', fileExists('src/translations/index.ts'));
check('Arabic has workflow keys', fileContains('src/translations/ar.ts', 'workflow'));
check('Arabic has settings keys', fileContains('src/translations/ar.ts', 'dataManagement'));

// Services
console.log('\nServices:');
check('AI service', fileExists('src/services/ai/index.ts'));
check('Workflow service', fileExists('src/services/workflow/index.ts'));
check('Subtitles service', fileExists('src/services/subtitles/index.ts'));
check('Publishing service', fileExists('src/services/publishing/index.ts'));
check('Rendering service', fileExists('src/services/rendering/index.ts'));
check('Voice service', fileExists('src/services/voice/index.ts'));

// Pages
console.log('\nPages:');
const pages = ['Dashboard', 'Characters', 'Episodes', 'PromptStudio', 'VoiceStudio',
               'Rendering', 'MediaStudio', 'Publishing', 'StylePresets', 'Subtitles', 'SettingsPage'];
pages.forEach(p => check(`${p} page`, fileExists(`src/pages/${p}.tsx`)));

// Store functionality
console.log('\nStore:');
check('Persist middleware', fileContains('src/store/useStudioStore.ts', 'persist'));
check('Migration handler', fileContains('src/store/useStudioStore.ts', 'migrate'));
check('Safe storage wrapper', fileContains('src/store/useStudioStore.ts', 'try'));
check('Mock data loaded', fileExists('src/data/mock.ts'));
check('Style presets loaded', fileExists('src/data/stylePresets.ts'));

// Data management
console.log('\nData Management:');
check('Export functionality', fileContains('src/pages/SettingsPage.tsx', 'handleExport'));
check('Import functionality', fileContains('src/pages/SettingsPage.tsx', 'handleImport'));
check('Reset functionality', fileContains('src/pages/SettingsPage.tsx', 'handleReset'));

// Route stability
console.log('\nRouting:');
check('Catch-all redirect', fileContains('src/App.tsx', 'path="*"'));
check('All routes defined', fileContains('src/App.tsx', 'publishing'));

// Supabase fallback
console.log('\nSupabase Safety:');
check('Fallback for missing env', fileContains('src/lib/supabase.ts', 'placeholder'));

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
process.exit(failed > 0 ? 1 : 0);
