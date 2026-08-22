import type { Exercise, SetType } from '../types';

const SET_TYPE_KEYWORDS: [RegExp, SetType][] = [
  [/\bwarm[\s-]?up\b/, 'warmup'],
  [/\bdrop\s?set\b/, 'dropset'],
  [/\bfailure\b/, 'failure'],
  [/\bamrap\b/, 'amrap'],
  [/\btempo\b/, 'tempo'],
];

const UNIT = '(kgs?|kilos?|kilograms?|lbs?|pounds?)';

function toKg(value: number, unit?: string): number {
  if (unit && /lb|pound/.test(unit)) return Math.round(value * 0.45359237 * 10) / 10;
  return value;
}

interface ExtractedNumbers {
  setsCount?: number;
  reps?: number;
  weight?: number;
}

// Tries a series of common spoken patterns, most specific first, so e.g. "3 sets of 8
// at 60 kilos" captures all three numbers from one match instead of falling through to
// the last-resort guess at the bottom. Web Speech API transcripts already normalize
// spoken numbers to digits (at least in Chrome/Safari), so this only needs to handle
// digit form, not "sixty"/"eight" as words.
function extractNumbers(text: string): ExtractedNumbers {
  let m = text.match(new RegExp(`(\\d+)\\s*sets?\\s*(?:of\\s*)?(\\d+)\\s*(?:reps?)?\\s*(?:at\\s*)?(\\d+(?:\\.\\d+)?)?\\s*${UNIT}?`));
  if (m && m[2]) {
    return { setsCount: parseInt(m[1], 10), reps: parseInt(m[2], 10), weight: m[3] ? toKg(parseFloat(m[3]), m[4]) : undefined };
  }

  m = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${UNIT}?\\s*(?:for|x|times)\\s*(\\d+)\\s*(?:reps?)?`));
  if (m) {
    return { reps: parseInt(m[3], 10), weight: toKg(parseFloat(m[1]), m[2]) };
  }

  m = text.match(new RegExp(`(\\d+)\\s*reps?\\s*(?:at|of)\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}?`));
  if (m) {
    return { reps: parseInt(m[1], 10), weight: toKg(parseFloat(m[2]), m[3]) };
  }

  // Last resort: the first two bare numbers in order, as [weight, reps] — the most
  // common spoken shorthand ("sixty for eight" already digit-normalized to "60 for 8"
  // would actually be caught above; this covers stray phrasing that skips the "for").
  const nums = [...text.matchAll(/\d+(?:\.\d+)?/g)].map(x => parseFloat(x[0]));
  if (nums.length >= 2) return { weight: nums[0], reps: nums[1] };
  if (nums.length === 1) return { reps: nums[0] };
  return {};
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Fuzzy-matches the spoken transcript against the user's exercise library. Scoring is
// token-overlap based rather than a strict substring check, so numbers/filler words
// elsewhere in the transcript ("3 sets of 8" alongside "bench press") don't hurt the
// match against a name like "Barbell Bench Press".
export function matchExercise(query: string, exercises: Exercise[]): Exercise | undefined {
  const q = normalize(query);
  if (!q) return undefined;
  const qWords = q.split(' ').filter(Boolean);

  let best: Exercise | undefined;
  let bestScore = 0;
  for (const ex of exercises) {
    const name = normalize(ex.name);
    let score: number;
    if (name === q) score = 100;
    else if (q.includes(name)) score = 80;
    else {
      // Scored as recall against the exercise name only (overlap / name length), not
      // diluted by the query's length — a spoken sentence carries weight/reps/set-type
      // words ("100 kilos for 5 reps") that are irrelevant to the exercise name and
      // would otherwise drag the score down the longer the rest of the sentence is.
      const nameWords = new Set(name.split(' '));
      const overlap = qWords.filter(w => nameWords.has(w)).length;
      score = overlap > 0 ? (overlap / nameWords.size) * 60 : 0;
    }
    // On a tie, prefer the shorter/more specific name (e.g. "Bench Press" over "Incline
    // Bench Press" when the query is just "bench press").
    if (score > bestScore || (score > 0 && score === bestScore && best && ex.name.length < best.name.length)) {
      bestScore = score;
      best = ex;
    }
  }
  return bestScore >= 30 ? best : undefined;
}

export interface ParsedVoiceLog {
  exercise?: Exercise;
  weight: number;
  reps: number;
  setsCount: number;
  type: SetType;
  transcript: string;
}

// Phase 1: a heuristic parser, not an LLM — deliberately simple so it ships fast and
// costs nothing to run. Its output always goes through a review/confirm step before
// touching the workout, so an imperfect parse is a UI correction, not corrupted data.
export function parseVoiceLog(transcript: string, exercises: Exercise[]): ParsedVoiceLog {
  const text = transcript.toLowerCase();

  let type: SetType = 'working';
  for (const [re, t] of SET_TYPE_KEYWORDS) {
    if (re.test(text)) { type = t; break; }
  }

  const { setsCount = 1, reps = 0, weight = 0 } = extractNumbers(text);

  return {
    exercise: matchExercise(transcript, exercises),
    weight,
    reps,
    setsCount: Math.max(1, Math.min(10, setsCount)),
    type,
    transcript,
  };
}
