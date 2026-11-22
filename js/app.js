import {
  START, parseFen, fen, legalMoves, makeMove, san, inCheck, kingSquare,
  outcome, positionKey, squareName,
} from './chess.js';
import { chooseMove, LEVELS, levelById } from './ai.js';
import { pieceMarkup } from './pieces.js';

const SEASONS = {
  spring: { name: 'Spring', verse: 'Blossom on the stone, and the game begins again.' },
  summer: { name: 'Summer', verse: 'The day is long, and the board is warm.' },
  autumn: { name: 'Autumn', verse: 'The leaves are deciding. So are you.' },
  winter: { name: 'Winter', verse: 'Quiet pieces, and snow at the glass.' },
};
const NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const WORTH = { q: 9, r: 5, b: 3, n: 3, p: 1 };
const ORDER = { q: 0, r: 1, b: 2, n: 3, p: 4 };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (id) => document.getElementById(id);
const board = $('board');
const ranksEl = $('ranks');
const filesEl = $('files');
const capsTop = $('caps-top');
const capsBottom = $('caps-bottom');
const artA = $('art-a');
const artB = $('art-b');
const canvas = $('particles');
const paint = canvas.getContext('2d');

const state = {
  moves: [],
  human: null,
  flipped: false,
  season: 'auto',
  sound: true,
  level: 'c',
  over: null,
  selected: null,
  cursor: 12,
};

let live = null;
let token = 0;
let thinking = false;
let drag = null;
let pending = null;
let keyboard = false;
let resignTimer = 0;
let shownArt = 'a';
let previewSeason = null;
const pieceEls = new Map();
const squares = [];
let placed = new Map();
let bits = [];
let audioCtx = null;

