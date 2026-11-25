export const MAX_JOKE_LENGTH = 200;
export const IDEAL_MIN_LENGTH = 55;
export const IDEAL_MAX_LENGTH = 145;

export interface RubricWeights {
  officeTruth: number;
  turnSurprise: number;
  lineTightness: number;
  freshness: number;
}

export const DEFAULT_WEIGHTS: RubricWeights = {
  officeTruth: 0.30,
  turnSurprise: 0.30,
  lineTightness: 0.20,
  freshness: 0.20,
};

export interface JokeCandidate {
  id?: string;
  text: string;
  theme?: string;
}

export type JokeInput = string | JokeCandidate;

export interface RubricBreakdown {
  officeTruth: number;
  turnSurprise: number;
  lineTightness: number;
  freshness: number;
}

export interface ValidationResult {
  valid: boolean;
  length: number;
  wordCount: number;
  singleLine: boolean;
  violations: string[];
}

export interface ScoredJoke {
  id: string;
  text: string;
  theme: string;
  valid: boolean;
  violations: string[];
  length: number;
  wordCount: number;
  breakdown: RubricBreakdown;
  total: number;
  notes: string[];
}

export interface PairwiseComparison {
  winner: "a" | "b";
  margin: number;
  a: ScoredJoke;
  b: ScoredJoke;
  decisiveDimension: keyof RubricBreakdown;
}

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "by", "for",
  "from", "had", "has", "have", "he", "her", "his", "i", "in", "is", "it",
  "its", "me", "my", "of", "on", "or", "our", "she", "so", "that", "the",
  "their", "them", "they", "this", "to", "us", "was", "we", "were", "with",
  "you", "your",
]);

const OFFICE_SPECIFIC_TERMS: ReadonlyArray<{ term: string; weight: number }> = [
  { term: "calendar", weight: 1.0 },
  { term: "invite", weight: 0.9 },
  { term: "quick sync", weight: 1.3 },
  { term: "sync", weight: 0.8 },
  { term: "slack", weight: 1.1 },
  { term: "teams", weight: 0.8 },
  { term: "zoom", weight: 0.9 },
  { term: "standup", weight: 1.1 },
  { term: "retro", weight: 1.0 },
  { term: "sprint", weight: 0.9 },
  { term: "jira", weight: 1.2 },
  { term: "ticket", weight: 0.8 },
  { term: "spreadsheet", weight: 1.1 },
  { term: "excel", weight: 1.0 },
  { term: "deck", weight: 1.0 },
  { term: "slides", weight: 0.8 },
  { term: "reply-all", weight: 1.3 },
  { term: "reply all", weight: 1.3 },
  { term: "per my last email", weight: 1.0 },
  { term: "out of office", weight: 1.2 },
  { term: "ooo", weight: 1.1 },
  { term: "pto", weight: 1.2 },
  { term: "hr", weight: 1.0 },
  { term: "onboarding", weight: 1.1 },
  { term: "offboarding", weight: 1.1 },
  { term: "performance review", weight: 1.3 },
  { term: "review", weight: 0.6 },
  { term: "promotion", weight: 0.9 },
  { term: "layoff", weight: 1.1 },
  { term: "reorg", weight: 1.3 },
  { term: "town hall", weight: 1.2 },
  { term: "all-hands", weight: 1.2 },
  { term: "all hands", weight: 1.2 },
  { term: "okr", weight: 1.2 },
  { term: "kpi", weight: 1.1 },
  { term: "bandwidth", weight: 0.9 },
  { term: "circle back", weight: 1.0 },
  { term: "action items", weight: 1.1 },
  { term: "deliverable", weight: 1.0 },
  { term: "stakeholder", weight: 1.1 },
  { term: "alignment", weight: 1.0 },
  { term: "roadmap", weight: 1.0 },
  { term: "deadline", weight: 0.8 },
  { term: "badge", weight: 1.0 },
  { term: "cubicle", weight: 1.0 },
  { term: "open office", weight: 1.2 },
  { term: "printer", weight: 0.9 },
  { term: "break room", weight: 1.0 },
  { term: "expense report", weight: 1.2 },
  { term: "timesheet", weight: 1.2 },
  { term: "mute", weight: 0.9 },
  { term: "camera", weight: 0.7 },
  { term: "manager", weight: 0.9 },
  { term: "coworker", weight: 0.9 },
  { term: "boss", weight: 0.7 },
  { term: "intern", weight: 1.0 },
  { term: "meeting", weight: 0.7 },
  { term: "email", weight: 0.7 },
  { term: "inbox", weight: 1.0 },
  { term: "quarterly", weight: 1.0 },
  { term: "salary", weight: 0.9 },
  { term: "raise", weight: 0.8 },
  { term: "status", weight: 0.7 },
  { term: "green dot", weight: 1.3 },
  { term: "active", weight: 0.5 },
  { term: "pip", weight: 1.2 },
  { term: "laptop", weight: 0.7 },
];

