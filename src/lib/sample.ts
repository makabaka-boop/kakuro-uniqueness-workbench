import type { Puzzle } from './types';

/**
 * 内置示例：4×6，12 个白格。
 * 测试会断言它有唯一解（见 solver.test.ts），改动后必须保持唯一。
 */
export const SAMPLE_PUZZLE: Puzzle = {
  rows: 4,
  cols: 6,
  cells: [
    'black', 'black', 'black', 'black', 'black', 'black',
    'black', 'white', 'white', 'black', 'white', 'white',
    'black', 'white', 'white', 'white', 'white', 'white',
    'black', 'white', 'white', 'white', 'black', 'black'
  ],
  clues: {
    '0,1': { down: 9 },
    '0,2': { down: 16 },
    '0,4': { down: 9 },
    '0,5': { down: 7 },
    '1,0': { across: 15 },
    '1,3': { across: 12, down: 12 },
    '2,0': { across: 17 },
    '3,0': { across: 9 }
  }
};

/** 示例的唯一解（按行优先展开，黑格为 0）。 */
export const SAMPLE_SOLUTION: number[] = [
  0, 0, 0, 0, 0, 0,
  0, 6, 9, 0, 8, 4,
  0, 2, 4, 7, 1, 3,
  0, 1, 3, 5, 0, 0
];
