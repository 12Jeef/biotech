import * as util from "../util.mjs";

export default class WorkerScript extends util.Target {
  dt = 0.01;
  dx = 1;

  epsilon = 0.001;

  channels = 0;
  channelsD = [];
  channelsDXScale = [];
  channelsDYScale = [];

  wrapDiffuse = true;
  wrapPen = true;

  axisXDScale = 1;
  axisYDScale = 1;

  get eCanvas() {
    return this.ctx.canvas;
  }
  get eCanvas2() {
    return this.ctx2.canvas;
  }
  get width() {
    return this.eCanvas.width;
  }
  get height() {
    return this.eCanvas.height;
  }
  get width2() {
    return this.eCanvas2.width;
  }
  get height2() {
    return this.eCanvas2.height;
  }

  clampX(x, y, i) {
    return ((x % this.width) + this.width) % this.width;
  }
  clampY(x, y, i) {
    return ((y % this.height) + this.height) % this.height;
  }
  clampI(x, y, i) {
    return ((i % this.channels) + this.channels) % this.channels;
  }
  getIdx(x, y, i) {
    return (x * this.height + y) * this.channels + i;
  }

  get length() {
    return this.width * this.height * this.channels;
  }

  getD(x, y, i) {
    return this.channelsD[i];
  }
  getp(x, y, i) {
    return (this.getD(x, y, i) * this.dt) / this.dx ** 2;
  }

  fullSetup() {
    this.space.fill(0);
    this.space2.fill(0);
    this.setup();
  }
  setup() {}
  updateFirst() {}
  updatePreDiffuse() {}
  updatePostDiffuse() {}
  updateLast() {}
  applyChannel(i, v) {
    return v * 256;
  }
  applyFilter(data, dataIdx, x, y) {}

  static makeNormalDist(stDev, mean = 0) {
    const denom = stDev * Math.sqrt(2 * Math.PI);
    function normalDist(x) {
      let exp = 0.5 * ((x - mean) / stDev) ** 2;
      return 1 / (denom * Math.E ** exp);
    }
    function invNormalDist(y) {
      return [
        Math.sqrt(2 * Math.log(1 / (y * denom))) * stDev + mean,
        -Math.sqrt(2 * Math.log(1 / (y * denom))) * stDev + mean,
      ];
    }
    const [mx, mn] = invNormalDist(0.01).map(
      (v) => Math.sign(v) * Math.ceil(Math.abs(v)) || 0,
    );
    const sum = (() => {
      let sum = 0;
      for (let rx = mn; rx <= mx; rx++)
        for (let ry = mn; ry <= mx; ry++)
          sum += normalDist(rx) * normalDist(ry);
      return sum;
    })();
    return { normalDist, invNormalDist, mx, mn, sum };
  }
  static makeNormalDistMat(stDev, mean = 0) {
    const { normalDist, invNormalDist, mx, mn, sum } = this.makeNormalDist(
      stDev,
      mean,
    );
    const mat = new Array(mx - mn + 1)
      .fill(null)
      .map(() => new Array(mx - mn + 1).fill(null).map(() => 0));
    for (let rx = mn; rx <= mx; rx++)
      for (let ry = mn; ry <= mx; ry++)
        mat[rx - mn][ry - mn] = (normalDist(rx) * normalDist(ry)) / sum;
    function get(rx, ry) {
      if (rx < mn) return 0;
      if (rx > mx) return 0;
      if (ry < mn) return 0;
      if (ry > mx) return 0;
      return mat[rx - mn][ry - mn];
    }
    return { normalDist, invNormalDist, mx, mn, sum, mat, get };
  }

