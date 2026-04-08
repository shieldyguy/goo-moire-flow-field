import React, { useState, useEffect } from "react";
import Canvas from "@/components/Canvas";
import { decodePreset } from "@/lib/encoding/presetEncoder";
import { useToast } from "@/components/ui/use-toast";

// Define types to match presetEncoder
type PatternType = "dots" | "lines" | "squares";

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
  driftFriction: number;
}

interface TouchSettings {
  enablePinchZoom: boolean;
  enablePinchRotate: boolean;
}

interface AudioSettings {
  enabled: boolean;
  masterVolume: number;
  interactionRadius: number;
  frequencyRange: { min: number; max: number };
  rampTimeMs: number;
  maxVoices: number;
}

interface AppSettings {
  layer1: LayerSettings;
  layer2: LayerSettings;
  goo: GooSettings;
  touch: TouchSettings;
  audio: AudioSettings;
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

  // Default settings with random colors
  const [settings, setSettings] = useState<AppSettings>({
    layer1: {
      spacing: 33,
      size: 19,
      rotation: 0,
      color: initialColor1,
      type: "dots",
      numShapes: 3,
      strokeWidth: 1,
    },
    layer2: {
      spacing: 35,
      size: 20.5,
      rotation: 0,
      color: initialColor2,
      type: "dots",
      numShapes: 3,
      strokeWidth: 1,
    },
    goo: {
      enabled: true,
      blur: 6,
      threshold: 41,
      prePixelate: 1,
      postPixelate: 1,
      driftFriction: 0,
    },
    touch: {
      enablePinchZoom: true,
      enablePinchRotate: true,
    },
    audio: {
      enabled: false,
      masterVolume: 0.3,
      interactionRadius: 1,
      frequencyRange: { min: 80, max: 800 },
      rampTimeMs: 40,
      maxVoices: 128,
    },
  });

  // Handle URL parameters on load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const preset = urlParams.get("p");

    if (preset) {
      try {
        const decodedSettings = decodePreset(preset);
        // Ensure we have touch settings, even if preset doesn't include them
        const finalSettings = {
          ...decodedSettings,
          // Add touch settings if they're missing
          touch: decodedSettings.touch || {
            enablePinchZoom: true,
            enablePinchRotate: true,
          },
          // Audio is never persisted in presets — always start silent
          audio: {
            enabled: false,
            masterVolume: 0.3,
            interactionRadius: 1,
            frequencyRange: { min: 80, max: 800 },
            rampTimeMs: 40,
            maxVoices: 128,
          },
        } as AppSettings;

        // Ensure pattern types are valid
        if (
          finalSettings.layer1.type &&
          !["dots", "lines", "squares"].includes(finalSettings.layer1.type)
        ) {
          finalSettings.layer1.type = "dots";
        }
        if (
          finalSettings.layer2.type &&
          !["dots", "lines", "squares"].includes(finalSettings.layer2.type)
        ) {
          finalSettings.layer2.type = "dots";
        }

        setSettings(finalSettings);
        /*toast({
          title: "Preset Loaded",
          description: "Successfully loaded preset from URL",
        });*/
      } catch (error) {
        console.error("Failed to load preset:", error);
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
