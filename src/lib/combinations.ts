/**
 * 生成“len 个互不相同的 1..9 数字、和为 sum”的全部有序填法（元组）。
 * 元组按行内位置排列，因此同一数字集合的不同排列都算不同元组。
 */

const tupleCache = new Map<string, number[][]>();
const setCache = new Map<number, number[][]>();

/** 1..9 中取 len 个不同数字的全部集合（升序数组），与和无关。 */
export function digitSets(len: number): number[][] {
  const cached = setCache.get(len);
  if (cached) return cached;
  const out: number[][] = [];
  const cur: number[] = [];
  const walk = (start: number) => {
    if (cur.length === len) {
      out.push(cur.slice());
      return;
    }
    for (let d = start; d <= 9; d++) {
      cur.push(d);
      walk(d + 1);
      cur.pop();
    }
  };
  walk(1);
  setCache.set(len, out);
  return out;
}

function permutations(set: number[]): number[][] {
  if (set.length <= 1) return [set.slice()];
  const out: number[][] = [];
  for (let i = 0; i < set.length; i++) {
    const rest = set.slice(0, i).concat(set.slice(i + 1));
    for (const tail of permutations(rest)) out.push([set[i]!, ...tail]);
  }
  return out;
}

/** 长度为 len、和为 sum 的全部有序元组；无可行组合时返回空数组。 */
export function combosFor(len: number, sum: number): number[][] {
  const key = `${len}:${sum}`;
  const cached = tupleCache.get(key);
  if (cached) return cached;
  const out: number[][] = [];
  for (const set of digitSets(len)) {
    let s = 0;
    for (const d of set) s += d;
    if (s === sum) for (const p of permutations(set)) out.push(p);
  }
  tupleCache.set(key, out);
  return out;
}

/** 该长度下可凑出的最小和（1+2+…+len）。 */
export function minSum(len: number): number {
  return (len * (len + 1)) / 2;
}

/** 该长度下可凑出的最大和（9+8+…）。 */
export function maxSum(len: number): number {
  return (len * (19 - len)) / 2;
}
