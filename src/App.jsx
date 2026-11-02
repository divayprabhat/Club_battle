import { Component, useEffect, useReducer, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { reducer, initial } from './store.js';
import { configure } from './sfx.js';
import { TopHud } from './components/Chrome.jsx';
import Backdrop from './components/Backdrop.jsx';
import { Home, How } from './screens/Home.jsx';
import Quiz from './screens/Quiz.jsx';
import { Budget, Results } from './screens/Report.jsx';
import Game from './screens/Game.jsx';

class Boundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', zIndex: 200, background: '#120c1f' }}>
      <div><h3 style={{ font: '14px var(--f-ui)', color: '#ff5c7a', marginBottom: 12 }}>Something broke</h3>
        <p className="muted small" style={{ marginBottom: 16 }}>{String(this.state.err?.message || this.state.err)}</p>
        <button className="text-btn" onClick={() => { this.setState({ err: null }); this.props.onReset(); }}>Back to menu</button></div></div>;
  }
}
const Warp = ({ onDone }) => (
  <motion.div
    className="guess-intro"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: .2 }}
  >
    <motion.img
      className="guess-alien"
      src={`${import.meta.env.BASE_URL}art/guess-alien.png`}
      alt="Animated alien character"
      initial={{ scale: .35, x: 180, rotate: 8, opacity: 0 }}
      animate={{ scale: [1, 1.08, 1], x: [180, 0, 0], rotate: [8, 0, -2], opacity: 1 }}
      transition={{ duration: 1.4, times: [0, .55, 1], ease: 'easeOut' }}
      onAnimationComplete={onDone}
    />
    <motion.div
      className="guess-copy"
      initial={{ y: 50, scale: .8, opacity: 0 }}
      animate={{ y: 0, scale: [1, 1.06, 1], opacity: 1 }}
      transition={{ delay: .25, duration: .75 }}
    >
      <span>CAN YOU</span>
      <strong>GUESS IT?</strong>
    </motion.div>
    <motion.div className="guess-scan" initial={{ y: '-100%' }} animate={{ y: '100%' }} transition={{ delay: .5, duration: 1.2, ease: 'linear' }} />
  </motion.div>
);
const SCREENS = { home: Home, how: How, quiz: Quiz, budget: Budget, game: Game, results: Results };
function Root() {
  const [state, dispatch] = useReducer(reducer, undefined, initial);
  const Screen = SCREENS[state.screen], inGame = state.screen === 'game';
  useEffect(() => { configure(state.settings); }, [state.settings]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [state.screen]);
  return (
    <MotionConfig reducedMotion="user">
      {inGame ? <Game key={state.seed + ':' + state.attempts} state={state} dispatch={dispatch} /> : <>
        <Backdrop />
        <main className="shell">
          <TopHud state={state} dispatch={dispatch} />
          <AnimatePresence mode="wait">
            <motion.section key={state.screen} className="screen" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .2 }}>
              <Screen state={state} dispatch={dispatch} />
            </motion.section>
          </AnimatePresence>
        </main></>}
      {state.warp && <Warp key="warp" onDone={() => dispatch({ type: 'warpDone' })} />}
    </MotionConfig>
  );
}

export default function App() {
  const [k, setK] = useState(0);
  return <Boundary key={k} onReset={() => setK(n => n + 1)}><Root /></Boundary>;
}
