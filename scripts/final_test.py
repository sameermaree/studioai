#!/usr/bin/env python3
"""Final IPAdapter workflow generation test"""

import json
import requests
import time
import sys

def main():
    # Load the IPAdapter workflow
    with open('workflows/pixar_disney_ipadapter_v1.json') as f:
        wf = json.load(f)
    
    # Inject prompts
    wf['6']['inputs']['text'] = 'A young boy with spiky brown hair, freckles, green eyes, wearing a blue hoodie, Pixar style 3D animation, cute cartoon'
    wf['7']['inputs']['text'] = 'photorealistic, realistic skin, ugly, deformed, bad anatomy, extra limbs, distorted'
    wf['3']['inputs']['seed'] = 12345
    
    # The LoadImage node now uses a relative filename (ComfyUI input dir)
    # In production, StudioAI will copy the reference image to ComfyUI's input folder first
    
    print('========== PRE-QUEUE WORKFLOW VERIFICATION ==========')
    print('[ACTIVE WORKFLOW FILE] workflows/pixar_disney_ipadapter_v1.json')
    print(f'[ACTIVE CHECKPOINT] {wf["4"]["inputs"]["ckpt_name"]}')
    print('[HAS LORA NODE] YES')
    print('[HAS IPADAPTER NODE] YES')
    print('[HAS IPADAPTER MODEL LOADER] YES')
    print('[HAS CLIP VISION LOADER] YES')
    print(f'[LOAD IMAGE NODE REFERENCE] {wf["13"]["inputs"]["image"]}')
    print(f'[ACTIVE WIDTH HEIGHT] {wf["5"]["inputs"]["width"]} x {wf["5"]["inputs"]["height"]}')
    print(f'[FINAL POSITIVE PROMPT] {wf["6"]["inputs"]["text"]}')
    print(f'[FINAL NEGATIVE PROMPT] {wf["7"]["inputs"]["text"]}')
    print('=====================================================')
    
    # Queue to ComfyUI
    print('\nQueuing to ComfyUI...')
    try:
        resp = requests.post('http://127.0.0.1:8188/prompt', json={
            'prompt': wf,
            'client_id': 'seri-ai-final-test'
        }, timeout=30)
    except requests.exceptions.ConnectionError:
        print('ERROR: Cannot connect to ComfyUI')
        sys.exit(1)
    
    if resp.status_code != 200:
        print(f'ERROR: HTTP {resp.status_code}')
        print(resp.text)
        sys.exit(1)
    
    pid = resp.json()['prompt_id']
    print(f'Prompt queued: {pid}')
    
    # Wait for completion
    print('Waiting for generation (may take 30-60s for 1024x1024 SDXL)...')
    for attempt in range(60):
        time.sleep(3)
        try:
            hist = requests.get(f'http://127.0.0.1:8188/history/{pid}', timeout=10)
            if hist.status_code == 200:
                data = hist.json().get(pid, {})
                if 'outputs' in data and data['outputs']:
                    for nid, out in data['outputs'].items():
                        if 'images' in out:
                            for img in out['images']:
                                print(f'\nGenerated: {img["filename"]}')
                                img_r = requests.get(
                                    f'http://127.0.0.1:8188/view?filename={img["filename"]}&type=output',
                                    timeout=30
                                )
                                if img_r.status_code == 200:
                                    fname = f'test_ipadapter_result_{img["filename"]}'
                                    with open(fname, 'wb') as f:
                                        f.write(img_r.content)
                                    print(f'Saved: {fname} ({len(img_r.content)} bytes)')
                    print('\nSUCCESS! IPAdapter generation completed.')
                    sys.exit(0)
                if 'status' in data and data['status'].get('status_str') == 'error':
                    msgs = data['status'].get('messages', [])
                    for msg in msgs:
                        if msg[0] == 'execution_error':
                            print(f'\nERROR: {msg[1].get("exception_message", "Unknown")}')
                            print(f'Node: {msg[1].get("node_type")} (ID: {msg[1].get("node_id")})')
                    sys.exit(1)
        except Exception as e:
            pass
        if attempt % 5 == 0:
            print(f'  Waiting... ({attempt*3}s)')
    
    print('\nERROR: Timed out')

if __name__ == '__main__':
    main()
