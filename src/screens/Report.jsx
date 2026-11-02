import { useEffect, useState } from 'react';
import { animate, motion } from 'framer-motion';
import { Btn, Hearts } from '../components/ui.jsx';
import { fmt, useKey } from '../components/Chrome.jsx';
import { TIPS } from '../data.js';
import { FORMS, TIERS } from '../game/sim.js';

export function Budget({ state, dispatch }) {
  const n = state.attempts, [v, setV] = useState(0), low = n < 1;
  useEffect(() => { const a = animate(0, n, { duration: .9, ease: 'easeOut', onUpdate: x => setV(Math.round(x)) }); return () => a.stop(); }, [n]);
  useKey([' ', 'Enter'], () => (low ? dispatch({ type: 'reset', screen: 'research' }) : dispatch({ type: 'go', screen: 'game' })), [low]);
  return (
    <div className="card page center">
      <h2>Your attempts</h2>
      <motion.div className="big-number" initial={{ scale: .4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}>{v}</motion.div>
      <div className="pips big">{state.answers.map((a, i) => <motion.i key={i} className={a ? 'ok' : 'bad'} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: .1 * i + .2 }} />)}</div>
      {low ? <p className="warn">You earned no attempts. Get at least one sample right to play. Restart and verify again.</p>
        : <><p className="muted">You labelled {n} of {state.answers.length} samples correctly. That is {n} attempt{n > 1 ? 's' : ''}.</p>
          <p className="small muted">Each attempt is a fresh endless run with unlimited flaps. A crash ends it. Only your highest score counts.</p></>}
      {low ? <Btn variant="play" className="block" onClick={() => dispatch({ type: 'reset', screen: 'research' })}>Restart mission</Btn>
        : <Btn variant="play" className="block" onClick={() => dispatch({ type: 'go', screen: 'game' })} autoFocus>Start attempt 1</Btn>}
    </div>
  );
}

export function Results({ state, dispatch }) {
  const { won, correct, answers, bestScore, score, run } = state, total = answers.length || 6, form = FORMS[run?.tier ?? 0] ?? 'ben';
  const tip = TIPS[score % TIPS.length], newBest = score > 0 && score >= bestScore;
  useKey([' ', 'Enter'], () => dispatch({ type: 'reset', screen: 'research' }), []);
  return (
    <div className="card page center">
      <img className={`result-hero ${form === 'ben' ? 'ben' : 'xlr8'}`} src={`${import.meta.env.BASE_URL}art/${form}.png`} alt={won ? 'The hero transformed' : 'The hero'} />
      <h2 className={won ? 'win' : 'lose'}>{won ? `Watch power level ${(run?.tier ?? 0) + 1}` : (correct === total ? 'Perfect verification' : 'Mission complete')}</h2>
      <p className="muted small">Highest score of {correct} attempt{correct > 1 ? 's' : ''}</p>
      <motion.div className="score-big" initial={{ scale: .5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220 }}>{fmt(score)}</motion.div>
      {newBest && <p className="newbest">New best score</p>}
      <dl className="stats">
        <div><dt>Gates</dt><dd>{run?.passed ?? 0}</dd></div><div><dt>Coins</dt><dd>{run?.coins ?? 0}</dd></div>
        <div><dt>Attempts</dt><dd>{correct}</dd></div><div><dt>All-time best</dt><dd>{fmt(bestScore)}</dd></div>
      </dl>
      {run?.scores?.length > 1 && <p className="small muted">Attempt scores: {run.scores.map(fmt).join(' · ')}</p>}
      <p className="muted">{won ? 'More coins in one attempt power up the watch, change your form and multiply your points.' : `Collect ${TIERS[0]} coins in a single attempt to power up the watch and transform.`}</p>
      <p className="tip">Takeaway: {tip}</p>
      <Btn variant="play" className="block" onClick={() => dispatch({ type: 'reset', screen: 'research' })} autoFocus>New mission</Btn>
      <div className="row"><Btn variant="slate" onClick={() => dispatch({ type: 'reset' })}>Menu</Btn></div>
    </div>
  );
}
