import React, { useState, useEffect, useRef } from 'react';
import Canvas from '@/components/Canvas';
import { decodePreset } from '@/lib/encoding/presetEncoder';
import { useToast } from "@/components/ui/use-toast";

// Define types to match presetEncoder
type PatternType = 'dots' | 'lines' | 'squares';

interface LayerSettings {
  spacing: number;
  size: number;
  rotation: number;
  color: string;
  type: PatternType;
  numShapes?: number;
  strokeWidth?: number;
}

interface GooSettings {
  enabled: boolean;
  blur: number;
  threshold: number;
  prePixelate: number;
  postPixelate: number;
}

interface TouchSettings {
  enablePinchZoom: boolean;
  enablePinchRotate: boolean;
}

interface LfoSettings {
  enabled: boolean;
  targetSection: string;
  targetProperty: string;
  rate: number;
  amount: number;
  lastChangedParam: {
    section: string;
    property: string;
  };
}

interface AppSettings {
  layer1: LayerSettings;
  layer2: LayerSettings;
  goo: GooSettings;
  touch: TouchSettings;
  lfo: LfoSettings;
}

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
  
  // LFO animation reference
  const lfoAnimationRef = useRef<number | null>(null);
  const lfoStartTimeRef = useRef<number>(Date.now());
  const baseValueRef = useRef<number | null>(null);
  
  // Default settings with random colors
  const [settings, setSettings] = useState<AppSettings>({
    layer1: {
      spacing: 30,
      size: 8,
      rotation: 0,
      color: initialColor1,
      type: 'dots',
      numShapes: 3,
      strokeWidth: 1
    },
    layer2: {
      spacing: 30,
      size: 8,
      rotation: 45,
      color: initialColor2,
      type: 'dots',
      numShapes: 3,
      strokeWidth: 1
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
    },
    lfo: {
      enabled: false,
      targetSection: 'layer1',
      targetProperty: 'rotation',
      rate: 0.1,
      amount: 10,
      lastChangedParam: {
        section: 'layer1',
        property: 'rotation'
      }
    }
  });

  // Handle LFO animation - only depends on enabled state
  useEffect(() => {
    // Clean up any existing animation
    if (lfoAnimationRef.current) {
      cancelAnimationFrame(lfoAnimationRef.current);
      lfoAnimationRef.current = null;
    }

    // Only run animation if LFO is enabled
    if (!settings.lfo.enabled) {
      // Reset baseValue when LFO is disabled
      baseValueRef.current = null;
      return;
    }

    // Start time for the sine wave - only reset when enabled changes
    lfoStartTimeRef.current = Date.now();
    
    // Animation function
    const animate = () => {
      // Get current values on each frame
      const section = settings.lfo.lastChangedParam.section;
      const property = settings.lfo.lastChangedParam.property;
      
      // Make sure the target section and property exist
      if (settings[section] && typeof settings[section][property] !== 'undefined') {
        // Store the base value to oscillate around (only once when animation starts)
        if (baseValueRef.current === null) {
          baseValueRef.current = settings[section][property];
        }
        
        // Only apply LFO to numeric properties
        if (typeof baseValueRef.current === 'number') {
          const elapsedMs = Date.now() - lfoStartTimeRef.current;
          const frequency = settings.lfo.rate; // Hz - read current rate
          const period = 1 / frequency; // seconds
          const amplitude = settings.lfo.amount;
          
          // Calculate sine wave value (ranges from -1 to 1)
          const sineValue = Math.sin(2 * Math.PI * (elapsedMs / 1000) / period);
          
          // Apply the sine wave to the parameter
          setSettings(prev => {
            // Skip update if LFO was disabled during animation
            if (!prev.lfo.enabled) return prev;
            
            // Use the latest settings for the modulation calculation
            const latestFrequency = prev.lfo.rate;
            const latestAmplitude = prev.lfo.amount;
            const latestPeriod = 1 / latestFrequency;
            
            // Recalculate sineValue with the latest frequency
            const latestSineValue = Math.sin(2 * Math.PI * (elapsedMs / 1000) / latestPeriod);
            
            // Calculate the new value with the sine wave using the stable base value
            const newValue = baseValueRef.current! + (latestSineValue * latestAmplitude);
            
            // Return updated settings without triggering LFO tracking
            return {
              ...prev,
              [section]: {
                ...prev[section],
                [property]: newValue
              }
            };
          });
        }
      }
      
      // Continue animation loop
      lfoAnimationRef.current = requestAnimationFrame(animate);
    };
    
    // Start the animation loop
    lfoAnimationRef.current = requestAnimationFrame(animate);
    
    // Cleanup on unmount or when dependencies change
    return () => {
      if (lfoAnimationRef.current) {
        cancelAnimationFrame(lfoAnimationRef.current);
        lfoAnimationRef.current = null;
      }
    };
  }, [settings.lfo.enabled]); // Only depend on enabled state

  // Also update the base value when a parameter changes manually (not during animation)
  useEffect(() => {
    // Only update the base value when the LFO is disabled
    // This ensures we get the clean manual value without LFO influence
    if (!settings.lfo.enabled) {
      const section = settings.lfo.lastChangedParam.section;
      const property = settings.lfo.lastChangedParam.property;
      
      if (settings[section] && typeof settings[section][property] === 'number') {
        baseValueRef.current = settings[section][property];
      }
    }
  }, [
    settings.layer1, 
    settings.layer2, 
    settings.goo, 
    settings.lfo.lastChangedParam,
    settings.lfo.enabled
  ]);

  // Handle URL parameters on load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const preset = urlParams.get('p');
    
    if (preset) {
      try {
        const decodedPreset = decodePreset(preset);
        
        // Convert PresetData structure to AppSettings structure
        const finalSettings: AppSettings = {
          layer1: decodedPreset.settings.layer1,
          layer2: decodedPreset.settings.layer2,
          goo: decodedPreset.settings.goo,
          touch: decodedPreset.settings.touch || {
            enablePinchZoom: true,
            enablePinchRotate: true
          },
          lfo: decodedPreset.settings.lfo || {
            enabled: false,
            targetSection: 'layer1',
            targetProperty: 'rotation',
            rate: 0.1,
            amount: 10,
            lastChangedParam: {
              section: 'layer1',
              property: 'rotation'
            }
          }
        };
        
        // Ensure pattern types are valid
        if (finalSettings.layer1.type && !['dots', 'lines', 'squares'].includes(finalSettings.layer1.type)) {
          finalSettings.layer1.type = 'dots';
        }
        if (finalSettings.layer2.type && !['dots', 'lines', 'squares'].includes(finalSettings.layer2.type)) {
          finalSettings.layer2.type = 'dots';
        }
        
        setSettings(finalSettings);
        /*toast({
          title: "Preset Loaded",
          description: "Successfully loaded preset from URL",
        });*/
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
    <div className="h-screen w-screen overflow-hidden bg-zinc-950">
      <Canvas settings={settings} setSettings={setSettings} />
    </div>
  );
};

export default Index;
