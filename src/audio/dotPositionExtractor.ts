/**
 * Extracts dot world-space positions from layer settings,
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
 * Extract dot positions for a single layer.
 *
 * @param layer       Layer settings (spacing, rotation, etc.)
 * @param offsetX     CSS-pixel offset applied to this layer (0 for layer1)
 * @param offsetY     CSS-pixel offset applied to this layer (0 for layer1)
 * @param canvasW     Canvas width in CSS pixels
 * @param canvasH     Canvas height in CSS pixels
 * @param padding     Extra pixels beyond canvas bounds to include (interaction radius)
 * @returns           Float32Array of interleaved [x, y, x, y, ...] in CSS pixels,
 *                    plus the count of dots.
 */
export function extractDotPositions(
  layer: LayerConfig,
  offsetX: number,
  offsetY: number,
  canvasW: number,
  canvasH: number,
  padding: number,
): { positions: Float32Array; count: number } {
  // Only extract for dots — lines/squares can be added later
  if (layer.type !== "dots") {
    return { positions: new Float32Array(0), count: 0 };
  }

  const spacing = layer.spacing;
  if (spacing <= 0) return { positions: new Float32Array(0), count: 0 };

  const rad = (layer.rotation * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);

  // Replicate the offset wrapping from WebGLCanvas.drawLayer (lines 91-99)
  // Project offset into the layer's rotated coordinate system, wrap mod spacing,
  // then project back to world space.
  const localX = offsetX * cosR + offsetY * sinR;
  const localY = -offsetX * sinR + offsetY * cosR;
  const wrappedLocalX = ((localX % spacing) + spacing) % spacing;
  const wrappedLocalY = ((localY % spacing) + spacing) % spacing;
  const wrappedX = wrappedLocalX * cosR - wrappedLocalY * sinR;
  const wrappedY = wrappedLocalX * sinR + wrappedLocalY * cosR;

  const centerX = canvasW / 2;
  const centerY = canvasH / 2;

  // The renderer loops from -width to width*2 (in canvas-pixel space).
  // We tighten this to canvas bounds + padding to avoid computing
  // off-screen dots that can't participate in audio interactions.
  const extent = Math.max(canvasW, canvasH) + padding * 2;

  // Estimate max dots to pre-allocate the buffer
  const gridRange = extent + spacing;
  const cols = Math.ceil(gridRange / spacing) + 1;
  const rows = Math.ceil(gridRange / spacing) + 1;
  const maxDots = cols * rows;
  const positions = new Float32Array(maxDots * 2);

  let count = 0;

  // Loop in local (rotated) grid space, then transform to world
  for (let lx = -extent / 2; lx < extent / 2; lx += spacing) {
    for (let ly = -extent / 2; ly < extent / 2; ly += spacing) {
      // Transform from local grid to world space
      const wx = lx * cosR - ly * sinR + centerX + wrappedX;
      const wy = lx * sinR + ly * cosR + centerY + wrappedY;

      // Cull dots outside the padded canvas bounds
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
