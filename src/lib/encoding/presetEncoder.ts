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
  type: 'dots' | 'lines' | 'squares';
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

interface PresetData {
  version?: number; // Optional version field for backward compatibility
  settings: {
    layer1: LayerSettings;
    layer2: LayerSettings;
    goo: GooSettings;
    touch?: TouchSettings;
  };
}

// Default values for backward compatibility
const DEFAULT_SETTINGS: PresetData['settings'] = {
  layer1: {
    spacing: 30,
    size: 8,
    rotation: 0,
    color: '#ffffff',
    type: 'dots',
    numShapes: 3,
    strokeWidth: 1
  },
  layer2: {
    spacing: 30,
    size: 8,
    rotation: 45,
    color: '#ffffff',
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
  }
};

// Main encoding function - simply stringify and base64 encode
export const encodePreset = (settings: PresetData['settings']): string => {
  // Add version information to the preset
  const presetData: PresetData = {
    version: 2, // Update version for new pattern types
    settings
  };
  
  // Take the settings, convert to JSON string, then base64 encode
  const jsonString = JSON.stringify(presetData);
  
  // Base64 encode and make URL safe
  return btoa(jsonString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

// Helper function to merge settings with defaults
const mergeWithDefaults = (settings: Partial<PresetData['settings']>): PresetData['settings'] => {
  return {
    layer1: { ...DEFAULT_SETTINGS.layer1, ...settings.layer1 },
    layer2: { ...DEFAULT_SETTINGS.layer2, ...settings.layer2 },
    goo: { ...DEFAULT_SETTINGS.goo, ...settings.goo },
    touch: { ...DEFAULT_SETTINGS.touch, ...settings.touch }
  };
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
    const data = JSON.parse(jsonString) as PresetData;
    
    // Handle different versions of presets
    if (data.version === undefined) {
      // Version 0 (legacy) - settings are at the root level
      return mergeWithDefaults(data as any);
    } else if (data.version === 1 || data.version === 2) {
      // Version 1 & 2 - settings are nested under settings property
      return mergeWithDefaults(data.settings);
    } else {
      throw new Error('Unsupported preset version');
    }
  } catch (error) {
    console.error('Error decoding preset:', error);
    throw new Error('Failed to load preset: Invalid format');
  }
}; 