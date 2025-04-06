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
  },
  // LFO parameters
  LFO: {
    ENABLED: 1,    // Boolean
    RATE: 12,      // 0-5 Hz (scaled)
    AMOUNT: 10     // 0-100 (scaled)
  }
} as const;

// Utility functions for binary conversion
function convertToBinary(value: number, bits: number): string {
  // Ensure value is within range for the given bit count
  const maxValue = Math.pow(2, bits) - 1;
  const clampedValue = Math.max(0, Math.min(maxValue, Math.round(value)));
  
  // Convert to binary and pad with leading zeros
  return clampedValue.toString(2).padStart(bits, '0');
}

function convertColorToBinary(color: string): string {
  // Extract RGB values from color string (supports hex, rgb, rgba)
  let r = 0, g = 0, b = 0;
  
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      // Convert shorthand hex (#RGB) to full form (#RRGGBB)
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
  }
  // Handle rgb/rgba colors
  else if (color.startsWith('rgb')) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (match) {
      r = parseInt(match[1]);
      g = parseInt(match[2]);
      b = parseInt(match[3]);
    }
  }
  // Handle hsl colors
  else if (color.startsWith('hsl')) {
    // This is a simplification - proper HSL to RGB conversion is more complex
    const match = color.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%/i);
    if (match) {
      // Simple approximation - convert to RGB
      const h = parseInt(match[1]) / 360;
      const s = parseInt(match[2]) / 100;
      const l = parseInt(match[3]) / 100;
      
      // HSL to RGB conversion
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      
      const hueToRgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      r = Math.round(hueToRgb(p, q, h + 1/3) * 255);
      g = Math.round(hueToRgb(p, q, h) * 255);
      b = Math.round(hueToRgb(p, q, h - 1/3) * 255);
    }
  }
  
  // Ensure values are in valid range
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  
  // Convert each component to binary and combine
  return convertToBinary(r, 8) + convertToBinary(g, 8) + convertToBinary(b, 8);
}

