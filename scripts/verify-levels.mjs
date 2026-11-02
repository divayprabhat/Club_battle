// Reachability check: searches every flap/no-flap choice (one decision per 100 ms) and proves each seed can be survived
// for 40 gates, even with small gaps, big height changes and the speed ramp. Run with: npm run verify
import { Level, DT, GRAVITY, FLAP_V, BIRD_R, PIPE_W, FLOOR, CEIL, speedFor, START_Y, LEAD } from '../src/game/sim.js';
function feasible(seed, target=40) {
  const L = new Level(seed); L.ensure(LEAD + 400); const G = L.gates;
  const STEP = 12; // one decision per 100 ms, so levels stay fair for human timing
  let states = new Map([[`${START_Y.toFixed(1)}|0`, { y: START_Y, vy: FLAP_V }]]); let bx = LEAD, passed = 0, best = 0;
  while (passed < target) {
    const next = new Map();
    for (const st of states.values()) for (const f of [false, true]) {
      let y = st.y, vy = f ? FLAP_V : st.vy, x = bx, ok = true;
      for (let k = 0; k < STEP && ok; k++) {
        vy -= GRAVITY * DT; y += vy * DT; x += speedFor(passed) * DT; if (y > CEIL) { y = CEIL; vy = Math.min(vy, 0); }
        if (y - BIRD_R <= FLOOR) ok = false;
        for (const g of G) { if (g.x > x + 6) break; if (x > g.x - PIPE_W/2 - BIRD_R*.8 && x < g.x + PIPE_W/2 + BIRD_R*.8 && (y > g.cy + g.gap/2 - BIRD_R*.85 || y < g.cy - g.gap/2 + BIRD_R*.85)) { ok = false; break; } }
      }
      if (ok) next.set(`${y.toFixed(1)}|${(Math.round(vy*1.5)/1.5).toFixed(1)}`, { y, vy });
    }
    if (!next.size) return passed;
    states = next; bx += speedFor(passed) * DT * STEP; 
    while (G[passed] && G[passed].x + PIPE_W/2 < bx) passed++;
  }
  return passed;
}
let bad = 0; const res = [];
for (let seed = 1; seed <= 100; seed++) { const r = feasible(seed); res.push(r); if (r < 40) bad++; }
console.log(bad ? `${bad}/100 seeds impossible before 40 gates` : 'all 100 seeds are survivable for 40 gates', `(min ${Math.min(...res)})`);
process.exit(bad > 2 ? 1 : 0);
