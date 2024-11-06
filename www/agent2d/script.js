import * as util from "../util.mjs";

const eCanvas = document.getElementById("canvas");
const ctx = eCanvas.getContext("2d");

let width = ctx.canvas.width;
let height = ctx.canvas.height;

const nSpecies = 3;

class Agent extends util.Target {
  #species;

  #pos;

  #npos;

  constructor(opts) {
    super();

    this.#species = 0;

    this.#pos = new util.V();

    this.#npos = new util.V();

    const { species, pos } = opts;

    this.species = species;

    this.pos = pos;
  }

  get species() {
    return this.#species;
  }
  set species(v) {
    this.#species = Math.min(
      nSpecies - 1,
      Math.max(0, Math.round(Number(v) || 0)),
    );
  }

  get pos() {
    return this.#pos;
  }
  set pos(v) {
    this.#pos.set(v);
  }
  get x() {
    return this.pos.x;
  }
  set x(v) {
    this.pos.x = v;
  }
  get y() {
    return this.pos.y;
  }
  set y(v) {
    this.pos.y = v;
  }

  get npos() {
    return this.#npos;
  }
  set npos(v) {
    this.#npos.set(v);
  }
  get nx() {
    return this.npos.x;
  }
  set nx(v) {
    this.npos.x = v;
  }
  get ny() {
    return this.npos.y;
  }
  set ny(v) {
    this.npos.y = v;
  }

  update() {
    [this.npos] = [this.pos];
  }
  postUpdate() {
    [this.pos] = [this.npos];
  }
}

// row = me
// column = other

function generateRandomValue() {
  return {
    avoid: util.lerp(-0.25, +0.225, Math.random()),
    centering: util.lerp(-0.0025, +0.0025, Math.random()),
    matching: util.lerp(-0.25, +0.25, Math.random()),
  };
}
// const matrix = [
//     [
//         { avoid: 0.05, centering: 0.0005, matching: 0.05 }, // i am prey, i see prey
//         { avoid: 0, centering: 0.005, matching: 0.05 }, // i am pred, i see prey
//     ],
//     [
//         { avoid: 0.05, centering: 0, matching: 0.005 }, // i am prey, i see pred
//         { avoid: 0.05, centering: 0.0005, matching: 0.05 }, // i am pred, i see pred
//     ],
// ];
const matrix = new Array(nSpecies)
  .fill(null)
  .map((_) => new Array(nSpecies).fill(null).map((_) => generateRandomValue()));

const minSpeed = 0.5;
const maxSpeed = 5;

class AgentBoid extends Agent {
  #protectedRange;
  #visualRange;

  #vel;

  #nvel;

  constructor(opts) {
    super(opts);

    this.#protectedRange = 0;
    this.#visualRange = 0;

    this.#vel = new util.V();

    this.#nvel = new util.V();

    const { protectedRange, visualRange, vel } = opts;

    this.protectedRange = protectedRange;
    this.visualRange = visualRange;

    this.vel = vel;
  }

  get protectedRange() {
    return this.#protectedRange;
  }
  set protectedRange(v) {
    this.#protectedRange = Math.max(0, Number(v) || 0);
  }
  get visualRange() {
    return this.#visualRange;
  }
  set visualRange(v) {
    this.#visualRange = Math.max(0, Number(v) || 0);
  }

  get vel() {
    return this.#vel;
  }
  set vel(v) {
    this.#vel.set(v);
  }
  get velX() {
    return this.vel.x;
  }
  set velX(v) {
    this.vel.x = v;
  }
  get velY() {
    return this.vel.y;
  }
  set velY(v) {
    this.vel.y = v;
  }

  get dir() {
    return util.clampAngle(this.vel.towards() + 180);
  }

  get nvel() {
    return this.#nvel;
  }
  set nvel(v) {
    this.#nvel.set(v);
  }
  get nvelX() {
    return this.nvel.x;
  }
  set nvelX(v) {
    this.nvel.x = v;
  }
  get nvelY() {
    return this.nvel.y;
  }
  set nvelY(v) {
    this.nvel.y = v;
  }

  get ndir() {
    return util.clampAngle(this.nvel.towards() + 180);
  }

