// V5 binary format: 49 bytes total (v4 was 41)
// Byte 0:     version (5)
// Bytes 1-12: Layer 1
//   1-2: spacing*100 (uint16)  3-4: size*100 (uint16)  5-6: rotation*10 (uint16)
//   7: R  8: G  9: B  10: type  11: numShapes  12: strokeWidth*10
// Bytes 13-24: Layer 2 (same layout)
// Bytes 25-29: Goo (enabled, blur, threshold, prePixelate, postPixelate)
// Byte 30: Touch flags (bit0=pinchZoom, bit1=pinchRotate)
// Bytes 31-40: Audio
//   31: flags (bit0=enabled)
//   32-33: masterVolume*1000 (uint16)
//   34-35: interactionRadius*10000 (uint16)
//   36-37: frequencyRange.min (uint16)
//   38-39: frequencyRange.max (uint16)
//   40: rampTimeMs (uint8)
// Bytes 41-48: Movement (v5)
//   41-42: offsetX (int16, wraps modular)
//   43-44: offsetY (int16)
//   45-46: velocityX * 10 (int16, px/sec)
//   47-48: velocityY * 10 (int16)

const TYPE_TO_ID: Record<string, number> = { dots: 0, lines: 1, squares: 2 };
const ID_TO_TYPE = ["dots", "lines", "squares"] as const;

interface LayerSettings {
  spacing: number;
  size: number;
  rotation: number;
  color: string;
  type: "dots" | "lines" | "squares";
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

interface AudioSettings {
  enabled: boolean;
  masterVolume: number;
  interactionRadius: number;
  frequencyRange: { min: number; max: number };
  rampTimeMs: number;
  maxVoices: number;
}

export interface MovementData {
  offsetX: number;
  offsetY: number;
  velocityX: number;
  velocityY: number;
}

interface PresetData {
  version?: number;
  settings: {
    layer1: LayerSettings;
    layer2: LayerSettings;
    goo: GooSettings;
    touch?: TouchSettings;
    audio?: AudioSettings;
  };
  movement?: MovementData;
}

const DEFAULT_SETTINGS: PresetData["settings"] = {
  layer1: {
    spacing: 33,
    size: 19,
    rotation: 0,
    color: "#ffffff",
    type: "dots",
    numShapes: 3,
    strokeWidth: 1,
  },
  layer2: {
    spacing: 35,
    size: 20.5,
    rotation: 0,
    color: "#ffffff",
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
  },
  touch: {
    enablePinchZoom: true,
    enablePinchRotate: true,
  },
  audio: {
    enabled: false,
    masterVolume: 0.3,
    interactionRadius: 0.1,
    frequencyRange: { min: 80, max: 800 },
    rampTimeMs: 25,
    maxVoices: 64,
  },
};

function colorToRgb(color: string): [number, number, number] {
  if (color.startsWith("#")) {
    const h = color.slice(1);
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  // Use canvas to normalize any CSS color (hsl, rgb, named) to hex
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.fillStyle = color;
  const h = ctx.fillStyle.slice(1);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, "0"))
      .join("")
  );
}

function encodeLayer(
  view: DataView,
  buf: Uint8Array,
  offset: number,
  layer: LayerSettings,
) {
  view.setUint16(offset, Math.round(layer.spacing * 100));
  view.setUint16(offset + 2, Math.round(layer.size * 100));
  view.setUint16(offset + 4, Math.round(layer.rotation * 10));
  const [r, g, b] = colorToRgb(layer.color);
  buf[offset + 6] = r;
  buf[offset + 7] = g;
  buf[offset + 8] = b;
  buf[offset + 9] = TYPE_TO_ID[layer.type] ?? 0;
  buf[offset + 10] = layer.numShapes ?? 3;
  buf[offset + 11] = Math.round((layer.strokeWidth ?? 1) * 10);
}

function decodeLayer(
  view: DataView,
  buf: Uint8Array,
  offset: number,
): LayerSettings {
  return {
    spacing: view.getUint16(offset) / 100,
    size: view.getUint16(offset + 2) / 100,
    rotation: view.getUint16(offset + 4) / 10,
    color: toHex(buf[offset + 6], buf[offset + 7], buf[offset + 8]),
    type: ID_TO_TYPE[buf[offset + 9]] ?? "dots",
    numShapes: buf[offset + 10],
    strokeWidth: buf[offset + 11] / 10,
  };
}

