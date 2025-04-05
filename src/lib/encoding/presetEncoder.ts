// Bit allocation for each parameter
const BITS = {
  // Layer parameters (same for both layers)
  LAYER: {
    SPACING: 8,    // 0-255 pixels
    SIZE: 8,       // 0-255 pixels
    ROTATION: 9,   // 0-360 degrees
    COLOR: 24      // RGB (8 bits per channel)
  },
  // Goo effect parameters
  GOO: {
    ENABLED: 1,    // Boolean
    BLUR: 8,       // 0-255
    THRESHOLD: 8,  // 0-255
    PRE_PIXELATE: 8, // 0-255
    POST_PIXELATE: 8  // 0-255
  }
} as const;

// Type definitions
interface LayerSettings {
  spacing: number;
  size: number;
  rotation: number;
  color: string;
}

interface GooSettings {
  enabled: boolean;
  blur: number;
  threshold: number;
  prePixelate: number;
  postPixelate: number;
}

interface PresetData {
  settings: {
    layer1: LayerSettings;
    layer2: LayerSettings;
    goo: GooSettings;
  };
}

// Main encoding function - simply stringify and base64 encode
export const encodePreset = (settings: PresetData['settings']): string => {
  // Take the settings, convert to JSON string, then base64 encode
  const jsonString = JSON.stringify(settings);
  
  // Base64 encode and make URL safe
  return btoa(jsonString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

// Main decoding function - base64 decode and parse JSON
export const decodePreset = (encoded: string): PresetData['settings'] => {
  try {
    // Convert from URL-safe base64
    const base64 = encoded
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(encoded.length + (4 - encoded.length % 4) % 4, '=');
    
    // Decode base64 to JSON string
    const jsonString = atob(base64);
    
    // Parse JSON into settings object
    const settings = JSON.parse(jsonString);
    
    // Validate the settings structure
    if (!settings.layer1 || !settings.layer2 || !settings.goo) {
      throw new Error('Invalid preset format: missing required settings');
    }
    
    return settings;
  } catch (error) {
    console.error('Error decoding preset:', error);
    throw new Error('Failed to load preset: Invalid format');
  }
}; 