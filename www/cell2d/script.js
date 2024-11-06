import * as util from "../util.mjs";

//// CANVAS DISPLAY

const eDisplay = document.getElementById("display");

//// REAL CANVASES

const eCanvasReal = document.getElementById("main");
const ctxReal = eCanvasReal.getContext("2d");
const eCanvas2Real = document.getElementById("meter");
const ctx2Real = eCanvas2Real.getContext("2d");

//// VIRTUAL CANVASES

let eCanvas = null;
let eOffCanvas = null;

let eCanvas2 = null;
let eOffCanvas2 = null;

//// WORKER

const context = new util.Target();

let worker = null;
let simulator = "pattern";
const updateSim = () => {
  eSimSelect.textContent = document.getElementById(
    "sim-" + simulator,
  ).textContent;

  eCanvas = document.createElement("canvas");
  eCanvas.width = spaceWidth;
  eCanvas.height = spaceHeight;
  eOffCanvas = eCanvas.transferControlToOffscreen();

  eCanvas2 = document.createElement("canvas");
  eCanvas2.width = eCanvas2Real.width;
  eCanvas2.height = eCanvas2Real.height;
  eOffCanvas2 = eCanvas2.transferControlToOffscreen();

  const scaleX = 1000 / spaceWidth;
  const scaleY = 600 / spaceHeight;
  const scale = (scaleX + scaleY) / 2;
  eCanvasReal.width = spaceWidth * scale;
  eCanvasReal.height = spaceHeight * scale;

  if (worker) worker.terminate();
  worker = new Worker("./workerscript-" + simulator + ".js", {
    type: "module",
  });
  worker.postMessage(
    { type: "init", data: { eCanvas: eOffCanvas, eCanvas2: eOffCanvas2 } },
    [eOffCanvas, eOffCanvas2],
  );

  updateWorkerPenSize();
  updateWorkerPenWeight();
  updateMeter();

  Array.from(document.querySelectorAll(".sim-param")).forEach(
    (elem) => (elem.style.display = "none"),
  );
  Array.from(document.querySelectorAll(".sim-param." + simulator)).forEach(
    (elem) => (elem.style.display = ""),
  );
  context.post("update-sim");

  updatePenChannels();
  updateVisibleChannels();
  updateWorkerVisibleChannels();
  updateChannelMappings();
  updateWorkerChannelMappings();

  worker.postMessage({ type: "start", data: null });
};
const closeSimulatorDropdown = (e) => {
  if (e) {
    if (eSims.contains(e.target)) return;
    e.stopPropagation();
  }
  document.body.removeEventListener("click", closeSimulatorDropdown, true);
  eSims.classList.remove("open");
};
const eSims = document.getElementById("sims");
const eSimSelect = document.getElementById("sim-select");
eSimSelect.addEventListener("click", (e) => {
  if (eSims.classList.contains("open")) return closeSimulatorDropdown();
  eSims.classList.add("open");
  document.body.addEventListener("click", closeSimulatorDropdown, true);
});
["diffusion", "pattern", "wound-heal", "zebrafish", "heart"].forEach((sim) => {
  const elem = document.getElementById("sim-" + sim);
  elem.addEventListener("click", (e) => {
    simulator = sim;
    updateSim();
    closeSimulatorDropdown();
  });
});

const eSimParams = document.getElementById("sim-params");
const eSimParamsToggle = document.getElementById("sim-params-toggle");
eSimParamsToggle.addEventListener("click", (e) => {
  if (eSimParams.classList.contains("open"))
    eSimParams.classList.remove("open");
  else eSimParams.classList.add("open");
});

const createSimParameter = (sim, name, value, cast = parseFloat) => {
  const update = () => {
    elem.value = value;
  };
  const updateWorker = () => {
    if (simulator !== sim) return;
    worker.postMessage({ type: name, data: value });
  };
  const elem = document.getElementById(sim + "-" + name);
  elem.addEventListener("change", (e) => {
    value = cast(elem.value);
    update();
    updateWorker();
  });
  update();
  return {
    update: update,
    updateWorker: updateWorker,
    get value() {
      return value;
    },
  };
};

//// DIFFUSION
{
  const createParameter = (name, value, cast = parseFloat) =>
    createSimParameter("diffusion", name, value, cast);

  const D0 = createParameter("D0", 10);
  const D1 = createParameter("D1", 10);
  const D2 = createParameter("D2", 10);

  context.addHandler("update-sim", () => {
    D0.updateWorker();
    D1.updateWorker();
    D2.updateWorker();
    if (simulator !== "diffusion") return;
    penWeight = 25;
    updatePenWeight();
    updateWorkerPenWeight();
    channels = ["Red", "Green", "Blue"];
    channelMappings = [0, 1, 2];
  });
}

