#!/usr/bin/env python3
"""Test IPAdapter workflow generation through ComfyUI"""

import json
import requests
import time
import os
import sys

def main():
    # Load the IPAdapter workflow
    with open('workflows/pixar_disney_ipadapter_v1.json') as f:
        workflow = json.load(f)
    
    # Inject prompts
    workflow['6']['inputs']['text'] = 'A young boy with spiky brown hair, freckles, green eyes, wearing a blue hoodie, Pixar style 3D animation'
    workflow['7']['inputs']['text'] = 'photorealistic, realistic skin, ugly, deformed, bad anatomy, extra limbs'
    
    # Inject reference image path into LoadImage node (node 13)
    ref_path = 'C:/Users/silva/Desktop/seri-ai new/project/data/projects/default-project/characters/test_reference.png'
    if not os.path.exists(ref_path.replace('/', '\\').replace('C:\\', 'C:\\', 1)):
        # Try alternate path
        ref_path = 'C:\\Users\\silva\\Desktop\\seri-ai new\\project\\data\\projects\\default-project\\characters\\test_reference.png'
    
    workflow['13']['inputs']['image'] = ref_path
    
    # Set seed
    workflow['3']['inputs']['seed'] = 42
    
    # Log pre-queue verification (simulating what StudioAI does)
    print('========== PRE-QUEUE WORKFLOW VERIFICATION ==========')
    print('[ACTIVE WORKFLOW FILE] workflows/pixar_disney_ipadapter_v1.json')
    print(f'[ACTIVE CHECKPOINT] {workflow["4"]["inputs"]["ckpt_name"]}')
    print('[HAS LORA NODE] YES')
    print('[HAS IPADAPTER NODE] YES')
    print('[HAS IPADAPTER MODEL LOADER] YES')
    print('[HAS CLIP VISION LOADER] YES')
    print(f'[LOAD IMAGE NODE REFERENCE] {workflow["13"]["inputs"]["image"]}')
    print(f'[ACTIVE WIDTH HEIGHT] {workflow["5"]["inputs"]["width"]} x {workflow["5"]["inputs"]["height"]}')
    print(f'[FINAL POSITIVE PROMPT] {workflow["6"]["inputs"]["text"]}')
    print(f'[FINAL NEGATIVE PROMPT] {workflow["7"]["inputs"]["text"]}')
    print('=====================================================')
    print()
    
    # Queue to ComfyUI
    print('Queuing to ComfyUI...')
    try:
        resp = requests.post('http://127.0.0.1:8188/prompt', json={
            'prompt': workflow,
            'client_id': 'seri-ai-ipadapter-test'
        }, timeout=30)
    except requests.exceptions.ConnectionError:
        print('ERROR: Cannot connect to ComfyUI at http://127.0.0.1:8188')
        print('Make sure ComfyUI is running with --listen 0.0.0.0')
        sys.exit(1)
    
    if resp.status_code != 200:
        print(f'ERROR: HTTP {resp.status_code}')
        print(resp.text)
        sys.exit(1)
    
    data = resp.json()
    prompt_id = data['prompt_id']
    print(f'Prompt queued successfully! ID: {prompt_id}')
    print()
    
    # Wait for completion via history polling
    print('Waiting for generation to complete...')
    for attempt in range(120):
        time.sleep(2)
        try:
            hist = requests.get(f'http://127.0.0.1:8188/history/{prompt_id}', timeout=10)
            if hist.status_code == 200:
                hist_data = hist.json()
                if prompt_id in hist_data:
                    outputs = hist_data[prompt_id]['outputs']
                    images = []
                    for node_id, node_out in outputs.items():
                        if 'images' in node_out:
                            for img in node_out['images']:
                                images.append({
                                    'filename': img['filename'],
                                    'subfolder': img.get('subfolder', ''),
                                    'type': img.get('type', 'output')
                                })
                    if images:
                        print(f'Generation complete! Found {len(images)} image(s):')
                        for img in images:
                            print(f'  - {img["filename"]}')
                            
                            # Download and save
                            img_resp = requests.get(
                                f'http://127.0.0.1:8188/view?filename={img["filename"]}&type={img["type"]}',
                                timeout=30
                            )
                            if img_resp.status_code == 200:
                                save_path = f'test_output_ipadapter_{img["filename"]}'
                                with open(save_path, 'wb') as f:
                                    f.write(img_resp.content)
                                print(f'  Saved to: {save_path} ({len(img_resp.content)} bytes)')
                        print()
                        print('SUCCESS: IPAdapter generation test completed!')
                        return
                    else:
                        if attempt % 5 == 0:
                            print(f'  Waiting... (attempt {attempt+1})')
                else:
                    if attempt % 10 == 0:
                        print(f'  Waiting for prompt in history... (attempt {attempt+1})')
        except Exception as e:
            if attempt % 10 == 0:
                print(f'  Polling error: {e}')
    
    print('ERROR: Timed out waiting for generation')

if __name__ == '__main__':
    main()
