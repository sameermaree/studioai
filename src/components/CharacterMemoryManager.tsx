import React, { useState, useEffect } from 'react';
import { PersistentCharacterMemory } from '../infrastructure/persistence/PersistentCharacterMemory';
import { EnhancedCharacterMemory, updateReinforcementSettings, addMemoryElement } from '../domain/storytelling/entities/CharacterMemory';
import { Character } from '../types';
import CharacterMemoryViewer from './CharacterMemoryViewer';

interface CharacterMemoryManagerProps {
  onClose?: () => void;
}

const CharacterMemoryManager: React.FC<CharacterMemoryManagerProps> = ({ onClose }) => {
  const [characters, setCharacters] = useState<Array<{character: Character | null; memory: EnhancedCharacterMemory}>>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // For memory element adding
  const [newElementKey, setNewElementKey] = useState('');
  const [newElementValue, setNewElementValue] = useState('');
  const [newElementImportance, setNewElementImportance] = useState(5);
  
  // For reinforcement settings
  const [faceEmphasis, setFaceEmphasis] = useState(8);
  const [outfitEmphasis, setOutfitEmphasis] = useState(7);
  const [personalityEmphasis, setPersonalityEmphasis] = useState(6);
  
  useEffect(() => {
    const loadCharacterMemories = async () => {
      try {
        setLoading(true);
        const persistentMemory = new PersistentCharacterMemory();
        
        // Initialize memories for all characters
        const initializedCount = persistentMemory.initializeAllCharacterMemories();
        console.log(`Initialized ${initializedCount} new character memories`);
        
        // Get all memories with their characters
        const memoriesWithChars = persistentMemory.getAllMemoriesWithCharacters();
        setCharacters(memoriesWithChars);
        
        // Select the first character by default if available
        if (memoriesWithChars.length > 0) {
          setSelectedCharacterId(memoriesWithChars[0].memory.characterId);
          
          // Set initial reinforcement values
          const firstMemory = memoriesWithChars[0].memory;
          setFaceEmphasis(firstMemory.reinforcement.face_emphasis);
          setOutfitEmphasis(firstMemory.reinforcement.outfit_emphasis);
          setPersonalityEmphasis(firstMemory.reinforcement.personality_emphasis);
        }
      } catch (err) {
        setError(`Failed to load character memories: ${err}`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    loadCharacterMemories();
  }, []);
  
  const handleSelectCharacter = (characterId: string) => {
    setSelectedCharacterId(characterId);
    
    // Update reinforcement settings for the selected character
    const characterMemory = characters.find(c => c.memory.characterId === characterId)?.memory;
    if (characterMemory) {
      setFaceEmphasis(characterMemory.reinforcement.face_emphasis);
      setOutfitEmphasis(characterMemory.reinforcement.outfit_emphasis);
      setPersonalityEmphasis(characterMemory.reinforcement.personality_emphasis);
    }
  };
  
  const handleUpdateReinforcementSettings = () => {
    if (!selectedCharacterId) return;
    
    try {
      const persistentMemory = new PersistentCharacterMemory();
      const memory = persistentMemory.getOrCreateCharacterMemory(selectedCharacterId);
      
      if (memory) {
        // Update reinforcement settings
        const updatedMemory = updateReinforcementSettings(memory, {
          face_emphasis: faceEmphasis,
          outfit_emphasis: outfitEmphasis,
          personality_emphasis: personalityEmphasis
        });
        
        // Save updated memory
        persistentMemory.saveCharacterMemory(updatedMemory);
        
        // Update the characters state
        setCharacters(prevCharacters => 
          prevCharacters.map(char => 
            char.memory.characterId === selectedCharacterId
              ? { ...char, memory: updatedMemory }
              : char
          )
        );
        
        // Show success message
        alert('Reinforcement settings updated successfully!');
      }
    } catch (err) {
      console.error('Failed to update reinforcement settings:', err);
      setError('Failed to update reinforcement settings');
    }
  };
  
  const handleAddMemoryElement = () => {
    if (!selectedCharacterId || !newElementKey || !newElementValue) return;
    
    try {
      const persistentMemory = new PersistentCharacterMemory();
      const memory = persistentMemory.getOrCreateCharacterMemory(selectedCharacterId);
      
      if (memory) {
        // Add memory element
        const updatedMemory = addMemoryElement(
          memory,
          newElementKey,
          newElementValue,
          newElementImportance
        );
        
        // Save updated memory
        persistentMemory.saveCharacterMemory(updatedMemory);
        
        // Update the characters state
        setCharacters(prevCharacters => 
          prevCharacters.map(char => 
            char.memory.characterId === selectedCharacterId
              ? { ...char, memory: updatedMemory }
              : char
          )
        );
        
        // Reset form
        setNewElementKey('');
        setNewElementValue('');
        setNewElementImportance(5);
        
        // Show success message
        alert('Memory element added successfully!');
      }
    } catch (err) {
      console.error('Failed to add memory element:', err);
      setError('Failed to add memory element');
    }
  };
  
  const handleExportMemories = () => {
    try {
      const persistentMemory = new PersistentCharacterMemory();
      const exportedData = persistentMemory.exportMemories();
      
      // Create a blob and download link
      const blob = new Blob([exportedData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create and click a download link
      const a = document.createElement('a');
      a.href = url;
      a.download = `character-memories-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
    } catch (err) {
      console.error('Failed to export memories:', err);
      setError('Failed to export memories');
    }
  };
  
  const handleImportMemories = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const persistentMemory = new PersistentCharacterMemory();
        const importedCount = persistentMemory.importMemories(content);
        
        // Refresh the characters list
        const memoriesWithChars = persistentMemory.getAllMemoriesWithCharacters();
        setCharacters(memoriesWithChars);
        
        // Show success message
        alert(`Successfully imported ${importedCount} character memories.`);
      } catch (err) {
        console.error('Failed to import memories:', err);
        setError('Failed to import memories. Please check the file format.');
      }
    };
    
    reader.readAsText(file);
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-400">Loading character memories...</div>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Character Memory System</h1>
          {onClose && (
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
            >
              Close
            </button>
          )}
        </div>
        
        {error && (
          <div className="bg-red-900 text-white p-3 rounded mb-4">
            {error}
            <button 
              className="ml-4 underline"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              <div className="p-4 bg-gray-700 border-b border-gray-600">
                <h2 className="font-semibold">Characters</h2>
              </div>
              <div className="p-2">
                {characters.length === 0 ? (
                  <p className="text-gray-400 p-2 text-sm">No character memories found.</p>
                ) : (
                  <div className="space-y-1">
                    {characters.map(({ character, memory }) => (
                      <button
                        key={memory.characterId}
                        className={`w-full text-left px-3 py-2 rounded ${
                          selectedCharacterId === memory.characterId
                            ? 'bg-blue-700 text-white'
                            : 'hover:bg-gray-700 text-gray-300'
                        }`}
                        onClick={() => handleSelectCharacter(memory.characterId)}
                      >
                        <div className="font-medium">{character?.name || memory.characterId}</div>
                        <div className="text-xs opacity-70">
                          {memory.scene_appearances.length} appearances
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Memory Management */}
              <div className="p-4 border-t border-gray-700">
                <h3 className="font-medium mb-3">Memory Management</h3>
                <div className="space-y-2">
                  <button
                    onClick={handleExportMemories}
                    className="w-full px-3 py-2 bg-purple-800 hover:bg-purple-700 rounded text-sm"
                  >
                    Export All Memories
                  </button>
                  
                  <label className="w-full px-3 py-2 bg-purple-800 hover:bg-purple-700 rounded text-sm flex items-center justify-center cursor-pointer">
                    Import Memories
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".json" 
                      onChange={handleImportMemories}
                    />
                  </label>
                </div>
              </div>
            </div>
            
            {/* Settings Panel */}
            {selectedCharacterId && (
              <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden mt-6">
                <div className="p-4 bg-gray-700 border-b border-gray-600">
                  <h2 className="font-semibold">Memory Settings</h2>
                </div>
                
                <div className="p-4">
                  <h3 className="font-medium mb-3">Reinforcement Settings</h3>
                  
                  <div className="space-y-4 mb-4">
                    <div>
                      <label className="block text-sm mb-1">Face Emphasis ({faceEmphasis}/10)</label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={faceEmphasis}
                        onChange={(e) => setFaceEmphasis(parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm mb-1">Outfit Emphasis ({outfitEmphasis}/10)</label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={outfitEmphasis}
                        onChange={(e) => setOutfitEmphasis(parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm mb-1">Personality Emphasis ({personalityEmphasis}/10)</label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={personalityEmphasis}
                        onChange={(e) => setPersonalityEmphasis(parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={handleUpdateReinforcementSettings}
                    className="w-full px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded text-sm"
                  >
                    Update Reinforcement Settings
                  </button>
                </div>
                
                <div className="p-4 border-t border-gray-700">
                  <h3 className="font-medium mb-3">Add Memory Element</h3>
                  
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-sm mb-1">Key</label>
                      <input
                        type="text"
                        value={newElementKey}
                        onChange={(e) => setNewElementKey(e.target.value)}
                        placeholder="e.g., eye_color, hairstyle"
                        className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm mb-1">Value</label>
                      <textarea
                        value={newElementValue}
                        onChange={(e) => setNewElementValue(e.target.value)}
                        placeholder="e.g., Bright blue eyes, Curly brown hair"
                        className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600"
                        rows={3}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm mb-1">Importance ({newElementImportance}/10)</label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={newElementImportance}
                        onChange={(e) => setNewElementImportance(parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={handleAddMemoryElement}
                    className="w-full px-3 py-2 bg-green-700 hover:bg-green-600 rounded text-sm"
                    disabled={!newElementKey || !newElementValue}
                  >
                    Add Memory Element
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Main Content */}
          <div className="lg:col-span-3">
            {selectedCharacterId ? (
              <CharacterMemoryViewer characterId={selectedCharacterId} />
            ) : (
              <div className="bg-gray-800 rounded-lg shadow-lg p-6 text-center">
                <h2 className="text-xl mb-3">Character Memory System</h2>
                <p className="text-gray-400">
                  Select a character from the sidebar to view and manage their memory.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterMemoryManager;