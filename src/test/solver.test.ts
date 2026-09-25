import { describe, expect, it } from 'vitest';
import { combosFor, maxSum, minSum } from '../lib/combinations';
import { analyze } from '../lib/model';
import { candidateMasks, checkSolution, digitsOf, solvePuzzle, type SolveOutcome } from '../lib/solver';
import { SAMPLE_PUZZLE, SAMPLE_SOLUTION } from '../lib/sample';
import { createPuzzle, type CellKind, type Puzzle } from '../lib/types';
import { bruteForceTwo, compareSolutions } from './brute';

/** 2×2 白格块（外围黑格放线索）。 */
function block22(clues: Puzzle['clues']): Puzzle {
  return {
    rows: 3,
    cols: 3,
    cells: [
      'black', 'black', 'black',
      'black', 'white', 'white',
      'black', 'white', 'white'
    ],
    clues
  };
}

const ALL5 = block22({
  '0,1': { down: 5 },
  '0,2': { down: 5 },
  '1,0': { across: 5 },
  '2,0': { across: 5 }
});

describe('组合生成 combosFor', () => {
  it('长度 2、和 5：{1,4} 与 {2,3} 的全部排列', () => {
    const tuples = combosFor(2, 5);
    expect(tuples).toHaveLength(4);
    for (const t of tuples) {
      expect(t).toHaveLength(2);
      expect(t[0]! + t[1]!).toBe(5);
      expect(new Set(t).size).toBe(2);
    }
    expect(new Set(tuples.map((t) => t.join('')))).toEqual(new Set(['14', '23', '32', '41']));
  });

  it('长度 3、和 6：只有 1,2,3 的 6 种排列', () => {
    expect(combosFor(3, 6)).toHaveLength(6);
  });

  it('不可行的和返回空数组', () => {
    expect(combosFor(2, 18)).toHaveLength(0); // 最大 9+8=17
    expect(combosFor(6, 20)).toHaveLength(0); // 最小 1+..+6=21
    expect(combosFor(6, 46)).toHaveLength(0);
  });

  it('minSum/maxSum 边界', () => {
    expect(minSum(2)).toBe(3);
    expect(maxSum(2)).toBe(17);
    expect(minSum(6)).toBe(21);
    expect(maxSum(6)).toBe(39);
    for (let len = 2; len <= 6; len++) {
      expect(combosFor(len, minSum(len)).length).toBeGreaterThan(0);
      expect(combosFor(len, maxSum(len)).length).toBeGreaterThan(0);
    }
  });
});

describe('内置示例盘面', () => {
  it('有唯一解且与记录一致', () => {
    const out = solvePuzzle(SAMPLE_PUZZLE);
    expect(out.kind).toBe('unique');
    if (out.kind === 'unique') {
      expect(out.solution).toEqual(SAMPLE_SOLUTION);
      expect(checkSolution(SAMPLE_PUZZLE, out.solution)).toBe(true);
    }
  });
});

describe('手工小盘面分类', () => {
  it('多解：2×2 全部和为 5，给出字典序最小的两份', () => {
    const out = solvePuzzle(ALL5);
    expect(out.kind).toBe('multiple');
    if (out.kind === 'multiple') {
      const [first, second] = out.solutions;
      expect(first).toEqual([0, 0, 0, 0, 1, 4, 0, 4, 1]);
      expect(second).toEqual([0, 0, 0, 0, 2, 3, 0, 3, 2]);
      expect(compareSolutions(first, second)).toBeLessThan(0);
      expect(checkSolution(ALL5, first)).toBe(true);
      expect(checkSolution(ALL5, second)).toBe(true);
    }
  });

  it('无解：竖线和相互矛盾', () => {
    const p = block22({
      '0,1': { down: 5 },
      '0,2': { down: 6 },
      '1,0': { across: 5 },
      '2,0': { across: 5 }
    });
    expect(solvePuzzle(p).kind).toBe('none');
  });

  it('传播候选：2×2 和为 5 时每格候选为 1..4', () => {
    const a = analyze(ALL5);
    const masks = candidateMasks(a);
    expect(masks).not.toBeNull();
    for (const idx of [4, 5, 7, 8]) expect(digitsOf(masks![idx]!)).toEqual([1, 2, 3, 4]);
  });
});

