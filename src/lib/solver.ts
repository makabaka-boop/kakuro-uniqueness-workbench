import { analyze, type Analysis } from './model';
import { combosFor } from './combinations';
import type { Puzzle } from './types';

const ALL_DIGITS = 0x3fe; // 位 1..9

export function bitOf(d: number): number {
  return 1 << d;
}

export function digitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & (1 << d)) out.push(d);
  return out;
}

/** 每条线的候选元组列表：tuples[runId] = 剩余可行填法；null 表示该线暂无约束（缺线索）。 */
export type TupleSets = (number[][] | null)[];

export function initialTuples(a: Analysis, relaxMissing = false): TupleSets {
  return a.runs.map((run) => {
    if (run.sum === undefined) return relaxMissing ? null : combosFor(run.cells.length, 0);
    return combosFor(run.cells.length, run.sum);
  });
}

/**
 * 约束传播到不动点：
 * 白格候选 = 所属横线该位置的可用数字 ∩ 所属竖线该位置的可用数字；
 * 元组中某位置数字不在对应白格候选内则剔除。
 * 返回收缩后的元组列表与每个白格的候选位掩码；矛盾时返回 null。
 */
export function propagate(a: Analysis, tuples: TupleSets): { tuples: TupleSets; masks: number[] } | null {
  const n = a.acrossOf.length;
  let cur = tuples;
  const masks = new Array<number>(n).fill(0);
  for (let iter = 0; ; iter++) {
    if (iter > 4 * n + 8) throw new Error('propagation did not converge');
    // 由元组汇总每个白格的候选
    for (let i = 0; i < n; i++) masks[i] = a.acrossOf[i]! >= 0 || a.downOf[i]! >= 0 ? 0 : -1;
    const posMasks = cur.map((list, runId) => {
      const len = a.runs[runId]!.cells.length;
      if (list === null) return new Array<number>(len).fill(ALL_DIGITS);
      const pm = new Array<number>(len).fill(0);
      for (const t of list) for (let k = 0; k < len; k++) pm[k]! |= 1 << t[k]!;
      return pm;
    });
    let shrunk = false;
    for (let i = 0; i < n; i++) {
      const ra = a.acrossOf[i]!;
      const rd = a.downOf[i]!;
      if (ra < 0 && rd < 0) continue;
      let m = ALL_DIGITS;
      if (ra >= 0) m &= posMasks[ra]![a.runs[ra]!.cells.indexOf(i)]!;
      if (rd >= 0) m &= posMasks[rd]![a.runs[rd]!.cells.indexOf(i)]!;
      masks[i] = m;
      if (m === 0) return null;
    }
    // 用白格候选过滤元组
    const next: TupleSets = cur.map((list, runId) => {
      if (list === null) return null;
      const cells = a.runs[runId]!.cells;
      const kept = list.filter((t) => t.every((d, k) => (masks[cells[k]!]! & (1 << d)) !== 0));
      if (kept.length !== list.length) shrunk = true;
      return kept;
    });
    for (const list of next) if (list !== null && list.length === 0) return null;
    cur = next;
    if (!shrunk) return { tuples: cur, masks };
  }
}

/** 当前每个白格的候选数字（纯传播阶段，不含猜测；缺线索的线按不约束处理）。 */
export function candidateMasks(a: Analysis): number[] | null {
  const res = propagate(a, initialTuples(a, true));
  return res ? res.masks : null;
}

export type SolveOutcome =
  | { kind: 'invalid'; errors: string[]; missingClues: string[] }
  | { kind: 'none' }
  | { kind: 'unique'; solution: number[] }
  | { kind: 'multiple'; solutions: [number[], number[]] };

/**
 * 求解：传播 + 回溯。按行优先顺序选未定白格、数字升序尝试，
 * 因此解按行优先字典序枚举；找到两个即停，保证给出的两份
 * 完整填法就是字典序最小的两份，且绝不会把多解误报为唯一解。
 */
export function solvePuzzle(p: Puzzle): SolveOutcome {
  const a = analyze(p);
  if (!a.complete) return { kind: 'invalid', errors: a.errors, missingClues: a.missingClues };

  const start = propagate(a, initialTuples(a));
  if (!start) return { kind: 'none' };

  const { rows, cols } = p;
  const values = new Array<number>(rows * cols).fill(0);
  const whiteOrder: number[] = [];
  for (let i = 0; i < rows * cols; i++) if (a.acrossOf[i]! >= 0 || a.downOf[i]! >= 0) whiteOrder.push(i);

  const solutions: number[][] = [];

  const restrict = (tuples: TupleSets, cell: number, d: number): TupleSets => {
    const out = tuples.slice();
    for (const runId of [a.acrossOf[cell]!, a.downOf[cell]!]) {
      if (runId < 0) continue;
      const list = out[runId];
      if (!list) continue;
      const pos = a.runs[runId]!.cells.indexOf(cell);
      out[runId] = list.filter((t) => t[pos] === d);
    }
    return out;
  };

  const search = (tuples: TupleSets, masks: number[]): boolean => {
    // 返回 false 表示已集满两个解、应停止
    let target = -1;
    for (const i of whiteOrder)
      if (values[i] === 0) {
        target = i;
        break;
      }
    if (target < 0) {
      solutions.push(values.slice());
      return solutions.length < 2;
    }
    for (const d of digitsOf(masks[target]!)) {
      const res = propagate(a, restrict(tuples, target, d));
      if (!res) continue;
      values[target] = d;
      const cont = search(res.tuples, res.masks);
      values[target] = 0;
      if (!cont) return false;
    }
    return true;
  };

  search(start.tuples, start.masks);

  if (solutions.length === 0) return { kind: 'none' };
  if (solutions.length === 1) return { kind: 'unique', solution: solutions[0]! };
  return { kind: 'multiple', solutions: [solutions[0]!, solutions[1]!] };
}

/** 独立校验一份完整填法：白格均为 1..9，每条线数字不重复且和等于线索。 */
export function checkSolution(p: Puzzle, values: number[]): boolean {
  const a = analyze(p);
  if (!a.complete) return false;
  for (const run of a.runs) {
    const seen = new Set<number>();
    let sum = 0;
    for (const i of run.cells) {
      const v = values[i]!;
      if (v < 1 || v > 9 || seen.has(v)) return false;
      seen.add(v);
      sum += v;
    }
    if (sum !== run.sum) return false;
  }
  return true;
}
