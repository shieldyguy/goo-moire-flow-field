import { useRef, useEffect, useCallback } from "react";
import { AudioEngine } from "./AudioEngine";
import {
  extractDotPositions,
  extractLinePositions,
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

/**
 * React hook that manages the full sonification pipeline:
 * - For dots: 2D spatial hash proximity between dot grids
 * - For lines: 1D perpendicular distance between line grids
 */
export function useSonification(
  audioSettings: AudioSettings,
  layer1: LayerConfig,
  layer2: LayerConfig,
  offset: { x: number; y: number },
  canvasW: number,
  canvasH: number,
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

      if (!hasPlayedTestTone.current) {
        engine.playTestTone();
        hasPlayedTestTone.current = true;
      }

      return true;
    } catch (e) {
      console.error("AudioEngine failed to initialize:", e);
      return false;
    }
  }, [getEngine]);

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

    const radius =
      ((layer1.size + layer2.size) / 2) * audioSettings.interactionRadius;
    const { min: freqMin, max: freqMax } = audioSettings.frequencyRange;
    const freqRatio = freqMax / freqMin;

    let allInteractions: Array<{ key: string; gain: number; freq: number }>;

    // Branch based on layer type — if either layer is lines, use line mode
    const useLines = layer1.type === "lines" || layer2.type === "lines";

    if (useLines) {
      allInteractions = computeLineInteractions(
        layer1,
        layer2,
        offset,
        canvasW,
        canvasH,
        radius,
        freqMin,
        freqRatio,
      );
    } else {
      allInteractions = computeDotInteractions(
        layer1,
        layer2,
        offset,
        canvasW,
        canvasH,
        radius,
        freqMin,
        freqRatio,
        spatialHashRef,
        neighborsBuffer,
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

    engine.updateVoices(targets, audioSettings);
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
  spatialHashRef: React.MutableRefObject<SpatialHash | null>,
  neighborsBuffer: React.MutableRefObject<number[]>,
): Array<{ key: string; gain: number; freq: number }> {
  const gridA = extractDotPositions(layer1, 0, 0, canvasW, canvasH, radius);
  const gridB = extractDotPositions(
    layer2,
    offset.x,
    offset.y,
    canvasW,
    canvasH,
    radius,
  );

  if (gridA.count === 0 || gridB.count === 0) return [];

  if (!spatialHashRef.current) {
    spatialHashRef.current = new SpatialHash(radius);
  }
  const hash = spatialHashRef.current;
  hash.clear();
  hash.insertAll(gridB.positions, gridB.count);

  const interactions: Array<{ key: string; gain: number; freq: number }> = [];
  const neighbors = neighborsBuffer.current;

  for (let i = 0; i < gridA.count; i++) {
    const ax = gridA.positions[i * 2];
    const ay = gridA.positions[i * 2 + 1];

    neighbors.length = 0;
    hash.queryNeighbors(ax, ay, neighbors);

    let bestGain = 0;
    let bestFreq = 0;

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
          bestFreq = freqMin * Math.pow(freqRatio, ax / canvasW);
        }
      }
    }

    if (bestGain > 0) {
      interactions.push({ key: `D${i}`, gain: bestGain, freq: bestFreq });
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
    layer2,
    offset.x,
    offset.y,
    canvasW,
    canvasH,
    radius,
  );

  if (linesA.count === 0 || linesB.count === 0) return [];

  // Sort grid B perpendicular positions for efficient nearest-neighbor search
  const sortedB: Array<{ perp: number; worldX: number; idx: number }> = [];
  for (let j = 0; j < linesB.count; j++) {
    sortedB.push({
      perp: linesB.perpPositions[j],
      worldX: linesB.worldX[j],
      idx: j,
    });
  }
  sortedB.sort((a, b) => a.perp - b.perp);

  const interactions: Array<{ key: string; gain: number; freq: number }> = [];

  for (let i = 0; i < linesA.count; i++) {
    const perpA = linesA.perpPositions[i];
    const wxA = linesA.worldX[i];

    // Binary search for the closest line in B
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

    // Check the nearest few lines in B (around the insertion point)
    let bestGain = 0;
    let bestFreq = 0;

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
          // Frequency from line A's world-space x position
          const normX = Math.max(0, Math.min(1, wxA / canvasW));
          bestFreq = freqMin * Math.pow(freqRatio, normX);
        }
      }
    }

    if (bestGain > 0) {
      interactions.push({ key: `L${i}`, gain: bestGain, freq: bestFreq });
    }
  }

  return interactions;
}
