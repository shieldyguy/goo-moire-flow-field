import { useRef, useEffect, useCallback } from "react";
import { AudioEngine } from "./AudioEngine";
import {
  extractDotPositions,
  extractLinePositions,
  resetExtractorBuffers,
} from "./dotPositionExtractor";
import { SpatialHash } from "./spatialHash";

interface AudioSettings {
  enabled: boolean;
  masterVolume: number;
  interactionRadius: number;
  frequencyRange: { min: number; max: number };
  rampTimeMs: number;
  maxVoices: number;
}

interface LayerConfig {
  spacing: number;
  size: number;
  rotation: number;
  type: string;
}

interface GooConfig {
  blur: number;
  prePixelate: number;
  enabled: boolean;
}

// Major scale intervals in semitones: W W H W W W H
// Cumulative: 0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24...
const MAJOR_SCALE_SEMITONES: number[] = [];
{
  const pattern = [0, 2, 4, 5, 7, 9, 11];
  // Build 10 octaves worth
  for (let octave = 0; octave < 10; octave++) {
    for (const s of pattern) {
      MAJOR_SCALE_SEMITONES.push(octave * 12 + s);
    }
  }
}

/**
 * Quantize a frequency to the nearest note in the major scale,
 * anchored at freqMin.
 */
function quantizeToMajorScale(freq: number, freqMin: number): number {
  // How many semitones above freqMin?
  const semitones = 12 * Math.log2(freq / freqMin);
  if (semitones <= 0) return freqMin;

  // Find nearest major scale semitone
  let best = 0;
  let bestDist = Infinity;
  for (const s of MAJOR_SCALE_SEMITONES) {
    const dist = Math.abs(semitones - s);
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
    if (s > semitones + 6) break; // early exit
  }

  return freqMin * Math.pow(2, best / 12);
}

/**
 * Map y-position to frequency (log scale), then quantize to major scale.
 * Top of canvas = high freq, bottom = low freq.
 */
function yToFreq(
  y: number,
  canvasH: number,
  freqMin: number,
  freqRatio: number,
): number {
  const normalized = 1 - Math.max(0, Math.min(1, y / canvasH)); // top=1, bottom=0
  const rawFreq = freqMin * Math.pow(freqRatio, normalized);
  return quantizeToMajorScale(rawFreq, freqMin);
}

/**
 * React hook that manages the full sonification pipeline:
 * - For dots: 2D spatial hash proximity between dot grids
 * - For lines: 1D perpendicular distance between line grids
 * - Frequency from y-position, quantized to major scale
 * - Blur widens interaction radius, pre-pixelate quantizes positions
 */
