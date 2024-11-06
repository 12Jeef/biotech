import * as util from "../util.mjs";
import WorkerScript from "./workerscript.js";

// dV/dt = rV(1-V)(V-a) - ßW + D * (diffusion)
// dW/dt = ε(V - W)

let r = 0;
let a = 0;
let epsilon = 0;
let beta = 0;

export default class HeartWorkerScript extends WorkerScript {
  dt = 0.05;

  channels = 3;
  channelsD = [0, 0, 0];
  channelsDXScale = [1, 1, 1];
  channelsDYScale = [1, 1, 1];

  wrapDiffuse = false;
  wrapPen = false;

  getD(x, y, i) {
    if (this.space[this.getIdx(x, y, 2)]) return 0;
    if (this.inChannel(x, y)) return 1;
    if (this.inAtrium(x, y)) return 2;
    if (this.inVentricle(x, y)) return 2;
    return super.getD(x, y, i);
  }

  setup() {
    let callbackfs = {
      0: (v, idx, x, y, i) => {
        let dir =
          (Math.atan2(y - this.height / 2, x - this.width / 2) * 180) / Math.PI;
        dir = ((dir % 360) + 360) % 360;
        let dist = Math.sqrt(
          (x - this.width / 2) ** 2 + (y - this.height / 2) ** 2,
        );
        let inner = dist < ((this.width + this.height) / 2) * 0.1;
        if (i === 0) {
          this.space[idx] =
            (Math.abs(util.angleRel(dir, 0)) < this.fireDeg / 2 && !inner) *
            (a * 2);
          return;
        }
        if (i === 1) {
          this.space[idx] =
            (Math.abs(
              util.angleRel(dir, this.tiredDeg / 2 + this.fireDeg / 2),
            ) <
              this.tiredDeg / 2 && !inner) * 0.1;
          return;
        }
      },
      1: (v, idx, x, y, i) => {
        if (i === 0) {
          this.space[idx] =
            (Math.abs(x - this.width / 2) < this.fireW &&
              y < this.height / 2 &&
              y > this.height / 4) *
            (a * 2);
          return;
        }
        if (i === 1) {
          this.space[idx] =
            (x <= this.width / 2 - this.fireW && y < this.height / 2) * 0.1;
          return;
        }
      },
      2: (v, idx, x, y, i) => {},
      3: (v, idx, x, y, i) => {
        if (i === 0) {
          this.space[idx] =
            (Math.sqrt((x - this.width / 2) ** 2 + (y - this.height / 2) ** 2) <
              this.fireSize) *
            (a * 2);
          return;
        }
      },
      4: (v, idx, x, y, i) => {},
    };
    let callback = null;
    if (this.mode in callbackfs) callback = callbackfs[this.mode];
    this.forEach((v, idx, x, y, i) => {
      if (i === 2) {
        this.space[idx] = +(
          this.mode === 2 &&
          this.onBarrier(x, y) &&
          !this.inChannel(x, y)
        );
        return;
      }
      if (callback) callback(v, idx, x, y, i);
    });
  }
  updatePreDiffuse() {
    const { space, width, height, mode, time } = this;
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let idxV = this.getIdx(x, y, 0);
        let idxW = this.getIdx(x, y, 1);
        let V = space[idxV];
        let W = space[idxW];
        let dVdt = r * V * (1 - V) * (V / a - 1) - beta * W;
        let dWdt = epsilon * (V - W);
        V += dVdt;
        W += dWdt;
        if (mode === 2)
          V +=
            (a *
              this.inSinusNode(x, y) *
              (Math.max(
                this.sinusPulseThresh,
                Math.sin((2 * Math.PI * time) / this.sinusPulsePeriod),
              ) -
                this.sinusPulseThresh)) /
            (1 - this.sinusPulseThresh);
        space[idxV] = V || 0;
        space[idxW] = W || 0;
      }
    }
  }

  applyFilter(data, dataIdx, x, y) {
    if (this.space[this.getIdx(x, y, 2)]) data[dataIdx + 3] /= 2;
  }

  get fireDeg() {
    return 10;
  }
  get tiredDeg() {
    return 45;
  }

  get fireW() {
    return 2;
  }

  get fireSize() {
    return 3;
  }

  get barrierX() {
    return this.width / 3;
  }
  get barrierW() {
    return 5;
  }
  get channelY() {
    return this.height / 2;
  }
  get channelW() {
    return 5;
  }

  get sinusPulsePeriod() {
    return 80;
  }
  get sinusPulseThresh() {
    return 0.75;
  }

  onBarrier(x, y) {
    return this.mode === 2 && Math.abs(x - this.barrierX) <= this.barrierW;
  }
  inChannel(x, y) {
    return (
      this.mode === 2 &&
      this.onBarrier(x, y) &&
      Math.abs(y - this.channelY) <= this.channelW
    );
  }
  inAtrium(x, y) {
    return this.mode === 2 && !this.onBarrier(x, y) && x < this.barrierX;
  }
  inVentricle(x, y) {
    return this.mode === 2 && !this.onBarrier(x, y) && x > this.barrierX;
  }
  inSinusNode(x, y) {
    return (
      this.mode === 2 &&
      Math.abs(x - 3) < 2 &&
      Math.abs(y - this.height / 4) < 2
    );
  }

  constructor() {
    super();

    this.mode = 0;

    this.addHandler("message", ({ type, data }) => {
      if (type === "mode") {
        this.mode = data;
        this.fullSetup();
        return;
      }
      if (type === "r") return (r = data);
      if (type === "a") return (a = data);
      if (type === "epsilon") return (epsilon = data);
      if (type === "beta") return (beta = data);
    });
  }
}

new HeartWorkerScript();