//// PATTERN
{
  const createParameter = (name, value, cast = parseFloat) =>
    createSimParameter("pattern", name, value, cast);

  const mode = createParameter("mode", 0, parseInt);
  const rhoA = createParameter("rhoA", 0);
  const rhoH = createParameter("rhoH", 0);
  const cA = createParameter("cA", 1);
  const cH = createParameter("cH", 1);
  const s = createParameter("s", 0);
  const mu = createParameter("mu", 1);
  const nu = createParameter("nu", 1.2);
  const D0 = createParameter("D0", 1);
  const D1 = createParameter("D1", 7.5);

  context.addHandler("update-sim", () => {
    mode.updateWorker();
    rhoA.updateWorker();
    rhoH.updateWorker();
    cA.updateWorker();
    cH.updateWorker();
    s.updateWorker();
    mu.updateWorker();
    nu.updateWorker();
    D0.updateWorker();
    D1.updateWorker();
    if (simulator !== "pattern") return;
    penWeight = 0.1;
    updatePenWeight();
    updateWorkerPenWeight();
    channels = ["A", "H", "Walls"];
    channelMappings = [1, 0, null];
  });
}

//// WOUND HEALING
{
  const createParameter = (name, value, cast = parseFloat) =>
    createSimParameter("wound-heal", name, value, cast);

  context.addHandler("update-sim", () => {
    if (simulator !== "wound-heal") return;
    penWeight = 0.1;
    updatePenWeight();
    updateWorkerPenWeight();
    channels = ["n", "c", "Walls"];
    channelMappings = [0, 1, null];
  });
}

//// ZEBRAFISH
{
  const createParameter = (name, value, cast = parseFloat) =>
    createSimParameter("zebrafish", name, value, cast);

  const mode = createParameter("mode", 0, parseInt);
  const c1 = createParameter("c1", -0.04);
  const c2 = createParameter("c2", -0.055);
  const c3 = createParameter("c3", 0.37);
  const c4 = createParameter("c4", -0.05);
  const c5 = createParameter("c5", 0);
  const c6 = createParameter("c6", 0.25);
  const c7 = createParameter("c7", 0.016);
  const c8 = createParameter("c8", -0.03);
  const c9 = createParameter("c9", 0.24);
  const cu = createParameter("cu", 0.02);
  const cv = createParameter("cv", 0.025);
  const cw = createParameter("cw", 0.06);
  const U = createParameter("U", 0.5);
  const V = createParameter("V", 0.5);
  const W = createParameter("W", 0.5);
  const D0 = createParameter("D0", 0.5);
  const D1 = createParameter("D1", 0.5);
  const D2 = createParameter("D2", 5);

  context.addHandler("update-sim", () => {
    mode.updateWorker();
    c1.updateWorker();
    c2.updateWorker();
    c3.updateWorker();
    c4.updateWorker();
    c5.updateWorker();
    c5.updateWorker();
    c6.updateWorker();
    c7.updateWorker();
    c8.updateWorker();
    c9.updateWorker();
    cu.updateWorker();
    cv.updateWorker();
    cw.updateWorker();
    U.updateWorker();
    V.updateWorker();
    W.updateWorker();
    D0.updateWorker();
    D1.updateWorker();
    D2.updateWorker();
    if (simulator !== "zebrafish") return;
    penWeight = 0.1;
    updatePenWeight();
    updateWorkerPenWeight();
    channels = ["U", "V", "W"];
    channelMappings = [0, 1, 2];
  });
}

//// HEART
{
  const createParameter = (name, value, cast = parseFloat) =>
    createSimParameter("heart", name, value, cast);

  const mode = createParameter("mode", 0, parseInt);
  const r = createParameter("r", 0.1);
  const a = createParameter("a", 0.1);
  const epsilon = createParameter("epsilon", 0.005);
  const beta = createParameter("beta", 0.5);
  const D0 = createParameter("D0", 0.5);

  context.addHandler("update-sim", () => {
    mode.updateWorker();
    r.updateWorker();
    a.updateWorker();
    epsilon.updateWorker();
    beta.updateWorker();
    D0.updateWorker();
    if (simulator !== "heart") return;
    penWeight = 0.5;
    updatePenWeight();
    updateWorkerPenWeight();
    channels = ["V", "W", "Walls"];
    channelMappings = [0, null, 1];
  });
}