export function useSonification(
  audioSettings: AudioSettings,
  layer1: LayerConfig,
  layer2: LayerConfig,
  offset: { x: number; y: number },
  canvasW: number,
  canvasH: number,
  goo: GooConfig,
) {
  const engineRef = useRef<AudioEngine | null>(null);
  const hasPlayedTestTone = useRef(false);
  const spatialHashRef = useRef<SpatialHash | null>(null);
  const neighborsBuffer = useRef<number[]>([]);

  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine();
    }
    return engineRef.current;
  }, []);

  const initializeAudio = useCallback(async (): Promise<boolean> => {
    const engine = getEngine();
    try {
      await engine.initialize();
      // Sync master volume to the current setting immediately —
      // the useEffect won't fire if the value hasn't changed since mount
      engine.setMasterVolume(audioSettings.masterVolume);

      if (!hasPlayedTestTone.current) {
        engine.playTestTone();
        hasPlayedTestTone.current = true;
      }

      return true;
    } catch (e) {
      console.error("AudioEngine failed to initialize:", e);
      return false;
    }
  }, [getEngine, audioSettings.masterVolume]);

  // Sync master volume
  useEffect(() => {
    engineRef.current?.setMasterVolume(audioSettings.masterVolume);
  }, [audioSettings.masterVolume]);

  // Suspend / resume
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (audioSettings.enabled) {
      engine.resume();
    } else {
      engine.suspend();
    }
  }, [audioSettings.enabled]);

  // ─── Proximity update loop ───
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !engine.isReady || !audioSettings.enabled) return;
    if (canvasW === 0 || canvasH === 0) return;

    // Reset buffer alternation so grid A/B get separate buffers
    resetExtractorBuffers();

    // Base interaction radius from dot sizes
    let radius =
      ((layer1.size + layer2.size) / 2) * audioSettings.interactionRadius;

    // Blur widens the interaction radius — same way it visually smears dots
    if (goo.enabled && goo.blur > 1) {
      radius *= 1 + goo.blur * 0.15;
    }

    const { min: freqMin, max: freqMax } = audioSettings.frequencyRange;
    const freqRatio = freqMax / freqMin;
    const prePixelate = goo.enabled ? goo.prePixelate : 1;

    let allInteractions: Array<{ key: string; gain: number; freq: number }>;

    const bothDots = layer1.type === "dots" && layer2.type === "dots";
    const bothLines = layer1.type === "lines" && layer2.type === "lines";

    if (bothDots) {
      allInteractions = computeDotInteractions(
        layer1, layer2, offset, canvasW, canvasH,
        radius, freqMin, freqRatio, prePixelate,
        spatialHashRef, neighborsBuffer,
      );
    } else if (bothLines) {
      allInteractions = computeLineInteractions(
        layer1, layer2, offset, canvasW, canvasH,
        radius, freqMin, freqRatio,
      );
    } else {
      const dotLayer = layer1.type === "dots" ? layer1 : layer2;
      const lineLayer = layer1.type === "dots" ? layer2 : layer1;
      const dotOffset =
        layer1.type === "dots"
          ? { x: 0, y: 0 }
          : { x: offset.x, y: offset.y };
      const lineOffset =
        layer1.type === "dots"
          ? { x: offset.x, y: offset.y }
          : { x: 0, y: 0 };

      allInteractions = computeDotLineInteractions(
        dotLayer, dotOffset, lineLayer, lineOffset,
        canvasW, canvasH, radius, freqMin, freqRatio, prePixelate,
      );
    }

    // Sort by gain (loudest first) and cap at maxVoices
    allInteractions.sort((a, b) => b.gain - a.gain);
    const targets = new Map<string, { gain: number; freq: number }>();
    const limit = Math.min(allInteractions.length, audioSettings.maxVoices);
    for (let i = 0; i < limit; i++) {
      const t = allInteractions[i];
      targets.set(t.key, { gain: t.gain, freq: t.freq });
    }

    // Scale ramp time with pre-pixelate: chunky quantization → snappy gains.
    // At prePixelate=1, use the configured ramp. At high values, nearly instant.
    const effectiveRampMs =
      prePixelate > 1
        ? Math.max(3, audioSettings.rampTimeMs / prePixelate)
        : audioSettings.rampTimeMs;

    engine.updateVoices(targets, {
      ...audioSettings,
      rampTimeMs: effectiveRampMs,
    });
  }, [
    audioSettings,
    layer1.spacing,
    layer1.size,
    layer1.rotation,
    layer1.type,
    layer2.spacing,
    layer2.size,
    layer2.rotation,
    layer2.type,
    offset.x,
    offset.y,
    canvasW,
    canvasH,
    goo.blur,
    goo.prePixelate,
    goo.enabled,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  return {
    initializeAudio,
    isAudioReady: engineRef.current?.isReady ?? false,
  };
}

// ─── Dot-mode interaction computation ───

