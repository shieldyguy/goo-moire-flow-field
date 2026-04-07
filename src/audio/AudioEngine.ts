/**
 * AudioEngine — manages Web Audio API lifecycle.
 *
 * For now this only handles AudioContext creation/resume/suspend
 * and plays a short test tone to confirm the context is alive.
 * The proximity-based synthesis will be layered on top later.
 */

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  /** True once the AudioContext has been successfully created and resumed. */
  get isReady(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  /**
   * Create (or resume) the AudioContext.
   * MUST be called from within a user-gesture call stack (click/touch handler)
   * or the browser will refuse to start it.
   */
  async initialize(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    }

    // Browsers can create a context in "suspended" state even inside a gesture
    // if the page hasn't had prior audio interaction. Explicitly resume.
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  /** Update master volume (0-1). */
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
   * Play a short test tone (440 Hz sine, 0.5s fade-out) to confirm the
   * AudioContext is alive and audio output is working.
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

    // Cleanup after the tone finishes
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  /** Suspend the AudioContext (pause all processing). */
  async suspend(): Promise<void> {
    if (this.ctx && this.ctx.state === "running") {
      await this.ctx.suspend();
    }
  }

  /** Resume a suspended AudioContext. */
  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  /** Tear down everything. */
  dispose(): void {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
    }
  }
}
