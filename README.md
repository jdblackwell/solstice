# Solstice

Chess, in the light of the year. The board keeps the northern seasons: spring from March, summer from June, autumn from September, and winter from December. You can step into another season without waiting for it.

```bash
python3 -m http.server 8734
```

Then open http://localhost:8734. Opening the files directly will not load the game.

Play two people at one board, or start a game as White or Black and the computer answers. Against the computer, choose an experience from beginner (under 1200) through senior master (2400 and up). Castling, en passant, promotion, and the usual draws are all played.

| Key | Action |
| --- | --- |
| Drag or click | Move a piece |
| Arrows, Enter | Move from the keyboard |
| N | New game |
| U or Ctrl+Z | Undo |
| F | Flip the board |
| M | Sound |
| 1–4 | Spring, summer, autumn, winter |
| 0 | Follow the date |
| ? | Show the keys |
| Esc | Cancel |

The four paintings live in `assets/`. The pieces are drawn in the page, so they stay sharp and take on the season’s metal.
