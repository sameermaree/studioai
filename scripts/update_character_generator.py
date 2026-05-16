#!/usr/bin/env python3
"""Update CharacterImageGenerator.ts for IPAdapter workflow support"""

import re

with open('src/services/generation/CharacterImageGenerator.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update import to include selectIdentityWorkflow and selectIdentityCheckpoint
old_import = "import { selectCheckpoint, selectWorkflow, getPrimaryStyleFamily } from '../style/StyleWorkflowRouter';"
new_import = "import { selectCheckpoint, selectWorkflow, getPrimaryStyleFamily, selectIdentityWorkflow, selectIdentityCheckpoint } from '../style/StyleWorkflowRouter';"
if old_import in content:
    content = content.replace(old_import, new_import)
    print('[PASS] Import updated')
else:
    print('[WARN] Old import not found, checking if already updated...')
    # Try to find if it's already there
    if 'selectIdentityWorkflow' in content:
        print('[OK] Already has selectIdentityWorkflow')
    else:
        print('[FAIL] Import not found!')
        exit(1)

# 2. Replace the STYLE WORKFLOW ROUTING section
# Find the section start
old_start = "// ========== STYLE WORKFLOW ROUTING =========="
old_end = "if (!selectedCheckpoint.includes('dreamshaperXL')) {"

# Find exact positions
start_pos = content.find(old_start)
if start_pos < 0:
    print('[FAIL] Cannot find STYLE WORKFLOW ROUTING section')
    exit(1)

# Find the end of the old section - look for the closing brace of the warning block
# The section ends at the comment "// ========== BUILD PROMPTS =========="
build_prompts_pos = content.find("// ========== BUILD PROMPTS ==========", start_pos)
if build_prompts_pos < 0:
    print('[FAIL] Cannot find BUILD PROMPTS marker')
    exit(1)

# Find the last line of the old section before BUILD PROMPTS
# The old section ends with the pixar_disney_stable/dreamshaperXL warnings
# Find the last closing brace before BUILD PROMPTS
before_build = content[start_pos:build_prompts_pos]

# The old section includes the warning about default_txt2img.json
# Let's find the exact end by locating the comment after all warnings
dim_start = content.find("// ========== WORKFLOW DIMENSION DIAGNOSTIC ==========")
if dim_start < 0:
    print('[FAIL] Cannot find DIMENSION DIAGNOSTIC')
    exit(1)

# New section to replace everything between STYLE WORKFLOW ROUTING and WORKFLOW DIMENSION DIAGNOSTIC
new_section = """        // ========== IDENTITY WORKFLOW ROUTING ==========
        // Two modes:
        //   A) Normal character generation (no reference image):
        //      -> workflows/pixar_disney_stable.json (DreamShaperXL only)
        //   B) Locked/reference identity generation (has reference_image_path or identityLocked):
        //      -> workflows/pixar_disney_ipadapter_v1.json (DreamShaperXL + LoRA + IPAdapter)
        
        // Determine if we have a reference image to use for IPAdapter
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
        const debugSeed = isIdentityLocked ? entry.seed! : (entry.seed ?? Math.floor(Math.random() * 2147483647));
        
        console.log('[CONSISTENCY] seed:', debugSeed);
        console.log('[CONSISTENCY] workflow:', selectedWorkflow);
        console.log('[CONSISTENCY] checkpoint:', selectedCheckpoint);
        console.log('[CONSISTENCY] stylePresetIds:', activeStyleIds);
        
        // HARD VALIDATION: If IPAdapter workflow is selected, reference image path MUST exist
        if (selectedWorkflow.includes('ipadapter') && !hasReferenceImage) {
          const errMsg = 'IPAdapter identity workflow requires a reference image path. ' +
            'Character \"' + entry.name + '\" has no reference image. ' +
            'Generate a normal image first, then use identity mode.';
          console.error('[IDENTITY ERROR]', errMsg);
          throw new Error(errMsg);
        }
        
        // HARD VALIDATION: If no reference image, we MUST NOT use IPAdapter workflow
        if (!hasReferenceImage && selectedWorkflow.includes('ipadapter')) {
          const errMsg = 'Internal error: IPAdapter workflow selected without reference image. ' +
            'Falling back to stable workflow is not allowed. Aborting.';
          console.error('[IDENTITY ERROR]', errMsg);
          throw new Error(errMsg);
        }

"""

content = content[:start_pos] + new_section + content[dim_start:]

print('[PASS] Workflow routing section replaced')

# 3. Update the generateImage call to pass reference image for IPAdapter injection
old_gencall = """        const imageResult = await provider.generateImage(finalPositivePrompt, {
          negativePrompt: finalNegativePrompt,
          seed: debugSeed,
          model: selectedCheckpoint,
          workflowPath: selectedWorkflow,
          width: genWidth,
          height: genHeight,
        });"""

new_gencall = """        // Build workflow inputs for IPAdapter reference image injection
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

if old_gencall in content:
    content = content.replace(old_gencall, new_gencall)
    print('[PASS] generateImage call updated with IPAdapter injection')
else:
    print('[WARN] Old generateImage call not found - checking if already updated...')
    if 'workflowInputs' in content:
        print('[OK] Already has workflowInputs')
    else:
        print('[FAIL] generateImage call not found!')
        exit(1)

# 4. Remove the old pixar_disney_stable/dreamshaperXL warning (should already be gone)
# The old warnings were between the routing section and dimension diagnostic, which we removed in step 2

with open('src/services/generation/CharacterImageGenerator.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('[PASS] File written successfully')
print(f'[INFO] New file size: {len(content)} chars')
