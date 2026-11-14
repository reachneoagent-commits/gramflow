// @ts-nocheck
// Ported from Writeflow (reachneoagent-commits/writeflow). Pure functions, no network.
// Writeflow: reading level and "sounds like you". Pure functions, offline.
// The rewrite model is trained on one fixed instruction, so we do not steer it with voices;
// instead we measure the result against a target grade level and against the writer's own samples.

const sentences = (t) => t.split(/(?<=[.!?])\s+|\n{2,}/).map((s) => s.trim()).filter(Boolean);
const wordsOf = (t) => t.match(/[A-Za-zÀ-ɏ']+/g) || [];

function syllables(w) {
  w = w.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

/** Flesch-Kincaid grade level (US school grade). null when the text is too short. */
export function readingGrade(text) {
  const ws = wordsOf(text);
  const ss = sentences(text);
  if (ws.length < 25 || !ss.length) return null;
  const syl = ws.reduce((a, w) => a + syllables(w), 0);
  const g = 0.39 * (ws.length / ss.length) + 11.8 * (syl / ws.length) - 15.59;
  return Math.max(1, Math.round(g * 10) / 10);
}

export const LEVELS = {
  middle: { label: "Middle school (grades 6-8)", min: 6, max: 8.9 },
  high: { label: "High school (grades 9-12)", min: 9, max: 12.9 },
  college: { label: "College (13+)", min: 13, max: 20 },
};

/** Tells the writer whether a grade level fits the target band. */
export function levelAdvice(grade, key) {
  const lv = LEVELS[key];
  if (grade == null || !lv) return "";
  if (grade > lv.max) return `Reads at about grade ${grade}, above ${lv.label}. Shorter sentences and simpler words would help.`;
  if (grade < lv.min) return `Reads at about grade ${grade}, below ${lv.label}. It may sound too simple for this level.`;
  return `Reads at about grade ${grade}, which fits ${lv.label}.`;
}

/** A small fingerprint of someone's writing habits. */
export function fingerprint(text) {
  const ss = sentences(text);
  const ws = wordsOf(text);
  if (ws.length < 40 || ss.length < 3) return null;
  const lens = ss.map((s) => wordsOf(s).length).filter(Boolean);
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length);
  const lower = ws.map((w) => w.toLowerCase());
  const contractions = ws.filter((w) => /'(?:s|t|re|ve|ll|d|m)$/i.test(w)).length;
  const firstPerson = lower.filter((w) => w === "i" || w === "my" || w === "me" || w === "i'm" || w === "i've").length;
  return {
    sentenceLen: mean,
    sentenceVar: mean ? sd / mean : 0,
    wordLen: ws.reduce((a, w) => a + w.length, 0) / ws.length,
    commasPerSentence: (text.match(/,/g) || []).length / ss.length,
    contractionRate: contractions / ws.length,
    firstPersonRate: firstPerson / ws.length,
    variety: new Set(lower).size / Math.sqrt(ws.length), // length-stable word variety
  };
}

const SCALE = { sentenceLen: 8, sentenceVar: 0.25, wordLen: 0.7, commasPerSentence: 1.2, contractionRate: 0.03, firstPersonRate: 0.03, variety: 2.5 };
export const FEATURE_LABEL = {
  sentenceLen: "sentence length", sentenceVar: "rhythm", wordLen: "word length",
  commasPerSentence: "commas", contractionRate: "contractions", firstPersonRate: "first person (I, my)", variety: "word variety",
};

/** 0-100: how close a text's habits are to the profile (100 = same habits). */
export function similarity(profile, text) {
  const f = fingerprint(text);
  if (!profile || !f) return null;
  let d = 0, n = 0;
  for (const k of Object.keys(SCALE)) { d += Math.min(1, Math.abs(f[k] - profile[k]) / SCALE[k]); n++; }
  return Math.round((1 - d / n) * 100);
}

/** Plain-language gaps between the text and the writer's profile, biggest first. */
export function styleGaps(profile, text, max = 3) {
  const f = fingerprint(text);
  if (!profile || !f) return [];
  const fmt = {
    sentenceLen: (x) => `${x.toFixed(0)} words per sentence`,
    sentenceVar: (x) => (x > 0.5 ? "varied" : "even"),
    wordLen: (x) => `${x.toFixed(1)} letters per word`,
    commasPerSentence: (x) => `${x.toFixed(1)} per sentence`,
    contractionRate: (x) => `${(x * 100).toFixed(1)}% of words`,
    firstPersonRate: (x) => `${(x * 100).toFixed(1)}% of words`,
    variety: (x) => x.toFixed(1),
  };
  return Object.keys(SCALE)
    .map((k) => ({ k, gap: Math.abs(f[k] - profile[k]) / SCALE[k] }))
    .filter((g) => g.gap > 0.35)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, max)
    .map((g) => `${FEATURE_LABEL[g.k]}: yours ${fmt[g.k](profile[g.k])}, this text ${fmt[g.k](f[g.k])}`);
}