function binaryToColor(bits: string[]): string {
  // Extract RGB values from binary string
  const r = parseInt(bits.slice(0, 8).join(''), 2);
  const g = parseInt(bits.slice(8, 16).join(''), 2);
  const b = parseInt(bits.slice(16, 24).join(''), 2);
  
  // Convert to hex color
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function binaryToBase64(binary: string): string {
  // Pad binary string to multiple of 6 (base64 uses 6 bits per character)
  const padding = binary.length % 6 === 0 ? 0 : 6 - (binary.length % 6);
  const paddedBinary = binary.padEnd(binary.length + padding, '0');
  
  // Split into 6-bit chunks
  const chunks = [];
  for (let i = 0; i < paddedBinary.length; i += 6) {
    chunks.push(paddedBinary.substring(i, i + 6));
  }
  
  // Base64 character set
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  
  // Convert each 6-bit chunk to a base64 character
  const base64 = chunks.map(chunk => base64Chars[parseInt(chunk, 2)]).join('');
  
  return base64;
}

function base64ToBinary(base64: string): string[] {
  // Base64 character set
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  
  // Convert each base64 character to its 6-bit binary representation
  const binaryArray: string[] = [];
  
  for (let i = 0; i < base64.length; i++) {
    const charIndex = base64Chars.indexOf(base64[i]);
    if (charIndex !== -1) {
      const binaryChunk = charIndex.toString(2).padStart(6, '0');
      for (let j = 0; j < binaryChunk.length; j++) {
        binaryArray.push(binaryChunk[j]);
      }
    }
  }
  
  return binaryArray;
}

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

interface PresetData {
  version?: number; // Optional version field for backward compatibility
  settings: {
    layer1: LayerSettings;
    layer2: LayerSettings;
    goo: GooSettings;
    touch?: TouchSettings;
    lfo?: LfoSettings;
  };
}

// Helper function to merge settings with defaults
const DEFAULT_SETTINGS = {
  layer1: {
    spacing: 30,
    size: 8,
    rotation: 0,
    color: '#ff0000', // Default red
    type: 'dots' as const,
    numShapes: 3,
    strokeWidth: 1
  },
  layer2: {
    spacing: 30,
    size: 8,
    rotation: 45,
    color: '#0000ff', // Default blue
    type: 'dots' as const,
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
};

// Helper function to merge settings with defaults
export const mergeWithDefaults = (settings: any) => {
  return {
    layer1: { ...DEFAULT_SETTINGS.layer1, ...settings.layer1 },
    layer2: { ...DEFAULT_SETTINGS.layer2, ...settings.layer2 },
    goo: { ...DEFAULT_SETTINGS.goo, ...settings.goo },
    touch: { ...DEFAULT_SETTINGS.touch, ...settings.touch },
    lfo: { ...DEFAULT_SETTINGS.lfo, ...settings.lfo }
  };
};

// Main encoding function - simply stringify and base64 encode
export function encodePreset(data: PresetData): string {
  let bitString = "";
  
  // Add version
  const version = data.version || 1;
  bitString += convertToBinary(version, 4);
  
  // Encode layer1 settings
  bitString += convertToBinary(data.settings.layer1.spacing, BITS.LAYER.SPACING);
  bitString += convertToBinary(data.settings.layer1.size, BITS.LAYER.SIZE);
  bitString += convertToBinary(data.settings.layer1.rotation, BITS.LAYER.ROTATION);
  bitString += convertColorToBinary(data.settings.layer1.color);
  
  // Encode pattern type (2 bits: 00=dots, 01=lines, 10=squares)
  if (data.settings.layer1.type === 'dots') {
    bitString += '00';
  } else if (data.settings.layer1.type === 'lines') {
    bitString += '01';
  } else if (data.settings.layer1.type === 'squares') {
    bitString += '10';
  }
  
  // Encode layer2 settings
  bitString += convertToBinary(data.settings.layer2.spacing, BITS.LAYER.SPACING);
  bitString += convertToBinary(data.settings.layer2.size, BITS.LAYER.SIZE);
  bitString += convertToBinary(data.settings.layer2.rotation, BITS.LAYER.ROTATION);
  bitString += convertColorToBinary(data.settings.layer2.color);
  
  // Encode pattern type
  if (data.settings.layer2.type === 'dots') {
    bitString += '00';
  } else if (data.settings.layer2.type === 'lines') {
    bitString += '01';
  } else if (data.settings.layer2.type === 'squares') {
    bitString += '10';
  }
  
  // Encode goo settings
  bitString += data.settings.goo.enabled ? '1' : '0';
  bitString += convertToBinary(data.settings.goo.blur, BITS.GOO.BLUR);
  bitString += convertToBinary(data.settings.goo.threshold, BITS.GOO.THRESHOLD);
  bitString += convertToBinary(data.settings.goo.prePixelate, BITS.GOO.PRE_PIXELATE);
  bitString += convertToBinary(data.settings.goo.postPixelate, BITS.GOO.POST_PIXELATE);
  
  // Encode LFO settings if they exist
  if (data.settings.lfo) {
    bitString += data.settings.lfo.enabled ? '1' : '0';
    // Scale rate from 0-5 to 0-4095 (12 bits)
    const scaledRate = Math.min(4095, Math.floor(data.settings.lfo.rate * 1000));
    bitString += convertToBinary(scaledRate, BITS.LFO.RATE);
    // Scale amount to 0-1023 (10 bits)
    const scaledAmount = Math.min(1023, Math.floor(data.settings.lfo.amount * 10));
    bitString += convertToBinary(scaledAmount, BITS.LFO.AMOUNT);
  }
  
  // Convert binary string to base64
  return binaryToBase64(bitString);
}

// Main decoding function - base64 decode and parse JSON
export function decodePreset(encodedString: string): PresetData {
  // Convert base64 to binary
  const bitArray = base64ToBinary(encodedString);
  
  // Start tracking the current bit position
  let currentBit = 0;
  
  // Read version (4 bits)
  const version = parseInt(bitArray.slice(currentBit, currentBit + 4).join(''), 2);
  currentBit += 4;
  
  // Read layer1 settings
  const layer1Spacing = parseInt(bitArray.slice(currentBit, currentBit + BITS.LAYER.SPACING).join(''), 2);
  currentBit += BITS.LAYER.SPACING;
  
  const layer1Size = parseInt(bitArray.slice(currentBit, currentBit + BITS.LAYER.SIZE).join(''), 2);
  currentBit += BITS.LAYER.SIZE;
  
  const layer1Rotation = parseInt(bitArray.slice(currentBit, currentBit + BITS.LAYER.ROTATION).join(''), 2);
  currentBit += BITS.LAYER.ROTATION;
  
  const layer1Color = binaryToColor(bitArray.slice(currentBit, currentBit + BITS.LAYER.COLOR));
  currentBit += BITS.LAYER.COLOR;
  
  // Read pattern type (2 bits)
  const layer1Type = bitArray.slice(currentBit, currentBit + 2).join('');
  currentBit += 2;
  let layer1PatternType: 'dots' | 'lines' | 'squares' = 'dots';
  if (layer1Type === '01') layer1PatternType = 'lines';
  if (layer1Type === '10') layer1PatternType = 'squares';
  
  // Read layer2 settings
  const layer2Spacing = parseInt(bitArray.slice(currentBit, currentBit + BITS.LAYER.SPACING).join(''), 2);
  currentBit += BITS.LAYER.SPACING;
  
  const layer2Size = parseInt(bitArray.slice(currentBit, currentBit + BITS.LAYER.SIZE).join(''), 2);
  currentBit += BITS.LAYER.SIZE;
  
  const layer2Rotation = parseInt(bitArray.slice(currentBit, currentBit + BITS.LAYER.ROTATION).join(''), 2);
  currentBit += BITS.LAYER.ROTATION;
  
  const layer2Color = binaryToColor(bitArray.slice(currentBit, currentBit + BITS.LAYER.COLOR));
  currentBit += BITS.LAYER.COLOR;
  
  // Read pattern type (2 bits)
  const layer2Type = bitArray.slice(currentBit, currentBit + 2).join('');
  currentBit += 2;
  let layer2PatternType: 'dots' | 'lines' | 'squares' = 'dots';
  if (layer2Type === '01') layer2PatternType = 'lines';
  if (layer2Type === '10') layer2PatternType = 'squares';
  
  // Read goo settings
  const gooEnabled = bitArray[currentBit] === '1';
  currentBit += BITS.GOO.ENABLED;
  
  const gooBlur = parseInt(bitArray.slice(currentBit, currentBit + BITS.GOO.BLUR).join(''), 2);
  currentBit += BITS.GOO.BLUR;
  
  const gooThreshold = parseInt(bitArray.slice(currentBit, currentBit + BITS.GOO.THRESHOLD).join(''), 2);
  currentBit += BITS.GOO.THRESHOLD;
  
  const gooPrePixelate = parseInt(bitArray.slice(currentBit, currentBit + BITS.GOO.PRE_PIXELATE).join(''), 2);
  currentBit += BITS.GOO.PRE_PIXELATE;
  
  const gooPostPixelate = parseInt(bitArray.slice(currentBit, currentBit + BITS.GOO.POST_PIXELATE).join(''), 2);
  currentBit += BITS.GOO.POST_PIXELATE;
  
  // Default preset data
  const presetData: PresetData = {
    version,
    settings: {
      layer1: {
        spacing: layer1Spacing,
        size: layer1Size,
        rotation: layer1Rotation,
        color: layer1Color,
        type: layer1PatternType
      },
      layer2: {
        spacing: layer2Spacing,
        size: layer2Size,
        rotation: layer2Rotation,
        color: layer2Color,
        type: layer2PatternType
      },
      goo: {
        enabled: gooEnabled,
        blur: gooBlur,
        threshold: gooThreshold,
        prePixelate: gooPrePixelate,
        postPixelate: gooPostPixelate
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
    }
  };
  
  // Decode LFO settings if there are enough bits remaining
  if (bitArray.length >= currentBit + BITS.LFO.ENABLED + BITS.LFO.RATE + BITS.LFO.AMOUNT) {
    const lfoEnabled = bitArray[currentBit] === '1';
    currentBit += BITS.LFO.ENABLED;
    
    // Decode rate (12 bits, scaled from 0-4095 to 0-5)
    const rateValue = parseInt(bitArray.slice(currentBit, currentBit + BITS.LFO.RATE).join(''), 2);
    const lfoRate = Math.max(0.001, rateValue / 1000);
    currentBit += BITS.LFO.RATE;
    
    // Decode amount (10 bits, scaled from 0-1023 to 0-100)
    const amountValue = parseInt(bitArray.slice(currentBit, currentBit + BITS.LFO.AMOUNT).join(''), 2);
    const lfoAmount = amountValue / 10;
    currentBit += BITS.LFO.AMOUNT;
    
    presetData.settings.lfo = {
      enabled: lfoEnabled,
      targetSection: 'layer1',
      targetProperty: 'rotation',
      rate: lfoRate,
      amount: lfoAmount,
      lastChangedParam: {
        section: 'layer1',
        property: 'rotation'
      }
    };
  }
  
  return presetData;
} 