function seasonOf(date) {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

function visibleSeason() {
  if (previewSeason) return previewSeason;
  if (state.season && state.season !== 'auto') return state.season;
  return seasonOf(new Date());
}

function screenOf(sq, flipped) {
  let file = sq & 7;
  let rank = sq >> 3;
  if (flipped) {
    file = 7 - file;
    rank = 7 - rank;
  }
  return { col: file, row: 7 - rank };
}

function squareFromScreen(col, row, flipped) {
  const rankPrime = 7 - row;
  const rank = flipped ? 7 - rankPrime : rankPrime;
  const file = flipped ? 7 - col : col;
  return (rank << 3) + file;
}

function freshRoster() {
  const pieces = [];
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  back.forEach((type, i) => {
    pieces.push({ id: `w${type}${i}`, color: 'w', type, sq: i, captured: false });
    pieces.push({ id: `b${type}${i}`, color: 'b', type, sq: 56 + i, captured: false });
  });
  for (let i = 0; i < 8; i++) {
    pieces.push({ id: `wp${i}`, color: 'w', type: 'p', sq: 8 + i, captured: false });
    pieces.push({ id: `bp${i}`, color: 'b', type: 'p', sq: 48 + i, captured: false });
  }
  return pieces;
}

function applyRoster(roster, pos, move) {
  const piece = pos.board[move.from];
  let capSq = null;
  if (pos.board[move.to]) capSq = move.to;
  else if (piece[1] === 'p' && pos.ep === move.to && (move.from & 7) !== (move.to & 7)) {
    capSq = piece[0] === 'w' ? move.to - 8 : move.to + 8;
  }
  if (capSq != null) {
    const victim = roster.find((p) => !p.captured && p.sq === capSq);
    if (victim) {
      victim.captured = true;
      victim.sq = -1;
    }
  }
  const mover = roster.find((p) => !p.captured && p.sq === move.from);
  mover.sq = move.to;
  if (move.promo) mover.type = move.promo;
  if (piece[1] === 'k' && Math.abs((move.to & 7) - (move.from & 7)) === 2) {
    const base = move.from & ~7;
    const kingside = (move.to & 7) === 6;
    const rook = roster.find((p) => !p.captured && p.sq === base + (kingside ? 7 : 0));
    rook.sq = base + (kingside ? 5 : 3);
  }
}

function derive(moves) {
  const pos = parseFen(START);
  const roster = freshRoster();
  const sans = [];
  const keys = [positionKey(pos)];
  for (const move of moves) {
    const full = legalMoves(pos).find((m) => m.from === move.from && m.to === move.to && (m.promo || null) === (move.promo || null));
    if (!full) break;
    sans.push(san(pos, full));
    applyRoster(roster, pos, full);
    makeMove(pos, full);
    keys.push(positionKey(pos));
  }
  const over = outcome(pos, keys);
  return { pos, roster, sans, over, movesNow: over ? [] : legalMoves(pos) };
}

function myTurn() {
  if (!live || thinking || pending) return false;
  if (state.over || live.over) return false;
  if (state.human && live.pos.turn !== state.human) return false;
  return true;
}

function sideName(color) {
  return color === 'w' ? 'White' : 'Black';
}

function load() {
  const query = new URLSearchParams(location.search).get('season');
  if (SEASONS[query]) previewSeason = query;
  try {
    const data = JSON.parse(localStorage.getItem('solstice') || 'null');
    if (!data || data.v !== 1) return;
    if (data.human === 'w' || data.human === 'b') state.human = data.human;
    state.flipped = !!data.flipped;
    state.sound = data.sound !== false;
    if (['auto', 'spring', 'summer', 'autumn', 'winter'].includes(data.season)) state.season = data.season;
    if (LEVELS.some((level) => level.id === data.level)) state.level = data.level;
    else if ((data.moves && data.moves.length) || data.human) state.level = 'x';
    if (data.over && data.over.kind === 'resign') state.over = data.over;
    const trial = [];
    const pos = parseFen(START);
    for (const move of data.moves || []) {
      const found = legalMoves(pos).find((m) => m.from === move.from && m.to === move.to && (m.promo || null) === (move.promo || null));
      if (!found) break;
      makeMove(pos, found);
      trial.push({ from: move.from, to: move.to, promo: move.promo || null });
    }
    state.moves = trial;
  } catch {
    /* a fresh board */
  }
}

function save() {
  localStorage.setItem('solstice', JSON.stringify({
    v: 1,
    moves: state.moves,
    human: state.human,
    flipped: state.flipped,
    season: state.season,
    sound: state.sound,
    level: state.level,
    over: state.over,
  }));
}

function place(el, sq, animate) {
  const { col, row } = screenOf(sq, state.flipped);
  const size = board.clientWidth / 8;
  const next = `translate(${Math.round(col * size)}px, ${Math.round(row * size)}px)`;
  el.dataset.sq = String(sq);
  if (!animate) {
    el.style.transition = 'none';
    el.style.transform = next;
    el.getBoundingClientRect();
    el.style.transition = '';
    return;
  }
  el.style.transition = 'transform .22s cubic-bezier(.2,.75,.2,1)';
  requestAnimationFrame(() => {
    el.style.transform = next;
  });
}

function layoutSquares() {
  for (let sq = 0; sq < 64; sq++) {
    const { col, row } = screenOf(sq, state.flipped);
    squares[sq].style.setProperty('--c', String(col));
    squares[sq].style.setProperty('--r', String(row));
  }
}

function syncPieces(roster, animate) {
  for (const piece of roster) {
    const el = pieceEls.get(piece.id);
    const kind = piece.color + piece.type;
    if (el.dataset.kind !== kind) {
      el.dataset.kind = kind;
      el.innerHTML = pieceMarkup(piece.color, piece.type);
    }
    const prev = placed.get(piece.id);
    el.classList.toggle('mine', !piece.captured && myTurn() && piece.color === live.pos.turn);
    if (piece.captured) {
      if (animate && prev && !prev.captured) el.classList.add('taking');
      el.classList.add('in-tray');
      el.classList.remove('dragging');
      el.dataset.sq = '';
      if (!el.classList.contains('taking')) el.style.transform = '';
      continue;
    }
    el.classList.remove('in-tray', 'taking');
    if (el.parentElement !== board) board.appendChild(el);
    const glide = !!(animate && prev && !prev.captured && prev.sq !== piece.sq);
    place(el, piece.sq, glide);
  }
  placed = new Map(roster.map((piece) => [piece.id, { sq: piece.sq, captured: piece.captured }]));
}

function paintTrays(roster) {
  const topColor = state.flipped ? 'w' : 'b';
  const captured = roster.filter((piece) => piece.captured).sort((a, b) => ORDER[a.type] - ORDER[b.type]);
  const into = (container, color) => {
    const held = captured.filter((piece) => piece.color !== color && !pieceEls.get(piece.id).classList.contains('taking'));
    container.replaceChildren(...held.map((piece) => pieceEls.get(piece.id)));
  };
  into(capsTop, topColor);
  into(capsBottom, topColor === 'w' ? 'b' : 'w');
  const score = (color) => captured.filter((piece) => piece.color !== color).reduce((sum, piece) => sum + WORTH[piece.type], 0);
  const top = score(topColor);
  const bottom = score(topColor === 'w' ? 'b' : 'w');
  $('diff-top').textContent = top > bottom ? `+${top - bottom}` : '';
  $('diff-bottom').textContent = bottom > top ? `+${bottom - top}` : '';
}

function paintEdges() {
  const rankNums = state.flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const fileChars = state.flipped ? 'hgfedcba' : 'abcdefgh';
  ranksEl.replaceChildren(...rankNums.map((n) => {
    const span = document.createElement('span');
    span.textContent = String(n);
    return span;
  }));
  filesEl.replaceChildren(...[...fileChars].map((ch) => {
    const span = document.createElement('span');
    span.textContent = ch;
    return span;
  }));
}

function paintMarks() {
  const last = state.moves[state.moves.length - 1];
  const king = live && inCheck(live.pos, live.pos.turn) ? kingSquare(live.pos, live.pos.turn) : -1;
  for (let sq = 0; sq < 64; sq++) {
    const el = squares[sq];
    el.classList.remove('last', 'check', 'selected', 'hint', 'capture', 'cursor-on', 'hover');
    const piece = live.pos.board[sq];
    const name = piece
      ? `${squareName(sq)}, ${piece[0] === 'w' ? 'white' : 'black'} ${NAMES[piece[1]]}`
      : squareName(sq);
    el.setAttribute('aria-label', name);
    if (last && (sq === last.from || sq === last.to)) el.classList.add('last');
    if (sq === king) el.classList.add('check');
    if (sq === state.selected) el.classList.add('selected');
    if (keyboard && sq === state.cursor) el.classList.add('cursor-on');
  }
  if (state.selected != null) {
    for (const move of live.movesNow) {
      if (move.from !== state.selected) continue;
      const el = squares[move.to];
      el.classList.add('hint');
      const pawn = live.pos.board[move.from][1] === 'p';
      if (live.pos.board[move.to] || (pawn && move.to === live.pos.ep)) el.classList.add('capture');
    }
  }
}

function paintMoves(sans) {
  const list = $('moves');
  const empty = $('empty');
  list.replaceChildren();
  empty.hidden = sans.length > 0;
  if (!sans.length) {
    empty.textContent = state.human && live.pos.turn !== state.human
      ? 'The first move is coming.'
      : 'The first move is yours.';
    return;
  }
  for (let i = 0; i < sans.length; i += 2) {
    const row = document.createElement('li');
    const num = document.createElement('span');
    num.className = 'n';
    num.textContent = String(i / 2 + 1);
    const white = document.createElement('span');
    white.textContent = sans[i];
    if (i === sans.length - 1) white.className = 'now';
    const black = document.createElement('span');
    black.textContent = sans[i + 1] || '';
    if (i + 1 === sans.length - 1) black.className = 'now';
    row.append(num, white, black);
    list.append(row);
  }
  $('moves-wrap').scrollTop = $('moves-wrap').scrollHeight;
}

function paintStatus() {
  const over = state.over || live.over;
  let text = `${sideName(live.pos.turn)} to move.`;
  if (over?.kind === 'resign') text = `${sideName(over.winner)} wins. ${sideName(over.winner === 'w' ? 'b' : 'w')} resigns.`;
  else if (over?.kind === 'mate') text = `${sideName(over.winner)} wins by checkmate.`;
  else if (over?.kind === 'stalemate') text = 'Stalemate. The game is drawn.';
  else if (over?.kind === 'fifty') text = 'Drawn by the fifty-move rule.';
  else if (over?.kind === 'repetition') text = 'Drawn by threefold repetition.';
  else if (over?.kind === 'material') text = 'Drawn by insufficient material.';
  else if (thinking) text = `${sideName(live.pos.turn)} is thinking…`;
  else if (inCheck(live.pos, live.pos.turn)) text = `${sideName(live.pos.turn)} is in check.`;
  $('status').textContent = text;
  $('status').classList.toggle('check', !over && !!live && inCheck(live.pos, live.pos.turn));
  const level = levelById(state.level);
  const you = state.human === 'w' ? 'You have the white pieces' : 'You have the black pieces';
  $('sub').textContent = !state.human
    ? 'Two players, one board.'
    : `${you}, against ${level.against}.`;
  $('undo').disabled = state.moves.length === 0;
  $('resign').hidden = !state.human || !!over;
  board.classList.toggle('waiting', !myTurn());
}

function refresh(animate) {
  if (board.clientWidth < 40) {
    requestAnimationFrame(() => refresh(animate));
    return;
  }
  live = derive(state.moves);
  layoutSquares();
  syncPieces(live.roster, animate);
  paintTrays(live.roster);
  paintMarks();
  paintEdges();
  paintMoves(live.sans);
  paintStatus();
}

function movesBetween(from, to) {
  return live.movesNow.filter((move) => move.from === from && move.to === to);
}

function commit(move) {
  const notation = san(live.pos, move);
  state.moves.push({ from: move.from, to: move.to, promo: move.promo || null });
  state.selected = null;
  state.over = null;
  closePromo();
  refresh(true);
  playSound(notation);
  save();
  scheduleAi();
}

function attempt(from, to) {
  const options = movesBetween(from, to);
  if (!options.length || !myTurn()) return false;
  if (options.length > 1 || options[0].promo) {
    openPromo(live.pos.turn, from, to);
    return true;
  }
  commit(options[0]);
  return true;
}

function select(sq) {
  state.selected = sq;
  state.cursor = sq;
  paintMarks();
}

function clearSelection() {
  state.selected = null;
  paintMarks();
}

function squareAt(event) {
  const rect = board.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;
  const col = Math.min(7, Math.floor((x / rect.width) * 8));
  const row = Math.min(7, Math.floor((y / rect.height) * 8));
  return squareFromScreen(col, row, state.flipped);
}

function openPromo(color, from, to) {
  pending = { from, to };
  const title = document.createElement('p');
  title.id = 'promo-title';
  title.textContent = 'Promote to';
  const row = document.createElement('div');
  row.className = 'promo-row';
  for (const type of ['q', 'r', 'b', 'n']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', NAMES[type]);
    button.innerHTML = pieceMarkup(color, type);
    button.addEventListener('click', () => choosePromo(type));
    row.append(button);
  }
  $('promo').replaceChildren(title, row);
  $('promo').hidden = false;
  $('shade').hidden = false;
  row.querySelector('button').focus();
  paintStatus();
}

function closePromo() {
  pending = null;
  $('promo').hidden = true;
  $('shade').hidden = true;
  $('promo').replaceChildren();
}

function choosePromo(type) {
  if (!pending) return;
  const { from, to } = pending;
  closePromo();
  const move = live.movesNow.find((m) => m.from === from && m.to === to && m.promo === type);
  if (move) commit(move);
  else refresh(true);
}

function onPointerDown(event) {
  if (event.button !== 0) return;
  const pieceEl = event.target.closest('.piece');
  if (pieceEl && !pieceEl.classList.contains('in-tray')) {
    const sq = Number(pieceEl.dataset.sq);
    const piece = live.pos.board[sq];
    if (piece && myTurn() && piece[0] === live.pos.turn) {
      select(sq);
      drag = { el: pieceEl, from: sq, x: event.clientX, y: event.clientY, moved: false, pointerId: event.pointerId };
      pieceEl.setPointerCapture(event.pointerId);
      return;
    }
    if (state.selected != null) attempt(state.selected, sq);
    return;
  }
  const sqEl = event.target.closest('.sq');
  if (!sqEl) return;
  const sq = Number(sqEl.dataset.sq);
  if (state.selected != null && attempt(state.selected, sq)) return;
  clearSelection();
}

function onPointerMove(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (!drag.moved && dx * dx + dy * dy < 36) return;
  drag.moved = true;
  drag.el.classList.add('dragging');
  const rect = board.getBoundingClientRect();
  const size = rect.width / 8;
  drag.el.style.transition = 'none';
  drag.el.style.transform = `translate(${event.clientX - rect.left - size / 2}px, ${event.clientY - rect.top - size / 2}px)`;
  for (const el of squares) el.classList.remove('hover');
  const sq = squareAt(event);
  if (sq != null && movesBetween(drag.from, sq).length) squares[sq].classList.add('hover');
}

function onPointerUp(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const info = drag;
  drag = null;
  for (const el of squares) el.classList.remove('hover');
  info.el.classList.remove('dragging');
  if (!info.moved) return;
  const sq = squareAt(event);
  if (sq != null && attempt(info.from, sq)) return;
  place(info.el, info.from, true);
}

function undo() {
  if (!state.moves.length || pending) return;
  token += 1;
  thinking = false;
  state.over = null;
  state.selected = null;
  disarmResign();
  const before = derive(state.moves);
  const replied = state.human && before.pos.turn === state.human && state.moves.length >= 2;
  state.moves.pop();
  if (replied) state.moves.pop();
  refresh(true);
  save();
  if (state.human && live.pos.turn !== state.human && !live.over) scheduleAi();
}

function begin(human) {
  token += 1;
  thinking = false;
  state.moves = [];
  state.human = human;
  state.flipped = human === 'b';
  state.over = null;
  state.selected = null;
  state.cursor = human === 'b' ? 52 : 12;
  disarmResign();
  if ($('new-dialog').open) $('new-dialog').close();
  refresh(false);
  save();
  scheduleAi();
}

function disarmResign() {
  $('resign').dataset.armed = '';
  $('resign').textContent = 'Resign';
  clearTimeout(resignTimer);
}

function scheduleAi() {
  const mine = ++token;
  if (state.human == null || state.over || live.over || live.pos.turn === state.human) return;
  thinking = true;
  paintStatus();
  const snapshot = fen(live.pos);
  const level = levelById(state.level);
  const pause = reduceMotion ? 0 : Math.min(280, 40 + level.depth * 50);
  window.setTimeout(() => {
    if (mine !== token) return;
    const options = {
      ms: level.ms,
      maxDepth: level.depth,
      book: level.book,
      slip: level.slip,
      noise: level.noise,
      qply: level.qply,
    };
    if (worker) worker.postMessage({ fen: snapshot, depth: level.depth, token: mine, ...options });
    else finishAi(mine, chooseMove(parseFen(snapshot), options));
  }, pause);
}

function finishAi(theirToken, move) {
  if (theirToken !== token || !move) {
    if (theirToken === token) {
      thinking = false;
      paintStatus();
    }
    return;
  }
  thinking = false;
  const fresh = derive(state.moves);
  live = fresh;
  const match = fresh.movesNow.find((m) => m.from === move.from && m.to === move.to && (m.promo || null) === (move.promo || null));
  if (!match) {
    paintStatus();
    return;
  }
  commit(match);
}

let worker = null;
try {
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (event) => finishAi(event.data.token, event.data.move);
  worker.onerror = () => { worker = null; };
} catch {
  worker = null;
}

function ctx() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function noiseTap(freq, gainValue, dur) {
  if (!state.sound) return;
  const context = ctx();
  const length = Math.floor(context.sampleRate * dur);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.22));
  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 0.8;
  const gain = context.createGain();
  gain.gain.value = gainValue;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start();
}

