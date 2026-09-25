<script lang="ts">
  import Board from './components/Board.svelte';
  import { analyze } from './lib/model';
  import { candidateMasks, solvePuzzle, type SolveOutcome } from './lib/solver';
  import { SAMPLE_PUZZLE } from './lib/sample';
  import {
    MAX_COLS,
    MAX_ROWS,
    MAX_WHITE,
    clueKey,
    type CellKind,
    type Clue,
    type Puzzle
  } from './lib/types';

  // ---------------- 状态 ----------------
  let rows = $state(SAMPLE_PUZZLE.rows);
  let cols = $state(SAMPLE_PUZZLE.cols);
  let pendRows = $state(SAMPLE_PUZZLE.rows);
  let pendCols = $state(SAMPLE_PUZZLE.cols);
  let cells = $state<CellKind[]>([...SAMPLE_PUZZLE.cells]);
  let clues = $state<Record<string, Clue>>(structuredClone(SAMPLE_PUZZLE.clues));
  let mode = $state<'cells' | 'clues'>('cells');
  let selected = $state(-1);
  let outcome = $state<SolveOutcome | null>(null);
  let showSolution = $state(false);
  let whichSol = $state(0);
  let notice = $state('');
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;

  // ---------------- 派生 ----------------
  const puzzle = $derived<Puzzle>({ rows, cols, cells, clues });
  const analysis = $derived(analyze(puzzle));
  const masks = $derived(analysis.ok ? candidateMasks(analysis) : null);
  const contradiction = $derived(analysis.ok && analysis.complete && masks === null);
  const whites = $derived(cells.filter((k) => k === 'white').length);
  const solution = $derived(
    !showSolution || outcome === null
      ? null
      : outcome.kind === 'unique'
        ? outcome.solution
        : outcome.kind === 'multiple'
          ? (outcome.solutions[whichSol] ?? null)
          : null
  );
  const selRC = $derived(selected >= 0 ? { r: Math.floor(selected / cols), c: selected % cols } : null);
  const selClue = $derived(selRC ? clues[clueKey(selRC.r, selRC.c)] : undefined);
  const selStarts = $derived(
    selRC
      ? {
          across: selRC.c + 1 < cols && cells[selected + 1] === 'white',
          down: selRC.r + 1 < rows && cells[selected + cols] === 'white'
        }
      : { across: false, down: false }
  );
  const status = $derived.by((): { tone: 'error' | 'warn' | 'ok' | 'info'; text: string } => {
    if (!analysis.ok) return { tone: 'error', text: `存在 ${analysis.errors.length} 个结构问题，请修正后再求解` };
    if (analysis.missingClues.length > 0)
      return { tone: 'warn', text: `还有 ${analysis.missingClues.length} 条线缺少线索` };
    if (outcome === null) return { tone: 'info', text: '线索完整，可点击「求解」' };
    switch (outcome.kind) {
      case 'none':
        return { tone: 'error', text: '无解：当前线索下不存在可行填法' };
      case 'unique':
        return { tone: 'ok', text: '唯一解：已验证不存在第二份填法' };
      case 'multiple':
        return { tone: 'warn', text: '多解：下面展示按行优先字典序最小的两份完整填法' };
      default:
        return { tone: 'info', text: '' };
    }
  });

  // ---------------- 变更（任何修改都立即使旧结论失效） ----------------
  function invalidate() {
    outcome = null;
    showSolution = false;
    whichSol = 0;
  }

  function flash(msg: string) {
    notice = msg;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (notice = ''), 2600);
  }

  function onCellClick(i: number) {
    if (mode === 'clues') {
      selected = cells[i] === 'black' ? i : -1;
      return;
    }
    if (cells[i] === 'white') {
      cells[i] = 'black';
    } else {
      if (whites >= MAX_WHITE) {
        flash(`白格数量已达上限 ${MAX_WHITE}，不能再增加`);
        return;
      }
      cells[i] = 'white';
      const key = clueKey(Math.floor(i / cols), i % cols);
      if (clues[key]) delete clues[key];
    }
    invalidate();
  }

  function applySize() {
    const nr = Math.max(1, Math.min(MAX_ROWS, Math.trunc(pendRows) || 1));
    const nc = Math.max(1, Math.min(MAX_COLS, Math.trunc(pendCols) || 1));
    pendRows = nr;
    pendCols = nc;
    if (nr === rows && nc === cols) return;
    const next: CellKind[] = Array.from({ length: nr * nc }, () => 'black');
    for (let r = 0; r < Math.min(rows, nr); r++)
      for (let c = 0; c < Math.min(cols, nc); c++) next[r * nc + c] = cells[r * cols + c]!;
    rows = nr;
    cols = nc;
    cells = next;
    for (const key of Object.keys(clues)) {
      const [r, c] = key.split(',').map(Number);
      if (r! >= nr || c! >= nc) delete clues[key];
    }
    selected = -1;
    invalidate();
  }

  function setClue(dir: 'across' | 'down', raw: string) {
    if (!selRC) return;
    const key = clueKey(selRC.r, selRC.c);
    const entry: Clue = { ...(clues[key] ?? {}) };
    const trimmed = raw.trim();
    if (trimmed === '') delete entry[dir];
    else entry[dir] = Number(trimmed);
    if (entry.across === undefined && entry.down === undefined) delete clues[key];
    else clues[key] = entry;
    invalidate();
  }

  function solve() {
    outcome = solvePuzzle(puzzle);
    whichSol = 0;
    showSolution = outcome.kind === 'unique' || outcome.kind === 'multiple';
  }

  function loadSample() {
    rows = SAMPLE_PUZZLE.rows;
    cols = SAMPLE_PUZZLE.cols;
    pendRows = rows;
    pendCols = cols;
    cells = [...SAMPLE_PUZZLE.cells];
    clues = structuredClone(SAMPLE_PUZZLE.clues);
    selected = -1;
    invalidate();
  }

  function clearAll() {
    cells = cells.map(() => 'black' as CellKind);
    clues = {};
    selected = -1;
    invalidate();
  }