const TURN_MARKERS: readonly string[] = [
  "until", "except", "turns out", "instead", "only to", "which means",
  "so i", "so we", "so now", "because", "but", "yet", "still", "apparently",
  "technically", "officially", "now i", "now we", "just to", "unless",
  "turns into", "ended up", "without", "never",
];

const FILLER_PHRASES: readonly string[] = [
  "basically", "literally", "honestly", "very", "really", "actually",
  "kind of", "sort of", "in order to", "at the end of the day",
  "as a matter of fact", "pretty much",
];

const CLICHE_PHRASES: ReadonlyArray<{ phrase: string; penalty: number }> = [
  { phrase: "case of the mondays", penalty: 0.45 },
  { phrase: "working hard or hardly working", penalty: 0.50 },
  { phrase: "could have been an email", penalty: 0.42 },
  { phrase: "could've been an email", penalty: 0.42 },
  { phrase: "living the dream", penalty: 0.35 },
  { phrase: "hump day", penalty: 0.35 },
  { phrase: "tgif", penalty: 0.35 },
  { phrase: "don't talk to me before my coffee", penalty: 0.45 },
  { phrase: "coffee", penalty: 0.10 },
  { phrase: "monday", penalty: 0.12 },
  { phrase: "mondays", penalty: 0.16 },
  { phrase: "quiet quitting", penalty: 0.25 },
  { phrase: "pizza party", penalty: 0.22 },
  { phrase: "boss makes a dollar", penalty: 0.45 },
  { phrase: "synergy", penalty: 0.12 },
  { phrase: "work hard play hard", penalty: 0.30 },
  { phrase: "we're a family", penalty: 0.18 },
];

const WEAK_ENDING_WORDS = new Set([
  "thing", "stuff", "something", "anything", "everything", "too", "though",
  "anyway", "either", "actually", "really", "basically", "lol", "haha",
]);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function normalizeWeights(partial?: Partial<RubricWeights>): RubricWeights {
  const merged: RubricWeights = {
    officeTruth: partial?.officeTruth ?? DEFAULT_WEIGHTS.officeTruth,
    turnSurprise: partial?.turnSurprise ?? DEFAULT_WEIGHTS.turnSurprise,
    lineTightness: partial?.lineTightness ?? DEFAULT_WEIGHTS.lineTightness,
    freshness: partial?.freshness ?? DEFAULT_WEIGHTS.freshness,
  };
  const sum =
    merged.officeTruth +
    merged.turnSurprise +
    merged.lineTightness +
    merged.freshness;
  if (sum <= 0) {
    return { ...DEFAULT_WEIGHTS };
  }
  return {
    officeTruth: merged.officeTruth / sum,
    turnSurprise: merged.turnSurprise / sum,
    lineTightness: merged.lineTightness / sum,
    freshness: merged.freshness / sum,
  };
}

export function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z0-9]+(?:['’-][a-z0-9]+)*/g);
  return matches ? [...matches] : [];
}

function contentTokenSet(tokens: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const token of tokens) {
    if (token.length > 2 && !STOPWORDS.has(token)) {
      set.add(token);
    }
  }
  return set;
}