  forEach(f) {
    for (let i = 0; i < this.channels; i++) {
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          let idx = this.getIdx(x, y, i);
          f(this.space[idx], idx, x, y, i);
        }
      }
    }
  }

  constructor() {
    super();

    this.mode = 0;
    this.time = 0;
    this.paused = false;

    this.ctx = null;
    this.ctx2 = null;

    this.space = new Float64Array(0);
    this.space2 = new Float64Array(0);

    this.penSize = 0;
    this.penWeight = 0;
    this.meter = new util.V();

    this.visibleChannels = [];
    this.channelMappings = [];

    this.drawQueue = [];
    this.eraseQueue = [];
    this.moveQueue = [];

    self.addEventListener("message", (e) => {
      const { type, data } = e.data;
      if (type === "init") {
        const { eCanvas, eCanvas2 } = data;
        this.ctx = eCanvas.getContext("2d", { willReadFrequently: true });
        this.ctx2 = eCanvas2.getContext("2d");
        return;
      }
      if (type === "start") {
        this.ctx2.fillStyle = "#000";
        this.ctx2.fillRect(0, 0, this.width2, this.height2);
        let x = 0;
        let pX = 0;
        let pValues = [0, 0, 0];

        this.space = new Float64Array(this.length);
        this.space2 = new Float64Array(this.length);

        this.fullSetup();

        const update = (applyCanvas = true) => {
          const {
            width,
            height,
            channels,
            ctx,
            ctx2,
            penSize,
            drawQueue,
            eraseQueue,
            moveQueue,
          } = this;
          let { space, space2 } = this;

          if (!this.paused) {
            this.updateFirst();

            this.time += this.dt;
          }

          while (drawQueue.length > 0) {
            const draw = drawQueue.shift();
            const { pos, i } = draw;
            let x = Math.round(pos[0]);
            let y = Math.round(pos[1]);
            i.forEach((i) => {
              for (let rx = -penSize; rx <= penSize; rx++) {
                for (let ry = -penSize; ry <= penSize; ry++) {
                  if (rx ** 2 + ry ** 2 > penSize ** 2) continue;
                  let ax = x + rx;
                  let ay = y + ry;
                  let aidx = 0;
                  if (!this.wrapPen) {
                    if (ax < 0 || ax >= width) continue;
                    if (ay < 0 || ay >= height) continue;
                    aidx = this.getIdx(ax, ay, i);
                  } else {
                    aidx = this.getIdx(
                      this.clampX(ax, ay, i),
                      this.clampY(ax, ay, i),
                      this.clampI(ax, ay, i),
                    );
                  }
                  space[aidx] += this.penWeight;
                }
              }
            });
          }
          while (eraseQueue.length > 0) {
            const erase = eraseQueue.shift();
            const { pos, i } = erase;
            let x = Math.round(pos[0]);
            let y = Math.round(pos[1]);
            i.forEach((i) => {
              for (let rx = -penSize; rx <= penSize; rx++) {
                for (let ry = -penSize; ry <= penSize; ry++) {
                  if (rx ** 2 + ry ** 2 > penSize ** 2) continue;
                  let ax = x + rx;
                  let ay = y + ry;
                  let aidx = 0;
                  if (!this.wrapPen) {
                    if (ax < 0 || ax >= width) continue;
                    if (ay < 0 || ay >= height) continue;
                    aidx = this.getIdx(ax, ay, i);
                  } else {
                    aidx = this.getIdx(
                      this.clampX(ax, ay, i),
                      this.clampY(ax, ay),
                      this.clampI(ax, ay, i),
                    );
                  }
                  space[aidx] = 0;
                }
              }
            });
          }
          while (moveQueue.length > 0) {
            const move = moveQueue.shift();
            const { pos, shift, i } = move;
            let x = Math.round(pos[0]);
            let y = Math.round(pos[1]);
            let sx = Math.round(shift[0]);
            let sy = Math.round(shift[1]);
            i.forEach((i) => {
              const values = [];
              for (let rx = -penSize; rx <= penSize; rx++) {
                for (let ry = -penSize; ry <= penSize; ry++) {
                  if (rx ** 2 + ry ** 2 > penSize ** 2) continue;
                  let ax = x + rx;
                  let ay = y + ry;
                  let outside = false;
                  if (!this.wrapPen) {
                    if (ax < 0 || ax >= width) outside = true;
                    if (ay < 0 || ay >= height) outside = true;
                  }
                  if (outside) {
                    values.push(0);
                  } else {
                    let aidx = this.getIdx(
                      this.clampX(ax, ay, i),
                      this.clampY(ax, ay, i),
                      this.clampI(ax, ay, i),
                    );
                    values.push(space[aidx]);
                    space[aidx] = 0;
                  }
                }
              }
              for (let rx = -penSize; rx <= penSize; rx++) {
                for (let ry = -penSize; ry <= penSize; ry++) {
                  if (rx ** 2 + ry ** 2 > penSize ** 2) continue;
                  let ax = x + rx + sx;
                  let ay = y + ry + sy;
                  let outside = false;
                  if (!this.wrapPen) {
                    if (ax < 0 || ax >= width) outside = true;
                    if (ay < 0 || ay >= height) outside = true;
                  }
                  if (outside) {
                    values.shift();
                  } else {
                    let aidx = this.getIdx(
                      this.clampX(ax, ay, i),
                      this.clampY(ax, ay, i),
                      this.clampI(ax, ay, i),
                    );
                    space[aidx] += values.shift();
                  }
                }
              }
            });
          }

          if (!this.paused) {
            this.updatePreDiffuse();

            space2.fill(0);
            for (let i = 0; i < channels; i++) {
              for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                  let idx = this.getIdx(x, y, i);
                  let p = this.getp(x, y, i);
                  if (p <= 0) {
                    space2[idx] = space[idx];
                    continue;
                  }
                  if (space[idx] < this.epsilon) continue;
                  space2[idx] += space[idx];
                  for (let j = 0; j < 4; j++) {
                    let [rx, ry] = [
                      [+1, 0],
                      [-1, 0],
                      [0, +1],
                      [0, -1],
                    ][j];
                    let ax = x + rx;
                    let ay = y + ry;
                    let aidx = 0;
                    if (!this.wrapDiffuse) {
                      if (ax < 0 || ax >= width) continue;
                      if (ay < 0 || ay >= height) continue;
                      aidx = this.getIdx(ax, ay, i);
                    } else {
                      ax = this.clampX(ax, ay, i);
                      ay = this.clampY(ax, ay, i);
                      aidx = this.getIdx(ax, ay, i);
                    }
                    space2[aidx] +=
                      space[idx] *
                      (p *
                        (ry
                          ? this.channelsDYScale[i]
                          : this.channelsDXScale[i]));
                    space2[idx] -=
                      space[idx] *
                      (p *
                        (ry
                          ? this.channelsDYScale[i]
                          : this.channelsDXScale[i]));
                  }
                }
              }
            }
            [space, space2] = [space2, space];
            [this.space, this.space2] = [space, space2];

            this.updatePostDiffuse();
          }

          if (!applyCanvas) return;

          ctx.clearRect(0, 0, width, height);
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, width, height);
          const data = ctx.getImageData(0, 0, width, height);
          for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
              let dataIdx = (y * width + x) * 4;
              for (let i = 0; i < 3; i++) {
                let j = this.channelMappings[i];
                if (j == null) continue;
                if (j < 0) continue;
                if (j >= this.channels) continue;
                let idx = this.getIdx(x, y, j);
                data.data[dataIdx + i] = Math.min(
                  255,
                  Math.max(
                    0,
                    this.applyChannel(j, space[idx]) * this.visibleChannels[j],
                  ),
                );
              }
              data.data[dataIdx + 3] = 255;
              this.applyFilter(data.data, dataIdx, x, y);
            }
          }
          ctx.putImageData(data, 0, 0);

          if (this.paused) return;

          ctx2.fillStyle = "#000";
          ctx2.fillRect(x, 0, 1, this.height2);

          ctx2.lineWidth = 2;
          for (let i = 0; i < Math.min(3, channels); i++) {
            let j = this.channelMappings[i];
            if (j == null) continue;
            if (j < 0) continue;
            if (j >= this.channels) continue;
            ctx2.strokeStyle = "#" + ["f00", "0f0", "08f"][i];
            let y = util.lerp(
              this.height2,
              0,
              util.lerp(
                0.25,
                0.75,
                this.applyChannel(j, space[this.getIdx(...this.meter.xy, j)]) /
                  256,
              ),
            );
            ctx2.beginPath();
            ctx2.moveTo(Math.min(x, pX), pValues[i]);
            ctx2.lineTo(x, y);
            ctx2.stroke();
            pValues[i] = y;
          }

          pX = x;
          x = (x + 1) % this.width2;

          this.updateLast();
        };
        setInterval(() => {
          for (let i = 1; i > 0; i--) update(i === 1);
        }, 0);
        return;
      }
      if (type === "visible-channels") {
        this.visibleChannels = data;
        return;
      }
      if (type === "channel-mappings") {
        this.channelMappings = data;
        return;
      }
      if (type === "draw") {
        this.drawQueue.push(data);
        return;
      }
      if (type === "erase") {
        this.eraseQueue.push(data);
        return;
      }
      if (type === "move") {
        this.moveQueue.push(data);
        return;
      }
      if (type === "pen-size") {
        this.penSize = data;
        return;
      }
      if (type === "pen-weight") {
        this.penWeight = data;
        return;
      }
      if (type === "meter") {
        this.meter.set(data);
        return;
      }
      if (type === "paused") {
        this.paused = data;
        return;
      }
      if (type.startsWith("D")) {
        let i = parseInt(type.slice(1));
        if (!Number.isNaN(i) && i >= 0 && i < this.channels) {
          this.channelsD[i] = data;
          return;
        }
      }
      this.post("message", { type, data });
    });
  }
}
