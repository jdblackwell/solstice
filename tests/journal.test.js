import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JOURNAL_LIMIT, emptyJournal, parseJournal, remember, forget, resultTitle, resultNote,
} from '../js/journal.js';

const mate = { from: 12, to: 28, promo: null };
const reply = { from: 52, to: 36, promo: null };

function entry(id, moves = [mate, reply], over = { kind: 'mate', winner: 'b' }) {
  return {
    id,
    at: 1_700_000_000_000,
    moves,
    human: 'w',
    level: 'c',
    over,
    season: 'autumn',
  };
}

test('a journal ignores junk and keeps a finished game', () => {
  assert.deepEqual(parseJournal('nope'), emptyJournal());
  assert.deepEqual(parseJournal(JSON.stringify({ v: 2, games: [entry('a')] })), emptyJournal());
  const raw = JSON.stringify({
    v: 1,
    games: [entry('a'), { id: 'bad' }, entry('b', [], { kind: 'mate', winner: 'w' })],
  });
  const journal = parseJournal(raw);
  assert.deepEqual(journal.games.map((game) => game.id), ['a']);
  assert.equal(journal.games[0].moves[0].promo, null);
});

test('remember keeps the newest finished game and updates the same one', () => {
  const first = remember(emptyJournal(), entry('a'));
  const second = remember(first, entry('b'));
  assert.deepEqual(second.games.map((game) => game.id), ['b', 'a']);

  const same = remember(second, { ...entry('a'), at: 1_800_000_000_000 });
  assert.equal(same, second);

  const changed = remember(second, entry('a', [mate, reply, { from: 28, to: 36, promo: null }]));
  assert.equal(changed.games[0].id, 'a');
  assert.equal(changed.games[0].at, 1_700_000_000_000);
  assert.equal(changed.games[0].moves.length, 3);
  assert.deepEqual(changed.games.map((game) => game.id), ['a', 'b']);
});

test('an unfinished or empty game is not kept', () => {
  const journal = remember(emptyJournal(), entry('a'));
  assert.equal(remember(journal, entry('c', [mate], null)), journal);
  assert.equal(remember(journal, entry('c', [], { kind: 'resign', winner: 'b' })), journal);
  assert.equal(remember(journal, entry('c', [mate], { kind: 'resign' })), journal);
  const gone = forget(journal, 'a');
  assert.deepEqual(gone.games, []);
  assert.equal(forget(gone, 'a'), gone);
});

test('the journal lets the oldest page fall out', () => {
  let journal = emptyJournal();
  for (let i = 0; i < JOURNAL_LIMIT + 3; i++) journal = remember(journal, entry(`g${i}`));
  assert.equal(journal.games.length, JOURNAL_LIMIT);
  assert.equal(journal.games[0].id, `g${JOURNAL_LIMIT + 2}`);
  assert.equal(journal.games.at(-1).id, 'g3');
});

test('results read as wins and draws', () => {
  assert.equal(resultTitle({ kind: 'mate', winner: 'b' }), 'Black wins');
  assert.equal(resultTitle({ kind: 'resign', winner: 'w' }), 'White wins');
  assert.equal(resultTitle({ kind: 'stalemate' }), 'Drawn');
  assert.equal(resultNote({ kind: 'fifty' }), 'Fifty-move rule');
  assert.equal(resultNote({ kind: 'material' }), 'Insufficient material');
  assert.equal(resultTitle(null), 'Unfinished');
});