function tone(freq, dur, gainValue) {
  if (!state.sound) return;
  const context = ctx();
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(gainValue, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start();
  osc.stop(context.currentTime + dur);
}

function playSound(notation) {
  if (notation.includes('#')) {
    tone(392, 0.16, 0.05);
    window.setTimeout(() => tone(523, 0.2, 0.045), 90);
    window.setTimeout(() => tone(659, 0.36, 0.04), 190);
  } else if (notation.includes('+')) {
    noiseTap(480, 0.16, 0.07);
    tone(466, 0.14, 0.03);
  } else if (notation.includes('x')) noiseTap(230, 0.2, 0.09);
  else if (notation.startsWith('O-O')) {
    noiseTap(520, 0.12, 0.05);
    window.setTimeout(() => noiseTap(340, 0.12, 0.06), 70);
  } else noiseTap(440, 0.14, 0.06);
}

function showArt(src) {
  const on = shownArt === 'a' ? artA : artB;
  const off = shownArt === 'a' ? artB : artA;
  if (on.getAttribute('src') === src && on.classList.contains('on')) return;
  const reveal = () => {
    off.classList.add('on');
    on.classList.remove('on');
    shownArt = shownArt === 'a' ? 'b' : 'a';
    off.onload = null;
  };
  off.onload = reveal;
  off.src = src;
  if (off.complete && off.naturalWidth) reveal();
}

function applySeason(chime) {
  const id = visibleSeason();
  const previous = document.documentElement.dataset.season;
  document.documentElement.dataset.season = id;
  $('verse').textContent = SEASONS[id].verse;
  $('today').textContent = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
  const following = !previewSeason && state.season === 'auto';
  $('season-label').textContent = following ? `${SEASONS[id].name}, from the date` : SEASONS[id].name;
  $('follow').hidden = following;
  for (const button of document.querySelectorAll('.seasons button')) {
    button.setAttribute('aria-checked', button.dataset.season === id ? 'true' : 'false');
  }
  showArt(`assets/${id}.jpg`);
  seedParticles(id);
  if (chime && previous && previous !== id) tone(id === 'winter' ? 392 : 494, 0.2, 0.03);
}

function chooseSeason(id) {
  previewSeason = null;
  state.season = id === seasonOf(new Date()) ? 'auto' : id;
  applySeason(true);
  save();
}

function resizeCanvas() {
  const ratio = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.floor(innerWidth * ratio);
  canvas.height = Math.floor(innerHeight * ratio);
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  paint.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function particleColors() {
  const style = getComputedStyle(document.documentElement);
  return ['--particle-a', '--particle-b', '--particle-c'].map((name) => style.getPropertyValue(name).trim() || '#fff');
}

function born(season, y) {
  return {
    x: Math.random() * innerWidth,
    y,
    r: season === 'winter' ? 1 + Math.random() * 2.2 : 2 + Math.random() * 3.2,
    vy: season === 'summer' ? -(0.12 + Math.random() * 0.28) : 0.22 + Math.random() * (season === 'winter' ? 0.65 : 0.85),
    vx: -0.2 + Math.random() * 0.4,
    rot: Math.random() * 6,
    spin: -0.015 + Math.random() * 0.03,
    phase: Math.random() * Math.PI * 2,
    tint: Math.floor(Math.random() * 3),
  };
}

function seedParticles(season) {
  const count = season === 'winter' ? 80 : season === 'summer' ? 24 : 32;
  bits = Array.from({ length: count }, () => born(season, Math.random() * innerHeight));
}

function frame(time) {
  requestAnimationFrame(frame);
  if (reduceMotion || document.hidden) return;
  paint.clearRect(0, 0, innerWidth, innerHeight);
  const season = visibleSeason();
  const colors = particleColors();
  for (const bit of bits) {
    bit.y += bit.vy;
    bit.x += bit.vx + Math.sin(time / 1000 + bit.phase) * 0.18;
    bit.rot += bit.spin;
    if (bit.y > innerHeight + 16) Object.assign(bit, born(season, -12));
    if (bit.y < -16 && season === 'summer') Object.assign(bit, born(season, innerHeight + 12));
    paint.save();
    paint.translate(bit.x, bit.y);
    paint.rotate(bit.rot);
    paint.fillStyle = colors[bit.tint] || colors[0];
    paint.globalAlpha = season === 'summer' ? 0.35 + (Math.sin(time / 380 + bit.phase) + 1) * 0.28 : 0.8;
    paint.beginPath();
    if (season === 'winter' || season === 'summer') paint.arc(0, 0, bit.r, 0, Math.PI * 2);
    else paint.ellipse(0, 0, bit.r * (season === 'spring' ? 0.65 : 1), bit.r * (season === 'spring' ? 1.15 : 0.62), 0, 0, Math.PI * 2);
    paint.fill();
    paint.restore();
  }
}

function bind() {
  board.addEventListener('pointerdown', onPointerDown);
  board.addEventListener('pointermove', onPointerMove);
  board.addEventListener('pointerup', onPointerUp);
  board.addEventListener('pointercancel', onPointerUp);
  board.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    clearSelection();
  });
  $('shade').addEventListener('click', () => {
    closePromo();
    refresh(true);
  });
  $('new-game').addEventListener('click', () => {
    $('new-dialog').showModal();
    $('level-list').querySelector('[aria-checked="true"]')?.scrollIntoView({ block: 'nearest' });
  });
  $('new-cancel').addEventListener('click', () => $('new-dialog').close());
  $('new-dialog').addEventListener('click', (event) => {
    const button = event.target.closest('[data-human]');
    if (!button) return;
    const human = button.dataset.human;
    begin(human === 'w' || human === 'b' ? human : null);
  });
  $('undo').addEventListener('click', undo);
  $('flip').addEventListener('click', () => {
    state.flipped = !state.flipped;
    state.selected = null;
    refresh(false);
    save();
  });
  $('sound').addEventListener('click', () => {
    state.sound = !state.sound;
    $('sound').textContent = state.sound ? 'Sound on' : 'Sound off';
    $('sound').setAttribute('aria-pressed', state.sound ? 'true' : 'false');
    save();
    if (state.sound) noiseTap(440, 0.1, 0.05);
  });
  $('resign').addEventListener('click', () => {
    if ($('resign').hidden) return;
    if ($('resign').dataset.armed === '1') {
      disarmResign();
      state.over = { kind: 'resign', winner: state.human === 'w' ? 'b' : 'w' };
      token += 1;
      thinking = false;
      state.selected = null;
      refresh(false);
      playSound('#');
      save();
      return;
    }
    $('resign').dataset.armed = '1';
    $('resign').textContent = 'Resign?';
    resignTimer = window.setTimeout(disarmResign, 2400);
  });
  $('copy').addEventListener('click', async () => {
    const text = fen(live.pos);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    $('copy').textContent = 'Copied';
    window.setTimeout(() => { $('copy').textContent = 'Copy position'; }, 1200);
  });
  $('help-open').addEventListener('click', () => $('help').showModal());
  $('help-close').addEventListener('click', () => $('help').close());
  buildLevels();
  $('level-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-level]');
    if (!button) return;
    state.level = button.dataset.level;
    paintLevels();
    save();
  });
  for (const button of document.querySelectorAll('.seasons button')) {
    button.addEventListener('click', () => chooseSeason(button.dataset.season));
  }
  $('follow').addEventListener('click', () => {
    previewSeason = null;
    state.season = 'auto';
    applySeason(true);
    save();
  });
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.season === 'auto' && !previewSeason) applySeason(false);
  });
  new ResizeObserver(() => {
    if (!live || board.clientWidth < 40) return;
    for (const piece of live.roster) {
      if (!piece.captured) place(pieceEls.get(piece.id), piece.sq, false);
    }
  }).observe(board);
  window.addEventListener('resize', resizeCanvas);
}