//// SPACE

let spaceWidth = 200;
const eSpaceWidth = document.getElementById("space-width");
const updateSpaceWidth = () => {
  eSpaceWidth.value = spaceWidth;
};
const updateWorkerSpaceWidth = () => {
  updateSim();
};
eSpaceWidth.addEventListener("change", () => {
  spaceWidth = parseFloat(eSpaceWidth.value);
  updateSpaceWidth();
  updateWorkerSpaceWidth();
});
updateSpaceWidth();

let spaceHeight = 120;
const eSpaceHeight = document.getElementById("space-height");
const updateSpaceHeight = () => {
  eSpaceHeight.value = spaceHeight;
};
const updateWorkerSpaceHeight = () => {
  updateSim();
};
eSpaceHeight.addEventListener("change", () => {
  spaceHeight = parseFloat(eSpaceHeight.value);
  updateSpaceHeight();
  updateWorkerSpaceHeight();
});
updateSpaceHeight();

//// PEN

const savePenProfile = () => {
  return {
    size: penSize,
    weight: penWeight,
  };
};
const loadPenProfile = (profile) => {
  const { size, weight } = profile;
  if (size != null) {
    penSize = size;
    updatePenSize();
    updateWorkerPenSize();
  }
  if (weight != null) {
    penWeight = weight;
    updatePenWeight();
    updateWorkerPenWeight();
  }
};

let penSize = 3;
const ePenSizeInput = document.getElementById("pensize-input");
const ePenSizeRange = document.getElementById("pensize-range");
const updatePenSize = () => {
  ePenSizeInput.value = penSize;
  ePenSizeRange.value = penSize;
};
const updateWorkerPenSize = () => {
  worker.postMessage({ type: "pen-size", data: penSize });
};
ePenSizeInput.addEventListener("change", () => {
  penSize = parseFloat(ePenSizeInput.value);
  updatePenSize();
  updateWorkerPenSize();
});
ePenSizeRange.addEventListener("input", () => {
  penSize = parseFloat(ePenSizeRange.value);
  updatePenSize();
  updateWorkerPenSize();
});
updatePenSize();

let penWeight = 1;
const ePenWeightInput = document.getElementById("penweight-input");
const ePenWeightRange = document.getElementById("penweight-range");
const updatePenWeight = () => {
  ePenWeightInput.value = penWeight;
  ePenWeightRange.value = penWeight;
};
const updateWorkerPenWeight = () => {
  worker.postMessage({ type: "pen-weight", data: penWeight });
};
ePenWeightInput.addEventListener("change", () => {
  penWeight = parseFloat(ePenWeightInput.value);
  updatePenWeight();
  updateWorkerPenWeight();
});
ePenWeightRange.addEventListener("input", () => {
  penWeight = parseFloat(ePenWeightRange.value);
  updatePenWeight();
  updateWorkerPenWeight();
});
updatePenWeight();

//// METER

let meter = new util.V(20);
const updateMeter = () => {
  worker.postMessage({ type: "meter", data: meter.xy });
};

//// CHANNELS

let channels = [];

let penChannels = [];
const updatePenChannels = () => {
  while (penChannels.length < channels.length) penChannels.push(true);
  while (penChannels.length > channels.length) penChannels.pop();
  while (ePenChannelButtons.length < channels.length) {
    const i = ePenChannelButtons.length;
    const eButton = document.createElement("button");
    ePenChannels.appendChild(eButton);
    ePenChannelButtons.push(eButton);
    eButton.addEventListener("click", (e) => {
      if (e.shiftKey) {
        for (let j = 0; j < penChannels.length; j++) penChannels[j] = false;
        penChannels[i] = true;
      } else penChannels[i] = !penChannels[i];
      updatePenChannels();
    });
    eButton.draggable = true;
    eButton.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", String(i));
    });
  }
  while (ePenChannelButtons.length > channels.length) {
    const eButton = ePenChannelButtons.pop();
    ePenChannels.removeChild(eButton);
  }
  ePenChannelButtons.forEach((eButton, i) => {
    if (penChannels[i]) eButton.classList.add("active");
    else eButton.classList.remove("active");
    eButton.textContent = channels[i];
    eButton.classList.remove("r");
    eButton.classList.remove("g");
    eButton.classList.remove("b");
    if (["red", "r"].includes(channels[i].toLowerCase()))
      eButton.classList.add("r");
    if (["green", "g"].includes(channels[i].toLowerCase()))
      eButton.classList.add("g");
    if (["blue", "b"].includes(channels[i].toLowerCase()))
      eButton.classList.add("b");
  });
};
const ePenChannels = document.getElementById("pen-channels");
const ePenChannelButtons = [];
updatePenChannels();

