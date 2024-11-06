import * as util from "../util.mjs";
import WorkerScript from "./workerscript.js";

// du/dt = F(u,v,w) - cu*u + (diffusion)
// dv/dt = G(u,v,w) - cv*u + (diffusion)
// dw/dt = H(u,v,w) - cw*u + (diffusion)

let c1 = 0;
let c2 = 0;
let c3 = 0;
let c4 = 0;
let c5 = 0;
let c6 = 0;
let c7 = 0;
let c8 = 0;
let c9 = 0;

let cu = 0;
let cv = 0;
let cw = 0;

let U = 0;
let V = 0;
let W = 0;

function F(u, v, w) {
  let q = c1 * v + c2 * w + c3;
  return Math.min(U, Math.max(0, q));
}
function G(u, v, w) {
  let q = c4 * u + c5 * w + c6;
  return Math.min(V, Math.max(0, q));
}
function H(u, v, w) {
  let q = c7 * u + c8 * v + c9;
  return Math.min(W, Math.max(0, q));
}

export default class ZebrafishWorkerScript extends WorkerScript {
  channels = 3;
  channelsD = [0, 0, 0];
  channelsDXScale = [1, 1, 1];
  channelsDYScale = [1, 1, 1];

  setup() {
    let callbackfs = {
      0: (v, idx, x, y, i) => {
        this.space[idx] = util.lerp(-1, +1, Math.random());
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
        let uidx = this.getIdx(x, y, 0);
        let vidx = this.getIdx(x, y, 1);
        let widx = this.getIdx(x, y, 2);
        let u = space[uidx];
        let v = space[vidx];
        let w = space[widx];
        let dudt = F(u, v, w) - cu * u;
        let dvdt = G(u, v, w) - cv * v;
        let dwdt = H(u, v, w) - cw * w;
        u += dudt;
        v += dvdt;
        w += dwdt;
        space[uidx] = u;
        space[vidx] = v;
        space[widx] = w;
      }
    }
  }
  applyChannel(i, v) {
    return v * 64;
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
      if (type === "c1") return (c1 = data);
      if (type === "c2") return (c2 = data);
      if (type === "c3") return (c3 = data);
      if (type === "c4") return (c4 = data);
      if (type === "c5") return (c5 = data);
      if (type === "c6") return (c6 = data);
      if (type === "c7") return (c7 = data);
      if (type === "c8") return (c8 = data);
      if (type === "c9") return (c9 = data);
      if (type == "cu") return (cu = data);
      if (type == "cv") return (cv = data);
      if (type == "cw") return (cw = data);
      if (type == "U") return (U = data);
      if (type == "V") return (V = data);
      if (type == "W") return (W = data);
    });
  }
}

new ZebrafishWorkerScript();
