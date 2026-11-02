import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Btn, Key } from '../components/ui.jsx';
import { Arena, ARENA_FORMS, ARENA_STATS } from '../game/arena.js';
import { sfx, vibrate, startMusic } from '../sfx.js';

const ART = `${import.meta.env.BASE_URL}art/`;

export default function Game({ state, dispatch }) {
  const N = Math.max(1, state.attempts || 1);
  const canvasRef = useRef(), arenaRef = useRef(), phoneRef = useRef(), heldKeys = useRef({});
  const endedRef = useRef(false), recordsRef = useRef([]);
  const [attempt, setAttempt] = useState(1);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const [end, setEnd] = useState(null);
  const [toast, setToast] = useState(null);
  const [ui, setUi] = useState({ status: 'ready', hp: 100, maxHp: 100, score: 0, kills: 0, wave: 1, charge: 0, form: 'ben', tier: 0 });

  const begin = () => {
    if (started) return;
    startMusic();
    setStarted(true);
    arenaRef.current?.start();
  };

  const resetAttempt = seed => {
    endedRef.current = false;
    setEnd(null);
    setPaused(false);
    setStarted(false);
    setUi({ status: 'ready', hp: 100, maxHp: 100, score: 0, kills: 0, wave: 1, charge: 0, form: 'ben', tier: 0 });
    const old = arenaRef.current;
    old?.stop();
    const arena = new Arena(canvasRef.current, {
      seed,
      pixel: state.settings.pixel,
      onState: next => {
        const stats = ARENA_STATS[next.form || 'ben'];
        const tier = next.charge >= 30 ? 3 : next.charge >= 18 ? 2 : next.charge >= 8 ? 1 : 0;
        setUi({ ...next, maxHp: next.maxHp || stats.maxHp, tier });
        if (next.status === 'lost' && !endedRef.current) {
          endedRef.current = true;
          sfx.crash(); vibrate([40, 30, 80]);
          const record = {
            score: next.score,
            kills: next.kills,
            wave: next.wave,
            charge: next.charge,
            form: next.form,
          };
          recordsRef.current.push(record);
          const n = recordsRef.current.length;
          const best = Math.max(...recordsRef.current.map(r => r.score));
          setTimeout(() => setEnd({ ...record, n, best, last: n >= N }), 700);
        }
      },
    });
    arenaRef.current = arena;
  };

  useEffect(() => {
    resetAttempt(state.seed);
    return () => arenaRef.current?.stop();
  }, [state.seed]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  const switchForm = form => {
    const arena = arenaRef.current;
    if (!arena || paused || end) return;
    const index = ARENA_FORMS.indexOf(form);
    const required = [0, 8, 18, 30][index];
    if (arena.charge < required) {
      setToast(`Collect ${required} watch charge to unlock ${ARENA_STATS[form].name}.`);
      return;
    }
    if (arena.setForm(form)) {
      sfx.win(); vibrate(30);
      setToast(`${ARENA_STATS[form].name} selected`);
    }
  };

  const setPause = value => {
    if (value && !started) return;
    arenaRef.current?.pause(value);
    setPaused(value);
  };

  const attack = () => {
    begin();
    arenaRef.current?.attack();
  };

  const nextAttempt = () => {
    if (!end || end.last) return;
    const seed = 1 + Math.floor(Math.random() * 999999);
    setAttempt(a => a + 1);
    resetAttempt(seed);
  };

  const report = () => {
    const records = recordsRef.current;
    const top = records.reduce((best, record) => record.score > best.score ? record : best, records[0]);
    const highestTier = Math.max(...records.map(r => r.charge >= 30 ? 3 : r.charge >= 18 ? 2 : r.charge >= 8 ? 1 : 0));
    dispatch({
      type: 'finish',
      won: top.kills > 0 && top.wave >= 3,
      score: top.score,
      attempts: N,
      run: { passed: top.kills, coins: top.charge, cause: 'arena-defeat', tier: highestTier, scores: records.map(r => r.score), wave: top.wave },
    });
    dispatch({ type: 'go', screen: 'results' });
  };

  useEffect(() => {
    const keydown = event => {
      heldKeys.current[event.code] = true;
      if (arenaRef.current) arenaRef.current.keys[event.code] = true;
      if ((event.code === 'Space' || event.code === 'KeyF') && !event.repeat) { event.preventDefault(); attack(); }
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') arenaRef.current?.dash();
      if (event.code === 'KeyP') setPause(!paused);
      if (/^Digit[1-4]$/.test(event.code)) switchForm(ARENA_FORMS[Number(event.code.slice(-1)) - 1]);
      if (event.key === 'Enter' && end?.last) report();
      if (event.key === 'r' && end && !end.last) nextAttempt();
    };
    const keyup = event => {
      heldKeys.current[event.code] = false;
      if (arenaRef.current) arenaRef.current.keys[event.code] = false;
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); };
  });

  const pointer = event => {
    if (event.target.closest?.('button,.arena-ui')) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const arena = arenaRef.current;
    if (!arena) return;
    arena.pointer.x = (event.clientX - rect.left) * arena.w / rect.width;
    arena.pointer.y = (event.clientY - rect.top) * arena.h / rect.height;
  };

  const pointerDown = event => {
    if (event.target.closest?.('button,.arena-ui')) return;
    pointer(event);
    begin();
    arenaRef.current.pointer.down = true;
    arenaRef.current.attack();
  };
  const pointerUp = () => { if (arenaRef.current) arenaRef.current.pointer.down = false; };
  const movePad = (code, value) => {
    begin();
    if (arenaRef.current) arenaRef.current.keys[code] = value;
  };

  return (
    <div className="arena-page" ref={phoneRef}>
      <div className="arena-stage" onPointerMove={pointer} onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerLeave={pointerUp}>
        <canvas ref={canvasRef} className="arena-canvas" aria-label="Alien arena fight" />
        <div className="arena-hud arena-ui">
          <div className="arena-top">
            <div>
              <span className="arena-label">WAVE {ui.wave}</span>
              <div className="arena-health"><i style={{ width: `${100 * ui.hp / ui.maxHp}%` }} /></div>
            </div>
            <div className="arena-score"><span>ATTACKS</span><b>{ui.score.toLocaleString()}</b></div>
            <button className="arena-icon-btn" onPointerDown={e => e.stopPropagation()} onClick={() => setPause(!paused)} aria-label={paused ? 'Resume' : 'Pause'}>{paused ? '▶' : '❚❚'}</button>
          </div>
        </div>

        {!started && !end && (
          <motion.div className="arena-start arena-ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="arena-kicker">ALIEN INCURSION</p>
            <h1>Defend the city</h1>
            <p>WASD or arrows to move. Mouse or touch to aim and attack.</p>
            <Btn variant="play" className="block" onClick={e => { e.stopPropagation(); begin(); }}>Enter arena</Btn>
          </motion.div>
        )}

        <AnimatePresence>{toast && <motion.div className="arena-toast arena-ui" initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>{toast}</motion.div>}</AnimatePresence>

        <div className="arena-form-bar arena-ui">
          {ARENA_FORMS.map((form, index) => {
            const required = [0, 8, 18, 30][index];
            return <button key={form} className={`arena-form ${ui.form === form ? 'active' : ''}`} disabled={ui.charge < required} onPointerDown={e => e.stopPropagation()} onClick={() => switchForm(form)}>
              <img src={`${ART}${form}.png`} alt={ARENA_STATS[form].name} />
              <span>{index + 1}</span>
              <small>{required ? `${ui.charge}/${required}` : 'READY'}</small>
            </button>;
          })}
        </div>

        <div className="arena-mobile-controls arena-ui">
          <div className="arena-pad">
            {['KeyW', 'KeyA', 'KeyS', 'KeyD'].map(code => <button key={code} className={code} aria-label={code} onPointerDown={e => { e.stopPropagation(); movePad(code, true); }} onPointerUp={e => { e.stopPropagation(); movePad(code, false); }} onPointerLeave={() => movePad(code, false)} />)}
          </div>
          <button className="arena-attack" onPointerDown={e => { e.stopPropagation(); attack(); }}><span>HIT</span></button>
        </div>

        {paused && !end && (
          <div className="arena-overlay arena-ui">
            <div className="arena-sheet"><h2>Paused</h2><Btn variant="play" className="block" onClick={() => setPause(false)}>Resume</Btn><Btn variant="slate" className="block" onClick={() => dispatch({ type: 'reset' })}>Menu</Btn></div>
          </div>
        )}

        <AnimatePresence>{end && (
          <motion.div className="arena-overlay arena-ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div className="arena-sheet" initial={{ scale: .86, y: 20 }} animate={{ scale: 1, y: 0 }}>
              <p className="arena-kicker">{end.last ? 'CITY DEFENSE ENDED' : `ATTEMPT ${end.n} LOST`}</p>
              <h2>{end.score.toLocaleString()}</h2>
              <p>{end.kills} drones defeated · Wave {end.wave}</p>
              <p className="arena-mut">Best this mission: {end.best.toLocaleString()}</p>
              {end.last ? <Btn variant="play" className="block" onClick={report}>Mission report</Btn> : <Btn variant="play" className="block" onClick={nextAttempt}>Next attempt <Key>R</Key></Btn>}
            </motion.div>
          </motion.div>)}</AnimatePresence>
      </div>
    </div>
  );
}
