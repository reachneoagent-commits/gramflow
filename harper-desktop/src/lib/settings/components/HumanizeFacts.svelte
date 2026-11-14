<script lang="ts">
// Writeflow's facts check: after a rewrite, flags dropped or invented numbers, dates, quotes and names.
import { compareFacts } from '$lib/writeflow/factcheck.js';

export let draft = '';
export let result = '';
export let busy = false;

$: facts = result.trim() && !busy ? compareFacts(draft, result) : null;
function line(group: Record<string, string[]>) {
	return Object.entries(group)
		.filter(([, list]) => list.length)
		.map(([kind, list]) => `${kind}: ${list.join(', ')}`)
		.join('; ');
}
$: dropped = facts ? line(facts.missing) : '';
$: invented = facts ? line(facts.added) : '';
</script>

{#if facts}
  {#if !facts.ok}
    <p class="hzf" role="alert">
      <span class="hzf-pill">Check the facts</span>
      {#if dropped}The rewrite dropped {dropped}.{/if}
      {#if invented} It added {invented}.{/if}
    </p>
  {:else}
    <p class="hzf">Numbers, dates, quotes and names match the draft.</p>
  {/if}
{/if}

<style>
  .hzf {
    margin: 14px 0 0;
    color: #6b6b63;
    font-size: 13px;
  }
  :global(.dark) .hzf {
    color: #a9ad96;
  }
  .hzf-pill {
    display: inline-block;
    margin-right: 8px;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(184, 230, 46, 0.25);
    color: #2b2b2b;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  :global(.dark) .hzf-pill {
    color: #eef1dc;
  }
</style>
