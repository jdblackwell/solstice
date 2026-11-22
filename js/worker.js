import { parseFen } from './chess.js';
import { chooseMove } from './ai.js';

self.onmessage = (event) => {
  const { fen, ms, depth, token, book, slip, noise, qply } = event.data;
  try {
    const move = chooseMove(parseFen(fen), {
      ms,
      maxDepth: depth,
      book: book !== false,
      slip: slip || 0,
      noise: noise || 0,
      qply: qply ?? 8,
    });
    self.postMessage({ token, move });
  } catch (error) {
    self.postMessage({ token, error: String(error) });
  }
};