function onKey(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault();
      undo();
    }
    return;
  }
  if ($('new-dialog').open || $('help').open) return;
  if (!$('promo').hidden) {
    const choice = { q: 'q', r: 'r', b: 'b', n: 'n' }[event.key.toLowerCase()];
    if (choice) choosePromo(choice);
    if (event.key === 'Escape') {
      closePromo();
      refresh(true);
    }
    return;
  }
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (arrows[event.key]) {
    event.preventDefault();
    keyboard = true;
    board.classList.add('keyboard');
    const step = arrows[event.key];
    const screen = screenOf(state.cursor, state.flipped);
    const col = Math.max(0, Math.min(7, screen.col + step[0]));
    const row = Math.max(0, Math.min(7, screen.row + step[1]));
    state.cursor = squareFromScreen(col, row, state.flipped);
    paintMarks();
    return;
  }
  if (event.key === 'Enter') {
    const sq = state.cursor;
    const piece = live.pos.board[sq];
    if (state.selected == null) {
      if (piece && myTurn() && piece[0] === live.pos.turn) select(sq);
    } else if (sq === state.selected) clearSelection();
    else if (!attempt(state.selected, sq) && piece && myTurn() && piece[0] === live.pos.turn) select(sq);
    return;
  }
  if (event.key === 'Escape') {
    clearSelection();
    disarmResign();
    return;
  }
  const key = event.key.toLowerCase();
  if (key === 'n') $('new-dialog').showModal();
  else if (key === 'u') undo();
  else if (key === 'f') $('flip').click();
  else if (key === 'm') $('sound').click();
  else if (key === '?') $('help').showModal();
  else if (key === '0') $('follow').click();
  else if ('1234'.includes(key)) chooseSeason(['spring', 'summer', 'autumn', 'winter'][Number(key) - 1]);
}

