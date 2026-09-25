import { analyze } from '../lib/model';
import type { Puzzle } from '../lib/types';

/**
 * 测试专用的独立暴力枚举：按行优先顺序逐格试 1..9，
 * 只做局部约束检查（线内不重复、部分和可达、完成时和相等），
 * 不使用求解器的组合传播，以便交叉验证。
 * 按字典序收集前 limit 个解。
 */
export function bruteForceTwo(p: Puzzle, limit = 2): number[][] {
  const a = analyze(p);
  if (!a.complete) throw new Error('brute force requires a complete puzzle');

  const { rows, cols } = p;
  const values = new Array<number>(rows * cols).fill(0);
  const whiteOrder: number[] = [];
  for (let i = 0; i < rows * cols; i++) if (a.acrossOf[i]! >= 0 || a.downOf[i]! >= 0) whiteOrder.push(i);

  // 每个格子的所属线及其在线内位置
  const runsOf = (idx: number) =>
    [a.acrossOf[idx]!, a.downOf[idx]!]
      .filter((id) => id >= 0)
      .map((id) => ({ run: a.runs[id]!, pos: a.runs[id]!.cells.indexOf(idx) }));

  const solutions: number[][] = [];

  const okWith = (idx: number, d: number): boolean => {
    for (const { run, pos } of runsOf(idx)) {
      const len = run.cells.length;
      const used = new Set<number>([d]);
      let sum = d;
      let assigned = 1;
      for (let k = 0; k < len; k++) {
        if (k === pos) continue;
        const v = values[run.cells[k]!]!;
        if (v === 0) continue;
        if (used.has(v)) return false;
        used.add(v);
        sum += v;
        assigned++;
      }
      const clue = run.sum!;
      const remaining = len - assigned;
      if (remaining === 0) {
        if (sum !== clue) return false;
      } else {
        // 剩余格子能凑出的最小/最大和（避开已用数字）
        const avail: number[] = [];
        for (let x = 1; x <= 9; x++) if (!used.has(x)) avail.push(x);
        if (avail.length < remaining) return false;
        let lo = 0;
        for (let k = 0; k < remaining; k++) lo += avail[k]!;
        let hi = 0;
        for (let k = 0; k < remaining; k++) hi += avail[avail.length - 1 - k]!;
        if (sum + lo > clue || sum + hi < clue) return false;
      }
    }
    return true;
  };

  const walk = (k: number): boolean => {
    if (solutions.length >= limit) return false;
    if (k === whiteOrder.length) {
      solutions.push(values.slice());
      return true;
    }
    const idx = whiteOrder[k]!;
    for (let d = 1; d <= 9; d++) {
      if (!okWith(idx, d)) continue;
      values[idx] = d;
      if (!walk(k + 1)) {
        values[idx] = 0;
        return false;
      }
      values[idx] = 0;
    }
    return true;
  };

  walk(0);
  return solutions;
}

/** 行优先字典序比较两份填法。 */
export function compareSolutions(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i]! - b[i]!;
  }
  return 0;
}
