// Pure, deterministic game logic (no three.js, no DOM). Fixed time-step so runs are reproducible per seed.
//
// RULES  (N = correct verifications = number of ATTEMPTS)
//  - Each attempt is an endless Flappy-Bird run: unlimited flaps, gates keep coming, the ground and pipes end the attempt.
//  - Score of an attempt = 100 per gate + 50 per coin. Only your HIGHEST attempt counts.
//  - Coins charge the watch. At each TIERS threshold (coins in one attempt) the hero transforms into a stronger form,
//    and every gate/coin is worth (1 + tier) times more.

export const DT = 1 / 120;          // fixed step (s)
export const SPEED = 4.2;           // world units / s
export const GRAVITY = 21;          // units / s^2
export const FLAP_V = 8.6;          // upward velocity set by one flap
export const FLOOR = 0;             // top of the ground
export const CEIL = 12.2;
export const BIRD_R = 0.42;
export const BIRD_X0 = 0;
export const PIPE_W = 1.3;
export const START_Y = 5.4;
export const LEAD = 6.5;            // distance before first gate
export const SPACING = 4.2;         // base distance between gates
export const AHEAD = 90;            // how far ahead gates are generated
export const TIERS = [8, 18, 30];   // coins (in one attempt) needed to reach forms 1, 2, 3 (form 0 = base hero)
export const FORMS = ['ben', 'xlr8', 'alien3', 'alien4'];
const LO = 2.7, HI = 9.3;           // altitude band for gate centres (wide, so bars sit high and low)

// Small seeded RNG so every seed gives a different but reproducible street.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
export const gapFor = i => Math.max(3.7, 4.9 - i * 0.045);   // smaller gaps, shrinking to a hard floor
export const speedFor = passed => SPEED * (1 + Math.min(0.28, passed * 0.008));

/** Step the bird kinematics by one DT. Returns new {y,vy}. */
export function stepBird(y, vy) {
  vy -= GRAVITY * DT;
  y += vy * DT;
  return { y, vy };
}

/** Endless gate generator. Neighbouring gates never differ by more than a comfortable hop. */
export class Level {
  constructor(seed = 1) {
    this.R = rng(seed * 7919 + 104729); this.gates = []; this.nextX = LEAD + 7; this.lastCy = START_Y + .6;
  }
  ensure(x) {
    while (this.nextX < x) {
      const i = this.gates.length, cy = Math.min(HI, Math.max(LO, this.lastCy + (this.R() * 2 - 1) * 3.5));
      this.gates.push({ i, x: this.nextX, cy, gap: gapFor(i), passed: false, coinTaken: false });
      this.lastCy = cy; this.nextX += SPACING + this.R() * .9;
    }
  }
}

export class Sim {
  constructor(seed = 1) { this.reset(seed); }
  reset(seed = this.seed) {
    this.seed = seed; this.level = new Level(seed);
    this.t = 0; this.x = 0; this.y = START_Y; this.vy = 0;
    this.flapsUsed = 0;
    this.status = 'ready';      // ready | playing | lost
    this.cause = null;          // pipe | ground
    this.passed = 0; this.coins = 0; this.score = 0; this.tier = 0;
    this.events = []; this.acc = 0; this.tilt = 0; this.gi = 0;
    this.level.ensure(LEAD + AHEAD);
  }
  /** Player pressed flap. */
  flap() {
    if (this.status === 'ready') { this.status = 'playing'; this.events.push({ type: 'start' }); }
    if (this.status !== 'playing') return false;
    this.flapsUsed++; this.vy = FLAP_V;
    this.events.push({ type: 'flap' });
    return true;
  }
  /** Advance by real dt seconds (accumulated into fixed steps). */
  advance(dt) {
    if (this.status === 'ready') { this.hover += dt; return; }
    if (this.status !== 'playing') return;
    this.acc += Math.min(dt, 0.05);
    while (this.acc >= DT && this.status === 'playing') { this.acc -= DT; this.tick(); }
  }
  tick() {
    this.t += DT;
    this.x += speedFor(this.passed) * DT;
    const b = stepBird(this.y, this.vy);
    this.y = b.y; this.vy = b.vy;
    this.tilt += ((Math.max(-1, Math.min(1, this.vy / 10))) - this.tilt) * 0.15;
    const bx = this.x + LEAD, G = this.level.gates;
    this.level.ensure(bx + AHEAD);

    if (this.y > CEIL) { this.y = CEIL; if (this.vy > 0) this.vy = 0; }

    while (G[this.gi] && G[this.gi].x < bx - 3) this.gi++;
    for (let k = this.gi; k < this.gi + 4 && G[k]; k++) {
      const g = G[k];
      const l = g.x - PIPE_W / 2 - BIRD_R * 0.8, r = g.x + PIPE_W / 2 + BIRD_R * 0.8;
      if (bx > l && bx < r) {
        const top = g.cy + g.gap / 2 - BIRD_R * 0.85;
        const bot = g.cy - g.gap / 2 + BIRD_R * 0.85;
        if (this.y > top || this.y < bot) return this.lose('pipe');
      }
      if (!g.passed && bx > g.x + PIPE_W / 2) {
        g.passed = true; this.passed++; this.score += 100 * (1 + this.tier);
        this.events.push({ type: 'gate', i: g.i });
      }
      if (!g.coinTaken && Math.abs(bx - g.x) < 0.7 && Math.abs(this.y - g.cy) < 0.95) {
        g.coinTaken = true; this.coins++; this.score += 50 * (1 + this.tier);
        this.events.push({ type: 'coin', i: g.i });
        if (this.tier < TIERS.length && this.coins >= TIERS[this.tier]) { this.tier++; this.events.push({ type: 'xform', tier: this.tier }); }
      }
    }
    if (this.y - BIRD_R <= FLOOR) { this.y = FLOOR + BIRD_R; return this.lose('ground'); }
  }
  lose(cause) {
    this.status = 'lost'; this.cause = cause;
    this.events.push({ type: 'lose', cause });
  }
  /** absolute level-space x of the bird */
  get bx() { return this.x + LEAD; }
}
Sim.prototype.hover = 0;