function paintLevels() {
  const level = levelById(state.level);
  $('level-line').textContent = level.blurb;
  for (const button of $('level-list').querySelectorAll('button')) {
    button.setAttribute('aria-checked', button.dataset.level === level.id ? 'true' : 'false');
  }
}

function buildLevels() {
  const list = $('level-list');
  list.replaceChildren(...LEVELS.map((level) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'radio';
    button.dataset.level = level.id;
    button.setAttribute('aria-label', `${level.name}, ${level.range}. ${level.blurb}`);
    const name = document.createElement('span');
    name.className = 'level-name';
    name.textContent = level.name;
    const range = document.createElement('span');
    range.className = 'level-range';
    range.textContent = level.range;
    button.append(name, range);
    return button;
  }));
  paintLevels();
}

function init() {
  load();
  for (let sq = 0; sq < 64; sq++) {
    const el = document.createElement('div');
    const dark = ((sq & 7) + (sq >> 3)) % 2 === 0;
    el.className = dark ? 'sq dark' : 'sq light';
    el.dataset.sq = String(sq);
    el.setAttribute('role', 'gridcell');
    board.append(el);
    squares[sq] = el;
  }
  for (const piece of freshRoster()) {
    const el = document.createElement('div');
    el.className = 'piece';
    el.dataset.kind = piece.color + piece.type;
    el.innerHTML = pieceMarkup(piece.color, piece.type);
    board.append(el);
    pieceEls.set(piece.id, el);
    el.addEventListener('animationend', () => {
      el.classList.remove('taking');
      if (live) paintTrays(live.roster);
    });
  }
  $('sound').textContent = state.sound ? 'Sound on' : 'Sound off';
  $('sound').setAttribute('aria-pressed', state.sound ? 'true' : 'false');
  bind();
  applySeason(false);
  resizeCanvas();
  if (!reduceMotion) requestAnimationFrame(frame);
  refresh(false);
  scheduleAi();
}

init();