function toUrlBase64(buf: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buf.length; i++) {
    binary += String.fromCharCode(buf[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromUrlBase64(encoded: string): string {
  const base64 = encoded
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(encoded.length + ((4 - (encoded.length % 4)) % 4), "=");
  return atob(base64);
}

// Main encoding function - binary pack into 49 bytes (v5)
export const encodePreset = (
  settings: PresetData["settings"],
  movement?: MovementData,
): string => {
  const buf = new Uint8Array(49);
  const view = new DataView(buf.buffer);

  buf[0] = 5; // version

  encodeLayer(view, buf, 1, settings.layer1);
  encodeLayer(view, buf, 13, settings.layer2);

  // Goo
  buf[25] = settings.goo.enabled ? 1 : 0;
  buf[26] = Math.round(settings.goo.blur);
  buf[27] = Math.round(settings.goo.threshold);
  buf[28] = Math.round(settings.goo.prePixelate);
  buf[29] = Math.round(settings.goo.postPixelate);

  // Touch
  buf[30] =
    (settings.touch?.enablePinchZoom !== false ? 1 : 0) |
    (settings.touch?.enablePinchRotate !== false ? 2 : 0);

  // Audio
  const audio = settings.audio ?? DEFAULT_SETTINGS.audio!;
  buf[31] = audio.enabled ? 1 : 0;
  view.setUint16(32, Math.round(audio.masterVolume * 1000));
  view.setUint16(34, Math.round(audio.interactionRadius * 10000));
  view.setUint16(36, Math.round(audio.frequencyRange.min));
  view.setUint16(38, Math.round(audio.frequencyRange.max));
  buf[40] = Math.round(audio.rampTimeMs);

  // Movement (v5)
  if (movement) {
    view.setInt16(41, Math.round(movement.offsetX));
    view.setInt16(43, Math.round(movement.offsetY));
    view.setInt16(45, Math.round(movement.velocityX * 10));
    view.setInt16(47, Math.round(movement.velocityY * 10));
  }

  return toUrlBase64(buf);
};

const mergeWithDefaults = (
  settings: Partial<PresetData["settings"]>,
): PresetData["settings"] => {
  return {
    layer1: { ...DEFAULT_SETTINGS.layer1, ...settings.layer1 },
    layer2: { ...DEFAULT_SETTINGS.layer2, ...settings.layer2 },
    goo: { ...DEFAULT_SETTINGS.goo, ...settings.goo },
    touch: { ...DEFAULT_SETTINGS.touch, ...settings.touch },
    audio: { ...DEFAULT_SETTINGS.audio!, ...settings.audio },
  };
};

// Decode v3 binary format
function decodeV3(binary: string): PresetData["settings"] {
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buf[i] = binary.charCodeAt(i);
  }
  const view = new DataView(buf.buffer);

  return {
    layer1: decodeLayer(view, buf, 1),
    layer2: decodeLayer(view, buf, 13),
    goo: {
      enabled: buf[25] === 1,
      blur: buf[26],
      threshold: buf[27],
      prePixelate: buf[28],
      postPixelate: buf[29],
    },
    touch: {
      enablePinchZoom: (buf[30] & 1) !== 0,
      enablePinchRotate: (buf[30] & 2) !== 0,
    },
  };
}

// Decode v4 binary format (v3 + audio)
function decodeV4(binary: string): PresetData["settings"] {
  // v4 includes everything from v3 plus audio bytes
  const base = decodeV3(binary);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buf[i] = binary.charCodeAt(i);
  }
  const view = new DataView(buf.buffer);

  return {
    ...base,
    audio: {
      enabled: buf[31] === 1,
      masterVolume: view.getUint16(32) / 1000,
      interactionRadius: view.getUint16(34) / 10000,
      frequencyRange: {
        min: view.getUint16(36),
        max: view.getUint16(38),
      },
      rampTimeMs: buf[40],
      maxVoices: 64,
    },
  };
}

// Decode v5 binary format (v4 + movement)
function decodeV5(binary: string): { settings: PresetData["settings"]; movement: MovementData } {
  const settings = decodeV4(binary);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buf[i] = binary.charCodeAt(i);
  }
  const view = new DataView(buf.buffer);

  return {
    settings,
    movement: {
      offsetX: view.getInt16(41),
      offsetY: view.getInt16(43),
      velocityX: view.getInt16(45) / 10,
      velocityY: view.getInt16(47) / 10,
    },
  };
}

export interface DecodedPreset {
  settings: PresetData["settings"];
  movement?: MovementData;
}

// Main decoding function - handles v0-v2 JSON, v3, v4, and v5 binary
export const decodePreset = (encoded: string): DecodedPreset => {
  try {
    const binary = fromUrlBase64(encoded);

    // v5 binary
    if (binary.charCodeAt(0) === 5) {
      return decodeV5(binary);
    }

    // v4 binary
    if (binary.charCodeAt(0) === 4) {
      return { settings: decodeV4(binary) };
    }

    // v3 binary: first byte is 3 (not '{' which is 123)
    if (binary.charCodeAt(0) === 3) {
      return { settings: mergeWithDefaults(decodeV3(binary)) };
    }

    // v0-v2: JSON-based
    const data = JSON.parse(binary) as PresetData;

    if (data.version === undefined) {
      return { settings: mergeWithDefaults(data as any) };
    } else if (data.version === 1 || data.version === 2) {
      return { settings: mergeWithDefaults(data.settings) };
    } else {
      throw new Error("Unsupported preset version");
    }
  } catch (error) {
    console.error("Error decoding preset:", error);
    throw new Error("Failed to load preset: Invalid format");
  }
};