describe('非法输入校验', () => {
  const shape = () => block22({});

  it('线索越界 / 非整数', () => {
    for (const bad of [2, 46, 2.5, 0, -3, Number.NaN]) {
      const p = shape();
      p.clues['1,0'] = { across: bad };
      const a = analyze(p);
      expect(a.ok).toBe(false);
      expect(a.errors.join('\n')).toMatch(/线索/);
    }
  });

  it('线索在该长度下凑不出', () => {
    const p = shape();
    p.clues['1,0'] = { across: 18 }; // 两格最大 17
    const a = analyze(p);
    expect(a.errors.join('\n')).toMatch(/无法用 2 个/);
  });

  it('孤立白格（长度 1 的线）', () => {
    const p = createPuzzle(3, 3);
    p.cells[4] = 'white';
    const a = analyze(p);
    expect(a.errors.join('\n')).toMatch(/长度为 1/);
    expect(a.errors.join('\n')).toMatch(/不属于任何横线/);
    expect(a.errors.join('\n')).toMatch(/不属于任何竖线/);
  });

  it('连续白格超过 6', () => {
    const p = createPuzzle(3, 9);
    for (let c = 1; c <= 7; c++) p.cells[1 * 9 + c] = 'white';
    const a = analyze(p);
    expect(a.errors.join('\n')).toMatch(/长度为 7/);
  });

  it('贴边的线没有线索格', () => {
    const p = createPuzzle(2, 4);
    p.cells[0] = 'white';
    p.cells[1] = 'white';
    const a = analyze(p);
    expect(a.errors.join('\n')).toMatch(/没有可填写线索的黑格/);
  });

  it('白格数量超过 28', () => {
    const p = createPuzzle(4, 8);
    p.cells = p.cells.map(() => 'white' as CellKind);
    const a = analyze(p);
    expect(a.errors.join('\n')).toMatch(/白格数量 32 超过上限 28/);
  });

  it('缺少线索时不允许求解', () => {
    const p = shape(); // 四条线都没有线索
    const out = solvePuzzle(p);
    expect(out.kind).toBe('invalid');
    if (out.kind === 'invalid') expect(out.missingClues.length).toBe(4);
  });
});

// ---------------- 随机小盘面：求解器 vs 全枚举 ----------------

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomShape(rand: () => number): Puzzle | null {
  const rows = 3 + Math.floor(rand() * 4); // 3..6
  const cols = 3 + Math.floor(rand() * 4); // 3..6
  const p = createPuzzle(rows, cols);
  for (let r = 1; r < rows; r++)
    for (let c = 1; c < cols; c++) p.cells[r * cols + c] = rand() < 0.62 ? 'white' : 'black';
  const a = analyze(p);
  if (!a.ok) return null;
  const whites = p.cells.filter((k) => k === 'white').length;
  if (whites < 4 || whites > 22) return null;
  return p;
}

function randomDigits(rand: () => number, p: Puzzle): number[] | null {
  const a = analyze(p);
  const values = new Array<number>(p.rows * p.cols).fill(0);
  for (let attempt = 0; attempt < 4000; attempt++) {
    for (let i = 0; i < values.length; i++)
      values[i] = p.cells[i] === 'white' ? 1 + Math.floor(rand() * 9) : 0;
    let ok = true;
    for (const run of a.runs) {
      const seen = new Set<number>();
      for (const i of run.cells) {
        if (seen.has(values[i]!)) {
          ok = false;
          break;
        }
        seen.add(values[i]!);
      }
      if (!ok) break;
    }
    if (ok) return values.slice();
  }
  return null;
}

