// Chess rules. Squares are 0..63, a1 = 0, files along the rank, rank 1 first.

export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FILES = 'abcdefgh';
const PROMO = ['q', 'r', 'b', 'n'];
const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

const PST = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, -20, -20, 10, 10, 5,
    5, -5, -10, 0, 0, -10, -5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, 5, 10, 25, 25, 10, 5, 5,
    10, 10, 20, 30, 30, 20, 10, 10,
    50, 50, 50, 50, 50, 50, 50, 50,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    20, 30, 10, 0, 0, 10, 30, 20,
    20, 20, 0, 0, 0, 0, 20, 20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
  ],
};

// King toward the center once the heavy pieces are gone. Indexed from a1.
const KEND = [
  -50, -30, -30, -30, -30, -30, -30, -50,
  -30, -10, 0, 0, 0, 0, -10, -30,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 0, 15, 22, 22, 15, 0, -30,
  -30, 0, 15, 22, 22, 15, 0, -30,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, -10, 0, 0, 0, 0, -10, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
];

for (const key of Object.keys(PST)) {
  if (PST[key].length !== 64) throw new Error(`piece table ${key} has ${PST[key].length} squares`);
}

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const KING = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function fileOf(sq) {
  return sq & 7;
}

export function rankOf(sq) {
  return sq >> 3;
}

export function squareName(sq) {
  return FILES[sq & 7] + ((sq >> 3) + 1);
}

export function parseSquare(name) {
  return (name.charCodeAt(1) - 49) * 8 + (name.charCodeAt(0) - 97);
}

function other(color) {
  return color === 'w' ? 'b' : 'w';
}

export function parseFen(fen) {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) throw new Error(`bad fen: ${fen}`);
  const board = Array(64).fill(null);
  const ranks = parts[0].split('/');
  if (ranks.length !== 8) throw new Error(`bad fen: ${fen}`);
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of ranks[r]) {
      if (ch >= '1' && ch <= '8') {
        f += Number(ch);
        continue;
      }
      const color = ch === ch.toUpperCase() ? 'w' : 'b';
      const type = ch.toLowerCase();
      if (!'pnbrqk'.includes(type) || f > 7) throw new Error(`bad fen: ${fen}`);
      board[(7 - r) * 8 + f] = color + type;
      f += 1;
    }
    if (f !== 8) throw new Error(`bad fen: ${fen}`);
  }
  let ep = null;
  if (parts[3] !== '-') {
    ep = parseSquare(parts[3]);
    if (ep < 0 || ep > 63) ep = null;
  }
  return {
    board,
    turn: parts[1] === 'b' ? 'b' : 'w',
    castling: parts[2] === '-' ? '' : parts[2],
    ep,
    halfmove: Number(parts[4] || 0),
    fullmove: Number(parts[5] || 1),
  };
}

function castleString(c) {
  const s = ['K', 'Q', 'k', 'q'].filter((ch) => c.includes(ch)).join('');
  return s || '-';
}

export function fen(pos) {
  let board = '';
  for (let r = 7; r >= 0; r--) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = pos.board[r * 8 + f];
      if (!p) {
        empty += 1;
        continue;
      }
      if (empty) {
        board += empty;
        empty = 0;
      }
      board += p[0] === 'w' ? p[1].toUpperCase() : p[1];
    }
    if (empty) board += empty;
    if (r) board += '/';
  }
  const ep = pos.ep == null ? '-' : squareName(pos.ep);
  return `${board} ${pos.turn} ${castleString(pos.castling)} ${ep} ${pos.halfmove} ${pos.fullmove}`;
}

export function ascii(pos) {
  const lines = [];
  for (let r = 7; r >= 0; r--) {
    let row = `${r + 1} `;
    for (let f = 0; f < 8; f++) {
      const p = pos.board[r * 8 + f];
      row += p ? (p[0] === 'w' ? p[1].toUpperCase() : p[1]) : '.';
      row += ' ';
    }
    lines.push(row);
  }
  lines.push('  a b c d e f g h');
  lines.push(`${pos.turn} ${castleString(pos.castling)} ${pos.ep == null ? '-' : squareName(pos.ep)}`);
  return lines.join('\n');
}

