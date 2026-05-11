export type NarrativeElementType = 'setup' | 'conflict' | 'climax' | 'resolution';

export interface NarrativeElement {
  type: NarrativeElementType;
  description: string;
}

export interface NarrativeArc {
  id: string;
  name: string;
  elements: NarrativeElement[];
  sceneIds: string[];
}

// Factory function to create a new narrative arc
export function createNarrativeArc(name: string): NarrativeArc {
  return {
    id: crypto.randomUUID(),
    name,
    elements: [],
    sceneIds: [],
  };
}

// Helper function to add a narrative element to an arc
export function addNarrativeElement(
  arc: NarrativeArc,
  type: NarrativeElementType,
  description: string
): NarrativeArc {
  return {
    ...arc,
    elements: [
      ...arc.elements,
      { type, description }
    ],
  };
}

// Helper function to add a scene to an arc
export function addSceneToArc(
  arc: NarrativeArc,
  sceneId: string
): NarrativeArc {
  if (arc.sceneIds.includes(sceneId)) {
    return arc;
  }
  
  return {
    ...arc,
    sceneIds: [...arc.sceneIds, sceneId],
  };
}