function cluesFromSolution(p: Puzzle, values: number[]): Puzzle {
  const a = analyze(p);
  const clues: Puzzle['clues'] = {};
  for (const run of a.runs) {
    let sum = 0;
    for (const i of run.cells) sum += values[i]!;
    const key = `${Math.floor(run.clueCell! / p.cols)},${run.clueCell! % p.cols}`;
    clues[key] ??= {};
    if (run.dir === 'across') clues[key]!.across = sum;
    else clues[key]!.down = sum;
  }
  return { ...p, clues };
}

function perturb(rand: () => number, p: Puzzle): Puzzle {
  const a = analyze(p);
  const run = a.runs[Math.floor(rand() * a.runs.length)]!;
  const delta = rand() < 0.5 ? -1 : 1;
  const len = run.cells.length;
  const cur = run.sum!;
  const next = Math.min(maxSum(len), Math.max(minSum(len), cur + delta));
  if (next === cur) return p;
  const clues: Puzzle['clues'] = JSON.parse(JSON.stringify(p.clues));
  const key = `${Math.floor(run.clueCell! / p.cols)},${run.clueCell! % p.cols}`;
  if (run.dir === 'across') clues[key]!.across = next;
  else clues[key]!.down = next;
  return { ...p, clues };
}

function randomizeClues(rand: () => number, p: Puzzle): Puzzle {
  const a = analyze(p);
  const clues: Puzzle['clues'] = {};
  for (const run of a.runs) {
    const len = run.cells.length;
    const sum = minSum(len) + Math.floor(rand() * (maxSum(len) - minSum(len) + 1));
    const key = `${Math.floor(run.clueCell! / p.cols)},${run.clueCell! % p.cols}`;
    clues[key] ??= {};
    if (run.dir === 'across') clues[key]!.across = sum;
    else clues[key]!.down = sum;
  }
  return { ...p, clues };
}

function expectAgreement(p: Puzzle) {
  const out = solvePuzzle(p);
  expect(out.kind).not.toBe('invalid'); // 生成器保证线索完整且可行
  const brute = bruteForceTwo(p, 2);

  const expectedKind = brute.length === 0 ? 'none' : brute.length === 1 ? 'unique' : 'multiple';
  expect(out.kind).toBe(expectedKind);

  if (out.kind === 'unique') {
    // 唯一解必须与全枚举一致，且确实没有第二个解
    expect(brute).toHaveLength(1);
    expect(out.solution).toEqual(brute[0]);
    expect(checkSolution(p, out.solution)).toBe(true);
  } else if (out.kind === 'multiple') {
    // 两个见证必须是字典序最小的两份完整填法
    expect(brute).toHaveLength(2);
    expect(out.solutions[0]).toEqual(brute[0]);
    expect(out.solutions[1]).toEqual(brute[1]);
    expect(compareSolutions(out.solutions[0], out.solutions[1])).toBeLessThan(0);
    expect(checkSolution(p, out.solutions[0])).toBe(true);
    expect(checkSolution(p, out.solutions[1])).toBe(true);
  }
}

describe('随机小盘面全枚举对照', () => {
  it('分类与见证在 150 个盘面 × 3 种线索下与暴力枚举一致', () => {
    const rand = mulberry32(20260925);
    let boards = 0;
    let counts: Record<SolveOutcome['kind'], number> = { invalid: 0, none: 0, unique: 0, multiple: 0 };
    let attempts = 0;
    while (boards < 150 && attempts < 20000) {
      attempts++;
      const shape = randomShape(rand);
      if (!shape) continue;
      const digits = randomDigits(rand, shape);
      if (!digits) continue;
      boards++;
      const solved = cluesFromSolution(shape, digits);
      for (const p of [solved, perturb(rand, solved), randomizeClues(rand, solved)]) {
        expectAgreement(p);
        counts[solvePuzzle(p).kind] += 1;
      }
    }
    expect(boards).toBe(150);
    // 三种分类都应被覆盖到
    expect(counts.none).toBeGreaterThan(0);
    expect(counts.unique).toBeGreaterThan(0);
    expect(counts.multiple).toBeGreaterThan(0);
  }, 120_000);
});
