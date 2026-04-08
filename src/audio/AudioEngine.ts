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
  // Dedicated gain node for voice-count normalization — sits between voices
  // and masterGain so that fluctuations in voice count produce a single smooth
  // ramp instead of N simultaneous per-voice jumps.
  private normGain: GainNode | null = null;
  private voices: Map<string, Voice> = new Map();
  private activeCount = 0;

  /** How long a voice must be silent before we garbage-collect it (seconds). */
  private static VOICE_CLEANUP_DELAY = 1.0;

  /** Time constant for setTargetAtTime — controls smoothing speed. */
  private static GAIN_TIME_CONSTANT = 0.03; // ~30ms

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

      // Normalization gain sits between voices and master
      this.normGain = this.ctx.createGain();
      this.normGain.gain.value = 1;
      this.normGain.connect(this.masterGain);
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
        AudioEngine.GAIN_TIME_CONSTANT,
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
    gain.gain.value = 0;

    osc.connect(gain);
    gain.connect(this.masterGain);

    const now = this.ctx.currentTime;
    // Proper anchor → ramp pattern to avoid clicks
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.6);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  /**
   * Core per-frame update. Receives a map of voice keys → target gains and
   * frequencies, smoothly ramps each voice to its target, and cleans up
   * silent voices.
   *
   * @param targets  Map of voiceKey → { gain: 0-1, freq: Hz }
   * @param config   Current audio settings
   */
  updateVoices(
    targets: Map<string, { gain: number; freq: number }>,
    config: AudioConfig,
  ): void {
    if (!this.ctx || !this.normGain) return;

    const now = this.ctx.currentTime;
    const tau = config.rampTimeMs / 1000;

    // Normalize by 1/N so the sum of all voices never exceeds 1.0 before
    // master gain. sqrt(N) is too weak — dense grids produce correlated
    // sines at similar frequencies that sum nearly linearly.
    const voiceCount = Math.max(targets.size, 1);
    const normValue = 1 / voiceCount;
    this.normGain.gain.setTargetAtTime(normValue, now, tau);

    // Update or create voices for all active targets
    for (const [key, target] of targets) {
      let voice = this.voices.get(key);

      if (!voice) {
        voice = this.createVoice(target.freq);
        this.voices.set(key, voice);
        this.activeCount++;
      }

      // Smooth frequency update
      voice.osc.frequency.setTargetAtTime(target.freq, now, tau);

      // Smooth gain update using setTargetAtTime — unlike linearRampToValueAtTime,
      // this doesn't require an anchor and handles being called every frame
      // without cancellation artifacts.
      voice.gain.gain.setTargetAtTime(target.gain, now, tau);
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
          voice.gain.gain.setTargetAtTime(0, now, tau);
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
    gain.connect(this.normGain!);
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
      this.normGain = null;
    }
  }
}
