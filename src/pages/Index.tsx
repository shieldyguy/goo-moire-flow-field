
import React, { useState } from 'react';
import Canvas from '@/components/Canvas';

const Index = () => {
  // Default settings
  const [settings, setSettings] = useState({
    layer1: {
      spacing: 30,
      size: 8,
      rotation: 0,
      color: '#ff5555'
    },
    layer2: {
      spacing: 30,
      size: 8,
      rotation: 45,
      color: '#5555ff'
    },
    goo: {
      blur: 8,
      threshold: 300, // Starting contrast value for CSS filter approach
      resolution: 100 // Default is full resolution
    }
  });

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <Canvas settings={settings} setSettings={setSettings} />
    </div>
  );
};

export default Index;