function onBoard(f, r) {
  return f >= 0 && f < 8 && r >= 0 && r < 8;
}

export function kingSquare(pos, color) {
  const want = color + 'k';
  for (let i = 0; i < 64; i++) if (pos.board[i] === want) return i;
  return -1;
}

export function isAttacked(pos, target, by) {
  const b = pos.board;
  const tf = target & 7;
  const tr = target >> 3;
  const pawnRank = by === 'w' ? tr - 1 : tr + 1;
  if (pawnRank >= 0 && pawnRank < 8) {
    if (tf > 0 && b[(pawnRank << 3) + tf - 1] === by + 'p') return true;
    if (tf < 7 && b[(pawnRank << 3) + tf + 1] === by + 'p') return true;
  }
  for (const [df, dr] of KNIGHT) {
    const f = tf + df;
    const r = tr + dr;
    if (onBoard(f, r) && b[(r << 3) + f] === by + 'n') return true;
  }
  for (const [df, dr] of KING) {
    const f = tf + df;
    const r = tr + dr;
    if (onBoard(f, r) && b[(r << 3) + f] === by + 'k') return true;
  }
  for (const [df, dr] of BISHOP) {
    let f = tf + df;
    let r = tr + dr;
    while (onBoard(f, r)) {
      const p = b[(r << 3) + f];
      if (p) {
        if (p[0] === by && (p[1] === 'b' || p[1] === 'q')) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }
  for (const [df, dr] of ROOK) {
    let f = tf + df;
    let r = tr + dr;
    while (onBoard(f, r)) {
      const p = b[(r << 3) + f];
      if (p) {
        if (p[0] === by && (p[1] === 'r' || p[1] === 'q')) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }
  return false;
}

export function inCheck(pos, color) {
  const king = kingSquare(pos, color);
  return king >= 0 && isAttacked(pos, king, other(color));
}

function slide(board, from, color, dirs, moves) {
  const f0 = from & 7;
  const r0 = from >> 3;
  for (const [df, dr] of dirs) {
    let f = f0 + df;
    let r = r0 + dr;
    while (onBoard(f, r)) {
      const to = (r << 3) + f;
      const occ = board[to];
      if (!occ) moves.push({ from, to });
      else {
        if (occ[0] !== color) moves.push({ from, to });
        break;
      }
      f += df;
      r += dr;
    }
  }
}

function addPawn(moves, from, to, promote) {
  if (!promote) {
    moves.push({ from, to });
    return;
  }
  for (const promo of PROMO) moves.push({ from, to, promo });
}

function pushCastle(pos, moves, color, kingside) {
  const rankBase = color === 'w' ? 0 : 56;
  const kingFrom = rankBase + 4;
  if (pos.board[kingFrom] !== color + 'k') return;
  const right = color === 'w' ? (kingside ? 'K' : 'Q') : (kingside ? 'k' : 'q');
  if (!pos.castling.includes(right)) return;
  const rookFrom = rankBase + (kingside ? 7 : 0);
  if (pos.board[rookFrom] !== color + 'r') return;
  const enemy = other(color);
  const b = pos.board;
  if (kingside) {
    if (b[rankBase + 5] || b[rankBase + 6]) return;
  } else if (b[rankBase + 1] || b[rankBase + 2] || b[rankBase + 3]) return;
  if (isAttacked(pos, kingFrom, enemy)) return;
  if (kingside) {
    if (isAttacked(pos, rankBase + 5, enemy) || isAttacked(pos, rankBase + 6, enemy)) return;
    moves.push({ from: kingFrom, to: rankBase + 6 });
  } else {
    if (isAttacked(pos, rankBase + 3, enemy) || isAttacked(pos, rankBase + 2, enemy)) return;
    moves.push({ from: kingFrom, to: rankBase + 2 });
  }
}

function pseudoMoves(pos) {
  const moves = [];
  const b = pos.board;
  const color = pos.turn;
  const dir = color === 'w' ? 8 : -8;
  const startRank = color === 'w' ? 1 : 6;
  const lastRank = color === 'w' ? 7 : 0;
  for (let from = 0; from < 64; from++) {
    const piece = b[from];
    if (!piece || piece[0] !== color) continue;
    const type = piece[1];
    if (type === 'p') {
      const f = from & 7;
      const one = from + dir;
      if (!b[one]) {
        addPawn(moves, from, one, rankOf(one) === lastRank);
        const two = from + dir * 2;
        if (rankOf(from) === startRank && !b[two]) moves.push({ from, to: two });
      }
      for (const df of [-1, 1]) {
        const tf = f + df;
        if (tf < 0 || tf > 7) continue;
        const to = from + dir + df;
        const occ = b[to];
        if (occ && occ[0] !== color) addPawn(moves, from, to, rankOf(to) === lastRank);
        else if (!occ && pos.ep === to) moves.push({ from, to });
      }
    } else if (type === 'n') {
      const f0 = from & 7;
      const r0 = from >> 3;
      for (const [df, dr] of KNIGHT) {
        const f = f0 + df;
        const r = r0 + dr;
        if (!onBoard(f, r)) continue;
        const to = (r << 3) + f;
        if (!b[to] || b[to][0] !== color) moves.push({ from, to });
      }
    } else if (type === 'b') slide(b, from, color, BISHOP, moves);
    else if (type === 'r') slide(b, from, color, ROOK, moves);
    else if (type === 'q') slide(b, from, color, KING, moves);
    else if (type === 'k') {
      const f0 = from & 7;
      const r0 = from >> 3;
      for (const [df, dr] of KING) {
        const f = f0 + df;
        const r = r0 + dr;
        if (!onBoard(f, r)) continue;
        const to = (r << 3) + f;
        if (!b[to] || b[to][0] !== color) moves.push({ from, to });
      }
    }
  }
  pushCastle(pos, moves, color, true);
  pushCastle(pos, moves, color, false);
  return moves;
}

// A white en passant capture lands in front of the black pawn, so the pawn
// sits one rank higher (to + 8 is wrong: the victim is toward white, to - 8).
function epVictim(color, to) {
  return color === 'w' ? to - 8 : to + 8;
}

function updateRights(castling, from, to, piece) {
  let c = castling;
  if (piece === 'wk') c = c.replace(/[KQ]/g, '');
  else if (piece === 'bk') c = c.replace(/[kq]/g, '');
  const drop = { 0: 'Q', 7: 'K', 56: 'q', 63: 'k' };
  if (drop[from]) c = c.replace(drop[from], '');
  if (drop[to]) c = c.replace(drop[to], '');
  return c;
}

export function makeMove(pos, move) {
  const b = pos.board;
  const piece = b[move.from];
  const color = piece[0];
  const type = piece[1];
  const toPiece = b[move.to];
  const isEP = type === 'p' && pos.ep != null && move.to === pos.ep && (move.from & 7) !== (move.to & 7) && !toPiece;
  const undo = {
    mover: piece,
    toPiece,
    epCap: null,
    epPiece: null,
    rookFrom: null,
    rookTo: null,
    castling: pos.castling,
    ep: pos.ep,
    halfmove: pos.halfmove,
    fullmove: pos.fullmove,
    turn: pos.turn,
  };
  if (isEP) {
    undo.epCap = epVictim(color, move.to);
    undo.epPiece = b[undo.epCap];
    b[undo.epCap] = null;
  }
  b[move.from] = null;
  const destRank = move.to >> 3;
  if (type === 'p' && (destRank === 0 || destRank === 7)) b[move.to] = color + (move.promo || 'q');
  else b[move.to] = piece;

  if (type === 'k' && Math.abs((move.to & 7) - (move.from & 7)) === 2) {
    const rankBase = move.from & ~7;
    const kingside = (move.to & 7) === 6;
    undo.rookFrom = rankBase + (kingside ? 7 : 0);
    undo.rookTo = rankBase + (kingside ? 5 : 3);
    b[undo.rookTo] = b[undo.rookFrom];
    b[undo.rookFrom] = null;
  }

  pos.castling = updateRights(pos.castling, move.from, move.to, piece);
  pos.ep = null;
  if (type === 'p' && Math.abs((move.to >> 3) - (move.from >> 3)) === 2) pos.ep = (move.from + move.to) >> 1;
  pos.halfmove = type === 'p' || toPiece || isEP ? 0 : pos.halfmove + 1;
  if (color === 'b') pos.fullmove += 1;
  pos.turn = other(color);
  return undo;
}

export function unmakeMove(pos, move, undo) {
  const b = pos.board;
  b[move.from] = undo.mover;
  b[move.to] = undo.toPiece;
  if (undo.epCap != null) b[undo.epCap] = undo.epPiece;
  if (undo.rookFrom != null) {
    b[undo.rookFrom] = b[undo.rookTo];
    b[undo.rookTo] = null;
  }
  pos.castling = undo.castling;
  pos.ep = undo.ep;
  pos.halfmove = undo.halfmove;
  pos.fullmove = undo.fullmove;
  pos.turn = undo.turn;
}

export function legalMoves(pos) {
  const color = pos.turn;
  const pseudo = pseudoMoves(pos);
  const legal = [];
  for (const move of pseudo) {
    const undo = makeMove(pos, move);
    if (!inCheck(pos, color)) legal.push(move);
    unmakeMove(pos, move, undo);
  }
  return legal;
}

function disambiguate(pos, move) {
  const type = pos.board[move.from][1];
  const others = legalMoves(pos).filter((m) => m.from !== move.from && m.to === move.to && pos.board[m.from][1] === type);
  if (others.length === 0) return '';
  const file = move.from & 7;
  const rank = move.from >> 3;
  if (others.every((m) => (m.from & 7) !== file)) return FILES[file];
  if (others.every((m) => (m.from >> 3) !== rank)) return String(rank + 1);
  return FILES[file] + (rank + 1);
}

export function san(pos, move) {
  const piece = pos.board[move.from];
  const type = piece[1];
  const capture = !!(pos.board[move.to] || (type === 'p' && move.to === pos.ep && (move.from & 7) !== (move.to & 7)));
  let text;
  if (type === 'k' && Math.abs((move.to & 7) - (move.from & 7)) === 2) {
    text = (move.to & 7) === 6 ? 'O-O' : 'O-O-O';
  } else {
    const dest = squareName(move.to);
    if (type === 'p') text = capture ? `${FILES[move.from & 7]}x${dest}` : dest;
    else text = `${type.toUpperCase()}${disambiguate(pos, move)}${capture ? 'x' : ''}${dest}`;
    if (move.promo) text += `=${move.promo.toUpperCase()}`;
  }
  const undo = makeMove(pos, move);
  const checked = inCheck(pos, pos.turn);
  const over = checked && legalMoves(pos).length === 0;
  unmakeMove(pos, move, undo);
  if (over) text += '#';
  else if (checked) text += '+';
  return text;
}

function squareColor(sq) {
  return ((sq & 7) + (sq >> 3)) & 1;
}

export function deadPosition(pos) {
  const minors = { w: [], b: [] };
  const bishops = { w: [], b: [] };
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    if (!p || p[1] === 'k') continue;
    if (p[1] === 'p' || p[1] === 'r' || p[1] === 'q') return false;
    minors[p[0]].push(p[1]);
    if (p[1] === 'b') bishops[p[0]].push(squareColor(i));
  }
  const n = minors.w.length + minors.b.length;
  if (n === 0 || n === 1) return true;
  if (minors.w.length === 1 && minors.b.length === 1 && minors.w[0] === 'b' && minors.b[0] === 'b') {
    return bishops.w[0] === bishops.b[0];
  }
  return false;
}

function epMatters(pos) {
  if (pos.ep == null) return '-';
  const can = pseudoMoves(pos).some((m) => {
    const piece = pos.board[m.from];
    return piece && piece[1] === 'p' && m.to === pos.ep && (m.from & 7) !== (pos.ep & 7) && !pos.board[m.to];
  });
  return can ? squareName(pos.ep) : '-';
}

// Repetition ignores the clocks. En passant counts only when a pawn can take it.
export function positionKey(pos) {
  const body = fen(pos).split(' ');
  return `${body[0]} ${body[1]} ${body[2]} ${epMatters(pos)}`;
}

export function outcome(pos, keys) {
  const moves = legalMoves(pos);
  if (moves.length === 0) {
    return inCheck(pos, pos.turn)
      ? { kind: 'mate', winner: other(pos.turn) }
      : { kind: 'stalemate' };
  }
  if (pos.halfmove >= 100) return { kind: 'fifty' };
  if (deadPosition(pos)) return { kind: 'material' };
  if (keys) {
    const key = positionKey(pos);
    let n = 0;
    for (const k of keys) if (k === key) n += 1;
    if (n >= 3) return { kind: 'repetition' };
  }
  return null;
}

function passedPawn(board, sq, color) {
  const f = sq & 7;
  const r = sq >> 3;
  const step = color === 'w' ? 1 : -1;
  for (let rr = r + step; rr >= 0 && rr < 8; rr += step) {
    for (let ff = f - 1; ff <= f + 1; ff++) {
      if (ff < 0 || ff > 7) continue;
      const p = board[(rr << 3) + ff];
      if (p === other(color) + 'p') return false;
    }
  }
  return true;
}

export function evaluate(pos) {
  if (deadPosition(pos)) return 0;
  let score = 0;
  let phase = 0;
  const bishops = { w: 0, b: 0 };
  const pawnFiles = { w: Array(8).fill(0), b: Array(8).fill(0) };
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    if (!p) continue;
    const color = p[0];
    const type = p[1];
    const sign = color === 'w' ? 1 : -1;
    const sq = color === 'w' ? i : i ^ 56;
    if (type === 'k') continue;
    score += sign * (VAL[type] + PST[type][sq]);
    if (type === 'n' || type === 'b') phase += 1;
    else if (type === 'r') phase += 2;
    else if (type === 'q') phase += 4;
    if (type === 'b') bishops[color] += 1;
    if (type === 'p') pawnFiles[color][i & 7] += 1;
  }
  if (bishops.w >= 2) score += 30;
  if (bishops.b >= 2) score -= 30;
  for (const color of ['w', 'b']) {
    const sign = color === 'w' ? 1 : -1;
    for (let f = 0; f < 8; f++) {
      if (pawnFiles[color][f] > 1) score -= sign * 18 * (pawnFiles[color][f] - 1);
    }
  }
  const phaseT = phase / 24;
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    if (!p) continue;
    if (p[1] === 'k') {
      const sq = p[0] === 'w' ? i : i ^ 56;
      const blended = PST.k[sq] * phaseT + KEND[sq] * (1 - phaseT);
      score += (p[0] === 'w' ? 1 : -1) * blended;
    } else if (p[1] === 'p' && passedPawn(pos.board, i, p[0])) {
      const advance = p[0] === 'w' ? i >> 3 : 7 - (i >> 3);
      score += (p[0] === 'w' ? 1 : -1) * [0, 8, 12, 20, 36, 60, 95, 0][advance];
    }
  }
  score += pos.turn === 'w' ? 8 : -8;
  return score;
}

export function perft(pos, depth) {
  if (depth === 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const move of moves) {
    const undo = makeMove(pos, move);
    n += perft(pos, depth - 1);
    unmakeMove(pos, move, undo);
  }
  return n;
}

export function moveName(move) {
  return squareName(move.from) + squareName(move.to) + (move.promo || '');
}