let visibleChannels = [];
const updateVisibleChannels = () => {
  while (visibleChannels.length < channels.length) visibleChannels.push(true);
  while (visibleChannels.length > channels.length) visibleChannels.pop();
  while (eVisibleChannelButtons.length < channels.length) {
    const i = eVisibleChannelButtons.length;
    const eButton = document.createElement("button");
    eVisibleChannels.appendChild(eButton);
    eVisibleChannelButtons.push(eButton);
    eButton.addEventListener("click", (e) => {
      if (e.shiftKey) {
        for (let j = 0; j < visibleChannels.length; j++)
          visibleChannels[j] = false;
        visibleChannels[i] = true;
      } else visibleChannels[i] = !visibleChannels[i];
      updateVisibleChannels();
      updateWorkerVisibleChannels();
    });
    eButton.draggable = true;
    eButton.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", String(i));
    });
  }
  while (eVisibleChannelButtons.length > channels.length) {
    const eButton = eVisibleChannelButtons.pop();
    eVisibleChannels.removeChild(eButton);
  }
  eVisibleChannelButtons.forEach((eButton, i) => {
    if (visibleChannels[i]) eButton.classList.add("active");
    else eButton.classList.remove("active");
    eButton.textContent = channels[i];
    eButton.classList.remove("r");
    eButton.classList.remove("g");
    eButton.classList.remove("b");
    if (["red", "r"].includes(channels[i].toLowerCase()))
      eButton.classList.add("r");
    if (["green", "g"].includes(channels[i].toLowerCase()))
      eButton.classList.add("g");
    if (["blue", "b"].includes(channels[i].toLowerCase()))
      eButton.classList.add("b");
  });
};
const updateWorkerVisibleChannels = () => {
  worker.postMessage({ type: "visible-channels", data: visibleChannels });
};
const eVisibleChannels = document.getElementById("visible-channels");
const eVisibleChannelButtons = [];
updateVisibleChannels();

let channelMappings = [null, null, null];
const updateChannelMappings = () => {
  for (let i = 0; i < 3; i++) {
    let j = channelMappings[i];
    document.getElementById("channel-map-" + i + "-name").textContent =
      j == null || j < 0 || j >= channels.length ? "" : channels[j];
  }
};
const updateWorkerChannelMappings = () => {
  worker.postMessage({ type: "channel-mappings", data: channelMappings });
};
for (let i = 0; i < 3; i++) {
  const elem = document.getElementById("channel-map-" + i);
  const eRemove = document.getElementById("channel-map-" + i + "-remove");
  eRemove.addEventListener("click", (e) => {
    channelMappings[i] = null;
    updateChannelMappings();
    updateWorkerChannelMappings();
  });
  const onDragOver = (e) => {
    e.preventDefault();
    elem.classList.add("dropping");
  };
  const onDragNotOver = (e) => {
    e.preventDefault();
    elem.classList.remove("dropping");
  };
  elem.addEventListener("dragenter", onDragOver);
  elem.addEventListener("dragover", onDragOver);
  elem.addEventListener("dragleave", onDragNotOver);
  elem.addEventListener("drop", (e) => {
    onDragNotOver(e);
    const data = e.dataTransfer.getData("text/plain");
    const channel = parseInt(data);
    if (!Number.isInteger(channel)) return;
    if (channel < 0) return;
    if (channel >= channels.length) return;
    channelMappings[i] = channel;
    updateChannelMappings();
    updateWorkerChannelMappings();
  });
}

//// ACTIVE TOOL

let toolProfiles = {};
let activeTool = "draw";
const updateActiveTool = () => {
  ["draw", "erase", "move", "meter"].forEach((tool) => {
    const elem = document.getElementById("tool-" + tool);
    if (tool === activeTool) elem.classList.add("this");
    else elem.classList.remove("this");
  });
  ePenSizeInput.parentElement.style.display = ePenSizeRange.style.display =
    activeTool === "meter" ? "none" : "";
  ePenWeightInput.parentElement.style.display = ePenWeightRange.style.display =
    activeTool === "draw" ? "" : "none";
};
updateActiveTool();
["draw", "erase", "move", "meter"].forEach((tool) => {
  const elem = document.getElementById("tool-" + tool);
  elem.addEventListener("click", (e) => {
    toolProfiles[activeTool] = savePenProfile();
    activeTool = tool;
    loadPenProfile(toolProfiles[activeTool] ?? {});
    updateActiveTool();
  });
});
document.body.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  let codes = {
    KeyD: "draw",
    KeyE: "erase",
    KeyW: "move",
    KeyM: "meter",

    Digit1: "draw",
    Digit2: "erase",
    Digit3: "move",
    Digit4: "meter",
  };
  if (e.code in codes) {
    activeTool = codes[e.code];
    updateActiveTool();
    return;
  }
});

