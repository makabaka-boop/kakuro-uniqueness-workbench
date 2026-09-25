import {
  MAX_COLS,
  MAX_ROWS,
  MAX_RUN,
  MAX_SUM,
  MAX_WHITE,
  MIN_RUN,
  MIN_SUM,
  clueKey,
  whiteCount,
  type Puzzle
} from './types';
import { combosFor } from './combinations';

export type RunDir = 'across' | 'down';

export interface Run {
  id: number;
  dir: RunDir;
  /** 行内白格索引（r*cols+c），按线方向排列。 */
  cells: number[];
  /** 携带线索的黑格索引；线贴着棋盘边缘时没有。 */
  clueCell: number | null;
  /** 线索值；未填写为 undefined。 */
  sum: number | undefined;
}

export interface Analysis {
  runs: Run[];
  /** 每个格子所属的横线 id；黑格为 -1。 */
  acrossOf: number[];
  /** 每个格子所属的竖线 id；黑格为 -1。 */
  downOf: number[];
  /** 结构性错误：出现即不可求解。 */
  errors: string[];
  /** 非阻塞提示。 */
  warnings: string[];
  /** 有横/竖线尚未填写线索。 */
  missingClues: string[];
  /** errors 为空。 */
  ok: boolean;
  /** ok 且所有线都有合法线索，可以求解。 */
  complete: boolean;
}

function rc(cols: number, idx: number): string {
  return `第 ${Math.floor(idx / cols) + 1} 行第 ${(idx % cols) + 1} 列`;
}

function runName(cols: number, dir: RunDir, cells: number[]): string {
  const head = cells[0]!;
  const r = Math.floor(head / cols) + 1;
  const c = (head % cols) + 1;
  return dir === 'across' ? `第 ${r} 行自第 ${c} 列起的横线` : `第 ${c} 列自第 ${r} 行起的竖线`;
}

/** 校验单个线索值是否为 3..45 的整数。 */
export function clueValueError(sum: number): string | null {
  if (typeof sum !== 'number' || Number.isNaN(sum)) return '线索不是数字';
  if (!Number.isInteger(sum)) return `线索 ${sum} 不是整数`;
  if (sum < MIN_SUM || sum > MAX_SUM) return `线索 ${sum} 超出 ${MIN_SUM}～${MAX_SUM} 的范围`;
  return null;
}

/**
 * 从棋盘提取全部横/竖线并做结构校验：
 * - 棋盘 ≤10×10、白格 ≤28；
 * - 每条连续白格长度 2～6（保证每个白格恰属一条横线与一条竖线）；
 * - 每条线必须有线索格，线索为 3..45 的整数且该长度下可凑出。
 */
export function analyze(p: Puzzle): Analysis {
  const { rows, cols, cells } = p;
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingClues: string[] = [];
  const runs: Run[] = [];
  const acrossOf = new Array<number>(rows * cols).fill(-1);
  const downOf = new Array<number>(rows * cols).fill(-1);

  if (rows < 1 || rows > MAX_ROWS || cols < 1 || cols > MAX_COLS) {
    errors.push(`棋盘尺寸 ${rows}×${cols} 超出限制（最大 ${MAX_ROWS}×${MAX_COLS}）`);
  }
  const whites = whiteCount(p);
  if (whites > MAX_WHITE) {
    errors.push(`白格数量 ${whites} 超过上限 ${MAX_WHITE}`);
  }
  if (whites === 0) {
    warnings.push('棋盘没有白格');
  }

  const addRun = (dir: RunDir, runCells: number[], clueCell: number | null) => {
    const id = runs.length;
    const name = runName(cols, dir, runCells);
    const len = runCells.length;
    if (len < MIN_RUN || len > MAX_RUN) {
      const where = runCells.map((i) => rc(cols, i)).join('、');
      errors.push(`${name}（${where}）长度为 ${len}，连续白格长度须为 ${MIN_RUN}～${MAX_RUN}`);
    }
    let sum: number | undefined;
    if (clueCell === null) {
      errors.push(`${name}贴着棋盘边缘，没有可填写线索的黑格`);
    } else {
      const clue = p.clues[clueKey(Math.floor(clueCell / cols), clueCell % cols)];
      sum = clue ? (dir === 'across' ? clue.across : clue.down) : undefined;
      if (sum === undefined) {
        missingClues.push(`${name}缺少线索`);
      } else {
        const bad = clueValueError(sum);
        if (bad) {
          errors.push(`${name}的线索非法：${bad}`);
        } else if (len >= MIN_RUN && len <= MAX_RUN && combosFor(len, sum).length === 0) {
          errors.push(`${name}的线索 ${sum} 无法用 ${len} 个互不相同的 1～9 数字凑出`);
        }
      }
    }
    runs.push({ id, dir, cells: runCells, clueCell, sum });
    const book = dir === 'across' ? acrossOf : downOf;
    for (const i of runCells) book[i] = id;
  };

  // 横线：每行的极大连续白格段
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (cells[r * cols + c] !== 'white') {
        c++;
        continue;
      }
      const start = c;
      while (c < cols && cells[r * cols + c] === 'white') c++;
      const runCells: number[] = [];
      for (let k = start; k < c; k++) runCells.push(r * cols + k);
      const clueCell = start > 0 && cells[r * cols + start - 1] === 'black' ? r * cols + start - 1 : null;
      addRun('across', runCells, clueCell);
    }
  }
  // 竖线：每列的极大连续白格段
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      if (cells[r * cols + c] !== 'white') {
        r++;
        continue;
      }
      const start = r;
      while (r < rows && cells[r * cols + c] === 'white') r++;
      const runCells: number[] = [];
      for (let k = start; k < r; k++) runCells.push(k * cols + c);
      const clueCell = start > 0 && cells[(start - 1) * cols + c] === 'black' ? (start - 1) * cols + c : null;
      addRun('down', runCells, clueCell);
    }
  }

  // 每个白格必须恰属一条合法横线与一条合法竖线
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== 'white') continue;
    const a = acrossOf[i]!;
    const d = downOf[i]!;
    const aLen = a >= 0 ? runs[a]!.cells.length : 0;
    const dLen = d >= 0 ? runs[d]!.cells.length : 0;
    if (aLen < MIN_RUN) errors.push(`${rc(cols, i)}的白格不属于任何横线（横向须连续 ${MIN_RUN}～${MAX_RUN} 格）`);
    if (dLen < MIN_RUN) errors.push(`${rc(cols, i)}的白格不属于任何竖线（纵向须连续 ${MIN_RUN}～${MAX_RUN} 格）`);
  }

  // 挂在黑格上却不属于任何线起点的线索
  for (const key of Object.keys(p.clues)) {
    const [r, c] = key.split(',').map(Number);
    const idx = r! * cols + c!;
    if (cells[idx] !== 'black') {
      warnings.push(`${rc(cols, idx)}不是黑格，其线索被忽略`);
      continue;
    }
    const starts = runs.some((run) => run.clueCell === idx);
    if (!starts) warnings.push(`${rc(cols, idx)}的线索不在任何线的起点，已被忽略`);
  }

  const ok = errors.length === 0;
  return {
    runs,
    acrossOf,
    downOf,
    errors,
    warnings,
    missingClues,
    ok,
    complete: ok && missingClues.length === 0 && runs.length > 0
  };
}
