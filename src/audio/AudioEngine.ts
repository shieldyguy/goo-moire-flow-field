/**
 * AudioEngine — manages Web Audio API lifecycle and proximity-based synthesis.
 *
 * Oscillators are lazily created when a dot first participates in a proximity
 * interaction, and cleaned up after they've been silent for a while.
 * Frequency is derived from x-position; amplitude from proximity distance.
 */

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
  lastActiveTime: number; // AudioContext.currentTime when last non-zero gain
  targetGain: number;
}

interface AudioConfig {
  interactionRadius: number;
  frequencyRange: { min: number; max: number };
  rampTimeMs: number;
  maxVoices: number;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private voices: Map<string, Voice> = new Map();
  private activeCount = 0;

  /** How long a voice must be silent before we garbage-collect it (seconds). */
  private static VOICE_CLEANUP_DELAY = 0.5;

  get isReady(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  /**
   * Create (or resume) the AudioContext.
   * MUST be called from within a user-gesture call stack.
   */
  async initialize(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, volume)),
        this.ctx.currentTime,
        0.02,
      );
    }
  }

  /**
   * Play a short test tone to confirm audio output is working.
   */
  playTestTone(): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = 440;
    gain.gain.value = 0.15;

    osc.connect(gain);
    gain.connect(this.masterGain);

    const now = this.ctx.currentTime;
    osc.start(now);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);
    osc.stop(now + 0.6);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  /**
   * Core per-frame update. Receives a map of voice keys → target gains and
   * frequencies, ramps each voice to its target, and cleans up silent voices.
   *
   * @param targets  Map of voiceKey → { gain: 0-1, freq: Hz }
   * @param config   Current audio settings
   */
  updateVoices(
    targets: Map<string, { gain: number; freq: number }>,
    config: AudioConfig,
  ): void {
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const rampTime = config.rampTimeMs / 1000;

    // Scale per-voice gain so the sum doesn't clip.
    // 1/sqrt(N) keeps perceived loudness roughly constant as voice count changes.
    const voiceCount = Math.max(targets.size, 1);
    const voiceScale = 1 / Math.sqrt(voiceCount);

    // Update or create voices for all active targets
    for (const [key, target] of targets) {
      let voice = this.voices.get(key);

      if (!voice) {
        // Voice cap is enforced upstream (useSonification sorts by gain
        // and only sends the top N targets), so we always create here.
        voice = this.createVoice(target.freq);
        this.voices.set(key, voice);
        this.activeCount++;
      }

      // Update frequency if it changed significantly (dot moved horizontally)
      voice.osc.frequency.setTargetAtTime(target.freq, now, rampTime);

      // Ramp gain — scaled by 1/sqrt(N) to prevent clipping
      const scaledGain = target.gain * voiceScale;
      voice.gain.gain.linearRampToValueAtTime(scaledGain, now + rampTime);
      voice.targetGain = target.gain;

      if (target.gain > 0) {
        voice.lastActiveTime = now;
      }
    }

    // Fade out voices that aren't in the target set, and clean up silent ones
    const toDelete: string[] = [];
    for (const [key, voice] of this.voices) {
      if (!targets.has(key)) {
        // Not in this frame's targets — fade to zero
        if (voice.targetGain > 0) {
          voice.gain.gain.linearRampToValueAtTime(0, now + rampTime);
          voice.targetGain = 0;
        }
      }

      // Garbage collect voices that have been silent long enough
      if (
        voice.targetGain === 0 &&
        now - voice.lastActiveTime > AudioEngine.VOICE_CLEANUP_DELAY
      ) {
        voice.osc.stop();
        voice.osc.disconnect();
        voice.gain.disconnect();
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.voices.delete(key);
      this.activeCount--;
    }
  }

  private createVoice(freq: number): Voice {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0;

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();

    return {
      osc,
      gain,
      lastActiveTime: 0,
      targetGain: 0,
    };
  }

  async suspend(): Promise<void> {
    if (this.ctx && this.ctx.state === "running") {
      await this.ctx.suspend();
    }
  }

  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  dispose(): void {
    // Stop all voices
    for (const voice of this.voices.values()) {
      voice.osc.stop();
      voice.osc.disconnect();
      voice.gain.disconnect();
    }
    this.voices.clear();
    this.activeCount = 0;

    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
    }
  }
}
