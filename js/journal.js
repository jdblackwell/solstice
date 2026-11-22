export const JOURNAL_LIMIT = 40;

const KINDS = new Set(['mate', 'resign', 'stalemate', 'fifty', 'repetition', 'material']);
const SEASONS = new Set(['spring', 'summer', 'autumn', 'winter']);

export function emptyJournal() {
  return { v: 1, games: [] };
}

export function parseJournal(raw) {
  try {
    const data = JSON.parse(raw || 'null');
    if (!data || data.v !== 1 || !Array.isArray(data.games)) return emptyJournal();
    const games = [];
    for (const entry of data.games) {
      const clean = sanitize(entry);
      if (clean) games.push(clean);
      if (games.length === JOURNAL_LIMIT) break;
    }
    return { v: 1, games };
  } catch {
    return emptyJournal();
  }
}

export function remember(journal, entry) {
  const clean = sanitize(entry);
  if (!clean) return journal;
  const index = journal.games.findIndex((game) => game.id === clean.id);
  if (index === -1) {
    return { v: 1, games: [clean, ...journal.games].slice(0, JOURNAL_LIMIT) };
  }
  const stored = { ...clean, at: journal.games[index].at };
  if (sameGame(journal.games[index], stored)) return journal;
  const games = journal.games.slice();
  games.splice(index, 1);
  games.unshift(stored);
  return { v: 1, games };
}

export function forget(journal, id) {
  const games = journal.games.filter((game) => game.id !== id);
  if (games.length === journal.games.length) return journal;
  return { v: 1, games };
}

export function resultTitle(over) {
  if (over?.kind === 'mate' || over?.kind === 'resign') {
    return `${over.winner === 'w' ? 'White' : 'Black'} wins`;
  }
  if (KINDS.has(over?.kind)) return 'Drawn';
  return 'Unfinished';
}

export function resultNote(over) {
  switch (over?.kind) {
    case 'mate': return 'Checkmate';
    case 'resign': return 'Resignation';
    case 'stalemate': return 'Stalemate';
    case 'fifty': return 'Fifty-move rule';
    case 'repetition': return 'Threefold repetition';
    case 'material': return 'Insufficient material';
    default: return '';
  }
}

function sanitize(entry) {
  if (!entry || typeof entry.id !== 'string' || !entry.id) return null;
  if (!Number.isFinite(entry.at)) return null;
  if (!Array.isArray(entry.moves) || entry.moves.length === 0) return null;
  const moves = [];
  for (const move of entry.moves) {
    const clean = cleanMove(move);
    if (!clean) return null;
    moves.push(clean);
  }
  const over = cleanOver(entry.over);
  if (!over) return null;
  const human = entry.human === 'w' || entry.human === 'b' ? entry.human : null;
  const level = typeof entry.level === 'string' ? entry.level : null;
  const season = SEASONS.has(entry.season) ? entry.season : null;
  return { id: entry.id, at: entry.at, moves, human, level, over, season };
}

function cleanMove(move) {
  if (!move || !Number.isInteger(move.from) || !Number.isInteger(move.to)) return null;
  if (move.from < 0 || move.from > 63 || move.to < 0 || move.to > 63) return null;
  const promo = move.promo || null;
  if (promo && (typeof promo !== 'string' || !'qrbn'.includes(promo))) return null;
  return { from: move.from, to: move.to, promo };
}

function cleanOver(over) {
  if (!over || !KINDS.has(over.kind)) return null;
  if (over.kind === 'mate' || over.kind === 'resign') {
    if (over.winner !== 'w' && over.winner !== 'b') return null;
    return { kind: over.kind, winner: over.winner };
  }
  return { kind: over.kind };
}

function sameGame(saved, next) {
  if (saved.human !== next.human || saved.level !== next.level || saved.season !== next.season) return false;
  if (saved.over.kind !== next.over.kind || saved.over.winner !== next.over.winner) return false;
  if (saved.moves.length !== next.moves.length) return false;
  return saved.moves.every((move, i) => {
    const other = next.moves[i];
    return move.from === other.from && move.to === other.to && move.promo === other.promo;
  });
}