function computeDotInteractions(
  layer1: LayerConfig,
  layer2: LayerConfig,
  offset: { x: number; y: number },
  canvasW: number,
  canvasH: number,
  radius: number,
  freqMin: number,
  freqRatio: number,
  prePixelate: number,
  spatialHashRef: React.MutableRefObject<SpatialHash | null>,
  neighborsBuffer: React.MutableRefObject<number[]>,
): Array<{ key: string; gain: number; freq: number }> {
  const gridA = extractDotPositions(layer1, 0, 0, canvasW, canvasH, radius);
  const gridB = extractDotPositions(
    layer2, offset.x, offset.y, canvasW, canvasH, radius,
  );

  if (gridA.count === 0 || gridB.count === 0) return [];

  // Proximity checks use RAW positions — prePixelate does NOT create
  // fake interactions. It only affects gain stepping and frequency quantization.
  // Recreate spatial hash when radius changes (cell size must match)
  if (!spatialHashRef.current || spatialHashRef.current.cellSize !== radius) {
    spatialHashRef.current = new SpatialHash(radius);
  }
  const hash = spatialHashRef.current;
  hash.clear();
  hash.insertAll(gridB.positions, gridB.count);

  const neighbors = neighborsBuffer.current;
  const interactions: Array<{ key: string; gain: number; freq: number }> = [];

  if (prePixelate > 1) {
    // ─── Tiled mode: sample one point per tile, like the visual shader ───
    // The visual pixelate shader picks one pixel per tile (top-left corner).
    // We sample the tile CENTER and check: is there a grid-A dot near a
    // grid-B dot at this point? If yes → voice on. If no → silent.
    // This creates the same chunky on/off rhythm as the visual tiles.

    // Build a second spatial hash for grid A so we can query both grids
    const hashA = new SpatialHash(radius);
    hashA.insertAll(gridA.positions, gridA.count);

    const tilesX = Math.ceil(canvasW / prePixelate);
    const tilesY = Math.ceil(canvasH / prePixelate);

    for (let ty = 0; ty < tilesY; ty++) {
      const cy = ty * prePixelate + prePixelate / 2;
      for (let tx = 0; tx < tilesX; tx++) {
        const cx = tx * prePixelate + prePixelate / 2;

        // Find nearest grid-A dot to tile center
        neighbors.length = 0;
        hashA.queryNeighbors(cx, cy, neighbors);
        let nearestADist = Infinity;
        for (let n = 0; n < neighbors.length; n++) {
          const idx = neighbors[n];
          const dx = cx - gridA.positions[idx * 2];
          const dy = cy - gridA.positions[idx * 2 + 1];
          const d = dx * dx + dy * dy;
          if (d < nearestADist) nearestADist = d;
        }

        // Find nearest grid-B dot to tile center
        neighbors.length = 0;
        hash.queryNeighbors(cx, cy, neighbors);
        let nearestBDist = Infinity;
        let nearestBy = cy;
        for (let n = 0; n < neighbors.length; n++) {
          const idx = neighbors[n];
          const bx = gridB.positions[idx * 2];
          const by = gridB.positions[idx * 2 + 1];
          const dx = cx - bx;
          const dy = cy - by;
          const d = dx * dx + dy * dy;
          if (d < nearestBDist) {
            nearestBDist = d;
            nearestBy = by;
          }
        }

        // Both grids have a dot near this tile center?
        // Compute interaction as distance between the two nearest dots
        if (nearestADist < Infinity && nearestBDist < Infinity) {
          // Use the sum of distances from tile center as a proxy —
          // if both dots are close to the center, they're close to each other
          const combinedDist = Math.sqrt(nearestADist) + Math.sqrt(nearestBDist);
          if (combinedDist < radius) {
            const gain = 1 - combinedDist / radius;
            const freq = yToFreq(cy, canvasH, freqMin, freqRatio);
            interactions.push({ key: `T${tx}_${ty}`, gain, freq });
          }
        }
      }
    }
  } else {
    // ─── Per-dot mode (no tiling) ───
    for (let i = 0; i < gridA.count; i++) {
      const ax = gridA.positions[i * 2];
      const ay = gridA.positions[i * 2 + 1];

      neighbors.length = 0;
      hash.queryNeighbors(ax, ay, neighbors);

      let bestGain = 0;
      let bestBy = 0;

      for (let n = 0; n < neighbors.length; n++) {
        const j = neighbors[n];
        const bx = gridB.positions[j * 2];
        const by = gridB.positions[j * 2 + 1];

        const dx = ax - bx;
        const dy = ay - by;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < radius) {
          const gain = 1 - dist / radius;
          if (gain > bestGain) {
            bestGain = gain;
            bestBy = by;
          }
        }
      }

      if (bestGain > 0) {
        const freq = yToFreq(bestBy, canvasH, freqMin, freqRatio);
        interactions.push({ key: `D${i}`, gain: bestGain, freq });
      }
    }
  }

  return interactions;
}

// ─── Line-mode interaction computation ───

function computeLineInteractions(
  layer1: LayerConfig,
  layer2: LayerConfig,
  offset: { x: number; y: number },
  canvasW: number,
  canvasH: number,
  radius: number,
  freqMin: number,
  freqRatio: number,
): Array<{ key: string; gain: number; freq: number }> {
  const linesA = extractLinePositions(layer1, 0, 0, canvasW, canvasH, radius);
  const linesB = extractLinePositions(
    layer2, offset.x, offset.y, canvasW, canvasH, radius,
  );

  if (linesA.count === 0 || linesB.count === 0) return [];

  const sortedB: Array<{ perp: number; idx: number }> = [];
  for (let j = 0; j < linesB.count; j++) {
    sortedB.push({ perp: linesB.perpPositions[j], idx: j });
  }
  sortedB.sort((a, b) => a.perp - b.perp);

  const interactions: Array<{ key: string; gain: number; freq: number }> = [];

  for (let i = 0; i < linesA.count; i++) {
    const perpA = linesA.perpPositions[i];

    let lo = 0;
    let hi = sortedB.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedB[mid].perp < perpA) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    let bestGain = 0;
    let bestPerp = 0;

    for (
      let k = Math.max(0, lo - 2);
      k < Math.min(sortedB.length, lo + 3);
      k++
    ) {
      const dist = Math.abs(perpA - sortedB[k].perp);

      if (dist < radius) {
        const gain = 1 - dist / radius;
        if (gain > bestGain) {
          bestGain = gain;
          bestPerp = sortedB[k].perp;
        }
      }
    }

    if (bestGain > 0) {
      // Use perpendicular position as frequency source for lines
      // Map perp range to canvas height range for consistent freq mapping
      const normalizedPerp = (bestPerp + canvasH) / (canvasH * 2);
      const rawFreq = freqMin * Math.pow(freqRatio, Math.max(0, Math.min(1, normalizedPerp)));
      const freq = quantizeToMajorScale(rawFreq, freqMin);
      interactions.push({ key: `L${i}`, gain: bestGain, freq });
    }
  }

  return interactions;
}