  update() {
    super.update();

    [this.nvel] = [this.vel];

    let neighborCloseDx = new Array(nSpecies).fill(0);
    let neighborCloseDy = new Array(nSpecies).fill(0);

    let neighborAvgX = new Array(nSpecies).fill(0);
    let neighborAvgY = new Array(nSpecies).fill(0);

    let neighborAvgVelX = new Array(nSpecies).fill(0);
    let neighborAvgVelY = new Array(nSpecies).fill(0);

    let nNeighborAgents = new Array(nSpecies).fill(0);

    let scans = [];

    let xMin = this.x - this.visualRange < 0;
    let xMax = this.x + this.visualRange > width;
    let yMin = this.y - this.visualRange < 0;
    let yMax = this.y + this.visualRange > height;
    for (let x = xMin * -1; x <= xMax * +1; x++)
      for (let y = yMin * -1; y <= yMax * +1; y++) scans.push([x, y]);

    agents.forEach((agent) => {
      if (agent === this) return;

      const {
        dist,
        shift: [shiftX, shiftY],
      } = (() => {
        let distMn = Infinity;
        let shift = [0, 0];
        scans.forEach(([sx, sy]) => {
          let dist = this.pos.dist(agent.pos.add(sx * width, sy * height));
          if (dist > distMn) return;
          distMn = dist;
          shift = [sx, sy];
        });
        return { dist: distMn, shift: shift };
      })();

      if (dist < this.protectedRange) {
        neighborCloseDx[agent.species] += this.x - (agent.x + width * shiftX);
        neighborCloseDy[agent.species] += this.y - (agent.y + height * shiftY);
        return;
      }

      if (dist > this.visualRange) return;

      neighborAvgX[agent.species] += agent.x + width * shiftX;
      neighborAvgY[agent.species] += agent.y + height * shiftY;

      neighborAvgVelX[agent.species] += agent.velX;
      neighborAvgVelY[agent.species] += agent.velY;

      nNeighborAgents[agent.species]++;
    });

    for (let i = 0; i < nSpecies; i++) {
      const { avoid, centering, matching } = matrix[this.species][i];

      this.nvelX += neighborCloseDx[i] * avoid;
      this.nvelY += neighborCloseDy[i] * avoid;

      if (nNeighborAgents[i] > 0) {
        neighborAvgX[i] /= nNeighborAgents[i];
        neighborAvgY[i] /= nNeighborAgents[i];

        this.nvelX += (neighborAvgX[i] - this.x) * centering;
        this.nvelY += (neighborAvgY[i] - this.y) * centering;

        neighborAvgVelX[i] /= nNeighborAgents[i];
        neighborAvgVelY[i] /= nNeighborAgents[i];

        this.nvelX += (neighborAvgVelX[i] - this.velX) * matching;
        this.nvelY += (neighborAvgVelY[i] - this.velY) * matching;
      }
    }

    let vel = this.nvel.dist();
    if (vel === 0) this.nvel.set(minSpeed, 0);
    else if (vel < minSpeed) this.nvel.imul(minSpeed / vel);
    else if (vel > maxSpeed) this.nvel.imul(maxSpeed / vel);
  }
  postUpdate() {
    super.postUpdate();

    [this.vel] = [this.nvel];

    this.pos.iadd(this.vel);

    this.x = ((this.x % width) + width) % width;
    this.y = ((this.y % height) + height) % height;
  }
}

const speed = 5;
const speedEp = 2;
const dirEp = 20;

const hateOthers = true;

class AgentViscek extends Agent {
  #visualRange;

  #dir;

  #ndir;

  constructor(opts) {
    super(opts);

    this.#visualRange = 0;

    this.#dir = 0;

    this.#ndir = 0;

    const { visualRange, dir } = opts;

    this.visualRange = visualRange;

    this.dir = dir;
  }

  get visualRange() {
    return this.#visualRange;
  }
  set visualRange(v) {
    this.#visualRange = Math.max(0, Number(v) || 0);
  }

  get dir() {
    return this.#dir;
  }
  set dir(v) {
    this.#dir = util.clampAngle(Number(v) || 0);
  }

  get ndir() {
    return this.#ndir;
  }
  set ndir(v) {
    this.#ndir = util.clampAngle(Number(v) || 0);
  }

  update() {
    super.update();

    [this.ndir] = [this.dir];

    let scans = [];

    let xMin = this.x - this.visualRange < 0;
    let xMax = this.x + this.visualRange > width;
    let yMin = this.y - this.visualRange < 0;
    let yMax = this.y + this.visualRange > height;
    for (let x = xMin * -1; x <= xMax * +1; x++)
      for (let y = yMin * -1; y <= yMax * +1; y++) scans.push([x, y]);

    let avgDir = 0;
    let n = 0;

    agents.forEach((agent) => {
      const {
        dist,
        shift: [shiftX, shiftY],
      } = (() => {
        let distMn = Infinity;
        let shift = [0, 0];
        scans.forEach(([sx, sy]) => {
          let dist = this.pos.dist(agent.pos.add(sx * width, sy * height));
          if (dist > distMn) return;
          distMn = dist;
          shift = [sx, sy];
        });
        return { dist: distMn, shift: shift };
      })();

      if (dist > this.visualRange) return;

      if (agent.species != this.species) {
        if (!hateOthers) return;
        n++;
        avgDir +=
          agent.pos.towards(this.pos) +
          util.lerp(-dirEp, +dirEp, Math.random());
        return;
      }
      n++;
      avgDir += agent.dir + util.lerp(-dirEp, +dirEp, Math.random());
    });

    if (n > 0) {
      let ndir = avgDir / n;
      this.ndir = ndir;
    }
  }
  postUpdate() {
    super.postUpdate();

    [this.dir] = [this.ndir];

    this.pos.iadd(
      util.V.dir(
        this.dir,
        speed + util.lerp(-speedEp, +speedEp, Math.random()),
      ),
    );

    this.x = ((this.x % width) + width) % width;
    this.y = ((this.y % height) + height) % height;
  }
}

const buildBoid = () => {
  return new AgentBoid({
    protectedRange: 10,
    visualRange: 40,
    // species: +(Math.random() > 0.75),
    species: Math.floor(Math.random() * nSpecies),
    pos: [Math.random() * width, Math.random() * height],
    vel: util.V.dir(360 * Math.random(), 10),
  });
};
const buildViscek = () => {
  return new AgentViscek({
    visualRange: 40,
    species: Math.floor(Math.random() * nSpecies),
    pos: [Math.random() * width, Math.random() * height],
    dir: 360 * Math.random(),
  });
};

const agents = [];
for (let i = 0; i < 200; i++) agents.push(buildBoid());

const update = () => {
  window.requestAnimationFrame(update);

  agents.forEach((agent) => agent.update());
  agents.forEach((agent) => agent.postUpdate());

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.lineWidth = 1;
  agents.forEach((agent) => {
    ctx.fillStyle = ["#08f", "#f02", "#0c4"][agent.species];
    ctx.beginPath();
    ctx.arc(...agent.pos.xy, 5, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
  });
};
update();
