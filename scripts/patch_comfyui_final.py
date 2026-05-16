#!/usr/bin/env python3
"""Surgically replace the PRE-QUEUE section in ComfyUIProvider.ts"""

def main():
    with open('src/infrastructure/ai/providers/ComfyUIProvider.ts', 'rb') as f:
        content = f.read()
    
    # Find the exact section boundaries
    section_start = content.find(b'// ========== ACTIVE WORKFLOW VERIFICATION (before queue) ==========')
    section_end = content.find(b'const promptId = await this.queuePrompt(workflow);')
    
    if section_start < 0 or section_end < 0:
        print(f'[FAIL] Cannot find section boundaries: start={section_start}, end={section_end}')
        return
    
    print(f'[INFO] Section starts at {section_start}, ends at {section_end}')
    print(f'[INFO] Section length: {section_end - section_start} bytes')
    
    new_section = (
        '    // ========== ACTIVE WORKFLOW VERIFICATION (before queue) ==========\n'
        '    const checkpointFromNode = workflow["4"]?.inputs?.ckpt_name || \n'
        '                               Object.values(workflow).find((n: any) => n.class_type === \'CheckpointLoaderSimple\')?.inputs?.ckpt_name || \n'
        '                               \'NOT FOUND\';\n'
        '    const emptyLatentNode = workflow["5"] || Object.values(workflow).find((n: any) => n.class_type === \'EmptyLatentImage\');\n'
        '    const activeWidth = emptyLatentNode?.inputs?.width || \'UNKNOWN\';\n'
        '    const activeHeight = emptyLatentNode?.inputs?.height || \'UNKNOWN\';\n'
        '    const workflowFileUsed = options?.workflowPath || \'DYNAMIC (no file)\';\n'
        '    const isSdxlModel = (checkpointFromNode as string).toLowerCase().includes(\'xl\');\n'
        '    const isIPAdapterWorkflow = workflowFileUsed.includes(\'ipadapter\');\n'
        '    \n'
        '    // Detect IPAdapter and LoRA nodes dynamically\n'
        '    const hasLoRANode = Object.values(workflow).some((n: any) => n.class_type === \'LoraLoader\');\n'
        '    const hasIPAdapterNode = Object.values(workflow).some((n: any) => n.class_type === \'IPAdapterAdvanced\');\n'
        '    const hasIPAdapterModelLoader = Object.values(workflow).some((n: any) => n.class_type === \'IPAdapterModelLoader\');\n'
        '    const hasCLIPVisionLoader = Object.values(workflow).some((n: any) => n.class_type === \'CLIPVisionLoader\');\n'
        '    const hasLoadImageNode = Object.values(workflow).some((n: any) => n.class_type === \'LoadImage\');\n'
        '    \n'
        '    // Find reference image path from LoadImage node if present\n'
        '    const loadImageNode = Object.values(workflow).find((n: any) => n.class_type === \'LoadImage\');\n'
        '    const referenceImagePath = loadImageNode?.inputs?.image || \'NONE\';\n'
        '    \n'
        '    console.log(\'\');\n'
        '    console.log(\'========== PRE-QUEUE WORKFLOW VERIFICATION ==========\');\n'
        '    console.log(\'[ACTIVE WORKFLOW FILE]\', workflowFileUsed);\n'
        '    console.log(\'[ACTIVE CHECKPOINT]\', options?.model || \'not passed\');\n'
        '    console.log(\'[WORKFLOW CHECKPOINT NODE VALUE]\', checkpointFromNode);\n'
        '    console.log(\'[HAS LORA NODE]\', hasLoRANode ? \'YES\' : \'NO\');\n'
        '    console.log(\'[HAS IPADAPTER NODE]\', hasIPAdapterNode ? \'YES\' : \'NO\');\n'
        '    console.log(\'[HAS IPADAPTER MODEL LOADER]\', hasIPAdapterModelLoader ? \'YES\' : \'NO\');\n'
        '    console.log(\'[HAS CLIP VISION LOADER]\', hasCLIPVisionLoader ? \'YES\' : \'NO\');\n'
        '    console.log(\'[LOAD IMAGE NODE REFERENCE]\', referenceImagePath);\n'
        '    console.log(\'[ACTIVE WIDTH HEIGHT]\', activeWidth, \'x\', activeHeight);\n'
        '    console.log(\'[IS_SDXL_MODEL]\', isSdxlModel);\n'
        '    console.log(\'[IPADAPTER WORKFLOW]\', isIPAdapterWorkflow ? \'YES\' : \'NO\');\n'
        '    \n'
        '    // HARD VALIDATION: IPAdapter workflow MUST have all required nodes\n'
        '    if (isIPAdapterWorkflow) {\n'
        '      const missingNodes: string[] = [];\n'
        '      if (!hasIPAdapterNode) missingNodes.push(\'IPAdapterAdvanced\');\n'
        '      if (!hasIPAdapterModelLoader) missingNodes.push(\'IPAdapterModelLoader\');\n'
        '      if (!hasCLIPVisionLoader) missingNodes.push(\'CLIPVisionLoader\');\n'
        '      if (!hasLoadImageNode) missingNodes.push(\'LoadImage\');\n'
        '      \n'
        '      if (missingNodes.length > 0) {\n'
        '        const errorMsg = \'IPAdapter workflow "\' + workflowFileUsed + \'" is missing required nodes: \' +\n'
        '          missingNodes.join(\', \') + \'. \' +\n'
        '          \'These nodes are essential for identity preservation. \' +\n'
        '          \'Cannot proceed with generation.\';\n'
        '        console.error(\'[WORKFLOW VALIDATION] FATAL:\', errorMsg);\n'
        '        throw new Error(errorMsg);\n'
        '      }\n'
        '      \n'
        '      // HARD VALIDATION: IPAdapter workflow MUST have a reference image path\n'
        '      if (!referenceImagePath || referenceImagePath === \'NONE\' || referenceImagePath.trim().length === 0) {\n'
        '        const errorMsg = \'IPAdapter workflow "\' + workflowFileUsed + \'" requires a reference image \' +\n'
        '          \'in the Load Image node, but none was provided. \' +\n'
        '          \'Inject the character reference image before queueing.\';\n'
        '        console.error(\'[WORKFLOW VALIDATION] FATAL:\', errorMsg);\n'
        '        throw new Error(errorMsg);\n'
        '      }\n'
        '    }\n'
        '    \n'
        '    // HARD VALIDATION: If the workflow is a fallback (dynamic build) when a file was expected, abort\n'
        '    if (options?.workflowPath && \n'
        '        !options.workflowPath.includes(\'pixar_disney_stable\') && \n'
        '        workflow["3"]?.class_type === \'KSampler\' && \n'
        '        !Object.keys(workflow).some(k => parseInt(k) > 9)) {\n'
        '      const isMissingFile = workflowFileUsed !== \'DYNAMIC (no file)\' && \n'
        '        !workflowFileUsed.includes(\'pixar_disney_stable\');\n'
        '      if (isMissingFile) {\n'
        '        console.error(\'[WORKFLOW ERROR] Expected file workflow but fallback was used! File may be missing:\', workflowFileUsed);\n'
        '        console.error(\'[WORKFLOW ERROR] The fallback buildPromptWorkflow() generates generic settings.\');\n'
        '        console.error(\'[WORKFLOW ERROR] Aborting generation to prevent corrupted/glitched image.\');\n'
        '        throw new Error(\n'
        '          \'Workflow file "\' + workflowFileUsed + \'" not found or invalid. \' +\n'
        '          \'Fallback dynamic build was used but is not allowed. \' +\n'
        '          \'Checkpoint node value: "\' + checkpointFromNode + \'".\'\n'
        '        );\n'
        '      }\n'
        '    }\n'
        '    console.log(\'=====================================================\');\n'
        '    console.log(\'\');\n'
        '\n'
    )
    
    # Normalize to CRLF
    new_section_crlf = new_section.replace('\n', '\r\n').encode('utf-8')
    
    content = content[:section_start] + new_section_crlf + content[section_end:]
    
    with open('src/infrastructure/ai/providers/ComfyUIProvider.ts', 'wb') as f:
        f.write(content)
    
    print(f'[PASS] File written successfully ({len(content)} bytes)')
    
    # Verify key content
    verify_content = content.decode('utf-8', errors='replace')
    checks = [
        ('selectIdentityWorkflow', 'CharacterImageGenerator'),
        ('selectIdentityCheckpoint', 'CharacterImageGenerator'),
        ('IDENTITY WORKFLOW ROUTING', 'CharacterImageGenerator'),
        ('shouldUseIPAdapter', 'CharacterImageGenerator'),
        ("workflowInputs['13']", 'CharacterImageGenerator'),
        ('IPAdapter workflow file', 'ComfyUIProvider loadWorkflowFromFile'),
        ('HAS LORA NODE', 'ComfyUIProvider pre-queue'),
        ('HAS IPADAPTER NODE', 'ComfyUIProvider pre-queue'),
        ('HAS CLIP VISION LOADER', 'ComfyUIProvider pre-queue'),
        ('LOAD IMAGE NODE REFERENCE', 'ComfyUIProvider pre-queue'),
        ('IPAdapterAdvanced', 'ComfyUIProvider missingNodes'),
        ('IPAdapterModelLoader', 'ComfyUIProvider missingNodes'),
        ('CLIPVisionLoader', 'ComfyUIProvider missingNodes'),
        ('LoadImage', 'ComfyUIProvider missingNodes'),
    ]
    with open('src/services/generation/CharacterImageGenerator.ts', 'r', encoding='utf-8') as f:
        gen_content = f.read()
    with open('src/services/style/StyleWorkflowRouter.ts', 'r', encoding='utf-8') as f:
        router_content = f.read()
    
    all_ok = True
    for text, location in checks:
        if location == 'CharacterImageGenerator':
            found = text in gen_content
        elif location == 'StyleWorkflowRouter':
            found = text in router_content
        elif location.startswith('ComfyUIProvider'):
            found = text in verify_content
        else:
            found = text in verify_content
        
        if found:
            print(f'  [OK]   {text} (in {location})')
        else:
            print(f'  [FAIL] {text} (in {location})')
            all_ok = False
    
    if all_ok:
        print('\n[PASS] All verifications passed!')
    else:
        print('\n[WARN] Some checks failed')

if __name__ == '__main__':
    main()
