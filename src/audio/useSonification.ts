import { useRef, useEffect, useCallback } from "react";
import { AudioEngine } from "./AudioEngine";

interface AudioSettings {
  enabled: boolean;
  masterVolume: number;
  interactionRadius: number;
  frequencyRange: { min: number; max: number };
  rampTimeMs: number;
  maxVoices: number;
}

/**
 * React hook that manages the AudioEngine lifecycle.
 *
 * For now this only handles:
 * - Creating / resuming / suspending the AudioContext
 * - Playing a test tone on first enable
 * - Tracking master volume
 *
 * Proximity-based synthesis will be added in a later phase.
 */
export function useSonification(audioSettings: AudioSettings) {
  const engineRef = useRef<AudioEngine | null>(null);
  const hasPlayedTestTone = useRef(false);

  // Lazy-create the engine instance (no AudioContext yet — that needs a gesture)
  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine();
    }
    return engineRef.current;
  }, []);

  /**
   * Initialize the AudioContext. Must be called from a user gesture handler
   * (e.g. the audio toggle's onCheckedChange).
   *
   * Returns true if the context started successfully.
   */
  const initializeAudio = useCallback(async (): Promise<boolean> => {
    const engine = getEngine();
    try {
      await engine.initialize();

      // Play a test tone the first time audio is enabled so the user
      // gets immediate confirmation that sound is working.
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

  // Sync master volume whenever it changes
  useEffect(() => {
    engineRef.current?.setMasterVolume(audioSettings.masterVolume);
  }, [audioSettings.masterVolume]);

  // Suspend / resume when the enabled flag toggles
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (audioSettings.enabled) {
      engine.resume();
    } else {
      engine.suspend();
    }
  }, [audioSettings.enabled]);

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
