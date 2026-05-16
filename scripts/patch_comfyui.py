#!/usr/bin/env python3
"""Patch ComfyUIProvider.ts for IPAdapter workflow support"""
import re

def main():
    with open('src/infrastructure/ai/providers/ComfyUIProvider.ts', 'rb') as f:
        content = f.read()
    
    # 1. Harden loadWorkflowFromFile fallback for IPAdapter
    old = bytes(
        '    // Fetch the workflow JSON file\n'
        '    const response = await fetch(`/api/workflows/${workflowPath.split(\'/\').pop()}`);\n'
        '    if (!response.ok) {\n'
        '      console.warn(\'[WORKFLOW LOADER] Failed to load\', workflowPath, \'- falling back to dynamic build\');\n'
        '      return this.buildPromptWorkflow({\n'
        '        prompt: params.prompt,\n'
        '        negativePrompt: params.negativePrompt,\n'
        '        width: params.width,\n'
        '        height: params.height,\n'
        '        seed: params.seed,\n'
        '      });\n'
        '    }\n'
        '    \n'
        '    const workflowData = await response.json();\n'
        '    \n'
        '    // Validate: must be an object with numeric keys and class_type on each node\n'
        '    const isNativeFormat = typeof workflowData === \'object\' && !Array.isArray(workflowData);\n'
        '    if (!isNativeFormat) {\n'
        '      console.warn(\'[WORKFLOW LOADER] Invalid workflow format - falling back to dynamic build\');\n'
        '      return this.buildPromptWorkflow({\n'
        '        prompt: params.prompt,\n'
        '        negativePrompt: params.negativePrompt,\n'
        '        width: params.width,\n'
        '        height: params.height,\n'
        '        seed: params.seed,\n'
        '      });\n'
        '    }',
        'utf-8'
    )
    
    new = bytes(
        '    // Fetch the workflow JSON file\n'
        '    const response = await fetch(`/api/workflows/${workflowPath.split(\'/\').pop()}`);\n'
        '    if (!response.ok) {\n'
        '      // IPAdapter workflow MUST NOT fallback; it requires LoRA, IPAdapter, CLIP Vision, Load Image nodes\n'
        '      const isIPAdapterWorkflow = workflowPath.includes(\'ipadapter\');\n'
        '      const errorMsg = isIPAdapterWorkflow\n'
        '        ? \'IPAdapter workflow file "\' + workflowPath + \'" not found. \' +\n'
        '          \'File failed to load (HTTP \' + response.status + \'). \' +\n'
        '          \'This workflow requires LoRA, IPAdapter, CLIP Vision, and Load Image nodes. \' +\n'
        '          \'Fallback to dynamic build is forbidden for IPAdapter workflows.\'\n'
        '        : \'Failed to load workflow file "\' + workflowPath + \'" - falling back to dynamic build\';\n'
        '      \n'
        '      if (isIPAdapterWorkflow) {\n'
        '        console.error(\'[WORKFLOW LOADER] FATAL:\', errorMsg);\n'
        '        throw new Error(errorMsg);\n'
        '      }\n'
        '      \n'
        '      console.warn(\'[WORKFLOW LOADER]\', errorMsg);\n'
        '      return this.buildPromptWorkflow({\n'
        '        prompt: params.prompt,\n'
        '        negativePrompt: params.negativePrompt,\n'
        '        width: params.width,\n'
        '        height: params.height,\n'
        '        seed: params.seed,\n'
        '      });\n'
        '    }\n'
        '    \n'
        '    const workflowData = await response.json();\n'
        '    \n'
        '    // Validate: must be an object with numeric keys and class_type on each node\n'
        '    const isNativeFormat = typeof workflowData === \'object\' && !Array.isArray(workflowData);\n'
        '    if (!isNativeFormat) {\n'
        '      const isIPAdapterWorkflow = workflowPath.includes(\'ipadapter\');\n'
        '      const errorMsg = isIPAdapterWorkflow\n'
        '        ? \'IPAdapter workflow file "\' + workflowPath + \'" has invalid format. \' +\n'
        '          \'Expected native ComfyUI API format with numeric keys and class_type. \' +\n'
        '          \'Fallback to dynamic build is forbidden for IPAdapter workflows.\'\n'
        '        : \'Invalid workflow format for "\' + workflowPath + \'" - falling back to dynamic build\';\n'
        '      \n'
        '      if (isIPAdapterWorkflow) {\n'
        '        console.error(\'[WORKFLOW LOADER] FATAL:\', errorMsg);\n'
        '        throw new Error(errorMsg);\n'
        '      }\n'
        '      \n'
        '      console.warn(\'[WORKFLOW LOADER]\', errorMsg);\n'
        '      return this.buildPromptWorkflow({\n'
        '        prompt: params.prompt,\n'
        '        negativePrompt: params.negativePrompt,\n'
        '        width: params.width,\n'
        '        height: params.height,\n'
        '        seed: params.seed,\n'
        '      });\n'
        '    }',
        'utf-8'
    )
    
    # Try with CRLF line endings (Windows)
    old_crlf = old.replace(b'\n', b'\r\n')
    new_crlf = new.replace(b'\n', b'\r\n')
    
    if old in content:
        content = content.replace(old, new)
        print('[PASS] loadWorkflowFromFile fallback hardened (LF)')
    elif old_crlf in content:
        content = content.replace(old_crlf, new_crlf)
        print('[PASS] loadWorkflowFromFile fallback hardened (CRLF)')
    else:
        print('[FAIL] Cannot find the fallback section')
        idx = content.find(b'/api/workflows/')
        if idx >= 0:
            print('Context:', content[idx:idx+400].decode('utf-8', errors='replace'))
        return
    
    # 2. Update PRE-QUEUE section
    pq_start_marker = b'// ========== ACTIVE WORKFLOW VERIFICATION (before queue) =========='
    pq_end_marker = b"console.log('=====================================================');"
    
    pq_start = content.find(pq_start_marker)
    # Find the second occurrence of the end marker (closing one)
    first_close = content.find(pq_end_marker, pq_start)
    second_close = content.find(pq_end_marker, first_close + 1) if first_close >= 0 else -1
    empty_log = content.find(b"console.log('');", second_close)
    
    if pq_start >= 0 and second_close >= 0:
        if empty_log >= 0:
            end_idx = empty_log + len(b"console.log('');")
        else:
            end_idx = second_close + len(pq_end_marker)
        
        new_section = bytes(
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
            '    console.log(\'\');',
            'utf-8'
        ).replace(b'\n', b'\r\n')
        
        content = content[:pq_start] + new_section + content[end_idx:]
        print('[PASS] Pre-queue verification updated with IPAdapter/LoRA detection')
    else:
        print(f'[FAIL] Cannot find pre-queue section. pq_start={pq_start}, second_close={second_close}')
        return
    
    with open('src/infrastructure/ai/providers/ComfyUIProvider.ts', 'wb') as f:
        f.write(content)
    
    print(f'[PASS] File written successfully ({len(content)} bytes)')

if __name__ == '__main__':
    main()
