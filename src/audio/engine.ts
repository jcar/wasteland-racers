import { audio } from './sfx';

/**
 * The player's engine: a growly hum whose pitch follows speed, with a
 * little wobble so it sounds like a rattly junk engine.
 */
export class EngineSound {
  private nodes?: { osc: OscillatorNode; sub: OscillatorNode; lfo: OscillatorNode; filter: BiquadFilterNode; gain: GainNode };

  start() {
    const a = audio();
    if (!a || this.nodes) return;
    const { ctx } = a;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const sub = ctx.createOscillator();
    sub.type = 'square';
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain).connect(osc.frequency);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain).connect(a.out);
    osc.start();
    sub.start();
    lfo.start();
    this.nodes = { osc, sub, lfo, filter, gain };
  }

  /** ratio: 0 (idle) .. 1 (top speed), more when boosting. */
  update(ratio: number, boosting: boolean) {
    const n = this.nodes;
    const a = audio();
    if (!n || !a) return;
    const t = a.ctx.currentTime;
    const f = 45 + ratio * 95 + (boosting ? 30 : 0);
    n.osc.frequency.setTargetAtTime(f, t, 0.08);
    n.sub.frequency.setTargetAtTime(f / 2, t, 0.08);
    n.filter.frequency.setTargetAtTime(350 + ratio * 900 + (boosting ? 600 : 0), t, 0.1);
    n.gain.gain.setTargetAtTime(0.05 + ratio * 0.04, t, 0.1);
  }

  stop() {
    const n = this.nodes;
    const a = audio();
    this.nodes = undefined;
    if (!n || !a) return;
    n.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.1);
    setTimeout(() => [n.osc, n.sub, n.lfo].forEach((o) => o.stop()), 400);
  }
}
