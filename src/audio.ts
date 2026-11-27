/** Procedural Web Audio Mech Warfare Soundscape (zero external MP3 dependencies!) */
export class IronwoodAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  public enabled = true;

  public unlock() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.38;
      this.master.connect(this.ctx.destination);

      // Shared white noise buffer for explosions, minigun crack, desert wind & thrusters
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      // Subtle dusty desert wind bed
      const wind = this.ctx.createBufferSource();
      wind.buffer = this.noiseBuf;
      wind.loop = true;
      const wf = this.ctx.createBiquadFilter();
      wf.type = "bandpass";
      wf.frequency.value = 340;
      wf.Q.value = 1.8;
      const wg = this.ctx.createGain();
      wg.gain.value = 0.045;
      wind.connect(wf).connect(wg).connect(this.master);
      wind.start();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  public setEnabled(on: boolean) {
    this.enabled = on;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? 0.38 : 0.0001, this.ctx.currentTime, 0.04);
    }
  }

  /** Distinct weapon sound per Ironwood chassis/weapon slot (0..4) */
  public playGun(slot: number) {
    if (!this.enabled || !this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const jitter = 0.92 + Math.random() * 0.16;

    // Mechanical ballistic transient
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = (slot === 3 ? 1100 : slot === 4 ? 520 : 1650) * jitter;
    filt.Q.value = slot === 2 ? 2.4 : 1.1;

    const ng = this.ctx.createGain();
    const dur = slot === 3 || slot === 4 ? 0.22 : 0.075;
    ng.gain.setValueAtTime(slot === 3 || slot === 4 ? 0.42 : 0.2, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(filt).connect(ng).connect(this.master);
    noise.start(t);
    noise.stop(t + dur + 0.02);

    // Punchy low oscillator thump / rail crack / plasma zip
    const osc = this.ctx.createOscillator();
    osc.type = slot === 2 ? "sawtooth" : slot === 3 ? "triangle" : "square";
    const startFreq = slot === 2 ? 520 : slot === 3 ? 280 : slot === 4 ? 140 : 195;
    const endFreq = slot === 2 ? 160 : slot === 3 ? 42 : 48;
    osc.frequency.setValueAtTime(startFreq * jitter, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);

    const og = this.ctx.createGain();
    og.gain.setValueAtTime(slot === 3 || slot === 4 ? 0.38 : 0.16, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(og).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  public playMissile() {
    if (!this.enabled || !this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.14);
    bp.frequency.exponentialRampToValueAtTime(600, t + 0.42);
    bp.Q.value = 1.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.44);
  }

  public playExplosion(big = false) {
    if (!this.enabled || !this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const dur = big ? 0.85 : 0.36;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(big ? 780 : 620, t);
    lp.frequency.exponentialRampToValueAtTime(75, t + dur);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(big ? 0.65 : 0.34, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(lp).connect(ng).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.04);

    // Sub-bass shockwave
    const sub = this.ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(big ? 110 : 88, t);
    sub.frequency.exponentialRampToValueAtTime(26, t + dur * 0.85);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(big ? 0.62 : 0.3, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.85);
    sub.connect(sg).connect(this.master);
    sub.start(t);
    sub.stop(t + dur);
  }

  /** Mechanical Transformer hydraulic morph SFX */
  public playTransform(toCar: boolean) {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const notes = toCar ? [340, 250, 180, 130] : [140, 210, 290, 390];
    notes.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = "sawtooth";
      const st = t + i * 0.085;
      osc.frequency.setValueAtTime(f, st);
      osc.frequency.exponentialRampToValueAtTime(f * (toCar ? 0.72 : 1.28), st + 0.08);
      const lp = this.ctx!.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1100;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.18, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.09);
      osc.connect(lp).connect(g).connect(this.master!);
      osc.start(st);
      osc.stop(st + 0.1);
    });
  }

  public playDash() {
    if (!this.enabled || !this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(520, t);
    bp.frequency.exponentialRampToValueAtTime(1600, t + 0.12);
    bp.frequency.exponentialRampToValueAtTime(280, t + 0.32);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.34);
  }

  public playHit(kill = false) {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(kill ? 740 : 1280, t);
    osc.frequency.exponentialRampToValueAtTime(kill ? 1480 : 620, t + (kill ? 0.14 : 0.05));
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(kill ? 0.24 : 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (kill ? 0.16 : 0.055));
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  public playCorePickup() {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 987.77].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = "sine";
      const st = t + i * 0.055;
      osc.frequency.setValueAtTime(freq, st);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.2, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.22);
      osc.connect(g).connect(this.master!);
      osc.start(st);
      osc.stop(st + 0.24);
    });
  }

  public playDeploy() {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    [660, 880].forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = "sine";
      const st = t + i * 0.08;
      osc.frequency.setValueAtTime(f, st);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.18, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.12);
      osc.connect(g).connect(this.master!);
      osc.start(st);
      osc.stop(st + 0.13);
    });
  }
}
