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
// The heading that opens the key page, in either language the page speaks.
// Greek needs the accents written as alternatives: uppercase Greek drops them
// ("ΑΠΑΝΤΗΣΕΙΣ"), so /απαντήσεις/i alone would miss a heading in capitals --
// which is how a heading is usually written.  \b is no use after a Greek
// letter either (\w is ASCII), hence the explicit "not a letter" look-ahead.
export const KEY_HEADING =
  /^\s*(answer\s*key\b|(?:απαντ[ήη]σεις|λ[ύυ]σεις|κλε[ίι]δα)(?![\p{L}]))/iu;

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