// ─── Dot-line mixed interaction computation ───

function computeDotLineInteractions(
  dotLayer: LayerConfig,
  dotOffset: { x: number; y: number },
  lineLayer: LayerConfig,
  lineOffset: { x: number; y: number },
  canvasW: number,
  canvasH: number,
  radius: number,
  freqMin: number,
  freqRatio: number,
  prePixelate: number,
): Array<{ key: string; gain: number; freq: number }> {
  const dots = extractDotPositions(
    dotLayer, dotOffset.x, dotOffset.y, canvasW, canvasH, radius,
  );
  const lines = extractLinePositions(
    lineLayer, lineOffset.x, lineOffset.y, canvasW, canvasH, radius,
  );

  if (dots.count === 0 || lines.count === 0) return [];

  const lineRad = (lineLayer.rotation * Math.PI) / 180;
  const nx = -Math.sin(lineRad);
  const ny = Math.cos(lineRad);

  const centerX = canvasW / 2;
  const centerY = canvasH / 2;

  const sortedLines: Array<{ perp: number; idx: number }> = [];
  for (let j = 0; j < lines.count; j++) {
    sortedLines.push({ perp: lines.perpPositions[j], idx: j });
  }
  sortedLines.sort((a, b) => a.perp - b.perp);

  const interactions: Array<{ key: string; gain: number; freq: number }> = [];

  // Helper: find nearest line perp distance to a point
  const findNearestLinePerp = (px: number, py: number): number => {
    const perp = (px - centerX) * nx + (py - centerY) * ny;
    let lo = 0;
    let hi = sortedLines.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedLines[mid].perp < perp) lo = mid + 1;
      else hi = mid;
    }
    let bestDist = Infinity;
    for (
      let k = Math.max(0, lo - 2);
      k < Math.min(sortedLines.length, lo + 3);
      k++
    ) {
      const d = Math.abs(perp - sortedLines[k].perp);
      if (d < bestDist) bestDist = d;
    }
    return bestDist;
  };

  if (prePixelate > 1) {
    // ─── Tiled mode: for each tile, find nearest dot and check its distance to nearest line ───
    const dotHash = new SpatialHash(radius);
    dotHash.insertAll(dots.positions, dots.count);

    const tilesX = Math.ceil(canvasW / prePixelate);
    const tilesY = Math.ceil(canvasH / prePixelate);
    const neighbors = []; // local buffer for tile queries

    for (let ty = 0; ty < tilesY; ty++) {
      const cy = ty * prePixelate + prePixelate / 2;
      for (let tx = 0; tx < tilesX; tx++) {
        const cx = tx * prePixelate + prePixelate / 2;

        // Find nearest dot to tile center
        neighbors.length = 0;
        dotHash.queryNeighbors(cx, cy, neighbors);
        let nearestDotDist = Infinity;
        let nearestDotX = cx;
        let nearestDotY = cy;
        for (let n = 0; n < neighbors.length; n++) {
          const idx = neighbors[n];
          const ddx = cx - dots.positions[idx * 2];
          const ddy = cy - dots.positions[idx * 2 + 1];
          const d = ddx * ddx + ddy * ddy;
          if (d < nearestDotDist) {
            nearestDotDist = d;
            nearestDotX = dots.positions[idx * 2];
            nearestDotY = dots.positions[idx * 2 + 1];
          }
        }
        if (nearestDotDist === Infinity) continue;

        // Check that dot's distance to nearest line
        const lineDist = findNearestLinePerp(nearestDotX, nearestDotY);
        if (lineDist < radius) {
          const gain = 1 - lineDist / radius;
          const freq = yToFreq(cy, canvasH, freqMin, freqRatio);
          interactions.push({ key: `T${tx}_${ty}`, gain, freq });
        }
      }
    }
  } else {
    // ─── Per-dot mode ───
    for (let i = 0; i < dots.count; i++) {
      const dx = dots.positions[i * 2];
      const dy = dots.positions[i * 2 + 1];

      const lineDist = findNearestLinePerp(dx, dy);
      if (lineDist < radius) {
        const gain = 1 - lineDist / radius;
        const freq = yToFreq(dy, canvasH, freqMin, freqRatio);
        interactions.push({ key: `M${i}`, gain, freq });
      }
    }
  }

  return interactions;
}