let paused = false;
const updatePaused = () => {
  eIcon.name = paused ? "play" : "pause";
};
const updateWorkerPaused = () => {
  worker.postMessage({ type: "paused", data: paused });
};
const elem = document.getElementById("tool-pp");
const eIcon = elem.querySelector(":scope > ion-icon");
elem.addEventListener("click", (e) => {
  paused = !paused;
  updatePaused();
  updateWorkerPaused();
});
updatePaused();

//// MOUSE

let mouseDown = false;
let prevMouse = new util.V();
let mouse = new util.V();

//// CANVAS HOOKS

eCanvasReal.addEventListener("mousedown", (e) => (mouseDown = true));
eCanvasReal.addEventListener("mouseup", (e) => (mouseDown = false));
eCanvasReal.addEventListener("mousemove", (e) => {
  let currMouse = new util.V(e.offsetX, e.offsetY);
  const r = eCanvasReal.getBoundingClientRect();
  currMouse.x *= eCanvas.width / r.width;
  currMouse.y *= eCanvas.height / r.height;
  prevMouse.set(mouse);
  mouse.set(currMouse);
});

//// UPDATE

updateSim();
const update = () => {
  window.requestAnimationFrame(update);
  if (mouseDown) {
    let i = [];
    penChannels.forEach((active, j) => {
      if (!active) return;
      i.push(j);
    });
    if (activeTool === "draw")
      worker.postMessage({ type: "draw", data: { pos: mouse.xy, i: i } });
    if (activeTool === "erase")
      worker.postMessage({ type: "erase", data: { pos: mouse.xy, i: i } });
    if (activeTool === "move")
      worker.postMessage({
        type: "move",
        data: { pos: mouse.xy, shift: mouse.sub(prevMouse).xy, i: i },
      });
    if (activeTool === "meter") {
      meter.set(mouse);
      meter.iround();
      updateMeter();
    }
  }

  const r = eDisplay.getBoundingClientRect();
  const em = parseFloat(getComputedStyle(eDisplay).fontSize);
  const canvas2ToCanvas = eCanvasReal.width / eCanvas2Real.width;
  const globalScale = Math.min(
    r.width / eCanvasReal.width,
    (r.height - em) /
      (eCanvasReal.height + eCanvas2Real.height * canvas2ToCanvas),
  );
  eCanvasReal.style.width = eCanvasReal.width * globalScale + "px";
  eCanvasReal.style.height = eCanvasReal.height * globalScale + "px";
  eCanvas2Real.style.width =
    eCanvas2Real.width * globalScale * canvas2ToCanvas + "px";
  eCanvas2Real.style.height =
    eCanvas2Real.height * globalScale * canvas2ToCanvas + "px";

  const virtualToReal = [
    ctxReal.canvas.width / eCanvas.width,
    ctxReal.canvas.height / eCanvas.height,
  ];

  ctxReal.imageSmoothingEnabled = ctx2Real.imageSmoothingEnabled = false;

  ctxReal.clearRect(0, 0, ctxReal.canvas.width, ctxReal.canvas.height);
  ctxReal.drawImage(eCanvas, 0, 0, ctxReal.canvas.width, ctxReal.canvas.height);
  ctxReal.strokeStyle = "#fff8";
  ctxReal.lineWidth = 2;
  ctxReal.strokeRect(
    ...meter.mul(virtualToReal).xy,
    ...new util.V(1).mul(virtualToReal).xy,
  );
  if (activeTool !== "meter") {
    ctxReal.beginPath();
    ctxReal.ellipse(
      ...mouse.mul(virtualToReal).xy,
      ...new util.V(penSize).mul(virtualToReal).xy,
      0,
      0,
      2 * Math.PI,
    );
    ctx2Real.closePath();
    ctxReal.stroke();
  }

  ctx2Real.clearRect(0, 0, ctx2Real.canvas.width, ctx2Real.canvas.height);
  ctx2Real.drawImage(
    eCanvas2,
    0,
    0,
    ctx2Real.canvas.width,
    ctx2Real.canvas.height,
  );
};
update();
