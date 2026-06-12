with open('src/services/generation/CharacterImageGenerator.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add ComfyUIExecutor import (should already exist from previous run)
if 'ComfyUIExecutor' not in content:
    content = content.replace(
        "from './GenerationProgressTracker';\nimport { ComfyUIProvider } from '../../infrastructure/ai/providers/ComfyUIProvider';",
        "from './GenerationProgressTracker';\nimport { ComfyUIExecutor, ComfyUIExecutorConfig } from '../../infrastructure/ai/providers/ComfyUIExecutor';\nimport { ComfyUIProvider } from '../../infrastructure/ai/providers/ComfyUIProvider';"
    )
    print('1. Import added')
else:
    print('1. Import already present')

# 2. Remove OLD identity router block (lines 237-250) and replace with executor setup
old_identity_block = """        // Determine if we have a reference image to use for IPAdapter
        const hasReferenceImage = !!(entry.reference_image_path && entry.reference_image_path.trim().length > 0);
        const shouldUseIPAdapter = hasReferenceImage || !!isIdentityLocked;

        console.log('[IDENTITY ROUTER] Character:', entry.name);
        console.log('[IDENTITY ROUTER] identityLocked:', isIdentityLocked);
        console.log('[IDENTITY ROUTER] hasReferenceImage:', hasReferenceImage);
        console.log('[IDENTITY ROUTER] shouldUseIPAdapter:', shouldUseIPAdapter);

        // Select workflow based on reference image availability
        const selectedWorkflow = selectIdentityWorkflow(shouldUseIPAdapter);
        const selectedCheckpoint = selectIdentityCheckpoint();
        const workflowFamily = 'pixar-disney';
        const activeStyleIds = isIdentityLocked ? entry.style_preset_ids : (stylePresetIds || []);
        const debugSeed = isIdentityLocked ? entry.seed! : (entry.seed ?? Math.floor(Math.random() * 2147483647));"""

new_identity_block = """        // Determine if we have a reference image to use for IPAdapter
        const hasReferenceImage = !!(entry.reference_image_path && entry.reference_image_path.trim().length > 0);
        const shouldUseIPAdapter = hasReferenceImage || !!isIdentityLocked;

        console.log('[IDENTITY ROUTER] Character:', entry.name);
        console.log('[IDENTITY ROUTER] identityLocked:', isIdentityLocked);
        console.log('[IDENTITY ROUTER] hasReferenceImage:', hasReferenceImage);
        console.log('[IDENTITY ROUTER] shouldUseIPAdapter:', shouldUseIPAdapter);

        // Select workflow based on reference image availability
        // EXECUTOR: use pixar_disney_*.json files directly (no dynamic generation)
        const resolvedWorkflow = shouldUseIPAdapter
          ? 'workflows/pixar_disney_ipadapter_v1.json'
          : 'workflows/pixar_disney_stable.json';
        const selectedCheckpoint = selectIdentityCheckpoint();
        const workflowFamily = 'pixar-disney';
        const activeStyleIds = isIdentityLocked ? entry.style_preset_ids : (stylePresetIds || []);
        const debugSeed = isIdentityLocked ? entry.seed! : (entry.seed ?? Math.floor(Math.random() * 2147483647));"""

assert old_identity_block in content, 'Old identity block not found!'
content = content.replace(old_identity_block, new_identity_block)
print('2. Identity block replaced (selectIdentityWorkflow -> resolvedWorkflow)')

# 3. Remove the DUPLICATE executor section (the one that re-declares hasReferenceImage and shouldUseIPAdapter)
# This is the section at ~line 303 that was inserted by tmp_patch4.py
dup_section_start = '        // ===================================================================\n        // COMFYUI EXECUTOR'
dup_section_end = '        // ========== FINAL PROMPT DEBUG =========='

start_idx = content.find(dup_section_start)
end_idx = content.find(dup_section_end, start_idx + 10) if start_idx >= 0 else -1

if start_idx >= 0 and end_idx >= 0:
    # Remove from start up to and including the comment line
    before = content[:start_idx]
    after = content[end_idx:]
    content = before + after
    print(f'3. Duplicate executor section removed (bytes {start_idx} to {end_idx})')
else:
    print(f'3. Duplicate executor section NOT FOUND (start={start_idx}, end={end_idx})')
    # Debug
    idx = content.find('COMFYUI EXECUTOR')
    if idx >= 0:
        print(f'  Found at offset {idx}')
        print(repr(content[idx:idx+400]))

# 4. Replace the OLD provider call with executor call
old_call = """        // Call provider.generateImage directly
                        // Build workflow inputs for IPAdapter reference image injection
        const workflowInputs: Record<string, any> = {};
        if (shouldUseIPAdapter && hasReferenceImage && entry.reference_image_path) {
          // Inject the character's reference image into the Load Image node (node 13)
          workflowInputs['13'] = {
            class_type: 'LoadImage',
            inputs: {
              image: entry.reference_image_path,
            }
          };
          console.log('[IPADAPTER INJECTION] Reference image path:', entry.reference_image_path);
          console.log('[IPADAPTER INJECTION] Injected into node 13 (LoadImage)');
        }

        const imageResult = await provider.generateImage(finalPositivePrompt, {
          negativePrompt: finalNegativePrompt,
          seed: debugSeed,
          model: selectedCheckpoint,
          workflowPath: selectedWorkflow,
          width: genWidth,
          height: genHeight,
          workflowInputs: Object.keys(workflowInputs).length > 0 ? workflowInputs : undefined,
        });"""

new_call = """        // Call executor.generateImage directly
        // Build workflowInputs for IPAdapter: inject LoadImage with reference
        const workflowInputs: Record<string, any> = {};
        if (shouldUseIPAdapter && hasReferenceImage && entry.reference_image_path) {
          const refFilename = entry.reference_image_path.split('/').pop()?.split('\\\\').pop() || 'reference.png';
          workflowInputs['13'] = {
            class_type: 'LoadImage',
            inputs: {
              image: refFilename,
            },
          };
          console.log('[EXECUTOR IPADAPTER] Injecting LoadImage node with:', refFilename);
        }

        const imageResult = await executor.generateImage(finalPositivePrompt, {
          negativePrompt: finalNegativePrompt,
          seed: debugSeed,
          workflowPath: resolvedWorkflow,
          width: genWidth,
          height: genHeight,
          workflowInputs: Object.keys(workflowInputs).length > 0 ? workflowInputs : undefined,
        });"""

assert old_call in content, 'Old call block not found!'
content = content.replace(old_call, new_call)
print('4. Provider call replaced with executor call')

# 5. Change log lines from CALLING COMFYUI to CALLING COMFYUI EXECUTOR
content = content.replace(
    "console.log('========== CALLING COMFYUI ==========');",
    "console.log('========== CALLING COMFYUI EXECUTOR ==========');"
)
content = content.replace(
    "console.log('[MODEL TO COMFYUI]', selectedCheckpoint);",
    "console.log('[MODEL (from workflow)]', selectedCheckpoint);"
)
content = content.replace(
    "console.log('[WORKFLOW TO COMFYUI]', selectedWorkflow);",
    "console.log('[WORKFLOW TO COMFYUI]', resolvedWorkflow);"
)
content = content.replace(
    "console.log('======================================');",
    "console.log('===============================================');"
)

# 6. Add executor instantiation BEFORE the workflowInputs/call block
# Find where to place it: just before "// Call executor.generateImage directly"
executor_instantiation = """        const executor = new ComfyUIExecutor({
          baseUrl: 'http://127.0.0.1:8188',
          clientId: 'seri-ai-char-' + Date.now() + '',
          connectionTimeout: 10000,
        });"""

# Place it right before "// Call executor.generateImage directly"
content = content.replace(
    "        // Call executor.generateImage directly",
    executor_instantiation + "\n\n        // Call executor.generateImage directly"
)

# Also need to remove the old `new ComfyUIProvider` that still exists somewhere
# Let me do a more aggressive check
import re
# Check for any remaining provider.generateImage
if 'provider.generateImage' in content:
    print('ERROR: provider.generateImage still present!')
    # Find it
    idx = content.find('provider.generateImage')
    print(repr(content[idx-50:idx+100]))
    exit(1)

# Check for duplicate const
# Count occurrences
has_ref_count = content.count('const hasReferenceImage')
should_ip_count = content.count('const shouldUseIPAdapter')
resolved_wf_count = content.count('const resolvedWorkflow')
print(f'5. Verification: const hasReferenceImage={has_ref_count}, const shouldUseIPAdapter={should_ip_count}, const resolvedWorkflow={resolved_wf_count}')

# Remove old console.log comments that reference the old style
# Fix the 'or' -> '||' if present
if "' or '" in content:
    content = content.replace("' or '", "' || '")

# Verify no errors
assert content.count('const hasReferenceImage') == 1, f'Duplicate declaration for hasReferenceImage: {content.count("const hasReferenceImage")}'
assert content.count('const shouldUseIPAdapter') == 1, f'Duplicate declaration for shouldUseIPAdapter: {content.count("const shouldUseIPAdapter")}'
assert content.count('const resolvedWorkflow') == 1, f'Duplicate declaration for resolvedWorkflow'

print('All replacements verified. Writing file...')

with open('src/services/generation/CharacterImageGenerator.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')

# Final counts
print(f'ComfyUIExecutor: {content.count("ComfyUIExecutor")}')
print(f'executor.generateImage: {content.count("executor.generateImage")}')
print(f'resolvedWorkflow: {content.count("resolvedWorkflow")}')
print(f'provider.generateImage: {content.count("provider.generateImage")}')
