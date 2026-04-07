import { useRef, useEffect, useCallback } from "react";
import { AudioEngine } from "./AudioEngine";
import { extractDotPositions } from "./dotPositionExtractor";
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
 * 1. Extract dot positions from both layers
 * 2. Build spatial hash for grid B
 * 3. For each dot in grid A, find nearby dots in grid B
 * 4. Compute proximity-based gain targets
 * 5. Feed to AudioEngine for smooth oscillator updates
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
  // Reusable array for neighbor query results
  const neighborsBuffer = useRef<number[]>([]);

  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine();
    }
    return engineRef.current;
  }, []);

  /**
   * Initialize the AudioContext. Must be called from a user gesture handler.
   */
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
  // Runs whenever offset, settings, or dimensions change (throttled to ~12-15 FPS
  // by the offset update rate in Canvas.tsx).
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !engine.isReady || !audioSettings.enabled) return;
    if (canvasW === 0 || canvasH === 0) return;

    const radius = audioSettings.interactionRadius;
    const { min: freqMin, max: freqMax } = audioSettings.frequencyRange;
    const freqRange = freqMax - freqMin;

    // 1. Extract positions for both layers (CSS pixels)
    const gridA = extractDotPositions(layer1, 0, 0, canvasW, canvasH, radius);
    const gridB = extractDotPositions(
      layer2,
      offset.x,
      offset.y,
      canvasW,
      canvasH,
      radius,
    );

    if (gridA.count === 0 || gridB.count === 0) {
      engine.updateVoices(new Map(), audioSettings);
      return;
    }

    // 2. Build spatial hash for grid B
    if (!spatialHashRef.current || spatialHashRef.current === null) {
      spatialHashRef.current = new SpatialHash(radius);
    }
    const hash = spatialHashRef.current;
    hash.clear();
    hash.insertAll(gridB.positions, gridB.count);

    // 3. For each dot in grid A, query neighbors in grid B
    const targets = new Map<string, { gain: number; freq: number }>();
    const neighbors = neighborsBuffer.current;

    for (let i = 0; i < gridA.count; i++) {
      const ax = gridA.positions[i * 2];
      const ay = gridA.positions[i * 2 + 1];

      neighbors.length = 0;
      hash.queryNeighbors(ax, ay, neighbors);

      for (let n = 0; n < neighbors.length; n++) {
        const j = neighbors[n];
        const bx = gridB.positions[j * 2];
        const by = gridB.positions[j * 2 + 1];

        const dx = ax - bx;
        const dy = ay - by;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < radius) {
          const gain = 1 - dist / radius;
          // Key by "A-index" — each grid-A dot produces at most one voice,
          // taking the loudest interaction if multiple grid-B dots are close.
          const key = `A${i}`;
          const existing = targets.get(key);

          if (!existing || gain > existing.gain) {
            // Frequency from grid-A dot's x position
            const freq = freqMin + (ax / canvasW) * freqRange;
            targets.set(key, { gain, freq });
          }
        }
      }
    }

    // 4. Feed to engine
    engine.updateVoices(targets, audioSettings);
  }, [
    audioSettings,
    layer1.spacing,
    layer1.rotation,
    layer1.type,
    layer2.spacing,
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
