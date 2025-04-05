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
    RESOLUTION: 8  // 0-255 (percentage)
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
  resolution: number;
}

interface PresetData {
  version: number;
  settings: {
    layer1: LayerSettings;
    layer2: LayerSettings;
    goo: GooSettings;
  };
  checksum: string;
}

// Utility functions
const numberToBinary = (num: number, bits: number): string => {
  if (num < 0 || num >= Math.pow(2, bits)) {
    throw new Error(`Number ${num} out of range for ${bits} bits`);
  }
  return num.toString(2).padStart(bits, '0');
};

const binaryToNumber = (binary: string): number => {
  return parseInt(binary, 2);
};

const colorToBinary = (color: string): string => {
  // Remove # if present and convert to RGB
  const hex = color.replace('#', '');
  if (hex.length !== 6) {
    throw new Error('Invalid color format');
  }
  
  // Convert each channel to 8-bit binary
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return numberToBinary(r, 8) + numberToBinary(g, 8) + numberToBinary(b, 8);
};

const binaryToColor = (binary: string): string => {
  if (binary.length !== 24) {
    throw new Error('Invalid color binary length');
  }
  
  const r = binaryToNumber(binary.substring(0, 8));
  const g = binaryToNumber(binary.substring(8, 16));
  const b = binaryToNumber(binary.substring(16, 24));
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const createChecksum = (data: string): string => {
  // Simple checksum: sum of all bits modulo 256
  const sum = data.split('').reduce((acc, bit) => acc + parseInt(bit, 2), 0);
  return numberToBinary(sum % 256, 8);
};

// Main encoding function
export const encodePreset = (settings: PresetData['settings']): string => {
  let binary = '';
  
  // Version (4 bits for future compatibility)
  binary += numberToBinary(1, 4);
  
  // Layer 1
  binary += numberToBinary(settings.layer1.spacing, BITS.LAYER.SPACING);
  binary += numberToBinary(settings.layer1.size, BITS.LAYER.SIZE);
  binary += numberToBinary(settings.layer1.rotation, BITS.LAYER.ROTATION);
  binary += colorToBinary(settings.layer1.color);
  
  // Layer 2
  binary += numberToBinary(settings.layer2.spacing, BITS.LAYER.SPACING);
  binary += numberToBinary(settings.layer2.size, BITS.LAYER.SIZE);
  binary += numberToBinary(settings.layer2.rotation, BITS.LAYER.ROTATION);
  binary += colorToBinary(settings.layer2.color);
  
  // Goo settings
  binary += settings.goo.enabled ? '1' : '0';
  binary += numberToBinary(settings.goo.blur, BITS.GOO.BLUR);
  binary += numberToBinary(settings.goo.threshold, BITS.GOO.THRESHOLD);
  binary += numberToBinary(settings.goo.resolution, BITS.GOO.RESOLUTION);
  
  // Add checksum
  const checksum = createChecksum(binary);
  binary += checksum;
  
  // Convert to base64 for URL compatibility
  const bytes = [];
  for (let i = 0; i < binary.length; i += 8) {
    const byte = binary.substring(i, i + 8);
    bytes.push(parseInt(byte, 2));
  }
  
  // Convert to URL-safe base64
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

// Main decoding function
export const decodePreset = (encoded: string): PresetData['settings'] => {
  console.log('Decoding preset:', encoded);
  
  // Convert from URL-safe base64 to regular base64
  const base64 = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(encoded.length + (4 - encoded.length % 4) % 4, '=');
  console.log('Converted to regular base64:', base64);
  
  // Convert from base64 to binary
  const bytes = atob(base64).split('').map(c => c.charCodeAt(0));
  console.log('Bytes:', bytes);
  
  // Convert bytes to binary, ensuring each byte is 8 bits
  let binary = bytes.map(b => b.toString(2).padStart(8, '0')).join('');
  console.log('Binary length:', binary.length);
  console.log('Binary:', binary);
  
  // Verify checksum
  const checksum = binary.slice(-8);
  binary = binary.slice(0, -8);
  const calculatedChecksum = createChecksum(binary);
  console.log('Checksum:', checksum);
  console.log('Calculated checksum:', calculatedChecksum);
  
  if (calculatedChecksum !== checksum) {
    throw new Error(`Invalid checksum. Expected ${calculatedChecksum}, got ${checksum}`);
  }
  
  let offset = 0;
  
  // Version
  const version = binaryToNumber(binary.substring(offset, offset + 4));
  offset += 4;
  console.log('Version:', version);
  
  if (version !== 1) {
    throw new Error('Unsupported version');
  }
  
  // Layer 1
  const layer1 = {
    spacing: binaryToNumber(binary.substring(offset, offset + BITS.LAYER.SPACING)),
    size: binaryToNumber(binary.substring(offset + BITS.LAYER.SPACING, offset + BITS.LAYER.SPACING + BITS.LAYER.SIZE)),
    rotation: binaryToNumber(binary.substring(offset + BITS.LAYER.SPACING + BITS.LAYER.SIZE, offset + BITS.LAYER.SPACING + BITS.LAYER.SIZE + BITS.LAYER.ROTATION)),
    color: binaryToColor(binary.substring(offset + BITS.LAYER.SPACING + BITS.LAYER.SIZE + BITS.LAYER.ROTATION, offset + BITS.LAYER.SPACING + BITS.LAYER.SIZE + BITS.LAYER.ROTATION + BITS.LAYER.COLOR))
  };
  offset += BITS.LAYER.SPACING + BITS.LAYER.SIZE + BITS.LAYER.ROTATION + BITS.LAYER.COLOR;
  console.log('Layer 1:', layer1);
  
  // Layer 2
  const layer2 = {
    spacing: binaryToNumber(binary.substring(offset, offset + BITS.LAYER.SPACING)),
    size: binaryToNumber(binary.substring(offset + BITS.LAYER.SPACING, offset + BITS.LAYER.SPACING + BITS.LAYER.SIZE)),
    rotation: binaryToNumber(binary.substring(offset + BITS.LAYER.SPACING + BITS.LAYER.SIZE, offset + BITS.LAYER.SPACING + BITS.LAYER.SIZE + BITS.LAYER.ROTATION)),
    color: binaryToColor(binary.substring(offset + BITS.LAYER.SPACING + BITS.LAYER.SIZE + BITS.LAYER.ROTATION, offset + BITS.LAYER.SPACING + BITS.LAYER.SIZE + BITS.LAYER.ROTATION + BITS.LAYER.COLOR))
  };
  offset += BITS.LAYER.SPACING + BITS.LAYER.SIZE + BITS.LAYER.ROTATION + BITS.LAYER.COLOR;
  console.log('Layer 2:', layer2);
  
  // Goo settings
  const goo = {
    enabled: binary[offset] === '1',
    blur: binaryToNumber(binary.substring(offset + 1, offset + 1 + BITS.GOO.BLUR)),
    threshold: binaryToNumber(binary.substring(offset + 1 + BITS.GOO.BLUR, offset + 1 + BITS.GOO.BLUR + BITS.GOO.THRESHOLD)),
    resolution: binaryToNumber(binary.substring(offset + 1 + BITS.GOO.BLUR + BITS.GOO.THRESHOLD, offset + 1 + BITS.GOO.BLUR + BITS.GOO.THRESHOLD + BITS.GOO.RESOLUTION))
  };
  console.log('Goo settings:', goo);
  
  return { layer1, layer2, goo };
}; 