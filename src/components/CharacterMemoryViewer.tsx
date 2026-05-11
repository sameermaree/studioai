import React, { useState, useEffect } from 'react';
import { PersistentCharacterMemory } from '../infrastructure/persistence/PersistentCharacterMemory';
import { EnhancedCharacterMemory } from '../domain/storytelling/entities/CharacterMemory';
import { Character } from '../types';

interface CharacterMemoryViewerProps {
  characterId: string;
}

const CharacterMemoryViewer: React.FC<CharacterMemoryViewerProps> = ({ characterId }) => {
  const [memory, setMemory] = useState<EnhancedCharacterMemory | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [activeTab, setActiveTab] = useState<'appearance' | 'personality' | 'relationships' | 'scenes'>('appearance');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadMemory = async () => {
      try {
        setLoading(true);
        const persistentMemory = new PersistentCharacterMemory();
        
        // Load character memory
        const characterMemory = persistentMemory.getOrCreateCharacterMemory(characterId);
        
        if (characterMemory) {
          setMemory(characterMemory);
          
          // Load character data
          const memoriesWithChars = persistentMemory.getAllMemoriesWithCharacters();
          const charData = memoriesWithChars.find(m => m.memory.characterId === characterId)?.character;
          
          if (charData) {
            setCharacter(charData);
          }
        } else {
          setError(`No memory found for character ${characterId}`);
        }
      } catch (err) {
        setError(`Failed to load character memory: ${err}`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    loadMemory();
  }, [characterId]);
  
  if (loading) {
    return <div className="p-4">Loading character memory...</div>;
  }
  
  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }
  
  if (!memory) {
    return <div className="p-4">No memory available for this character</div>;
  }
  
  return (
    <div className="bg-gray-900 text-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 p-4 border-b border-gray-700">
        <h2 className="text-xl font-semibold">Character Memory: {character?.name || memory.characterId}</h2>
        <p className="text-gray-400 text-sm">
          Last updated: {new Date(memory.last_updated).toLocaleString()}
        </p>
      </div>
      
      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('appearance')}
          className={`px-4 py-2 ${activeTab === 'appearance' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
        >
          Appearance
        </button>
        <button
          onClick={() => setActiveTab('personality')}
          className={`px-4 py-2 ${activeTab === 'personality' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
        >
          Personality
        </button>
        <button
          onClick={() => setActiveTab('relationships')}
          className={`px-4 py-2 ${activeTab === 'relationships' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
        >
          Relationships
        </button>
        <button
          onClick={() => setActiveTab('scenes')}
          className={`px-4 py-2 ${activeTab === 'scenes' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
        >
          Scenes
        </button>
      </div>
      
      {/* Content Area */}
      <div className="p-4">
        {activeTab === 'appearance' && (
          <div>
            <h3 className="text-lg font-medium mb-2">Visual Appearance Memory</h3>
            
            <div className="grid grid-cols-1 gap-4 mb-4">
              {/* Facial Features */}
              <div className="bg-gray-800 p-3 rounded">
                <h4 className="font-medium text-blue-400">Facial Features</h4>
                <p className="mt-1 text-sm">{memory.metadata.facial_features || 'No specific facial features recorded'}</p>
              </div>
              
              {/* Clothing */}
              <div className="bg-gray-800 p-3 rounded">
                <h4 className="font-medium text-blue-400">Clothing</h4>
                <p className="mt-1 text-sm">{memory.metadata.clothing_description || 'No specific clothing recorded'}</p>
              </div>
              
              {/* Body Type */}
              <div className="bg-gray-800 p-3 rounded">
                <h4 className="font-medium text-blue-400">Body Type</h4>
                <p className="mt-1 text-sm">{memory.metadata.body_type || 'No specific body type recorded'}</p>
              </div>
              
              {/* Colors */}
              <div className="bg-gray-800 p-3 rounded">
                <h4 className="font-medium text-blue-400">Color Scheme</h4>
                <p className="mt-1 text-sm">{memory.metadata.color_scheme || 'No specific color scheme recorded'}</p>
              </div>
            </div>
            
            <h3 className="text-lg font-medium mb-2 mt-6">Appearance History</h3>
            {memory.appearance_history.length === 0 ? (
              <p className="text-gray-400 text-sm">No appearance history recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {memory.appearance_history.map((appearance, index) => (
                  <div key={index} className="bg-gray-800 p-2 rounded text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Scene: {appearance.scene_id}</span>
                      <span className="text-gray-400">{new Date(appearance.timestamp).toLocaleString()}</span>
                    </div>
                    <p>{appearance.description}</p>
                    <span className="text-xs text-blue-300">Outfit: {appearance.outfit}</span>
                  </div>
                ))}
              </div>
            )}
            
            {/* Consistency Settings */}
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Consistency Settings</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(memory.consistencySettings).map(([key, value]) => (
                  <div key={key} className="flex items-center">
                    <span className={`inline-block w-3 h-3 rounded-full mr-2 ${value ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Reinforcement */}
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Reinforcement Levels</h3>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between">
                    <span className="text-sm">Face Emphasis</span>
                    <span className="text-sm">{memory.reinforcement.face_emphasis}/10</span>
                  </div>
                  <div className="w-full bg-gray-700 h-2 rounded-full mt-1">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${memory.reinforcement.face_emphasis * 10}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between">
                    <span className="text-sm">Outfit Emphasis</span>
                    <span className="text-sm">{memory.reinforcement.outfit_emphasis}/10</span>
                  </div>
                  <div className="w-full bg-gray-700 h-2 rounded-full mt-1">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${memory.reinforcement.outfit_emphasis * 10}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between">
                    <span className="text-sm">Personality Emphasis</span>
                    <span className="text-sm">{memory.reinforcement.personality_emphasis}/10</span>
                  </div>
                  <div className="w-full bg-gray-700 h-2 rounded-full mt-1">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${memory.reinforcement.personality_emphasis * 10}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'personality' && (
          <div>
            <h3 className="text-lg font-medium mb-2">Personality & Emotions</h3>
            
            {/* Current Emotion */}
            <div className="bg-gray-800 p-3 rounded mb-4">
              <h4 className="font-medium text-blue-400">Current Emotional State</h4>
              <div className="mt-1 text-xl font-semibold">
                {memory.emotional_state.current || 'Neutral'}
              </div>
            </div>
            
            {/* Core Traits */}
            <div className="bg-gray-800 p-3 rounded mb-4">
              <h4 className="font-medium text-blue-400">Core Personality Traits</h4>
              {memory.personality.core_traits.length === 0 ? (
                <p className="mt-1 text-sm text-gray-400">No core traits recorded.</p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-2">
                  {memory.personality.core_traits.map((trait, index) => (
                    <span key={index} className="px-2 py-1 bg-blue-900 text-blue-100 rounded text-sm">
                      {trait}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            {/* Emotional History */}
            <div className="mb-6">
              <h4 className="font-medium text-blue-400 mb-2">Emotional History</h4>
              {memory.emotional_state.history.length === 0 ? (
                <p className="text-sm text-gray-400">No emotional history recorded yet.</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto pr-2">
                  {memory.emotional_state.history.map((entry, index) => (
                    <div key={index} className="flex justify-between text-sm border-b border-gray-700 pb-1">
                      <span>{entry.emotion}</span>
                      <span className="text-gray-400">Scene: {entry.scene_id}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Exhibited Behaviors */}
            <div>
              <h4 className="font-medium text-blue-400 mb-2">Exhibited Behaviors</h4>
              {memory.personality.exhibited_behaviors.length === 0 ? (
                <p className="text-sm text-gray-400">No behaviors recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {memory.personality.exhibited_behaviors.map((behavior, index) => (
                    <div key={index} className="bg-gray-800 p-2 rounded">
                      <div className="flex justify-between">
                        <span className="text-yellow-300 font-medium">{behavior.trait}</span>
                        <span className="text-xs text-gray-400">Scene: {behavior.scene_id}</span>
                      </div>
                      <p className="text-sm mt-1">{behavior.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Knowledge Facts */}
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Character Knowledge</h3>
              {memory.knowledge.length === 0 ? (
                <p className="text-sm text-gray-400">No knowledge facts recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {memory.knowledge.map((knowledge, index) => (
                    <div key={index} className="bg-gray-800 p-2 rounded">
                      <div className="flex justify-between">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          knowledge.importance === 'high' ? 'bg-red-900 text-red-100' :
                          knowledge.importance === 'medium' ? 'bg-yellow-900 text-yellow-100' :
                          'bg-gray-700 text-gray-300'
                        }`}>
                          {knowledge.importance}
                        </span>
                        <span className="text-xs text-gray-400">Scene: {knowledge.source_scene_id}</span>
                      </div>
                      <p className="text-sm mt-1">{knowledge.fact}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'relationships' && (
          <div>
            <h3 className="text-lg font-medium mb-2">Character Relationships</h3>
            
            {Object.keys(memory.relationships).length === 0 ? (
              <p className="text-gray-400">No relationships recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(memory.relationships).map(([characterId, relationship]) => (
                  <div key={characterId} className="bg-gray-800 p-3 rounded">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">{characterId}</h4>
                      <span className="text-sm text-gray-400">Last updated: {new Date(relationship.last_updated).toLocaleString()}</span>
                    </div>
                    
                    <div className="mt-2 flex items-center">
                      <span className="text-sm mr-2">Relationship type:</span>
                      <span className="px-2 py-1 bg-purple-900 text-purple-100 rounded text-sm">
                        {relationship.type}
                      </span>
                    </div>
                    
                    {/* Sentiment Bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Negative</span>
                        <span>Neutral</span>
                        <span>Positive</span>
                      </div>
                      <div className="w-full bg-gray-700 h-3 rounded-full relative">
                        <div className="absolute inset-y-0 left-1/2 w-px bg-gray-500"></div>
                        <div 
                          className={`h-3 rounded-full absolute top-0 ${
                            relationship.sentiment > 0 ? 'bg-green-500 left-1/2' : 'bg-red-500 right-1/2'
                          }`}
                          style={{ 
                            width: `${Math.abs(relationship.sentiment) * 5}%`,
                            maxWidth: '50%'
                          }}
                        ></div>
                        <div 
                          className="w-3 h-3 bg-white rounded-full absolute top-0 -mt-0 transform -translate-x-1/2"
                          style={{ left: `${50 + relationship.sentiment * 5}%` }}
                        ></div>
                      </div>
                      <div className="text-center text-sm mt-1">
                        Sentiment: {relationship.sentiment}
                      </div>
                    </div>
                    
                    {/* Interactions */}
                    <div className="mt-4">
                      <h5 className="text-sm font-medium text-blue-400">Interaction History</h5>
                      {relationship.interactions.length === 0 ? (
                        <p className="text-xs text-gray-400 mt-1">No interactions recorded.</p>
                      ) : (
                        <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-2">
                          {relationship.interactions.map((interaction, index) => (
                            <div key={index} className="bg-gray-700 p-2 rounded text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-300">Scene: {interaction.scene_id}</span>
                                <span className="text-gray-400">{new Date(interaction.timestamp).toLocaleString()}</span>
                              </div>
                              <p className="mt-1">{interaction.description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'scenes' && (
          <div>
            <h3 className="text-lg font-medium mb-2">Scene Appearances</h3>
            
            {memory.scene_appearances.length === 0 ? (
              <p className="text-gray-400">No scene appearances recorded yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {memory.scene_appearances.map((appearance, index) => (
                  <div key={index} className="bg-gray-800 p-3 rounded">
                    <h4 className="font-medium">Scene: {appearance.scene_id}</h4>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-blue-400">Emotion: {appearance.emotion}</span>
                    </div>
                    {appearance.image_url && (
                      <div className="mt-2">
                        <img 
                          src={appearance.image_url} 
                          alt={`${memory.characterId} in scene ${appearance.scene_id}`}
                          className="w-full h-32 object-cover rounded"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Memory Elements */}
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Memory Elements</h3>
              <p className="text-sm text-gray-400 mb-2">These elements are maintained across scenes for consistency.</p>
              
              {memory.memory_elements.length === 0 ? (
                <p className="text-gray-400">No memory elements recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {memory.memory_elements.sort((a, b) => b.importance - a.importance).map((element, index) => (
                    <div key={index} className="bg-gray-800 p-2 rounded flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center font-bold mr-3">
                        {element.importance}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">{element.key}</h4>
                        <p className="text-xs text-gray-300">{element.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterMemoryViewer;