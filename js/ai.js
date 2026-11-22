import { fen, legalMoves, makeMove, unmakeMove, evaluate, inCheck, parseSquare } from './chess.js';

const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

const BOOK = {
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w': ['e2e4', 'd2d4', 'g1f3', 'c2c4'],
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b': ['e7e5', 'c7c5', 'c7c6', 'e7e6'],
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b': ['d7d5', 'g8f6', 'e7e6'],
  'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b': ['d7d5', 'g8f6', 'c7c5'],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w': ['g1f3', 'f1c4', 'b1c3'],
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w': ['g1f3', 'b1c3', 'c2c3'],
  'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w': ['d2d4', 'g1f3'],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b': ['b8c6', 'g8f6', 'd7d6'],
  'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w': ['c2c4', 'g1f3', 'b1c3'],
};

let deadline = Infinity;
let aborted = false;
let nodes = 0;
let cloud = 0;
let quietBudget = 8;

// Experience, in the manner of the USCF class scale. Weaker levels miss
// tactics on purpose: a shallow horizon, a cloudy evaluation, and the
// occasional move that merely looks fine.
export const LEVELS = [
  { id: 'e', name: 'Beginner', range: 'Under 1200', against: 'a beginner', blurb: 'Class E and below. Still learning the rules, and pieces get left behind.', depth: 1, ms: 50, book: false, slip: 0.62, noise: 90, qply: 0 },
  { id: 'd', name: 'Class D', range: '1200–1399', against: 'a class D player', blurb: 'Developing. Knows the principles, and spots some tactics.', depth: 2, ms: 120, book: false, slip: 0.2, noise: 35, qply: 1 },
  { id: 'c', name: 'Class C', range: '1400–1599', against: 'a class C player', blurb: 'A club player. Solid basics, and simple plans.', depth: 2, ms: 200, book: true, slip: 0.1, noise: 16, qply: 2 },
  { id: 'b', name: 'Class B', range: '1600–1799', against: 'a class B player', blurb: 'A strong club player. Tactics hold, and the endings begin.', depth: 3, ms: 320, book: true, slip: 0.04, noise: 6, qply: 4 },
  { id: 'a', name: 'Class A', range: '1800–1999', against: 'a class A player', blurb: 'An advanced amateur, with calculation and a sense of the position.', depth: 3, ms: 480, book: true, slip: 0.01, noise: 0, qply: 6 },
  { id: 'x', name: 'Expert', range: '2000–2199', against: 'an expert', blurb: 'A strong tournament player.', depth: 4, ms: 700, book: true, slip: 0, noise: 0, qply: 8 },
  { id: 'm', name: 'National Master', range: '2200–2399', against: 'a national master', blurb: 'Master level. Little is given away.', depth: 4, ms: 1400, book: true, slip: 0, noise: 0, qply: 8 },
  { id: 's', name: 'Senior Master', range: '2400+', against: 'a senior master', blurb: 'Elite strength.', depth: 5, ms: 2400, book: true, slip: 0, noise: 0, qply: 8 },
];

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) || LEVELS[2];
}

function tactical(pos, move) {
  if (move.promo) return true;
  if (pos.board[move.to]) return true;
  const piece = pos.board[move.from];
  return !!(piece && piece[1] === 'p' && move.to === pos.ep && (move.from & 7) !== (move.to & 7));
}

function orderScore(pos, move) {
  const attacker = pos.board[move.from][1];
  const victim = pos.board[move.to];
  let score = 0;
  if (victim) score += 10 * VALUE[victim[1]] - VALUE[attacker];
  else if (tactical(pos, move)) score += 9 * VALUE.p;
  if (move.promo) score += 10 * VALUE[move.promo];
  return score;
}

function ordered(pos, moves) {
  return moves.sort((a, b) => orderScore(pos, b) - orderScore(pos, a));
}

function timeUp() {
  if ((nodes & 2047) === 0 && performance.now() > deadline) aborted = true;
  nodes += 1;
  return aborted;
}

function sideEval(pos) {
  const score = evaluate(pos);
  const signed = pos.turn === 'w' ? score : -score;
  if (!cloud) return signed;
  return signed + Math.round((Math.random() * 2 - 1) * cloud);
}

function quiesce(pos, alpha, beta, ply, left) {
  if (timeUp() || left <= 0 || ply > 12) return sideEval(pos);
  const check = inCheck(pos, pos.turn);
  let moves = legalMoves(pos);
  if (moves.length === 0) return check ? -29000 + ply : 0;
  if (!check) {
    const stand = sideEval(pos);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    moves = moves.filter((move) => tactical(pos, move));
    if (moves.length === 0) return alpha;
  }
  for (const move of ordered(pos, moves)) {
    const undo = makeMove(pos, move);
    const score = -quiesce(pos, -beta, -alpha, ply + 1, left - 1);
    unmakeMove(pos, move, undo);
    if (aborted) return 0;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return alpha;
}

function negamax(pos, depth, alpha, beta, ply) {
  if (timeUp()) return 0;
  if (depth === 0) return quiesce(pos, alpha, beta, ply, quietBudget);
  const moves = legalMoves(pos);
  if (moves.length === 0) return inCheck(pos, pos.turn) ? -29000 + ply : 0;
  for (const move of ordered(pos, moves)) {
    const undo = makeMove(pos, move);
    const score = -negamax(pos, depth - 1, -beta, -alpha, ply + 1);
    unmakeMove(pos, move, undo);
    if (aborted) return 0;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return alpha;
}

function bookMove(pos) {
  const key = fen(pos).split(' ').slice(0, 2).join(' ');
  const list = BOOK[key];
  if (!list) return null;
  const legal = legalMoves(pos);
  const options = [];
  for (const text of list) {
    const from = parseSquare(text.slice(0, 2));
    const to = parseSquare(text.slice(2, 4));
    const found = legal.find((move) => move.from === from && move.to === to && !move.promo);
    if (found) options.push(found);
  }
  if (!options.length) return null;
  return options[Math.floor(Math.random() * options.length)];
}

function sameMove(a, b) {
  return !!a && !!b && a.from === b.from && a.to === b.to && (a.promo || null) === (b.promo || null);
}

// A modest slip plays a move that looks fine and is not the best.
// A large slip plays any legal move, which is how pieces get left hanging.
function soften(pos, best, bestScore, slip) {
  if (slip <= 0 || Math.random() >= slip) return best;
  if (slip < 0.4 && bestScore > 25000) return best;
  const moves = legalMoves(pos);
  if (moves.length < 2) return best;
  if (slip >= 0.4) {
    const others = moves.filter((move) => !sameMove(move, best));
    const bag = others.length ? others : moves;
    return bag[Math.floor(Math.random() * bag.length)];
  }
  const saved = cloud;
  cloud = 0;
  const ranked = moves.map((move) => {
    const undo = makeMove(pos, move);
    const score = -sideEval(pos);
    unmakeMove(pos, move, undo);
    return { move, score };
  }).sort((a, b) => b.score - a.score);
  cloud = saved;
  const rest = ranked.filter((row) => !sameMove(row.move, best)).slice(0, 3);
  const bag = rest.length ? rest : ranked;
  return bag[Math.floor(Math.random() * bag.length)].move;
}

export function chooseMove(pos, { maxDepth = 4, ms = 700, book = true, slip = 0, noise = 0, qply = 8 } = {}) {
  cloud = noise;
  quietBudget = qply;
  try {
    if (book) {
      const booked = bookMove(pos);
      if (booked) return booked;
    }
    const started = performance.now();
    const moves = legalMoves(pos);
    if (!moves.length) return null;
    let best = moves[0];
    let bestScore = -Infinity;
    for (let depth = 1; depth <= maxDepth; depth++) {
      aborted = false;
      nodes = 0;
      deadline = depth === 1 ? Infinity : started + ms;
      let alpha = -Infinity;
      let candidate = best;
      for (const move of ordered(pos, moves.slice())) {
        if (aborted) break;
        const undo = makeMove(pos, move);
        const score = -negamax(pos, depth - 1, -Infinity, -alpha, 1);
        unmakeMove(pos, move, undo);
        if (aborted) break;
        // A fail-high comes back equal to alpha. Only a strictly better score
        // is a new best move, so a bound cannot displace a real mate.
        if (score > alpha) {
          alpha = score;
          candidate = move;
        }
      }
      if (aborted) break;
      best = candidate;
      bestScore = alpha;
      if (bestScore > 25000) break;
    }
    return soften(pos, best, bestScore, slip);
  } finally {
    cloud = 0;
    quietBudget = 8;
  }
}
