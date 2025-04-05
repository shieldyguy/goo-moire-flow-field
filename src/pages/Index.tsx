import React, { useState, useEffect } from 'react';
import Canvas from '@/components/Canvas';
import { decodePreset } from '@/lib/encoding/presetEncoder';

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
      enabled: false,
      blur: 8,
      threshold: 128,
      resolution: 100
    }
  });

  // Handle URL parameters on load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const preset = urlParams.get('p');
    
    if (preset) {
      try {
        const decodedSettings = decodePreset(preset);
        setSettings(decodedSettings);
      } catch (error) {
        console.error('Failed to load preset:', error);
        // Could add a toast notification here
      }
    }
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <Canvas settings={settings} setSettings={setSettings} />
    </div>
  );
};

export default Index;
