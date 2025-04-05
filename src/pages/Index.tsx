import React, { useState, useEffect } from 'react';
import Canvas from '@/components/Canvas';
import { decodePreset } from '@/lib/encoding/presetEncoder';
import { useToast } from "@/components/ui/use-toast";

const Index = () => {
  const { toast } = useToast();
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
        toast({
          title: "Preset Loaded",
          description: "Successfully loaded preset from URL",
        });
      } catch (error) {
        console.error('Failed to load preset:', error);
        toast({
          title: "Failed to Load Preset",
          description: "The preset URL appears to be invalid or corrupted",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <Canvas settings={settings} setSettings={setSettings} />
    </div>
  );
};

export default Index;