function fnv1aHex(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsPhrase(lowerText: string, phrase: string): boolean {
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(phrase)}(?:$|[^a-z0-9])`, "i");
  return pattern.test(lowerText);
}

export function validateJoke(text: string): ValidationResult {
  const violations: string[] = [];
  const trimmed = text.trim();
  const singleLine = !/[\r\n]/.test(trimmed);
  const length = trimmed.length;
  const words = tokenize(trimmed);

  if (length === 0) {
    violations.push("Joke must not be empty.");
  }
  if (!singleLine) {
    violations.push("Joke must be a single line with no line breaks.");
  }
  if (length > MAX_JOKE_LENGTH) {
    violations.push(`Joke length (${length}) exceeds ${MAX_JOKE_LENGTH} characters.`);
  }
  if (words.length < 4 && length > 0) {
    violations.push("Joke is too short to contain a setup and turn.");
  }

  return {
    valid: violations.length === 0,
    length,
    wordCount: words.length,
    singleLine,
    violations,
  };
}

function scoreOfficeTruth(lowerText: string, tokens: readonly string[]): {
  score: number;
  hits: number;
} {
  let weightedHits = 0;
  let hits = 0;
  for (const entry of OFFICE_SPECIFIC_TERMS) {
    if (containsPhrase(lowerText, entry.term)) {
      weightedHits += entry.weight;
      hits += 1;
    }
  }

  const hasFirstPersonOrPeer =
    /\b(my|i|i'm|i've|we|our|coworker|manager|boss|hr|team)\b/.test(lowerText);
  const hasTimeOrScheduleAnchor =
    /\b(\d{1,2}(:\d{2})?\s?(am|pm)|friday|thursday|wednesday|tuesday|morning|quarter|q[1-4]|4:5\d|5:00|9\s?to\s?5|30-minute|15-minute|minutes?|hours?)\b/.test(
      lowerText,
    );
  const hasQuotedOfficeSpeak = /["“”'][^"“”']{3,40}["“”']/.test(lowerText);

  const termCurve = 1 - Math.exp(-0.52 * weightedHits);
  let score = 0.15 + 0.65 * termCurve;
  if (hasFirstPersonOrPeer) score += 0.08;
  if (hasTimeOrScheduleAnchor) score += 0.07;
  if (hasQuotedOfficeSpeak) score += 0.07;

  if (hits === 0) {
    score = Math.min(score, 0.25);
  }
  if (tokens.length > 0 && weightedHits / tokens.length > 0.45) {
    score -= 0.08;
  }

  return { score: round4(clamp(score, 0, 1)), hits };
}

function findPivotIndex(text: string): number {
  const strongDelimiters = [" — ", "—", " – ", "; ", ": ", " - ", ", "];
  const minPos = Math.floor(text.length * 0.28);
  const maxPos = Math.floor(text.length * 0.82);

  for (const delim of strongDelimiters) {
    let idx = text.indexOf(delim, minPos);
    while (idx !== -1 && idx <= maxPos) {
      return idx + delim.length;
    }
  }

  const lower = text.toLowerCase();
  for (const marker of TURN_MARKERS) {
    const idx = lower.indexOf(marker, minPos);
    if (idx !== -1 && idx <= maxPos) {
      return idx;
    }
  }
  return Math.floor(text.length * 0.55);
}

function scoreTurnSurprise(text: string, tokens: readonly string[]): {
  score: number;
  hasPivot: boolean;
} {
  if (tokens.length < 5) {
    return { score: 0.1, hasPivot: false };
  }

  const lower = text.toLowerCase();
  const pivotIdx = findPivotIndex(text);
  const setup = text.slice(0, pivotIdx).trim();
  const punch = text.slice(pivotIdx).trim();

  const setupTokens = contentTokenSet(tokenize(setup));
  const punchTokens = contentTokenSet(tokenize(punch));

  let overlap = 0;
  for (const t of punchTokens) {
    if (setupTokens.has(t)) overlap += 1;
  }
  const unionSize = new Set([...setupTokens, ...punchTokens]).size || 1;
  const lexicalShift = 1 - overlap / unionSize;

  const hasPunctuationPivot = /[—–:;]/.test(text) || /,\s+(?:so|but|until|except|which|and now|only)\b/i.test(text);
  let markerHits = 0;
  for (const marker of TURN_MARKERS) {
    if (containsPhrase(lower, marker)) {
      markerHits += 1;
    }
  }
  const hasPivot = hasPunctuationPivot || markerHits > 0;

  const punchRatio = punch.length / Math.max(1, text.length);
  const ratioScore =
    punchRatio >= 0.22 && punchRatio <= 0.56
      ? 1.0
      : clamp(1 - Math.abs(punchRatio - 0.38) * 2.1, 0.2, 1.0);

  const lastToken = tokens[tokens.length - 1] ?? "";
  const strongLanding =
    lastToken.length >= 4 &&
    !STOPWORDS.has(lastToken) &&
    !WEAK_ENDING_WORDS.has(lastToken);

  const hasIronyOrReframe =
    /\b(called|means|now|officially|promoted|rewarded|scheduled|booked|marked|upgraded|rebranded)\b/.test(
      lower,
    );

  let score =
    0.22 +
    0.26 * lexicalShift +
    0.18 * ratioScore +
    (hasPunctuationPivot ? 0.14 : 0) +
    (markerHits > 0 ? Math.min(0.14, 0.10 + (markerHits - 1) * 0.04) : 0) +
    (strongLanding ? 0.08 : -0.08) +
    (hasIronyOrReframe ? 0.06 : 0);

  if (!hasPivot) {
    score -= 0.14;
  }

  return { score: round4(clamp(score, 0, 1)), hasPivot };
}

function scoreLineTightness(text: string, tokens: readonly string[]): {
  score: number;
  fillerCount: number;
} {
  const len = text.length;
  const lower = text.toLowerCase();

  let lengthScore = 1.0;
  if (len < IDEAL_MIN_LENGTH) {
    lengthScore = clamp(len / IDEAL_MIN_LENGTH, 0.2, 1.0);
  } else if (len > IDEAL_MAX_LENGTH) {
    const over = len - IDEAL_MAX_LENGTH;
    const span = Math.max(1, MAX_JOKE_LENGTH - IDEAL_MAX_LENGTH);
    lengthScore = clamp(1 - (over / span) * 0.45, 0.45, 1.0);
  }

  const sentenceEnds = (text.match(/[.!?]+(?:\s|$)/g) ?? []).length;
  const cadenceScore = sentenceEnds <= 1 ? 1.0 : sentenceEnds === 2 ? 0.86 : 0.62;

  let fillerCount = 0;
  for (const filler of FILLER_PHRASES) {
    if (containsPhrase(lower, filler)) {
      fillerCount += 1;
    }
  }

  const contentCounts = new Map<string, number>();
  for (const t of tokens) {
    if (t.length > 3 && !STOPWORDS.has(t)) {
      contentCounts.set(t, (contentCounts.get(t) ?? 0) + 1);
    }
  }
  let redundantRepeats = 0;
  for (const count of contentCounts.values()) {
    if (count > 1) redundantRepeats += count - 1;
  }

  const wordCount = tokens.length;
  const wordEconomy =
    wordCount >= 10 && wordCount <= 26
      ? 1.0
      : clamp(1 - Math.abs(wordCount - 18) * 0.035, 0.35, 1.0);

  const raw =
    0.45 * lengthScore +
    0.30 * wordEconomy +
    0.25 * cadenceScore -
    fillerCount * 0.10 -
    Math.max(0, redundantRepeats - 1) * 0.07;

  return { score: round4(clamp(raw, 0, 1)), fillerCount };
}

function scoreFreshness(
  lowerText: string,
  tokens: readonly string[],
  peerTokenSets?: ReadonlyArray<ReadonlySet<string>>,
): { score: number; clicheCount: number } {
  let clichePenalty = 0;
  let clicheCount = 0;
  for (const entry of CLICHE_PHRASES) {
    if (containsPhrase(lowerText, entry.phrase)) {
      clichePenalty += entry.penalty;
      clicheCount += 1;
    }
  }

  const uniqueTokens = new Set(tokens);
  const lexicalDiversity =
    tokens.length > 0 ? uniqueTokens.size / tokens.length : 0;

  const vividWords = tokens.filter((t) => t.length >= 6 && !STOPWORDS.has(t)).length;
  const specificityBonus = clamp(vividWords / Math.max(8, tokens.length), 0, 0.35) * 0.55;

  let peerDistinctness = 1.0;
  if (peerTokenSets && peerTokenSets.length > 0) {
    const ownSet = contentTokenSet(tokens);
    let maxSimilarity = 0;
    for (const peer of peerTokenSets) {
      let inter = 0;
      for (const w of ownSet) {
        if (peer.has(w)) inter += 1;
      }
      const union = new Set([...ownSet, ...peer]).size || 1;
      const sim = inter / union;
      if (sim > maxSimilarity) maxSimilarity = sim;
    }
    peerDistinctness = clamp(1 - maxSimilarity * 0.65, 0.35, 1.0);
  }

  const raw =
    (0.32 + 0.52 * lexicalDiversity + specificityBonus - clichePenalty) *
    (0.75 + 0.25 * peerDistinctness);

  return { score: round4(clamp(raw, 0, 1)), clicheCount };
}

function normalizeInput(input: JokeInput): { id: string; text: string; theme: string } {
  if (typeof input === "string") {
    const text = input.trim();
    return { id: `joke-${fnv1aHex(text)}`, text, theme: "office" };
  }
  const text = input.text.trim();
  return {
    id: input.id && input.id.trim().length > 0 ? input.id.trim() : `joke-${fnv1aHex(text)}`,
    text,
    theme: input.theme && input.theme.trim().length > 0 ? input.theme.trim() : "office",
  };
}

export function scoreJoke(
  input: JokeInput,
  weights?: Partial<RubricWeights>,
  peerTexts?: readonly string[],
): ScoredJoke {
  const { id, text, theme } = normalizeInput(input);
  const normalizedWeights = normalizeWeights(weights);
  const validation = validateJoke(text);
  const tokens = tokenize(text);
  const lower = text.toLowerCase();

  const peerSets = peerTexts
    ?.map((p) => p.trim())
    .filter((p) => p.length > 0 && p !== text)
    .map((p) => contentTokenSet(tokenize(p)));

  const truth = scoreOfficeTruth(lower, tokens);
  const surprise = scoreTurnSurprise(text, tokens);
  const tightness = scoreLineTightness(text, tokens);
  const freshness = scoreFreshness(lower, tokens, peerSets);

  const breakdown: RubricBreakdown = {
    officeTruth: truth.score,
    turnSurprise: surprise.score,
    lineTightness: tightness.score,
    freshness: freshness.score,
  };

  const weightedTotal =
    breakdown.officeTruth * normalizedWeights.officeTruth +
    breakdown.turnSurprise * normalizedWeights.turnSurprise +
    breakdown.lineTightness * normalizedWeights.lineTightness +
    breakdown.freshness * normalizedWeights.freshness;

  const total = validation.valid ? round4(clamp(weightedTotal, 0, 1)) : 0;

  const notes: string[] = [];
  if (!validation.valid) {
    notes.push(...validation.violations);
  } else {
    if (truth.hits >= 2) notes.push("Grounded in recognizable office specifics.");
    if (surprise.hasPivot) notes.push("Clear structural pivot into the punchline.");
    if (tightness.fillerCount === 0) notes.push("Clean wording with zero filler.");
    if (freshness.clicheCount === 0) notes.push("Avoids hackneyed workplace clichés.");
    if (freshness.clicheCount > 0) notes.push("Contains familiar office cliché phrasing.");
  }

  return {
    id,
    text,
    theme,
    valid: validation.valid,
    violations: validation.violations,
    length: validation.length,
    wordCount: validation.wordCount,
    breakdown,
    total,
    notes,
  };
}

function deterministicSort(a: ScoredJoke, b: ScoredJoke): number {
  if (a.valid !== b.valid) return a.valid ? -1 : 1;
  if (b.total !== a.total) return b.total - a.total;
  if (b.breakdown.turnSurprise !== a.breakdown.turnSurprise) {
    return b.breakdown.turnSurprise - a.breakdown.turnSurprise;
  }
  if (b.breakdown.officeTruth !== a.breakdown.officeTruth) {
    return b.breakdown.officeTruth - a.breakdown.officeTruth;
  }
  if (b.breakdown.freshness !== a.breakdown.freshness) {
    return b.breakdown.freshness - a.breakdown.freshness;
  }
  if (a.length !== b.length) return a.length - b.length;
  return a.text.localeCompare(b.text, "en");
}

export function compareJokes(
  aInput: JokeInput,
  bInput: JokeInput,
  weights?: Partial<RubricWeights>,
): PairwiseComparison {
  const aText = typeof aInput === "string" ? aInput : aInput.text;
  const bText = typeof bInput === "string" ? bInput : bInput.text;
  const a = scoreJoke(aInput, weights, [bText]);
  const b = scoreJoke(bInput, weights, [aText]);

  const order = deterministicSort(a, b);
  const winner: "a" | "b" = order <= 0 ? "a" : "b";
  const margin = round4(Math.abs(a.total - b.total));

  const dimensions: Array<keyof RubricBreakdown> = [
    "turnSurprise",
    "officeTruth",
    "freshness",
    "lineTightness",
  ];
  let decisiveDimension: keyof RubricBreakdown = "turnSurprise";
  let largestGap = -1;
  for (const dim of dimensions) {
    const gap = Math.abs(a.breakdown[dim] - b.breakdown[dim]);
    if (gap > largestGap) {
      largestGap = gap;
      decisiveDimension = dim;
    }
  }

  return { winner, margin, a, b, decisiveDimension };
}

export function rankJokes(
  inputs: readonly JokeInput[],
  weights?: Partial<RubricWeights>,
): ScoredJoke[] {
  const allTexts = inputs.map((item) =>
    typeof item === "string" ? item.trim() : item.text.trim(),
  );
  const scored = inputs.map((item) => scoreJoke(item, weights, allTexts));
  scored.sort(deterministicSort);
  return scored;
}

export function selectBestJoke(
  inputs: readonly JokeInput[],
  weights?: Partial<RubricWeights>,
): ScoredJoke {
  if (inputs.length === 0) {
    throw new Error("Cannot select best joke from an empty list.");
  }
  return rankJokes(inputs, weights)[0];
}