import React, { useState, useEffect } from 'react';
import Canvas from '@/components/Canvas';
import { decodePreset } from '@/lib/encoding/presetEncoder';
import { useToast } from "@/components/ui/use-toast";

// Function to generate random colors (same as in ControlPanel)
const generateRandomColor = () => {
  // Generate muted, stylish colors instead of fully saturated ones
  const h = Math.floor(Math.random() * 360); // Hue: 0-359
  const s = 40 + Math.floor(Math.random() * 30); // Saturation: 40-69%
  const l = 40 + Math.floor(Math.random() * 20); // Lightness: 40-59%
  
  return `hsl(${h}, ${s}%, ${l}%)`;
};

const Index = () => {
  const { toast } = useToast();
  // Generate random colors for initial load
  const initialColor1 = generateRandomColor();
  const initialColor2 = generateRandomColor();
  
  // Default settings with random colors
  const [settings, setSettings] = useState({
    layer1: {
      spacing: 30,
      size: 8,
      rotation: 0,
      color: initialColor1
    },
    layer2: {
      spacing: 30,
      size: 8,
      rotation: 45,
      color: initialColor2
    },
    goo: {
      enabled: false,
      blur: 8,
      threshold: 128,
      prePixelate: 1,
      postPixelate: 1
    },
    touch: {
      enablePinchZoom: true,
      enablePinchRotate: true
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
        /*toast({
          title: "Preset Loaded",
          description: "Successfully loaded preset from URL",
        });*/
      } catch (error) {
        console.error('Failed to load preset:', error);
        /*toast({
          title: "Failed to Load Preset",
          description: "The preset URL appears to be invalid or corrupted",
          variant: "destructive",
        });*/
      }
    }
  }, /*[toast]*/);

  return (
    <div className="h-screen w-screen overflow-hidden bg-zinc-950">
      <Canvas settings={settings} setSettings={setSettings} />
    </div>
  );
};

export default Index;
