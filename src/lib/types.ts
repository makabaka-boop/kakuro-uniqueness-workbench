/** 棋盘与线索的纯数据模型（可序列化，便于测试与存储）。 */

export type CellKind = 'black' | 'white';

/** 黑格上的线索：across 为右侧横线的和，down 为下方竖线的和。 */
export interface Clue {
  across?: number;
  down?: number;
}

export interface Puzzle {
  rows: number; // 1..10
  cols: number; // 1..10
  cells: CellKind[]; // 长度 rows*cols，按行优先
  clues: Record<string, Clue>; // 键为 "r,c"，只挂在黑格上
}

export const MAX_ROWS = 10;
export const MAX_COLS = 10;
export const MAX_WHITE = 28;
export const MIN_RUN = 2;
export const MAX_RUN = 6;
export const MIN_SUM = 3;
export const MAX_SUM = 45;

export function clueKey(r: number, c: number): string {
  return `${r},${c}`;
}

export function createPuzzle(rows: number, cols: number): Puzzle {
  return {
    rows,
    cols,
    cells: Array.from({ length: rows * cols }, () => 'black' as CellKind),
    clues: {}
  };
}

export function whiteCount(p: Puzzle): number {
  let n = 0;
  for (const k of p.cells) if (k === 'white') n++;
  return n;
}
