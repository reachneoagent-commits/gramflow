// @ts-nocheck
// Ported from Writeflow (reachneoagent-commits/writeflow). Pure functions, no network.
// Writeflow: offline "sounds like AI" score. Pure functions, no DOM, no network.
// Rules are our own wording, informed by Wikipedia's "Signs of AI writing" guide and the
// public humanizer rule projects (see NOTICE). The score is a style guide, not a verdict:
// it measures AI-sounding habits, and formal or non-native writing can score high too.

export const PATTERNS = [
  { id: "significance", w: 3, label: "Inflated significance",
    tip: "Say what happened; skip claims that it is pivotal or a testament to something.",
    re: /\b(?:stands? as a testament|serves? as a (?:testament|reminder)|plays? a (?:vital|crucial|pivotal|key|significant) role|(?:is|are|was|were) (?:truly )?(?:pivotal|crucial|vital|paramount)|underscores? (?:the|its) (?:importance|significance)|marks? a (?:pivotal|significant|key) (?:moment|shift|step)|ever-evolving (?:landscape|world)|rich tapestry|a testament to)\b/gi },
  { id: "buzzwords", w: 2, label: "AI buzzwords",
    tip: "Swap for a plain word.",
    re: /\b(?:delve(?:s|d)? into|delving|tapestry|multifaceted|intricate(?:ly)?|myriad|pivotal|paramount|holistic|seamless(?:ly)?|robust|leverag(?:e|es|ed|ing)|harness(?:es|ed|ing)?|foster(?:s|ed|ing)?|embark(?:s|ed|ing)?|navigat(?:e|es|ed|ing) the (?:complexities|landscape)|realm of|cutting-edge|game-?changer|unlock(?:s|ed|ing)? the (?:power|potential))\b/gi },
  { id: "transitions", w: 2, label: "Stock transitions",
    tip: "Start with the point; most of these add nothing.",
    re: /(?:^|[.!?]\s+)(?:Moreover|Furthermore|Additionally|In addition|Consequently|Notably|Importantly|Ultimately|In conclusion|In summary|Overall|It is (?:important|worth) (?:to note|noting) that|It's (?:important|worth) (?:to note|noting) that)\b,?/g },
  { id: "hedging", w: 2, label: "Filler and hedging",
    tip: "Cut the throat-clearing and commit to the claim.",
    re: /\b(?:it(?:'s| is) (?:important|crucial|essential) to (?:remember|understand|recognize|consider)|plays? an? (?:important|integral) part|in today's (?:fast-paced|digital|modern) (?:world|age|society)|when it comes to|at the end of the day|in the world of|a wide (?:range|variety) of|a number of)\b/gi },
  { id: "not-only", w: 3, label: "\"Not only... but also\" frame",
    tip: "State both points directly.",
    re: /\bnot only\b[^.!?]{3,80}\bbut (?:also )?\b/gi },
  { id: "opener", w: 3, label: "Chatbot opener or closer",
    tip: "Delete it; start with the content.",
    re: /\b(?:certainly[!,]|absolutely[!,]|great question|I hope this helps|let me know if you(?:'d| would)? like|feel free to (?:reach out|ask)|here(?:'s| is) (?:a|an|the) (?:breakdown|overview|summary))\b/gi },
  { id: "ing-tail", w: 2, label: "Tacked-on \"-ing\" phrase",
    tip: "Split into its own sentence or drop it.",
    re: /,\s+(?:highlighting|underscoring|emphasizing|showcasing|reflecting|ensuring|contributing to|demonstrating|illustrating|fostering|cementing)\b[^.!?]{3,}/gi },
  { id: "vague-source", w: 2, label: "Vague attribution",
    tip: "Name the source or drop the claim.",
    re: /\b(?:experts (?:say|agree|believe)|studies (?:show|suggest|have shown)|research (?:shows|suggests)|many (?:believe|argue|people think)|some (?:argue|say|critics))\b/gi },
  { id: "promo", w: 2, label: "Promotional tone",
    tip: "Describe plainly; skip the sales voice.",
    re: /\b(?:breathtaking|stunning|vibrant|renowned|nestled|boasts?|must-visit|world-class|state-of-the-art|unparalleled|exceptional|transformative|groundbreaking|rich (?:history|heritage|culture))\b/gi },
  { id: "generic-close", w: 2, label: "Generic upbeat ending",
    tip: "End on the last real point.",
    re: /\b(?:the future (?:looks|is) bright|exciting (?:times|possibilities) ahead|only time will tell|continues? to (?:evolve|shape|inspire)|paving the way|a bright future)\b/gi },
];

const EM_DASH = /—/g;

function words(text) {
  return text.toLowerCase().match(/[a-zÀ-ɏ']+/g) || [];
}

function sentences(text) {
  return text.split(/(?<=[.!?])\s+|\n{2,}/).map((s) => s.trim()).filter(Boolean);
}

function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

/** Every pattern hit with character offsets, sorted by position, overlaps removed. */
export function findFlags(text) {
  const hits = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(text)) !== null) {
      if (m[0].length === 0) { p.re.lastIndex++; continue; }
      // transitions match a leading ". " that is not part of the phrase
      const lead = p.id === "transitions" ? m[0].match(/^[.!?]\s+/) : null;
      const off = lead ? lead[0].length : 0;
      hits.push({ id: p.id, label: p.label, tip: p.tip, w: p.w,
        start: m.index + off, end: m.index + m[0].length, text: m[0].slice(off) });
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  let last = -1;
  for (const h of hits) { if (h.start >= last) { out.push(h); last = h.end; } }
  return out;
}

/**
 * analyze(text) -> { score 0-100, band, flags, stats }
 * Three parts: pattern density (up to 70), flat sentence rhythm (up to 20), em-dash density (up to 10).
 */
export function analyze(text) {
  const src = String(text || "");
  const ws = words(src);
  const n = ws.length;
  if (n < 25) {
    return { score: 0, band: "short", flags: [], stats: { words: n, enough: false } };
  }
  const flags = findFlags(src);
  const weighted = flags.reduce((a, f) => a + f.w, 0);
  const per100 = (weighted / n) * 100;
  // smooth curve (never hard-capped), so removing even a few phrases from a heavily flagged text still lowers the score
  const patternPart = 70 * (1 - Math.exp(-per100 / 12));

  const lens = sentences(src).map((s) => words(s).length).filter((l) => l > 0);
  const mean = lens.reduce((a, b) => a + b, 0) / (lens.length || 1);
  const cv = mean ? stdev(lens) / mean : 0; // coefficient of variation: low = monotone rhythm
  const rhythmPart = lens.length >= 5 ? Math.max(0, Math.min(20, (0.55 - cv) * 50)) : 0;

  const dashes = (src.match(EM_DASH) || []).length;
  const dashPart = Math.min(10, (dashes / n) * 100 * 4);

  const score = Math.round(Math.max(0, Math.min(100, patternPart + rhythmPart + dashPart)));
  const band = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  return {
    score, band, flags,
    stats: { words: n, enough: true, sentences: lens.length, rhythmCv: Number(cv.toFixed(2)),
      emDashes: dashes, patternPer100: Number(per100.toFixed(2)),
      parts: { pattern: Math.round(patternPart), rhythm: Math.round(rhythmPart), dash: Math.round(dashPart) } },
  };
}

export const BAND_TEXT = {
  short: "Add a bit more text (about 25 words) to get a score.",
  low: "Reads mostly like a person wrote it.",
  medium: "Some AI-sounding habits. Worth a pass.",
  high: "Strong AI-sounding habits. Rewrite or edit by hand.",
};
