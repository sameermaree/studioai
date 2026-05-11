import React from 'react';
import CharacterMemoryManager from '../components/CharacterMemoryManager';
import { useRouter } from 'next/router';

const CharacterMemoryPage: React.FC = () => {
  const router = useRouter();
  
  const handleClose = () => {
    // Navigate back to characters page
    router.push('/characters');
  };
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <CharacterMemoryManager onClose={handleClose} />
    </div>
  );
};

export default CharacterMemoryPage;