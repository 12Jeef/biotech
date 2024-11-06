import * as util from "../util.mjs";
import WorkerScript from "./workerscript.js";

// dA/dt = ρA + cA*A^2 / (1 + kA)*H - μA
// dH/dt = ρH + cH*A^2 - νH

let rhoA = 0;
let rhoH = 0;
let cA = 0;
let cH = 0;
let s = 0;
let mu = 0;
let nu = 0;

export default class PatternWorkerScript extends WorkerScript {
  channels = 3;
  channelsD = [0, 0, 0];
  channelsDXScale = [1, 1, 1];
  channelsDYScale = [1, 1, 1];

  larvaHeightSegmentRange = [];
  larvaHeightSegments = {};
  larvaCache = {};

  getD(x, y, i) {
    if (this.space[this.getIdx(x, y, 2)]) return 0;
    return super.getD(x, y, i);
  }

  clampX(x, y, i) {
    if (this.mode !== 3) return super.clampX(x, y, i);
    if (this.larvaCache.x[x]) return this.larvaCache.x[x];
    let x2 = x;
    let [l, r] = this.larvaHeightSegmentRange;
    let w = r - l + 1;
    x2 -= l;
    x2 = ((x2 % w) + w) % w;
    x2 += l;
    return (this.larvaCache.x[x] = x2);
  }
  clampY(x, y, i) {
    if (this.mode !== 3) return super.clampY(x, y, i);
    if (this.larvaCache.y[x])
      if (this.larvaCache.y[x][y]) return this.larvaCache.y[x][y];
    let y2 = y;
    let x2 = this.clampX(x, y, i);
    let [t, b] = this.larvaHeightSegments[x2];
    let h = b - t + 1;
    y2 -= t;
    y2 = ((y2 % h) + h) % h;
    y2 += t;
    if (!this.larvaCache.y[x]) this.larvaCache.y[x] = {};
    return (this.larvaCache.y[x][y] = y2);
  }

  setup() {
    this.channelsDXScale[0] = this.mode === 3 ? 0.5 : 1;
    this.channelsDYScale[0] = this.mode === 3 ? 2 : 1;
    this.channelsDXScale[1] = this.mode === 3 ? 2 : 1;
    this.channelsDYScale[1] = this.mode === 3 ? 0.5 : 1;
    this.larvaHeightSegmentRange = [];
    this.larvaHeightSegments = {};
    this.larvaCache = { x: {}, y: {} };
    let callbackfs = {
      0: (v, idx, x, y, i) => {
        if (i > 1) return;
        if (i === 0) {
          this.space[idx] = util.lerp(-1, +1, Math.random());
          return;
        }
      },
      1: (v, idx, x, y, i) => {
        if (i > 1) return;
        this.space[idx] =
          (Math.sqrt((x - this.width / 2) ** 2 + (y - this.height / 2) ** 2) <
            2.5) *
          1;
      },
      2: (v, idx, x, y, i) => {
        if (i !== 2) return;
        this.space[idx] = +!this.inButterfly(x, y);
      },
      3: (v, idx, x, y, i) => {
        if (this.inLarva(x, y)) {
          if (this.larvaHeightSegmentRange.length === 0)
            this.larvaHeightSegmentRange = [x, x];
          this.larvaHeightSegmentRange[0] = Math.min(
            this.larvaHeightSegmentRange[0],
            x,
          );
          this.larvaHeightSegmentRange[1] = Math.max(
            this.larvaHeightSegmentRange[1],
            x,
          );
          if (!(x in this.larvaHeightSegments))
            this.larvaHeightSegments[x] = [y, y];
          this.larvaHeightSegments[x][0] = Math.min(
            this.larvaHeightSegments[x][0],
            y,
          );
          this.larvaHeightSegments[x][1] = Math.max(
            this.larvaHeightSegments[x][1],
            y,
          );
        }
        if (i === 0) {
          this.space[idx] =
            util.lerp(-1, +1, Math.random()) * this.inLarva(x, y);
          return;
        }
        if (i === 2) {
          this.space[idx] = +!this.inLarva(x, y);
          return;
        }
      },
    };
    let callback = null;
    if (this.mode in callbackfs) callback = callbackfs[this.mode];
    this.forEach((v, idx, x, y, i) => {
      if (callback) callback(v, idx, x, y, i);
    });
  }
  updatePreDiffuse() {
    const { space, width, height } = this;
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let idxA = this.getIdx(x, y, 0);
        let idxH = this.getIdx(x, y, 1);
        let A = space[idxA];
        let H = space[idxH];
        let dAdt =
          rhoA + (cA * A ** 2) / ((1 + s * A ** 2) * Math.max(0.1, H)) - mu * A;
        let dHdt = rhoH + cH * A ** 2 - nu * H;
        A += dAdt * this.dt;
        H += dHdt * this.dt;
        space[idxA] = A || 0;
        space[idxH] = H || 0;
      }
    }
  }
  applyChannel(i, v) {
    return v * v * [64, 128, 64][i];
  }

  applyFilter(data, dataIdx, x, y) {
    if (this.space[this.getIdx(x, y, 2)]) data[dataIdx + 3] /= 2;
  }

  inButterfly(x, y) {
    x -= this.width / 2;
    y -= this.height * 0.55;
    x /= 1.5;
    y /= 1.5;
    x = Math.abs(x);
    if (y < 0) {
      y = -y / 1.25;
      if (x > this.width / 4) return false;
      if (y < this.height * 0.1) return true;
      y -= this.height * 0.1;
      if (y > this.height / 6) return false;
      return x / (this.width / 4) - y / (this.height / 4) > 0;
    }
    if (x > this.width / 6) return false;
    if (y < this.height * 0.1) return true;
    y -= this.height * 0.1;
    if (y > this.height / 6) return false;
    return x / (this.width / 6) - y / (this.height / 4) > 0;
  }
  inLarva(x, y) {
    return (
      ((x - this.width / 2) / (this.width / 4)) ** 2 +
        ((y - this.height / 2) / (this.height / 4)) ** 2 <
      1
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
      if (type === "rhoA") return (rhoA = data);
      if (type === "rhoH") return (rhoH = data);
      if (type === "cA") return (cA = data);
      if (type === "cH") return (cH = data);
      if (type === "s") return (s = data);
      if (type === "mu") return (mu = data);
      if (type === "nu") return (nu = data);
    });
  }
}

new PatternWorkerScript();
