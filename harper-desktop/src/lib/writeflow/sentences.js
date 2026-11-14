// @ts-nocheck
// Ported from Writeflow (reachneoagent-commits/writeflow). Pure functions, no network.
// Writeflow: split text into sentences with exact character offsets, and rank them by how AI-sounding they are.
// Pure functions. Offsets index into the original string, so highlights and replacements line up exactly.

const fallbackSplit = (text) => {
  const out = [];
  const re = /[^\n]*?(?:[.!?]+["')\]]*(?=\s|$)|\n+|$)\s*/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[0] === "") { re.lastIndex++; if (re.lastIndex > text.length) break; continue; }
    out.push({ index: m.index, segment: m[0] });
  }
  return out;
};

/** [{ start, end, text }] in order; start/end skip surrounding whitespace so they hug the sentence. */
export function splitSentences(text) {
  const src = String(text || "");
  let segs;
  try {
    const seg = new Intl.Segmenter("en", { granularity: "sentence" });
    segs = [...seg.segment(src)].map((s) => ({ index: s.index, segment: s.segment }));
  } catch { segs = fallbackSplit(src); }
  // Don't split after abbreviations like "Dr." or "e.g." or an initial like "J."
  const ABBR = /(?:\b(?:Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|No|Inc|Ltd|Co|Gen|Gov|Sen|Rep|Rev|Mt|Fig)|\b[A-Z])\.\s*$/;
  const merged = [];
  for (const s of segs) {
    const prev = merged[merged.length - 1];
    if (prev && ABBR.test(prev.segment) && !/\n/.test(prev.segment.slice(-3))) prev.segment += s.segment;
    else merged.push({ ...s });
  }
  segs = merged;
  const out = [];
  for (const s of segs) {
    const lead = s.segment.match(/^\s*/)[0].length;
    const trail = s.segment.match(/\s*$/)[0].length;
    const start = s.index + lead;
    const end = s.index + s.segment.length - trail;
    if (end > start) out.push({ start, end, text: src.slice(start, end) });
  }
  return out;
}

/**
 * Attach flag counts and weight to each sentence and return the sentences that have flags, most AI-sounding first.
 * `flags` come from score.js findFlags (each has start, end, w, label).
 */
export function rankSentences(text, flags) {
  const sents = splitSentences(text).map((s) => {
    const inside = flags.filter((f) => f.start < s.end && f.end > s.start);
    return { ...s, flags: inside, weight: inside.reduce((a, f) => a + f.w, 0) };
  });
  const flagged = sents.filter((s) => s.weight > 0);
  const ranked = [...flagged].sort((a, b) => b.weight - a.weight || a.start - b.start);
  return { all: sents, flagged, ranked };
}

/** The sentence containing character position `pos`, or null. */
export function sentenceAt(sentences, pos) {
  return sentences.find((s) => pos >= s.start && pos <= s.end) || null;
}
