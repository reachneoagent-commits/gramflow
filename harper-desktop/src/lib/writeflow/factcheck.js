// @ts-nocheck
// Ported from Writeflow (reachneoagent-commits/writeflow). Pure functions, no network.
// Writeflow: did the rewrite keep the facts? Numbers, dates, quoted text and proper names.
// Pure functions. This is a safety net, not a proof: it catches dropped or invented details,
// not changed meaning.

const MONTHS = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const NUM = /\$?\d[\d,]*(?:\.\d+)?%?/g;
const DATE = new RegExp(`\\b(?:${MONTHS}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,\\s*\\d{4})?|\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTHS}(?:\\s+\\d{4})?|${MONTHS}\\s+\\d{4})\\b`, "g");
const QUOTE = /["“]([^"”]{6,}?)["”]/g;
// Capitalized words that are not just a sentence start; two or more in a row, or one after a lowercase word.
const NAME = /(?<=[a-z,;:]\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
const STOP = new Set(["Dr", "Mr", "Mrs", "Ms", "Prof", "Sir", "January", "February", "March", "April", "June", "July", "August", "September", "October", "November", "December", "I", "The", "A", "An", "In", "On", "At", "It", "This", "That", "He", "She", "They", "We", "You", "And", "But", "Or", "So", "If", "As", "My", "His", "Her", "Our", "Their", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);

const norm = (s) => s.toLowerCase().replace(/(\d)(?:st|nd|rd|th)\b/g, "$1").replace(/[\s,]+/g, " ").trim();
const numNorm = (s) => s.replace(/[$,]/g, "");

// "six" and "6" are the same fact. "one" is left alone: it is usually a pronoun.
const WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, twenty: 20, thirty: 30, forty: 40, fifty: 50 };
const WORD_RE = new RegExp("\\b(" + Object.keys(WORDS).join("|") + ")\\b", "gi");
const numberWords = (t) => t.replace(WORD_RE, (w) => String(WORDS[w.toLowerCase()]));

function uniq(xs) { return [...new Set(xs)]; }

export function extractFacts(text) {
  const t = numberWords(String(text || ""));
  const numbers = uniq((t.match(NUM) || []).map(numNorm).filter((x) => x.replace(/\D/g, "").length > 0));
  const dates = uniq((t.match(DATE) || []).map(norm));
  const quotes = uniq([...t.matchAll(QUOTE)].map((m) => norm(m[1])));
  const names = uniq([...t.matchAll(NAME)].map((m) => m[1]).filter((n) => !STOP.has(n)));
  return { numbers, dates, quotes, names };
}

/**
 * compareFacts(original, rewrite) -> { ok, missing: {numbers,dates,quotes,names}, added: {numbers,dates,names} }
 * Numbers inside a date are not double-counted as separate figures.
 */
export function compareFacts(original, rewrite) {
  const a = extractFacts(original);
  const b = extractFacts(rewrite);
  const inB = (list, x) => list.includes(x);
  const rewriteNorm = norm(rewrite);
  const missing = {
    numbers: a.numbers.filter((x) => !inB(b.numbers, x)),
    dates: a.dates.filter((x) => !inB(b.dates, x) && !rewriteNorm.includes(x)),
    quotes: a.quotes.filter((x) => !rewriteNorm.includes(x)),
    names: a.names.filter((x) => !rewrite.toLowerCase().includes(x.toLowerCase())),
  };
  const added = {
    numbers: b.numbers.filter((x) => !inB(a.numbers, x)),
    dates: b.dates.filter((x) => !inB(a.dates, x)),
    names: b.names.filter((x) => !original.toLowerCase().includes(x.toLowerCase())),
  };
  const total = Object.values(missing).reduce((n, l) => n + l.length, 0) +
    Object.values(added).reduce((n, l) => n + l.length, 0);
  return { ok: total === 0, missing, added, total };
}
