// Web Audio API Synthesizer for Royal Enamel Ludo Sounds (zero external file dependencies)
class AudioEngineManager {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private masterGain: GainNode | null = null;
  private volume: number = 1;

  constructor() {
    if (typeof window !== 'undefined') {
      this.muted = localStorage.getItem('ludo-sound-muted') === 'true';
      const storedRaw = localStorage.getItem('ludo-sfx-volume');
      const stored = storedRaw === null ? 1 : Number(storedRaw);
      if (Number.isFinite(stored) && stored >= 0 && stored <= 1) this.volume = stored;
    }
  }

  /** Single master bus so the volume slider affects every synthesized sound. */
  private getOutput(): GainNode {
    if (!this.ctx) throw new Error('audio context is not initialised');
    if (!this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }
    this.masterGain.gain.value = this.muted ? 0 : this.volume;
    return this.masterGain;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1));
    if (typeof window !== 'undefined') {
      localStorage.setItem('ludo-sfx-volume', String(this.volume));
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.01);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('ludo-sound-muted', String(muted));
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.01);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private init(): boolean {
    if (this.muted) return false;
    if (typeof window === 'undefined') return false;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return !!this.ctx;
  }

  /**
   * Sound effect: Token hopping along track cells
   */
  public playHop(): void {
    if (!this.init() || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(540, this.ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(this.getOutput());
    osc.start();
    osc.stop(this.ctx.currentTime + 0.14);
  }

  /**
   * Sound effect: Token exiting home base on roll of 6
   */
  public playExit(): void {
    if (!this.init() || !this.ctx) return;
    const now = this.ctx.currentTime;
    [440, 554, 659].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.18, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
      osc.connect(gain);
      gain.connect(this.getOutput());
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.22);
    });
  }

  /**
   * Sound effect: Rolling a 6 or bonus roll
   */
  public playSix(): void {
    if (!this.init() || !this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const start = now + idx * 0.08;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      osc.connect(gain);
      gain.connect(this.getOutput());
      osc.start(start);
      osc.stop(start + 0.32);
    });
  }

  /**
   * Sound effect: Capturing an opponent token
   */
  public playStrike(): void {
    if (!this.init() || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.25);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(this.getOutput());
    osc.start(now);
    osc.stop(now + 0.28);
  }

  /**
   * Sound effect: Safe landing or star cell
   */
  public playLand(): void {
    if (!this.init() || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.getOutput());
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Sound effect: Tumbling dice roll
   */
  public playDiceRoll(): void {
    if (!this.init() || !this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const t = now + i * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180 + Math.random() * 120, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.06);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain);
      gain.connect(this.getOutput());
      osc.start(t);
      osc.stop(t + 0.06);
    }
  }

  /**
   * Sound effect: Match victory fanfare
   */
  public playVictory(): void {
    if (!this.init() || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const start = now + idx * 0.18;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
      osc.connect(gain);
      gain.connect(this.getOutput());
      osc.start(start);
      osc.stop(start + 0.45);
    });
  }

  /**
   * Sound effect: Turn timeout notification
   */
  public playTimeout(): void {
    if (!this.init() || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Descending two-tone buzzer
    [320, 220].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      const start = now + idx * 0.14;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
      osc.connect(gain);
      gain.connect(this.getOutput());
      osc.start(start);
      osc.stop(start + 0.12);
    });
  }

  /**
   * Sound effect: Subtle timer warning tick when <= 5s
   */
  public playWarningTick(): void {
    if (!this.init() || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.getOutput());
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  // Convenience aliases for event-driven audio triggers
  public playMove(): void {
    this.playHop();
  }

  public playDeploy(): void {
    this.playExit();
  }

  public playCapture(): void {
    this.playStrike();
  }

  public playHome(): void {
    this.playLand();
  }

  public playWin(): void {
    this.playVictory();
  }
}

export const AudioEngine = new AudioEngineManager();
