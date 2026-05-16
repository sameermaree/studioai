#!/usr/bin/env python3
"""Harden the fallback in loadWorkflowFromFile for IPAdapter"""

def main():
    with open('src/infrastructure/ai/providers/ComfyUIProvider.ts', 'rb') as f:
        content = f.read()
    
    # Find the first fallback section
    idx1 = content.find(b'    if (!response.ok) {')
    end1 = content.find(b"}\r\n    \r\n    const workflowData = await response.json();", idx1)
    
    if idx1 < 0 or end1 < 0:
        print(f'FAIL Cannot find first fallback: idx1={idx1}, end1={end1}')
        return
    
    # Build the replacement
    new_first = ('    if (!response.ok) {\r\n' +
        '      // IPAdapter workflow MUST NOT fallback to dynamic build\r\n' +
        "      const isIPAdapterWorkflow = workflowPath.includes('ipadapter');\r\n" +
        '      const errorMsg = isIPAdapterWorkflow\r\n' +
        '        ? \'IPAdapter workflow file "' + ' + workflowPath + ' + '" not found (HTTP ' + ' + response.status + ' + '). ' + ' +\r\n' +
        '          \'This workflow requires LoRA, IPAdapter, CLIP Vision, and Load Image nodes. ' + ' +\r\n' +
        "          'Fallback to dynamic build is forbidden for IPAdapter workflows.'\r\n" +
        "        : 'Failed to load workflow file \"' + workflowPath + '\" - falling back to dynamic build';\r\n" +
        '      \r\n' +
        '      if (isIPAdapterWorkflow) {\r\n' +
        "        console.error('[WORKFLOW LOADER] FATAL:', errorMsg);\r\n" +
        '        throw new Error(errorMsg);\r\n' +
        '      }\r\n' +
        '      \r\n' +
        "      console.warn('[WORKFLOW LOADER]', errorMsg);\r\n" +
        '      return this.buildPromptWorkflow({\r\n' +
        '        prompt: params.prompt,\r\n' +
        '        negativePrompt: params.negativePrompt,\r\n' +
        '        width: params.width,\r\n' +
        '        height: params.height,\r\n' +
        '        seed: params.seed,\r\n' +
        '      });\r\n' +
        '    }\r\n').encode('utf-8')
    
    content = content[:idx1] + new_first + content[end1 + len(b"}\r\n    \r\n    const workflowData = await response.json();"):]
    print('PASS First fallback hardened')
    
    # Second fallback
    marker2_start = b"    if (!isNativeFormat) {\r\n      console.warn('[WORKFLOW LOADER] Invalid workflow format - falling back to dynamic build');"
    idx2 = content.find(marker2_start)
    
    if idx2 < 0:
        print('WARN Cannot find second fallback')
    else:
        marker2_end = b'        seed: params.seed,\r\n      });\r\n    }'
        end2 = content.find(marker2_end, idx2)
        if end2 < 0:
            print('FAIL Cannot find end of second fallback')
            return
        
        new_second = ('    if (!isNativeFormat) {\r\n' +
            '      // IPAdapter workflow MUST NOT fallback to dynamic build\r\n' +
            "      const isIPAdapterWorkflow = workflowPath.includes('ipadapter');\r\n" +
            '      const errorMsg = isIPAdapterWorkflow\r\n' +
            '        ? \'IPAdapter workflow file "' + ' + workflowPath + ' + '" has invalid format. ' + ' +\r\n' +
            "          'Expected native ComfyUI API format with numeric keys and class_type. ' +\r\n" +
            "          'Fallback to dynamic build is forbidden for IPAdapter workflows.'\r\n" +
            "        : 'Invalid workflow format for \"' + workflowPath + '\" - falling back to dynamic build';\r\n" +
            '      \r\n' +
            '      if (isIPAdapterWorkflow) {\r\n' +
            "        console.error('[WORKFLOW LOADER] FATAL:', errorMsg);\r\n" +
            '        throw new Error(errorMsg);\r\n' +
            '      }\r\n' +
            '      \r\n' +
            "      console.warn('[WORKFLOW LOADER]', errorMsg);\r\n" +
            '      return this.buildPromptWorkflow({\r\n' +
            '        prompt: params.prompt,\r\n' +
            '        negativePrompt: params.negativePrompt,\r\n' +
            '        width: params.width,\r\n' +
            '        height: params.height,\r\n' +
            '        seed: params.seed,\r\n' +
            '      });\r\n' +
            '    }\r\n' +
            '    \r\n' +
            '    // Deep clone').encode('utf-8')
        
        content = content[:idx2] + new_second + content[end2 + len(marker2_end):]
        print('PASS Second fallback hardened')
    
    with open('src/infrastructure/ai/providers/ComfyUIProvider.ts', 'wb') as f:
        f.write(content)
    
    print(f'PASS File written ({len(content)} bytes)')

if __name__ == '__main__':
    main()
