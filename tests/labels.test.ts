// feature: exam-variants
//
// The label rewrite is the only edit this program ever makes inside a
// paragraph, so it is pinned down on its own: Word routinely splits "(A)  4"
// into "(A" + ")  4", and a rewrite that reached past the label would take
// formatting -- or an equation -- with it.

import { describe, expect, it } from 'vitest';

import { OPTION_LABEL, QUESTION_LABEL } from '../src/testmess';
import { NS, paragraphText, parseXml, relabel, textRuns } from '../src/xml';

function paragraph(...runs: string[]): Element {
  const doc = parseXml(`<w:p xmlns:w="${NS.w}"/>`);
  for (const text of runs) {
    const run = doc.createElementNS(NS.w, 'w:r');
    const node = doc.createElementNS(NS.w, 'w:t');
    node.textContent = text;
    run.append(node);
    doc.documentElement.append(run);
  }
  return doc.documentElement;
}

describe('relabel', () => {
  it('rewrites a number split across runs', () => {
    const node = paragraph('10', '.  ', 'Find the area');
    expect(relabel(node, QUESTION_LABEL, '2')).toBe(true);
    expect(paragraphText(node)).toBe('2.  Find the area');
  });

  it('rewrites a letter split across runs', () => {
    const node = paragraph('(D', ')  Does not exist');
    expect(relabel(node, OPTION_LABEL, 'B')).toBe(true);
    expect(paragraphText(node)).toBe('(B)  Does not exist');
  });

  it('rewrites a label inside a single run', () => {
    const node = paragraph('(C)  12');
    expect(relabel(node, OPTION_LABEL, 'A')).toBe(true);
    expect(paragraphText(node)).toBe('(A)  12');
  });

  it('touches only the runs the label covers', () => {
    const node = paragraph('7', '.  ', 'Evaluate:  ', ' dx');
    relabel(node, QUESTION_LABEL, '3');
    expect(textRuns(node).map((run) => run.textContent))
      .toEqual(['3', '.  ', 'Evaluate:  ', ' dx']);
  });

  it('leaves a paragraph without a label alone', () => {
    const node = paragraph('Choose the best answer.');
    expect(relabel(node, QUESTION_LABEL, '1')).toBe(false);
    expect(paragraphText(node)).toBe('Choose the best answer.');
  });

  it('copes with a marker that changes width', () => {
    // "iii" -> "i" is a shorter label; nothing around it may shift.
    const node = paragraph('(iii)', '  4');
    expect(relabel(node, OPTION_LABEL, 'i')).toBe(true);
    expect(paragraphText(node)).toBe('(i)  4');
  });

  it('keeps significant whitespace declared', () => {
    const node = paragraph('(A)  ', 'x');
    relabel(node, OPTION_LABEL, 'B');
    const run = textRuns(node)[0];
    expect(run.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'space'))
      .toBe('preserve');
  });
});
