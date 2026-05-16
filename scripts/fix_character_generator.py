import re

with open('src/services/generation/CharacterImageGenerator.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix import - match any existing import from StyleWorkflowRouter
pattern = r'import \{([^}]+)\} from \"\.\./style/StyleWorkflowRouter\";'
def fix_import(m):
    imports = m.group(1).strip()
    if 'selectIdentityWorkflow' not in imports:
        imports += ', selectIdentityWorkflow, selectIdentityCheckpoint'
    return 'import {' + imports + '} from "../style/StyleWorkflowRouter";'
content = re.sub(pattern, fix_import, content)
print('[PASS] Import updated')

# 2. Replace STYLE WORKFLOW ROUTING section
old_start = '// ========== STYLE WORKFLOW ROUTING =========='
dim_start = content.find('// ========== WORKFLOW DIMENSION DIAGNOSTIC ==========')
if dim_start < 0:
    print('[FAIL] Cannot find DIMENSION DIAGNOSTIC')
    exit(1)

new_section = '''        // ========== IDENTITY WORKFLOW ROUTING ==========
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
            'Character "' + entry.name + '" has no reference image. ' +
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

'''

start_pos = content.find(old_start)
content = content[:start_pos] + new_section + content[dim_start:]
print('[PASS] Workflow routing section replaced')

# 3. Update the generateImage call
old_call_start = content.find('const imageResult = await provider.generateImage(finalPositivePrompt, {')
if old_call_start >= 0:
    end_call = content.find('        });', old_call_start)
    if end_call >= 0:
        end_call += len('        });')
        new_full_block = '''                // Build workflow inputs for IPAdapter reference image injection
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
        });'''
        
        content = content[:old_call_start] + new_full_block + content[end_call:]
        print('[PASS] generateImage call updated with IPAdapter injection')
    else:
        print('[FAIL] Cannot find end of generateImage call')
else:
    print('[WARN] Standard generateImage call not found')
    if 'workflowInputs' in content:
        print('[OK] Already has workflowInputs')

with open('src/services/generation/CharacterImageGenerator.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('[PASS] File written successfully')
print(f'[INFO] New file size: {len(content)} chars')
