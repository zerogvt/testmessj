// feature: exam-variants
//
// Recognising the labels a test writes: "7." opening a question, "(B)" / "b." /
// "α)" / "(iii)" opening an option, and "7.  B" on the answer key page.
//
// A marker is any single letter in any script -- \p{L}, not [A-Za-z], which is
// what lets Greek (α β γ δ) and Cyrillic work -- or a short roman numeral.
// Roman numerals are whitelisted rather than allowed as "any two or three
// letters", so an option or stem that merely opens with a short word ("No.",
// "Eq.") is not mistaken for a marker.  Digits are deliberately not accepted:
// "1)" cannot be told apart from a question number.
//
// Every pattern carries the `d` flag: relabel() needs the capture group's
// offsets to rewrite a label that is split across several runs.

const MARKER = String.raw`(?:\p{L}|[ivxIVX]{2,4})`;

export const QUESTION_LABEL = /^\s*(\d+)\s*[.)]/du;
export const OPTION_LABEL = new RegExp(
  String.raw`^\s*[(\[]?\s*(${MARKER})\s*[.)\]]`, 'du');
export const KEY_ENTRY = new RegExp(
  String.raw`^\s*(\d+)\s*[.)]\s*[(\[]?\s*(${MARKER})\s*[)\]]?\s*$`, 'du');
// The heading that opens the key page.
//
// Teachers write it every way there is: "Answer Key", "ANSWER KEY", "Answers",
// a bare "Key" or "Keys", "Λύσεις", "ΛΥΣΕΙΣ", "Απαντήσεις", "Κλείδα
// απαντήσεων".  Greek needs its accents written as alternatives, because
// uppercase Greek drops them ("ΑΠΑΝΤΗΣΕΙΣ") and a heading is usually in
// capitals.
//
// The match is against the *whole* paragraph rather than its opening, which is
// what makes the short words safe to accept: "Key" is a key page, "Key
// concepts covered in this test" is a sentence in the front matter.  A
// separator may be followed by a short tail, so "Answer Key — Variant A" and
// "Απαντήσεις:" are still headings.
const KEY_WORDS = [
  'answer\\s*keys?', 'answers?', 'keys?', 'solutions?',
  'σωστ[έε]ς\\s+απαντ[ήη]σεις', 'απαντ[ήη]σεις', 'απαντητικ[όο]',
  'λ[ύυ]σει[ςσ]', 'κλε[ίι]δα(?:\\s+απαντ[ήη]σεων)?',
];
export const KEY_HEADING = new RegExp(
  `^\\s*(?:${KEY_WORDS.join('|')})\\s*(?:[:.,·()\\[\\]/\\-–—]\\s*.{0,40})?$`, 'iu');

/** Case-fold a marker for comparison: "A" ~ "a", "Α" ~ "α", "Σ" ~ "ς". */
export function foldMarker(marker: string): string {
  // toLowerCase leaves Greek final sigma alone where a proper case-fold would
  // not, and "Σ)" in the key against "ς)" in the options is exactly the sort
  // of near-miss that would otherwise be reported as a missing option.
  return marker.toLowerCase().replace(/ς/g, 'σ');
}

/**
 * Compare two option markers, ignoring case ("A" == "a", "Α" == "α").
 *
 * Markers are stored exactly as the document writes them -- uppercasing them
 * would turn a Greek "α)" test into an "Α)" one on the way out -- so any
 * comparison between them has to be case-folded here.
 */
export function sameMarker(left: string, right: string): boolean {
  return foldMarker(left) === foldMarker(right);
}

/** The capture group's [start, end) in the matched string. */
export function groupSpan(match: RegExpExecArray, group: number): [number, number] {
  const indices = match.indices?.[group];
  if (!indices) {
    throw new Error('pattern was compiled without the d flag');
  }
  return [indices[0], indices[1]];
}