</script>

<header>
  <h1>数和（Kakuro）离线编辑器</h1>
  <p class="sub">
    棋盘至多 {MAX_ROWS}×{MAX_COLS}、白格至多 {MAX_WHITE}；每条横/竖连续白格长度 2～6，线索为 3～45 的整数；线内数字 1～9 不重复。
  </p>
</header>

<div class="toolbar">
  <label>行 <input type="number" min="1" max={MAX_ROWS} bind:value={pendRows} onchange={applySize} /></label>
  <label>列 <input type="number" min="1" max={MAX_COLS} bind:value={pendCols} onchange={applySize} /></label>
  <span class="sep"></span>
  <label class="radio">
    <input type="radio" name="mode" value="cells" bind:group={mode} /> 编辑格子
  </label>
  <label class="radio">
    <input type="radio" name="mode" value="clues" bind:group={mode} /> 编辑线索
  </label>
  <span class="sep"></span>
  <button onclick={loadSample}>载入示例</button>
  <button onclick={clearAll}>清空棋盘</button>
  <button class="primary" onclick={solve} disabled={!analysis.complete}>求解</button>
</div>

{#if notice}
  <div class="notice">{notice}</div>
{/if}

<main>
  <section class="left">
    <Board
      {rows}
      {cols}
      {cells}
      {clues}
      {analysis}
      {masks}
      {contradiction}
      {solution}
      {selected}
      onselect={onCellClick}
    />
    <p class="hint">
      {#if mode === 'cells'}
        点击格子在黑/白之间切换。白格内的小数字是当前传播阶段剩余的候选。
      {:else}
        点击黑格后在右侧面板填写横/竖线索（横线线索在黑格右上，竖线在左下）。
      {/if}
    </p>
  </section>

  <aside>
    <section class="panel status {status.tone}">
      <strong>状态</strong>
      <p>{status.text}</p>
      {#if outcome === null && analysis.complete}
        <p class="muted">任何线索或格子修改都会立即使旧结论失效。</p>
      {/if}
      {#if outcome && (outcome.kind === 'unique' || outcome.kind === 'multiple')}
        <div class="viewctl">
          <label class="radio">
            <input type="radio" name="view" checked={!showSolution} onchange={() => (showSolution = false)} />
            候选数字
          </label>
          <label class="radio">
            <input type="radio" name="view" checked={showSolution} onchange={() => (showSolution = true)} />
            答案
          </label>
          {#if outcome.kind === 'multiple'}
            <span class="sep"></span>
            <button class:active={showSolution && whichSol === 0} onclick={() => { showSolution = true; whichSol = 0; }}>解 1</button>
            <button class:active={showSolution && whichSol === 1} onclick={() => { showSolution = true; whichSol = 1; }}>解 2</button>
          {/if}
        </div>
      {/if}
    </section>

    {#if mode === 'clues'}
      <section class="panel">
        <strong>线索编辑</strong>
        {#if selRC && cells[selected] === 'black'}
          <p class="muted">黑格：第 {selRC.r + 1} 行第 {selRC.c + 1} 列</p>
          <div class="cluerow">
            <label>
              横线和
              <input
                type="number"
                min="3"
                max="45"
                disabled={!selStarts.across}
                value={selClue?.across ?? ''}
                oninput={(e) => setClue('across', e.currentTarget.value)}
              />
            </label>
          </div>
          <div class="cluerow">
            <label>
              竖线和
              <input
                type="number"
                min="3"
                max="45"
                disabled={!selStarts.down}
                value={selClue?.down ?? ''}
                oninput={(e) => setClue('down', e.currentTarget.value)}
              />
            </label>
          </div>
          {#if !selStarts.across && !selStarts.down}
            <p class="muted">该黑格右侧与下方都没有白格，不是任何线的起点。</p>
          {/if}
        {:else}
          <p class="muted">点击一个黑格以编辑其线索。</p>
        {/if}
      </section>
    {/if}

    {#if analysis.errors.length > 0}
      <section class="panel errors">
        <strong>结构问题（{analysis.errors.length}）</strong>
        <ul>
          {#each analysis.errors as e (e)}
            <li>{e}</li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if analysis.missingClues.length > 0 && analysis.errors.length === 0}
      <section class="panel missing">
        <strong>缺少线索（{analysis.missingClues.length}）</strong>
        <ul>
          {#each analysis.missingClues as m (m)}
            <li>{m}</li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if analysis.warnings.length > 0}
      <section class="panel warnings">
        <strong>提示</strong>
        <ul>
          {#each analysis.warnings as w (w)}
            <li>{w}</li>
          {/each}
        </ul>
      </section>
    {/if}
  </aside>
</main>

<style>
  header {
    padding: 18px 24px 8px;
  }

  h1 {
    margin: 0 0 4px;
    font-size: 20px;
  }

  .sub {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 10px 24px;
    border-bottom: 1px solid var(--border);
  }

  .toolbar label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
  }

  .sep {
    width: 1px;
    height: 22px;
    background: var(--border);
  }

  .radio {
    gap: 4px;
    cursor: pointer;
  }

  .notice {
    margin: 8px 24px 0;
    padding: 8px 12px;
    background: #3a2f16;
    border: 1px solid var(--warn);
    border-radius: 6px;
    font-size: 13px;
  }

  main {
    display: flex;
    gap: 24px;
    padding: 16px 24px 32px;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .left {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .hint {
    color: var(--muted);
    font-size: 13px;
    max-width: 520px;
    margin: 0;
  }

  aside {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 340px;
  }

  .panel {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 14px;
  }

  .panel strong {
    display: block;
    margin-bottom: 6px;
  }

  .panel p {
    margin: 4px 0;
  }

  .panel ul {
    margin: 4px 0 0;
    padding-left: 18px;
    max-height: 180px;
    overflow: auto;
  }

  .panel li {
    margin: 2px 0;
  }

  .status.error {
    border-color: var(--danger);
  }

  .status.warn {
    border-color: var(--warn);
  }

  .status.ok {
    border-color: var(--ok);
  }

  .errors {
    border-color: var(--danger);
  }

  .missing {
    border-color: var(--warn);
  }

  .muted {
    color: var(--muted);
    font-size: 13px;
  }

  .viewctl {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
    flex-wrap: wrap;
  }

  .viewctl .active {
    border-color: var(--accent);
    color: #fff;
    background: var(--accent);
  }

  .cluerow {
    margin: 6px 0;
  }

  .cluerow label {
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
