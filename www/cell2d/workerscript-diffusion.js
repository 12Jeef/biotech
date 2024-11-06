import * as util from "../util.mjs";
import WorkerScript from "./workerscript.js";

export default class DiffusionWorkerScript extends WorkerScript {
  epsilon = 1;

  channels = 3;
  channelsD = [0, 0, 0];
  channelsDXScale = [1, 1, 1];
  channelsDYScale = [1, 1, 1];

  applyChannel(i, v) {
    return v;
  }

  constructor() {
    super();
  }
}

new DiffusionWorkerScript();
