import re, os

def main():
    filepath = 'src/infrastructure/ai/providers/ComfyUIProvider.ts'
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Update loadWorkflowFromFile fallback
    old = '''    // Fetch the workflow JSON file
    const response = await fetch(\/api/workflows/\\);
    if (!response.ok) {
      console.warn('[WORKFLOW LOADER] Failed to load', workflowPath, '- falling back to dynamic build');
      return this.buildPromptWorkflow({
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        width: params.width,
        height: params.height,
        seed: params.seed,
      });
    }
    
    const workflowData = await response.json();
    
    // Validate: must be an object with numeric keys and class_type on each node
    const isNativeFormat = typeof workflowData === 'object' && !Array.isArray(workflowData);
    if (!isNativeFormat) {
      console.warn('[WORKFLOW LOADER] Invalid workflow format - falling back to dynamic build');
      return this.buildPromptWorkflow({
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        width: params.width,
        height: params.height,
        seed: params.seed,
      });
    }'''
    
    new = '''    // Fetch the workflow JSON file
    const response = await fetch(\/api/workflows/\\);
    if (!response.ok) {
      // IPAdapter workflow MUST NOT fallback; it requires LoRA, IPAdapter, CLIP Vision, Load Image nodes
      const isIPAdapterWorkflow = workflowPath.includes('ipadapter');
      const errorMsg = isIPAdapterWorkflow
        ? 'IPAdapter workflow file "' + workflowPath + '" not found. ' +
          'File failed to load (HTTP ' + response.status + '). ' +
          'This workflow requires LoRA, IPAdapter, CLIP Vision, and Load Image nodes. ' +
          'Fallback to dynamic build is forbidden for IPAdapter workflows.'
        : 'Failed to load workflow file "' + workflowPath + '" - falling back to dynamic build';
      
      if (isIPAdapterWorkflow) {
        console.error('[WORKFLOW LOADER] FATAL:', errorMsg);
        throw new Error(errorMsg);
      }
      
      console.warn('[WORKFLOW LOADER]', errorMsg);
      return this.buildPromptWorkflow({
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        width: params.width,
        height: params.height,
        seed: params.seed,
      });
    }
    
    const workflowData = await response.json();
    
    // Validate: must be an object with numeric keys and class_type on each node
    const isNativeFormat = typeof workflowData === 'object' && !Array.isArray(workflowData);
    if (!isNativeFormat) {
      const isIPAdapterWorkflow = workflowPath.includes('ipadapter');
      const errorMsg = isIPAdapterWorkflow
        ? 'IPAdapter workflow file "' + workflowPath + '" has invalid format. ' +
          'Expected native ComfyUI API format with numeric keys and class_type. ' +
          'Fallback to dynamic build is forbidden for IPAdapter workflows.'
        : 'Invalid workflow format for "' + workflowPath + '" - falling back to dynamic build';
      
      if (isIPAdapterWorkflow) {
        console.error('[WORKFLOW LOADER] FATAL:', errorMsg);
        throw new Error(errorMsg);
      }
      
      console.warn('[WORKFLOW LOADER]', errorMsg);
      return this.buildPromptWorkflow({
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        width: params.width,
        height: params.height,
        seed: params.seed,
      });
    }'''
    
    if old in content:
        content = content.replace(old, new)
        print('[PASS] loadWorkflowFromFile fallback hardened')
    else:
        print('[WARN] Fallback section not found - checking if already updated...')
        if 'IPAdapter workflow file' in content:
            print('[OK] Already updated')
        else:
            print('[FAIL] Cannot find fallback section')
            # Debug
            idx = content.find('/api/workflows/')
            if idx >= 0:
                print(f'  Found /api/workflows/ at position {idx}')
            exit(1)
    
    # 2. Update PRE-QUEUE section
    old_pq = '// ========== ACTIVE WORKFLOW VERIFICATION (before queue) =========='
    new_pq_start = '''        // ========== ACTIVE WORKFLOW VERIFICATION (before queue) ==========
    const checkpointFromNode = workflow["4"]?.inputs?.ckpt_name || 
                               Object.values(workflow).find((n: any) => n.class_type === 'CheckpointLoaderSimple')?.inputs?.ckpt_name || 
                               'NOT FOUND';
    const emptyLatentNode = workflow["5"] || Object.values(workflow).find((n: any) => n.class_type === 'EmptyLatentImage');
    const activeWidth = emptyLatentNode?.inputs?.width || 'UNKNOWN';
    const activeHeight = emptyLatentNode?.inputs?.height || 'UNKNOWN';
    const workflowFileUsed = options?.workflowPath || 'DYNAMIC (no file)';
    const isSdxlModel = (checkpointFromNode as string).toLowerCase().includes('xl');
    const isIPAdapterWorkflow = workflowFileUsed.includes('ipadapter');
    
    // Detect IPAdapter and LoRA nodes dynamically
    const hasLoRANode = Object.values(workflow).some((n: any) => n.class_type === 'LoraLoader');
    const hasIPAdapterNode = Object.values(workflow).some((n: any) => n.class_type === 'IPAdapterAdvanced');
    const hasIPAdapterModelLoader = Object.values(workflow).some((n: any) => n.class_type === 'IPAdapterModelLoader');
    const hasCLIPVisionLoader = Object.values(workflow).some((n: any) => n.class_type === 'CLIPVisionLoader');
    const hasLoadImageNode = Object.values(workflow).some((n: any) => n.class_type === 'LoadImage');
    
    // Find reference image path from LoadImage node if present
    const loadImageNode = Object.values(workflow).find((n: any) => n.class_type === 'LoadImage');
    const referenceImagePath = loadImageNode?.inputs?.image || 'NONE';
    
    console.log('');
    console.log('========== PRE-QUEUE WORKFLOW VERIFICATION ==========');
    console.log('[ACTIVE WORKFLOW FILE]', workflowFileUsed);
    console.log('[ACTIVE CHECKPOINT]', options?.model || 'not passed');
    console.log('[WORKFLOW CHECKPOINT NODE VALUE]', checkpointFromNode);
    console.log('[HAS LORA NODE]', hasLoRANode ? 'YES' : 'NO');
    console.log('[HAS IPADAPTER NODE]', hasIPAdapterNode ? 'YES' : 'NO');
    console.log('[HAS IPADAPTER MODEL LOADER]', hasIPAdapterModelLoader ? 'YES' : 'NO');
    console.log('[HAS CLIP VISION LOADER]', hasCLIPVisionLoader ? 'YES' : 'NO');
    console.log('[LOAD IMAGE NODE REFERENCE]', referenceImagePath);
    console.log('[ACTIVE WIDTH HEIGHT]', activeWidth, 'x', activeHeight);
    console.log('[IS_SDXL_MODEL]', isSdxlModel);
    console.log('[IPADAPTER WORKFLOW]', isIPAdapterWorkflow ? 'YES' : 'NO');
    
    // HARD VALIDATION: IPAdapter workflow MUST have all required nodes
    if (isIPAdapterWorkflow) {
      const missingNodes: string[] = [];
      if (!hasIPAdapterNode) missingNodes.push('IPAdapterAdvanced');
      if (!hasIPAdapterModelLoader) missingNodes.push('IPAdapterModelLoader');
      if (!hasCLIPVisionLoader) missingNodes.push('CLIPVisionLoader');
      if (!hasLoadImageNode) missingNodes.push('LoadImage');
      
      if (missingNodes.length > 0) {
        const errorMsg = 'IPAdapter workflow "' + workflowFileUsed + '" is missing required nodes: ' +
          missingNodes.join(', ') + '. ' +
          'These nodes are essential for identity preservation. ' +
          'Cannot proceed with generation.';
        console.error('[WORKFLOW VALIDATION] FATAL:', errorMsg);
        throw new Error(errorMsg);
      }
      
      // HARD VALIDATION: IPAdapter workflow MUST have a reference image path
      if (!referenceImagePath || referenceImagePath === 'NONE' || referenceImagePath.trim().length === 0) {
        const errorMsg = 'IPAdapter workflow "' + workflowFileUsed + '" requires a reference image ' +
          'in the Load Image node, but none was provided. ' +
          'Inject the character reference image before queueing.';
        console.error('[WORKFLOW VALIDATION] FATAL:', errorMsg);
        throw new Error(errorMsg);
      }
    }
    
    // HARD VALIDATION: If the workflow is a fallback (dynamic build) when a file was expected, abort
    if (options?.workflowPath && 
        !options.workflowPath.includes('pixar_disney_stable') && 
        workflow["3"]?.class_type === 'KSampler' && 
        !Object.keys(workflow).some(k => parseInt(k) > 9)) {
      const isMissingFile = workflowFileUsed !== 'DYNAMIC (no file)' && 
        !workflowFileUsed.includes('pixar_disney_stable');
      if (isMissingFile) {
        console.error('[WORKFLOW ERROR] Expected file workflow but fallback was used! File may be missing:', workflowFileUsed);
        console.error('[WORKFLOW ERROR] The fallback buildPromptWorkflow() generates generic settings.');
        console.error('[WORKFLOW ERROR] Aborting generation to prevent corrupted/glitched image.');
        throw new Error(
          'Workflow file "' + workflowFileUsed + '" not found or invalid. ' +
          'Fallback dynamic build was used but is not allowed. ' +
          'Checkpoint node value: "' + checkpointFromNode + '".'
        );
      }
    }
    console.log('=====================================================');
    console.log('');'''
    
    # Find the old section end: 'console.log('=====================================================');'
    pq_start = content.find(old_pq)
    pq_end_marker = "console.log('=====================================================');"
    # Find the second occurrence (the closing one before queuePrompt)
    first_close = content.find(pq_end_marker, pq_start)
    second_close = content.find(pq_end_marker, first_close + 1) if first_close >= 0 else -1
    
    if pq_start >= 0 and second_close >= 0:
        # Find the end of the section (the console.log('') after the close marker)
        empty_log = content.find("console.log('');", second_close)
        if empty_log >= 0:
            end_idx = empty_log + len("console.log('');")
        else:
            end_idx = second_close + len(pq_end_marker)
        
        content = content[:pq_start] + new_pq_start + content[end_idx:]
        print('[PASS] Pre-queue verification updated with IPAdapter/LoRA detection')
    else:
        print(f'[FAIL] Cannot find pre-queue section. pq_start={pq_start}, second_close={second_close}')
        exit(1)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f'[PASS] File written successfully ({len(content)} chars)')

if __name__ == '__main__':
    main()
