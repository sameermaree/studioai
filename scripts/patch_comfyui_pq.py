#!/usr/bin/env python3
"""Patch ComfyUIProvider.ts - update PRE-QUEUE section for IPAdapter"""

def main():
    with open('src/infrastructure/ai/providers/ComfyUIProvider.ts', 'rb') as f:
        content = f.read()
    
    # Find the PRE-QUEUE section more robustly
    pq_start_marker = b'ACTIVE WORKFLOW VERIFICATION'
    end_marker = b'====================================================='
    
    pq_start = content.find(pq_start_marker)
    if pq_start < 0:
        print('[FAIL] Cannot find PQ start')
        return
    
    # Find the start of the section (the comment line)
    section_start = content.rfind(b'//', 0, pq_start)
    if section_start < 0:
        section_start = pq_start - 50  # fallback
    
    # Find the closing end markers
    # Look for the pattern: '====================================================='
    # (this appears twice - opening and closing, we want the second one + console.log(''))
    end_idx = content.find(end_marker, section_start)
    if end_idx < 0:
        print(f'[FAIL] Cannot find end marker after section')
        return
    
    second_end = content.find(end_marker, end_idx + 10)
    if second_end < 0:
        print(f'[FAIL] Cannot find second end marker')
        return
    
    # After the second ===...===, there's console.log('');
    empty_log = content.find(b"console.log('');", second_end)
    if empty_log < 0:
        empty_log = second_end + len(end_marker)
    
    # Find the start of the comment line
    # Go back to find the exact start of the section
    line_start = content.rfind(b'\n', 0, section_start) + 1
    if line_start == 0:
        line_start = section_start
    
    new_section_text = (
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
    ).encode('utf-8')
    
    new_section_crlf = new_section_text.replace(b'\n', b'\r\n')
    
    content = content[:line_start] + new_section_crlf + content[empty_log + len(b"console.log('');") + 2:]
    
    with open('src/infrastructure/ai/providers/ComfyUIProvider.ts', 'wb') as f:
        f.write(content)
    
    print(f'[PASS] File written successfully ({len(content)} bytes)')

if __name__ == '__main__':
    main()
