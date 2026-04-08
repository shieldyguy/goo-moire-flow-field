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
  threshold: number;
  prePixelate: number;
  enabled: boolean;
}

// Major scale intervals in semitones: W W H W W W H
// Cumulative: 0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24...
const MAJOR_SCALE_SEMITONES: number[] = [];
{
  const pattern = [0, 2, 4, 5, 7, 9, 11];
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
  const semitones = 12 * Math.log2(freq / freqMin);
  if (semitones <= 0) return freqMin;

  let best = 0;
  let bestDist = Infinity;
  for (const s of MAJOR_SCALE_SEMITONES) {
    const dist = Math.abs(semitones - s);
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
    if (s > semitones + 6) break;
  }

  return freqMin * Math.pow(2, best / 12);
}

/**
 * Map y-position to frequency (log scale), then quantize to scale.
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

  const spatialHashRef = useRef<SpatialHash | null>(null);
  const neighborsBuffer = useRef<number[]>([]);
  const lastAudioUpdateRef = useRef(0);
  const AUDIO_UPDATE_INTERVAL = 1000 / 15;

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

    // Throttle audio proximity updates to 15fps — computation is idempotent
    const now = performance.now();
    if (now - lastAudioUpdateRef.current < AUDIO_UPDATE_INTERVAL) return;
    lastAudioUpdateRef.current = now;

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

    // Gain cutoff — can be used for threshold gating later
    const gainCutoff = 0;

    let allInteractions: Array<{ key: string; gain: number; freq: number }>;

    const bothDots = layer1.type === "dots" && layer2.type === "dots";
    const bothLines = layer1.type === "lines" && layer2.type === "lines";

    if (bothDots) {
      allInteractions = computeDotInteractions(
        layer1, layer2, offset, canvasW, canvasH,
        radius, freqMin, freqRatio, prePixelate, gainCutoff,
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
        canvasW, canvasH, radius, freqMin, freqRatio, prePixelate, gainCutoff,
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
    goo.threshold,
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

/**
 * Decimate position precision in-place — round coordinates to the nearest
 * multiple of stepSize. Like bit-reducing the location accuracy.
 * Dots still exist at their original count, they just can't be at
 * positions between grid lines anymore.
 */
function decimatePositions(
  positions: Float32Array,
  count: number,
  stepSize: number,
): void {
  for (let i = 0; i < count; i++) {
    positions[i * 2] = Math.round(positions[i * 2] / stepSize) * stepSize;
    positions[i * 2 + 1] = Math.round(positions[i * 2 + 1] / stepSize) * stepSize;
  }
}

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
  gainCutoff: number,
  spatialHashRef: React.MutableRefObject<SpatialHash | null>,
  neighborsBuffer: React.MutableRefObject<number[]>,
): Array<{ key: string; gain: number; freq: number }> {
  let gridA = extractDotPositions(layer1, 0, 0, canvasW, canvasH, radius);
  let gridB = extractDotPositions(
    layer2, offset.x, offset.y, canvasW, canvasH, radius,
  );

  if (gridA.count === 0 || gridB.count === 0) return [];

  // PrePixelate: reduce position precision for layer 2 only — dots snap to a
  // coarser grid.  Quantizing only the moving layer keeps the choppy/steppy
  // feel without artificially increasing proximity density (which happens when
  // both layers snap to the same coarse grid).
  if (prePixelate > 1) {
    decimatePositions(gridB.positions, gridB.count, prePixelate);
  }

  if (!spatialHashRef.current || spatialHashRef.current.cellSize !== radius) {
    spatialHashRef.current = new SpatialHash(radius);
  }
  const hash = spatialHashRef.current;
  hash.clear();
  hash.insertAll(gridB.positions, gridB.count);

  const neighbors = neighborsBuffer.current;
  const interactions: Array<{ key: string; gain: number; freq: number }> = [];

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

    // Threshold gate: below cutoff = silent, matching the visual contrast crush
    if (bestGain > gainCutoff) {
      const freq = yToFreq(bestBy, canvasH, freqMin, freqRatio);
      interactions.push({
        key: prePixelate > 1 ? `T${i}` : `D${i}`,
        gain: bestGain,
        freq,
      });
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
  gainCutoff: number,
): Array<{ key: string; gain: number; freq: number }> {
  let dots = extractDotPositions(
    dotLayer, dotOffset.x, dotOffset.y, canvasW, canvasH, radius,
  );
  const lines = extractLinePositions(
    lineLayer, lineOffset.x, lineOffset.y, canvasW, canvasH, radius,
  );

  if (dots.count === 0 || lines.count === 0) return [];

  // Decimate dot position precision if prePixelate is active
  if (prePixelate > 1) {
    decimatePositions(dots.positions, dots.count, prePixelate);
  }

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

  // Dots are already quantized+deduped when prePixelate > 1,
  // so one code path handles both cases.
  for (let i = 0; i < dots.count; i++) {
    const dx = dots.positions[i * 2];
    const dy = dots.positions[i * 2 + 1];

    const lineDist = findNearestLinePerp(dx, dy);
    if (lineDist < radius) {
      const gain = 1 - lineDist / radius;
      if (gain > gainCutoff) {
        const freq = yToFreq(dy, canvasH, freqMin, freqRatio);
        interactions.push({ key: `M${i}`, gain, freq });
      }
    }
  }

  return interactions;
}
