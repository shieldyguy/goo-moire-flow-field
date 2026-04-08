/**
 * Extracts element positions from layer settings for sonification,
 * replicating the same grid math as WebGLCanvas.drawLayer
 * but returning positions instead of drawing.
 *
 * Positions are returned in CSS pixels (pre-DPR) so they align
 * with the offset/interaction radius which are also in CSS pixels.
 *
 * Buffers are pre-allocated and reused across frames to avoid GC pressure.
 */

interface LayerConfig {
  spacing: number;
  size: number;
  rotation: number;
  type: string;
}

// Pre-allocated buffers — grow as needed, never shrink
let _dotBufA = new Float32Array(8192);
let _dotBufB = new Float32Array(8192);
let _linePerpBufA = new Float32Array(1024);
let _lineWxBufA = new Float32Array(1024);
let _linePerpBufB = new Float32Array(1024);
let _lineWxBufB = new Float32Array(1024);
let _nextDotBuf: "A" | "B" = "A";
let _nextLineBuf: "A" | "B" = "A";

function getDotBuf(minSize: number): Float32Array {
  // Alternate between A and B so grid A and grid B don't share a buffer
  const isA = _nextDotBuf === "A";
  _nextDotBuf = isA ? "B" : "A";
  let buf = isA ? _dotBufA : _dotBufB;
  if (buf.length < minSize) {
    buf = new Float32Array(minSize * 2);
    if (isA) _dotBufA = buf; else _dotBufB = buf;
  }
  return buf;
}

function getLineBufs(minSize: number): { perp: Float32Array; wx: Float32Array } {
  const isA = _nextLineBuf === "A";
  _nextLineBuf = isA ? "B" : "A";
  let perp = isA ? _linePerpBufA : _linePerpBufB;
  let wx = isA ? _lineWxBufA : _lineWxBufB;
  if (perp.length < minSize) {
    perp = new Float32Array(minSize * 2);
    wx = new Float32Array(minSize * 2);
    if (isA) { _linePerpBufA = perp; _lineWxBufA = wx; }
    else { _linePerpBufB = perp; _lineWxBufB = wx; }
  }
  return { perp, wx };
}

/** Reset buffer alternation — call at the start of each frame. */
export function resetExtractorBuffers(): void {
  _nextDotBuf = "A";
  _nextLineBuf = "A";
}

/**
 * Extract dot positions for a single layer (type = "dots").
 */
export function extractDotPositions(
  layer: LayerConfig,
  offsetX: number,
  offsetY: number,
  canvasW: number,
  canvasH: number,
  padding: number,
): { positions: Float32Array; count: number } {
  const spacing = layer.spacing;
  if (spacing <= 0) return { positions: _dotBufA, count: 0 };

  const rad = (layer.rotation * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);

  const localX = offsetX * cosR + offsetY * sinR;
  const localY = -offsetX * sinR + offsetY * cosR;
  const wrappedLocalX = ((localX % spacing) + spacing) % spacing;
  const wrappedLocalY = ((localY % spacing) + spacing) % spacing;
  const wrappedX = wrappedLocalX * cosR - wrappedLocalY * sinR;
  const wrappedY = wrappedLocalX * sinR + wrappedLocalY * cosR;

  const centerX = canvasW / 2;
  const centerY = canvasH / 2;
  const extent = Math.max(canvasW, canvasH) + padding * 2;

  const gridRange = extent + spacing;
  const cols = Math.ceil(gridRange / spacing) + 1;
  const rows = Math.ceil(gridRange / spacing) + 1;
  const maxDots = cols * rows;
  const positions = getDotBuf(maxDots * 2);

  let count = 0;

  for (let lx = -extent / 2; lx < extent / 2; lx += spacing) {
    for (let ly = -extent / 2; ly < extent / 2; ly += spacing) {
      const wx = lx * cosR - ly * sinR + centerX + wrappedX;
      const wy = lx * sinR + ly * cosR + centerY + wrappedY;

      if (
        wx >= -padding &&
        wx <= canvasW + padding &&
        wy >= -padding &&
        wy <= canvasH + padding
      ) {
        positions[count * 2] = wx;
        positions[count * 2 + 1] = wy;
        count++;
      }
    }
  }

  return { positions, count };
}

/**
 * Extract line positions for a single layer (type = "lines").
 */
export function extractLinePositions(
  layer: LayerConfig,
  offsetX: number,
  offsetY: number,
  canvasW: number,
  canvasH: number,
  padding: number,
): { perpPositions: Float32Array; worldX: Float32Array; count: number } {
  const spacing = layer.spacing;
  if (spacing <= 0)
    return { perpPositions: _linePerpBufA, worldX: _lineWxBufA, count: 0 };

  const rad = (layer.rotation * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);

  const nx = -sinR;
  const ny = cosR;

  const localX = offsetX * cosR + offsetY * sinR;
  const localY = -offsetX * sinR + offsetY * cosR;
  const wrappedLocalX = ((localX % spacing) + spacing) % spacing;
  const wrappedLocalY = ((localY % spacing) + spacing) % spacing;
  const wrappedX = wrappedLocalX * cosR - wrappedLocalY * sinR;
  const wrappedY = wrappedLocalX * sinR + wrappedLocalY * cosR;

  const centerX = canvasW / 2;
  const centerY = canvasH / 2;

  const diagonal = Math.sqrt(canvasW * canvasW + canvasH * canvasH);
  const extent = diagonal + padding * 2;
  const maxLines = Math.ceil(extent / spacing) + 2;
  const { perp: perpPositions, wx: worldXArr } = getLineBufs(maxLines);

  let count = 0;

  for (let ly = -extent / 2; ly < extent / 2; ly += spacing) {
    const wx = -ly * sinR + centerX + wrappedX;
    const wy = ly * cosR + centerY + wrappedY;
    const perp = (wx - centerX) * nx + (wy - centerY) * ny;

    perpPositions[count] = perp;
    worldXArr[count] = wx;
    count++;
  }

  return { perpPositions, worldX: worldXArr, count };
}
