<script lang="ts">
  import type { Analysis } from '../lib/model';
  import { clueKey, type CellKind, type Clue } from '../lib/types';

  interface Props {
    rows: number;
    cols: number;
    cells: CellKind[];
    clues: Record<string, Clue>;
    analysis: Analysis;
    /** 每个白格的候选位掩码；null 表示无数据。 */
    masks: number[] | null;
    /** 传播阶段已矛盾（当前线索无可行填法）。 */
    contradiction: boolean;
    /** 当前展示的答案（黑格为 0）；null 表示展示候选。 */
    solution: number[] | null;
    selected: number;
    onselect: (i: number) => void;
  }

  const { rows, cols, cells, clues, analysis, masks, contradiction, solution, selected, onselect }: Props =
    $props();

  const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  /** 缺少线索的黑格（作为某条线的起点却没填和）。 */
  const needClue = $derived.by(() => {
    const s = new Set<number>();
    for (const run of analysis.runs) if (run.sum === undefined && run.clueCell !== null) s.add(run.clueCell);
    return s;
  });
</script>

<div class="board" style:--cols={cols} style:--rows={rows}>
  {#each cells as kind, i (i)}
    {@const r = Math.floor(i / cols)}
    {@const c = i % cols}
    {#if kind === 'black'}
      {@const clue = clues[clueKey(r, c)]}
      <button
        class="cell black"
        class:selected={selected === i}
        class:need={needClue.has(i)}
        onclick={() => onselect(i)}
        aria-label={`黑格 ${r + 1},${c + 1}`}
      >
        {#if clue?.across !== undefined}<span class="across">{clue.across}</span>{/if}
        {#if clue?.down !== undefined}<span class="down">{clue.down}</span>{/if}
      </button>
    {:else}
      <button
        class="cell white"
        class:selected={selected === i}
        class:conflict={contradiction}
        onclick={() => onselect(i)}
        aria-label={`白格 ${r + 1},${c + 1}`}
      >
        {#if solution}
          <span class="digit">{solution[i] || ''}</span>
        {:else if masks && masks[i]! > 0}
          <span class="cands">
            {#each DIGITS as d (d)}
              <span class="cand">{(masks[i]! & (1 << d)) !== 0 ? d : ''}</span>
            {/each}
          </span>
        {/if}
      </button>
    {/if}
  {/each}
</div>

<style>
  .board {
    display: grid;
    grid-template-columns: repeat(var(--cols), 48px);
    grid-auto-rows: 48px;
    gap: 2px;
    user-select: none;
  }

  .cell {
    padding: 0;
    border: none;
    border-radius: 3px;
    position: relative;
    display: block;
  }

  .black {
    background:
      linear-gradient(
        to bottom right,
        transparent calc(50% - 1px),
        #4a5468 calc(50% - 1px),
        #4a5468 calc(50% + 1px),
        transparent calc(50% + 1px)
      ),
      #262d3a;
    cursor: pointer;
  }

  .black .across,
  .black .down {
    position: absolute;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
  }

  .black .across {
    top: 4px;
    right: 5px;
    color: #9ec1ff;
  }

  .black .down {
    bottom: 4px;
    left: 5px;
    color: #9fe6b8;
  }

  .black.need {
    outline: 2px dashed var(--warn);
    outline-offset: -2px;
  }

  .white {
    background: #f2ecdd;
    cursor: pointer;
  }

  .white.conflict {
    background: #f6d5d5;
  }

  .cell.selected {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .digit {
    font-size: 24px;
    font-weight: 700;
    color: #1b3a6b;
  }

  .cands {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    width: 100%;
    height: 100%;
    padding: 2px;
  }

  .cand {
    font-size: 10px;
    color: #6b6250;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
</style>
