import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Btn, Key } from '../components/ui.jsx';
import { useKey, fmt } from '../components/Chrome.jsx';
import Watch from '../components/Watch.jsx';
import { startMusic, sfx } from '../sfx.js';

const Sheet = ({ title, onClose, children }) => createPortal(
  <motion.div className="sheet-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="sheet" role="dialog" aria-label={title} onClick={e => e.stopPropagation()} initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
      <div className="sheet-head"><h3>{title}</h3><button className="round-btn" onClick={onClose} aria-label="Close">✕</button></div>{children}
    </motion.div>
  </motion.div>, document.body
);
const Toggle = ({ label, on, onChange, hint }) => (
  <button className="toggle" role="switch" aria-checked={on} onClick={() => onChange(!on)}><span><b>{label}</b>{hint && <small>{hint}</small>}</span><i className={on ? 'on' : ''} /></button>
);

export function Home({ state, dispatch }) {
  const [sheet, setSheet] = useState(null);
  const go = screen => { startMusic(); dispatch({ type: 'go', screen }); };
  const warp = screen => { startMusic(); sfx.good(); dispatch({ type: 'warp', to: screen }); };
  useKey([' ', 'Enter'], () => !sheet && warp('quiz'), [sheet]);
  const { settings: st, runs } = state;
  return (
    <div className="home">
      <div className="title-block">
        <h1 aria-label="The Nth Move"><span>The</span><span className="big">Nth</span><span>Move</span></h1>
        <p className="tagline">Verify the signal. Earn your attempts.</p>
      </div>
      <div className="menu-card">
        <div className="watch-wrap"><Watch onPress={() => warp('quiz')} /><span className="watch-label">PLAY</span></div>
        <div className="menu-grid">
          <Btn variant="slate" onClick={() => go('how')}>How to</Btn>
          <Btn variant="slate" onClick={() => setSheet('scores')}>Scores</Btn>
          <Btn variant="slate" className="span2" onClick={() => setSheet('options')}>Options</Btn>
        </div>
        <p className="press-hint"><span className="only-keys">press <Key wide>SPACE</Key> or tap the watch</span><span className="only-touch">tap the watch to start</span></p>
      </div>
      <AnimatePresence>
        {sheet === 'scores' && <Sheet title="Best runs" onClose={() => setSheet(null)}>
          {runs.length === 0 ? <p className="muted">No runs yet. Finish a mission to set a score.</p> :
            <ol className="board">{runs.map((r, i) => <li key={r.at}><span className="rank">{i + 1}</span><b>{fmt(r.score)}</b><span>{r.attempts ?? r.moves} attempts</span><span className={r.won ? 'ok' : 'bad'}>{r.won ? 'charged' : 'played'}</span></li>)}</ol>}
          {runs.length > 0 && <button className="text-btn" onClick={() => dispatch({ type: 'clearScores' })}>Clear scores</button>}
        </Sheet>}
        {sheet === 'options' && <Sheet title="Options" onClose={() => setSheet(null)}>
          <Toggle label="Sound effects" on={st.sfx} onChange={v => dispatch({ type: 'settings', patch: { sfx: v } })} />
          <Toggle label="Music" on={st.music} onChange={v => { dispatch({ type: 'settings', patch: { music: v } }); if (v) startMusic(); }} />
          <div className="seg" role="radiogroup" aria-label="Pixel size"><span><b>Pixel size</b><small>Chunkier is faster on older phones</small></span>
            {[[2, 'Fine'], [3, 'Normal'], [4, 'Chunky']].map(([v, t]) => <button key={v} role="radio" aria-checked={st.pixel === v} className={st.pixel === v ? 'on' : ''} onClick={() => dispatch({ type: 'settings', patch: { pixel: v } })}>{t}</button>)}</div>
        </Sheet>}
      </AnimatePresence>
    </div>
  );
}

const STEPS = [
  ['Verify', 'Answer five randomized Real or AI questions. Each correct label earns one attempt.'],
  ['Fight', 'Move around the city arena and destroy incoming alien drones. Aim and attack with mouse or touch. Switch between Ben and unlocked alien forms, each with different speed, armor, and attack power. Waves become harder until your health reaches zero.'],
];
export function How({ dispatch }) {
  return (
    <div className="card page">
      <h2>How to play</h2>
      <ol className="steps">{STEPS.map(([t, d], i) => <motion.li key={t} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .08 * i }}><b>{t}</b><span>{d}</span></motion.li>)}</ol>
      <p className="muted small">Educational prototype. The sample labels are curated, not a real AI detector.</p>
      <Btn variant="play" onClick={() => dispatch({ type: 'go', screen: 'home' })}>Got it</Btn>
    </div>
  );
}
