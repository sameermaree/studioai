#!/usr/bin/env python3
"""Final verification of all IPAdapter implementation files"""

import json, os, sys

def main():
    errors = []
    
    print("=== FINAL COMPREHENSIVE VERIFICATION ===")
    print()
    
    # 1. Workflow files
    print("--- Workflow Files ---")
    files = [
        "workflows/pixar_disney_stable.json",
        "workflows/pixar_disney_ipadapter_v1.json",
    ]
    for f in files:
        if os.path.exists(f):
            print(f"  [OK] {f}")
        else:
            print(f"  [FAIL] MISSING: {f}")
            errors.append(f"Missing file: {f}")
    
    # Verify stable workflow
    with open("workflows/pixar_disney_stable.json") as f:
        stable = json.load(f)
    
    if stable["5"]["inputs"]["width"] == 1024 and stable["5"]["inputs"]["height"] == 1024:
        print("  [OK] stable workflow: 1024x1024")
    else:
        print("  [FAIL] stable workflow not 1024x1024")
        errors.append("stable workflow wrong resolution")
    
    # Verify IPAdapter workflow
    with open("workflows/pixar_disney_ipadapter_v1.json") as f:
        ip = json.load(f)
    
    # Check all required nodes exist
    required_nodes = ["IPAdapterAdvanced", "IPAdapterModelLoader", "CLIPVisionLoader", "LoadImage", "LoraLoader", "ImageUpscaleBy"]
    class_types = [n["class_type"] for n in ip.values()]
    for node_type in required_nodes:
        if node_type in class_types:
            print(f"  [OK] ipadapter workflow has: {node_type}")
        else:
            print(f"  [FAIL] ipadapter workflow missing: {node_type}")
            errors.append(f"Missing node: {node_type}")
    
    # Verify wiring chain
    if ip["3"]["inputs"]["model"] == ["10", 0]:
        print("  [OK] KSampler.model -> IPAdapterAdvanced[10]")
    else:
        print("  [FAIL] KSampler model wiring wrong")
        errors.append("KSampler model wiring")
    
    if ip["10"]["inputs"]["model"] == ["15", 0]:
        print("  [OK] IPAdapterAdvanced.model -> LoraLoader[15]")
    else:
        print("  [FAIL] IPAdapter model wiring wrong")
        errors.append("IPAdapter model wiring")
    
    if ip["15"]["inputs"]["model"] == ["4", 0]:
        print("  [OK] LoraLoader.model -> Checkpoint[4]")
    else:
        print("  [FAIL] LoraLoader model wiring wrong")
        errors.append("LoraLoader model wiring")
    
    if ip["10"]["inputs"]["image"] == ["13", 0]:
        print("  [OK] IPAdapterAdvanced.image -> LoadImage[13]")
    else:
        print("  [FAIL] IPAdapter image wiring wrong")
        errors.append("IPAdapter image wiring")
    
    if ip["15"]["inputs"]["lora_name"] == "pixar_sdxl.safetensors":
        print("  [OK] LoraLoader: pixar_sdxl.safetensors")
    else:
        print("  [FAIL] Wrong LoRA name")
        errors.append("LoRA name wrong")
    
    if ip["5"]["inputs"]["width"] == 1024 and ip["5"]["inputs"]["height"] == 1024:
        print("  [OK] ipadapter workflow: 1024x1024")
    else:
        print("  [FAIL] ipadapter workflow not 1024x1024")
        errors.append("ipadapter wrong resolution")
    
    if ip["4"]["inputs"]["ckpt_name"] == "dreamshaperXL_alpha2Xl10.safetensors":
        print("  [OK] ipadapter checkpoint: dreamshaperXL")
    else:
        print("  [FAIL] ipadapter wrong checkpoint")
        errors.append("ipadapter wrong checkpoint")
    
    if ip["3"]["inputs"]["sampler_name"] == "dpmpp_sde" and ip["3"]["inputs"]["scheduler"] == "karras":
        print("  [OK] ipadapter sampler: dpmpp_sde + karras")
    else:
        print("  [FAIL] ipadapter wrong sampler/scheduler")
        errors.append("ipadapter sampler wrong")
    
    # 2. StyleWorkflowRouter
    print()
    print("--- StyleWorkflowRouter ---")
    with open("src/services/style/StyleWorkflowRouter.ts") as f:
        r = f.read()
    
    if "selectIdentityWorkflow" in r:
        print("  [OK] selectIdentityWorkflow function")
    else:
        print("  [FAIL] missing selectIdentityWorkflow")
        errors.append("missing selectIdentityWorkflow")
    
    if "selectIdentityCheckpoint" in r:
        print("  [OK] selectIdentityCheckpoint function")
    else:
        print("  [FAIL] missing selectIdentityCheckpoint")
        errors.append("missing selectIdentityCheckpoint")
    
    if "pixar_disney_ipadapter_v1.json" in r:
        print("  [OK] IPAdapter workflow path in Select identity logic")
    else:
        print("  [FAIL] missing ipadapter workflow path")
        errors.append("missing ipadapter workflow path in router")
    
    # 3. CharacterImageGenerator
    print()
    print("--- CharacterImageGenerator ---")
    with open("src/services/generation/CharacterImageGenerator.ts") as f:
        g = f.read()
    
    gen_checks = [
        ("selectIdentityWorkflow, selectIdentityCheckpoint", "Import"),
        ("IDENTITY WORKFLOW ROUTING", "Section header"),
        ("shouldUseIPAdapter = hasReferenceImage", "Mode logic"),
        ("hasReferenceImage", "hasReferenceImage variable"),
        ("selectIdentityWorkflow(shouldUseIPAdapter)", "Workflow selection call"),
        ("selectIdentityCheckpoint()", "Checkpoint selection call"),
        ("workflowInputs", "workflowInputs variable"),
        ("13", "LoadImage node injection"),
        ("IPAdapter identity workflow requires a reference image", "Hard validation"),
    ]
    
    for text, label in gen_checks:
        if text in g:
            print(f"  [OK] {label}")
        else:
            print(f"  [FAIL] Missing: {label} ({text})")
            errors.append(f"Missing {label}")
    
    # 4. ComfyUIProvider
    print()
    print("--- ComfyUIProvider ---")
    with open("src/infrastructure/ai/providers/ComfyUIProvider.ts") as f:
        p = f.read()
    
    prov_checks = [
        ("IPAdapter workflow file", "Hardened fallback message"),
        ("HAS LORA NODE", "LoRA detection log"),
        ("HAS IPADAPTER NODE", "IPAdapter detection log"),
        ("HAS IPADAPTER MODEL LOADER", "IPAdapter ModelLoader detection"),
        ("HAS CLIP VISION LOADER", "CLIP Vision detection"),
        ("LOAD IMAGE NODE REFERENCE", "LoadImage reference log"),
        ("[IPADAPTER WORKFLOW]", "IPAdapter workflow indicator"),
        ("missingNodes.push('IPAdapterAdvanced')", "Validate Advanced"),
        ("missingNodes.push('IPAdapterModelLoader')", "Validate ModelLoader"),
        ("missingNodes.push('CLIPVisionLoader')", "Validate CLIPVision"),
        ("missingNodes.push('LoadImage')", "Validate LoadImage"),
        ("referenceImagePath === 'NONE'", "Validate reference path"),
        ("Fallback to dynamic build is forbidden for IPAdapter", "No fallback"),
    ]
    
    for text, label in prov_checks:
        if text in p:
            print(f"  [OK] {label}")
        else:
            print(f"  [FAIL] Missing: {label} ({text})")
            errors.append(f"Missing {label}")
    
    print()
    if errors:
        print(f"=== FAILURES: {len(errors)} ===")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    else:
        print("=== ALL VERIFICATIONS PASSED ===")

if __name__ == "__main__":
    main()
