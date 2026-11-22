import test from 'node:test';
import assert from 'node:assert/strict';
import {
  START, parseFen, fen, legalMoves, makeMove, unmakeMove, san, perft,
  outcome, positionKey, deadPosition, parseSquare, moveName, ascii,
} from '../js/chess.js';
import { chooseMove, LEVELS } from '../js/ai.js';

function play(pos, from, to, promo) {
  const move = legalMoves(pos).find((m) => m.from === parseSquare(from) && m.to === parseSquare(to) && (m.promo || null) === (promo || null));
  assert.ok(move, `no move ${from}${to}${promo || ''} in\n${ascii(pos)}`);
  return move;
}

test('starting position', () => {
  const pos = parseFen(START);
  assert.equal(fen(pos), START);
  assert.equal(legalMoves(pos).length, 20);
  assert.equal(perft(pos, 1), 20);
  assert.equal(perft(pos, 2), 400);
  assert.equal(perft(pos, 3), 8902);
  assert.equal(perft(pos, 4), 197281);
});

test('known perft positions', () => {
  const kiwipete = parseFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  assert.equal(perft(kiwipete, 1), 48);
  assert.equal(perft(kiwipete, 2), 2039);
  assert.equal(perft(kiwipete, 3), 97862);

  const pos3 = parseFen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
  assert.equal(perft(pos3, 1), 14);
  assert.equal(perft(pos3, 2), 191);
  assert.equal(perft(pos3, 3), 2812);
  assert.equal(perft(pos3, 4), 43238);

  const pos4 = parseFen('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1');
  assert.equal(perft(pos4, 1), 6);
  assert.equal(perft(pos4, 2), 264);
  assert.equal(perft(pos4, 3), 9467);
});

test('unmake restores the position', () => {
  const pos = parseFen(START);
  for (let i = 0; i < 40; i++) {
    const moves = legalMoves(pos);
    if (!moves.length) break;
    const before = fen(pos);
    const move = moves[(i * 7) % moves.length];
    const undo = makeMove(pos, move);
    unmakeMove(pos, move, undo);
    assert.equal(fen(pos), before);
    makeMove(pos, move);
  }
});

test('notation, mate, castling, promotion, en passant', () => {
  const pos = parseFen(START);
  const sans = [];
  for (const [from, to] of [['e2', 'e4'], ['e7', 'e5'], ['f1', 'c4'], ['b8', 'c6'], ['d1', 'h5'], ['g8', 'f6'], ['h5', 'f7']]) {
    const move = play(pos, from, to);
    sans.push(san(pos, move));
    makeMove(pos, move);
  }
  assert.deepEqual(sans, ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']);
  assert.equal(outcome(pos).kind, 'mate');

  const castle = parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const oo = play(castle, 'e1', 'g1');
  assert.equal(san(castle, oo), 'O-O');
  makeMove(castle, oo);
  assert.equal(castle.board[parseSquare('f1')], 'wr');
  assert.equal(castle.board[parseSquare('g1')], 'wk');
  assert.equal(castle.castling.includes('K'), false);
  assert.equal(castle.castling.includes('Q'), false);

  const blocked = parseFen('4k3/8/8/8/8/8/6r1/R3K2R w KQ - 0 1');
  const names = legalMoves(blocked).map(moveName);
  assert.equal(names.includes('e1g1'), false);
  assert.equal(names.includes('e1c1'), true);

  const promo = parseFen('7k/P7/8/8/8/8/8/7K w - - 0 1');
  const pawnMoves = legalMoves(promo).filter((m) => promo.board[m.from] === 'wp');
  assert.equal(pawnMoves.length, 4);
  const queen = pawnMoves.find((m) => m.promo === 'q');
  assert.equal(san(promo, queen), 'a8=Q+');

  const ep = parseFen(START);
  for (const [from, to] of [['e2', 'e4'], ['a7', 'a6'], ['e4', 'e5'], ['d7', 'd5']]) {
    makeMove(ep, play(ep, from, to));
  }
  assert.equal(ep.ep, parseSquare('d6'));
  const take = play(ep, 'e5', 'd6');
  assert.equal(san(ep, take), 'exd6');
  makeMove(ep, take);
  assert.equal(ep.board[parseSquare('d6')], 'wp');
  assert.equal(ep.board[parseSquare('d5')], null);
  assert.equal(ep.board[parseSquare('e5')], null);

  const pinned = parseFen('8/8/8/3KPpr1/8/8/8/k7 w - f6 0 1');
  assert.equal(legalMoves(pinned).some((m) => m.to === parseSquare('f6')), false);

  const knights = parseFen('8/8/8/8/2N1N3/8/8/K6k w - - 0 1');
  assert.equal(san(knights, play(knights, 'c4', 'd2')), 'Ncd2');
});

test('draws', () => {
  assert.equal(deadPosition(parseFen('8/8/8/8/8/8/8/K6k w - - 0 1')), true);
  assert.equal(deadPosition(parseFen('8/8/8/8/8/8/6N1/K6k w - - 0 1')), true);
  assert.equal(deadPosition(parseFen('8/8/8/8/8/8/6B1/K6k w - - 0 1')), true);
  assert.equal(deadPosition(parseFen('8/8/8/8/8/5b2/6B1/K6k w - - 0 1')), true);
  assert.equal(deadPosition(parseFen('8/8/8/8/8/4b3/6B1/K6k w - - 0 1')), false);
  assert.equal(deadPosition(parseFen('8/8/8/8/8/8/6R1/K6k w - - 0 1')), false);

  const pos = parseFen('8/8/8/8/8/8/8/K6k w - - 100 80');
  assert.equal(outcome(pos).kind, 'fifty');

  const quiet = parseFen('8/8/8/8/8/7p/7P/K6k w - - 0 1');
  const keys = [];
  for (let i = 0; i < 3; i++) {
    keys.push(positionKey(quiet));
    makeMove(quiet, play(quiet, 'a1', 'a2'));
    keys.push(positionKey(quiet));
    makeMove(quiet, play(quiet, 'h1', 'g1'));
    keys.push(positionKey(quiet));
    makeMove(quiet, play(quiet, 'a2', 'a1'));
    keys.push(positionKey(quiet));
    makeMove(quiet, play(quiet, 'g1', 'h1'));
  }
  keys.push(positionKey(quiet));
  assert.equal(outcome(quiet, keys).kind, 'repetition');
});

test('the search finds mate in one', () => {
  const pos = parseFen('rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2');
  const move = chooseMove(pos, { maxDepth: 2, ms: 2000 });
  assert.equal(moveName(move), 'd8h4');
  assert.equal(san(pos, move), 'Qh4#');
});

test('experience levels climb from beginner to senior master', () => {
  assert.deepEqual(LEVELS.map((level) => level.id), ['e', 'd', 'c', 'b', 'a', 'x', 'm', 's']);
  for (let i = 1; i < LEVELS.length; i++) {
    assert.ok(LEVELS[i].depth >= LEVELS[i - 1].depth);
    assert.ok(LEVELS[i].ms >= LEVELS[i - 1].ms);
    assert.ok(LEVELS[i].slip <= LEVELS[i - 1].slip);
  }
  const pos = parseFen(START);
  const beginner = LEVELS[0];
  const move = chooseMove(pos, {
    maxDepth: beginner.depth,
    ms: beginner.ms,
    book: false,
    slip: 1,
    noise: 0,
    qply: beginner.qply,
  });
  assert.ok(legalMoves(pos).some((candidate) => candidate.from === move.from && candidate.to === move.to));
});
