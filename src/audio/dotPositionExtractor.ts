/**
 * Extracts element positions from layer settings for sonification,
 * replicating the same grid math as WebGLCanvas.drawLayer
 * but returning positions instead of drawing.
 *
 * Positions are returned in CSS pixels (pre-DPR) so they align
 * with the offset/interaction radius which are also in CSS pixels.
 */

interface LayerConfig {
  spacing: number;
  size: number;
  rotation: number;
  type: string;
}

/**
 * Extract dot positions for a single layer (type = "dots").
 *
 * @returns Float32Array of interleaved [x, y, x, y, ...] in CSS pixels,
 *          plus the count of dots.
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
  if (spacing <= 0) return { positions: new Float32Array(0), count: 0 };

  const rad = (layer.rotation * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);

  // Replicate the offset wrapping from WebGLCanvas.drawLayer
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
  const positions = new Float32Array(maxDots * 2);

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
 *
 * Lines are horizontal strokes in local space, so each unique y-value
 * in the grid is one line. We return the perpendicular offset of each
 * line from the canvas center (projected onto the line's normal axis),
 * plus a representative world-space x for frequency mapping.
 *
 * @returns perpPositions: 1D perpendicular offsets,
 *          worldX: world-space x of line center (for freq mapping),
 *          count: number of lines
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
    return {
      perpPositions: new Float32Array(0),
      worldX: new Float32Array(0),
      count: 0,
    };

  const rad = (layer.rotation * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);

  // The line's normal direction (perpendicular to the line).
  // Lines are horizontal in local space → local normal is (0, 1).
  // Rotated to world space: normal = (sinR, cosR) ... wait, let's be precise.
  // A horizontal line in local space has direction (1, 0) and normal (0, 1).
  // After rotating by `rad`, the normal becomes (-sin(rad), cos(rad))...
  // but for perpendicular distance we only need the dot product with the normal,
  // so the sign doesn't matter. We use (nx, ny) = (-sinR, cosR).
  const nx = -sinR;
  const ny = cosR;

  // Offset wrapping — only the component along the normal matters for lines,
  // but we compute the full wrap to get the world-space center position too.
  const localX = offsetX * cosR + offsetY * sinR;
  const localY = -offsetX * sinR + offsetY * cosR;
  const wrappedLocalX = ((localX % spacing) + spacing) % spacing;
  const wrappedLocalY = ((localY % spacing) + spacing) % spacing;
  const wrappedX = wrappedLocalX * cosR - wrappedLocalY * sinR;
  const wrappedY = wrappedLocalX * sinR + wrappedLocalY * cosR;

  const centerX = canvasW / 2;
  const centerY = canvasH / 2;

  // Lines span the full canvas along their direction, so we only need to
  // iterate along the perpendicular axis (local y). The extent needs to
  // cover the canvas diagonal to catch lines that cross the viewport at an angle.
  const diagonal = Math.sqrt(canvasW * canvasW + canvasH * canvasH);
  const extent = diagonal + padding * 2;

  const maxLines = Math.ceil(extent / spacing) + 2;
  const perpPositions = new Float32Array(maxLines);
  const worldXArr = new Float32Array(maxLines);

  let count = 0;

  for (let ly = -extent / 2; ly < extent / 2; ly += spacing) {
    // World-space center of this line (using lx = 0 as representative point)
    const wx = 0 * cosR - ly * sinR + centerX + wrappedX;
    const wy = 0 * sinR + ly * cosR + centerY + wrappedY;

    // Perpendicular distance from canvas center
    const perp = (wx - centerX) * nx + (wy - centerY) * ny;

    perpPositions[count] = perp;
    // Use the world-space x of the line's center for frequency mapping
    worldXArr[count] = wx;
    count++;
  }

  return { perpPositions, worldX: worldXArr, count };
}
