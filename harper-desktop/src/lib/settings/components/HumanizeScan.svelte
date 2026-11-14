<script lang="ts">
// Writeflow's offline scan, shared by the Humanize window and the editor's Humanize tab:
// how AI-sounding the draft reads, which sentences, the reading grade, and (after a rewrite)
// the before/after score. Runs on this computer only and is cheap, so it follows the draft.
import { analyze, BAND_TEXT } from '$lib/writeflow/score.js';
import { rankSentences } from '$lib/writeflow/sentences.js';
import { readingGrade } from '$lib/writeflow/style.js';

export let draft = '';
export let result = '';
export let busy = false;

let scan: ReturnType<typeof analyze> | null = null;
let worst: Array<{ text: string; weight: number }> = [];
let grade: number | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

$: schedule(draft);
function schedule(text: string) {
	clearTimeout(timer);
	if (!text.trim()) {
		scan = null;
		worst = [];
		grade = null;
		return;
	}
	timer = setTimeout(() => {
		scan = analyze(text);
		worst = rankSentences(text, scan.flags).ranked.slice(0, 3);
		grade = readingGrade(text);
	}, 300);
}
$: after = result.trim() && !busy ? analyze(result) : null;
</script>

{#if scan}
  <section class="hzs" aria-label="AI-sounding score">
    {#if scan.stats.enough}
      <div class="hzs-score" data-band={scan.band}>
        <span class="hzs-num">{scan.score}</span><span class="hzs-of">/100</span>
      </div>
      <div class="hzs-text">
        <strong>
          {BAND_TEXT[scan.band as keyof typeof BAND_TEXT]}
          {#if after && after.stats.enough}
            <span class="hzs-muted"> After the rewrite: {scan.score} → {after.score}</span>
          {/if}
        </strong>
        <span class="hzs-muted">
          {scan.flags.length} flagged {scan.flags.length === 1 ? 'phrase' : 'phrases'}
          {#if grade !== null}· Reading grade {grade}{/if}
          · A guide to writing habits, not proof of who wrote it.
        </span>
      </div>
    {:else}
      <div class="hzs-text"><span class="hzs-muted">{BAND_TEXT.short}</span></div>
    {/if}
  </section>
  {#if worst.length}
    <ul class="hzs-worst" aria-label="Most AI-sounding sentences">
      {#each worst as item}
        <li>{item.text}</li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  .hzs {
    --ink: #2b2b2b;
    --ink-2: #6b6b63;
    --line: rgba(43, 43, 43, 0.18);
    --panel: rgba(43, 43, 43, 0.05);
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 16px;
    padding: 12px 16px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--panel);
    color: var(--ink);
    font-size: 14px;
  }
  :global(.dark) .hzs {
    --ink: #eef1dc;
    --ink-2: #a9ad96;
    --line: rgba(255, 255, 255, 0.14);
    --panel: rgba(255, 255, 255, 0.06);
  }
  .hzs-score {
    display: flex;
    align-items: baseline;
    gap: 2px;
    min-width: 76px;
  }
  .hzs-num {
    font-size: 32px;
    font-weight: 700;
    line-height: 1;
  }
  .hzs-score[data-band='high'] .hzs-num {
    color: #c0392b;
  }
  .hzs-score[data-band='medium'] .hzs-num {
    color: #b9770e;
  }
  .hzs-of {
    color: var(--ink-2);
    font-size: 12px;
  }
  .hzs-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .hzs-muted {
    color: var(--ink-2);
    font-weight: 400;
    font-size: 13px;
  }
  .hzs-worst {
    margin: 10px 0 0;
    padding-left: 20px;
    color: #6b6b63;
    font-size: 13px;
    line-height: 1.5;
  }
  :global(.dark) .hzs-worst {
    color: #a9ad96;
  }
</style>
