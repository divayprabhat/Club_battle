const get = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
import { makeRound } from './data.js';
export const DEFAULT_SETTINGS = { sfx: true, music: true, pixel: 3 };

export const initial = () => ({
  ...makeRound(), screen: 'home', warp: null, correct: 0, answers: [], attempts: 0, seed: 1 + Math.floor(Math.random() * 9999),
  run: null, won: false, score: 0,
  best: get('nth-best', 0), bestScore: get('nth-best-score', 0),
  runs: get('nth-runs', []), settings: { ...DEFAULT_SETTINGS, ...get('nth-settings', {}) },
});

export function reducer(s, a) {
  switch (a.type) {
    case 'go': return { ...s, screen: a.screen };
    case 'warp': return s.warp ? s : { ...s, warp: a.to };
    case 'warpDone': return { ...s, screen: s.warp ?? s.screen, warp: null };
    case 'answer': return { ...s, correct: s.correct + (a.ok ? 1 : 0), answers: [...s.answers, a.ok] };
    case 'budget': return { ...s, attempts: s.correct, screen: 'budget' };
    case 'finish': {
      const best = Math.max(s.best, s.correct), bestScore = Math.max(s.bestScore, a.score);
      const runs = a.score > 0 ? [...s.runs, { score: a.score, attempts: a.attempts, won: a.won, at: Date.now() }].sort((x, y) => y.score - x.score).slice(0, 8) : s.runs;
      set('nth-best', best); set('nth-best-score', bestScore); set('nth-runs', runs);
      return { ...s, won: a.won, score: a.score, run: a.run, best, bestScore, runs };
    }
    case 'settings': { const settings = { ...s.settings, ...a.patch }; set('nth-settings', settings); return { ...s, settings }; }
    case 'clearScores': set('nth-best', 0); set('nth-best-score', 0); set('nth-runs', []); return { ...s, best: 0, bestScore: 0, runs: [] };
    case 'reset': return { ...initial(), best: s.best, bestScore: s.bestScore, runs: s.runs, settings: s.settings, screen: a.screen ?? 'home' };
    default: return s;
  }
}
