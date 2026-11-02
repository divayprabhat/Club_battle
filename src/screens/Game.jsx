import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Btn, Key, Avatar, Hearts } from '../components/ui.jsx';
import { fmt } from '../components/Chrome.jsx';
import { sfx, vibrate, startMusic } from '../sfx.js';
import { World } from '../game/world.js';
import { Sim, TIERS, FORMS } from '../game/sim.js';

const ART = `${import.meta.env.BASE_URL}art/`;
const SIZE = { ben: 1.45, xlr8: 1.25, alien3: 1.55, alien4: 1.4 };
const heroClass = f => (f === 'ben' ? 'ben' : `xlr8 ${f}`);
const MSG = { pipe: 'You clipped a pipe.', ground: 'You hit the ground.' };
const doc = typeof document !== 'undefined' ? document : null;
const isFs = () => !!(doc?.fullscreenElement || doc?.webkitFullscreenElement);
const enterFs = () => { try { const el = doc.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {}); } catch {} };
const exitFs = () => { try { (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc)?.catch?.(() => {}); } catch {} };

export default function Game({ state, dispatch }) {
  const N = Math.max(1, state.attempts || 1);
  const cv = useRef(), phoneRef = useRef(), chargeRef = useRef(), heroRef = useRef(), formRef = useRef('ben'), posRef = useRef({ x: 0, y: 0 });
  const simRef = useRef(), worldRef = useRef(), pausedRef = useRef(false), endedRef = useRef(false), recsRef = useRef([]), fsTried = useRef(false);
  const [ui, setUi] = useState({ status: 'ready', passed: 0, coins: 0, score: 0, tier: 0 }), [attempt, setAttempt] = useState(1), [bestSoFar, setBest] = useState(0), [fs, setFs] = useState(false);
  const [paused, setPaused] = useState(false), [end, setEnd] = useState(null), [fail, setFail] = useState(false), [toast, setToast] = useState(null);
  const [form, setFormState] = useState('ben'), [charged, setCharged] = useState(0), [fly, setFly] = useState([]), [flash, setFlash] = useState(null);
  const setForm = f => { formRef.current = f; setFormState(f); };
  const land = id => { setFly(l => l.filter(c => c.id !== id)); setCharged(c => c + 1); sfx.click(); };

  const onEvents = useCallback((evs, sim) => {
    for (const e of evs) {
      if (e.type === 'flap') sfx.flap();
      if (e.type === 'gate') sfx.gate();
      if (e.type === 'coin') {
        sfx.coin();
        const ph = phoneRef.current?.getBoundingClientRect(), ch = chargeRef.current?.getBoundingClientRect();
        if (ph && ch) setFly(l => [...l, { id: Math.random(), sx: posRef.current.x, sy: posRef.current.y, tx: ch.left - ph.left + ch.width / 2, ty: ch.top - ph.top + ch.height / 2 }]);
        else setCharged(c => c + 1);
      }
      if (e.type === 'xform') { sfx.win(); vibrate(30); setForm(FORMS[e.tier]); setFlash({ k: Math.random(), ...posRef.current }); setToast(`Watch power ${e.tier + 1}. Transformed! Points x${e.tier + 1}`); }
      if (e.type === 'lose') { sfx.crash(); vibrate([40, 30, 80]); }
      if (e.type === 'start') setToast(null);
    }
    setUi({ status: sim.status, passed: sim.passed, coins: sim.coins, score: sim.score, tier: sim.tier });
    if (sim.status === 'lost' && !endedRef.current) {
      endedRef.current = true;
      const rec = { score: sim.score, passed: sim.passed, coins: sim.coins, cause: sim.cause, tier: sim.tier };
      recsRef.current.push(rec);
      const n = recsRef.current.length, best = Math.max(...recsRef.current.map(r => r.score));
      setBest(best);
      setTimeout(() => setEnd({ ...rec, n, best, last: n >= N }), 1100);
    }
  }, [N]);

  useEffect(() => {
    const sim = new Sim(state.seed); simRef.current = sim; let w;
    try {
      w = new World(cv.current, { pixel: state.settings.pixel, mode: 'game', onBird: b => {
        const el = heroRef.current; if (!el) return; posRef.current = { x: b.x, y: b.y };
        const xl = formRef.current !== 'ben', h = (SIZE[formRef.current] ?? 1.4) * b.ppu, sq = 1 - (1 - b.flap) * .08, st = 1 + (1 - b.flap) * .1;
        el.style.height = `${h}px`; el.style.visibility = 'visible';
        el.style.transform = `translate(${b.x}px,${b.y}px) translate(-50%,-52%) rotate(${xl ? -b.rot * .4 : -b.rot}rad) scale(${sq},${st})`;
      }, onFrame: dt => {
        if (pausedRef.current) return; sim.advance(dt);
        const evs = sim.events.splice(0); if (evs.length) { w.handle(evs); onEvents(evs, sim); }
      } });
      w.setMode('game'); w.loadLevel(sim); w.start(); worldRef.current = w;
      if (new URLSearchParams(location.search).has('debug')) window.__nth = { sim, world: w };
    } catch (err) { console.warn(err); setFail(true); }
    return () => w?.dispose();
  }, [state.seed]); // eslint-disable-line

  useEffect(() => {
    const f = () => setFs(isFs()); doc.addEventListener('fullscreenchange', f); doc.addEventListener('webkitfullscreenchange', f);
    return () => { doc.removeEventListener('fullscreenchange', f); doc.removeEventListener('webkitfullscreenchange', f); if (isFs()) exitFs(); };
  }, []);
  const toggleFs = () => (isFs() ? exitFs() : enterFs());

  const flap = useCallback(() => {
    const s = simRef.current; if (!s || pausedRef.current || end) return;
    if (!fsTried.current) { fsTried.current = true; if (!isFs()) enterFs(); }
    if (s.status === 'ready') startMusic();
    s.flap(); const evs = s.events.splice(0);
    if (evs.length) { worldRef.current?.handle(evs); onEvents(evs, s); }
  }, [onEvents, end]);

  const setPause = v => { pausedRef.current = v; setPaused(v); if (worldRef.current) worldRef.current.paused = v; };
  // next attempt = a brand-new street (new seed); only offered while attempts remain
  const nextAttempt = () => {
    const s = simRef.current; if (!end || end.last) return;
    s.reset(1 + Math.floor(Math.random() * 999999)); worldRef.current.loadLevel(s); endedRef.current = false;
    setEnd(null); setToast(null); setPause(false); setForm('ben'); setCharged(0); setFly([]); setFlash(null); setAttempt(a => a + 1); setUi({ status: 'ready', passed: 0, coins: 0, score: 0, tier: 0 });
  };
  const report = () => {
    const recs = recsRef.current, top = recs.reduce((a, b) => (b.score > a.score ? b : a), recs[0]);
    const tier = Math.max(...recs.map(r => r.tier));
    dispatch({ type: 'finish', won: tier > 0, score: top.score, attempts: N, run: { passed: top.passed, coins: top.coins, cause: top.cause, tier, scores: recs.map(r => r.score) } });
    dispatch({ type: 'go', screen: 'results' });
  };

  useEffect(() => {
    const h = e => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { if (/BUTTON/.test(e.target.tagName) && e.key === ' ') return; e.preventDefault(); if (!e.repeat) flap(); }
      if (e.key === 'p' || e.key === 'P') { if (ui.status === 'playing' || paused) setPause(!pausedRef.current); }
      if ((e.key === 'r' || e.key === 'R') && end && !end.last) nextAttempt();
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });
  useEffect(() => { const v = () => { if (document.hidden && simRef.current?.status === 'playing') setPause(true); }; document.addEventListener('visibilitychange', v); return () => document.removeEventListener('visibilitychange', v); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);

  const score = ui.score, left = N - attempt + 1;
  const wt = TIERS.filter(t => charged >= t).length, maxed = wt >= TIERS.length, lo = wt ? TIERS[wt - 1] : 0, hi = TIERS[Math.min(wt, TIERS.length - 1)], full = maxed;
  const wpct = maxed ? 1 : (charged - lo) / (hi - lo);
  return (
    <div className="game-page">
      <div className="phone" ref={phoneRef} onPointerDown={e => { if (e.target.closest('button,.sheet')) return; flap(); }}>
        <div className="stage"><canvas ref={cv} aria-label="Flappy Bird style game. Press space or tap to flap." role="img" /></div>
        <div className="hero-pos" ref={heroRef} aria-hidden="true"><img key={form} className={`hero-sprite ${heroClass(form)}`} src={`${ART}${form}.png`} alt="" draggable="false" /></div>
        {flash && <motion.div key={flash.k} className="xform-flash" style={{ left: flash.x, top: flash.y }} initial={{ opacity: .95, scale: .2 }} animate={{ opacity: 0, scale: 4 }} transition={{ duration: .8 }} />}
        {fly.map(c => <motion.i key={c.id} className="fly-coin" initial={{ x: c.sx, y: c.sy, scale: 1 }} animate={{ x: c.tx, y: c.ty, scale: .45 }} transition={{ duration: .7, ease: 'easeIn' }} onAnimationComplete={() => land(c.id)} />)}
        {fail && <div className="overlay"><div className="card center"><h3>3D is unavailable</h3><p className="muted">Your browser blocked WebGL. Try Chrome or Safari, or turn on hardware acceleration.</p><Btn variant="slate" onClick={() => dispatch({ type: 'reset' })}>Menu</Btn></div></div>}
        <div className="game-hud">
          <div className="hud-row"><div className="player"><Avatar size={34} /><span className="player-name">AGENT</span></div>
            <div className="trophy"><span aria-hidden="true">🏆</span><b>{fmt(score)}</b>{ui.tier > 0 && <i className="mult">x{ui.tier + 1}</i>}</div>
            <div ref={chargeRef} className={`charge ${full ? 'full' : ''}`} role="img" aria-label={`Watch power ${wt + 1} of ${TIERS.length + 1}, ${charged} coins`}>
              <img className="charge-base" src={`${ART}omnitrix.png`} alt="" /><img className="charge-lit" src={`${ART}omnitrix.png`} alt="" style={{ clipPath: `inset(0 ${100 - wpct * 100}% 0 0)` }} />
              <b key={`${wt}-${charged}`} className="bump">{maxed ? 'MAX' : `Lv${wt + 1} ${charged}/${hi}`}</b></div></div>
          <div className="flap-row"><span className="flap-label">Attempt {attempt}/{N}</span><Hearts total={N} left={left} label="attempts" />
            <span className="flap-label best">Best {fmt(Math.max(bestSoFar, 0))}</span>
            <button className="round-btn" style={{ marginLeft: 'auto' }} onClick={toggleFs} aria-label={fs ? 'Exit full screen' : 'Full screen'}>{fs ? '⤢' : '⛶'}</button>
            <button className="round-btn" onClick={() => setPause(true)} aria-label="Pause" disabled={ui.status !== 'playing'}>❚❚</button></div>
        </div>
        <AnimatePresence>{ui.status === 'ready' && !end && !fail && (
          <motion.div className="ready-prompt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="only-keys">press <Key wide>SPACE</Key> to start</p><p className="only-touch">tap anywhere to start</p>
            <p className="rule">Attempt {attempt} of {N}. Fly through as many gates as you can. Your highest score counts.</p>
          </motion.div>)}</AnimatePresence>
        <AnimatePresence>{toast && <motion.div className="toast" initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>{toast}</motion.div>}</AnimatePresence>
        <AnimatePresence>{paused && !end && (
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><div className="card center"><h3>Paused</h3>
            <Btn variant="play" className="block" onClick={() => setPause(false)} autoFocus>Resume</Btn>
            <div className="row"><Btn variant="slate" onClick={() => dispatch({ type: 'reset' })}>Menu</Btn></div></div></motion.div>)}</AnimatePresence>
        <AnimatePresence>{end && (
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div className="card center end-card" initial={{ scale: .85, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
              <h2 className={end.last ? 'win' : 'lose'}>{end.last ? 'All attempts used' : `Attempt ${end.n} of ${N} over`}</h2>
              <div className="score-big sm">{fmt(end.score)}</div>
              <p className="muted">{MSG[end.cause] ?? ''} {end.tier > 0 ? `Watch power reached level ${end.tier + 1}. ` : ''}{end.last ? `Your highest score: ${fmt(end.best)}.` : `Best so far ${fmt(end.best)}. ${N - end.n} attempt${N - end.n > 1 ? 's' : ''} left.`}</p>
              {end.last ? <Btn variant="play" className="block" onClick={report} autoFocus>Mission report</Btn>
                : <Btn variant="play" className="block" onClick={nextAttempt} autoFocus>Next attempt <Key>R</Key></Btn>}
              <div className="row"><Btn variant="slate" onClick={() => dispatch({ type: 'reset' })}>Menu</Btn></div>
            </motion.div></motion.div>)}</AnimatePresence>
      </div>
    </div>
  );
}
