import * as util from "../util.mjs";
import WorkerScript from "./workerscript.js";

// dn/dt = s(c)n(2-n/n0) - kn
// dc/dt = f(n) - λc

// activator:
// f(n) = λc0 * n/n0 * (n0^2+α^2)/(n^2+α^2)
// s(c) = k * [ (2cm(h − β)c) / (cm^2 + c^2) + β ]
// β = (c0^2 + cm^2 - 2h*c0*cm) / (c0 - cm)^2

// inhibitor:
// f(n) = λc0/n0 * n
// s(c) = k * [ ((h − 1)c + h*c0) / (2(h − 1)c + c0) ]

let k = 0.25;
let n0 = 4;
let c0 = 1;
let cm = 1;
let lambda = 0.5;
let alpha = 1;
let h = 1;

let isActivator = false;

function f(n) {
  return isActivator ? fA(n) : fH(n);
}
function fA(n) {
  return (
    ((lambda * c0 * n) / n0) * ((n0 ** 2 + alpha ** 2) / (n ** 2 + alpha ** 2))
  );
}
function fH(n) {
  return ((lambda * c0) / n0) * n;
}
function s(c) {
  return isActivator ? sA(c) : sH(c);
}
function sA(c) {
  let beta = (c0 ** 2 + cm ** 2 - 2 * h * c0 * cm) / (c0 - cm) ** 2;
  return k * ((2 * cm * (h - beta) * c) / (cm ** 2 + c ** 2) + beta);
}
function sH(c) {
  return k * (((h - 1) * c + h * c0) / (2 * (h - 1) * c + c0));
}

export default class PatternWorkerScript extends WorkerScript {
  channels = 3;
  channelsD = [2, 10, 0];
  channelsDXScale = [1, 1, 1];
  channelsDYScale = [1, 1, 1];

  getD(x, y, i) {
    if (this.space[this.getIdx(x, y, 2)]) return 0;
    return super.getD(x, y, i);
  }

  setup() {
    let callbackfs = {
      0: (v, idx, x, y, i) => {
        if (i === 0) {
          this.space[idx] = n0;
          return;
        }
        if (i === 1) {
          this.space[idx] = c0;
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
        let idxn = this.getIdx(x, y, 0);
        let idxc = this.getIdx(x, y, 1);
        let n = space[idxn];
        let c = space[idxc];
        let dndt = s(c) * n * (2 - n / n0) - k * n;
        let dcdt = f(n) - lambda * c;
        n += dndt;
        c += dcdt;
        space[idxn] = n || 0;
        space[idxc] = c || 0;
      }
    }
  }
  applyChannel(i, v) {
    return v * 64;
  }

  applyFilter(data, dataIdx, x, y) {
    if (this.space[this.getIdx(x, y, 2)]) data[dataIdx + 3] /= 2;
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
      if (type === "k") return (k = data);
      if (type === "n0") return (n0 = data);
      if (type === "c0") return (c0 = data);
      if (type === "cm") return (cm = data);
      if (type === "lambda") return (lambda = data);
      if (type === "alpha") return (alpha = data);
      if (type === "h") return (h = data);
    });
  }
}

new PatternWorkerScript();
